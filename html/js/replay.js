'use strict';

/** @const */ var MAX_TWEETS = 100;                               // 画面に表示する最大ツイート数
/** @const */ var TWEET_TEMPLATE = 'template/tweet.tmpl';         // ツイート部のテンプレートファイル
/** @const */ var URL_SEARCH = '/app/search';                     // Search APP URL
/** @const */ var URL_RATE_LIMIT_STATUS = '/app/ratelimitstatus'; // API 制限情報取得APP URL
/** @const */ var URL_OAUTH = '/app/oauth';                       // OAuth 認証APP URL
/** @const */ var URL_BLANK = 'blank.html';                       // OAuth をキャンセルした時のURL
/** @const */ var TIME_SEARCH_WAIT = 500;                         // Search API への連続リクエストの間隔(ms)

var tweetCreates = [];  // ツイート格納配列
var timeNextDt = {};    // タイマーが作動する日時
var timeNextDiff = 0;   // (一時停止時)タイマーが作動するまでの時間
var timeStart = {};     // 番組開始日時
var timeEnd = {};       // 番組終了日時
var timerId = 0;        // イベントタイマーID
var tmplTweet = {};     // ツイート部分のテンプレート
var debug = false;

// ページ読み込み後処理
$(function() {
    if (document.URL.indexOf('localhost') > 0) debug = true;

    if (debug) {
        document.config.query.value = '#nichiten';
        document.config.start_date.value = '2013/4/28';
        document.config.start_time.value = '10:00';
        document.config.end_date.value = '2013/4/28';
        document.config.end_time.value = '11:55';
        $('#testbutton').show();
    }

    // 認証されてない場合はダイアログ表示
    if (typeof $.cookie('access_token_key') === 'undefined' ||
        typeof $.cookie('access_token_secret') === 'undefined') {
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

    //カレンダー・時計設定
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
});


// Twitter API制限情報取得
function initSearch() {
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

// 検索開始
function startSearch() {
    $('#start_search').prop('disabled', true);

    // 初期化
    if (timerId) {
        clearTimeout(timerId);
        timerId = 0;
    }
    $('#start_replay').prop('disabled', true);
    $('#start_replay').text('Play').unbind('click').bind('click', startReplay);
    $('#twitterlogo').hide();
    $('#tweets').empty();
    tweetCreates = [];

    // 開始・終了日時をセット
    timeStart = new Date(document.config.start_date.value + ' ' +
        document.config.start_time.value);
    timeEnd = new Date(document.config.end_date.value + ' ' +
        document.config.end_time.value);

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

    var timeNext = new Date(addUTC(tweetCreates[0]['created_at']));

    // 次のツイートのタイマーをセット
    var diff = timeNext - timeStart;
    if (diff <= 0) diff = 1;
    timerId = setTimeout('viewTweet(0)', diff);

    // タイマーが作動する日時を格納
    setTimeNextDt(diff);
}

// ツイートを表示して次のタイマーをセット
function viewTweet(countTweets) {
    // IE で日時を使えるように UTC を加える
    tweetCreates[0]['created_at'] = addUTC(tweetCreates[0]['created_at']);

    // ツイート表示用データ作成
    var tdata = {};
    tdata['created_at'] = convLStr(tweetCreates[0]['created_at']);
    tdata['id_str'] = tweetCreates[0]['id_str'];
    tdata['name'] = tweetCreates[0]['user']['name'];
    tdata['profile_image_url'] = tweetCreates[0]['user']['profile_image_url'];
    tdata['screen_name'] = tweetCreates[0]['user']['screen_name'];
    tdata['text'] = tweetCreates[0]['text'];
    tdata['tweet_url'] = 'https://twitter.com/' + tdata['screen_name'] +
        '/status/' + tdata['id_str']
    tdata['retweet_name'] = ''
    tdata['retweet_screen_name'] = ''

    // 公式リツイートデータの場合
    if (typeof tweetCreates[0]['retweeted_status'] !== 'undefined') {
        tdata['retweet_name'] = tdata['name'];
        tdata['retweet_screen_name'] = tdata['screen_name'];

        var rstatus = tweetCreates[0]['retweeted_status'];
        tdata['created_at'] = convLStr(addUTC(rstatus['created_at']));
        tdata['name'] = rstatus['user']['name'];
        tdata['profile_image_url'] = rstatus['user']['profile_image_url'];
        tdata['screen_name'] = rstatus['user']['screen_name'];
        tdata['text'] = rstatus['text'];
    }

    // 本文内のURLにリンク設定
    // (entities に抜けがあるので暫定処理)
    var rexp = new RegExp('(https?:\/\/)([\x21-\x7e]+)', 'ig');
    var rurls = tdata['text'].match(rexp);
    var eurls = tweetCreates[0]['entities']['urls'];
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
        /[#＃][0-9a-zA-Z０-９ａ-ｚＡ-Ｚ〃々〻ぁ-ヿ一-鿆]+/g, function() {
          return '<a href="https://twitter.com/search?q=' +
            encodeURIComponent(arguments[0]) + '&src=hash" target="_blank">' +
            arguments[0] + '</a>';
        }
    );

    // indices の値がばっちりになるまでお蔵入り
    // if (tweetCreates[0]['entities']['hashtags'].length > 0) {
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
    if (typeof tweetCreates[0]['retweeted_status'] === 'undefined') {
        $('#' + tweetCreates[0]['id_str'] + ' .retweet').hide();
    }

    // ツイート表示
    $('#' + tweetCreates[0]['id_str']).show(100);
    countTweets++;

    // avatar hover で name を hover
    var tid = tweetCreates[0]['id_str'];
    $('#' + tid + ' .avatar a').hover(
        function() {$('#' + tid + ' .user-name a').addClass('user-name-hover');},
        function() {$('#' + tid + ' .user-name a').removeClass('user-name-hover');}
    );

    // screen_name hover で name を hover
    var tid = tweetCreates[0]['id_str'];
    $('#' + tid + ' .user-user a').hover(
        function() {$('#' + tid + ' .user-name a').addClass('user-name-hover');},
        function() {$('#' + tid + ' .user-name a').removeClass('user-name-hover');}
    );

    // 画面に表示する最大値を越えていたら一番古いツイートを消す
    if (countTweets > MAX_TWEETS) {
        $('.tweet:last').remove();
        countTweets--;
    }

    var timeNow = new Date(tweetCreates[0]['created_at']);
    // 次のツイートをセット
    if (tweetCreates.length >= 2) {
        tweetCreates.splice(0, 1);

        var timeNext = new Date(addUTC(tweetCreates[0]['created_at']));

        // 次のツイートが終了日時より前ならイベントをセット
        var diff = timeNext - timeNow;
        timerId = setTimeout('viewTweet(' + countTweets + ')', diff);

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

// 入力値のチェックと search ボタンの有効/無効
function checkInputs(keyCode) {
    var status = ($('#query').val().length > 0) +
        $('#start_date').dateValidate({required:true}) +
        $('#start_time').timeValidate({required:true}) +
        $('#end_date').dateValidate({required:true}) +
        $('#end_time').timeValidate({required:true});
    if (status === 5) {
        var startDt = new Date($('#start_date').val() + ' ' + $('#start_time').val());
        var endDt = new Date($('#end_date').val() + ' ' + $('#end_time').val());
        // 番組が6時間以内ならOK
        if (endDt > startDt && endDt - startDt <= 6 * 60 * 60 * 1000) {
            $('#start_search').prop('disabled', false);
            if (keyCode === 13) startSearch();
            return;
        }
    }
    $('#start_search').prop('disabled', true);
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

function test() {
    // id 指定で1ツイートを取得して JSON をステータスに表示
    $.get('/app/getstatus?id=ここにid&include_entities=1',
        function(data) {
            $('#status').empty();
            $('#status').append(JSON.stringify(data))
        }
    );
}