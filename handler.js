const https = require('https');
const WebClient = require('@slack/client').WebClient;
const OAuth = require('./oauth.js');
const Templates = require('./templates.js');
const emoji = require('./emoji.js');

const client = {
	id: process.env.CLIENT_ID,
	secret: process.env.CLIENT_SECRET
};

module.exports.install = (event, context, callback) => {
	callback(null, {
		statusCode: 200,
		headers: {
			'Content-Type': 'text/html'
		},
		body: Templates.install(client.id)
	});
};

module.exports.authorized = (event, context, callback) => {
	const code = event.queryStringParameters.code;
	
	https.get(`https://slack.com/api/oauth.access?client_id=${client.id}&client_secret=${client.secret}&code=${code}`, response => {
		var body = '';
		response.on('data', chunk => body += chunk);
		response.on('end', () => {
			const jsonBody = JSON.parse(body);
			OAuth.storeAccessToken(jsonBody.team_id, jsonBody.bot.bot_access_token)
				.catch(error => console.log(error));
		});
	});
	
	callback(null, {
		statusCode: 200,
		headers: {
			'Content-Type': 'text/html'
		},
		body: Templates.authorized(client.id, client.secret)
	});
};

module.exports.event = (event, context, callback) => {
	const jsonBody = JSON.parse(event.body);
	const response = {
		statusCode: 200
	};
	
	switch (jsonBody.type) {
		case 'url_verification':
			response.headers = {
				'Content-Type': 'application/x-www-form-urlencoded'
			};
			response.body = jsonBody.challenge;
			break;
		
		case 'event_callback':
			OAuth.retrieveAccessToken(jsonBody.team_id)
				.then(botAccessToken => handleEvent(jsonBody.event, botAccessToken))
				.catch(error => console.log(error));
			break;
	}

	callback(null, response);
};

const handleEvent = (event, token) => {
	const web = new WebClient(token);
	
	switch (event.type) {
		case 'message':
			// ignore ourselves
			if (event.subtype && event.subtype === 'bot_message') {
				break;
			}
			const reply = handleMessage(event.text);
			web.chat.postMessage(event.channel, reply)
				.catch(error => console.log(`Error posting Slack message: ${error}`));
			break;
	}
};

const handleMessage = text => {
	const replies = text.match(/\w{2,}/g)
		.map(word => word.toLowerCase())
		.filter(word => emoji[word])
		.map(word => `:${word}:`);
	
	if (replies.length === 0) {
		return 'I have nothing.';
	}
	
	return replies[Math.floor(Math.random() * replies.length)];
};
