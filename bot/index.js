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
var DialogId = 'DialogId';
var DialogState = 'DialogState';
var imagedir = 'https://yellowchat.azurewebsites.net';
var FallbackState = 'FallbackState';
// Recommend State 0=Not recommending
var PlanRecommendState = 'PlanRecommendState';
var Recommending = 1;
var RecommendPrepaidBest = 10;
var RecommendPrepaidLive = 11;
var RecommendPostpaidInfinite = 20;
var RecommendPostpaid110 = 21;
var RecommendPostpaid80 = 22;
var RecommendPostpaid50 = 23;
var RecommendPostpaidInfinite110 = 24;
var RecommendPostpaidSocialMedia = 30;

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
		session.privateConversationData[PlanRecommendState] = 0;	// are we recommending something?
		session.privateConversationData[DialogId] = session.message.address.id;
		session.privateConversationData[FallbackState] = 0;			// how many times user type unknown stuff?

        trackBotEvent(session, 'intro', 0);  
        session.send(" Hi, my name is Will, your Virtual Assistant. \n\n How may I help you today?");
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt);
        session.replaceDialog('menu');
    }
]);

bot.dialog('byemenu', [
    function (session) {
        session.send("Bye for now.");
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

bot.dialog('getFeedback', [
    function (session) {
		var respCards = new builder.Message(session)
			.text("Was I able to help you?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "Yes", "Yes"),
						builder.CardAction.imBack(session, "No", "No")
					]
				)
			);
        builder.Prompts.choice(session, respCards, "Yes|No");
	}
	,function(session, results) {
		switch (results.response.index) {
			case 0:	// Yes
				session.send("Always good to know :D");
				break;
			case 1:	// No
				var respCards = new builder.Message(session)
					.text("Would you like to try again?")
					.suggestedActions(
						builder.SuggestedActions.create(
							session,[
								builder.CardAction.imBack(session, "Yes", "Yes"),
								builder.CardAction.imBack(session, "No", "No")
							]
						)
					);
				builder.Prompts.choice(session, respCards, "Yes|No");
				break;
			default:
				break;
		}
    }
	,function(session, results) {
		switch (results.response.index) {
			case 0:	// Yes
				if (session.privateConversationData[PlanRecommendState]) {
					session.replaceDialog('Plan-Recommendation');
				}
				break;
			case 1:	// No
				session.send("Alright. Can I help you with anything else?");
				session.endDialog();
				break;
			default:
				break;
		}			
    }
]).triggerAction({
    matches: /(getFeedback)/i
});

bot.dialog('Plan-MobileNumOwnership', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("If you have the phone with you, you can check this information on MyDigi app. If not, you can talk to my Human Friend from 9am to 6pm. ");
    }
]).triggerAction({
    matches: /.*(this mobile number).*|.*(this number).*|.*(Mobile number ownership for).*/i
});

bot.dialog('Plan-AddOn-Topup', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("You can do this via the MyDigi app or you can dial ⋆200⋆2");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1 of 3")
				.text("At MyDigi app, click on Add-on and choose Add-on Category")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Addon-Internet1.png') ])

                ,new builder.HeroCard(session)
				.title("Step 2 of 3")
				.text("Select your package you want")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Addon-Internet2.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 3 of 3")
				.text("Click Buy Internet")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Addon-Internet34.png') ])
								
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(purchase internet).*|.*(quota topup).*|.*(quota top-up).*/i
});

bot.dialog('Plan-HappyHour', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("If you mean hourly data passes, you can check them out over here. Psst, you might find some exclusive passes on the MyDigi app. Just check them out on the add on page!");
		session.send("");
		
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-addons', 'Prepaid Add-On')
				])
					
            ]);
		session.send(respCards);		
    }
]).triggerAction({
    matches: /.*(happy hour data).*/i
});


bot.dialog('Plan-Infinite', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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

bot.dialog('Plan-Prepaid-Best', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("Let me show you our awesome prepaid plans!");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Digi Prepaid Best")
                .images([ builder.CardImage.create(session, imagedir + '/images/prepaid-best.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'https://new.digi.com.my/prepaid-plans', 'Find Out More')	
				])
            ]);
		session.send(respCards);
    }
]).triggerAction({
    matches: /.*(prepaid best).*/i
});

bot.dialog('Plan-Prepaid-Live', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
            ]);
		session.send(respCards);		
	
    }
]).triggerAction({
    matches: /.*(prepaid live).*/i
});
					
