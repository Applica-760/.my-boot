# my-boot

AIコーディングエージェント（Claude Code / Codex）のプロジェクト初期セットアップキット。

新規・既存プロジェクトに `install.sh` 一発で、エージェント設定・カスタムSkill・行動規約を配布する。
言語固有のコード・テンプレートは含めない。

CLAUDE.md, AGENTS.mdには端的な指示

## 構成

```
claude/              # Claude Code 設定
  CLAUDE.md          #   行動規約・ロール定義
  settings.json      #   権限・環境設定
  skills/            #   カスタムSkill
    task-planning/   #     計画・記録ドキュメント作成
    execution-spec/  #     実行仕様書作成（実装者への引き継ぎ用）
    issue-log/       #     issue記録ドキュメント作成
codex/               # Codex 設定
  AGENTS.md          #   行動規約・ロール定義
  config.toml        #   環境設定
mcp.json             # CodeGraph MCP設定（→ .mcp.json として配布）
install.sh           # 配布スクリプト
```

## 使い方

```bash
# 対象プロジェクトのルートで実行
path/to/.my-boot/install.sh

# または対象ディレクトリを引数で指定
path/to/.my-boot/install.sh ~/projects/my-app
```

## CodeGraph

tree-sitterベースの静的コード解析ツール [CodeGraph](https://github.com/colbymchenry/codegraph) のMCP設定を配布する。エージェントがプロジェクトのシンボル・依存関係・呼び出しグラフを即座に参照できるようになる。LLM呼び出し不要の純粋な静的解析。

事前に1度だけ `npm i -g @colbymchenry/codegraph` でインストールし、対象プロジェクトで `codegraph init` を実行する。

## CodeGraph View

CodeGraphのシンボル依存グラフをスタンドアロンHTMLで可視化する。

### セットアップ

対象プロジェクト直下に `.my-boot` と `.codegraph` が並ぶ構成を前提とします。

```text
project/
├── .codegraph/
└── .my-boot/
    ├── package.json
    └── scripts/
```

対象プロジェクト直下で依存関係をインストールします。

```bash
npm install --prefix .my-boot
```

### 使い方

```bash
# 対象プロジェクト直下で実行
node .my-boot/scripts/codegraph-view.mjs \
  --project . \
  --symbol UserService \
  --depth 2 \
  --output ./view.html

# --output 省略時は {project}/.codegraph/view.html に出力
# --mode callgraph で呼び出し関係のみに絞る
# --depth でグラフ探索の深さを指定（デフォルト: 2）
```

## カスタムSkill

| Skill | 用途 |
|-------|------|
| `task-planning` | 実装着手前に計画を立て、進捗をチェックボックスで管理する。試行錯誤の履歴を自然に残す。 |
| `execution-spec` | 別の実装者・エージェントに渡せる実行仕様書を作成する。サブエージェント起動の補助。 |
| `issue-log` | 実験・調査結果をチーム共有用のissueドキュメントにまとめる。必要に応じて。 |
