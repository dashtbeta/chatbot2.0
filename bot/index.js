////////////////////////////////////////////////////////////
// Start: To setup the script, Install these packages
// 
// npm install --save botbuilder 
// npm install --save node-rest-client
// npm install --save mathjs
//
////////////////////////////////////////////////////////////

var builder = require('botbuilder');
var RestClient = require('node-rest-client').Client;
var restclient = new RestClient();
var math = require('mathjs');
var request = require("request");
var emoji = require('node-emoji');


var apiai = require('apiai'); 
var apiai_app = apiai(process.env.APIAI_CLIENT_ACCESS_TOKEN);
var apiai_error_timeout = 0;


//var tableName = 'BotStore';
//var azureTableClient = new azure.AzureTableClient(tableName);
//var tableStorage = new azure.AzureBotStorage({ gzipData: false }, azureTableClient);

////////////////////////////////////////////////////////////////////////////
// Global Variables
// Session Data
var LastMenu = 'LastMenu';
var NumOfFeedback = 'NumOfFeedback';
var DialogId = 'DialogId';
var DialogState = 'DialogState';
var imagedir = 'https://yellowchat.azurewebsites.net';
var OneTimePin = 'OneTimePin';
var PhoneNumber = 'PhoneNumber';
var ValidatedTime = 'ValidatedTime';

// Bot Retry Parameters
var MaxRetries = 1;
var MaxRetries_SingleMenu = 0;
var DefaultErrorPrompt = "Err... I didn't get that. Click on any of the above for help.";
var DefaultMaxRetryErrorPrompt = "Err... I didn't get that. Let's start again";
var AnyResponse = "blalala";    // any text
// API Gateway Variables
var ApiGwAuthToken = '';
var ApiGwAuthTokenExpiry = 0;
var ApiGwSmsCounter = 0;

////////////////////////////////////////////////////////////////////////////
// Initialization functions
// Get secrets from server environment
var botConnectorOptions = { 
    appId: process.env.BOTFRAMEWORK_APPID, 
    appPassword: process.env.BOTFRAMEWORK_APPSECRET
};
// Create bot
var connector = new builder.ChatConnector(botConnectorOptions);
var bot = new builder.UniversalBot(connector, [

    function (session) {
        session.beginDialog('menu');
        
        
    },
    function (session, results) {
        session.endConversation("Please type Menu");
    }
]);
//]).set('autoBatchDelay',100);
//.set('storage', tableStorage);
// Require Functions
//bot.library(require('./validators').createLibrary());
bot.library(require('./dialogs/uidemo').createLibrary());

// start by getting API Gateway token first
//GetSmsAuthToken();
//GetSmsAuthToken2();
//setTimeout(function () { GenerateOtp3('0163372748');}, 2000);

// Initialize Telemetry Modules
var telemetryModule = require('./telemetry-module.js'); // Setup for Application Insights
var appInsights = require('applicationinsights');
var appInsightsClient = 0;
InitializeAppInsights();

function InitializeAppInsights(){
    try {
        appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
        appInsightsClient = appInsights.getClient();
    } catch (e) {
        console.log("Not connecting to AppInsights");
    }
}
////////////////////////////////////////////////////////////////////////////



////////////////////////////////////////////////////////////////////////////
// Send welcome when conversation with bot is started, by initiating the root dialog
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                console.log("identity Added " + identity.id + " Message " + message.address.bot.id + " " + message.address.conversation.id);
                bot.beginDialog(message.address, 'intro');
            }
        });
    }
    if (message.membersRemoved){
        console.log("identity Removed " + identity.id + " Message " + message.address.bot.id + " " + message.address.conversation.id);
        message.membersRemoved.forEach(function (identity) {
            console.log("identity Removed " + identity.id + " Message " + message.address.bot.id + " " + message.address.conversation.id);
        });
    }
});