bot.dialog('Plan-WeekendData', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("The new Digi Postpaid plan comes with free lifetime 4G Weekend quota every month – you get extra 4G quota for your usages every Saturday and Sunday.");
    }
]).triggerAction({
    matches: /.*(weekend data).*/i
});

bot.dialog('Plan-Competitor', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
]);

bot.dialog('Plan-PortIn', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
				.text("Upon successful payment, you'll receive an email from us")
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("To do that, you can walk in any of our Digi Store, or call in to our Digi Helpline at  016 2211 800 but we strongly recommend that you stay on autobilling.");
    }
]).triggerAction({
    matches: /.*(cancel autobilling).*|.*(cancel auto billing).*|.*(stop auto billing).*/i
});	

bot.dialog('Plan-Autobilling', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("We have a few ways to help you. You can reload online");
        var respCards = new builder.Message(session)
            .text("Or do it anytime and anywhere on the MyDigi app.")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.openUrl(session, "https://store.digi.com.my/storefront/reload-details.ep", "Reload Online")
                    ]
                )
            );
		session.send(respCards);	
	}
]).triggerAction({
    matches: /.*(auto reload).*|.*(autoreload).*/i
});	

bot.dialog('Plan-Broadband', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
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
    matches: /^(broadband2)$/i
});	

bot.dialog('Plan-Broadband-30', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Broadband 30")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-30.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
				])
            ]);
		session.send(respCards);
    }
]).triggerAction({
    matches: /^(broadband 30)$/i
});	

bot.dialog('Plan-Broadband-60', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
				.title("Broadband 60")
                .images([ builder.CardImage.create(session, imagedir + '/images/broadband-60.jpg') ])
				.buttons([
					builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'Go to website')
					,builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband-devices', 'Device')
				])
            ]);
		session.send(respCards);
    }
]).triggerAction({
    matches: /^(broadband 60)$/i
});	

bot.dialog('Plan-Broadband-100', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
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
    matches: /^(broadband 100)$/i
});

bot.dialog('Roaming-Start', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("You can start roaming once your roaming status is active. Just make sure that you're attached to our roaming partners.");
        var respCards = new builder.Message(session)
            .text("How long have you been with Digi")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Less than 6 months", "Less than 6 months"),
                        builder.CardAction.imBack(session, "More than 6 months", "More than 6 months")
                    ]
                )
            );
		session.send(respCards);
	}
]).triggerAction({
    matches: /.*(on roaming).*|.*(activate roaming).*|.*(on international roaming).*|.*(on my roaming).*|.*(activate my roaming).*/i
});

bot.dialog('Roaming-Start-LessThan6Months', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("You can walk into any Digi Store and my Human Friends will help you with that. Please bring along :\n\n"
		+ "1) NRIC \n\n"
		+ "2) Valid Passport \n\n"
		+ "3) Work Permit (for Non-Malaysian) \n\n");
	}
]).triggerAction({
    matches: /(Less than 6 months)/i
});

bot.dialog('Roaming-Start-MoreThan6Months', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.send("You can turn on roaming via the MyDigi app. Just follow the steps below");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
				new builder.HeroCard(session)
                .title('Step 1 of 3')
                .subtitle('On usage page, select "View Details"')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step1.png') ])

				, new builder.HeroCard(session)
                .title('Step 2 of 3')
                .subtitle('Select "Internet" for Internet quota balance')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step2.png') ])

				,new builder.HeroCard(session)
                .title('Step 3 of 3')
                .subtitle('Select "Voice" for Voice minutes balance')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step3.png') ])

            ]);
		session.send(respCards);
	}
]).triggerAction({
    matches: /(More than 6 months)/i
});

bot.dialog('Roaming-CallHome', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        var respCards = new builder.Message(session)
            .text("Where will you be calling from?")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Malaysia", "Malaysia"),
                        builder.CardAction.imBack(session, "Other Countries", "Other Countries")
                    ]
                )
            );
		session.send(respCards);	
	}
]).triggerAction({
    matches: /.*(call back home).*|.*(call home country).*/i
});

