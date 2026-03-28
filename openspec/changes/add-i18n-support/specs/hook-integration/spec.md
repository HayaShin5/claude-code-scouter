## MODIFIED Requirements

### Requirement: PreToolUseフックの自動登録
拡張のactivate時に `~/.claude/settings.json` の `hooks.PreToolUse` 配列にフックエントリを追加しなければならない（MUST）。既存のフックエントリは保持しなければならない（MUST）。

#### Scenario: 初回activate時にフックが登録される
- **WHEN** 拡張がactivateされ、`~/.claude/settings.json` に `hooks.PreToolUse` が存在しない
- **THEN** `hooks.PreToolUse` 配列が作成され、判定スクリプトのエントリが追加される

#### Scenario: 既存フックがある場合に追加される
- **WHEN** 拡張がactivateされ、`hooks.PreToolUse` に既存エントリがある
- **THEN** 既存エントリは保持されたまま、判定スクリプトのエントリが配列に追加される

#### Scenario: 重複登録の防止
- **WHEN** 拡張がactivateされ、判定スクリプトのエントリが既に存在する
- **THEN** エントリは重複追加されない

### Requirement: PreToolUseフックの自動削除
拡張のdeactivate時に `~/.claude/settings.json` から該当フックエントリを削除しなければならない（MUST）。他のフックエントリは保持しなければならない（MUST）。

#### Scenario: deactivate時にフックが削除される
- **WHEN** 拡張がdeactivateされる
- **THEN** `hooks.PreToolUse` 配列から判定スクリプトのエントリのみが削除され、他のエントリは保持される

#### Scenario: settings.jsonが存在しない場合
- **WHEN** 拡張がdeactivateされ、`~/.claude/settings.json` が存在しない
- **THEN** エラーは発生せず、正常に終了する

### Requirement: 判定スクリプトの配置
拡張のactivate時に判定スクリプトを `~/.claude/hooks/claude-danger-indicator.js` に配置しなければならない（MUST）。deactivate時に削除しなければならない（MUST）。

#### Scenario: activate時にスクリプトが配置される
- **WHEN** 拡張がactivateされる
- **THEN** `~/.claude/hooks/claude-danger-indicator.js` にNode.js判定スクリプトが配置される

#### Scenario: deactivate時にスクリプトが削除される
- **WHEN** 拡張がdeactivateされる
- **THEN** `~/.claude/hooks/claude-danger-indicator.js` が削除される

### Requirement: Bashツールのみを対象とする
フックエントリはBashツールの実行時のみ発火するよう設定しなければならない（MUST）。フックエントリの `matcher` に `"tool_name": "Bash"` を指定しなければならない（MUST）。

フックエントリの構造:
```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "node ~/.claude/hooks/claude-danger-indicator.js"
    }
  ]
}
```

#### Scenario: Bashツール実行時にフックが発火する
- **WHEN** Claude CodeがBashツールを実行しようとする
- **THEN** PreToolUseフックが発火し、判定スクリプトが実行される

#### Scenario: 他のツール実行時にはフックが発火しない
- **WHEN** Claude CodeがReadツールやEditツールを実行しようとする
- **THEN** matcher が `"Bash"` のため、フックは発火しない

### Requirement: 判定結果のファイル出力
判定スクリプトは結果を `/tmp/claude-danger-state.json` に書き込まなければならない（MUST）。

ファイルスキーマ:
```json
{
  "level": "<number 1-5>",
  "command": "<string>",
  "matchedPattern": "<string | null>",
  "summary": "<string>",
  "timestamp": "<number (Unix ms)>"
}
```

注: `matchedPattern` と `summary` フィールドは既存の実装に存在するが、元の MVP spec では文書化が不完全であった。本 spec はコードの実態に合わせて正確に記述する。

`matchedPattern` フィールドはパターンの `desc` 値を格納し、拡張側での翻訳ルックアップキーとして使用される。`summary` フィールドは英語テキストを格納し、デバッグおよび外部ツール参照用として維持される。拡張の表示ロジックは `summary` ではなく `matchedPattern` を翻訳キーとして使用しなければならない（MUST）。

#### Scenario: 判定結果がファイルに書き込まれる
- **WHEN** 判定スクリプトがコマンド `rm temp.log` を処理する
- **THEN** `/tmp/claude-danger-state.json` に `level: 3`, `command: "rm temp.log"`, `matchedPattern: "rm"`, `summary: "Delete files"`, 現在時刻の `timestamp` が書き込まれる

#### Scenario: ファイルは上書きされる
- **WHEN** 新しいコマンドが判定される
- **THEN** 既存の `/tmp/claude-danger-state.json` が新しい結果で上書きされる

### Requirement: 状態ファイルの削除
拡張のdeactivate時に `/tmp/claude-danger-state.json` を削除しなければならない（MUST）。ファイルが存在しない場合はエラーとしない。

#### Scenario: deactivate時に状態ファイルが削除される
- **WHEN** 拡張がdeactivateされる
- **THEN** `/tmp/claude-danger-state.json` が削除される

#### Scenario: 状態ファイルが存在しない場合
- **WHEN** 拡張がdeactivateされ、`/tmp/claude-danger-state.json` が存在しない
- **THEN** エラーは発生せず、正常に終了する
