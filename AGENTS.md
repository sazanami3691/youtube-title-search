# YouTube Title Search 作業ルール

このリポジトリでCodexが作業する際は、以下のルールに従う。

## ブランチと変更範囲

- 作業ブランチは `codex-work` とし、作業前にブランチと `git status` を確認する。
- `main` へ直接commit / pushしない。force push、無断のPR作成・merge、ブランチ削除をしない。
- ユーザーの未コミット変更を削除・上書き・破棄せず、依頼と無関係なファイルを変更しない。
- `git reset --hard` を使用しない。

## 実装前の説明

- 作業の規模、変更対象、既存処理との関係、主なリスクを簡潔に説明する。
- 重大な追加判断が不要なら、確認待ちだけのために停止せず実装と検証まで進める。
- UI変更前に `UI_STYLE_GUIDE.md` を読み、ユーザーの明示指定を優先して適用する。

## アプリ固有の安全要件

- APIキーをソース、README、テスト、fixture、ログ、画面エラー、コミットへ含めない。
- APIキーは専用のLocalStorageキーにだけ保存し、検索履歴やPWAキャッシュと混在させない。
- ブラウザ標準 `fetch` を保持する場合は `globalThis.fetch.bind(globalThis)` を使い、注入されたmockはそのまま扱う。
- APIレスポンス由来の文字列を未検証のまま `innerHTML` へ渡さない。
- Service Workerは同一リリースのアプリシェルだけを一括取得し、取得失敗時に現在の正常キャッシュを削除しない。
- YouTube APIレスポンス、サムネイル、APIキーをCache Storageへ保存しない。
- APIキー削除やPWA更新で検索履歴を消さない。
- 公開、GitHub Pages有効化、リポジトリ公開範囲変更は、明示依頼があるまで行わない。

## 実装と検証

- Vanilla HTML / CSS / JavaScriptの静的PWAを維持し、不要なフレームワークやビルド工程を追加しない。
- 純粋ロジックはUI・通信から分離し、mockだけを使う自動テストを用意する。
- `npm test`、`npm run check`、必要なブラウザ確認、`git diff --check` を実行する。
- iPad実機やYouTubeアプリ起動を確認していない場合、確認済みと表現しない。
- テスト失敗や未解決の重大な問題がある場合はcommit / pushしない。

## commitとpush

- `git status` と `git diff` を確認し、今回変更したファイルだけを個別に `git add` する。`git add .` は使わない。
- 秘密情報、`.env`、ログ、キャッシュ、一時ファイル、ユーザーデータ、不要な生成物をcommitしない。
- 正常完了後、内容が分かるcommitを作成して `origin/codex-work` へpushする。
- 完了時に変更内容、検証結果、commit ID、push先、未実施の実機確認を報告する。
