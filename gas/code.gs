// =============================================
// 倫理法人会 LINE まとめアプリ - GASバックエンド
// =============================================

var SPREADSHEET_ID = '1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w';
var CLAUDE_API_KEY = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');

// 自動送信する会場リスト
var LINE_SEND_VENUES = ['佐世保'];

// =============================================
// メインエントリーポイント（統合版）
// =============================================

function doPost(e) {
  try {
    // LINEからのWebhookかどうか判定
    if (e.postData && e.postData.contents) {
      var rawBody = e.postData.contents;
      var parsed = JSON.parse(rawBody);

      // LINEのWebhookイベント（eventsキーがある）
      if (parsed.events !== undefined) {
        return handleLineWebhook(parsed);
      }

      // フロントエンドからのリクエスト（actionキーがある）
      if (parsed.action) {
        if (parsed.action === 'summarize') return respond(handleSummarize(parsed));
        if (parsed.action === 'save')      return respond(handleSave(parsed));
        if (parsed.action === 'score')     return respond(handleScore(parsed));
        return respond({ error: '不明なアクションです: ' + parsed.action });
      }
    }

    // e.parameterからのリクエスト
    if (e.parameter && e.parameter.data) {
      var data = JSON.parse(e.parameter.data);
      if (data.action === 'summarize') return respond(handleSummarize(data));
      if (data.action === 'save')      return respond(handleSave(data));
      if (data.action === 'score')     return respond(handleScore(data));
    }

    return respond({ error: 'データが受信できませんでした' });

  } catch (err) {
    return respond({ error: err.message });
  }
}

// =============================================
// LINEのWebhook処理（グループID記録）
// =============================================

