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

### 2. サンドボックスモードの決定
- エージェント名からsandbox_modeを判定する
  - `coder`, `refactor` → `--sandbox workspace-write`
  - `test-runner`, `reviewer` → `--sandbox read-only`
- ユーザーが明示的に指定した場合はそちらを優先する

### 3. Codex実行
以下の形式でBashツールから `codex exec` を実行する:

```
codex exec \
  --sandbox <sandbox_mode> \
  -o /tmp/codex-result.txt \
  "<タスクの説明>"
```

注意:
- 対象プロジェクトのディレクトリで実行すること（必要に応じて `--cd` を使用）
- 実行時間が長い場合は `timeout` を適切に設定する（デフォルト120秒では不足する場合がある）
- `--json` フラグでJSONL形式の出力も取得可能

### 4. 結果の確認
- `/tmp/codex-result.txt` から最終メッセージを読み取る
- `git diff` で実際の変更内容を確認する
- 変更が意図通りか検証し、問題があれば修正指示を再度委譲する

### 5. 報告
- Codexが行った変更の要約をユーザーに報告する
- 問題があった場合はその内容と対応案を提示する
