#!/usr/bin/env node
"use strict";

const fs = require("fs");

const STATE_FILE = "/tmp/claude-danger-state.json";

// Lv.3: Dangerous (external communication, destructive/irreversible, privilege escalation)
// Lv.2: Caution (local changes, process ops, arbitrary execution)
// Lv.1: Safe (read-only, no side effects)
const patterns = {
  3: [
    // Privilege escalation
    { regex: /\bsudo\b/, desc: "sudo" },

    // Destructive file operations
    { regex: /\brm\s+.*-\w*r\w*f/, desc: "rm -rf" },
    { regex: /\brm\s+.*-\w*f\w*r/, desc: "rm -fr" },
    { regex: /\bshred\b/, desc: "shred" },
    { regex: /\btruncate\b/, desc: "truncate" },

    // Dangerous system ops
    { regex: /\bchmod\s+777\b/, desc: "chmod 777" },
    { regex: /\bmkfs\b/, desc: "mkfs" },
    { regex: /\bdd\s+/, desc: "dd" },
    { regex: />\s*\/dev\//, desc: "write to /dev/" },
    { regex: /\breboot\b/, desc: "reboot" },
    { regex: /\bshutdown\b/, desc: "shutdown" },
    { regex: /\bhalt\b/, desc: "halt" },
    { regex: /\bcrontab\b/, desc: "crontab" },
    { regex: /\bchroot\b/, desc: "chroot" },
    { regex: /\b(mount|umount)\b/, desc: "mount/umount" },
    { regex: /\b(systemctl|launchctl)\b/, desc: "service management" },
    { regex: /\b(iptables|ufw)\b/, desc: "firewall" },

    // SQL destructive
    { regex: /\bDROP\b/i, desc: "DROP (SQL)" },
    { regex: /\bTRUNCATE\s+TABLE\b/i, desc: "TRUNCATE TABLE (SQL)" },

    // Git dangerous
    { regex: /\bgit\s+push\b/, desc: "git push" },
    { regex: /\bgit\s+push\s+.*--force\b/, desc: "git push --force" },

    // Network / external communication
    { regex: /\bcurl\b/, desc: "curl" },
    { regex: /\bwget\b/, desc: "wget" },
    { regex: /\bscp\b/, desc: "scp" },
    { regex: /\brsync\b.*@/, desc: "rsync (remote)" },
    { regex: /^\s*ssh\s+/, desc: "ssh" },
    { regex: /\b(nc|netcat|ncat)\b/, desc: "netcat" },
    { regex: /\b(telnet|ftp|sftp)\b/, desc: "telnet/ftp" },

    // GitHub CLI mutations
    { regex: /\bgh\s+(pr|issue)\s+(create|merge|close)/, desc: "gh pr/issue mutation" },

    // Package publishing
    { regex: /\bnpm\s+publish\b/, desc: "npm publish" },

    // Docker dangerous
    { regex: /\bdocker\s+push\b/, desc: "docker push" },
    { regex: /\bdocker\s+run\b/, desc: "docker run" },
    { regex: /\bdocker\s+exec\b/, desc: "docker exec" },
    { regex: /\bdocker\s+build\b/, desc: "docker build" },
    { regex: /\bdocker\s+rm\b/, desc: "docker rm" },
    { regex: /\bdocker\s+rmi\b/, desc: "docker rmi" },
    { regex: /\bdocker[-\s]compose\s+(up|down)\b/, desc: "docker-compose up/down" },

    // Pipe to shell (remote code execution)
    { regex: /\|\s*(sh|bash|zsh)\b/, desc: "pipe to shell" },
  ],
  2: [
    // File modifications
    { regex: /\brm\b/, desc: "rm" },
    { regex: /\bmv\b/, desc: "mv" },
    { regex: /\bcp\b/, desc: "cp" },
    { regex: /\bln\b/, desc: "ln" },
    { regex: /\btee\b/, desc: "tee" },
    { regex: /\bsed\s+.*-i\b/, desc: "sed -i (in-place)" },
    { regex: /\bchmod\b/, desc: "chmod" },
    { regex: /\bchown\b/, desc: "chown" },

    // Process management
    { regex: /\bkill\b/, desc: "kill" },
    { regex: /\bpkill\b/, desc: "pkill" },
    { regex: /\bkillall\b/, desc: "killall" },
    { regex: /\bnohup\b/, desc: "nohup" },

    // Package installation
    { regex: /\bnpm\s+install\b/, desc: "npm install" },
    { regex: /\bnpm\s+run\b/, desc: "npm run" },
    { regex: /\byarn\b/, desc: "yarn" },
    { regex: /\bpip\s+install\b/, desc: "pip install" },
    { regex: /\bbrew\s+install\b/, desc: "brew install" },

    // Build tools
    { regex: /\bmake\b/, desc: "make" },

    // Git local modifications
    { regex: /\bgit\s+reset\b/, desc: "git reset" },
    { regex: /\bgit\s+checkout\b.*--/, desc: "git checkout --" },
    { regex: /\bgit\s+clean\b/, desc: "git clean" },
    { regex: /\bgit\s+stash\b/, desc: "git stash" },
    { regex: /\bgit\s+commit\b/, desc: "git commit" },
    { regex: /\bgit\s+rebase\b/, desc: "git rebase" },
    { regex: /\bgit\s+merge\b/, desc: "git merge" },
    { regex: /\bgit\s+restore\b/, desc: "git restore" },

    // Archive extraction
    { regex: /\btar\s+.*x/, desc: "tar extract" },
    { regex: /\bunzip\b/, desc: "unzip" },

    // Arbitrary code execution (inline)
    { regex: /\b(node|python|ruby)\s+-e\b/, desc: "inline eval" },

    // Dangerous find variants
    { regex: /\bfind\b.*-exec\b/, desc: "find -exec" },
    { regex: /\bfind\b.*-delete\b/, desc: "find -delete" },
    { regex: /\bfind\b.*-execdir\b/, desc: "find -execdir" },

    // Amplifier
    { regex: /\bxargs\b/, desc: "xargs" },

    // Docker local ops
    { regex: /\bdocker\s+stop\b/, desc: "docker stop" },

    // Local rsync
    { regex: /\brsync\b/, desc: "rsync (local)" },
  ],
  1: [
    // File reading
    { regex: /^\s*(cat|head|tail|less|more|bat)\b/, desc: "read file" },
    { regex: /^\s*(ls|dir|tree)\b/, desc: "list" },
    { regex: /^\s*(grep|rg|ag|ack)\b/, desc: "search" },
    { regex: /^\s*(echo|printf)\b/, desc: "echo/printf" },

    // System info
    { regex: /^\s*(pwd|whoami|hostname|date|uname|uptime|id)\b/, desc: "system info" },
    { regex: /^\s*(file|stat|du|df)\b/, desc: "file info" },
    { regex: /^\s*(which|type|command)\b/, desc: "command lookup" },
    { regex: /^\s*(env|printenv)\b/, desc: "environment" },

    // Text processing
    { regex: /^\s*(wc|sort|uniq|cut|tr|column|fold)\b/, desc: "text processing" },
    { regex: /^\s*(diff|comm|cmp)\b/, desc: "diff/compare" },

    // Find (without -exec/-delete, checked after Lv.2 patterns)
    { regex: /^\s*find\b/, desc: "find" },

    // Git read-only
    { regex: /^\s*git\s+(status|log|diff|show|branch|tag|remote|stash\s+list)\b/, desc: "git read" },

    // Data processing
    { regex: /^\s*(jq|yq)\b/, desc: "data query" },
    { regex: /^\s*(xxd|od|hexdump)\b/, desc: "hex dump" },

    // Help
    { regex: /^\s*(man|help)\b/, desc: "help" },
    { regex: /--help\b/, desc: "--help" },

    // Docker read-only
    { regex: /^\s*docker\s+(ps|images|logs|inspect)\b/, desc: "docker read" },

    // Test/conditionals
    { regex: /^\s*(test|\[)\b/, desc: "test/conditional" },
  ],
};

function assessDanger(command) {
  // Evaluate from highest to lowest level
  for (const level of [3, 2, 1]) {
    for (const pattern of patterns[level]) {
      if (pattern.regex.test(command)) {
        return { level, matchedPattern: pattern.desc };
      }
    }
  }
  // Default: Lv.2 (unknown command, assume possible side effects)
  return { level: 2, matchedPattern: null };
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
    timestamp: Date.now(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

// Run main only when executed directly (not when required for testing)
if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { assessDanger, patterns };
