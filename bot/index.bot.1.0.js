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

]).set('autoBatchDelay',1000);
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

    var options = {
        method: 'POST',
        url: process.env.CHATBOT_LOG_URL,
        qs: {       action: 'json' },
        headers: {  'content-type': 'multipart/form-data'   },
        formData: { 
            data: '{\
"command": "update_chat_log",\
"auth_key": "' + process.env.CHATBOT_LOG_AUTH_KEY+ '",\
"chat_id": "'  + session.message.address.conversation.id+ '",\
"dialog_id": "'+ session.privateConversationData[DialogId]+ '",\
"dialog_state":"' + dialog_state + '",\
"dialog_type":"",\
"dialog_input":"",\
"chat_log": "'+session.privateConversationData[LastMenu]+'"}'
        }
    };

    if (process.env.LOGGING>0) {
        try{
            request(options, function (error, response, body) { // Send to DB if this is Production Environment
                if (process.env.DEVELOPMENT) {
                    //console.log("DB Log:" + body);              // Log if this is Production & Development Mode
                }
            })
        } catch (e) {
            if (process.env.DEVELOPMENT) {
                //console.log("cannot log to DB");                // Log if this is Production &Development Environment
            }
        }
    } else {
        console.log("Logging : " + options.formData.data);  // Log if this is Staging Environment
    }
}

const logUserConversation = (event) => { console.log('message: ' + event.text + ', user: ' + event.address.user.name);
};
// Middleware for logging
bot.use({
    receive: function (event, next) {
        logUserConversation(event);
        next();
//    },
//    send: function (event, next) {
//        logUserConversation(event);
//        next();
    }
});

