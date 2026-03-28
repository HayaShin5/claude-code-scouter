# Changelog

## [0.3.0] - 2026-03-28

### Added
- 🌐 English / Japanese (EN/JA) language switching support
- Translation resource files (`resources/i18n/en.json`, `ja.json`) covering 102 pattern descriptions and 7 UI strings
- `claude-code-scouter.language` setting (`auto` / `en` / `ja`) — `auto` detects from VSCode locale
- Real-time language switching without restart via settings change listener
- English fallback when translation key is missing
- 15 i18n tests (key coverage, summary matching, uniqueness constraint, fallback, language resolution)

### Changed
- Status bar, tooltips, detail popup, and warning notifications now use translated text via `matchedPattern` lookup instead of hardcoded English strings

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
