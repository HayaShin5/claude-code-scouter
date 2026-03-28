#!/usr/bin/env node
"use strict";

const fs = require("fs");

const STATE_FILE = "/tmp/claude-danger-state.json";

// Lv.4: Danger  — External communication, irreversible destruction, privilege escalation
// Lv.3: Caution — Destructive local ops, process control, arbitrary execution
// Lv.2: Low     — Local writes, easily reversible
// Lv.1: Safe    — Read-only, no side effects
const patterns = {
  4: [
    // Privilege escalation
    { regex: /\bsudo\b/, desc: "sudo", summary: "Run command as superuser" },

    // Destructive file operations
    { regex: /\brm\s+.*-\w*r\w*f/, desc: "rm -rf", summary: "Recursively force-delete files" },
    { regex: /\brm\s+.*-\w*f\w*r/, desc: "rm -fr", summary: "Recursively force-delete files" },
    { regex: /\bshred\b/, desc: "shred", summary: "Irrecoverably destroy file data" },

    // Dangerous system ops
    { regex: /\bchmod\s+777\b/, desc: "chmod 777", summary: "Grant full permissions to all users" },
    { regex: /\bmkfs\b/, desc: "mkfs", summary: "Create filesystem (formats disk)" },
    { regex: /\bdd\s+/, desc: "dd", summary: "Low-level disk/device write" },
    { regex: />\s*\/dev\//, desc: "write to /dev/", summary: "Write directly to device file" },
    { regex: /\breboot\b/, desc: "reboot", summary: "Reboot the system" },
    { regex: /\bshutdown\b/, desc: "shutdown", summary: "Shut down the system" },
    { regex: /\bhalt\b/, desc: "halt", summary: "Halt the system" },
    { regex: /\bcrontab\b/, desc: "crontab", summary: "Modify scheduled tasks" },
    { regex: /\bchroot\b/, desc: "chroot", summary: "Change root directory" },
    { regex: /\b(mount|umount)\b/, desc: "mount/umount", summary: "Mount/unmount filesystem" },
    { regex: /\b(systemctl|launchctl)\b/, desc: "service management", summary: "Manage system services" },
    { regex: /\b(iptables|ufw)\b/, desc: "firewall", summary: "Modify firewall rules" },

    // SQL destructive
    { regex: /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i, desc: "DROP (SQL)", summary: "Drop database table/object" },
    { regex: /\bTRUNCATE\s+TABLE\b/i, desc: "TRUNCATE TABLE (SQL)", summary: "Delete all rows from table" },

    // Git dangerous (irreversible remote operations)
    { regex: /\bgit\s+push\s+.*--force\b/, desc: "git push --force", summary: "Force-push to remote (rewrites history)" },
    { regex: /\bgit\s+push\s+.*--force-with-lease\b/, desc: "git push --force-with-lease", summary: "Force-push with lease (rewrites history)" },
    { regex: /\bgit\s+push\s+.*-f\b/, desc: "git push -f", summary: "Force-push to remote (rewrites history)" },

    // Network / external communication
    { regex: /\bcurl\b/, desc: "curl", summary: "Send HTTP request to external URL" },
    { regex: /\bwget\b/, desc: "wget", summary: "Download file from external URL" },
    { regex: /\bscp\b/, desc: "scp", summary: "Transfer files to/from remote server" },
    { regex: /\brsync\b.*@/, desc: "rsync (remote)", summary: "Sync files with remote server" },
    { regex: /^\s*ssh\s+/, desc: "ssh", summary: "Connect to remote server" },
    { regex: /\b(nc|netcat|ncat)\b/, desc: "netcat", summary: "Open arbitrary network connection" },
    { regex: /\b(telnet|ftp|sftp)\b/, desc: "telnet/ftp", summary: "Connect/transfer to remote server" },

    // GitHub CLI dangerous mutations
    { regex: /\bgh\s+pr\s+(merge|close)/, desc: "gh pr merge/close", summary: "Merge or close GitHub PR" },

    // Package publishing
    { regex: /\bnpm\s+publish\b/, desc: "npm publish", summary: "Publish package to npm registry" },
    { regex: /\byarn\s+publish\b/, desc: "yarn publish", summary: "Publish package to npm registry" },

    // Docker external
    { regex: /\bdocker\s+push\b/, desc: "docker push", summary: "Push Docker image to registry" },

    // Pipe to shell (remote code execution)
    { regex: /\|\s*(sh|bash|zsh)\b/, desc: "pipe to shell", summary: "Pipe external code into shell" },
  ],
  3: [
    // Destructive file ops
    { regex: /\brm\b/, desc: "rm", summary: "Delete files" },
    { regex: /\btruncate\b/, desc: "truncate", summary: "Truncate file contents" },

    // In-place edits
    { regex: /\bsed\s+.*-i\b/, desc: "sed -i", summary: "Edit file in-place" },
    { regex: /\bchmod\b/, desc: "chmod", summary: "Change file permissions" },
    { regex: /\bchown\b/, desc: "chown", summary: "Change file ownership" },

    // Process management
    { regex: /\bkill\b/, desc: "kill", summary: "Terminate process" },
    { regex: /\bpkill\b/, desc: "pkill", summary: "Terminate processes by name" },
    { regex: /\bkillall\b/, desc: "killall", summary: "Terminate all processes by name" },
    { regex: /\bnohup\b/, desc: "nohup", summary: "Run persistently in background" },

    // GitHub CLI low-risk mutations
    { regex: /\bgh\s+pr\s+create\b/, desc: "gh pr create", summary: "Create GitHub pull request" },
    { regex: /\bgh\s+issue\s+create\b/, desc: "gh issue create", summary: "Create GitHub issue" },
    { regex: /\bgh\s+issue\s+close\b/, desc: "gh issue close", summary: "Close GitHub issue" },

    // Git push (non-force)
    { regex: /\bgit\s+push\b/, desc: "git push", summary: "Push code to remote repository" },

    // Git hard-to-reverse
    { regex: /\bgit\s+reset\b/, desc: "git reset", summary: "Reset commit history" },
    { regex: /\bgit\s+checkout\b.*--/, desc: "git checkout --", summary: "Discard file changes" },
    { regex: /\bgit\s+clean\b/, desc: "git clean", summary: "Remove untracked files" },
    { regex: /\bgit\s+rebase\b/, desc: "git rebase", summary: "Rewrite commit history" },
    { regex: /\bgit\s+restore\b/, desc: "git restore", summary: "Restore/discard file changes" },

    // Arbitrary code execution
    { regex: /\bnpm\s+run\b/, desc: "npm run", summary: "Run package.json script" },
    { regex: /\bmake\b/, desc: "make", summary: "Run Makefile target" },
    { regex: /\b(node|python|ruby)\s+-e\b/, desc: "inline eval", summary: "Execute inline code (opaque)" },

    // Dangerous find variants
    { regex: /\bfind\b.*-exec\b/, desc: "find -exec", summary: "Execute command on search results" },
    { regex: /\bfind\b.*-delete\b/, desc: "find -delete", summary: "Delete matched files" },
    { regex: /\bfind\b.*-execdir\b/, desc: "find -execdir", summary: "Execute in matched directories" },

    // Amplifier
    { regex: /\bxargs\b/, desc: "xargs", summary: "Batch-execute command with input args" },

    // Docker local operations
    { regex: /\bdocker\s+run\b/, desc: "docker run", summary: "Start container (may affect host)" },
    { regex: /\bdocker\s+exec\b/, desc: "docker exec", summary: "Execute command in container" },
    { regex: /\bdocker\s+build\b/, desc: "docker build", summary: "Build Docker image (runs arbitrary code)" },
    { regex: /\bdocker\s+rm\b/, desc: "docker rm", summary: "Remove container" },
    { regex: /\bdocker\s+rmi\b/, desc: "docker rmi", summary: "Remove Docker image" },
    { regex: /\bdocker[-\s]compose\s+(up|down)\b/, desc: "docker-compose up/down", summary: "Start/stop multiple containers" },
    { regex: /\bdocker\s+stop\b/, desc: "docker stop", summary: "Stop container" },
  ],
  2: [
    // File modifications (reversible)
    { regex: /\bmv\b/, desc: "mv", summary: "Move/rename files" },
    { regex: /\bcp\b/, desc: "cp", summary: "Copy files (may overwrite)" },
    { regex: /\bln\b/, desc: "ln", summary: "Create link" },
    { regex: /\btee\b/, desc: "tee", summary: "Write output to file" },
    { regex: /^\s*mkdir\b/, desc: "mkdir", summary: "Create directory" },
    { regex: /^\s*touch\b/, desc: "touch", summary: "Create/update file timestamp" },

    // Package installation
    { regex: /\bnpm\s+install\b/, desc: "npm install", summary: "Install npm packages" },
    { regex: /\byarn\b/, desc: "yarn", summary: "Yarn package operation" },
    { regex: /\bpip\s+install\b/, desc: "pip install", summary: "Install Python packages" },
    { regex: /\bbrew\s+install\b/, desc: "brew install", summary: "Install Homebrew packages" },

    // Git local safe writes
    { regex: /^\s*git\s+add\b/, desc: "git add", summary: "Stage files for commit" },
    { regex: /\bgit\s+commit\b/, desc: "git commit", summary: "Commit changes" },
    { regex: /\bgit\s+stash\b/, desc: "git stash", summary: "Stash working changes" },
    { regex: /\bgit\s+merge\b/, desc: "git merge", summary: "Merge branches" },
    { regex: /^\s*git\s+switch\b/, desc: "git switch", summary: "Switch branches" },
    { regex: /^\s*git\s+fetch\b/, desc: "git fetch", summary: "Download from remote (no merge)" },
    { regex: /^\s*git\s+clone\b/, desc: "git clone", summary: "Clone repository" },
    { regex: /^\s*git\s+pull\b/, desc: "git pull", summary: "Pull and merge from remote" },
    { regex: /^\s*git\s+checkout\b/, desc: "git checkout", summary: "Switch branches/restore files" },

    // Archive extraction
    { regex: /\btar\s+.*x/, desc: "tar extract", summary: "Extract archive (may overwrite)" },
    { regex: /\bunzip\b/, desc: "unzip", summary: "Extract ZIP (may overwrite)" },

    // Local rsync
    { regex: /\brsync\b/, desc: "rsync (local)", summary: "Sync files locally" },
  ],
  1: [
    // File reading
    { regex: /^\s*(cat|head|tail|less|more|bat)\b/, desc: "read file", summary: "Display file contents" },
    { regex: /^\s*(ls|dir|tree)\b/, desc: "list", summary: "List directory contents" },
    { regex: /^\s*(grep|rg|ag|ack)\b/, desc: "search", summary: "Search text in files" },
    { regex: /^\s*(echo|printf)\b/, desc: "echo/printf", summary: "Print text" },

    // System info
    { regex: /^\s*(pwd|whoami|hostname|date|uname|uptime|id)\b/, desc: "system info", summary: "Show system information" },
    { regex: /^\s*(file|stat|du|df)\b/, desc: "file info", summary: "Show file/disk information" },
    { regex: /^\s*(which|type|command)\b/, desc: "command lookup", summary: "Look up command location" },
    { regex: /^\s*(env|printenv)\b/, desc: "environment", summary: "Show environment variables" },

    // Text processing
    { regex: /^\s*(wc|sort|uniq|cut|tr|column|fold)\b/, desc: "text processing", summary: "Process/transform text" },
    { regex: /^\s*(diff|comm|cmp)\b/, desc: "diff/compare", summary: "Compare files" },
    { regex: /^\s*(sed|awk|perl)\b/, desc: "text transform", summary: "Transform text (stdout)" },

    // Find (without -exec/-delete)
    { regex: /^\s*find\b/, desc: "find", summary: "Search for files" },

    // Path utilities
    { regex: /^\s*(basename|dirname|realpath|readlink)\b/, desc: "path utility", summary: "Resolve/extract path" },

    // Git read-only
    { regex: /^\s*git\s+(status|log|diff|show|branch|tag|remote|stash\s+list)\b/, desc: "git read", summary: "Show Git status/history" },

    // GitHub CLI read-only
    { regex: /^\s*gh\s+(pr|issue)\s+(list|view|status)/, desc: "gh read", summary: "View GitHub PR/issue" },

    // Data processing
    { regex: /^\s*(jq|yq)\b/, desc: "data query", summary: "Query JSON/YAML data" },
    { regex: /^\s*(xxd|od|hexdump)\b/, desc: "hex dump", summary: "Display binary data" },

    // Help
    { regex: /^\s*(man|help)\b/, desc: "help", summary: "Show manual/help" },
    { regex: /--help\b/, desc: "--help", summary: "Show command help" },

    // Docker read-only
    { regex: /^\s*docker\s+(ps|images|logs|inspect|stats|info|version)\b/, desc: "docker read", summary: "Show Docker status" },

    // Test/conditionals
    { regex: /^\s*(test|\[)\b/, desc: "test/conditional", summary: "Evaluate condition" },

    // Shell basics
    { regex: /^\s*(cd|pushd|popd)\b/, desc: "cd", summary: "Change directory" },
    { regex: /^\s*(export|alias|unalias)\b/, desc: "shell config", summary: "Set shell variable/alias" },
    { regex: /^\s*(true|false|exit|return)\b/, desc: "shell builtin", summary: "Shell control flow" },
    { regex: /^\s*(clear|tput|reset)\b/, desc: "terminal", summary: "Terminal control" },
  ],
};

function assessDanger(command) {
  for (const level of [4, 3, 2, 1]) {
    for (const pattern of patterns[level]) {
      if (pattern.regex.test(command)) {
        return { level, matchedPattern: pattern.desc, summary: pattern.summary };
      }
    }
  }
  // Default: Lv.3 (unknown command — flag for review)
  return { level: 3, matchedPattern: null, summary: "Unknown command (possible side effects)" };
}

// Main: read hook input from stdin, assess, write state
async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const command = hookData?.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  const result = assessDanger(command);
  const state = {
    level: result.level,
    command: command,
    matchedPattern: result.matchedPattern,
    summary: result.summary,
    timestamp: Date.now(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { assessDanger, patterns };
