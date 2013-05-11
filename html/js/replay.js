'use strict';

/** @const */ var MAX_TWEETS = 100;                               // 画面に表示する最大ツイート数
/** @const */ var TWEET_TEMPLATE = 'template/tweet.tmpl';         // ツイート部のテンプレートファイル
/** @const */ var URL_SEARCH = '/app/search';                     // Search APP URL
/** @const */ var URL_RATE_LIMIT_STATUS = '/app/ratelimitstatus'; // API 制限情報取得APP URL
/** @const */ var URL_OAUTH = '/app/oauth';                       // OAuth 認証APP URL
/** @const */ var URL_BLANK = 'blank.html';                       // OAuth をキャンセルした時のURL
/** @const */ var TIME_SEARCH_WAIT = 250;                         // Search API への連続リクエストの間隔(ms)
/** @const */ var MODE_PC = 1;                                    // 表示モード: PC
/** @const */ var MODE_PHONE = 2;                                 // 表示モード: スマートフォン

var tweetCreates = [];  // ツイート格納配列
var timeNextDt = {};    // タイマーが作動する日時
var timeNextDiff = 0;   // (一時停止時)タイマーが作動するまでの時間
var timeStart = {};     // 番組開始日時
var timeEnd = {};       // 番組終了日時
var timerId = 0;        // イベントタイマーID
var tmplTweet = {};     // ツイート部分のテンプレート
var mode = MODE_PC;     // 表示モード
var debug = false;

// ページ読み込み後処理
$(function() {
    if (document.URL.indexOf('localhost') > 0) debug = true;

    if (debug) {
        document.config.query.value = '#nichiten';
        document.config.start_date.value = '2013/4/21';
        document.config.start_time.value = '10:00';
        document.config.end_date.value = '2013/4/21';
        document.config.end_time.value = '11:55';
        $('#testbutton').show();
    }

    // PC or スマートフォン
    if (navigator.userAgent.search(/iPhone/) >= 0) mode = MODE_PHONE;

    // 認証されてない場合はダイアログ表示
    if (typeof $.cookie('access_token_key') === 'undefined' ||
        typeof $.cookie('access_token_secret') === 'undefined') {
        switch (mode) {
            case MODE_PC:
                $('#dialog div').dialog({
                    buttons: {
                        'Go Twitter': function() {location.href = URL_OAUTH;},
                        'Cancel': function() {location.href = URL_BLANK;}
                    },
                    closeOnEscape: false,
                    dialogClass: 'no-close',
                    modal: true
                });
                return;
                break;

            case MODE_PHONE:
                if (confirm($('#dialog p').text())) {
                    location.href = URL_OAUTH;
                } else {
                    location.href = URL_BLANK;
                }
                return;
                break;
        }
    }

    // ツイート部分のテンプレートファイル読み込み
    $.ajax({
        async: true,
        dataType: 'text',
        scriptCharset: 'utf-8',
        type: "GET",
        url: TWEET_TEMPLATE,
        success: function(data) {
          tmplTweet = new t(data);
          updateStatus('テンプレート読込完了');
          $('#status').scrollTo('p:first');
        },
        error: function(XMLHReq, textStatus, errorThrown) {
          updateStatus('テンプレート読込エラー: "' + textStatus + ' ' +
              XMLHReq.status + ' ' + errorThrown + '"');
        }
    });

    // ボタン状態
    checkInputs();
    $('#start_replay').prop('disabled', true);
    $('#save_tweets').prop('disabled', true);

    //カレンダー・時計設定
    switch (mode) {
        case MODE_PC:
            $('#start_date').datepicker({ onSelect: function() {
              if ($('#end_date').val() === '') {
                  $('#end_date').val($('#start_date').val());
              }
              checkInputs();
              $('#start_time').focus();
            }});

            $('#start_time_clock').clockpick({
                starthour: 0, endhour: 23, minutedivisions: 12, military: true,
                valuefield: 'start_time'}, checkInputs);

            $('#end_date').datepicker({ onSelect: function() {
              if ($('#start_date').val() === '') {
                  $('#start_date').val($('#end_date').val());
              }
              checkInputs();
              $('#end_time').focus();
            }});

            $('#end_time_clock').clockpick({
                starthour: 0, endhour: 23, minutedivisions: 12, military: true,
                valuefield: 'end_time'}, checkInputs);

            // File API が使用できかどうかステータスに表示
            if (checkFileAPIFD() === '') {
                updateStatus('ファイルドロップによるツイートデータ読込可能');
            } else {
                // ファイルドロップがサポートされてないのでイベント削除
                $('#status').unbind('drop').unbind('dragover');
            }

            if (checkFileAPIDL() === '') {
                updateStatus('ツイートデータのダウンロード機能使用可能');
            }

            break;

        case MODE_PHONE:
            // input の形式を変更
            $('#start_date').attr('type', 'date');
            $('#start_time').attr('type', 'time');
            $('#end_date').attr('type', 'date');
            $('#end_time').attr('type', 'time');

            // 書式チェックイベントを onchange で
            $('#start_date').bind('change', checkInputs);
            $('#start_time').bind('change', checkInputs);
            $('#end_date').bind('change', checkInputs);
            $('#end_time').bind('change', checkInputs);

            break;
    }
});


