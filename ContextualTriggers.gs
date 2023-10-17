function showHomePage() {
  var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Hello World'))
      .build();
  return [card];
}

function showInitialCard() {
  // Create a card builder with an action button to show email labels
  var cardBuilder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Get Email Labeling')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png'))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextButton()
        .setText("推荐回复模版")
        .setOnClickAction(CardService.newAction()
          .setFunctionName("onGmailMessageOpen"))));

  return [cardBuilder.build()];
}

function onGmailMessageOpen(e) {
  console.log("Request start");

  var accessToken = e.messageMetadata.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  var messageId = e.messageMetadata.messageId;
  var message = GmailApp.getMessageById(messageId);
  var threadLabels = message.getThread().getLabels();
  var email = Session.getEffectiveUser().getEmail();
  console.log("email: " + email);

  var cardBuilder = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Get Email Labeling')
      .setImageUrl('https://www.gstatic.com/images/icons/material/system/1x/label_googblue_48dp.png'));

  var labelNames = threadLabels.map(function(label) {
    return label.getName();
  });

  console.log("labels: " + labelNames)

  var templatesGroupedByLabel = getTemplatesForLabels(email, labelNames); // Note the changed function name

  for (var label in templatesGroupedByLabel) {
    var templates = templatesGroupedByLabel[label];

    for (var j = 0; j < templates.length; j++) {
      var template = templates[j] || "";
      var composeAction = CardService.newAction()
        .setFunctionName('createReplyDraft')
        .setParameters({"template": template});

      var section = CardService.newCardSection()
        .setHeader(label)
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

function getTemplateForLabel(email, label) {
  var apiUrl = 'https://api.llmfeedback.com/api/v0/get-email-template';
  var payload = {
    "email": email,
    "labels": [label]
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