bot.dialog('Roaming-CallHome-FromMalaysia', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.send("We have two ways to do that: \n\n\n\n"
		+ "**1) Direct Dial/Text** \n\n"
		+ "Dial <00 or +><country code><area code/mobile code><telephone number>\n\n"
		+ "E.g.: to call Indonesia, (Mobile) 0060161234567 or +60161234567\n\n"
		+ "\n\n"

		+ "**2) Budget ⋆111⋆ Voice Call Dialing**\n\n"
		+ "Dial ⋆111⋆<country code><area code/mobile code><telephone number><#>.\n\n"
		+ "E.g.: to call Malaysia, (Mobile) ⋆111⋆60161234567#, (Fixed line) *111*6031234567#)\n\n");
	}
]).triggerAction({
    matches: /.*(call home from Malaysia).*|.*(call from Malaysia).*|(From Malaysia)/i
});

bot.dialog('Roaming-CallHome-FromOtherCountries', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.send("You can start roaming once your roaming status is active. Just make sure that you're attached to our roaming partners. \n\n\n\n"
		+ "http://new.digi.com.my/roaming/international-roaming-rates");
	}
]).triggerAction({
    matches: /.*(call home from overseas).*|.*(call from overseas).*|(From Other Countries)/i
});

bot.dialog('IDD-CallFail', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.send("No worries. Here are some suggestions to try out:\n\n"
					+ "1. Please check on MyDigi if your IDD is activated \n\n"
					+ "2. Please ensure that the dialing pattern is accurate  \n\n"
					+ " Dial <00 or +><country code><area code/mobile code><telephone number>  \n\n"
					+ "E.g.: to call Malaysia, (Mobile) 0060161234567 or +60161234567, (Fixed line) 006031234567 or +6031234567 < country code>  \n\n\n\n"
					+ "If that doesn't work, let me connect you to my Human Friend for further assistance. ");
	}
]).triggerAction({
    matches: /.*(cannot call idd).*|.*(cannot call overseas).*|.*(can't call overseas).*/i
});

bot.dialog('Roaming-RoamLikeHome', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.send("Roam Like Home Monthly is a monthly roaming top up which is bundled with Roaming Voice and Data for your convience. To find more information, please click on this link: \n\n"
					+ "http://new.digi.com.my/roaming/roam-like-home-monthly");
	}
]).triggerAction({
    matches: /.*(roam like home).*/i
});

// Digi Plan Recommendation
bot.dialog('Plan-Recommendation', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
        session.privateConversationData[PlanRecommendState] = Recommending;
        var respCards = new builder.Message(session)
            .text("What type of plan would you prefer?")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Pay as you go", "Pay as you go"),
                        builder.CardAction.imBack(session, "Monthly Billing", "Monthly Billing")
                    ]
                )
            );
		session.send(respCards);
	}
]).triggerAction({
    matches: /.*(recommend plan).*|.*(recommend me plan).*/i
});

bot.dialog('Plan-PayAsYouGo', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.privateConversationData[PlanRecommendState] = Recommending;
		var respCards = new builder.Message(session)
			.text("What would you usually use your data for?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "Social Media", "Social Media"),
						builder.CardAction.imBack(session, "Music, Video Streaming", "Music, Video Streaming")
					]
				)
			);
		builder.Prompts.choice(session, respCards, "Social Media|Music, Video Streaming", { maxRetries:MaxRetries_SingleMenu});
	}
	,function(session, results) {
		if(results.response==undefined){
			session.endDialog();
			session.replaceDialog('CatchAll');
		} else {
			switch (results.response.index) {
				case 0:		// Social Media
					session.privateConversationData[PlanRecommendState] = RecommendPrepaidBest;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Prepaid Best")
							.images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Best.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				case 1:		// Music, Video Streaming
					session.privateConversationData[PlanRecommendState] = RecommendPrepaidLive;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Prepaid Live")
							.images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Live.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				default:
					return;
			}
		}
		session.replaceDialog('getFeedback');
    }
]).triggerAction({
    matches: /(Pay as you go)/i
});

