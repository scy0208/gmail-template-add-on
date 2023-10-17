function onComposeTrigger(e) {
  var draft = GmailApp.getDrafts()[0]; // The first draft message in the drafts folder
  var message = draft.getMessage().getBody();
  console.log(message);
    // If you want to show a message to the user:
  var cardBuilder = CardService.newCardBuilder();
  var draftSection = CardService.newCardSection()
        .setHeader('Draft content')
        .addWidget(CardService.newTextParagraph().setText(message));
  cardBuilder.addSection(draftSection)

  var bodyUpdateSection = CardService.newCardSection()
          .setHeader('Update email')  
          .addWidget(
            CardService.newTextButton()
              .setText('Update Body')
              .setOnClickAction(CardService.newAction()
                  .setFunctionName('applyUpdateBodyAction')));
   cardBuilder.addSection(bodyUpdateSection);
          
    return [cardBuilder.build()]
}


function applyUpdateBodyAction() {
    // Get the new subject field of the email.
    // This function is not shown in this example.
    var body = '<div dir="ltr"><div dir="ltr">test<br><img data-surl="cid:ii_lnglx4940" src="cid:ii_lnglx4940" alt="image.png" width="354" height="126"><br></div><br></div>'

    var updateDraftActionResponse = CardService.newUpdateDraftActionResponseBuilder()
        .setUpdateDraftBodyAction(CardService.newUpdateDraftBodyAction()
            .addUpdateContent(
                    body,
                    CardService.ContentType.MUTABLE_HTML)
            .setUpdateType(CardService.UpdateDraftBodyType.IN_PLACE_INSERT))
        .build();
    return updateDraftActionResponse;
}
