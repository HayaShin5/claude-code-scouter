## Context

Claude Code Scouter は VSCode 拡張（`extension.ts`）と hook スクリプト（`claude-code-scouter.js`）の2プロセス構成で動作する。hook スクリプトは Claude Code の `PreToolUse` フックとして VSCode 外で実行され、`/tmp/claude-danger-state.json` を介して結果を伝達する。

現在、すべてのユーザー向け文字列は英語でハードコードされている:
- hook スクリプト: 80+ パターンの `desc` と `summary` フィールド
- extension.ts: ステータスバーテキスト、ツールチップ、通知メッセージ（約10箇所）

## Goals / Non-Goals

**Goals:**
- 英語・日本語の切り替えを VSCode のロケール設定に連動させる
- 外部ライブラリなしで翻訳機構を実装する
- 翻訳キーの欠落時に英語へ安全にフォールバックする
- 新言語の追加が翻訳ファイルの追加だけで済む拡張性

**Non-Goals:**
- `package.json` メタデータ（拡張機能名・説明文）の多言語化
- 3言語以上の翻訳ファイル同梱（将来対応）

## Decisions

### 1. 翻訳キーの設計: `desc` フィールドをキーとして使用

hook スクリプトの各パターンは `desc`（例: `"sudo"`, `"rm -rf"`, `"git push"`）と `summary`（例: `"Run command as superuser"`）を持つ。

**決定**: `desc` を翻訳キーとして使用する。

**理由**: `desc` は短く安定した識別子であり、既に state ファイルの `matchedPattern` として拡張側に伝達されている。`summary` は英語の自然文であり、キーとしては不安定（文面変更でキーが壊れる）。

**制約**: 同一の `desc` 値を持つパターンは同一の翻訳を共有しなければならない（例: `"rm -rf"` と `"rm -fr"` は同じ `desc` を持ち、同じ翻訳になる）。この制約はテストで検証する。

**対象範囲**: メインパターン（Lv.1〜4）に加え、環境キーワードエスカレーションパターン（`"production env"`, `"staging env"`）も同じ `desc` → 翻訳キーの仕組みで翻訳対象とする。

**代替案**:
- `summary` をキーにする → 英語文面の変更で翻訳が壊れるリスク
- 新たに `id` フィールドを追加する → IPC フォーマット変更が必要になり過剰

### 2. 翻訳ファイルの配置と構造

**決定**: `resources/i18n/{locale}.json` に配置する。

```
resources/
  i18n/
    en.json
    ja.json
```

**JSON 構造**:
```json
{
  "patterns": {
    "sudo": "Run command as superuser",
    "rm -rf": "Recursively force-delete files",
    "rm": "Delete files"
  },
  "ui": {
    "waiting": "Waiting...",
    "waitingTooltip": "Waiting for Claude Code command",
    "noCommand": "No command has been evaluated yet.",
    "clickForDetails": "Click for details",
    "defaultSummary": "Unknown command (possible side effects)",
    "dangerWarning": "⚠️ Lv.{level} {warn}: {command}",
    "detailFormat": "Lv.{level} [{pattern}] {summary}\n\nCommand: {command}"
  }
}
```

**理由**: `resources/` は既に hook スクリプトの配置場所として使われており、拡張のビルド・パッケージング対象に含まれる。フラットな2層構造（`patterns` / `ui`）で十分であり、ネストを深くする必要がない。

**代替案**:
- `src/i18n/` に TypeScript ファイルとして配置 → JSON の方が非開発者でも編集しやすい
- VSCode 標準の `l10n` API（`vscode.l10n.t()`）を使用 → パターン翻訳（80+エントリ）には向かない。`l10n` は静的な UI 文字列向けで、動的なキー参照に適していない

### 3. 言語検出とフォールバック

**決定**: `package.json` の `contributes.configuration` に `claude-code-scouter.language` 設定（`"auto"` / `"en"` / `"ja"`、デフォルト `"auto"`）を追加する。

言語解決の優先順位:
1. ユーザー設定が `"en"` or `"ja"` → その言語を使用
2. ユーザー設定が `"auto"` → `vscode.env.language` で自動検出
3. 対応する翻訳ファイルがない → `"en"` にフォールバック

**理由**: 自動検出だけでは VSCode の表示言語が英語でも日本語で使いたいユーザー（またはその逆）に対応できない。設定 UI を提供することで再起動なしの切り替えも可能になる。

**代替案**:
- `vscode.env.language` のみ → 手動切り替え不可、言語変更に VSCode 再起動が必要
- コマンドパレットでの切り替え → 設定 UI の方が VSCode の慣習に沿う

### 4. 翻訳モジュールの実装方針

**決定**: `extension.ts` に翻訳ヘルパー関数を追加する。別ファイルへの分離はしない。

- `activate()` 時に言語設定に基づいて翻訳ファイルを読み込む
- `vscode.workspace.onDidChangeConfiguration` で設定変更を監視し、翻訳ファイルを再読み込みする
- `t(category, key)` ヘルパーでキーを解決、見つからなければ英語にフォールバック
- フォールバックチェーン: `ja.json[key]` → `en.json[key]` → キーそのまま返却

**理由**: プロジェクト規模が小さく（extension.ts 321行）、独立モジュールにするほどの複雑性がない。設定変更リスナーにより、再起動なしで言語を即時切り替え可能。

### 5. hook スクリプト側の変更方針

**決定**: hook スクリプトは変更しない。`summary` は英語のまま state ファイルに書き込み続ける。

**理由**: hook スクリプトは VSCode プロセス外で動作し、`vscode.env.language` にアクセスできない。拡張側が `matchedPattern`（= `desc`）をキーにして翻訳を行うため、hook 側の変更は不要。

state ファイルの `summary` フィールドは拡張側で翻訳済みテキストに置き換えて表示する（state ファイル自体は書き換えない）。

### 6. 英語テキストの信頼元（Source of Truth）

**決定**: `en.json` を英語テキストの唯一の信頼元とする。拡張側は常に翻訳ファイル経由で表示テキストを取得し、state ファイルの `summary` は表示に使用しない。

**理由**: hook スクリプトの `summary` と `en.json` が乖離するリスクを排除するため、表示パスを一本化する。hook スクリプトの `summary` はデバッグ用途や他のツールからの参照用として残すが、拡張の表示ロジックは `matchedPattern` → 翻訳ファイル参照のみとする。

## Risks / Trade-offs

- **[翻訳キーの同期]** → hook スクリプトにパターンが追加された場合、翻訳ファイルに対応エントリがないと英語フォールバックになる。テストで翻訳キーの網羅性を検証することで軽減。
- **[hook と en.json の乖離]** → hook スクリプトの `summary` と `en.json` の `patterns` エントリが乖離する可能性がある。拡張は `en.json` のみを信頼元とするため表示には影響しないが、state ファイルを直接参照するツールには影響しうる。テストで両者の一致を検証することで軽減。
- **[起動時の I/O]** → 翻訳ファイルの読み込みが起動時に発生する。ファイルサイズは数KB程度なので実質的な影響なし。
- **[VSCode 言語変更時の反映]** → `vscode.env.language`（auto モード）は起動時に固定されるため、VSCode の表示言語変更には再起動が必要。ただし `claude-code-scouter.language` 設定による手動切り替えは即時反映される。