// R - menu
bot.dialog('intro', [
    function (session) {
        // Initialize Session Data
        session.privateConversationData[NumOfFeedback] = 0;
        session.privateConversationData[DialogId] = session.message.address.id;

        trackBotEvent(session, 'intro', 0);
        
        session.send("Hello, I'm Yello! Nice to meet you. I'm here 9pm-12am every day to help you on all things Digi.");
        session.send("I'm continuously learning to serve you better, so please be patient with me");

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .text('You can ask me anything about Digi\'s products.')
                .buttons([
                    builder.CardAction.imBack(session, "Let's get started", "Let's get started"),
                    builder.CardAction.imBack(session, "Contact our Customer Service", "Contact our Customer Service")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt);
        session.replaceDialog('menu');
    }
]);

//// R - menu
//bot.dialog('menu', [
//    function (session) {
//        
//        if(session.privateConversationData[NumOfFeedback]>2)    // Get Feedback every 2nd transaction
//        {
//            session.privateConversationData[NumOfFeedback] = 0;
//            session.replaceDialog('getFeedback');
//        } else {
//            session.privateConversationData[NumOfFeedback]++;
//            session.replaceDialog('menu2');            
//        }
//    }
//]).triggerAction({
//    matches: /^(main menu)|(menu)|(begin)|(Let\'s get started)$/i
//});

bot.dialog('byemenu', [
    function (session) {
        session.send("Bye for now.");
        session.send("Thanks for using Yello");
        session.send("You can always press \"Main Menu\" button above to start over");
            }
]).triggerAction({
    matches: /^(exit)|(quit)|(depart)|(bye)|(goodbye)$/i
});


bot.dialog('ContactCustomerService', [
    function (session) {
		
		var now = new Date();

		if(now.getHours()>9 && now.getHours()<21) {         //between 9pm-12pm
			session.send('Digi Live Chat service is available from 10am to 9pm.');
			var respCards = new builder.Message(session)
				.attachmentLayout(builder.AttachmentLayout.carousel)
				.attachments([
					new builder.HeroCard(session)
					.text('You can also reach Digi via our Community website or e-mail us at help@digi.com.my')
					.buttons([
						builder.CardAction.openUrl(session, 'https://community.digi.com.my/', 'Digi Community Website'),
						builder.CardAction.openUrl(session, 'http://new.digi.com.my/webchat', 'Digi Live Chat')
					])
				]);

		} else {	// outside LiveChat hours
			session.send('Digi Live Chat service will available from 10am to 9pm.');
			var respCards = new builder.Message(session)
				.attachmentLayout(builder.AttachmentLayout.carousel)
				.attachments([
					new builder.HeroCard(session)
					.text('However you can reach Digi via our Community website or e-mail us at help@digi.com.my')
					.buttons([
						builder.CardAction.openUrl(session, 'https://community.digi.com.my/', 'Digi Community Website')
					])
				]);
		}
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.replaceDialog('menu');
    }		
]).triggerAction({
    matches: /.*(Customer Service).*|.*(email).*/i
});

//bot.dialog('Feedback', [
//    function (session) {
//        var respCards = new builder.Message(session)
//            .attachmentLayout(builder.AttachmentLayout.carousel)
//            .attachments([
//                new builder.HeroCard(session)
//                .title('Feedback Form (Internal Testing use only)')
//                .subtitle('Thanks for your participation. We would appreciate your feedback')
//                .buttons([
//                    builder.CardAction.openUrl(session, 'https://goo.gl/forms/giIkIYVHLxL8l2ob2', 'My Feedback')
//                ])
//            ]);
//        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle: builder.ListStyle.button });
//    },
//    function (session, results) {
//        session.replaceDialog('menu');
//    },
//]).triggerAction({
//    matches: /^(Feedback)$/i
//});


// R - menu
bot.dialog('menu', [
    function (session) {
        trackBotEvent(session, 'menu', 0);
        
        // Store new unique ID for this conversation's Dialog
        session.privateConversationData[DialogId] = session.message.address.id;
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .text('Just click on any of the below and let\'s get started.')
                .buttons([
                    builder.CardAction.imBack(session, "Prepaid", "Prepaid"),
                    builder.CardAction.imBack(session, "Postpaid", "Postpaid"),
                    builder.CardAction.imBack(session, "Broadband", "Broadband"),
                    builder.CardAction.imBack(session, "Roaming", "Roaming"),
                    builder.CardAction.imBack(session, "Other Questions", "Other Questions")
                ])])
		;

		session.send(respCards);
        var respCards = new builder.Message(session)
            .text("Just click on any of the below and let\'s get started.")
            .suggestedActions(
                builder.SuggestedActions.create(
                    session,[
                        builder.CardAction.imBack(session, "Prepaid", "Prepaid"),
                        builder.CardAction.imBack(session, "Postpaid", "Postpaid"),
                        builder.CardAction.imBack(session, "Broadband", "Broadband"),
                        builder.CardAction.imBack(session, "Roaming", "Roaming"),
                        builder.CardAction.imBack(session, "Other Questions", "Other Questions")
                    ]
                )
            );
		session.send(respCards);
	}
//        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
//    },
//    function (session, results) {
//        session.send(DefaultMaxRetryErrorPrompt);
//        session.replaceDialog('menu');
//    }
]).triggerAction({
    matches: /^(main menu)|(menu)|(begin)|(Let\'s get started)$/i
});

// R.0 - menu|Prepaid
bot.dialog('Prepaid', [
    function (session) {
        trackBotEvent(session, 'menu|Prepaid',1);
        
        session.send("What would you like to find out today?");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('The Best Prepaid Plans')
                .subtitle('Digi Prepaid Live & Digi Prepaid Best Plans\n')
                .images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Plans.jpg') ])
                .buttons([
                    builder.CardAction.imBack(session, "Prepaid Plans", "More")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),

                new builder.HeroCard(session)
                .title('Add On')
                .subtitle('Get extra data or voice mins from RM1')
                .images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Addons.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-addons', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                        
                new builder.HeroCard(session)
                .title('Reload')
                .subtitle('Top up your credit with credit card')
                .images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Reload.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/reload-details.ep', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /(Prepaid)|.*(reload).*|.*(add on).*|.*(addon).*/i
});

// R.0.0 - menu|Prepaid|PrepaidPlans
bot.dialog('PrepaidPlans', [
    function (session) {
        trackBotEvent(session, 'menu|Prepaid|PrepaidPlans',1);

        session.send("Here are our plans");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Digi Prepaid Live')
                .subtitle('RM 12 (incl. GST). Preloaded with RM8 & 300MB Internet for 7 days. Pack validity:5 days')
                .images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Live.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=20016&isBundle=n&ppymttype=PREPAID&ptype=VOICE&orderType=NL&_ga=1.167919842.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid/live', 'More Info')
                ]),
                new builder.HeroCard(session)
                .title('Digi Prepaid Best')
                .subtitle('RM 8 (incl. GST). Preloaded with RM 5 & 300MB Internet for 7 days. Pack validity: 10 days')
                .images([ builder.CardImage.create(session, imagedir + '/images/Prepaid-Best.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=20015&isBundle=n&ppymttype=PREPAID&ptype=VOICE&orderType=NL&_ga=1.94994527.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-plans', 'More Info')
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Prepaid Plans).*|.*(prepaid live).*|.*(prepaid best).*/i
});


// R.1 - menu|Postpaid
bot.dialog('Postpaid', [
    function (session) {
        trackBotEvent(session, 'menu|Postpaid',1);
        
        session.send("How can I help with your Postpaid plan?");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Digi Postpaid')
                .subtitle('Explore your plan options')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-Plans.jpg') ])
                .buttons([
                    builder.CardAction.imBack(session, "Postpaid Plans", "More")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),

                new builder.HeroCard(session)
                .title('Extras')
                .subtitle('All the extras to stay connected')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-Extra.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/postpaid-addons#Internet-Top-Up', 'Internet Topup'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/postpaid-addons#Freemium', 'Freemium'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/postpaid-addons#Premium', 'Premium')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /(Postpaid)|.*(postpaid extra).*/i
});

// R.1.0 - menu|Postpaid|PostpaidPlans
bot.dialog('PostpaidPlans', [
    function (session) {
        trackBotEvent(session, 'menu|Postpaid|PostpaidPlans',1);

        session.send("Here are our plans");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Digi Postpaid 150 Infinite')
                .subtitle('No caps on everything from Internet, Calls and Tethering')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-Infinite.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=DGI150&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=NL&_ga=1.164776316.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=DGI150&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=MNP&_ga=1.164776316.2103412470.1490767162', 'Port In'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=DGI150&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=COP&_ga=1.238199557.426176229.1488446290', 'Change from Prepaid'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/services/change-of-mobile-plans?changePlanName=Digi%20Postpaid%20150%20Infinite', 'Change from Postpaid')
                ]),
                new builder.HeroCard(session)
                .title('Digi Postpaid 50')
                .subtitle('RM50/month for 10GB Internet, 5GB Weekend Internet & 100 mins calls to all network')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-50.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10201VPA&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=NL&_ga=1.239507461.769883286.1492574194', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10201VPA&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=MNP&_ga=1.155287800.2103412470.1490767162', 'Port In'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10201VPA&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&_ga=1.64925487.1200425632.1479720347Postpaid&orderType=COP', 'Change from Prepaid'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/services/change-of-mobile-plans?changePlanName=Digi%20Postpaid%2050', 'Change from Postpaid')
                ]),
                new builder.HeroCard(session)
                .title('Digi Postpaid 80')
                .subtitle('RM80/month for 20GB Internet, 10GB Weekend Internet & unlimited calls to all network')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-80.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10200VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=NL&_ga=1.65621101.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10200VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=MNP&_ga=1.92479582.2103412470.1490767162', 'Port In'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10200VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=COP', 'Change from Prepaid'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/services/change-of-mobile-plans?changePlanName=Digi%20Postpaid%2080', 'Change from Postpaid')
                ]),
                new builder.HeroCard(session)
                .title('Digi Postpaid 110')
                .subtitle('RM110/month for 25GB Internet, UNLIMITED Weekend Internet & unlimited calls to all network')
                .images([ builder.CardImage.create(session, imagedir + '/images/Postpaid-110.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10202VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=NL&_ga=1.92479582.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10202VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=MNP&_ga=1.94988767.2103412470.1490767162', 'Port In'),
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=10202VP_EX&isBundle=y&ppymttype=POSTPAID&ptype=VOICE&orderType=COP', 'Change from Prepaid'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/services/change-of-mobile-plans?changePlanName=Digi%20Postpaid%20110', 'Change from Postpaid')
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Postpaid Plans).*|(infinite).*|.*(postpaid 110).*|.*(postpaid 50)|.*(postpaid 80).*|.*(latest).*|.*(recommended).*/i
});


