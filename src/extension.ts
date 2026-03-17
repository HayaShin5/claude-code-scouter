import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const STATE_FILE = "/tmp/claude-danger-state.json";
const HOOK_SCRIPT_NAME = "claude-danger-indicator.js";
const COMMAND_MAX_LENGTH = 50;

interface DangerState {
  level: number;
  command: string;
  matchedPattern: string | null;
  summary: string | null;
  timestamp: number;
}

interface HookEntry {
  matcher: string;
  hooks: { type: string; command: string }[];
}

// --- Danger level display config ---

const LEVEL_ICONS: Record<number, string> = {
  1: "🟢",
  2: "🔵",
  3: "🟡",
  4: "🔴",
};

function truncateCommand(command: string): string {
  if (command.length <= COMMAND_MAX_LENGTH) {
    return command;
  }
  return command.slice(0, COMMAND_MAX_LENGTH) + "...";
}

function getBackgroundColor(
  level: number
): vscode.ThemeColor | undefined {
  if (level >= 4) {
    return new vscode.ThemeColor("statusBarItem.errorBackground");
  }
  if (level === 3) {
    return new vscode.ThemeColor("statusBarItem.warningBackground");
  }
  return undefined;
}

// --- Settings.json management (hook-integration) ---

function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), ".claude", "settings.json");
}

function getHookScriptPath(): string {
  return path.join(os.homedir(), ".claude", "hooks", HOOK_SCRIPT_NAME);
}

function readClaudeSettings(): Record<string, unknown> {
  const settingsPath = getClaudeSettingsPath();
  try {
    const content = fs.readFileSync(settingsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function writeClaudeSettings(settings: Record<string, unknown>): void {
  const settingsPath = getClaudeSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function buildHookEntry(): HookEntry {
  return {
    matcher: "Bash",
    hooks: [
      {
        type: "command",
        command: `node ${getHookScriptPath()}`,
      },
    ],
  };
}

function isOurHookEntry(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  const e = entry as Record<string, unknown>;
  if (e.matcher !== "Bash") {
    return false;
  }
  const hooks = e.hooks;
  if (!Array.isArray(hooks)) {
    return false;
  }
  return hooks.some(
    (h: Record<string, unknown>) =>
      typeof h.command === "string" &&
      h.command.includes(HOOK_SCRIPT_NAME)
  );
}

function registerHook(): void {
  const settings = readClaudeSettings();

  if (!settings.hooks || typeof settings.hooks !== "object") {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown>;

  if (!Array.isArray(hooks.PreToolUse)) {
    hooks.PreToolUse = [];
  }
  const preToolUse = hooks.PreToolUse as unknown[];

  // Prevent duplicate registration
  if (preToolUse.some(isOurHookEntry)) {
    return;
  }

  preToolUse.push(buildHookEntry());
  writeClaudeSettings(settings);
}

function unregisterHook(): void {
  const settingsPath = getClaudeSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    return;
  }

  const settings = readClaudeSettings();
  const hooks = settings.hooks as Record<string, unknown> | undefined;
  if (!hooks || !Array.isArray(hooks.PreToolUse)) {
    return;
  }

  hooks.PreToolUse = (hooks.PreToolUse as unknown[]).filter(
    (entry) => !isOurHookEntry(entry)
  );
  writeClaudeSettings(settings);
}

function deployHookScript(context: vscode.ExtensionContext): void {
  const source = path.join(
    context.extensionPath,
    "resources",
    HOOK_SCRIPT_NAME
  );
  const dest = getHookScriptPath();
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(source, dest);
}

function removeHookScript(): void {
  const scriptPath = getHookScriptPath();
  try {
    fs.unlinkSync(scriptPath);
  } catch {
    // File may not exist, ignore
  }
}

function removeStateFile(): void {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    // File may not exist, ignore
  }
}

// --- Status bar display ---

let statusBarItem: vscode.StatusBarItem;
let fileWatcher: fs.FSWatcher | undefined;
let lastTimestamp = 0;
let lastState: DangerState | null = null;

function updateStatusBar(state: DangerState): void {
  const icon = LEVEL_ICONS[state.level] || "⚪";
  const cmdDisplay = truncateCommand(state.command);
  const summaryText = state.summary ? ` - ${state.summary}` : "";
  statusBarItem.text = `${icon} Lv.${state.level} ${cmdDisplay}`;
  statusBarItem.backgroundColor = getBackgroundColor(state.level);
  statusBarItem.tooltip = `${state.matchedPattern || "unknown"}${summaryText}\n\nClick for details`;
  lastState = state;
}

function showWaitingState(): void {
  statusBarItem.text = "⚪ Waiting...";
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = "Waiting for Claude Code command";
}

function readAndUpdateState(): void {
  try {
    const content = fs.readFileSync(STATE_FILE, "utf-8");
    const state: DangerState = JSON.parse(content);

    // Deduplicate by timestamp
    if (state.timestamp === lastTimestamp) {
      return;
    }
    lastTimestamp = state.timestamp;

    updateStatusBar(state);

    // Warning notification for Lv.4 (danger)
    if (state.level >= 4) {
      const warn = state.summary || state.matchedPattern || "";
      vscode.window.showWarningMessage(
        `⚠️ Lv.${state.level} ${warn}: ${state.command}`
      );
    }
  } catch {
    // Invalid JSON or read error: keep previous state, don't crash
  }
}

function startWatching(): void {
  // Read existing state file if present
  if (fs.existsSync(STATE_FILE)) {
    readAndUpdateState();
  } else {
    showWaitingState();
  }

  // Watch for changes
  try {
    fileWatcher = fs.watch(STATE_FILE, () => {
      readAndUpdateState();
    });
  } catch {
    // File doesn't exist yet, watch the directory
    try {
      fileWatcher = fs.watch(path.dirname(STATE_FILE), (_, filename) => {
        if (filename === path.basename(STATE_FILE)) {
          readAndUpdateState();
        }
      });
    } catch {
      // Unable to watch, will rely on existing state
    }
  }
}

function stopWatching(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = undefined;
  }
}

// --- Commands ---

function showDetails(): void {
  if (!lastState) {
    vscode.window.showInformationMessage(
      "No command has been evaluated yet."
    );
    return;
  }

  const pattern =
    lastState.matchedPattern !== null
      ? lastState.matchedPattern
      : "unknown";

  const summary = lastState.summary || "Unknown command (possible side effects)";

  vscode.window.showInformationMessage(
    `Lv.${lastState.level} [${pattern}] ${summary}\n\nCommand: ${lastState.command}`
  );
}

// --- Lifecycle ---

export function activate(context: vscode.ExtensionContext): void {
  // Initialize status bar (left side, high priority)
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "claude-danger-indicator.showDetails";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register command
  const cmd = vscode.commands.registerCommand(
    "claude-danger-indicator.showDetails",
    showDetails
  );
  context.subscriptions.push(cmd);

  // Deploy hook script & register hook
  deployHookScript(context);
  registerHook();

  // Start file watching
  startWatching();
}

export function deactivate(): void {
  stopWatching();
  unregisterHook();
  removeHookScript();
  removeStateFile();
}
