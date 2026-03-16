## 1. プロジェクト初期セットアップ

- [ ] 1.1 VSCode拡張のスキャフォールディング（`yo code` または手動で `package.json`, `tsconfig.json`, `.vscodeignore` 等を作成）
- [ ] 1.2 `package.json` に拡張メタデータ（`name`, `publisher`, `activationEvents`, `contributes`）を定義
- [ ] 1.3 TypeScriptビルド環境のセットアップ（`tsconfig.json`, npm scripts）
- [ ] 1.4 `.gitignore` にビルド成果物・`node_modules` を追加

## 2. 危険度判定ロジック（danger-assessment）

- [ ] 2.1 判定スクリプト `claude-danger-indicator.js` の雛形を作成（stdinからフック入力を受け取り、判定結果を出力する構造）
- [ ] 2.2 Lv.5〜Lv.1の正規表現パターンを定義（plan.mdのパターン例に基づく）
- [ ] 2.3 高レベル優先の降順評価ロジックを実装（Lv.5→4→3→1の順、該当なしはLv.2）
- [ ] 2.4 一致パターンの記録（`matchedPattern`）を実装
- [ ] 2.5 判定結果を `/tmp/claude-danger-state.json` にJSON書き込み（`level`, `command`, `matchedPattern`, `timestamp`）
- [ ] 2.6 判定ロジックのユニットテストを作成（各レベルの代表コマンド、降順評価の優先度、デフォルトLv.2）

## 3. フック連携（hook-integration）

- [ ] 3.1 `~/.claude/settings.json` の読み込み・パースユーティリティを実装
- [ ] 3.2 activate時のフック登録ロジックを実装（`hooks.PreToolUse` 配列にエントリ追加、重複防止）
- [ ] 3.3 フックエントリの構造を定義（`matcher: "Bash"`, `hooks: [{ type: "command", command: "node ~/.claude/hooks/claude-danger-indicator.js" }]`）
- [ ] 3.4 deactivate時のフック削除ロジックを実装（該当エントリのみ削除、他は保持）
- [ ] 3.5 判定スクリプトの配置・削除ロジックを実装（`~/.claude/hooks/` へのコピーと削除）
- [ ] 3.6 settings.json が存在しない場合のエラーハンドリングを実装

## 4. ステータスバー表示（statusbar-display）

- [ ] 4.1 ステータスバーアイテムの初期化（左側配置、初期状態 `⚪ Waiting...`）
- [ ] 4.2 危険度レベルに応じたアイコン・テキスト更新ロジックを実装（`🟢🔵🟡🟠🔴` + `Lv.N` + コマンド概要）
- [ ] 4.3 コマンド表示の50文字制限・省略（`...`）を実装
- [ ] 4.4 レベルに応じた背景色の設定（Lv.1-2: 通常、Lv.3: warningBackground、Lv.4-5: errorBackground）
- [ ] 4.5 `/tmp/claude-danger-state.json` の `fs.watch` による監視を実装
- [ ] 4.6 タイムスタンプによる重複イベント排除を実装
- [ ] 4.7 不正なJSONの場合のエラーハンドリング（前回状態を維持、クラッシュしない）
- [ ] 4.8 起動時の既存状態ファイル読み込みを実装

## 5. 警告通知

- [ ] 5.1 Lv.4以上で `vscode.window.showWarningMessage` を表示するロジックを実装（コマンド全文と危険度レベルを含む）
- [ ] 5.2 Lv.3以下では通知を表示しないことを確認

## 6. クリック詳細ポップアップ

- [ ] 6.1 ステータスバーアイテムのクリックコマンドを登録
- [ ] 6.2 フルコマンドと判定理由（一致パターンまたはデフォルトレベルの旨）を表示するポップアップを実装

## 7. ライフサイクル管理

- [ ] 7.1 `extension.ts` の `activate` 関数にフック登録・スクリプト配置・ステータスバー初期化・ファイル監視開始をまとめる
- [ ] 7.2 `deactivate` 関数にフック削除・スクリプト削除・状態ファイル削除・監視停止をまとめる
- [ ] 7.3 状態ファイル `/tmp/claude-danger-state.json` の deactivate 時削除を実装

## 8. 結合テスト・動作確認

- [ ] 8.1 拡張をデバッグモードで起動し、ステータスバーアイテムの表示を確認
- [ ] 8.2 Claude Codeで各レベルのコマンドを実行し、危険度表示が正しく更新されることを確認
- [ ] 8.3 Lv.4以上のコマンドで警告通知が表示されることを確認
- [ ] 8.4 ステータスバークリックで詳細ポップアップが表示されることを確認
- [ ] 8.5 拡張のdeactivate後にフック・スクリプト・状態ファイルがクリーンアップされることを確認
