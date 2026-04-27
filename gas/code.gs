// =============================================
// 倫理法人会 LINE まとめアプリ - GASバックエンド
// =============================================

var SPREADSHEET_ID = '1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w';
var CLAUDE_API_KEY = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');

// 自動送信する会場リスト（LINEトークンが設定されている会場のみ）
var LINE_SEND_VENUES = ['佐世保'];

// =============================================
// メインエントリーポイント
// =============================================

function doPost(e) {
  try {
    var data;
    if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return respond({ error: 'データが受信できませんでした' });
    }

    if (data.action === 'summarize') {
      return respond(handleSummarize(data));
    } else if (data.action === 'save') {
      return respond(handleSave(data));
    } else {
      return respond({ error: '不明なアクションです: ' + data.action });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doGet(e) {
  return respond({ status: 'OK', message: 'コケコッコー！GASは正常に動いてるよ🐔' });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================
// 要約処理（Claude API呼び出し）
// =============================================

function handleSummarize(data) {
  var speakers      = data.speakers;
  var transcription = data.transcription;
  var charLimit     = data.charLimit || 150;
  var speakerCount  = speakers.length;
  var speakerList   = speakers.map(function(s) { return '・' + s + 'さん'; }).join('\n');

  var prompt =
    'あなたは倫理法人会モーニングセミナーのLINE投稿文を書くプロのコピーライターです。\n\n' +
    'このセミナーには' + speakerCount + '名の講話者が登壇しました：\n' + speakerList + '\n\n' +
    '【文字起こし】\n' + transcription + '\n\n' +
    '【目的】\n翌日のモーニングセミナーに「なんか気になる」「ちょっと行ってみようかな」と思わせること。\n学びを説明しすぎず、"気になって動きたくなる状態"をつくる。\n\n' +
    '【書き方のルール】\n' +
    '- 話し言葉で書く（語りかける口語調）\n' +
    '- 冒頭に【○○さん】と講話者名を入れる\n' +
    '- 内容は「7割ぼかす・3割見せる」（説明しすぎない）\n' +
    '- 読み手が「自分ごと化」できる問いや違和感を入れる\n' +
    '- 感情が動く具体的な一言・エピソードを1つだけ使う\n' +
    '- 「気づきの途中」で止める（結論を書かない）\n' +
    '- 最後は余韻を残す（言い切らない）\n\n' +
    '【LINEとしての最適化】\n' +
    '- 改行は2〜3文ごとに1回だけ入れる（1文ごとに改行しない）\n' +
    '- スマホでサッと読めるテンポ\n' +
    '- 各講話者ごとに120〜160文字程度（最大180文字）\n\n' +
    '【やってはいけないこと】\n' +
    '- 「ぜひ来てください」などの直接的な誘導\n' +
    '- 「〇〇が大切です」などの結論・まとめ\n' +
    '- すべて説明してしまうこと\n' +
    '- 固い文章・論文調\n' +
    '- 情報を詰め込みすぎる\n\n' +
    '【重要な考え方】\n' +
    '良い文章ではなく、「続きが気になる文章」を書く。\n' +
    '読者の頭の中に「？」が残る状態が正解。\n\n' +
    '講話者が複数の場合は内容を均等に分けてください。\n\n' +
    '以下のJSON形式のみで回答してください：\n' +
    '{"summaries": ["1人目のテキスト", "2人目のテキスト"]}';

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  var responseData = JSON.parse(response.getContentText());
  if (responseData.error) throw new Error('Claude APIエラー: ' + responseData.error.message);

  var text = responseData.content[0].text;
  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('要約の解析に失敗しました: ' + text.substring(0, 200));

  var parsed = JSON.parse(jsonMatch[0]);
  return { summaries: parsed.summaries };
}

// =============================================
// 保存処理（会場ごとにタブを分ける）
// =============================================

function handleSave(data) {
  var venue = data.venue || '佐世保';
  var sheet = getOrCreateSheetByVenue(venue);
  var now   = new Date();

  sheet.appendRow([
    data.date,
    data.venue,
    data.attendees,
    data.speakers.join('、'),
    data.lineText,
    data.memo || '',
    false,
    now
  ]);

  return { success: true };
}

// =============================================
// シート取得・作成（会場名 = タブ名）
// =============================================

function getOrCreateSheetByVenue(venue) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(venue);

  if (!sheet) {
    sheet = ss.insertSheet(venue);
    sheet.appendRow(['参加日', '会場', '参加者数', '講話者', 'LINEテキスト', 'メモ', '投稿済み', '記録日時']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2,  80);
    sheet.setColumnWidth(3,  80);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 420);
    sheet.setColumnWidth(6, 160);
    sheet.setColumnWidth(7,  80);
    sheet.setColumnWidth(8, 150);
  }

  return sheet;
}

// =============================================
// LINE自動投稿（佐世保タブのみ・毎週木曜9時）
// =============================================

function sendWeeklyLine() {
  LINE_SEND_VENUES.forEach(function(venue) {
    sendLineForVenue(venue);
  });
}

function sendLineForVenue(venue) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(venue);

  if (!sheet) {
    Logger.log(venue + 'のシートが存在しません');
    return;
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log(venue + ': 投稿するデータがありません');
    return;
  }

  var targetRow = -1;
  var lineText  = '';

  for (var i = data.length - 1; i >= 1; i--) {
    if (!data[i][6]) {
      targetRow = i + 1;
      lineText  = data[i][4];
      break;
    }
  }

  if (targetRow === -1 || !lineText) {
    Logger.log(venue + ': 未投稿のデータがありません');
    return;
  }

  var tokenKey = 'LINE_TOKEN_' + venue;
  var token    = PropertiesService.getScriptProperties().getProperty(tokenKey);

  if (!token) {
    Logger.log(venue + ': LINEトークン未設定（キー: ' + tokenKey + '）');
    return;
  }

  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      messages: [{ type: 'text', text: lineText }]
    }),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  Logger.log(venue + ' LINE送信: ' + status);

  if (status === 200) {
    sheet.getRange(targetRow, 7).setValue(true);
    Logger.log(venue + ': 送信成功！行 ' + targetRow);
  }
}

