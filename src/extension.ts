import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const STATE_FILE = "/tmp/claude-danger-state.json";
const HOOK_SCRIPT_NAME = "claude-code-scouter.js";
const COMMAND_MAX_LENGTH = 50;

// --- i18n ---

type TranslationData = {
  patterns: Record<string, string>;
  ui: Record<string, string>;
};

let currentTranslations: TranslationData = { patterns: {}, ui: {} };
let fallbackTranslations: TranslationData = { patterns: {}, ui: {} };

function resolveLocale(): string {
  const config = vscode.workspace.getConfiguration("claude-code-scouter");
  const setting = config.get<string>("language", "auto");
  if (setting === "en" || setting === "ja") {
    return setting;
  }
  // auto: detect from VSCode locale
  const vscodeLang = vscode.env.language;
  if (vscodeLang.startsWith("ja")) {
    return "ja";
  }
  return "en";
}

function loadTranslations(extensionPath: string): void {
  const locale = resolveLocale();
  const i18nDir = path.join(extensionPath, "resources", "i18n");

  // Always load English as fallback
  try {
    const enContent = fs.readFileSync(path.join(i18nDir, "en.json"), "utf-8");
    fallbackTranslations = JSON.parse(enContent);
  } catch {
    fallbackTranslations = { patterns: {}, ui: {} };
  }

  if (locale === "en") {
    currentTranslations = fallbackTranslations;
  } else {
    try {
      const content = fs.readFileSync(path.join(i18nDir, `${locale}.json`), "utf-8");
      currentTranslations = JSON.parse(content);
    } catch {
      currentTranslations = fallbackTranslations;
    }
  }
}

function t(category: "patterns" | "ui", key: string): string {
  const section = currentTranslations[category];
  if (section && key in section) {
    return section[key];
  }
  const fallback = fallbackTranslations[category];
  if (fallback && key in fallback) {
    return fallback[key];
  }
  return key;
}

function tFormat(category: "patterns" | "ui", key: string, vars: Record<string, string>): string {
  let text = t(category, key);
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

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
let activeWarning: vscode.Disposable | undefined;

function updateStatusBar(state: DangerState): void {
  const icon = LEVEL_ICONS[state.level] || "⚪";
  const cmdDisplay = truncateCommand(state.command);
  const summary = state.matchedPattern
    ? t("patterns", state.matchedPattern)
    : t("ui", "defaultSummary");
  statusBarItem.text = `${icon} Lv.${state.level} ${cmdDisplay}`;
  statusBarItem.backgroundColor = getBackgroundColor(state.level);
  statusBarItem.tooltip = `${state.matchedPattern || "unknown"} - ${summary}\n\n${t("ui", "clickForDetails")}`;
  lastState = state;
}

function showWaitingState(): void {
  statusBarItem.text = `⚪ ${t("ui", "waiting")}`;
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = t("ui", "waitingTooltip");
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

    // Warning notification for Lv.4 (danger) — auto-dismiss after 5s
    if (state.level >= 4) {
      const warn = state.matchedPattern
        ? t("patterns", state.matchedPattern)
        : t("ui", "defaultSummary");
      const msg = tFormat("ui", "dangerWarning", {
        level: String(state.level),
        warn,
        command: truncateCommand(state.command),
      });
      if (activeWarning) {
        activeWarning.dispose();
      }
      activeWarning = vscode.window.setStatusBarMessage(msg, 5000);
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
    vscode.window.showInformationMessage(t("ui", "noCommand"));
    return;
  }

  const pattern = lastState.matchedPattern ?? "unknown";
  const summary = lastState.matchedPattern
    ? t("patterns", lastState.matchedPattern)
    : t("ui", "defaultSummary");

  const msg = tFormat("ui", "detailFormat", {
    level: String(lastState.level),
    pattern,
    summary,
    command: lastState.command,
  });
  vscode.window.showInformationMessage(msg);
}

// --- Lifecycle ---

export function activate(context: vscode.ExtensionContext): void {
  // Load translations
  loadTranslations(context.extensionPath);

  // Initialize status bar (left side, high priority)
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "claude-code-scouter.showDetails";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register command
  const cmd = vscode.commands.registerCommand(
    "claude-code-scouter.showDetails",
    showDetails
  );
  context.subscriptions.push(cmd);

  // Watch for language setting changes
  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("claude-code-scouter.language")) {
      loadTranslations(context.extensionPath);
      // Refresh display with new language
      if (lastState) {
        updateStatusBar(lastState);
      } else {
        showWaitingState();
      }
    }
  });
  context.subscriptions.push(configListener);

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