function handleLineWebhook(body) {
  var events = body.events;
  if (events && events.length > 0) {
    var event = events[0];
    if (event.source && event.source.type === 'group') {
      var groupId = event.source.groupId;
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      var sheet = ss.getSheetByName('グループID記録');
      if (!sheet) sheet = ss.insertSheet('グループID記録');
      sheet.appendRow([new Date(), 'グループID', groupId]);
      Logger.log('グループID取得: ' + groupId);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
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
// 採点処理（Claude API呼び出し）
// =============================================

function handleScore(data) {
  var transcription = data.transcription;
  var speakerName   = data.speakerName || '講話者';

  var prompt =
    'あなたは倫理法人会モーニングセミナーの講話採点システムです。\n\n' +
    '講話者名: ' + speakerName + 'さん\n\n' +
    '【文字起こし】\n' + transcription + '\n\n' +
    '以下の7項目で採点してください：\n' +
    '1. 流暢さ（fluency）: 最大15点 - えー・その・あのなどのフィラーが少ない\n' +
    '2. 構成（structure）: 最大20点 - 起承転結・結論が明確\n' +
    '3. 具体性（specificity）: 最大15点 - 具体的なエピソード・数字がある\n' +
    '4. 言葉（wording）: 最大15点 - 聴きやすい言葉・表現\n' +
    '5. 働きかけ（engagement）: 最大15点 - 聴衆への問いかけ・共感\n' +
    '6. 倫理度（ethics）: 最大10点 - 倫理法人会の理念に沿っている\n' +
    '7. 熱量（passion）: 最大10点 - 情熱・エネルギーが伝わる\n\n' +
    'また、フィラー（えー・その・あの）の出現回数を数えてください。\n\n' +
    '以下のJSON形式のみで回答してください（説明文は不要）：\n' +
    '{"total":総合点,"scores":{"fluency":点数,"structure":点数,"specificity":点数,"wording":点数,"engagement":点数,"ethics":点数,"passion":点数},"filler_count":{"ee":えーの回数,"sono":そのの回数,"ano":あのの回数},"advice":"改善アドバイスを2〜3文で","good_point":"良かった点を2〜3文で","summary":"講話内容の要約を150文字程度で"}';

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    payload: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  var responseData = JSON.parse(response.getContentText());
  if (responseData.error) throw new Error('Claude APIエラー: ' + responseData.error.message);

  var text = responseData.content[0].text;
  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('採点の解析に失敗しました: ' + text.substring(0, 200));

  return JSON.parse(jsonMatch[0]);
}

// =============================================
// 保存処理（会場ごとにタブを分ける）
// =============================================

function handleSave(data) {
  var venue = data.venue || '佐世保';
  var sheet = getOrCreateSheetByVenue(venue);
  var now   = new Date();
  var sd    = data.scoreData || {};
  var sc    = sd.scores || {};

  sheet.appendRow([
    data.date,
    data.venue,
    data.attendees,
    data.speakers.join('、'),
    data.lineText,
    data.memo || '',
    false,
    now,
    data.speakerName || '',
    sd.total    != null ? sd.total    : '',
    sc.fluency  != null ? sc.fluency  : '',
    sc.structure != null ? sc.structure : '',
    sc.specificity != null ? sc.specificity : '',
    sc.wording  != null ? sc.wording  : '',
    sc.engagement != null ? sc.engagement : '',
    sc.ethics   != null ? sc.ethics   : '',
    sc.passion  != null ? sc.passion  : ''
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
    sheet.appendRow(['参加日', '会場', '参加者数', '講話者', 'LINEテキスト', 'メモ', '投稿済み', '記録日時', '採点者', '総合点', '流暢さ', '構成', '具体性', '言葉', '働きかけ', '倫理度', '熱量']);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2,  80);
    sheet.setColumnWidth(3,  80);
    sheet.setColumnWidth(4, 160);
    sheet.setColumnWidth(5, 420);
    sheet.setColumnWidth(6, 160);
    sheet.setColumnWidth(7,  80);
    sheet.setColumnWidth(8, 150);
    sheet.setColumnWidth(9, 100);
    sheet.setColumnWidth(10, 70);
    sheet.setColumnWidth(11, 70);
    sheet.setColumnWidth(12, 70);
    sheet.setColumnWidth(13, 70);
    sheet.setColumnWidth(14, 70);
    sheet.setColumnWidth(15, 80);
    sheet.setColumnWidth(16, 70);
    sheet.setColumnWidth(17, 70);
  }

  return sheet;
}

// =============================================
// LINE自動投稿（push送信・グループ指定）
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

  var tokenKey   = 'LINE_TOKEN_' + venue;
  var groupIdKey = 'LINE_GROUP_ID_' + venue;
  var token      = PropertiesService.getScriptProperties().getProperty(tokenKey);
  var groupId    = PropertiesService.getScriptProperties().getProperty(groupIdKey);

  if (!token) {
    Logger.log(venue + ': LINEトークン未設定（キー: ' + tokenKey + '）');
    return;
  }

  if (!groupId) {
    Logger.log(venue + ': グループID未設定（キー: ' + groupIdKey + '）');
    return;
  }

  var imageUrl = 'https://asahiya-ai.com/rinri-line/images/flyer.png';

  // push送信（グループ指定）
  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [
        { type: 'text', text: lineText },
        { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl }
      ]
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
  var venue      = 'テスト';
  var tokenKey   = 'LINE_TOKEN_佐世保';
  var groupIdKey = 'LINE_GROUP_ID_テスト';
  var token      = PropertiesService.getScriptProperties().getProperty(tokenKey);
  var groupId    = PropertiesService.getScriptProperties().getProperty(groupIdKey);

  if (!token)   { Logger.log('トークン未設定'); return; }
  if (!groupId) { Logger.log('グループID未設定'); return; }

  var testText = 'コケコッコーー！\nおはようございます♪🐔\n\nこれはテスト送信です。正常に届いていたら設定完了！';

  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      to: groupId,
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

  var token    = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN_佐世保');
  var groupId  = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID_テスト');
  var imageUrl = 'https://asahiya-ai.com/rinri-line/images/flyer.png';

  var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [
        { type: 'text', text: lineText },
        { type: 'image', originalContentUrl: imageUrl, previewImageUrl: imageUrl }
      ]
    }),
    muteHttpExceptions: true
  });

  Logger.log('テスト送信完了: ' + response.getResponseCode());
  Logger.log('投稿済みフラグは変更していません✅');
}