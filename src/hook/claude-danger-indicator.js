#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const STATE_FILE = "/tmp/claude-danger-state.json";

const patterns = {
  5: [
    { regex: /\bsudo\b/, desc: "sudo" },
    { regex: /\brm\s+(-\w*)?r\w*f/, desc: "rm -rf" },
    { regex: /--force\b/, desc: "--force" },
    { regex: /\bDROP\b/i, desc: "DROP (SQL)" },
    { regex: />\s*\/dev\//, desc: "write to /dev/" },
    { regex: /\bchmod\s+777\b/, desc: "chmod 777" },
    { regex: /\bmkfs\b/, desc: "mkfs" },
    { regex: /\bdd\s+/, desc: "dd" },
  ],
  4: [
    { regex: /\bgit\s+push\b/, desc: "git push" },
    { regex: /\bcurl\b.*-X\s*(POST|PUT|DELETE|PATCH)/i, desc: "curl with mutating method" },
    { regex: /\bwget\b/, desc: "wget" },
    { regex: /\bssh\b/, desc: "ssh" },
    { regex: /\bgh\s+(pr|issue)\s+(create|merge|close)/, desc: "gh pr/issue mutation" },
    { regex: /\bnpm\s+publish\b/, desc: "npm publish" },
    { regex: /\bdocker\s+push\b/, desc: "docker push" },
  ],
  3: [
    { regex: /\brm\b/, desc: "rm" },
    { regex: /\bkill\b/, desc: "kill" },
    { regex: /\bnpm\s+install\b/, desc: "npm install" },
    { regex: /\bpip\s+install\b/, desc: "pip install" },
    { regex: /\bbrew\s+install\b/, desc: "brew install" },
    { regex: /\bgit\s+reset\b/, desc: "git reset" },
    { regex: /\bgit\s+checkout\b.*--/, desc: "git checkout --" },
    { regex: /\bgit\s+clean\b/, desc: "git clean" },
  ],
  1: [
    { regex: /^\s*(cat|head|tail|less|more)\b/, desc: "read file" },
    { regex: /^\s*(ls|dir|find|tree)\b/, desc: "list/find" },
    { regex: /^\s*(grep|rg|ag|ack)\b/, desc: "search" },
    { regex: /^\s*(echo|printf)\b/, desc: "echo/printf" },
    { regex: /^\s*(pwd|whoami|hostname|date|uname)\b/, desc: "system info" },
    { regex: /^\s*git\s+(status|log|diff|show|branch)\b/, desc: "git read" },
    { regex: /^\s*(wc|sort|uniq|cut|tr)\b/, desc: "text processing" },
    { regex: /^\s*(node|python|ruby)\s+-e\b/, desc: "one-liner eval" },
  ],
};

function assessDanger(command) {
  // Evaluate from highest to lowest level
  for (const level of [5, 4, 3, 1]) {
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
