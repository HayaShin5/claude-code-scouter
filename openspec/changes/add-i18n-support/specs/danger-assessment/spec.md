## MODIFIED Requirements

### Requirement: 5段階の危険度レベル定義
システムはBashコマンドの危険度を以下の5段階で分類しなければならない（SHALL）。

| Lv | 定義 | 例 |
|----|------|----|
| 1 | 読み取りのみ、副作用なし（コマンド先頭一致） | `cat`, `ls`, `grep`, `git status`, `pwd` |
| 2 | ローカルの可逆的変更、または既知パターンに該当しないコマンド（デフォルト） | `git add`, `mkdir`, `cp`, 不明なコマンド |
| 3 | ローカルの不可逆的変更・プロセス操作 | `rm`, `kill`, `npm install` |
| 4 | 外部への通信・副作用あり | `git push`, `curl -X POST`, `gh pr create` |
| 5 | 広範囲・不可逆・権限昇格 | `sudo`, `rm -rf /`, `git push --force` |

#### Scenario: 読み取り専用コマンドはLv.1
- **WHEN** コマンドが `cat README.md` である
- **THEN** 危険度レベル1を返す

#### Scenario: 未知のコマンドはLv.2
- **WHEN** コマンドがどのパターンにも一致しない（例: `mycustomtool --flag`）
- **THEN** 危険度レベル2を返す

#### Scenario: ローカル不可逆コマンドはLv.3
- **WHEN** コマンドが `rm temp.log` である
- **THEN** 危険度レベル3を返す

#### Scenario: 外部通信コマンドはLv.4
- **WHEN** コマンドが `git push origin main` である
- **THEN** 危険度レベル4を返す

#### Scenario: 広範囲破壊コマンドはLv.5
- **WHEN** コマンドが `sudo rm -rf /tmp/*` である
- **THEN** 危険度レベル5を返す

### Requirement: 高レベル優先の降順評価
システムはLv.5のパターンから降順に評価し、最初に一致したレベルを採用しなければならない（MUST）。

#### Scenario: rm -rf は rm より先にLv.5で一致する
- **WHEN** コマンドが `rm -rf /tmp/data` である
- **THEN** Lv.3（`rm`）ではなくLv.5（`rm -rf`）として判定される

#### Scenario: git push --force は git push より先にLv.5で一致する
- **WHEN** コマンドが `git push --force origin main` である
- **THEN** Lv.4（`git push`）ではなくLv.5（`--force`）として判定される

### Requirement: パターンマッチによる判定
システムは正規表現パターンによるマッチングでコマンドの危険度を判定しなければならない（SHALL）。

Lv.5パターン: `sudo`, `rm -rf`系, `--force`, `DROP`(SQL), デバイス書き込み, `chmod 777`, `mkfs`, `dd`
Lv.4パターン: `git push`, `curl -X POST/PUT/DELETE/PATCH`, `wget`, `ssh`, `gh pr/issue create/merge/close`, `npm publish`, `docker push`
Lv.3パターン: `rm`, `kill`, `npm install`, `pip install`, `brew install`, `git reset`, `git checkout --`, `git clean`
Lv.1パターン（コマンド先頭一致 `^\s*` アンカー付き）: `cat/head/tail/less`, `ls/find/tree`, `grep/rg`, `echo/printf`, `pwd/whoami/date`, `git status/log/diff/show/branch`, `wc/sort/uniq/cut/tr`, `node/python/ruby -e`

Lv.5〜Lv.3パターンはコマンド文字列全体に対する部分一致（アンカーなし）で検索する。Lv.1パターンのみコマンド先頭一致（`^\s*`アンカー付き）とし、パイプ後段のコマンドが誤ってLv.1に分類されることを防ぐ。

#### Scenario: sudo を含むコマンドはLv.5
- **WHEN** コマンドが `sudo apt-get update` である
- **THEN** `\bsudo\b` パターンに一致しLv.5を返す

#### Scenario: curl POST はLv.4
- **WHEN** コマンドが `curl -X POST https://api.example.com/data` である
- **THEN** `curl.*-X\s*(POST|PUT|DELETE|PATCH)` パターンに一致しLv.4を返す

#### Scenario: npm install はLv.3
- **WHEN** コマンドが `npm install express` である
- **THEN** `\bnpm\s+install\b` パターンに一致しLv.3を返す

#### Scenario: git status はLv.1
- **WHEN** コマンドが `git status` である
- **THEN** `git\s+(status|log|diff|show|branch)` パターンに一致しLv.1を返す

### Requirement: 一致パターンの記録
システムは判定時に一致したパターンの `desc` 文字列を `matchedPattern` として記録しなければならない（MUST）。この値は拡張側での翻訳ルックアップキーとして使用される。

注: 既存の実装は既に `desc` 値を `matchedPattern` に格納している。元の MVP spec での記載（regex パターン文字列）はコードの実態と乖離していたため、本 spec で正確に記述する。

#### Scenario: 一致パターンが結果に含まれる
- **WHEN** コマンド `rm temp.log` を判定する
- **THEN** 結果に `matchedPattern: "rm"` が含まれる

#### Scenario: デフォルトレベルの場合はパターンなし
- **WHEN** コマンド `mycustomtool` がどのパターンにも一致しない
- **THEN** 結果に `matchedPattern: null` が含まれる

#### Scenario: 環境エスカレーションパターンの記録
- **WHEN** コマンド `deploy --target production` が環境エスカレーションに一致する
- **THEN** 結果に `matchedPattern: "production env"` が含まれ、翻訳キーとして使用可能である

## ADDED Requirements

### Requirement: desc 値の一意性制約
同一の `desc` 値を持つ複数のパターンは、同一の `summary` テキストを持たなければならない（MUST）。これにより翻訳ファイルでの1対1のキーマッピングが保証される。

#### Scenario: 同一 desc パターンの summary 一致
- **WHEN** 複数のパターンが同じ `desc` 値を持つ
- **THEN** それらのパターンの `summary` は同一でなければならない
