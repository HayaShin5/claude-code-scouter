## Why

Claude Codeはツール実行前にユーザー承認を求めるが、`ls` も `rm -rf /` も同じ承認UIで表示される。コマンドの危険度がぱっと見で分からないため、危険なコマンドを見落とすリスクがある。VSCodeのステータスバーに危険度を色付きで表示することで、承認/拒否の判断を即座にサポートする。

## What Changes

- Claude Codeの `PreToolUse` フックで Bash コマンドの危険度を5段階判定するスクリプトを追加
- 判定結果をローカルファイル（`/tmp/claude-danger-state.json`）経由でVSCode拡張に伝達
- VSCode拡張がステータスバーに危険度レベル・色・コマンド概要を常時表示
- Lv.4以上のコマンドでVSCode警告通知を表示
- 拡張のactivate時にフックを自動登録、deactivate時に自動削除

## Capabilities

### New Capabilities

- `danger-assessment`: Bashコマンド文字列をパターンマッチで解析し、不可逆性×影響範囲の2軸で5段階の危険度を算出するロジック
- `hook-integration`: Claude Codeの `PreToolUse` フックとの連携。判定スクリプトの配置・登録・削除、および判定結果のファイルベース通信
- `statusbar-display`: VSCodeステータスバーへの危険度表示。レベルに応じた色分け、コマンド概要の併記、クリックで詳細ポップアップ、高危険度時の警告通知

### Modified Capabilities

（なし — 新規プロジェクトのため既存specへの変更なし）

## Impact

- **新規ファイル**: VSCode拡張一式（`extension.ts`等）、フック判定スクリプト（`claude-danger-indicator.js`）
- **外部依存**: VSCode Extension API、Node.js（VSCode同梱）
- **ユーザー環境への変更**: `~/.claude/settings.json` へのフックエントリ追加、`~/.claude/hooks/` へのスクリプト配置、`/tmp/claude-danger-state.json` の生成
- **対象範囲**: MVPではBashツールのみ。Read/Edit/Write等の専用ツールは対象外
