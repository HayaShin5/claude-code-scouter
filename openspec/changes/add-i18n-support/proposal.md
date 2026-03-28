## Why

Claude Code Scouter のステータスバー表示やコマンド説明文がすべて英語でハードコードされており、日本語話者にとって危険度の説明が直感的に伝わりにくい。英語・日本語の切り替えをサポートすることで、日本語ユーザーが危険なコマンドの内容を即座に理解できるようにする。

## What Changes

- 翻訳リソースファイル（EN/JA）を新規追加し、UI文字列とコマンド説明文を外部化する
- `extension.ts` のハードコードされた文字列を翻訳キー参照に置き換える
- `claude-code-scouter.js` の 80+ パターンの `summary` を多言語対応にする
- VSCode のロケール設定に基づく自動言語検出を実装する
- 英語をデフォルトとし、翻訳が見つからない場合は英語にフォールバックする

**翻訳の責務分担**: hook スクリプト（`claude-code-scouter.js`）は VSCode プロセス外で動作するため、hook 側は従来通り英語の `summary` を state ファイルに書き込む。翻訳は VSCode 拡張側（`extension.ts`）がステータスバー表示時にパターンキーを元に行う。これにより IPC フォーマットは変更不要。

**スコープ外**: `package.json` のメタデータ（拡張機能名・説明文）の多言語化は今回のスコープ外とする。`package.nls.json` 対応は将来の変更として扱う。

## Capabilities

### New Capabilities

- `i18n-support`: 多言語リソース管理（翻訳ファイル EN/JA）、VSCode ロケールに基づく言語検出、フォールバック機構

### Modified Capabilities

- `statusbar-display`: 表示テキスト（ステータスバー、ツールチップ、通知）を翻訳キー経由で取得するように変更
- `danger-assessment`: パターンの `summary` を翻訳キーとして扱い、拡張側で多言語表示できるようにする
- `hook-integration`: state ファイルに `matchedPattern` が含まれることを明示し、拡張側での翻訳ルックアップのキーとして利用

## Impact

- **変更対象ファイル**: `src/extension.ts`, `resources/claude-code-scouter.js`（summary の翻訳キー整理）
- **新規ファイル**: 翻訳リソースファイル（`en.json`, `ja.json` 等）
- **IPC フォーマット**: 変更なし（hook は英語 summary を書き込み、拡張側で翻訳）
- **テスト**: 既存テストへの影響は軽微。新規テストとして言語切り替え、フォールバック、翻訳キー網羅性のテストを追加
- **依存関係**: 外部ライブラリ追加なし（VSCode API のロケール機能を利用）