bot.dialog('Plan-MonthlyBilling', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		session.privateConversationData[PlanRecommendState] = Recommending;
		var respCards = new builder.Message(session)
			.text("How much data do you use monthly?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "More than 25GB", "More than 25GB"),
						builder.CardAction.imBack(session, "21GB-25GB", "21GB-25GB"),
						builder.CardAction.imBack(session, "11GB-20GB", "11GB-20GB"),
						builder.CardAction.imBack(session, "Less than 10GB", "Less than 10GB"),
						builder.CardAction.imBack(session, "I don't know", "I don't know")
					]
				)
			);
		builder.Prompts.choice(session, respCards, "More than 25GB|21GB-25GB|11GB-20GB|Less than 10GB|I don't know", { maxRetries:MaxRetries_SingleMenu});
	}
	,function(session, results) {
		if(results.response==undefined){
			session.replaceDialog('CatchAll');
			session.endDialog();
		} else {
			switch (results.response.index) {
				case 0:		// More than 25GB
					session.privateConversationData[PlanRecommendState] = RecommendPostpaidInfinite;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid Infinite")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-Infinite.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				case 1:		// 21-25GB
					session.privateConversationData[PlanRecommendState] = RecommendPostpaid110;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid 110")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-110.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				case 2:		// 11-20GB
					session.privateConversationData[PlanRecommendState] = RecommendPostpaid80;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid 80")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-80.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				case 3:		// less than 10 GB
					session.privateConversationData[PlanRecommendState] = RecommendPostpaid50;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid 50")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-50.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				default:	// I don't know
					session.replaceDialog('Plan-RecommendPlanByStreaming');
					return;
			}
		}
		session.replaceDialog('getFeedback');
    }
]).triggerAction({
    matches: /(Monthly Billing)/i
});
	
bot.dialog('Plan-RecommendPlanByStreaming', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		var respCards = new builder.Message(session)
			.text("How often do you use streaming services like YouTube and Spotify?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "Very often", "Very often"),
						builder.CardAction.imBack(session, "Not much", "Not much")
					]
				)
			);
		builder.Prompts.choice(session, respCards, "Very often|Not much", { maxRetries:MaxRetries_SingleMenu});
	}
	,function(session, results) {
		switch (results.response.index) {
			case 0:		// Very Often
				session.privateConversationData[PlanRecommendState] = RecommendPostpaidInfinite110;
				session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
				var respCards = new builder.Message(session)
					.attachmentLayout(builder.AttachmentLayout.carousel)
					.attachments([
						new builder.HeroCard(session)
						.title("Digi Postpaid Infinite")
						.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-Infinite.jpg') ])
						.buttons([
							builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#online-exclusive-plans', 'Find Out More')
						])

						,new builder.HeroCard(session)
						.title("Digi Postpaid 110")
						.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-110.jpg') ])					
						.buttons([
							builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
						])
					]);
				session.send(respCards);
				break;
			default:	// Not Much
				session.replaceDialog('Plan-RecommendPlanBySocialMedia');
				return;
		}
		session.replaceDialog('getFeedback');
    }
]);
	
bot.dialog('Plan-RecommendPlanBySocialMedia', [
    function (session) {
		session.privateConversationData[FallbackState] = 0;	// to reset the Fallback State (people talking rubbish)
		var respCards = new builder.Message(session)
			.text("Do you use social media (e.g. Facebook, Twitter) often?")
			.suggestedActions(
				builder.SuggestedActions.create(
					session,[
						builder.CardAction.imBack(session, "Very often", "Very often"),
						builder.CardAction.imBack(session, "Not much", "Not much")
					]
				)
			);
		builder.Prompts.choice(session, respCards, "Very often|Not much", { maxRetries:MaxRetries_SingleMenu});
	}
	,function(session, results) {
		if(results.response==undefined){
			session.replaceDialog('CatchAll');
			session.endDialog();
		} else {
			switch (results.response.index) {
				case 0:		// Very Often
				session.privateConversationData[PlanRecommendState] = RecommendPostpaid80;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid 80")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-80.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
				default:	// Not Much
					session.privateConversationData[PlanRecommendState] = RecommendPostpaid50;
					session.send("I think this will be a good plan for you. You can also upgrade your plan at any time. Just let us know.");
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.title("Digi Postpaid 50")
							.images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-50.jpg') ])
							.buttons([
								builder.CardAction.openUrl(session, 'https://new.digi.com.my/postpaid-plans#best-value-plans', 'Find Out More')
							])
						]);
					session.send(respCards);
					break;
			}
		}
		session.replaceDialog('getFeedback');
    }
]);