// Twitter API制限情報取得
function getAPIStatus() {
    updateStatus('Twitter API 制限情報取得中...');

    $.ajax({
        async: true,
        dataType: 'json',
        scriptCharset: 'utf-8',
        type: "GET",
        url: URL_RATE_LIMIT_STATUS,
        success: function(data) {
            // 制限数
            updateStatus('制限数: ' + data.resources.search['/search/tweets'].limit);
            // 残数
            var remaining = data.resources.search['/search/tweets'].remaining;
            updateStatus('残数: ' + remaining);
            // リセット日時
            var dt = new Date(data.resources.search['/search/tweets'].reset * 1000);
            updateStatus('リセット日時: ' + dt.toLocaleString());
            // Search API 残数が0なら検索中止
            if (typeof data.resources.search['/search/tweets'].remaining === 'undefined') {
                updateStatus('検索中止: Twitter Search API の残数を取得できなかった');
            } else if (remaining === 0) {
                updateStatus('検索中止: Twitter Search API の残数 0');
            } else {
                // 検索開始
                startSearch();
            }
        },
        error: function(XMLHReq, textStatus, errorThrown) {
            updateStatus('Twitter API 制限情報取得エラー: "' + textStatus + ' ' +
                XMLHReq.status + ' ' + errorThrown + '"');
        }
    });
}

// 初期化
function init() {
    if (timerId) {
        clearTimeout(timerId);
        timerId = 0;
    }
    $('#start_replay').prop('disabled', true);
    $('#start_replay').text('Play').unbind('click').bind('click', startReplay);
    $('#save_tweets').prop('disabled', true);
    $('#twitterlogo').hide();
    $('#tweets').empty();

    // 開始・終了日時をセット
    var dt = document.config.start_date.value.replace(/-/g, '/'); // セパレータが違う場合がある
    timeStart = new Date(dt + ' ' + document.config.start_time.value);

    dt = document.config.end_date.value.replace(/-/g, '/');
    timeEnd = new Date(dt + ' ' + document.config.end_time.value);
}

// 検索開始
function startSearch() {
    $('#start_search').prop('disabled', true);

    // 初期化
    init();
    tweetCreates = [];

    // 検索文字列を生成
    // until は 指定日の0時を指すので番組終了から1日後の日付にする
    var untildt = new Date(timeEnd.getTime() + 1000 * 60 * 60 * 24);
    var until = untildt.getUTCFullYear() + '-' + (untildt.getUTCMonth() + 1) +
        '-' + (untildt.getUTCDate());
    var url = URL_SEARCH +
        '?q=' + encodeURIComponent(document.config.query.value) +
        '&until=' + until +
        '&lang=ja&count=100&result_type=recent&include_entities=1';
    //if (debug) url = 'data/result_1.json';

    // ツイートデータ取得後、成功したら Play ボタンを有効化
    getTweetData(url, 1);

    $('#start_search').prop('disabled', false);
}

