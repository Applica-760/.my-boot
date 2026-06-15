---
name: codex-delegate
description: Codex CLIをサブエージェントとして呼び出し、実装タスクを委譲する。
argument-hint: "<agent-name> <task-description>"
---
# Codex委譲Skill

## 概要
Claude Code（指示者）からCodex CLI（実行者）へタスクを委譲する。
`codex exec` の非対話モードを使い、指定されたサブエージェントにタスクを実行させる。

## 利用可能なCodexサブエージェント
| Agent | sandbox_mode | 用途 |
|-------|-------------|------|
| coder | workspace-write | コード生成・編集 |
| test-runner | read-only | テスト実行・結果分析 |
| refactor | workspace-write | リファクタリング |
| reviewer | read-only | コードレビュー |

## 手順

### 1. 引数の解析
- 第1引数: エージェント名（coder / test-runner / refactor / reviewer）
- 第2引数以降: タスクの説明

### 2. エージェント設定の読み取り
`codex/agents/<agent-name>.toml` をReadツールで読み取り、以下を取得する。
- `sandbox_mode` → `--sandbox` フラグに使用
- `developer_instructions` → プロンプト冒頭に付与

ユーザーがsandbox_modeを明示的に指定した場合はそちらを優先する。

### 3. Codex実行（バックグラウンド）
以下の形式でBashツールから `codex exec` を実行する。
**`run_in_background: true`** を指定し、stdout/stderrはファイルにリダイレクトしてコンテキスト混入を防ぐ。

プロンプトは `developer_instructions` の内容を冒頭にコピーし、タスク説明を `<task>` タグで続ける。

```
codex exec \
  --sandbox <sandbox_mode> \
  -o .codex/logs/codex-result.txt \
  "<developer_instructionsの内容>

<task>
<タスクの説明>
</task>" \
  > .codex/logs/codex-exec-$(date +%Y%m%d_%H%M%S).log 2>&1
```

注意:
- 対象プロジェクトのディレクトリで実行すること（必要に応じて `--cd` を使用）
- `timeout` はタスク規模に応じて設定する（デフォルト120秒では不足する場合がある）
- 完了通知が届くまで、他の作業を続行してよい（通知は自動で届くためポーリング不要）

### 4. 結果の確認
完了通知後、以下の順で最小限の情報のみ読み取る。

1. **`.codex/logs/<agent-name>_<YYYYMMDD_HHmm>.md` の Summary セクション**（優先）
   - エージェントが書く構造化ログ。原則これだけで判断する
2. **`.codex/logs/codex-result.txt`**（補助）
   - Codex CLIの `-o` 出力。Summaryだけでは不足する場合に参照する
3. **`git diff`** で実際の変更内容を確認する
4. 変更が意図通りか検証し、問題があれば修正指示を再度委譲する

`.codex/logs/codex-exec-*.log`（リダイレクトした全出力）は問題発生時の調査用。正常時は読まない。

### 5. 報告
- Codexが行った変更の要約をユーザーに報告する
- 問題があった場合はその内容と対応案を提示する
