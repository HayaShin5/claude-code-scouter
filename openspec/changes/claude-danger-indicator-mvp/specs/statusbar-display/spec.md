## ADDED Requirements

### Requirement: ステータスバーへの危険度表示
VSCodeステータスバーの左側に危険度レベル、色アイコン、コマンド概要を常時表示しなければならない（MUST）。

表示形式: `<色アイコン> Lv.<N> <コマンド先頭部分>`

コマンド表示は最大50文字とし、超過分は `...` で省略しなければならない（MUST）。

色の対応:
| Lv | 色 | アイコン |
|----|----|----------|
| 1 | 緑 | 🟢 |
| 2 | 青 | 🔵 |
| 3 | 黄 | 🟡 |
| 4 | 橙 | 🟠 |
| 5 | 赤 | 🔴 |

#### Scenario: Lv.1コマンドの表示
- **WHEN** 状態ファイルに `level: 1, command: "cat README.md"` が書き込まれる
- **THEN** ステータスバーに `🟢 Lv.1 cat README.md` と緑系の背景色で表示される

#### Scenario: Lv.5コマンドの表示
- **WHEN** 状態ファイルに `level: 5, command: "sudo rm -rf /tmp/*"` が書き込まれる
- **THEN** ステータスバーに `🔴 Lv.5 sudo rm -rf /tmp/*` と赤系の背景色で表示される

#### Scenario: 長いコマンドは省略される
- **WHEN** 状態ファイルのコマンドが50文字を超える
- **THEN** ステータスバーには先頭50文字 + `...` が表示される

### Requirement: レベルに応じた背景色の変更
ステータスバーアイテムの背景色を危険度レベルに応じて変更しなければならない（MUST）。

#### Scenario: 低危険度は通常背景
- **WHEN** 危険度がLv.1またはLv.2である
- **THEN** ステータスバーアイテムは通常の背景色で表示される

#### Scenario: 中危険度は警告背景
- **WHEN** 危険度がLv.3である
- **THEN** ステータスバーアイテムは `statusBarItem.warningBackground` で表示される

#### Scenario: 高危険度はエラー背景
- **WHEN** 危険度がLv.4またはLv.5である
- **THEN** ステータスバーアイテムは `statusBarItem.errorBackground` で表示される

### Requirement: クリックで詳細ポップアップ表示
ステータスバーアイテムをクリックした時、フルコマンドと判定理由を表示しなければならない（MUST）。

#### Scenario: クリック時に詳細が表示される
- **WHEN** ユーザーがステータスバーの危険度表示をクリックする
- **THEN** フルコマンド文字列と一致したパターン（判定理由）を含むポップアップが表示される

#### Scenario: デフォルトレベルの場合の詳細
- **WHEN** ユーザーがLv.2（デフォルト）のステータスバー表示をクリックする
- **THEN** フルコマンドと「既知のパターンに一致しないためデフォルトレベル」の旨が表示される

### Requirement: 高危険度時の警告通知
危険度がLv.4以上の場合、VSCodeの警告通知を自動表示しなければならない（MUST）。

#### Scenario: Lv.4で警告通知が表示される
- **WHEN** 状態ファイルに `level: 4, command: "git push origin main"` が書き込まれる
- **THEN** `vscode.window.showWarningMessage` でコマンド全文と危険度レベルを含む警告が表示される

#### Scenario: Lv.5で警告通知が表示される
- **WHEN** 状態ファイルに `level: 5, command: "sudo rm -rf /"` が書き込まれる
- **THEN** `vscode.window.showWarningMessage` でコマンド全文と危険度レベルを含む警告が表示される

#### Scenario: Lv.3以下では警告通知は表示されない
- **WHEN** 状態ファイルに `level: 3` 以下の結果が書き込まれる
- **THEN** 警告通知は表示されない

### Requirement: 状態ファイルの監視
拡張は `/tmp/claude-danger-state.json` を `fs.watch` で監視し、変更を検知して表示を更新しなければならない（MUST）。

#### Scenario: ファイル変更で表示が更新される
- **WHEN** `/tmp/claude-danger-state.json` の内容が変更される
- **THEN** ステータスバーの表示が新しい内容に更新される

#### Scenario: タイムスタンプによる重複イベントの排除
- **WHEN** `fs.watch` が同一ファイル変更に対して複数イベントを発火する
- **THEN** `timestamp` が前回と同じ場合は表示を更新しない

#### Scenario: 不正なJSONの場合
- **WHEN** 状態ファイルに不正なJSON（パース不能）が書き込まれる
- **THEN** 表示は前回の状態を維持し、拡張はクラッシュしない

### Requirement: 初期状態の表示
拡張の起動時、状態ファイルが存在しない場合は待機状態を表示しなければならない（MUST）。

#### Scenario: 状態ファイルが存在しない場合
- **WHEN** 拡張がactivateされ、`/tmp/claude-danger-state.json` が存在しない
- **THEN** ステータスバーに待機状態（例: `⚪ Waiting...`）が表示される

#### Scenario: 状態ファイルが既に存在する場合
- **WHEN** 拡張がactivateされ、状態ファイルが既に存在する
- **THEN** ファイルの内容を読み込み、対応する危険度表示を行う