// R.2 - menu|Broadband
bot.dialog('Broadband', [
    function (session) {
        trackBotEvent(session, 'menu|Broadband',1);
        
        session.send("Don't you just love the non-stop entertainment Broadband offers?");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Digi Broadband Plans')
                .text('Find your right plan')
                .images([ builder.CardImage.create(session, imagedir + '/images/Broadband-Plans.jpg') ])

                .buttons([
                    builder.CardAction.imBack(session, "Broadband Plans", "More")
                ]),
                new builder.HeroCard(session)
                .title('Running low on quota?')
                .text('Get more quota now!')
                .images([ builder.CardImage.create(session, imagedir + '/images/Broadband-LowQuota.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband-home-portal', 'More')
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /(Broadband)/i
});

// R.1.0 - menu|Broadband|BroadbandPlans
bot.dialog('BroadbandPlans', [
    function (session) {
        trackBotEvent(session, 'menu|Broadband|BroadbandPlans',1);

        session.send("Here are our plans");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Broadband 30')
                .subtitle('Get started for only RM38 (incl. GST) for a starter pack for only RM30 preload value')
                .images([ builder.CardImage.create(session, imagedir + '/images/Broadband-30.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=20017&isBundle=n&ppymttype=PREPAID&ptype=BB&_ga=1.55846120.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'More Info')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Broadband 60')
                .subtitle('Sign up for the postpaid broadband plan online or at the nearest Digi Store!')
                .images([ builder.CardImage.create(session, imagedir + '/images/Broadband-60.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=90000P&isBundle=y&ppymttype=POSTPAID&ptype=BB&_ga=1.55846120.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'More Info')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Broadband 100')
                .subtitle('Sign up for a postpaid broadband plan for more value')
                .images([ builder.CardImage.create(session, imagedir + '/images/Broadband-100.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'https://store.digi.com.my/storefront/product-config.ep?pID=90001P&isBundle=y&ppymttype=POSTPAID&ptype=BB&_ga=1.156903800.2103412470.1490767162', 'Buy Now'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/broadband', 'More Info')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Broadband Plans).*|.*(broadband 30).*|.*(broadband 60).*|.*(broadband 100).*/i
});


// R.3 - menu|Roaming
bot.dialog('Roaming', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming',1);
        
        session.send("What would you like to find out today?");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Roaming Plans')
                .text('Check out your roaming options')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Plan.jpg') ])
                .buttons([
                    builder.CardAction.imBack(session, "Roaming Plans", "More")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Roam by country')
                .text("Just let us know where you're off to")
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Country.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/international-roaming-rates', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Roaming Tips')
                .text("Here's all you need to know to stay connected")
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Tips.jpg') ])
                .buttons([
                    builder.CardAction.imBack(session, "Roaming Tips", "More")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('IDD Rates')
                .text("International calls and SMS rates")
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Rates.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/international-calls-sms-rates', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('IDD 133')
                .text('Did you know we offer the lowest IDD rates to 36 countries?')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-133.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/idd-133', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /(Roaming)|.*(roam).*|.*(idd).*|.*(133).*|.*(overseas).*|.*(travel).*/i
});

// R.3.0 - menu|Roaming|RoamingPlans
bot.dialog('RoamingPlans', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingPlans',1);

        session.send("You can roam with the following options");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Roam Like Home')
                .subtitle('Some of our postpaid plans allow you to roam for free')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-LikeHome.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/roam-like-home-monthly', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Roaming Pass')
                .subtitle('Round-the-clock chatting & surfing in 50 countries')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Pass.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/roaming-pass', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Unlimited Internet')
                .subtitle('Enjoy a hassle free roaming experience!')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-UnlimitedInternet.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/roaming/unlimited-internet', 'More')
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Roaming Plans).*|.*(roam like home).*|.*(roam pass).*/i
});

// R.3.1 - menu|Roaming|RoamingTips
bot.dialog('RoamingTips', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips',1);

        session.send("Let's get ready to roam");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Activate Roaming Services')
                .text('How long have you been with Digi? (in months)')
                .buttons([
                    builder.CardAction.imBack(session, "Less than 6", "Less than 6"),
                    builder.CardAction.imBack(session, "More than 6", "More than 6")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Turn on/off data roaming')
                .subtitle("What is your phone's operating system?")
                .buttons([
                    builder.CardAction.imBack(session, "iOS Data Roaming", "iOS"),
                    builder.CardAction.imBack(session, "Android Data Roaming", "Android")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Purchase / subscribe to Roam Pass')
                .text('Roam Passes are the way to go')
                .buttons([
                    builder.CardAction.imBack(session, "Roaming Pass", "Roaming Pass")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ]),
                new builder.HeroCard(session)
                .title('Usage Tracking')
                .text('You can track your usage while you roam using the following')
                .buttons([
                    builder.CardAction.imBack(session, "MyDigi Roam Usage Tracking", "MyDigi Roam Usage Tracking"),
                    builder.CardAction.imBack(session, "UMB Roam Usage Tracking", "UMB Roam Usage Tracking")
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Roaming Tips).*|.*(data roaming).*/i
});

// R.3.1.0 - menu|Roaming|RoamingTips|ActivateRoamingOver6Months
bot.dialog('ActivateRoamingOver6Months', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|ActivateRoamingOver6Months',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Self-activate at MyDigi:')
                .text('Go to Plan Settings >\
                \n\n My Subscription >\
                \n\n International Roaming >\
                \n\n click \"Subscribe\" >')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Activate-Over6Months.png') ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(More than 6).*/i
});

// R.3.1.1 - menu|Roaming|RoamingTips|ActivateRoamingBelow6Months
bot.dialog('ActivateRoamingBelow6Months', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|ActivateRoamingBelow6Months',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Walk in to a Digi Store ')
                .text('Please provide us with (1)Photocopy of NRIC (2)Valid Passport (3)Work permit(for non-Malaysian)')
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Less than 6).*/i
});

// R.3.1.2 - menu|Roaming|RoamingTips|iOSDataRoaming
bot.dialog('iOSDataRoaming', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|iOSDataRoaming',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('iOS Turn on/off data roaming')
                .text('Go to Settings > Mobile Data > Mobile Data Options > slide the "Data Roaming" ON/OFF')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Activate-iOS.png') ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(iOS Data Roaming).*/i
});

// R.3.1.3 - menu|Roaming|RoamingTips|AndroidDataRoaming
bot.dialog('AndroidDataRoaming', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|AndroidDataRoaming',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Android Turn on/off data roaming')
                .text('Go to Settings > Mobile networks > slide the "Data Roaming" ON/OFF')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-Activate-Android.png') ])
//                .buttons([
//                    builder.CardAction.imBack(session, "Main Menu", "Main Menu")
//                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Android Data Roaming).*/i
});

// R.3.1.4 - menu|Roaming|RoamingTips|SubscribeRoamingPass
bot.dialog('SubscribeRoamingPass', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|SubscribeRoamingPass',1);

        session.send("Upon Arrival, follow these Steps");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .images([ builder.CardImage.create(session, imagedir + '/images/RRoaming-Pass-Step1.png') ])
                .subtitle('Upon arrival, dial *128*5*1*6# and then Press "2" to "Purchase Roaming Top Up"'),
                new builder.HeroCard(session)
                .title('Step 2')
                .images([ builder.CardImage.create(session, imagedir + '/images/RRoaming-Pass-Step23.png') ])
                .subtitle("You'll receive a confirmation SMS to notify you of successful Roaming Pass purchase"),
                new builder.HeroCard(session)
                .title('Step 3')
                .images([ builder.CardImage.create(session, imagedir + '/images/RRoaming-Pass-Step23.png') ])
                .subtitle('Please manually select the specified/applicable network operator'),
                new builder.HeroCard(session)
                .title('Step 4')
                .images([ builder.CardImage.create(session, imagedir + '/images/RRoaming-Pass-Step4.png') ])
                .subtitle('Turn on Data Roaming or Cellular Data/Mobile Data on your mobile phone and you\'re ready to roam!')
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Roaming Pass).*|.*(roam pass).*/i
});

// R.3.1.5 - menu|Roaming|RoamingTips|MyDigiCheckRoamUsage
bot.dialog('MyDigiCheckRoamUsage', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|MyDigiCheckRoamUsage',1);

        session.send("You can follow the steps below");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On usage page, select "View Details"')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step1.png') ]),
                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Select "Internet" for Internet quota balance')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step2.png') ]),
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Select "Voice" for Voice minutes balance')
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-MyDigi-Step3.png') ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(MyDigi Roam Usage Tracking).*|.*(roam usage).*|.*(overseas usage).*/i
});

