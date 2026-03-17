# Claude Code Scouter

VSCode extension that scans and displays the danger level of commands Claude Code asks to execute.

## Features

- **4-level danger assessment** — Commands classified by impact: Safe, Low, Caution, Danger
- **Status bar indicator** — Color-coded danger level displayed in the status bar
- **Warning notifications** — Automatic alerts for dangerous commands (Lv.4)
- **Click for details** — Click the status bar item to see the full command and what it does

### Danger Levels

| Lv | Icon | Background | Definition | Examples |
|----|------|-----------|------------|----------|
| 1 | 🟢 | — | Safe (read-only, no side effects) | `cat`, `ls`, `grep`, `git status` |
| 2 | 🔵 | — | Low (local writes, easily reversible) | `git add`, `mkdir`, `cp`, `npm install` |
| 3 | 🟡 | Warning | Caution (destructive local ops, process control) | `rm`, `kill`, `git reset`, `make` |
| 4 | 🔴 | Error | Danger (external, irreversible, privilege escalation) | `sudo`, `rm -rf`, `git push`, `curl` |

Unknown commands default to **Lv.3** (Caution) to flag them for review.

## How It Works

1. On activation, the extension registers a [Claude Code hook](https://docs.anthropic.com/en/docs/claude-code/hooks) (`PreToolUse`) that runs before every Bash command
2. The hook script evaluates the command against regex patterns and writes the result to a temp file
3. The extension watches the file and updates the status bar in real time

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and available in your terminal
