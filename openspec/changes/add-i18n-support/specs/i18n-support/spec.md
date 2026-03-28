## ADDED Requirements

### Requirement: 翻訳リソースファイルの提供
システムは `resources/i18n/` に言語別の翻訳 JSON ファイルを提供しなければならない（MUST）。各ファイルは `patterns`（コマンドパターンの説明文）と `ui`（UI文字列）の2つのセクションを持たなければならない（MUST）。

#### Scenario: 英語翻訳ファイルが存在する
- **WHEN** 拡張がパッケージされる
- **THEN** `resources/i18n/en.json` が存在し、`patterns` と `ui` セクションを含む

#### Scenario: 日本語翻訳ファイルが存在する
- **WHEN** 拡張がパッケージされる
- **THEN** `resources/i18n/ja.json` が存在し、`patterns` と `ui` セクションを含む

#### Scenario: 翻訳ファイルのキーが網羅的である
- **WHEN** hook スクリプトの全パターン（環境エスカレーション含む）の `desc` 値を列挙する
- **THEN** `en.json` と `ja.json` の `patterns` セクションにすべての `desc` 値に対応するキーが存在する

### Requirement: 言語設定による言語選択
システムは `claude-code-scouter.language` 設定（`"auto"` / `"en"` / `"ja"`）に基づいて使用言語を決定しなければならない（MUST）。デフォルト値は `"auto"` でなければならない（MUST）。

#### Scenario: auto 設定で VSCode が日本語の場合
- **WHEN** `claude-code-scouter.language` が `"auto"` で、`vscode.env.language` が `"ja"` である
- **THEN** 日本語の翻訳ファイルが使用される

#### Scenario: auto 設定で VSCode が英語の場合
- **WHEN** `claude-code-scouter.language` が `"auto"` で、`vscode.env.language` が `"en"` である
- **THEN** 英語の翻訳ファイルが使用される

#### Scenario: 手動で日本語に設定
- **WHEN** `claude-code-scouter.language` が `"ja"` に設定されている
- **THEN** `vscode.env.language` の値に関係なく日本語の翻訳ファイルが使用される

#### Scenario: 手動で英語に設定
- **WHEN** `claude-code-scouter.language` が `"en"` に設定されている
- **THEN** `vscode.env.language` の値に関係なく英語の翻訳ファイルが使用される

### Requirement: 設定変更時のリアルタイム反映
`claude-code-scouter.language` 設定が変更された場合、翻訳ファイルを再読み込みし、表示を即時更新しなければならない（MUST）。VSCode の再起動は不要でなければならない（MUST）。

#### Scenario: 設定を英語から日本語に変更
- **WHEN** ユーザーが `claude-code-scouter.language` を `"en"` から `"ja"` に変更する
- **THEN** ステータスバーの表示が日本語に即時切り替わる

#### Scenario: 設定を auto に変更
- **WHEN** ユーザーが `claude-code-scouter.language` を `"ja"` から `"auto"` に変更する
- **THEN** `vscode.env.language` に基づいた言語で表示が即時更新される

### Requirement: 英語へのフォールバック
翻訳キーが現在の言語のファイルに存在しない場合、英語の翻訳にフォールバックしなければならない（MUST）。英語にも存在しない場合はキー文字列をそのまま返却しなければならない（MUST）。

#### Scenario: 日本語翻訳が欠落している場合
- **WHEN** 言語が `"ja"` で、`ja.json` に該当キーが存在しない
- **THEN** `en.json` の対応する値が使用される

#### Scenario: 英語翻訳も欠落している場合
- **WHEN** `en.json` にも `ja.json` にも該当キーが存在しない
- **THEN** キー文字列がそのまま表示される

#### Scenario: auto 設定で対応言語がない場合
- **WHEN** `claude-code-scouter.language` が `"auto"` で、`vscode.env.language` が `"zh-cn"` である
- **THEN** 英語の翻訳ファイルにフォールバックする

### Requirement: パターンキーの翻訳解決
拡張は state ファイルの `matchedPattern` フィールドをキーとして翻訳ファイルの `patterns` セクションから翻訳済みテキストを取得しなければならない（MUST）。state ファイルの `summary` フィールドは表示に使用してはならない（MUST NOT）。

#### Scenario: matchedPattern による翻訳
- **WHEN** state ファイルの `matchedPattern` が `"sudo"` で、言語が `"ja"` である
- **THEN** `ja.json` の `patterns.sudo` の値が表示に使用される

#### Scenario: matchedPattern が null の場合
- **WHEN** state ファイルの `matchedPattern` が `null` である
- **THEN** `ui.defaultSummary` の翻訳済みテキストが使用される