// =============================================
// タイマー設定（一度だけ実行）
// =============================================

function setWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendWeeklyLine') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('sendWeeklyLine')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.THURSDAY)
    .atHour(9)
    .create();

  Logger.log('✅ 毎週木曜9時のタイマーを設定しました');
}

// =============================================
// テスト用（GASエディタから手動実行）
// =============================================

function testLineSend() {
  var venue    = '佐世保';
  var tokenKey = 'LINE_TOKEN_' + venue;
  var token    = PropertiesService.getScriptProperties().getProperty(tokenKey);

  if (!token) {
    Logger.log('トークン未設定: ' + tokenKey);
    return;
  }

  var testText = 'コケコッコーー！\nおはようございます♪🐔\n\nこれはテスト送信です。正常に届いていたら設定完了！';

  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      messages: [{ type: 'text', text: testText }]
    }),
    muteHttpExceptions: true
  });

  Logger.log('テスト結果: ' + response.getResponseCode() + ' ' + response.getContentText());
}

function testSendLatest() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('佐世保');
  var data  = sheet.getDataRange().getValues();

  var lineText = '';
  for (var i = data.length - 1; i >= 1; i--) {
    if (!data[i][6]) {
      lineText = data[i][4];
      break;
    }
  }

  if (!lineText) {
    Logger.log('未投稿のデータがありません');
    return;
  }

  var tokenKey = 'LINE_TOKEN_佐世保';
  var token    = PropertiesService.getScriptProperties().getProperty(tokenKey);
  var imageUrl = 'https://asahiya-ai.github.io/rinri-line/images/flyer.png';

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      messages: [
        {
          type: 'image',
          originalContentUrl: imageUrl,
          previewImageUrl:    imageUrl
        },
        {
          type: 'text',
          text: lineText
        }
      ]
    }),
    muteHttpExceptions: true
  });

  Logger.log('テスト送信完了！投稿済みフラグは変更していません✅');
}
