function fetchGmailLabelIds(onlyNonSystem) {
  onlyNonSystem = onlyNonSystem || false;  // Default to false if not provided
  
  var response = UrlFetchApp.fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    }
  });
  
  var allLabels = JSON.parse(response.getContentText()).labels;

  // If onlyNonSystem is true, filter out system labels
  if (onlyNonSystem) {
    return allLabels.filter(function(label) {
      return label.type === 'user';
    });
  } else {
    return allLabels;  
  }
}

function showHomePage() {
  var labelObjects = fetchGmailLabelIds(true);
  var cardSection = CardService.newCardSection();
  
  // Check if there are any labels to display
  if (!labelObjects || labelObjects.length == 0) {
    var noLabelWidget = CardService.newTextParagraph().setText("No labels found in your Gmail account.");
    cardSection.addWidget(noLabelWidget);
  } else {
    // Loop through each label and add it to the card's widgets
    for (var i = 0; i < labelObjects.length; i++) {
      var labelName = labelObjects[i].name;
      var labelId = labelObjects[i].id;
      
      // Create the button that will trigger the label details view
      var detailsButton = CardService.newTextButton()
          .setText(labelName)
          .setOnClickAction(CardService.newAction().setFunctionName("showLabelDetails").setParameters({"labelName": labelName, "labelId": labelId}));

      // You can use setButton or setEndIcon or other methods here if needed
      
      // Add the widget to the card section
      cardSection.addWidget(detailsButton);
    }
  }
  
  var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('List of All User Labels'))
      .addSection(cardSection)
      .build();

  return [card];
}

function showLabelDetails(e) {
  var labelName = e.parameters.labelName;
  var labelId = e.parameters.labelId;

  var email = Session.getEffectiveUser().getEmail(); // Get the active user's email
  var templatesGroupedByLabel = getTemplatesForLabels2(email, [labelId]); // Fetch templates for the selected label
  console.log(templatesGroupedByLabel)
  
  var cardSection = CardService.newCardSection();
  
  var nameWidget = CardService.newDecoratedText()
      .setText(labelName)
      .setTopLabel("Label Name")
      .setWrapText(true);
  
  var idWidget = CardService.newDecoratedText()
      .setText(labelId)
      .setTopLabel("Label ID")
      .setWrapText(true);

  var insertButton = CardService.newTextButton()
        .setText("Insert New Template")
        .setOnClickAction(CardService.newAction()
            .setFunctionName("showInsertTemplateCard")
            .setParameters({
                'labelName': labelName,
                'labelId': labelId
            })
        );

  var buttonSet = CardService.newButtonSet()
        .addButton(insertButton);
  
  cardSection.addWidget(nameWidget).addWidget(idWidget).addWidget(buttonSet);

  // Check if there are any templates for this label
  var templatesForLabel = templatesGroupedByLabel[labelId];
  if (templatesForLabel && templatesForLabel.length > 0) {
    for (var i = 0; i < templatesForLabel.length; i++) {
      var templateWidget = CardService.newTextInput()
          .setTitle(templatesForLabel[i].id)
          .setFieldName(templatesForLabel[i].id)  // A unique field name for each template
          .setValue(templatesForLabel[i].template) // Set the initial value from the template
          .setMultiline(true);
      
      var updateButton = CardService.newTextButton()
          .setText("Update Template")
          .setOnClickAction(CardService.newAction()
              .setFunctionName("handleUpdateTemplate")
              .setParameters({
                  'labelName': labelName,
                  'labelId': labelId
              })
          );

      var deleteButton = CardService.newTextButton()
        .setText("Delete Template")
        .setOnClickAction(CardService.newAction()
            .setFunctionName("handleDeleteTemplate")
            .setParameters({
                'templateId': templatesForLabel[i].id,
                'labelName': labelName,
                'labelId': labelId
            })
        );

      var buttonSet = CardService.newButtonSet().addButton(updateButton).addButton(deleteButton);
          
      cardSection.addWidget(templateWidget);
      cardSection.addWidget(buttonSet);
    }
  } else {
    var noTemplateWidget = CardService.newTextParagraph().setText("No templates found for this label.");
    cardSection.addWidget(noTemplateWidget);
  }
  
  var card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Label Details'))
      .addSection(cardSection)
      .build();

  return card;
}

