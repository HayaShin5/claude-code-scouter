# Claude Danger Indicator

VSCode extension that shows the danger level of Bash commands Claude Code asks to execute.

## Features

- **5-level danger assessment** — Commands are classified from Lv.1 (safe, read-only) to Lv.5 (destructive, privilege escalation)
- **Status bar indicator** — Color-coded danger level displayed in the status bar
- **Warning notifications** — Automatic alerts for Lv.4+ commands
- **Click for details** — Click the status bar item to see the full command and matched pattern

### Danger Levels

| Lv | Color | Definition | Examples |
|----|-------|------------|----------|
| 1 | 🟢 | Read-only, no side effects | `cat`, `ls`, `grep`, `git status` |
| 2 | 🔵 | Reversible local changes / unknown | `git add`, `mkdir`, `cp` |
| 3 | 🟡 | Irreversible local changes | `rm`, `kill`, `npm install` |
| 4 | 🟠 | External communication | `git push`, `curl -X POST`, `ssh` |
| 5 | 🔴 | Broad/irreversible/privilege escalation | `sudo`, `rm -rf`, `--force` |

## How It Works

1. On activation, the extension registers a [Claude Code hook](https://docs.anthropic.com/en/docs/claude-code/hooks) (`PreToolUse`) that runs before every Bash command
2. The hook script evaluates the command against regex patterns and writes the result to a temp file
3. The extension watches the file and updates the status bar in real time

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and available in your terminal
