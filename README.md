# Claude Danger Indicator

VSCode extension that shows the danger level of Bash commands Claude Code asks to execute.

## Features

- **3-level danger assessment** — Commands are classified as Safe, Caution, or Dangerous
- **Status bar indicator** — Color-coded danger level displayed in the status bar
- **Warning notifications** — Automatic alerts for dangerous commands
- **Click for details** — Click the status bar item to see the full command and matched pattern

### Danger Levels

| Lv | Color | Definition | Examples |
|----|-------|------------|----------|
| 1 | 🟢 | Safe (read-only, no side effects) | `cat`, `ls`, `grep`, `git status` |
| 2 | 🟡 | Caution (local changes, process ops) | `rm`, `kill`, `npm install` |
| 3 | 🔴 | Dangerous (external, destructive, privilege escalation) | `sudo`, `rm -rf`, `git push`, `ssh` |

## How It Works

1. On activation, the extension registers a [Claude Code hook](https://docs.anthropic.com/en/docs/claude-code/hooks) (`PreToolUse`) that runs before every Bash command
2. The hook script evaluates the command against regex patterns and writes the result to a temp file
3. The extension watches the file and updates the status bar in real time

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and available in your terminal