// R.3.1.6 - menu|Roaming|RoamingTips|UmbCheckRoamUsage
bot.dialog('UmbCheckRoamUsage', [
    function (session) {
        trackBotEvent(session, 'menu|Roaming|RoamingTips|UmbCheckRoamUsage',1);

        session.send("You can follow the steps below");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-UMB-Step1.png') ])
                .title('Step 1')
                .subtitle('In UMB: Dial *128*5*1*6#'),
                new builder.HeroCard(session)
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-UMB-Step2.png') ])
                .title('Step 2')
                .subtitle('Select 3 for voice minutes balance'),
                new builder.HeroCard(session)
                .images([ builder.CardImage.create(session, imagedir + '/images/Roaming-UMB-Step3.png') ])
                .title('Step 3')
                .subtitle('View your balance')
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(UMB Roam Usage Tracking).*|.*(umb check roaming).*/i
});


// R.4 - menu|OtherQuestions
bot.dialog('OtherQuestions', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions',1);
        
        session.send("Got a question on your account / bills or other services?");
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('All About My Account')
                .text('We have the answers to the most asked questions on managing your account')
                .buttons([
                    builder.CardAction.imBack(session, "About My Account", "Really?")
                ]),

                new builder.HeroCard(session)
                .title('MyDigi App')
                .text('An app to manage all your account needs. Find out how to use it. It\'s really easy!')
                .buttons([
                    builder.CardAction.imBack(session, "MyDigi App", "Ready?")
                ]),
                        
                new builder.HeroCard(session)
                .title('Talk Time Services')
                .text('Did you know you can request from or give prepaid credit to others?')
                .buttons([
                    builder.CardAction.imBack(session, "Talk Time Services", "Tell me how")
                ]),

                new builder.HeroCard(session)
                .title('Charges / Billing')
                .text('Got questions on your bills?')
                .buttons([
                    builder.CardAction.imBack(session, "Charges Billing", "Let me help")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});        
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Frequently Asked Questions).*|.*(faq).*|.*(other question).*/i
});

// R.4.0 - menu|OtherQuestions|AllAboutMyAccount
bot.dialog('AllAboutMyAccount', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title("All About My Accounts")
                .buttons([
                    builder.CardAction.imBack(session, "How to get my acc no", "How to get my acc no?"),
                    builder.CardAction.imBack(session, "What is my PUK code", "What is my PUK code?"),
//                    builder.CardAction.imBack(session, "PUK2", "What is my PUK code(2)?"),
                    builder.CardAction.imBack(session, "How to change my account ownership", "How to change my account ownership?"),
                    builder.CardAction.imBack(session, "How to check Friends & Family", "How to check Friends & Family?"),
                    builder.CardAction.imBack(session, "How to add Friends & Family", "How to add Friends & Family?"),
//                    builder.CardAction.imBack(session, "Account:Next Page", "Next Page")
                ]),
                new builder.HeroCard(session)
                .title("All About My Accounts")
                .buttons([
                    builder.CardAction.imBack(session, "I\'m going overseas", "I\'m going overseas, what can I do?"),
                    builder.CardAction.imBack(session, "How do I activate VoLTE", "How do I activate VoLTE?"),
                    builder.CardAction.imBack(session, "How do I port-in", "How do I port-in?")
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt);
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(About My Account).*/i
});

// R.4.0.0 - menu|OtherQuestions|AllAboutMyAccount|GetAccountNo
bot.dialog('GetAccountNo', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|GetAccountNo',1);

        var respCards = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                .text('Your account number is available on your bill at the top right hand corner. Eg: 1.356XXXX')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-Account-No.png') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Account No).*|.*(Acc No).*|.*(How to get my acc no).*/i
});

// R.4.0.1 - menu|OtherQuestions|AllAboutMyAccount|WhatIsMyPuk
bot.dialog('WhatIsMyPuk', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|WhatIsMyPuk',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On the MyDigi app, click on Menu')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on Settings')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step2.png') ]),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Swipe left to select SIM and you will find your PUK code')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step3.png') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(What Is My Puk).*|.*(What is my PUK code).*|.*(puk).*/i
});

bot.dialog('WhatIsMyPuk2', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|WhatIsMyPuk',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On the MyDigi app, click on Menu')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step1.png') ])
            ]);
        session.send(respCards);        

        var respCards = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on Settings')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step2.png') ])
            ]);
        session.send(respCards);        

		var respCards = new builder.Message(session)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Swipe left to select SIM and you will find your PUK code')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PUK-step3.png') ])
            ]);		
		builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]);

// R.4.0.2 - menu|OtherQuestions|AllAboutMyAccount|ChangeMyAccOwnership
bot.dialog('ChangeMyAccOwnership', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|ChangeMyAccOwnership',1);

        session.send("Change or transfer of ownership? Just head to the nearest Digi Store. Just a reminder - Both parties must be there with NRICs for validation, please.");

		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Change My Account Ownership).*|.*(acc ownership).*|.*(account ownership).*/i
});

// R.4.0.3 - menu|OtherQuestions|AllAboutMyAccount|CheckFnF
bot.dialog('CheckFnF', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|CheckFnF',1);

        session.send("It's literally as easy as 1,2,3.");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On the MyDigi app, click on Menu')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-CheckFnF-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on Settings')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-CheckFnF-step2.png') ]),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Swipe left to select \'Family & Friends\' to view your list')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-CheckFnF-step3.png') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Check FnF).*|.*(check Friends & Family).*|.*(How to check F&F).*|.*(friends and family).*|.*(friend and family).*|.*(friend family).*|.*(friends family).*/i
});

// R.4.0.5 - menu|OtherQuestions|AllAboutMyAccount|AddFnF
bot.dialog('AddFnF', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|AddFnF',1);

        session.send("I can help you with that. Here's how.");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On the MyDigi app, click on Menu.')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-AddFnF-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on Settings')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-AddFnF-step2.png') ]),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Swipe left to select \'Family & Friends\' to view your list')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-AddFnF-step3.png') ]),
                
                new builder.HeroCard(session)
                .title('Step 4')
                .subtitle('Click on + Key in the phone number')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-AddFnF-step4.png') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Add FnF).*|.*(Add Friends and Family).*|.*(How to add F&F).*|.*(Add Friends & Family).*/i
});

// R.4.0.6 - menu|OtherQuestions|AllAboutMyAccount2
bot.dialog('AllAboutMyAccount2', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount2',1);

        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title("All About My Accounts")
                .buttons([
                    builder.CardAction.imBack(session, "I\'m going overseas", "I\'m going overseas, what can I do?"),
                    builder.CardAction.imBack(session, "How do I activate VoLTE", "How do I activate VoLTE?"),
                    builder.CardAction.imBack(session, "How do I port-in", "How do I port-in?")
                ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Account:Next Page).*/i
});