// Twitter Search からデータを取得 results 部分を tweetCreates に追加
function getTweetData(url, count) {
    updateStatus('ツイートデータ取得中(' + count + ')...');

    $.ajax({
        async: true,
        dataType: 'json',
        scriptCharset: 'utf-8',
        timeout: 10000,
        type: "GET",
        url: url,
        success: function(json, textStatus, XMLHReq) {
            // if (debug) {$('#status').append(JSON.stringify(json)); return;}
            var rdt = new Date(XMLHReq.getResponseHeader('X-RateLimit-Reset') * 1000);
            var dif = (rdt - new Date()) / 1000;
            updateStatus('API残数: ' + XMLHReq.getResponseHeader('X-RateLimit-Remaining') +
                ' リセットまで ' + Math.floor(dif / 60) + '分' +
                Math.round(dif % (60)) + '秒');

            if (typeof json.statuses === 'undefined' || json.statuses.length === 0) {
                updateStatus('データ取得失敗: 検索結果 0件');
            } else {
                var dtstr = json.statuses[json.statuses.length - 1].created_at;
                var timeOldest = new Date(addUTC(dtstr));  // IE で変換できるように 'UTC' を加える
                // 取得した一番古いツイートが番組終了日時より前なら配列へ追加
                if (timeOldest <= timeEnd) {
                    json.statuses.reverse(); // 古いツイートを先頭に
                    tweetCreates = json.statuses.concat(tweetCreates);
                }

                // 取得した一番古いツイートが番組開始時刻よりも新しい場合は次ページ取得
                if (timeOldest >= timeStart) {
                    if (typeof json.search_metadata !== 'undefined' &&
                        typeof json.search_metadata.next_results !== 'undefined') {
                        var urlstr = 'getTweetData("' + URL_SEARCH +
                            json.search_metadata.next_results + '", ' +
                            ++count + ')';
                        setTimeout(urlstr, TIME_SEARCH_WAIT);
                        return;
                    } else {
                        updateStatus('データ取得失敗: 番組時間内すべてのツイート' +
                            'は取得できなかったが再生は可能');
                        var dt = new Date(addUTC(tweetCreates[0]['created_at']));
                        updateStatus('最古ツイート日時: ' + dt.toLocaleString());
                        $('#start_replay').prop('disabled', false);
                        if (!checkFileAPIDL()) $('#save_tweets').prop('disabled', false);
                        return;
                    }
                }
                // 番組時間外のツイートを削除
                for (var i = tweetCreates.length - 1; i >= 0; i--) {
                    if (new Date(addUTC(tweetCreates[i]['created_at'])) < timeStart ||
                        new Date(addUTC(tweetCreates[i]['created_at'])) > timeEnd ) {
                        tweetCreates.splice(i, 1);
                    }
                }
                if (tweetCreates.length === 0) {
                    updateStatus('データ取得失敗: 番組時間帯のツイートが無い');
                    return;
                }
                updateStatus('ツイートデータ取得完了');
                $('#start_replay').prop('disabled', false);
                if (!checkFileAPIDL()) {
                    updateStatus('ツイートデータのダウンロード可能。 ' +
                        '※ファイル名を "お好きなファイル名.txt" にしてください。' +
                        'データを使用するにはこの領域にファイルをドロップしてください。');
                    $('#save_tweets').prop('disabled', false);
                }
            }
        },
        error: function(XMLHReq, textStatus, errorThrown) {
            updateStatus('データ取得失敗: "' + textStatus + ' ' + XMLHReq.status + ' ' +
                errorThrown + '"');
        }
    });
}

// リプレイスタート
function startReplay() {
    updateStatus('再生開始');

    // スタートボタンを一時停止ボタンに
    $('#start_replay').text('Pause').unbind('click').bind('click', pauseReplay);

    // ツイッターロゴを表示
    $('#twitterlogo').show();
    $.scrollTo('#twitterlogo');

    var timeNext = new Date(addUTC(tweetCreates[0]['created_at']));

    // 次のツイートのタイマーをセット
    var diff = timeNext - timeStart;
    if (diff <= 0) diff = 1;
    timerId = setTimeout('viewTweet(0)', diff);

    // タイマーが作動する日時を格納
    setTimeNextDt(diff);
}

