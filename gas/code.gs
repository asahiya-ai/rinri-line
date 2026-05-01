// =============================================
// 倫理法人会 LINE まとめアプリ - GASバックエンド
// =============================================

var SPREADSHEET_ID = '1Pxf4ueI_hRncMWV-mcZJd9R6uj_e_rTQJ9zmCHIaw5w';
var CLAUDE_API_KEY = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');

// 自動送信する会場リスト
var LINE_SEND_VENUES = ['佐世保', '佐世保広報'];

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

function callClaude(systemPrompt, userMessage) {
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    }),
    muteHttpExceptions: true
  });
  var responseData = JSON.parse(response.getContentText());
  if (responseData.error) throw new Error('Claude APIエラー: ' + responseData.error.message);
  return responseData.content[0].text;
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

  // Teamsの文字起こしから三宅耕平の発言・ヘッダーを除外する前処理
  var lines = transcription.split('\n');
  var filtered = [];
  var skipNext = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // ヘッダー3行を除外（ファイル名・日付・長さ）
    if (line.match(/^倫理.*会議-\d{8}/) ||
        line.match(/^\d{4}年\d{1,2}月\d{1,2}日/) ||
        line.match(/^\d+\s*分\s*\d+\s*秒/)) {
      continue;
    }

    // 三宅耕平の名前行 → 次の発言行ごとスキップ
    if (line.match(/^三宅\s*耕平/)) {
      skipNext = true;
      continue;
    }

    // 三宅耕平の発言行をスキップ
    if (skipNext) {
      skipNext = false;
      continue;
    }

    filtered.push(line);
  }

  transcription = filtered.join('\n').trim();

  var systemPrompt = '倫理法人会のモーニングセミナーの講話を要約するアシスタントです。'
    + '必ず指定された講話者名を使って【○○さん】形式でヘッダーをつけてください。'
    + '文字起こし内に別の人名が出てきても、指定された名前を優先してください。';

  var userMessage = '以下の文字起こしを講話者ごとに' + charLimit + '文字程度で要約してください。\n'
    + '講話者名は必ず以下を使ってください: ' + speakers.join('、') + '\n'
    + 'ヘッダーは【田中さん】のように必ず入力した名前をそのまま使ってください。\n\n'
    + '参加者数は記載しないでください。\n'
    + '「先週の参加者はX名！」のような文は含めないでください。\n\n'
    + '文字起こし:\n' + transcription + '\n\n'
    + '以下のJSON形式のみで回答してください：\n'
    + '{"summaries": ["1人目のテキスト", "2人目のテキスト"]}';

  var text = callClaude(systemPrompt, userMessage);
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
  var speakerName = data.speakerName || '講話者';

  var fillerCount = {
    ee:   (transcription.match(/えー|ええ|えーと/g) || []).length,
    sono: (transcription.match(/その|そのー/g) || []).length,
    ano:  (transcription.match(/あのー|あの、|あのう/g) || []).length
  };

  var systemPrompt = '倫理法人会のモーニングセミナー講話を採点するプロのスピーチコーチです。'
    + '採点結果は必ずJSON形式のみで返してください。余分なテキストは不要です。'
    + 'アドバイスは必ず「〇〇した方が聞きやすくなるかもしれませんね。」のような優しく前向きな表現で書いてください。';

  var isInappropriate = /エロ|セクハラ|下ネタ|ちんこ|まんこ|おっぱい|性器|わいせつ|卑猥|エッチ|スケベ|ムラムラ|風俗|AV|ポルノ|ファック|くそ|うんこ|死ね|殺す|バカ|アホ|クズ/i.test(transcription);

  var wordingInstruction = isInappropriate
    ? '※この講話には品位を損なう表現が含まれています。adviceに必ず「倫理法人会の場では、品のある言葉遣いを心がけると、さらに信頼感が高まりますよ😊」という趣旨の一文を加えてください。'
    : '';

  var userMessage = '以下の講話テキストを7項目で採点し、JSONで返してください。\n\n'
    + '採点者: ' + speakerName + 'さん\n\n'
    + '【重要な採点ルール】\n'
    + '・7項目の合計点が必ず60〜100点の範囲に収まるように採点してください\n'
    + '・温かく前向きな採点をしてください。厳しすぎず、講話者のがんばりを認める採点を心がけてください\n'
    + '・最低点は60点以上になるよう、各項目に最低限の点数を確保してください\n\n'
    + wordingInstruction + '\n\n'
    + '【講話テキスト】\n' + transcription + '\n\n'
    + '【採点基準】\n'
    + '- fluency（流暢さ・フィラー語の少なさ）: 0〜20点\n'
    + '- structure（構成の明確さ）: 0〜20点\n'
    + '- specificity（内容の具体性）: 0〜15点\n'
    + '- wording（言葉の選び方）: 0〜15点\n'
    + '- engagement（聴衆への働きかけ）: 0〜15点\n'
    + '- ethics（倫理度）: 0〜10点\n'
    + '- passion（熱量・誠実さ）: 0〜10点\n\n'
    + '【アドバイスの書き方】\n'
    + '必ず「〇〇した方が聞きやすくなるかもしれませんね」「〇〇を意識してみると、さらに伝わりやすくなるかもしれません」のような優しく前向きな表現を使ってください。\n\n'
    + '返す形式（JSONのみ、マークダウン不要）:\n'
    + '{\n'
    + '  "total": 合計点,\n'
    + '  "scores": {\n'
    + '    "fluency": 点数,\n'
    + '    "structure": 点数,\n'
    + '    "specificity": 点数,\n'
    + '    "wording": 点数,\n'
    + '    "engagement": 点数,\n'
    + '    "ethics": 点数,\n'
    + '    "passion": 点数\n'
    + '  },\n'
    + '  "advice": "優しいアドバイス（200文字以内）",\n'
    + '  "good_point": "良かった点（200文字以内）",\n'
    + '  "summary": "講話の要約（300文字以内）"\n'
    + '}';

  var resultText = callClaude(systemPrompt, userMessage);
  var cleaned = resultText.replace(/```json|```/g, '').trim();
  var result = JSON.parse(cleaned);

  if (!result.total && result.scores) {
    var total = 0;
    Object.values(result.scores).forEach(function(v) { total += v; });
    result.total = total;
  }

  result.filler_count = fillerCount;
  return result;
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
  // 佐世保広報は佐世保シートのデータを使う
  var sheetVenue = venue === '佐世保広報' ? '佐世保' : venue;
  var sheet = ss.getSheetByName(sheetVenue);

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

  var tokenKey   = 'LINE_TOKEN_佐世保';
  var groupIdKey = 'LINE_GROUP_ID_佐世保広報';
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

function testSendKohoGroup() {
  var token   = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN_佐世保');
  var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID_佐世保広報');

  if (!token)   { Logger.log('トークン未設定'); return; }
  if (!groupId) { Logger.log('グループID未設定'); return; }

  var testText = 'コケコッコーー！\nこれはテスト送信です🐔\n正常に届いていたら設定完了！';

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

  Logger.log('佐世保広報テスト結果: ' + response.getResponseCode() + ' ' + response.getContentText());
}