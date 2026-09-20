# YouTube Title Search

YouTube Data API v3が返した検索候補から、入力した**すべてのキーワードを動画タイトルに含む動画だけ**を表示する、個人利用向けの静的PWAです。PCとiPadのブラウザに対応し、結果は埋め込み再生せず公式YouTubeのHTTPS動画ページで開きます。

公開先はまだ決めておらず、GitHub Pagesも有効化していません。特定サービスへ依存せず、相対パスだけで通常の静的Webサーバーへ配置できる構成です。`file://`での動作は保証せず、ローカルでもHTTPサーバーを使用します。

## 通常のYouTube検索との違い

入力 `RPG ツクール` は、NFKC正規化後に空白で `rpg` と `ツクール` へ分割されます。APIの検索候補を受け取った後、タイトルもNFKC正規化・大文字小文字を無視して判定し、2語を順不同ですべて含む動画だけを残します。

- `RPGツクールMZの使い方` → 一致
- `ツクールMZでRPGを作ってみる` → 一致
- `RPGの作り方` → `ツクール` がないため除外
- `RPGツクール` と空白なしで入力 → 文字列全体を1キーワードとして扱う

半角・全角・タブなどの連続空白は区切りになり、重複キーワードは1つへまとめます。動画IDでも重複を除きます。

このアプリが確認できるのは、YouTube APIが各ページで返した候補（1回につき最大50件）だけです。YouTube全体の該当動画を完全に網羅するものではありません。公式仕様でも、1ページの件数が指定値より少ないことや、総件数が概算であることが説明されています。

## 主な機能

- 全キーワードをタイトルに含む動画だけを表示
- サムネイル、タイトル、チャンネル、投稿日、外部リンクを表示
- `nextPageToken`を使った「さらに読み込む」
- API候補数とタイトル一致件数を別表示
- APIエラーごとの初心者向け日本語案内
- 端末ごとにAPIキーを保存・変更・削除
- 端末内へ最大10件の検索履歴を保存、個別削除・全削除
- オフラインでもアプリシェルを開けるPWA
- 失敗時に旧キャッシュを維持するアプリ内更新

## 初めてのAPIキー設定