// R.4.0.6.0 - menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|GoingOverseas
bot.dialog('GoingOverseas', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|GoingOverseas',1);

        builder.Prompts.choice(session, "For short holidays, stay in touch by activating Roaming Services", 'Roaming', { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.replaceDialog('Roaming');
    }
]).triggerAction({
    matches: /.*(Going Overseas).*|.*(Activate Roaming).*|.*(I\'m going overseas).*/i
});

// R.4.0.6.1 - menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToActivateVolte
bot.dialog('HowToActivateVolte', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToActivateVolte',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .subtitle("Let's check if your device is compatible. If you're sure it is, instructions for activation is right here.")
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/services/volte', 'Check'),
                    builder.CardAction.imBack(session, "VoLTE Activation", "Activation")
                ])
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-Activate-Volte.jpg') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(How to activate Volte).*|.*(How do I activate VoLTE).*|.*(volte).*/i
});

// R.4.0.6.1.0 - menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToActivateVolte|ActivateVolte
bot.dialog('ActivateVolte', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToActivateVolte|ActivateVolte',1);

        session.send("You can follow the steps below");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('Select \"Settings\"'),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Select \"Mobile Data\"'),

                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Tap on Mobile Data Options'),

                new builder.HeroCard(session)
                .title('Step 4')
                .subtitle('Select \"Enable 4G\"'),

                new builder.HeroCard(session)
                .title('Step 5')
                .subtitle('Choose Voice & Data to enable VoLTE')
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(VoLTE Activation).*/i
});

// R.4.0.6.2 - menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToPortIn
bot.dialog('HowToPortIn', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|AllAboutMyAccount|AllAboutMyAccount2|HowToPortIn',1);

        session.send("Here are a few ways to go about it");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Digi Website')
                .subtitle('Checkout our plans on Digi Website and once you\'ve found the right plan, select Port-in to proceed')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PortIn-Web.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/prepaid-plans', 'Prepaid'),
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/postpaid-plans', 'Postpaid')
                ]),
                new builder.HeroCard(session)
                .title('Digi Store')
                .subtitle('Just drop by the nearest Digi Store and we will take care of the rest for you')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PortIn-WalkToStore.jpg') ])
                .buttons([
                    builder.CardAction.openUrl(session, 'http://new.digi.com.my/support/digi-store', 'Store Locator')
                ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(How to Port in).*|.*(How do I port-in).*|.*(port in).*|.*(portin).*/i
});

// R.4.1 - menu|OtherQuestions|MyDigiApp
bot.dialog('MyDigiApp', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|MyDigiApp',1);        
        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .buttons([
                    builder.CardAction.imBack(session, 'How do I get started with MyDigi', 'How do I get started with MyDigi?'),
                    builder.CardAction.imBack(session, "How do I download my bill from MyDigi", "How do I download my bill from MyDigi?"),
                    builder.CardAction.imBack(session, "How do I make payment for another number via MyDigi", "How do I make payment for another number via MyDigi?")
                ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }        
]).triggerAction({
    matches: /.*(MyDigi App).*|.*(mydigi).*|.*(my digi).*/i
});

// R.4.1.0 - menu|OtherQuestions|MyDigiApp|GetStartedMyDigi
bot.dialog('GetStartedMyDigi', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|MyDigiApp|GetStartedMyDigi',1);

        session.send("You can follow the steps below");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('Checkout our plans on Digi Website and once you\'ve found the right plan, select Port-in to proceed')
                .buttons([
                    builder.CardAction.openUrl(session, 'http://appurl.io/j1801ncp', 'Download MyDigi'),
                ]),
                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Sign in to the app using a Connect ID or proceed with your number. Make sure to turn on your data or this may not work!')
                .buttons([
                    builder.CardAction.openUrl(session, 'http://appurl.io/j1801ncp', 'Download MyDigi'),
                ])
            ]);
        builder.Prompts.choice(session, respCards, AnyResponse, { listStyle:builder.ListStyle.button, maxRetries:MaxRetries_SingleMenu, retryPrompt:DefaultErrorPrompt});
    },
    function (session, results) {
        session.send(DefaultMaxRetryErrorPrompt)
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /.*(Get Started with MyDigi).*|.*(How do I get started with MyDigi).*/i
});

// R.4.1.1 - menu|OtherQuestions|MyDigiApp|DownloadBillFrMyDigi
bot.dialog('DownloadBillFrMyDigi', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|MyDigiApp|DownloadBillFrMyDigi',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('Click on View Details')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-DownloadBill-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on \'Download Bills\' just below the total charges')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-DownloadBill-step2.png') ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }        
]).triggerAction({
    matches: /.*(Download Bill).*|.*(download my bill).*/i
});

// R.4.1.1.0 - menu|OtherQuestions|MyDigiApp|DownloadBillFrMyDigi|SeeBillsForPastSixMonths
bot.dialog('SeeBillsForPastSixMonths', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|MyDigiApp|DownloadBillFrMyDigi|SeeBillsForPastSixMonths',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('Click on the Menu Button'),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Click on Bills'),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Click on \'More\' icon at the top right corner'),
                    
                new builder.HeroCard(session)
                .title('Step 4')
                .subtitle('Click on \'Previous Bills\''),

                new builder.HeroCard(session)
                .title('Step 5')
                .subtitle('You can view & download your bills for the last 6 months')
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Bills for past 6 months).*|.*(previous bill).*|.*(past bill).*/i
});

// R.4.1.2 - menu|OtherQuestions|MyDigiApp|PayForAnotherNumber
bot.dialog('PayForAnotherNumber', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|MyDigiApp|PayForAnotherNumber',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('On the MyDigi app, click on Menu.')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PayForAnother-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('See \'Digi Share\'? Click on it.')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PayForAnother-step2.png') ]),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('Click on \'Add a number to share\'')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PayForAnother-step3.png') ]),
                    
                new builder.HeroCard(session)
                .title('Step 4')
                .subtitle('Enter the Name and Mobile Number. Then click on Save.')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PayForAnother-step4.png') ]),

                new builder.HeroCard(session)
                .title('Step 5')
                .subtitle("Select the name of the person you would like to make payment for, key in the amount and email address. Then click on Pay Bill. That's it - all done!")
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-PayForAnother-step5.png') ]),
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Pay For Another Number).*|.*(make payment for another via MyDigi).*|.*(make payment for another number).*/i
});

// R.4.2 - menu|OtherQuestions|TalkTimeServices
bot.dialog('TalkTimeServices', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|TalkTimeServices',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .buttons([
                    builder.CardAction.imBack(session, 'How do I do a talk-time transfer','How do I do a talk-time transfer?')
                ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Talk Time Services).*/i
});