// Wrapper function for logging
function trackBotEvent(session, description, dialog_state, storeLastMenu) {
    session.send({ type: 'typing' });   // Send typing to all menu

    // log session.message.address to identify user 
    //var address = JSON.stringify(session.message.address); session.send("User Address=" + address);
    //
    // Result & Sample Data
    //---------------------
    // Sample Data - Conversation 1 - Dialog 1
    //{“id”:”c57nfne1mh9b3leggc”,”channelId”:”emulator”,
    //”user”:{“id”:”default-user”,”name”:”User”},
    //”conversation”:{“id”:”meckjg4870nch9ebf”},
    //”bot”:{“id”:”default-bot”,”name”:”Bot”},
    //”serviceUrl”:”http://localhost:59711","useAuth":false}
    //
    // Sample Data - Conversation 1 - Dialog 2
    //{“id”:”90fea2l3k140jid8f”,”channelId”:”emulator”, // message.id is different for different dialog. 
    //”user”:{“id”:”default-user”,”name”:”User”},
    //”conversation”:{“id”:”meckjg4870nch9ebf”},        // Conversation.id is same for same conversation
    //”bot”:{“id”:”default-bot”,”name”:”Bot”},
    //”serviceUrl”:”http://localhost:59711","useAuth":false}    

    if(storeLastMenu==undefined) {
        session.privateConversationData[LastMenu] = description;
    }
// Logging to Database
//{"command": "update_chat_log",
//"auth_key": "a6hea2",
//"chat_id": "abcde12345",
//"dialog_id":"ateer",
//"dialog_state":"1",   1:mid/end conversation,  0:start conversation
//"dialog_type":"text", "Email" / "Phone Num" / etc
//"dialog_input":"",    "
//"chat_log": "menu|prepaid"}
    
    // @*)(*!)@(*#!@ ) why get local date also need 3 lines of text !)(@*#)(!@*#)()
//    var d = new Date();
//    var offset = (new Date().getTimezoneOffset() / 60) * -1;
//    var nowtime = new Date(d.getTime() + offset).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    if(session.privateConversationData[DialogId] === undefined) {
        session.privateConversationData[DialogId] = session.message.address.id;
    }

	logConversation(session,
					session.message.address.conversation.id, 
					session.privateConversationData[DialogId],
					dialog_state,
					session.privateConversationData[LastMenu]);	
}

function logConversation(session, conversationId, dialogId, dialogState, chatLog) {
    var options = {
        method: 'POST',
        url: process.env.CHATBOT_LOG_URL,
        qs: {       action: 'json' },
        headers: {  'content-type': 'multipart/form-data'   },
        formData: { 
            data: '{\
"command": "update_chat_log",\
"auth_key": "' + process.env.CHATBOT_LOG_AUTH_KEY+ '",\
"chat_id": "'  + conversationId+ '",\
"dialog_id": "'+ dialogId+ '",\
"dialog_state":"' + dialogState + '",\
"dialog_type":"",\
"dialog_input":"",\
"chat_log": "'+chatLog+'"}'
        }
    };

	try{
		request(options, function (error, response, body) { // Send to DB if this is Production Environment
		})
	} catch (e) {
		console.log("cannot log to DB");                // Log if this is Production &Development Environment
	}
}


bot.dialog('YouThere', [(session)=>{
    session.dialogData.inactive = setTimeout(()=>{
        session.send('You there?');
		console.log('timeout');
    },3000)
}])

// Middleware for logging all sent & received messages
bot.use({
    receive: function (event, next) {
		// todo: log with session info
        console.log('Log:User Typed[' + event.text + '] user[' + event.address.user.name + ']');
        next();
    },
    send: function (event, next) {
		// todo: log with session info
        console.log('Log:Bot Replied' + event.text + ', user: ' + event.address.user.name);
        next();
    }
});

// R - menu
bot.dialog('intro', [
    function (session) {
        // Initialize Session Data
        session.privateConversationData[NumOfFeedback] = 0;
        session.privateConversationData[DialogId] = session.message.address.id;

        trackBotEvent(session, 'intro', 0);  
        session.send(" Hi, my name is **Will**, your *Virtual Assistant*. \n\n How may I help you today?");
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt);
        session.replaceDialog('menu');
    }
]);

bot.dialog('byemenu', [
    function (session) {
        session.send("Bye for now.");
        session.send("Thanks for using Yello");
        session.send("You can always press \"Main Menu\" button above to start over");
            }
]).triggerAction({
    matches: /^(exit)|(quit)|(depart)|(bye)|(goodbye)$/i
});