// ツイートを表示して次のタイマーをセット
function viewTweet(idx) {
    // IE で日時を使えるように UTC を加える
    tweetCreates[idx]['created_at'] = addUTC(tweetCreates[idx]['created_at']);

    // ツイート表示用データ作成
    var tdata = {};
    tdata['created_at'] = escapeHtml(convLStr(tweetCreates[idx]['created_at']));
    var dt = new Date(tweetCreates[idx]['created_at']);
    tdata['created_at_short'] = ('0' + dt.getHours()).slice(-2) + ':' +
        ('0' + dt.getMinutes()).slice(-2);
    tdata['id_str'] = escapeHtml(tweetCreates[idx]['id_str']);
    tdata['name'] = escapeHtml(tweetCreates[idx]['user']['name']);
    tdata['profile_image_url'] = escapeHtml(tweetCreates[idx]['user']['profile_image_url']);
    tdata['screen_name'] = escapeHtml(tweetCreates[idx]['user']['screen_name']);
    tdata['text'] = escapeHtml(tweetCreates[idx]['text']);
    tdata['tweet_url'] = 'https://twitter.com/' + tdata['screen_name'] +
        '/status/' + tdata['id_str']
    tdata['retweet_name'] = ''
    tdata['retweet_screen_name'] = ''

    // 公式リツイートデータの場合
    if (typeof tweetCreates[idx]['retweeted_status'] !== 'undefined') {
        tdata['retweet_name'] = tdata['name'];
        tdata['retweet_screen_name'] = tdata['screen_name'];

        var rstatus = tweetCreates[idx]['retweeted_status'];
        tdata['created_at'] = escapeHtml(convLStr(addUTC(rstatus['created_at'])));

        dt = new Date(addUTC(rstatus['created_at']));
        tdata['created_at_short'] = ('0' + dt.getHours()).slice(-2) + ':' +
            ('0' + dt.getMinutes()).slice(-2);

        tdata['name'] = escapeHtml(rstatus['user']['name']);
        tdata['profile_image_url'] = escapeHtml(rstatus['user']['profile_image_url']);
        tdata['screen_name'] = escapeHtml(rstatus['user']['screen_name']);
        tdata['text'] = escapeHtml(rstatus['text']);
    }

    // 本文内のURLにリンク設定
    // (entities に抜けがあるので暫定処理)
    var rexp = new RegExp('(https?:\/\/)([\x21-\x7e]+)', 'ig');
    var rurls = tdata['text'].match(rexp);
    var eurls = tweetCreates[idx]['entities']['urls'];
    if (rurls) {
        if (rurls.length > eurls.length) {  // URL の数を entities と比較する
            tdata['text'] = tdata['text'].replace(rexp,
                '<a href="$1$2" target="_blank" title="$1$2">$2</a>'
            );
        } else if (eurls.length > 0) {
            eurls = getUniqueUrls(eurls); // url の重複のない urls
            for (var i = 0; i < eurls.length; i++) {
                tdata['text'] = tdata['text'].replace(new RegExp(eurls[i]['url'], 'g'), // 重複がないので g
                    '<a href="' + eurls[i]['url'] + '" target="_blank" title="' +
                    eurls[i]['expanded_url'] + '">' + eurls[i]['display_url'] + '</a>'
                );
            }
        }
    }


    // 本文内のハッシュタグにリンク設定
    // (entities に抜けがあるので暫定処理)
    tdata['text'] = tdata['text'].replace(
        /[#＃][0-9A-Z_a-z０-９Ａ-Ｚａ-ｚ〃々〻ぁ-ヿ一-鿆]+/g, function() {
          return '<a href="https://twitter.com/search?q=' +
            encodeURIComponent(arguments[0]) + '&src=hash" target="_blank">' +
            arguments[0] + '</a>';
        }
    );

    // indices の値がばっちりになるまでお蔵入り
    // if (tweetCreates[idx]['entities']['hashtags'].length > 0) {
    //     var htags = tweetCreates[0]['entities']['hashtags'];
    //     var text1 = '';
    //     var text2 = '';
    //     for (var i = htags.length - 1; i >= 0; i--) {
    //         text1 = tdata['text'].substr(0, htags[i]['indices'][0]);
    //         text2 = tdata['text'].substr(htags[i]['indices'][1]);
    //         tdata['text'] = text1 + '<a href="https://twitter.com/search?q=' +
    //             '%23' + encodeURIComponent(htags[i]['text']) +
    //             '&src=hash" target="_blank">#' + htags[i]['text'] + '</a>' +
    //             text2;
    //     }
    // }

    // 本文内のユーザ名にリンク設定
    tdata['text'] = tdata['text'].replace(
        /(@)([0-9a-z_]+)/gi,
        '<a href="https://twitter.com/$2" target="_blank">$1$2</a>'
    );


    // 本文内の改行を br に
    tdata['text'] = tdata['text'].replace(/\n/g, '<br>');

    // テンプレート内にデータ設置
    $('#tweets').prepend(tmplTweet.render(tdata));

    // リツイート情報を隠す
    if (typeof tweetCreates[idx]['retweeted_status'] === 'undefined') {
        $('#' + tweetCreates[idx]['id_str'] + ' .retweet').hide();
    }

    // ツイート表示
    $('#' + tweetCreates[idx]['id_str']).show(100);

    // avatar hover で name を hover
    var tid = tweetCreates[idx]['id_str'];
    $('#' + tid + ' .avatar a').hover(
        function() {$('#' + tid + ' .user-name a').addClass('user-name-hover');},
        function() {$('#' + tid + ' .user-name a').removeClass('user-name-hover');}
    );

    // screen_name hover で name を hover
    var tid = tweetCreates[idx]['id_str'];
    $('#' + tid + ' .user-user a').hover(
        function() {$('#' + tid + ' .user-name a').addClass('user-name-hover');},
        function() {$('#' + tid + ' .user-name a').removeClass('user-name-hover');}
    );

    // 画面に表示する最大値を越えていたら一番古いツイートを消す
    if (idx >= MAX_TWEETS) $('.tweet:last').remove();

    var timeNow = new Date(tweetCreates[idx]['created_at']);
    // 次のツイートをセット
    if (idx < tweetCreates.length - 1) {
        idx++;
        var timeNext = new Date(addUTC(tweetCreates[idx]['created_at']));
        var diff = timeNext - timeNow;
        timerId = setTimeout('viewTweet(' + idx + ')', diff);

        // タイマーが作動する日時を格納
        setTimeNextDt(diff);
    } else {
        updateStatus('再生終了');
        $('#start_replay').prop('disabled', true);
    }
}

