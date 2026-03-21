# Changelog

## [0.2.0] - 2026-03-18

### Added
- Extension icon
- 4-level danger assessment (Safe / Low / Caution / Danger)
- Command summaries in English (e.g., "Delete files", "Push code to remote repository")
- 80+ regex patterns covering git, docker, network, process, file operations
- Auto-dismissing warning notification for Lv.4 commands (5s)
- Multiline command display fix

### Changed
- Expanded from 3 levels to 4 levels for better impact granularity
- Unknown commands default to Lv.3 (Caution) instead of Lv.2
- `node/python/ruby -e` moved from Safe to Caution (arbitrary execution)
- `curl` (all methods) moved to Danger (external communication)

## [0.1.0] - 2026-03-17

### Added
- Initial release
- 3-level danger assessment with status bar indicator
- PreToolUse hook auto-registration
- Warning popup for dangerous commands
- Click-to-detail popup
- Zero configuration — install and it works