bot.dialog('getBotFeedback', [
    function (session) {
        builder.Prompts.choice(session, emoji.emojify("We would appreciate your feedback. How would you rate our Virtual Assistant? \n(1)not able to help me, (5)very useful"), emoji.emojify('★|★★|★★★|★★★★|★★★★★'), { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        switch (results.response.index) {
            case 0:
                trackBotEvent(session,session.privateConversationData[LastMenu]+'|Feedback 1',1,0);
                break;
            case 1:
                trackBotEvent(session,session.privateConversationData[LastMenu]+'|Feedback 2',1,0);
                break;
            case 2:
                trackBotEvent(session,session.privateConversationData[LastMenu]+'|Feedback 3',1,0);
                break;
            case 3:
                trackBotEvent(session,session.privateConversationData[LastMenu]+'|Feedback 4',1,0);
                break;
            case 4:
                trackBotEvent(session,session.privateConversationData[LastMenu]+'|Feedback 5',1,0);
                break;
            default:
                session.send("Please help to rate me 1~5 above");
                break;
        }
        session.send('Thank you for your feedback');
        session.replaceDialog('menu');
    }
])

bot.dialog('getInfoFeedback', [
    function (session) {
		
		var respCards = new builder.Message(session)
			.text("Is this information helpful for you?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "Yes", "✓"),
						builder.CardAction.imBack(session, "No", "✗")
					]
				)
			);
        builder.Prompts.choice(session, respCards, "Yes|No", { maxRetries:MaxRetries_SingleMenu});
	},
    function(session, results) {
		if(results.response==undefined){
			session.replaceDialog('menu');			
		} else {
			switch (results.response.index) {
				case 0:
					trackBotEvent(session,'menu|OtherQuestions|AllAboutMyAccount|GetAccountNo|Yes Useful',1,0);
					session.send("Thanks for your feedback. I'm glad we can help");
					session.endDialog();
					break;
				case 1:
					trackBotEvent(session,'menu|OtherQuestions|AllAboutMyAccount|GetAccountNo|Not Useful',1,0);
					session.send("Thanks for your feedback. We will improve");
					session.endDialog();
					break;
				default:
					break;
			}			
			session.replaceDialog('menu');
		}
    }
])

bot.dialog('Plan-MobileNumOwnership', [
    function (session) {
        session.send("If you have the phone with you, you can check this information on MyDigi app. If not, you can talk to my Human Friend from 9am to 6pm. ");
    }
]).triggerAction({
    matches: /.*(this mobile number).*|.*(this number).*|.*(Mobile number ownership for).*/i
});


bot.dialog('Plan-AddOn-Topup', [
    function (session) {
        session.send("You can do this via the MyDigi app or you can dial ⋆200⋆2");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1 of 3")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page2.png') ])

				,new builder.HeroCard(session)
				.title("Step 2 of 3")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page3.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 3 of 3")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page4.png') ])
				
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(purchase internet).*|.*(quota topup).*|.*(quota top-up).*/i
});

bot.dialog('Plan-HappyHour', [
    function (session) {
        session.send("If you mean hourly data passes, you can check them out over here. Psst, you might find some exclusive passes on the MyDigi app. Just check them out on the add on page!");
    }
]).triggerAction({
    matches: /.*(happy hour data).*/i
});

bot.dialog('Plan-Cheapest-BestValue', [
    function (session) {
        session.send("Let me tell you about our unbeatable value plans ;)");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 50")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-50.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(cheapest plan).*|.*(least data).*|.*(cheap plan).*|.*(lowest price).*|.*(lowest plan)/i
});

bot.dialog('Plan-Latest', [
    function (session) {
        session.send("We have a wide varety of plan for all your needs.");
		session.send(respCards);
        var respCards = new builder.Message(session)
            .text("Choose the range that suits you:")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Below RM60", "Below RM60"),
                        builder.CardAction.imBack(session, "RM61-RM99", "RM61-RM99"),
                        builder.CardAction.imBack(session, "Above RM100", "Above RM100")
                    ]
                )
            );
		session.send(respCards);	
    }
]).triggerAction({
    matches: /.*(latest plan).*|.*(updated plan).*|.*(latest promotion).*|.*(updated plan).*|.*(ambassador).*|.*(current plan).*|.*(best value).*|.*(most data).*|.*(least data).*/i
});

bot.dialog('Plan-LowTier-Below60', [
    function (session) {
        session.send("Here are the prepaid & postpaid plans below RM60");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 50")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-50.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
								])

                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(Below RM60).*|.*(Below 60).*/i
});