// リプレイ一時停止
function pauseReplay() {
    updateStatus('一時停止');
    clearTimeout(timerId);

    // 一時停止ボタンをスタートボタンに
    $('#start_replay').text('Play').unbind('click').bind('click', restartReplay);

    // 次のツイートまでの時刻を保存
    timeNextDiff = timeNextDt - new Date();
}

// リプレイ再開
function restartReplay() {
    updateStatus('再生再開');

    // スタートボタンを一時停止ボタンに
    $('#start_replay').text('Pause').unbind('click').bind('click', pauseReplay);

    // 次のツイートのタイマーをセット
    timerId = setTimeout('viewTweet()', timeNextDiff);
}

// File API (ダウンロード)が使えるかチェック メッセージが入ってない = 使用可能
function checkFileAPIDL() {
    var mes = '';

    if (!(window.File)) {
        mes = 'このブラウザは File API をサポートしていません。';
    } else if (!('Blob' in window)) {
        mes = 'このブラウザは Blob オブジェクトをサポートしていません。';
    } else if (!(window.URL)) {
        mes = 'このブラウザは window.URL をサポートしていません。';
    }

    return mes;
}

// File API (ファイルドロップ)が使えるかチェック メッセージが入ってない = 使用可能
function checkFileAPIFD() {
    var mes = '';

    if (!(window.File)) {
        mes = 'このブラウザは File API をサポートしていません。';
    }

    return mes;
}

// ツイートデータのダウンロード
function saveTweets() {
    // 検索・番組情報を追加
    var info = [{
        query: $('#query').val(),
        start_date: $('#start_date').val(),
        start_time: $('#start_time').val(),
        end_date: $('#end_date').val(),
        end_time: $('#end_time').val()
    }];

    // ツイートデータの1行目に情報を加える
    tweetCreates = info.concat(tweetCreates);

    var blob = {};
    if ('Blob' in window) {
        blob = new Blob([JSON.stringify(tweetCreates)], {type: 'application/octet-stream'});
    }

    // ツイートデータの1行目を削除
    tweetCreates.splice(0, 1);

    // ダウンロード
    // ie10
    if (window.navigator.msSaveBlob) {
        window.navigator.msSaveBlob(blob,'replaylivetweet_data.txt');
    } else {
    var objurl = {};
        if (window.URL) objurl = window.URL.createObjectURL;
        $('#downloadlink').attr('href', objurl(blob)).click();
    }
}

