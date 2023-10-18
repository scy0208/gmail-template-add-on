function showInitialCard() {
  // Create a card builder with an action button to show email labels
  var cardBuilder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('WiseMail Email Helper')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextButton()
        .setText("Response Template Suggestion")
        .setOnClickAction(CardService.newAction()
          .setFunctionName("onGmailMessageOpen"))));

  return [cardBuilder.build()];
}

function getAllLabelsMap() {
  var url = "https://www.googleapis.com/gmail/v1/users/me/labels";
  var headers = {
    "Authorization": "Bearer " + ScriptApp.getOAuthToken()
  };

  var options = {
    "method": "get",
    "headers": headers,
    "muteHttpExceptions": true
  };

  var response = UrlFetchApp.fetch(url, options);
  var labelList = JSON.parse(response.getContentText()).labels;

  var labelMap = {}; // To hold the map of label_id: label_name
  for (var i = 0; i < labelList.length; i++) {
    labelMap[labelList[i].id] = labelList[i].name;
  }

  return labelMap;
}

function getLabelIdsByNames(labelMap, labelNames) {
  var labelIds = [];

  for (var id in labelMap) {
    if (labelNames.indexOf(labelMap[id]) !== -1) {
      labelIds.push(id);
    }
  }

  return labelIds;
}

function onGmailMessageOpen(e) {
  var accessToken = e.messageMetadata.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  var messageId = e.messageMetadata.messageId;
  var message = GmailApp.getMessageById(messageId);
  var threadLabels = message.getThread().getLabels();
  var email = Session.getEffectiveUser().getEmail();
  console.log("email: " + email);

  var cardBuilder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Template Suggestion')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png'));

  var labelNames = threadLabels.map(function(label) {
    return label.getName();
  });
  console.log("labels: " + labelNames)

  var labelMap = getAllLabelsMap()
  var labelIds = getLabelIdsByNames(labelMap, labelNames);
  console.log("labelIds: " + labelIds)

  var templatesGroupedByLabel = getTemplatesForLabels2(email, labelIds); // Note the changed function name

  for (var labelId in templatesGroupedByLabel) {
    var templates = templatesGroupedByLabel[labelId];

    for (var j = 0; j < templates.length; j++) {
      var template = templates[j].template || "";
      var composeAction = CardService.newAction()
        .setFunctionName('createReplyDraft')
        .setParameters({"template": template});

      var section = CardService.newCardSection()
        .setHeader(labelMap[labelId])
        .addWidget(CardService.newTextParagraph().setText(template))
        .addWidget(
          CardService.newTextButton()
            .setText("Create Response")
            .setComposeAction(
              composeAction,
              CardService.ComposedEmailType.REPLY_AS_DRAFT)
        );

      cardBuilder.addSection(section);
    }
  }

  return [cardBuilder.build()];
}

function getTemplatesForLabels(email, labels) {
  var apiUrl = 'https://api.llmfeedback.com/api/v0/get-email-templates';
  var payload = {
    "email": email,
    "labels": labels // Now passing the entire array of labels
  }
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  var response = UrlFetchApp.fetch(apiUrl, options);
  var responseBody = response.getContentText();
  console.log("template response")
  console.log(responseBody)
  
  // Parse the JSON response to a JavaScript object
  var templatesGroupedByLabel = JSON.parse(responseBody);
  return templatesGroupedByLabel;
}

function getTemplatesForLabels2(email, labelIds) {
  var apiUrl = 'https://api.llmfeedback.com/api/v0/get-templates-by-labels';
  var payload = {
    "email": email,
    "labels": labelIds
  }
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  var response = UrlFetchApp.fetch(apiUrl, options);
  var responseBody = response.getContentText();
  console.log("template response")
  console.log(responseBody)
  
  // Parse the JSON response to a JavaScript object (array in this case)
  var templates = JSON.parse(responseBody);
  return templates;
}

function createReplyDraft(e) {
    var template = e.parameters.template;
    // Activate temporary Gmail scopes, in this case to allow
    // a reply to be drafted.
    var accessToken = e.gmail.accessToken;
    GmailApp.setCurrentMessageAccessToken(accessToken);

    // Creates a draft reply.
    var messageId = e.gmail.messageId;
    var message = GmailApp.getMessageById(messageId);
    var htmlTemplate = "<p>" + template.replace(/\n/g, "</p><p>") + "</p>";
    var draft = message.createDraftReply(htmlTemplate, {htmlBody: htmlTemplate});

    // Return a built draft response. This causes Gmail to present a
    // compose window to the user, pre-filled with the content specified
    // above.
    return CardService.newComposeActionResponseBuilder()
        .setGmailDraft(draft).build();
}

function createGmailDraft(e) {
  var template = e.parameters.template;
  var accessToken = e.messageMetadata.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  var messageId = e.messageMetadata.messageId;
  var message = GmailApp.getMessageById(messageId);

  // Retrieve the sender's Gmail signature
  var sendAs = Gmail.Users.Settings.SendAs.list('me');
  var signature = '';
  for (var i = 0; i < sendAs.sendAs.length; i++) {
    if (sendAs.sendAs[i].isDefault) {
      signature = sendAs.sendAs[i].signature;
      break;
    }
  }

  // Convert the plain text template to HTML
  var htmlTemplate = "<p>" + template.replace(/\n/g, "</p><p>") + "</p>";

  // Combine the HTML template and the signature
  var fullTemplate = htmlTemplate + "<br/><br/>" + signature;

  // Create a draft reply to the message with the template content
  message.createDraftReply(fullTemplate, {htmlBody: fullTemplate});

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification()
      .setText("Draft reply created successfully!"))
    .build();
}