bot.dialog('Plan-MidTier-RM61-RM99', [
    function (session) {
        session.send("Here are the plans within the range RM61-RM99");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 80")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-80.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(RM61-RM99).*/i
});
		
bot.dialog('Plan-HighTier-Over100', [
    function (session) {
        session.send("For this range,we have Infinite 150 and Postpaid 110");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 150 Infinite")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-infinite.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
					
				,new builder.HeroCard(session)
				.title("Digi Postpaid 110")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-110.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])
				
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(Above RM100).*|.*(above 100).*|.*(more than 100).*|.*(most expensive).*|.*(expensive plans).*|.*(premium plans).*|.*(most data).*/i
});
				
bot.dialog('Plan-Fastest', [
    function (session) {
        session.send("Of course, all of our plans are LTE enabled! These are our current plans");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 150 Infinite")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-infinite.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
					
				,new builder.HeroCard(session)
				.title("Digi Postpaid 110")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-110.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

                ,new builder.HeroCard(session)
				.title("Digi Postpaid 80")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-80.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Postpaid 50")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-50.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(fastest plan).*/i
});

bot.dialog('Plan-Infinite', [
    function (session) {
        session.send("Infinite is first ever exclusive online plans, with no caps on everything from Internet, Calls and Tethering. Check out more details here:");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 150 Infinite")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-infinite.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
					
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(infinite).*|.*(infinity).*/i
});					

bot.dialog('Plan-PostpaidBudget', [
    function (session) {
        session.send("Let me share with you our postpaid value plans. If you're on the website, look out for online exclusives!");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Digi Best Value Plan")
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
            ]);
		session.send(respCards);		
	
    }
]).triggerAction({
    matches: /.*(limited budget).*|.*(don't want to pay so much).*/i
});

bot.dialog('Plan-Prepaid', [
    function (session) {
        session.send("Let me show you our awesome prepaid plans!");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
	
    }
]).triggerAction({
    matches: /.*(prepaid plan).*|.*(prepaid package).*|.*(plan validity).*|.*(plan valid).*/i
});
					
bot.dialog('Plan-WeekendData', [
    function (session) {
        session.send("The new Digi Postpaid plan comes with free lifetime 4G Weekend quota every month – you get extra 4G quota for your usages every Saturday and Sunday.");
    }
]).triggerAction({
    matches: /.*(weekend data).*/i
});

bot.dialog('Plan-Competitor', [
    function (session) {
        session.send("We have unbeatable value plans for all your needs!");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 150 Infinite")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-infinite.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
					
				,new builder.HeroCard(session)
				.title("Digi Postpaid 110")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-110.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

                ,new builder.HeroCard(session)
				.title("Digi Postpaid 80")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-80.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Postpaid 50")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-50.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(maxis).*|.*(hotlink).*|.*(umobile).*|.*(u-mobile).*|.*(u mobile).*|.*(celcom).*|.*(xpax).*|.*(unlimited hero).*|.*(postpaid hero).*/i
});

bot.dialog('Plan-PortIn', [
    function (session) {
        session.send("Welcome to the Yellow family! It’s so easy to Switch to Digi, you can do it yourself! Here’s how:");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Step 1")
				.text("Choose your plan, click 'Port In' and complete checkout")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/switch-to-digi', 'Find Out More')	
				])
				
                ,new builder.HeroCard(session)
				.title("Step 2")
				.text("Upon successful payment, you'll receive and email from us")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/switch-to-digi', 'Find Out More')	
				])
					
                ,new builder.HeroCard(session)
				.title("Step 3")
				.text("Get your new SIM pack delivered for FREE. You will be notified via email when your number is successfully ported in")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/switch-to-digi', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
	
    }
]).triggerAction({
    matches: /.*(change from maxis).*|.*(change from celcom).*|.*(change from xpax).*|.*(change from umobile).*/i
});			
		
bot.dialog('Plan-ChangePrepaidToPostpaid', [
    function (session) {
        session.send("If you already have a plan in mind, just click the Change of Plan button, and it'll be a a breeze.  Would you like to take a look at our plans?");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Postpaid 150 Infinite")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-infinite.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
				])
					
				,new builder.HeroCard(session)
				.title("Digi Postpaid 110")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-110.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

                ,new builder.HeroCard(session)
				.title("Digi Postpaid 80")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-80.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])

				,new builder.HeroCard(session)
				.title("Digi Postpaid 50")
                .images([ builder.CardImage.create(session, imagedir + '/images/postpaid-50.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(prepaid to postpaid).*/i
});			

bot.dialog('Plan-ChangePostpaidToPrepaid', [
    function (session) {
        session.send("If you already have a plan in mind, just click the Change of Plan button, and it'll be a a breeze.  Would you like to take a look at our plans?");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(postpaid to prepaid).*/i
});	


bot.dialog('Plan-Family', [
    function (session) {
        session.send("If you would like to get a supplementary line, visit us at any of our stores. We'll take care of the rest.");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Supplementary line")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/postpaid/family-plans', 'Find Out More')
				])
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(supplementary plan).*|.*(family plan).*/i
});	

bot.dialog('Plan-Buddyz', [
    function (session) {
        session.send("I see you have a question about prepaid. Find out more over here");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Digi Prepaid Live")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-live.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')
				])
				
                ,new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);		
		
    }
]).triggerAction({
    matches: /.*(buddyz).*|.*(buddys).*/i
});	