画面名はGoogle Cloud側の更新で少し変わる場合があります。名前だけでなく、各手順の「何を設定するか」を目印にしてください。公式の[YouTube Data API概要](https://developers.google.com/youtube/v3/getting-started)と[APIキー管理ガイド](https://cloud.google.com/docs/authentication/api-keys)も参照してください。

APIキーやGoogleアカウントの認証情報を、Codex、チャット、GitHub、スクリーンショット、ログへ入力・掲載しないでください。

### 公開先が決まる前にできること

1. [Google Cloud Console](https://console.cloud.google.com/)を開きます。
2. 自分のGoogleアカウントでログインします。アプリ側へGoogleのパスワードを入力する操作はありません。
3. 画面上部のプロジェクト選択から「新しいプロジェクト」を作成します。これはAPIの有効化、利用量、キーをこのアプリ用に分けるためです。
4. 「APIとサービス」→「ライブラリ」で `YouTube Data API v3` を検索します。
5. `YouTube Data API v3` の画面で「有効にする」を選びます。検索APIをこのプロジェクトから使えるようにする操作です。
6. 「APIとサービス」→「認証情報」を開きます。ここはアプリがGoogle APIを呼ぶための識別情報を管理する画面です。
7. 「認証情報を作成」→「APIキー」で標準APIキーを作成します。表示されたキーは安全な場所で扱い、共有しません。
8. 作成したキーの編集画面で「APIの制限」を「キーを制限」にし、`YouTube Data API v3` だけを選択して保存します。盗まれた場合でも他のGoogle APIへ使われにくくする設定です。
9. 公開URLがまだない段階では「アプリケーションの制限」を最終決定できません。ローカル確認中だけ「制限なし」にする場合は、キーが端末利用者から完全には隠せないことを理解し、API制限を必ず先に設定してください。
10. このリポジトリをローカルHTTPサーバーで起動し、画面上部の「APIキー設定」を開きます。
11. APIキーを入力して「保存して接続確認」を押します。接続確認は `search.list` を1回呼び出し、成功した場合だけブラウザへ保存します。
12. iPadとPCではブラウザ保存領域が別なので、各端末で一度ずつ設定します。自動同期しません。
13. 漏えいが疑われる場合は、Google Cloudの「認証情報」で対象キーを削除するかローテーション（新しいキーを作成・置換後に旧キーを削除）し、各端末のアプリでも保存キーを削除・変更します。

### 公開URLが決まった後に行う制限設定

1. Google Cloudの「APIとサービス」→「認証情報」で対象APIキーを開きます。
2. 「アプリケーションの制限」で、ブラウザから使うサイトを制限するため「ウェブサイト」を選びます。
3. 実際に設置したHTTPS URLをHTTPリファラーとして追加します。
4. 「APIの制限」が `YouTube Data API v3` だけになっていることも再確認して保存します。
5. 設定反映後、PCとiPadの両方から接続確認・検索を試します。

設定例：

```text
GitHub Pages:
https://ユーザー名.github.io/youtube-title-search/*

別の静的ホスティング:
https://実際のドメインまたは公開URL/*
```

ブラウザによってはクロスオリジン通信時にリファラーがオリジンだけになるため、パス付き指定が一致しないことがあります。その場合は公式ガイドの「ドメイン」と「ドメイン/*」の組み合わせを参考に、必要最小限のオリジン許可を追加してください。たとえば `https://ユーザー名.github.io` と `https://ユーザー名.github.io/*` です。ただし、この指定は同じオリジン配下の別ページにも広がるため、専用ドメインを使える場合はその方が範囲を狭くできます。

ローカルHTTPサーバーも制限後に使い続ける場合は、実際に開くオリジン（例：`http://127.0.0.1:8080` と `http://127.0.0.1:8080/*`）を別途許可します。`localhost`で開くなら、それも別の許可対象です。

GoogleはAPI制限とアプリケーション制限の両方を推奨しています。ブラウザ保存のキーは開発者ツールなどから端末利用者が確認できるため、アプリ内だけで完全に秘密にはできません。

## APIキーの登録・変更・削除

- 初回：起動時に設定画面が開きます。入力後「保存して接続確認」を押します。
- 変更：上部の「APIキー設定」→「APIキーを変更」で新しいキーを入力します。保存済みキー自体は再表示しません。
- 削除：上部の「APIキー設定」→「保存したAPIキーを削除」を押します。検索履歴は残ります。
- 保存場所：APIキーと検索履歴は別名のLocalStorage項目、PWA本体はCache Storageです。

APIキーはソースコードへ書かず、API呼び出し時もURLのクエリではなく `X-Goog-Api-Key` ヘッダーで送ります。GoogleもURLへのキー埋め込みを避け、ヘッダーを使う方法を案内しています。ただしブラウザから直接APIを呼ぶ構成なので、Google Cloud側の利用制限は必須です。

## 起動方法（ローカルHTTP）

必要環境はNode.js 20以上です。アプリ本体の実行時依存パッケージはありません。

```powershell
cd "youtube-title-search"
npm start
```

表示された `http://127.0.0.1:8080` をブラウザで開きます。終了はサーバーを起動したターミナルで `Ctrl+C` です。ポートを変える場合はPowerShellで次のように実行します。

```powershell
$env:PORT=4173
npm start
```

`file://`で直接 `index.html` を開く方式は、JavaScript moduleとService Workerの制約があるためサポートしません。

## 検索と「さらに読み込む」

通常検索はYouTube Data API v3 `search.list` へ次を送ります。

- `part=snippet`
- `type=video`
- `maxResults=50`
- `regionCode=JP`
- `relevanceLanguage=ja`
- `q=入力をNFKC正規化して前後空白を除いた検索語句`

次ページがある場合だけ「さらに読み込む」が表示されます。押すたびに `nextPageToken` を `pageToken` として最大50件を追加取得します。新しい検索では結果、動画ID集合、件数、ページトークンを初期化します。通信中は検索と追加読込を無効にして連打を防ぎます。

2026年9月14日更新の公式 `search.list` リファレンスでは、検索呼び出しにSearch Queries枠の1 unitを使い、100 calls/dayと記載されています。割り当ては将来変更される可能性があるため、現在値は[公式search.list仕様](https://developers.google.com/youtube/v3/docs/search/list)とGoogle Cloud Consoleで確認してください。

## APIエラー別の対処

| 画面表示 | 次に確認すること |
| --- | --- |
| APIキーが未設定 | 「APIキー設定」で自分のキーを保存して接続確認する |
| APIキーが無効 | 入力ミス、キーの削除・ローテーション状況を確認する |
| YouTube Data API v3が有効でない | キーと同じGoogle CloudプロジェクトでAPIを有効化する |
| 現在のURLがWebサイト制限で不許可 | 現在の公開URLまたはローカルURLを許可対象へ追加する |
| APIの利用上限 | Google Cloudの割り当てを確認し、時間を置く |
| インターネットへ接続できない | Wi-Fi・通信状態を確認して再試行する |
| YouTube API側の一時障害 | 時間を置いて再試行する |
| タイトル一致が0件 | エラーではない。次ページまたは別キーワードを試す |
| 次のページがない | 現在の候補は確認済み。別キーワードを試す |
| 予期しない応答 | アプリ更新後に再試行し、続く場合は時間を置く |

内部ではHTTPステータスとGoogle APIのエラー理由（例：`keyInvalid`、`accessNotConfigured`、`quotaExceeded`）を分類します。画面にはキー、完全な通信URL、レスポンス全文を表示・記録しません。

## PWAとして使う

### iPadのホーム画面へ追加

1. iPadのSafariで、HTTPS公開後のアプリURLを開きます。
2. Safariの共有ボタンを押します。
3. 「ホーム画面に追加」を選びます。
4. 名前を確認して「追加」を押します。
5. ホーム画面のアイコンから起動し、APIキーをその端末で設定します。

ローカルPCの `127.0.0.1` は開発用です。iPadへ入れるには、iPadからアクセスできるHTTPSの静的ホスティングが必要です。

### iPadでYouTubeアプリが開くか確認

1. 検索結果のカード、サムネイル、タイトル、「YouTubeで開く」のそれぞれを試します。
2. 公式YouTubeアプリがインストール済みで、iPadOSがYouTubeリンクをアプリで開く状態ならアプリへ移動することを確認します。
3. アプリが開かない場合も、Safariで `https://www.youtube.com/watch?v=...` の動画ページが開くことを確認します。
4. 戻る操作でYouTube Title Searchへ戻り、検索結果が残っていることを確認します。

独自URLスキームには依存せず、YouTubeのHTTPS Universal Linkを使用しています。最終的にアプリで開くかSafariで開くかはiPadOS、YouTubeアプリの有無、端末側設定が決めます。

## アプリの更新

上部の「アプリを更新」を押すと、Service Workerへ更新確認を依頼します。

1. 新リリース専用URLのHTML以外の静的ファイルを一時キャッシュへすべて取得
2. 全取得成功後だけ新しい完成キャッシュを用意
3. 新Service Workerが待機状態になってから明示的に切り替え
4. `controllerchange` を確認してから再読み込み
5. 新キャッシュが完全であることを確認後、旧アプリシェルキャッシュを削除

途中で取得に失敗した場合は新キャッシュを破棄し、現在の正常版を維持します。YouTube APIレスポンス、APIキー、YouTubeサムネイルはCache Storageへ入れません。更新してもLocalStorageのAPIキーと検索履歴は削除しません。

更新後に見た目がおかしい場合、最初からSafariのサイトデータやLocalStorageを全削除しないでください。まずアプリを閉じ、Safari本体から同じURLを開いて再読み込みし、上部の更新ボタンを試します。

## 後からGitHub Pagesへ公開する場合

今回は以下を**実行していません**。公開先を決め、リポジトリの公開方法とアクセス範囲を確認した後に行ってください。

1. `codex-work` を実機確認し、問題なければPull Requestで `main` へ取り込みます。
2. GitHubリポジトリの Settings → Pages を開きます。
3. 配信元として `main` のルート、または選択した安全な公開ワークフローを設定します。
4. 表示された公開URLでアプリ、manifest、Service Worker、アイコンを確認します。
5. Google CloudのWebサイト制限へ実際の公開URLを追加します。
6. PCとiPadでAPI接続、PWA追加、更新、YouTubeリンクを実機確認します。

PrivateリポジトリからPagesを公開できる条件や公開サイトのアクセス範囲はGitHubプラン・設定で変わります。リポジトリがPrivateでもPagesサイトが同じくPrivateとは限らないため、有効化前にGitHubの現行仕様を確認してください。このリポジトリは相対パスを使用しており、`/youtube-title-search/` のようなプロジェクトパスへ配置できます。

## 別の静的ホスティングへ公開する場合

リポジトリ内容を同じディレクトリ構造のままHTTPSで配信します。SPA用リライトやサーバーAPIは不要です。次を確認してください。

- `index.html` と `service-worker.js` を同じアプリルートに置く
- `releases/` 以下のパスを変えずに配信する
- `.webmanifest` を正しいMIME typeで返す
- Service Workerのscopeがアプリルートになる
- HTTPSを使用する
- 公開URLをGoogle CloudのWebサイト制限へ追加する
- HTMLをCDNで強く長期キャッシュせず、リリース固有アセットは長期キャッシュ可能にする

## テスト

実際のAPIキーは不要で、通信テストはすべてmockです。

```powershell
npm test
npm run check
```

`npm test` はキーワード正規化・AND判定、重複排除、ページング、連打防止、履歴、APIキー分離、エラー変換、`fetch` binding、PWA更新キャッシュを確認します。`npm run check` はそれに加えてHTML/CSS/manifest/Service Worker、相対パス、秘密情報らしい文字列、危険なDOM出力、44pxタッチ領域、リリース整合を静的確認します。

本物のGoogle API接続、iPadのSafari / ホーム画面PWA、公式YouTubeアプリ起動は自動テスト対象外です。上記の実機手順で確認してください。

## ファイル構成

```text
index.html                         アプリ入口
service-worker.js                 原子的なアプリシェル更新
releases/20260921-1/
  styles.css                      レスポンシブUI
  manifest.webmanifest            PWA情報
  icons/                           SVG / PNGアイコン
  js/app.js                        DOMと画面イベント
  js/youtubeApi.js                 YouTube API通信とエラー分類
  js/titleMatcher.js               正規化・分割・AND判定
  js/searchManager.js              検索・ページング・重複排除状態
  js/settings.js                   APIキー専用保存
  js/history.js                    検索履歴専用保存
  js/pwaUpdate.js                  更新確認とcontroller切替
tests/                             mock自動テスト・静的検査
tools/serve.mjs                    ローカルHTTPサーバー
AGENTS.md                          開発・Git・安全ルール
UI_STYLE_GUIDE.md                  このアプリのUI規約
```

リリースごとにCSS / JavaScript / manifest / iconのURLを分け、新HTMLと旧アセットが混在しにくい構成にしています。

## 将来拡張

初版では実装していませんが、判定処理をUI・API通信から分離しているため次を追加できます。

- いずれかのキーワードを含むOR検索
- 除外キーワード
- 完全一致検索
- 投稿日の範囲指定（`publishedAfter` / `publishedBefore`）

## セキュリティ上の注意

- APIキーをリポジトリ、ソース、README、テスト、fixture、ログへ入れないでください。
- APIキーを含む画面を撮影・共有しないでください。
- ブラウザ保存は暗号化された秘密保管庫ではありません。Google CloudのAPI制限・Webサイト制限・利用量監視を使ってください。
- Service Workerは同一オリジンの列挙済みアプリシェルだけを保存します。
- 外部JavaScript、CDN、解析、テレメトリは使用していません。
- APIレスポンス文字列はDOM要素の `textContent` で表示し、未検証の `innerHTML` は使用しません。

## 公式仕様

- [YouTube Data API v3: search.list](https://developers.google.com/youtube/v3/docs/search/list)
- [YouTube Data API v3: エラー](https://developers.google.com/youtube/v3/docs/errors)
- [Google APIs: グローバルエラー理由](https://developers.google.com/youtube/v3/docs/core_errors)
- [Google Cloud: APIキーを管理する](https://cloud.google.com/docs/authentication/api-keys)
- [Google Cloud: APIキーをRESTで使用する](https://cloud.google.com/docs/authentication/api-keys-use)
- [Google Cloud: APIキーのセキュリティ推奨事項](https://cloud.google.com/docs/authentication/api-keys-best-practices)