// R.4.2.0 - menu|OtherQuestions|TalkTimeServices|TalkTimeTransfer
bot.dialog('TalkTimeTransfer', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|TalkTimeTransfer',1);

        session.send("You can follow the steps below");        
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
                .title('Step 1')
                .subtitle('Dial *128# from your Digi mobile, then select My Account. From the menu, select Talktime Service')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-TalkTimeTransfer-step1.png') ]),

                new builder.HeroCard(session)
                .title('Step 2')
                .subtitle('Reply 1 to select Talktime Transfer, and then choose a transfer option. Key in the Digi mobile number you wish to send Prepaid credit to and select CALL/SEND')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-TalkTimeTransfer-step2.png') ]),
                        
                new builder.HeroCard(session)
                .title('Step 3')
                .subtitle('You will receive a confirmation text message upon successful transaction')
                .images([ builder.CardImage.create(session, imagedir + '/images/FAQ-TalkTimeTransfer-step3.png') ]),
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Talk Time Transfer).*|.*(How do I do a talk-time transfer).*|.*(?=.*\btalk\b)(?=.*\btalk\b)(?=.*\btransfer\b).*$/i
});

// R.4.3 - menu|OtherQuestions|ChargesOrBilling
bot.dialog('ChargesOrBilling', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|ChargesOrBilling',1);

        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Charges / Billing")
                .buttons([
                    builder.CardAction.imBack(session, 'Will I be charged for calling 1300 1800 numbers', 'Will I be charged for calling 1300/1800 numbers?'),
                    builder.CardAction.imBack(session, 'Why is there an RM10 charge for my Buddyz', 'Why is there an RM10 charge for my Buddyz?'),
                    builder.CardAction.imBack(session, 'Can I change my billing cycle', 'Can I change my billing cycle?')
                ])
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Charges Billing).*|.*(billing).*|.*(charges).*|.*(1800).*/i
});

// R.4.3.0 - menu|OtherQuestions|ChargesOrBilling|ChargeForCallingTollFree
bot.dialog('ChargeForCallingTollFree', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|ChargesOrBilling|ChargeForCallingTollFree',1);

        session.send("Yes. For peak hour 7am to 6.59pm is RM0.30 per min and off peak 7pm to 6.59am is only RM0.15 per min");
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Charge for calling toll free).*|.*(calling tollfree).*|.*(Will I be charged for calling 1300 1800 numbers).*/i
});

// R.4.3.1 - menu|OtherQuestions|ChargesOrBilling|ChargeForBuddyz
bot.dialog('ChargeForBuddyz', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|ChargesOrBilling|ChargeForBuddyz',1);

		session.send("You can register up to three (3) Buddyz™ (Digi numbers), free of charge and change them at any time. RM10.00 will be charged for each change of number.");
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Charge For Buddyz).*|.*(Why is there an RM10 charge for my Buddyz).*|.*(buddyz).*/i
});