bot.dialog('Plan-Business', [
    function (session) {
        session.send("Thank you for your interest. Please click on the link to leave your details with us. Our Digi Authourized Business Representative will get back to you as soon as possible.");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Digi Business Plans")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/business-overview', 'Business Plan Details')
				])
            ]);
		session.send(respCards);		
		
    }
]).triggerAction({
    matches: /.*(business).*/i
});	


bot.dialog('Plan-CancelAutobilling', [
    function (session) {
        session.send("To do that, you can walk in any of our Digi Store, or call in to our Digi Helpline at  016 2211 800 but we strongly recommend that you stay on autobilling.");
    }
]).triggerAction({
    matches: /.*(cancel autobilling).*|.*(cancel auto billing).*|.*(stop auto billing).*/i
});	

bot.dialog('Plan-Autobilling', [
    function (session) {
        session.send("Have your Digi bill charged to your credit, charge or debit card each month! No hassle at all. Here's the link to find out more:");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Autobilling")
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/bill-payment', 'Find Out More')
				])
            ]);
		session.send(respCards);
    }
]).triggerAction({
    matches: /.*(autobilling).*|.*(auto billing).*/i
});	

bot.dialog('Plan-AutoReload', [
    function (session) {
        session.send("We have a few ways to help you. You can reload online here: (https://store.digi.com.my/storefront/reload-details.ep). Or do it anytime and anywhere on the MyDigi app.");
    }
]).triggerAction({
    matches: /.*(auto reload).*|.*(autoreload).*/i
});	

bot.dialog('Plan-Broadband', [
    function (session) {
        session.send("Great choice! Our broadband will provide you with unlimited entertainment");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Broadband 30")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-30.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
				])
				
				,new builder.HeroCard(session)
				.title("Broadband 60")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-60.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
					,builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband-devices', 'Device')
				])

				,new builder.HeroCard(session)
				.title("Broadband 100")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-100.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
					,builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband-devices', 'Device')
				])
            ]);
		session.send(respCards);
    }
]).triggerAction({
    matches: /^(broadband1)$/i
});	

bot.dialog('Plan-Broadband2', [
    function (session) {
        session.send("Great choice! Our broadband will provide you with unlimited entertainment");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Broadband 30")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-30.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
				])
				
				,new builder.HeroCard(session)
				.title("Broadband 60")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-60.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
				])

				,new builder.HeroCard(session)
				.title("Broadband 100")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-100.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
				])
            ]);
		session.send(respCards);
        session.send("If you would like to get a device with your broadband plan, just click [here](http://new.digi.com.my/broadband-devices) to find out more");
    }
]).triggerAction({
    matches: /^(broadband2)$/i
});	

bot.dialog('Plan-Broadband3', [
    function (session) {
        session.send("I have 3 broadband plans for you\n\n " +
					 "* **Broadband 30** comes with a total of 18GB data, suitable for light use\n\n" + 
					 "* **Broadband 60** comes with a total of 40GB data, suitable for medium use\n\n" + 
					 "* **Broadband 100** comes with a total of 100GB data, for heavy user");
        var respCards = new builder.Message(session)
            .text("Would you like me to tell you more? ")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Broadband 30", "Broadband 30"),
                        builder.CardAction.imBack(session, "Broadband 60", "Broadband 60"),
                        builder.CardAction.imBack(session, "Broadband 100", "Broadband 100")
                    ]
                )
            );
		session.send(respCards);	
    }
]).triggerAction({
    matches: /^(broadband3)$/i
});	

