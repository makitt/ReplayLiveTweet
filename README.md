# Replay Live Tweet
番組のハッシュタグと放映された日時でツイートを検索し、その時間帯のツイートを時刻通りに表示します。録音したラジオ番組などを聴くときに一緒に使うと、放送時の実況ツイートを見ながら聴けます。

## サイト
Google App Engine を利用。

[replaylivetweet.appspot.com](http://replaylivetweet.appspot.com/)

## Replay Live Tweet の使い方
### ツイートの再生
1. 番組のハッシュタグなど検索キーワードを入力。AND（または空白）、OR あり
2. 番組の開始日時と終了日時を入力。番組の長さは6時間まで。書式にエラーがあると［Search］ボタンが有効にならない。
3. 検索。検索は時間指定できない（たぶん）ので、朝の番組だと遡るのに時間がかかることも。API 残数に注意。番組放映時のツイートを取得できたら［Play］ボタンが有効になる。
4. 録音した番組を再生し、番組が始まったタイミングで［Play］ボタンをクリックする。例えば開始時刻を 10:00 に設定していたとしたら、番組が 10:00 ちょうどに始まらなくても再生番組内で 10:00 になったら［Play］をクリックする。
5. 中断したいときは［Pause］ボタンをクリック。再生してる番組も一緒に停めないと再開したときにずれる。

### ツイートデータの保存と読み込み
* 検索したツイートデータをファイルに保存するには、検索の後に［Download］をクリックしてください。
* ファイル名は拡張子が ".txt" ならなんでもかまいません。
* 保存したファイルを読み込むには、ステータス表示領域（メッセージが表示される緑色の四角部分）へファイルをドロップしてください。拡張子が ".txt" でないなど、ブラウザがテキストファイルと認識しなかったら読み込まないようにしています。
* Google Chrome・Firefox・Internet Explorer 10 など、HTML5 File API をサポートしているブラウザが必要です。
* ファイルドロップによるデータ読み込みができるブラウザはページを表示した時にステータス表示領域の一番下に「ファイルドロップによるツイートデータ読込可能」と表示されます。Safari 6.0.x のように読み込みだけに対応しているものもあります。
* 同じように、データをダウンロードして保存できるブラウザは「ツイートデータのダウンロード機能使用可能」と表示されます。

## 直近の更新
### 1.1.3
* 取得したツイートデータを保存できるようにした
* 保存したツイートデータを読み込んで再生できるようにした
* IE ブラウザを起動する毎に Twitter 認証が必要になっていたので修正。IE では cookie の max-age が無視されていた。

## ToDo
* ハッシュタグ判定の正規表現を変更する。2文字目以降の記号が許されている。
* iPhone で見易い CSS を作る

## Replay Live Tweet の設置
自分の環境に設置する場合は application.txt に Consumer key と Consumer secret を1行でカンマ区切りで記入してください。
application.txt.sample を書き換えてリネームすると早いです。

## License
画像を除き MIT License とします。
ファイル内に記述がある場合はそれに従うこととします。

## 注意事項など
tweepy は、Twitter REST API 1.1 の一部機能を使いたかったため以下の部分を書き換えています。

### api.py
search のリクエスト先とパラメータ、個別ツイートの取得（テスト）時に entities を使いたかったので get\_status のパラメータに include\_entities を追加

     18: search_host='api.twitter.com'
     19: search_root='/1.1'
     94: allowed_param = ['id', 'trim_user', 'include_my_retweet', 'include_entities']
    638: path = '/search/tweets.json'
    640: allowed_param = ['q', 'geocode', 'lang', 'locale', 'result_type', 'count', 'until', 'since_id', 'max_id', 'include_entities', 'callback']

### binder.py
Twitter から来る結果のヘッダに含まれる API 制限情報を使いたかったので関数の結果にヘッダ情報を含めるようにした

    179: return result, resp

## Thanks
* tweepy : [github.com](https://github.com/tweepy/tweepy)
* jQuery : [jquery.com](http://jquery.com/)
* テンプレートエンジン : [blog.tojiru.net](http://blog.tojiru.net/article/210961468.html)
* 日付入力用UI : [jqueryui.com](http://jqueryui.com/datepicker/)
* 時刻入力用UI : [www.jnathanson.com](http://www.jnathanson.com/index.cfm?page=jquery/clockpick/ClockPick)
* 日付・時刻の書式チェック : [tech.ironhearts.com](http://tech.ironhearts.com/blog/archives/164)
* スクロール操作 : [code.google.com](https://code.google.com/p/flesler-plugins/downloads/detail?name=jquery.scrollTo-1.4.3.1-min.js)
* Cookie 操作 : [github.com](https://github.com/carhartl/jquery-cookie)
* blank ページのアイコン : [www.designdeck.co.uk](http://www.designdeck.co.uk/a/1211)
* 時計アイコン : [icones.pro](http://icones.pro/en/clock-22-png-image.html)

## 更新履歴
* 1.1.2 ハッシュタグ判定の正規表現を変更
    `[#＃][0-9a-zA-Z０-９ａ-ｚＡ-Ｚ〃々〻ぁ-ヿ一-鿆]+`
* 1.1.1 番組開始時まで遡れなくても番組内のツイートが取得できていたら再生開始できるようにした。あと少しのところまで取得できた時もあるので