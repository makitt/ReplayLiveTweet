# Replay Live Tweet
番組のハッシュタグと放映された日時でツイートを検索し、その時刻のツイートを再生します。

録音したラジオ番組などを聴くときに一緒に再生すると、放映時の実況ツイートを見ながら聴けます。

## サイト
Google App Engine を利用。

[replaylivetweet.appspot.com](http://replaylivetweet.appspot.com/)

## Replay Live Tweet の使い方
1. 検索したいハッシュタグを入力。AND（または空白）、OR あり
2. 番組の放映日時を入力。番組の長さは6時間まで。書式にエラーがあると［Search］ボタンが有効にならない。
3. 検索。検索は時間指定できない（たぶん）ので、朝の番組だと遡るのに時間がかかることも。API 残数に注意。
4. うまく取得できたら［Play］ボタンが有効になる。
5. 録音した番組を再生し、番組が始まったら［Play］ボタンをクリックする。
6. 中断したいときは［Pause］ボタンをクリック。再生してる番組も一緒に停めないと再開したときにずれる。

## Replay Live Tweet の設置
application.txt に Consumer key と Consumer secret を1行でカンマ区切りで記入してください。

application.txt.sample を書き換えてリネームすると早いです。

## License
画像を除き MIT License とします。
ファイル内に記述がある場合はそれに従うこととします。

## 注意事項など
tweepy は、Twitter REST API 1.1 の一部機能を使いたかったため以下の部分を書き換えています。

### api.py
search のリクエスト先とパラメータ、個別ツイートの取得（テスト）時に entities を使いたかったので get\_status のパラメータに include\_entities を追加

* 18 : search\_host='api.twitter.com'
* 19 : search\_root='/1.1'
* 94 : allowed\_param = ['id', 'trim\_user', 'include\_my\_retweet', 'include\_entities']
* 638 : path = '/search/tweets.json'
* 640 : allowed\_param = ['q', 'geocode', 'lang', 'locale', 'result\_type', 'count', 'until', 'since\_id', 'max\_id', 'include\_entities', 'callback']

### binder.py
Twitter から来る結果のヘッダに含まれる API 制限情報を使いたかったので関数の結果にヘッダ情報を含めるようにした

* 179 : return result, resp

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