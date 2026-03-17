#!/usr/bin/env node
"use strict";

const fs = require("fs");

const STATE_FILE = "/tmp/claude-danger-state.json";

// Lv.3: Dangerous (external communication, destructive/irreversible, privilege escalation)
// Lv.2: Caution (local changes, process ops, arbitrary execution)
// Lv.1: Safe (read-only, no side effects)
const patterns = {
  3: [
    // Privilege escalation
    { regex: /\bsudo\b/, desc: "sudo", summary: "管理者権限でコマンドを実行" },

    // Destructive file operations
    { regex: /\brm\s+.*-\w*r\w*f/, desc: "rm -rf", summary: "ファイルを再帰的に強制削除" },
    { regex: /\brm\s+.*-\w*f\w*r/, desc: "rm -fr", summary: "ファイルを再帰的に強制削除" },
    { regex: /\bshred\b/, desc: "shred", summary: "ファイルを復元不能に破壊" },
    { regex: /\btruncate\b/, desc: "truncate", summary: "ファイルの内容を切り詰め" },

    // Dangerous system ops
    { regex: /\bchmod\s+777\b/, desc: "chmod 777", summary: "全ユーザーにフル権限を付与" },
    { regex: /\bmkfs\b/, desc: "mkfs", summary: "ファイルシステムを作成（ディスク初期化）" },
    { regex: /\bdd\s+/, desc: "dd", summary: "ディスク/デバイスへの低レベル書き込み" },
    { regex: />\s*\/dev\//, desc: "write to /dev/", summary: "デバイスファイルへ直接書き込み" },
    { regex: /\breboot\b/, desc: "reboot", summary: "システムを再起動" },
    { regex: /\bshutdown\b/, desc: "shutdown", summary: "システムをシャットダウン" },
    { regex: /\bhalt\b/, desc: "halt", summary: "システムを停止" },
    { regex: /\bcrontab\b/, desc: "crontab", summary: "定期実行タスクを変更" },
    { regex: /\bchroot\b/, desc: "chroot", summary: "ルートディレクトリを変更" },
    { regex: /\b(mount|umount)\b/, desc: "mount/umount", summary: "ファイルシステムのマウント操作" },
    { regex: /\b(systemctl|launchctl)\b/, desc: "service management", summary: "システムサービスを操作" },
    { regex: /\b(iptables|ufw)\b/, desc: "firewall", summary: "ファイアウォール設定を変更" },

    // SQL destructive
    { regex: /\bDROP\b/i, desc: "DROP (SQL)", summary: "データベースのテーブル等を削除" },
    { regex: /\bTRUNCATE\s+TABLE\b/i, desc: "TRUNCATE TABLE (SQL)", summary: "テーブルの全データを削除" },

    // Git dangerous
    { regex: /\bgit\s+push\b/, desc: "git push", summary: "リモートリポジトリにコードを送信" },
    { regex: /\bgit\s+push\s+.*--force\b/, desc: "git push --force", summary: "リモート履歴を強制上書き" },

    // Network / external communication
    { regex: /\bcurl\b/, desc: "curl", summary: "外部URLへHTTPリクエストを送信" },
    { regex: /\bwget\b/, desc: "wget", summary: "外部URLからファイルをダウンロード" },
    { regex: /\bscp\b/, desc: "scp", summary: "リモートサーバーとファイルを転送" },
    { regex: /\brsync\b.*@/, desc: "rsync (remote)", summary: "リモートサーバーとファイルを同期" },
    { regex: /^\s*ssh\s+/, desc: "ssh", summary: "リモートサーバーに接続" },
    { regex: /\b(nc|netcat|ncat)\b/, desc: "netcat", summary: "任意のネットワーク接続を確立" },
    { regex: /\b(telnet|ftp|sftp)\b/, desc: "telnet/ftp", summary: "リモートサーバーに接続/転送" },

    // GitHub CLI mutations
    { regex: /\bgh\s+(pr|issue)\s+(create|merge|close)/, desc: "gh pr/issue mutation", summary: "GitHubのPR/Issueを作成・変更" },

    // Package publishing
    { regex: /\bnpm\s+publish\b/, desc: "npm publish", summary: "パッケージをnpmレジストリに公開" },

    // Docker dangerous
    { regex: /\bdocker\s+push\b/, desc: "docker push", summary: "Dockerイメージをレジストリに送信" },
    { regex: /\bdocker\s+run\b/, desc: "docker run", summary: "コンテナを起動（ホスト影響あり）" },
    { regex: /\bdocker\s+exec\b/, desc: "docker exec", summary: "コンテナ内でコマンドを実行" },
    { regex: /\bdocker\s+build\b/, desc: "docker build", summary: "Dockerイメージをビルド（任意コード実行）" },
    { regex: /\bdocker\s+rm\b/, desc: "docker rm", summary: "コンテナを削除" },
    { regex: /\bdocker\s+rmi\b/, desc: "docker rmi", summary: "Dockerイメージを削除" },
    { regex: /\bdocker[-\s]compose\s+(up|down)\b/, desc: "docker-compose up/down", summary: "複数コンテナを一括起動/停止" },

    // Pipe to shell (remote code execution)
    { regex: /\|\s*(sh|bash|zsh)\b/, desc: "pipe to shell", summary: "外部コードをシェルで直接実行" },
  ],
  2: [
    // File modifications
    { regex: /\brm\b/, desc: "rm", summary: "ファイルを削除" },
    { regex: /\bmv\b/, desc: "mv", summary: "ファイルを移動/リネーム" },
    { regex: /\bcp\b/, desc: "cp", summary: "ファイルをコピー（上書きの可能性）" },
    { regex: /\bln\b/, desc: "ln", summary: "リンクを作成" },
    { regex: /\btee\b/, desc: "tee", summary: "出力をファイルに書き込み" },
    { regex: /\bsed\s+.*-i\b/, desc: "sed -i", summary: "ファイルを直接書き換え" },
    { regex: /\bchmod\b/, desc: "chmod", summary: "ファイル権限を変更" },
    { regex: /\bchown\b/, desc: "chown", summary: "ファイル所有者を変更" },

    // Process management
    { regex: /\bkill\b/, desc: "kill", summary: "プロセスを終了" },
    { regex: /\bpkill\b/, desc: "pkill", summary: "名前でプロセスを終了" },
    { regex: /\bkillall\b/, desc: "killall", summary: "名前で全プロセスを終了" },
    { regex: /\bnohup\b/, desc: "nohup", summary: "バックグラウンドで永続実行" },

    // Package installation
    { regex: /\bnpm\s+install\b/, desc: "npm install", summary: "npmパッケージをインストール" },
    { regex: /\bnpm\s+run\b/, desc: "npm run", summary: "package.jsonのスクリプトを実行" },
    { regex: /\byarn\b/, desc: "yarn", summary: "Yarnでパッケージ操作" },
    { regex: /\bpip\s+install\b/, desc: "pip install", summary: "Pythonパッケージをインストール" },
    { regex: /\bbrew\s+install\b/, desc: "brew install", summary: "Homebrewでパッケージをインストール" },

    // Build tools
    { regex: /\bmake\b/, desc: "make", summary: "Makefileのタスクを実行" },

    // Git local modifications
    { regex: /\bgit\s+reset\b/, desc: "git reset", summary: "コミット履歴を巻き戻し" },
    { regex: /\bgit\s+checkout\b.*--/, desc: "git checkout --", summary: "ファイルの変更を破棄" },
    { regex: /\bgit\s+clean\b/, desc: "git clean", summary: "未追跡ファイルを削除" },
    { regex: /\bgit\s+stash\b/, desc: "git stash", summary: "作業中の変更を一時退避" },
    { regex: /\bgit\s+commit\b/, desc: "git commit", summary: "変更をコミット" },
    { regex: /\bgit\s+rebase\b/, desc: "git rebase", summary: "コミット履歴を書き換え" },
    { regex: /\bgit\s+merge\b/, desc: "git merge", summary: "ブランチを統合" },
    { regex: /\bgit\s+restore\b/, desc: "git restore", summary: "ファイルを復元/変更を破棄" },

    // Archive extraction
    { regex: /\btar\s+.*x/, desc: "tar extract", summary: "アーカイブを展開（上書きの可能性）" },
    { regex: /\bunzip\b/, desc: "unzip", summary: "ZIPを展開（上書きの可能性）" },

    // Arbitrary code execution (inline)
    { regex: /\b(node|python|ruby)\s+-e\b/, desc: "inline eval", summary: "インラインコードを実行（内容不明）" },

    // Dangerous find variants
    { regex: /\bfind\b.*-exec\b/, desc: "find -exec", summary: "検索結果に対してコマンドを実行" },
    { regex: /\bfind\b.*-delete\b/, desc: "find -delete", summary: "検索結果のファイルを削除" },
    { regex: /\bfind\b.*-execdir\b/, desc: "find -execdir", summary: "検索結果のディレクトリでコマンドを実行" },

    // Amplifier
    { regex: /\bxargs\b/, desc: "xargs", summary: "入力を引数にしてコマンドを一括実行" },

    // Docker local ops
    { regex: /\bdocker\s+stop\b/, desc: "docker stop", summary: "コンテナを停止" },

    // Local rsync
    { regex: /\brsync\b/, desc: "rsync (local)", summary: "ローカルでファイルを同期" },
  ],
  1: [
    // File reading
    { regex: /^\s*(cat|head|tail|less|more|bat)\b/, desc: "read file", summary: "ファイルの内容を表示" },
    { regex: /^\s*(ls|dir|tree)\b/, desc: "list", summary: "ディレクトリの内容を一覧表示" },
    { regex: /^\s*(grep|rg|ag|ack)\b/, desc: "search", summary: "ファイル内のテキストを検索" },
    { regex: /^\s*(echo|printf)\b/, desc: "echo/printf", summary: "テキストを出力" },

    // System info
    { regex: /^\s*(pwd|whoami|hostname|date|uname|uptime|id)\b/, desc: "system info", summary: "システム情報を表示" },
    { regex: /^\s*(file|stat|du|df)\b/, desc: "file info", summary: "ファイル/ディスク情報を表示" },
    { regex: /^\s*(which|type|command)\b/, desc: "command lookup", summary: "コマンドの場所を確認" },
    { regex: /^\s*(env|printenv)\b/, desc: "environment", summary: "環境変数を表示" },

    // Text processing
    { regex: /^\s*(wc|sort|uniq|cut|tr|column|fold)\b/, desc: "text processing", summary: "テキストを加工/集計" },
    { regex: /^\s*(diff|comm|cmp)\b/, desc: "diff/compare", summary: "ファイルの差分を比較" },

    // Find (without -exec/-delete, checked after Lv.2 patterns)
    { regex: /^\s*find\b/, desc: "find", summary: "ファイルを検索" },

    // Git read-only
    { regex: /^\s*git\s+(status|log|diff|show|branch|tag|remote|stash\s+list)\b/, desc: "git read", summary: "Gitの状態/履歴を表示" },

    // Data processing
    { regex: /^\s*(jq|yq)\b/, desc: "data query", summary: "JSON/YAMLデータを読み取り" },
    { regex: /^\s*(xxd|od|hexdump)\b/, desc: "hex dump", summary: "バイナリデータを表示" },

    // Help
    { regex: /^\s*(man|help)\b/, desc: "help", summary: "マニュアル/ヘルプを表示" },
    { regex: /--help\b/, desc: "--help", summary: "コマンドのヘルプを表示" },

    // Docker read-only
    { regex: /^\s*docker\s+(ps|images|logs|inspect)\b/, desc: "docker read", summary: "Dockerの状態を表示" },

    // Test/conditionals
    { regex: /^\s*(test|\[)\b/, desc: "test/conditional", summary: "条件を評価" },
  ],
};

function assessDanger(command) {
  // Evaluate from highest to lowest level
  for (const level of [3, 2, 1]) {
    for (const pattern of patterns[level]) {
      if (pattern.regex.test(command)) {
        return { level, matchedPattern: pattern.desc, summary: pattern.summary };
      }
    }
  }
  // Default: Lv.2 (unknown command, assume possible side effects)
  return { level: 2, matchedPattern: null, summary: "不明なコマンド（副作用の可能性あり）" };
}

// Main: read hook input from stdin, assess, write state
async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let hookData;
  try {
    hookData = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const command = hookData?.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  const result = assessDanger(command);
  const state = {
    level: result.level,
    command: command,
    matchedPattern: result.matchedPattern,
    summary: result.summary,
    timestamp: Date.now(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

// Run main only when executed directly (not when required for testing)
if (require.main === module) {
  main().catch(() => process.exit(0));
}

module.exports = { assessDanger, patterns };