bot.dialog('Plan-Broadband-30', [
    function (session) {
        session.send("**Digi Broadband 30** (RM30/month) is a prepaid package, comes with\n\n" + 
					 "* **10GB** for 19 Stream FREE channels\n\n" + 
					 "* **8GB** internet quota\n\n" + 
					 "* *Starter pack is RM38 include RM30 preload value*");
        var respCards = new builder.Message(session)
            .text("Would you like to find out more?")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
						builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=20017&isBundle=n&ppymttype=PREPAID&ptype=BB&_ga=2.144904436.1557397186.1496910913-599147580.1493727367', 'Buy Now'),
						builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website'),
                        builder.CardAction.imBack(session, "Stream FREE", "Stream FREE"),
                        builder.CardAction.imBack(session, "Broadband 60", "Broadband 60"),
                        builder.CardAction.imBack(session, "Broadband 100", "Broadband 100")
                    ]
                )
            );
		session.send(respCards);	
    }
]).triggerAction({
    matches: /^(broadband 30)$/i
});	

bot.dialog('Plan-Broadband-60', [
    function (session) {
        session.send("**Digi Broadband 60** (RM60/month) is a comes with\n\n" + 
					 "* **16GB** for 19 Stream FREE channels\n\n" + 
					 "* **8GB** for stream on demand channels\n\n" + 
					 "* **16GB** internet quota");
        var respCards = new builder.Message(session)
            .text("Would you like to find out more?")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
						builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=90000P&isBundle=y&ppymttype=POSTPAID&ptype=BB&_ga=2.187260008.1557397186.1496910913-599147580.1493727367', 'Buy Now'),
						builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website'),
                        builder.CardAction.imBack(session, "Stream FREE", "Stream FREE"),
                        builder.CardAction.imBack(session, "Stream On Demand", "Stream On Demand"),
                        builder.CardAction.imBack(session, "Broadband 30", "Broadband 30"),
                        builder.CardAction.imBack(session, "Broadband 100", "Broadband 100")
                    ]
                )
            );
		session.send(respCards);	
    }
]).triggerAction({
    matches: /^(broadband 60)$/i
});	

bot.dialog('Plan-Broadband-100', [
    function (session) {
        session.send("**Digi Broadband 100** (RM100/month) is a comes with\n\n" + 
					 "* **50GB** for 19 Stream FREE channels\n\n" + 
					 "* **10GB** for stream on demand channels\n\n" + 
					 "* **40GB** internet quota");
        var respCards = new builder.Message(session)
            .text("Would you like to find out more?")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
						builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=90001P&isBundle=y&ppymttype=POSTPAID&ptype=BB&_ga=2.141721458.1557397186.1496910913-599147580.1493727367', 'Buy Now'),
						builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website'),
                        builder.CardAction.imBack(session, "Stream FREE", "Stream FREE"),
                        builder.CardAction.imBack(session, "Stream On Demand", "Stream On Demand"),
                        builder.CardAction.imBack(session, "Broadband 30", "Broadband 30"),
                        builder.CardAction.imBack(session, "Broadband 60", "Broadband 60")
                    ]
                )
            );
		session.send(respCards);	
    }
]).triggerAction({
    matches: /^(broadband 100)$/i
});	

bot.dialog('Plan-Stream-Free', [
    function (session) {
        var respCards = new builder.Message(session)
            .text("Digi Broadband's Stream FREE quota can be used to stream *YouTube, YouTube Kids, Daily Motion, Hitz FM, Era, Mix.fm, Ragaa, Sinar.fm, My.fm, Thr, Kool, BFM*")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Stream On Demand", "Stream On Demand"),
                        builder.CardAction.imBack(session, "Broadband 30", "Broadband 30"),
                        builder.CardAction.imBack(session, "Broadband 60", "Broadband 60"),
                        builder.CardAction.imBack(session, "Broadband 100", "Broadband 100")
                    ]
                )
            );
		session.send(respCards);	    }
]).triggerAction({
    matches: /^(Stream FREE)$/i
});	

bot.dialog('Plan-Stream-On-Demand', [
    function (session) {
        var respCards = new builder.Message(session)
            .text("Digi Broadband's Stream On Demand can be used to stream on *Dimsum, iflix, HeroTalkies, Tonton, Viu, Astro-Go, HyypTv, Netflix, KKBox, Radio 2008*")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Stream FREE", "Stream FREE"),
                        builder.CardAction.imBack(session, "Broadband 30", "Broadband 30"),
                        builder.CardAction.imBack(session, "Broadband 60", "Broadband 60"),
                        builder.CardAction.imBack(session, "Broadband 100", "Broadband 100")
                    ]
                )
            );
		session.send(respCards);	    }
]).triggerAction({
    matches: /^(Stream On Demand)$/i
});	