bot.dialog('Roaming-General', [
    function (session, args) {
		
		if(args.result.actionIncomplete==true){
			
			// If user answer unknown items many times, just cancel the current request to API.ai
			if(session.privateConversationData[FallbackState] >2){
				var request = apiai_app.textRequest("Cancel", {
					sessionId: session.message.address.conversation.id
				});
				request.end();
				session.privateConversationData[FallbackState] = 1;
				
				//session.replaceDialog('Default-Fallback-Intent');
				session.send("I'm sorry I don't understand. Maybe you want to check the roaming rates using our website");
				var respCards = new builder.Message(session)
					.attachmentLayout(builder.AttachmentLayout.carousel)
					.attachments([
						new builder.HeroCard(session)
						.text("List of Roaming Countries")
						.buttons([
							builder.CardAction.openUrl(session, "http://new.digi.com.my/roaming/international-roaming-rates", 'Check  Rates')
						])
					]);					
				session.send(respCards);
				return;
			}

			// now display the responses
			if(args.result.fulfillment.speech.length>0) {
				if(args.result.fulfillment.speech.search("postpaid")>=0) {
					session.privateConversationData[FallbackState] = 0;// reset to 0
					var respCards = new builder.Message(session)
						.text(args.result.fulfillment.speech)
						.suggestedActions(
							builder.SuggestedActions.create(
								session,[
									builder.CardAction.imBack(session, "Postpaid", "Postpaid"),
									builder.CardAction.imBack(session, "Prepaid", "Prepaid"),
								]
							)
						);
					session.send(respCards);
				} else {
					session.send(args.result.fulfillment.speech);
				}
			}
		} else {
			// our flow is complete
			session.privateConversationData[FallbackState] = 0;			
			
			// display the result
			if(args.result.fulfillment.speech.length>0) {
				// parse the string for country name, and display the result as "Roaming in Taiwan" 
				var httpLocation = args.result.fulfillment.speech.search("http");
				var httpString = args.result.fulfillment.speech.substring(httpLocation,args.result.fulfillment.speech.length);
				var countryLocation = args.result.fulfillment.speech.search("country=");
				var countryString = args.result.fulfillment.speech.substring(countryLocation+8,args.result.fulfillment.speech.length);

				// replace camelcase with Caps... e.g. SouthKorea --> South Korea
				var countryString2 = countryString
					// insert a space before all caps
					.replace(/([a-z])([A-Z])/g, '$1 $2');
				
				if(httpLocation>=0) {
					var respCards = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments([
							new builder.HeroCard(session)
							.text(args.result.fulfillment.speech.substring(0,httpLocation-1))
							.buttons([
								builder.CardAction.openUrl(session, httpString, 'Roaming in '+countryString2)
							])
						]);					
					session.send(respCards);
				} else {
					session.send(args.result.fulfillment.speech);
				}				
			}
		}
    }
]).triggerAction({
    matches: /(Monthly Billing)/i
});

// Redirect all to fallback intent
bot.dialog('Default-Unknown', [
    function (session, args) {
		session.replaceDialog('Default-Fallback-Intent',args);
	}
]);

bot.dialog('Default-Fallback-Intent', [
    function (session, args) {
		//console.log('API.AI response in dialog:'+ JSON.stringify(args.result));		
		switch(session.privateConversationData[FallbackState]){
			case 1:
				session.send("I don't quite get you. " +
							 "\n\n Can you try saying that in a different way? I might be able to help you better.");
				break;
			case 2:
				session.send("Hmmm. I don't think I know that. " + 
				"\n\nCan you try saying it in a different way? ");
				break;
			case 3:
			case 4:
			case 5:
				session.privateConversationData[FallbackState] = 0;				
				var respCards = new builder.Message(session)
					.text("I don't understand that. Would you like to talk one of my Human Friends?")
					.suggestedActions(
						builder.SuggestedActions.create(
							session,[
								builder.CardAction.imBack(session, "Yes", "Yes"),
								builder.CardAction.imBack(session, "No", "Yes")
							]
						)
					);
				builder.Prompts.choice(session, respCards, "Yes|No", { maxRetries:MaxRetries_SingleMenu});				
				break;
			default:
				session.send("I don't quite get you. " +
							 "\n\n Can you try saying that in a different way? I might be able to help you better.");
				session.privateConversationData[FallbackState] = 0;
				break;
		}
    }
	,function(session, results) {
		switch (results.response.index) {
			case 0:	// Yes
				session.replaceDialog('Chat-Complain');
				break;
			case 1:	// No
				session.send("Alright. Can I help you with anything else?");
				break;
			default:
				break;
		}			
		session.endDialog();
    }
]);