// R.4.3.0 - menu|OtherQuestions|ChargesOrBilling|ChangeBillingCycle
bot.dialog('ChangeBillingCycle', [
    function (session) {
        trackBotEvent(session, 'menu|OtherQuestions|ChargesOrBilling|ChangeBillingCycle',1);

        session.send("I'm afraid you can't change your billing cycle.");
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
    matches: /.*(Change Billing Cycle).*|.*(Can I change my billing cycle).*|.*(bill cycle).*/i
});


// R.MyDigi.Intro
bot.dialog('MyDigiIntro', [
    function (session) {
        trackBotEvent(session, 'menu|MyDigi|Intro',1);

        session.send("When you start MyDigi, you will see these screens on your current usages");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Screen 1/4")
				.text("This page shows Balance(Prepaid plan) or Billed amount (Postpaid plan)")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Intro-Page1.png') ])

                ,new builder.HeroCard(session)
				.title("Screen 2/4")
				.text("This page Shows total Internet quota available. Click on “View Details” to see all quota")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Intro-Page2.png') ])
//                .CardAction.imBack(session, 'Internet Quota Details', 'View Details')
				
                ,new builder.HeroCard(session)
				.title("Screen 3/4")
				.text("Shows total voice quota available with your plan. If balance is 0, normal call rates apply")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Intro-Page3.png') ])

                ,new builder.HeroCard(session)
				.title("Screen 4/4")
				.text("Shows total SMS available with your plan. If balance is 0, SMS rates apply")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Intro-Page4.png') ])
				
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
	// Match question with 2 words in any order: 	MyDigi + intro		MyDigi + Start 
    matches: /^(?=.*\bmydigi\b)(?=.*\bintro\b)|(?=.*\bmydigi\b)(?=.*\bstart\b).*$/i
});

// R.MyDigi.Intro
bot.dialog('MyDigiNotification', [
    function (session) {
        trackBotEvent(session, 'menu|MyDigi|Notification',1);

        session.send("Notifications will be sent when Freebies redeemed OR Prepaid credit balance low (<RM2) OR Prepaid validity expired OR Postpaid bill past due. Here is how you can view your notification");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1")
				.text("At MyDigi app, click on bell icon to open notifications tab ")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Notification-Page1.png') ])

                ,new builder.HeroCard(session)
				.title("Step 2")
				.text("To close the notification tab, click on bell icon or swipe to the right")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Notification-Page2.png') ])
				
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
	// Match question with 2 words in any order: 	MyDigi + intro		MyDigi + Start 
    matches: /^(notification)|(?=.*\bmydigi\b)(?=.*\balert\b).*$/i
});

// R.MyDigi.Intro
bot.dialog('MyDigiBillPayment', [
    function (session) {
        trackBotEvent(session, 'menu|MyDigi|BillPayment',1);

        session.send("For Postpaid users, here is how you can make Bill Payment using MyDigi");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1 of 3")
				.text("At MyDigi app, click on Pay Bill")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Bill-Payment-Page1.png') ])

                ,new builder.HeroCard(session)
				.title("Step 2 of 3")
				.text("On this page, enter the amount you want to pay, email address and the press Pay Bill")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Bill-Payment-Page234.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 3 of 3")
				.text("We will then bring you to payment page. Fill in payment details to complete the payment")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Bill-Payment-Page5.png') ])
				
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
	// Match question with 2 words in any order: 	MyDigi + intro		MyDigi + Start 
    matches: /^(bill)|(?=.*\bmydigi\b)(?=.*\bbill\b).*$|(?=.*\bpay\b)(?=.*\bill\b).*$/i
});

// R.MyDigi.Intro
bot.dialog('MyDigiReloadOnline', [
    function (session) {
        trackBotEvent(session, 'menu|MyDigi|ReloadOnline',1);

        session.send("For Prepaid users, here is how you can reload using MyDigi with your Credit Card, Debit card or online banking");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1 of 4")
				.text("At MyDigi app, click on Reload")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page1.png') ])

                ,new builder.HeroCard(session)
				.title("Step 2 of 4")
				.text("Click on online, for reload with Credit Card, Debit Card or Online Banking")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page4.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 3 of 4")
				.text("Enter the reload amount, you email address and the press Reload")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page567.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 4 of 4")
				.text("We will then bring you to payment page. Fill in payment details to complete the reload")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Bill-Payment-Page5.png') ])
				
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
	// Match question with 2 words in any order: 	MyDigi + intro		MyDigi + Start 
    matches: /^(?=.*\breload\b)(?=.*\bonline\b).*$|(?=.*\breload\b)(?=.*\bcredit\b)(?=.*\bcard\b).*$|(?=.*\breload\b)(?=.*\batm\b).*$|(?=.*\breload\b)(?=.*\bbank\b).*$/i
});

// R.MyDigi.Intro
bot.dialog('MyDigiReloadPin', [
    function (session) {
        trackBotEvent(session, 'menu|MyDigi|ReloadPin',1);

        session.send("For Prepaid users, here is how you can reload using MyDigi with PIN or reload coupon");
        var respCards = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments([
                new builder.HeroCard(session)
				.title("Step 1 of 3")
				.text("At MyDigi app, click on Reload")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-Page1.png') ])

                ,new builder.HeroCard(session)
				.title("Step 2 of 3")
				.text("Click on PIN")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-PIN-Page1.png') ])
				
                ,new builder.HeroCard(session)
				.title("Step 3 of 3")
				.text("Key in the 16 Digit PIN and press Reload")
                .images([ builder.CardImage.create(session, imagedir + '/images/MyDigi-Reload-PIN-Page23.png') ])
				
            ]);
		session.send(respCards);		
		session.replaceDialog("getInfoFeedback");		
    }
]).triggerAction({
	// Match question with 2 words in any order: 	MyDigi + intro		MyDigi + Start 
    matches: /^(?=.*\breload\b)(?=.*\bpin\b).*$|(?=.*\breload\b)(?=.*\bcoupon\b).*$/i
});


//bot.dialog('NLP', [
//// R - menu
//    function (session) {
//        trackBotEvent(session, 'NLP',1);
//        session.send(DefaultMaxRetryErrorPrompt);        
//        session.replaceDialog('menu');
//    }
//]).triggerAction({
//    matches: /(Who)|(What)|(How)(I want)/i
//});

//////////////////////////////////////////////////////////////////////////////
// Small talks
bot.dialog('SmallTalk1', [
    function (session) {
        trackBotEvent(session, 'smalltalk',1);

        session.send("Hi, I'm Yello, Digi's virtual assistant");
    }
]).triggerAction({
    matches: /(hi)|(hello)|(are you)|(name)|(call you)/i
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

bot.dialog('CheckMyAccount', [
    function (session) {
        var currentTime = Date.now();
        var diffTime = currentTime - session.privateConversationData[ValidatedTime];
        // OTP will be valid for 1 hour 60*60*1000
        if((session.privateConversationData[ValidatedTime] == undefined) || diffTime>3600000) 
        {
            session.send("Just let us verify your identity for a sec ");

//            session.beginDialog('validators:phonenumber');
        } else {
            session.replaceDialog('PrepaidAccountOverview');
            return;

        }
    },
    function (session, results) {
        session.privateConversationData[PhoneNumber] = results.response;
        session.privateConversationData[OneTimePin] = GenerateOtp2(session.privateConversationData[PhoneNumber]);

        if (process.env.DEVELOPMENT) {
            console.log("OTP is " + session.privateConversationData[OneTimePin]);
        }

        builder.Prompts.text(session, "I have just sent the One Time Code to you. Can you please key in the 4 digit code?");
    },
    function (session, results) {
        if(session.privateConversationData[OneTimePin] == results.response)
        {
            session.privateConversationData[ValidatedTime] = Date.now();
            session.replaceDialog('PrepaidAccountOverview');
            return;
        }
        builder.Prompts.text(session, "Ops, the OTP is wrong. Can you please key in the 4 digit code?");
    },
    function (session, results) {   // OTP Wrong, Retry second time
        if(session.privateConversationData[OneTimePin] == results.response)
        {
            session.privateConversationData[ValidatedTime] = Date.now();
            session.replaceDialog('PrepaidAccountOverview');
            return;
        }
        session.send('Ops, the OTP is wrong. Sorry, I\'ll bring you back to our Main Menu');
        session.replaceDialog('menu');
    }
]).triggerAction({
    matches: /^(chinyankeat)$/i
});

// Generate OTP using SBP API
function GenerateOtp(phoneNumber){
    
    var randomnum = math.randomInt(1,9999);
    // add leading zero in front
    var randomotp = "0000" + randomnum; 
    randomotp = randomotp.substr(randomotp.length-4);
    
    var args = {
        data:  "{\
                 \"ref_id\": \"TEST123456#\",\
                 \"service_id\": \"DG_HELLOWIFI\",\
                 \"msisdn\": \"" + phoneNumber + "\",\
                 \"status\": \"1\",\
                 \"transaction_id\": \"\",\
                 \"price_code\": \"VAS220000\",\
                 \"keyword\": \"test\",\
                 \"source_mobtel\": \"20000\",\
                 \"sender_name\": \"\",\
                 \"sms_contents\": [\
                  {\
                   \"content\": \"RM0.00 Digi Virtual Assistant. Your one time PIN is " + randomotp + ", valid for the next 3 minutes\",\
                   \"ucp_data_coding_id\": \"0\",\
                   \"ucp_msg_type\": \"3\",\
                   \"ucp_msg_class\": \"3\"\
                  }\
                 ]\
                }",
        headers: { Authorization: "Basic " + process.env.SBP_SMS_AUTHORIZATIONKEY,
                   "Content-Type": "application/json"}
    };
    if (process.env.DEVELOPMENT != 1) { // send out real OTP SMS only if production mode
        restclient.post(process.env.SBP_SMS_SENDURL + phoneNumber, args, function(data,response) {});
    }
    return randomotp;
}

// Generate OTP using API Gateweay
function GenerateOtp2(phoneNumber){

    var randomnum = math.randomInt(1,9999);
    // add leading zero in front for the random OTP
    var randomotp = "0000" + randomnum; 
    randomotp = randomotp.substr(randomotp.length-4);    
    
    // Token Expired
    if (ApiGwAuthTokenExpiry < Date.now()) {
        GetSmsAuthToken();
    }
    
    // Generate unique ID for API Gateway's ID
    ApiGwSmsCounter++;
    if (ApiGwSmsCounter>99999) {
        ApiGwSmsCounter = 0;
    }
    var SmsCounter = "00000" + ApiGwSmsCounter; 
    SmsCounter = SmsCounter.substr(SmsCounter.length-5);    

    var options = {
        method: 'POST',
        url: process.env.APIGW_URL + '/notifications/v1/sms/vas',
        headers: {
//            'postman-token': 'c5791e8d-ad6f-b1f9-8155-7434571289cb',
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: 'Bearer '+ ApiGwAuthToken
        },
        body: {
            sourceId: 'EXPLORER',
            correlationId: 'EXPLOR' + SmsCounter,
            id: {
                type: 'MSISDN',
                value: '6' + phoneNumber,
            },
            message: 'RM0.00 Digi Virtual Assistant. Your one time PIN is ' + randomotp + ', valid for the next 3 minutes'
        },
        'json': true
    };

//    if (process.env.DEVELOPMENT != 1) { // send out real OTP SMS only if production mode
        try {
            request(options, function (error, response, body) {
                //console.log('Sent to APIGW '+ JSON.stringify(response));
            })
        } catch (e) {
            //console.log('test2 '+ options);        
        }
//    }
    return randomotp;
}

// Generate OTP using API Gateweay
function GenerateOtp3(phoneNumber){
    var randomnum = math.randomInt(1,9999);
    // add leading zero in front for the random OTP
    var randomotp = "0000" + randomnum; 
    randomotp = randomotp.substr(randomotp.length-4);    
    
    // Token Expired
    if (ApiGwAuthTokenExpiry < Date.now()) {
        GetSmsAuthToken();
    }
    
    // Generate unique ID for API Gateway's ID
    ApiGwSmsCounter++;
    if (ApiGwSmsCounter>99999) {
        ApiGwSmsCounter = 0;
    }
    var SmsCounter = "00000" + ApiGwSmsCounter; 
    SmsCounter = SmsCounter.substr(SmsCounter.length-5);    

    // Generate unique ID for API Gateway's ID
    ApiGwSmsCounter++;
    if (ApiGwSmsCounter>99999) {
        ApiGwSmsCounter = 0;
    }
    var SmsCounter = "00000" + ApiGwSmsCounter; 
    SmsCounter = SmsCounter.substr(SmsCounter.length-5);    
    
    var options = {
        method: 'POST',
        url: 'http://localhost:8080/demo/api/apigwsendsms/',
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            authorization: 'Bearer ' + ApiGwAuthToken
        },
        body: {
            msisdn: '6' + phoneNumber,
            correlationId: 'EXPLOR' + SmsCounter,
            authorizationToken: ApiGwAuthToken,
            message: 'RM0.00 Digi Virtual Assistant. Your one time PIN is ' + randomotp + ', valid for the next 3 minutes'
        },
        json: true
    };

//    if (process.env.DEVELOPMENT != 1) { // send out real OTP SMS only if production mode
        try {
            request(options, function (error, response, body) {
                //console.log('Sent to APIGW '+ JSON.stringify(response));
            })
        } catch (e) {
            //console.log('test2 '+ options);        
        }
//    }
    return randomotp;
}

function GetSmsAuthToken(){
    var options = {
        method: 'POST',
        url: process.env.APIGW_URL + '/oauth/v1/token',
        headers: {
            'cache-control': 'no-cache',
            'content-type': 'application/x-www-form-urlencoded'
        },
        form: {
            client_id: process.env.APIGW_SMS_AUTH_CLIENT_ID,
            client_secret: process.env.APIGW_SMS_AUTH_CLIENT_SECRET,
            grant_type: 'client_credentials',
            expires_in: '86400'
        }
    };

    try {
        request(options, function (error, response, body) {
            if (!error) {
                var ApiGwAuth = JSON.parse(body);
                if(ApiGwAuth.status == 'approved'){
                    var ApiGwAuth = JSON.parse(body);
                    ApiGwAuthToken = ApiGwAuth.accessToken;
                    ApiGwAuthTokenExpiry = Date.now() + 23*50*60*1000;   // Expire in 24 hours. Renew Token 10 mins before expiry 

                    console.log('Token = ' + ApiGwAuthToken + ' expiry in ' + ApiGwAuthTokenExpiry);            
                }                
            }
        });
    } catch (e) {        
    }
}

// get auth token using ChatbotIod
function GetSmsAuthToken2(){
    var options = {
        method: 'GET',
        url: 'http://localhost:8080/demo/api/apigwtoken/',
        headers: {
            'cache-control': 'no-cache',
            authorization: 'Basic YmlsbDphYmMxMjM='
        }
    };
    try {
        request(options, function (error, response, body) {
            if (!error) {
                var ApiGwSmsAuth = JSON.parse(body);
                if(ApiGwSmsAuth.status == 'approved'){
                    var ApiGwAuth = JSON.parse(body);
                    ApiGwAuthToken = ApiGwSmsAuth.accessToken;
                    ApiGwAuthTokenExpiry = Date.now() + 23*50*60*1000;   // Expire in 24 hours. Renew Token 10 mins before expiry 

                    console.log('Token = ' + ApiGwAuthToken + ' expiry in ' + ApiGwAuthTokenExpiry);            
                }                
            } else {
            }
        });
    } catch (e) {        
    }
}



// R.0.4.1.1 - menu | PrepaidDialog  | MyAccountPrepaid | OneTimeCode | PrepaidAccountOverview
bot.dialog('PrepaidAccountOverview', [
    function (session) {
        builder.Prompts.choice(session, "What can we help you with?", 'Credit Balance|Internet Quota|Talktime Services|Itemized Usage|Reload|Add On', { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        switch (results.response.index) {
        case 0: // Credit Balance
        case 1: // Internet Quota
        case 2: // Talktime Services
        case 3: // Itemized Usage
        case 4: // Reload
        case 5: // Add On
            session.send("Coming Soon!!");
        default:
            session.send("Sorry, I didn't quite get that.");
            break;
        }
    }
])

////////////////////////////////////////////////////////////////////////////////////////
// This menu will act like catch all if it couldn't match the expressions above
// we will forward these to LUIS or API.AI
function findStackAction(routes, name) {
    for (var i = 0; i < routes.length; i++) {
        var r = routes[i];
        if (r.routeType === builder.Library.RouteTypes.StackAction &&
            r.routeData.action === name) {
                return r;
        }
    }
    return null;
}

bot.dialog('CatchAll', [
    function (session) {

//console.log("text: "+session.message.text + apiai_app);
		var request = apiai_app.textRequest(session.message.text, {
			sessionId: `${math.randomInt(100000,999999)}`
		});

		request.on('response', function(response) {
			if(response.result.action==undefined){
				session.send("Let's get back to our chat on Digi");
			} else {		// We have response from API.AI
				console.log("API.AI [" +response.result.resolvedQuery + '][' + response.result.action + '][' + response.result.score + ']['  + response.result.fulfillment.speech + ']');
	//			console.log('API.AI response text:'+ response.result.fulfillment.speech);
	//			console.log('API.AI response text:'+ response.result.fulfillment.messages[0].speech);
	//			console.log('API.AI response:'+ JSON.stringify(response.result));
				if(response.result.fulfillment.speech.length>0) {
					session.send(response.result.fulfillment.speech);				
				} else {
					session.send("Let's get back to our chat on Digi");
				}
			}
		});

		request.on('error', function(error) {
			console.log('API.AI error:'+error);
			session.send("Let's get back to our chat on Digi");
		});

		request.end();
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