// ダウンロードリンクのクリックイベント
function startDownload() {
    window.location.href =  $('#downloadlink').attr('href');
}

// ファイルドロップイベント
function onDrop(event) {
    // ブラウザの通常動作を抑制
    event.preventDefault();

    var f = event.dataTransfer.files[0];

    if (f.type.indexOf('text/plain') < 0) {
        updateStatus('テキストファイルではありません。');
        return;
    }

    var fr = new FileReader();
    fr.onerror = function(evt) {
      updateStatus('ファイル読込時にエラーが発生しました。');
      return;
    }

    // 読込完了時に呼び出される
    fr.onload = function(evt) {
        tweetCreates = [];
        try {
            tweetCreates = JSON.parse(fr.result);
        } catch(e) {
            updateStatus('データ読込エラー: JSON 形式にパースできませんでした。');
        }

        if (typeof tweetCreates[0]['query'] === 'undefined') {
            updateStatus('データ読込エラー: 有効なツイートデータではありません。');
        } else { // 正常に読み込めた
            // 検索・番組情報表示
            $('#query').val(escapeHtml(tweetCreates[0]['query']));
            $('#start_date').val(escapeHtml(tweetCreates[0]['start_date']));
            $('#start_time').val(escapeHtml(tweetCreates[0]['start_time']));
            $('#end_date').val(escapeHtml(tweetCreates[0]['end_date']));
            $('#end_time').val(escapeHtml(tweetCreates[0]['end_time']));

            //  検索・番組情報を削除
            tweetCreates.splice(0, 1);

            init();

            updateStatus('ツイートデータファイル読込完了');
            checkInputs();
            $('#start_replay').prop('disabled', false);
        }
    }

    fr.readAsText(f, 'utf-8');
}

// ドラッグオーバーイベント
function onDragOver(event) {
    // ブラウザの通常動作を抑制
    event.preventDefault();
 }

// 入力値のチェックと search ボタンの有効/無効
function checkInputs(keyCode) {
    var status = ($('#query').val().length > 0) +
        $('#start_date').dateValidate({required:true}) +
        $('#start_time').timeValidate({required:true}) +
        $('#end_date').dateValidate({required:true}) +
        $('#end_time').timeValidate({required:true});
    if (status === 5) {
        var startDt = new Date($('#start_date').val().replace(/-/g, '/') + ' ' +
            $('#start_time').val());
        var endDt = new Date($('#end_date').val().replace(/-/g, '/') + ' ' +
            $('#end_time').val());
        //  番組が6時間以内ならOK
        if (endDt > startDt && endDt - startDt <= 6 * 60 * 60 * 1000) {
            $('#start_search').prop('disabled', false);
            if (keyCode === 13) startSearch();
            return;
        }
    }
    $('#start_search').prop('disabled', true);
}

// ステータス表示
function updateStatus(str) {
    $('#status').append('<p>' + str + '</p>').scrollTo('p:last', 'fast');
}

// タイマーが作動する日時を格納
function setTimeNextDt(diff) {
    timeNextDt = new Date();
    var dt = timeNextDt.getTime();
    timeNextDt.setTime(dt + diff);
}

// IE で日時文字列を Date へ変換できるように 'UTC' を加える
function addUTC(dtstr) {
    return dtstr.replace(' +', ' UTC+');
}

// ローカルに変換した時刻文字列を返す
function convLStr(dt) {
    var ldt = new Date(dt);
    return ldt.toLocaleString();
}

// entities.urls.url が重複しない配列を返す
function getUniqueUrls(array) {
    var checkDuplicate = function(array, obj) {
        for (var i = 0; i < array.length; i++) {
            if(obj.url === array[i].url) return true;
        }
        return false;
    };

    var uniqueArray = [];
    for (var i = 0; i < array.length; i++) {
        if (!checkDuplicate(uniqueArray, array[i])) {
            uniqueArray.push(array[i]);
        }
    }
    return uniqueArray;
}

// 文字列のエスケープ処理
function escapeHtml(str) {
    return $('<div>').text(str).html();
}

function test() {
    // id 指定で1ツイートを取得して JSON をステータスに表示
    $.get('/app/getstatus?id=ここにid&include_entities=1',
        function(data) {
            $('#status').empty();
            $('#status').append(JSON.stringify(data))
        }
    );
}