function showInsertTemplateCard(e) {
    var labelName = e.parameters.labelName;
    var labelId = e.parameters.labelId;

    // Display Label Name
    var nameWidget = CardService.newDecoratedText()
        .setText(labelName)
        .setTopLabel("Label Name")
        .setWrapText(true);

    // Display Label ID
    var idWidget = CardService.newDecoratedText()
        .setText(labelId)
        .setTopLabel("Label ID")
        .setWrapText(true);

    // Input box for the new template
    var templateInput = CardService.newTextInput()
        .setTitle("Template Content")
        .setFieldName("newTemplateContent")
        .setMultiline(true);

    // Insert button
    var insertTemplateButton = CardService.newTextButton()
        .setText("Insert")
        .setOnClickAction(CardService.newAction()
            .setFunctionName("handleInsertNewTemplate")
            .setParameters({
                'labelName': labelName,
                'labelId': labelId
            })
        );

    var buttonSet = CardService.newButtonSet()
        .addButton(insertTemplateButton);

    var cardSection = CardService.newCardSection()
        .addWidget(nameWidget)  // Adding label name widget
        .addWidget(idWidget)    // Adding label ID widget
        .addWidget(templateInput)
        .addWidget(buttonSet);

    var card = CardService.newCardBuilder()
        .setHeader(CardService.newCardHeader().setTitle('Insert New Template'))
        .addSection(cardSection)
        .build();

    return card;
}

function handleInsertNewTemplate(e) {
    var templateContent = e.formInputs.newTemplateContent[0];
    var labelId = e.parameters.labelId;
    var email = Session.getEffectiveUser().getEmail();

    var apiUrl = 'https://api.llmfeedback.com/api/v0/upsert-template';
    var payload = {
        email: email,
        template: templateContent,
        label_id: labelId
    };

    var options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        var response = UrlFetchApp.fetch(apiUrl, options);
        console.log("Insert response: ", response.getContentText());
    } catch (error) {
        console.error("Error inserting new template: ", error);
    }

    // Redirect back to the label details card after insertion
    return showLabelDetails({
        parameters: {
            labelName: e.parameters.labelName,
            labelId: labelId
        }
    });
}

function handleUpdateTemplate(e) {
    var inputs = e.formInputs;
    var labelName = e.parameters.labelName;
    var labelId = e.parameters.labelId;
    var email = Session.getEffectiveUser().getEmail();  // Get the current user's email

    // Handle the form inputs...
    for (var templateId in inputs) {
        var updatedTemplateValue = inputs[templateId][0];
        console.log("Template ID: ", templateId);
        console.log("Updated Template Value: ", updatedTemplateValue);

        // Make the upsert API call
        var apiUrl = 'https://api.llmfeedback.com/api/v0/upsert-template';
        var payload = {
            id: templateId,   // this will trigger an update if the id exists, otherwise an insert
            email: email,
            template: updatedTemplateValue,
            label_id: labelId
        };

        var options = {
            method: "post",
            contentType: "application/json",
            payload: JSON.stringify(payload),
            muteHttpExceptions: true  // Optionally prevent exceptions from being thrown for HTTP errors
        };

        try {
            var response = UrlFetchApp.fetch(apiUrl, options);
            console.log("Upsert response for template " + templateId + ": ", response.getContentText());
        } catch (error) {
            console.error("Error upserting template " + templateId + ": ", error);
        }
    }

    // Use the retrieved label name, ID, and email to call showLabelDetails again:
    return showLabelDetails({
        parameters: {
            labelName: labelName,
            labelId: labelId
        }
    });
}

function handleDeleteTemplate(e) {
  var templateId = e.parameters.templateId;
  var labelName = e.parameters.labelName;
  var labelId = e.parameters.labelId;

  var apiUrl = 'https://api.llmfeedback.com/api/v0/delete-template';
  var payload = {
    "id": templateId
  };

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    // Log the response for debugging purposes
    Logger.log(response.getContentText());
  } catch (error) {
    Logger.log("Error deleting template: " + error.toString());
  }
  return showLabelDetails({
        parameters: {
            labelName: labelName,
            labelId: labelId
        }
    });
}