bot.dialog('Chat-Complain', [
    function (session) {
		session.send("I'm a little stumpe here. Maybe you can consider talking to my Human Friends. You can reach the through any of the methods below:\n\n" 
					 + "* Talk to us on Twitter : https://twitter.com/mydigi \n\n"
					 + "* Call us at the Digi Helpline: \n\n 016-2211-800");	
	}
]);

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
					" \n\n APPINSIGHTS_INSTRUMENTATIONKEY:" + process.env.APPINSIGHTS_INSTRUMENTATIONKEY +
					" \n\n OFFLINE:" + process.env.OFFLINE +
					" \n\n DEVELOPMENT:" + process.env.DEVELOPMENT +
					" \n\n APIAI_CLIENT_ACCESS_TOKEN:" + process.env.APIAI_CLIENT_ACCESS_TOKEN +
					" \n\n APIAI_ERROR_TIMEOUT:" + process.env.APIAI_ERROR_TIMEOUT);
	}
]).triggerAction({
    matches: /^(printEnv)$/
});

bot.dialog('CatchAll', [
    function (session) {
		// Reset any conversation state
		session.privateConversationData[PlanRecommendState] = 0;
		
		if (apiai_error_timeout < Date.now()) {
			apiai_error_timeout = 0;	// Reset timeout if prevously set to some value
						
			// send the request to API.ai
			var request = apiai_app.textRequest(session.message.text, {
				sessionId: session.message.address.conversation.id
			});
			request.end();

			request.on('response', function(response) {
				if(response.result.action==undefined){
					session.send("Let's get back to our chat on Digi");
				} else {		// We have response from API.AI
					console.log("API.AI [" +response.result.resolvedQuery + '][' + response.result.action + '][' + response.result.score + ']['  + response.result.fulfillment.speech + '][' + response.result.metadata.intentName + ']');
						//console.log('API.AI response text:'+ response.result.fulfillment.speech);
						console.log('API.AI response:'+ JSON.stringify(response.result));

					// Flow when API.ai returns
					// 1) Try to call the intent & pass the JSON to the intent 
					// 2) If intent not exist, check if there is fulfillment speech and display that default speech
					// 3) If fulfillment speech does not exist, display default "Let's get back to our chat on Digi" 
					try {						
						switch (response.result.metadata.intentName) {
							case 'Default-Unknown':
							case 'Default-Fallback-Intent':
							case 'Roaming-General':
								session.privateConversationData[FallbackState]++;
								break;
							default:
								session.privateConversationData[FallbackState] = 0;
								break;
						}
						session.replaceDialog(response.result.metadata.intentName, response);
						return;
					} catch (e) {
						console.log("Fallback due to Unknown API.ai Intent [" + response.result.metadata.intentName + ']');
						if(response.result.fulfillment.speech.length>0) {
							session.send(response.result.fulfillment.speech);

							// Check out Quick Replies for Facebook
							var jsonobject = response.result.fulfillment.messages.filter(value=> {return value.type==2 &&
																							value.platform=='facebook'})[0];
							if(jsonobject) {
								if(jsonobject.replies.length == 1){
									var respCards = new builder.Message(session)
										.text(jsonobject.title)
										.suggestedActions(
											builder.SuggestedActions.create(
												session,[
													builder.CardAction.imBack(session, jsonobject.replies[0], jsonobject.replies[0])
												]
											)
										);
									session.send(respCards);
								} else if(jsonobject.replies.length == 2){
									var respCards = new builder.Message(session)
										.text(jsonobject.title)
										.suggestedActions(
											builder.SuggestedActions.create(
												session,[
													builder.CardAction.imBack(session, jsonobject.replies[0], jsonobject.replies[0]),
													builder.CardAction.imBack(session, jsonobject.replies[1], jsonobject.replies[1])
												]
											)
										);
									session.send(respCards);
								} else if(jsonobject.replies.length > 2){
									var respCards = new builder.Message(session)
										.text(jsonobject.title)
										.suggestedActions(
											builder.SuggestedActions.create(
												session,[
													builder.CardAction.imBack(session, jsonobject.replies[0], jsonobject.replies[0]),
													builder.CardAction.imBack(session, jsonobject.replies[1], jsonobject.replies[1]),
													builder.CardAction.imBack(session, jsonobject.replies[2], jsonobject.replies[2])
												]
											)
										);
									session.send(respCards);
								}
							}
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





