## 1. 翻訳リソースファイルの作成

- [ ] 1.1 `resources/i18n/en.json` を作成する。`resources/claude-code-scouter.js` の全パターン（80+ メインパターン＋環境エスカレーションパターン `"production env"`, `"staging env"` 等）の `desc` 値を `patterns` セクションのキーとし、対応する `summary` を値に設定する。`ui` セクションに全 UI 文字列（`waiting`, `waitingTooltip`, `noCommand`, `clickForDetails`, `defaultSummary`, `dangerWarning`, `detailFormat`）を定義する
- [ ] 1.2 `resources/i18n/ja.json` を作成する。`en.json` と完全に同一のキー構造（`patterns` 全キー＋ `ui` 全キー）で、すべての値を日本語に翻訳する

## 2. package.json への言語設定追加

- [ ] 2.1 `package.json` の `contributes.configuration` に `claude-code-scouter.language` 設定を追加する（type: string, enum: `["auto", "en", "ja"]`, default: `"auto"`, 説明文付き）

## 3. extension.ts に翻訳ヘルパーを実装

- [ ] 3.1 翻訳ファイルの読み込みロジックを実装する。`activate()` 時に言語設定を解決し（手動設定 → `vscode.env.language` → `"en"` フォールバック）、対応する JSON ファイルと英語フォールバック用 JSON を読み込む
- [ ] 3.2 `t(category, key)` ヘルパー関数を実装する。フォールバックチェーン: 現在言語 → en → キーそのまま返却
- [ ] 3.3 `vscode.workspace.onDidChangeConfiguration` で `claude-code-scouter.language` 変更を監視し、翻訳ファイルの再読み込みと表示更新を行うリスナーを追加する

## 4. extension.ts のハードコード文字列を翻訳キーに置換

- [ ] 4.1 ステータスバーの待機状態テキスト（`"Waiting..."` 等）を `t("ui", "waiting")` に置換する
- [ ] 4.2 ツールチップテキストを `t("ui", "waitingTooltip")` 等に置換する
- [ ] 4.3 クリック時の詳細ポップアップを変更する。state ファイルの `summary` フィールドへの直接参照を削除し、`matchedPattern` をキーにして `t("patterns", matchedPattern)` で翻訳済みテキストを取得する。`matchedPattern` が `null`（デフォルトレベル）の場合は `t("ui", "defaultSummary")` を使用する
- [ ] 4.4 Lv.4以上の警告通知テキストを `t("ui", "dangerWarning")` のテンプレートに置換し、`{level}`, `{warn}`, `{command}` をプレースホルダ展開する
- [ ] 4.5 詳細表示フォーマットを `t("ui", "detailFormat")` のテンプレートに置換し、プレースホルダ展開する

## 5. テストの追加

- [ ] 5.1 翻訳キー網羅性テスト: hook スクリプトの全パターン `desc` 値が `en.json` と `ja.json` の `patterns` に存在することを検証する
- [ ] 5.2 `en.json` の `patterns` 値と hook スクリプトの `summary` 値が一致することを検証するテストを追加する
- [ ] 5.3 同一 `desc` を持つ複数パターンの `summary` が同一であることを検証するテストを追加する
- [ ] 5.4 フォールバック動作テスト: 存在しないキーで `t()` を呼んだ場合に英語 → キー文字列の順でフォールバックすることを検証する
- [ ] 5.5 言語設定の解決テスト: `"auto"` / `"en"` / `"ja"` の各パターンで正しい翻訳ファイルが選択されることを検証する