bot.dialog('printenv', [
    function (session) {
		session.send("here are the settings: ");
		session.send(" ♥ APP_SECRET:" + process.env.APP_SECRET +
					" \n\n SBP_SMS_AUTHORIZATIONKEY :" + process.env.SBP_SMS_AUTHORIZATIONKEY +
					" \n\n SBP_SMS_SENDURL :" + process.env.SBP_SMS_SENDURL +
					" \n\n APIGW_URL:" + process.env.APIGW_URL +
					" \n\n APIGW_SMS_AUTH_CLIENT_ID:" + process.env.APIGW_SMS_AUTH_CLIENT_ID +
					" \n\n APIGW_SMS_AUTH_CLIENT_SECRET:" + process.env.APIGW_SMS_AUTH_CLIENT_SECRET +
					" \n\n CHATBOT_LOG_AUTH_KEY:" + process.env.CHATBOT_LOG_AUTH_KEY +
					" \n\n CHATBOT_LOG_URL:" + process.env.CHATBOT_LOG_URL +
					" \n\n DEVELOPMENT:" + process.env.DEVELOPMENT +
					" \n\n LOGGING:" + process.env.LOGGING +
					" \n\n APPINSIGHTS_INSTRUMENTATIONKEY:" + process.env.APPINSIGHTS_INSTRUMENTATIONKEY +
					" \n\n OFFLINE:" + process.env.OFFLINE +
					" \n\n APIAI_CLIENT_ACCESS_TOKEN:" + process.env.APIAI_CLIENT_ACCESS_TOKEN +
					" \n\n APIAI_ERROR_TIMEOUT:" + process.env.APIAI_ERROR_TIMEOUT);
	}
]).triggerAction({
    matches: /^(printEnv)$/
});

bot.dialog('CatchAll', [
    function (session) {

		
		if (apiai_error_timeout < Date.now()) {
			apiai_error_timeout = 0;	// Reset timeout if prevously set to some value
			var randSessionId = '000000' + math.randomInt(100000,999999);

			var request = apiai_app.textRequest(session.message.text, {
				sessionId: randSessionId
			});

			request.on('response', function(response) {
				if(response.result.action==undefined){
					session.send("Let's get back to our chat on Digi");
				} else {		// We have response from API.AI
					console.log("API.AI [" +response.result.resolvedQuery + '][' + response.result.action + '][' + response.result.score + ']['  + response.result.fulfillment.speech + '][' + response.result.metadata.intentName + ']');
					//	console.log('API.AI response text:'+ response.result.fulfillment.speech);
					//	console.log('API.AI response text:'+ response.result.fulfillment.messages[0].speech);
					//	console.log('API.AI response:'+ JSON.stringify(response.result));

					// Flow when API.ai returns
					// 1) Try to call the intent. 
					// 2) If intent not exist, check if there is fulfillment speech and display that default speech
					// 3) If fulfillment speech does not exist, display default "Let's get back to our chat on Digi" 
					try {
						session.replaceDialog(response.result.metadata.intentName);
					} catch (e) {
						console.log("Fallback due to Unknown API.ai Intent [" + response.result.metadata.intentName + ']');
						if(response.result.fulfillment.speech.length>0) {
							session.send(response.result.fulfillment.speech);				
						} else {
							session.send("Let's get back to our chat on Digi");
						}
					}
				}
			});
			request.on('error', function(error) {
				console.log('API.AI error:'+error);
				apiai_error_timeout = Date.now() + process.env.APIAI_ERROR_TIMEOUT*1000;	// Do not use NLP for the next 1 day
				session.send("Let's get back to our chat on Digi");
			});

			request.end();
		} else {
			// there were error in the last 1 day. Do not query API AI for the next 1 day
			session.send("Let's get back to our chat on Digi");
		}
	}
]).triggerAction({
    matches: /^.*$/i
});


// Connector listener wrapper to capture site url
var connectorListener = connector.listen();
function listen() {
    return function (req, res) {
        // Capture the url for the hosted application
        // We'll later need this url to create the checkout link 
        connectorListener(req, res);
    };
}

module.exports = {
    listen: listen,
};

