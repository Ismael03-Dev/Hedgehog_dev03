const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const https = require("https");
const agent = new https.Agent({
	rejectUnauthorized: false
});
const moment = require("moment-timezone");
const mimeDB = require("mime-db");
const _ = require("lodash");
const { google } = require("googleapis");
const ora = require("ora");
const log = require("./logger/log.js");
const { isHexColor, colors } = require("./func/colors.js");
const Prism = require("./func/prism.js");

const config = {
	credentials: {
		gmailAccount: {
			clientId: process.env.GMAIL_CLIENT_ID || "",
			clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
			refreshToken: process.env.GMAIL_REFRESH_TOKEN || "",
			apiKey: process.env.GOOGLE_API_KEY || ""
		}
	}
};

const { gmailAccount } = config.credentials;
const { clientId, clientSecret, refreshToken, apiKey: googleApiKey } = gmailAccount;
if (!clientId) {
	log.err("CREDENTIALS", `Please provide a valid clientId in environment variables`);
	process.exit();
}
if (!clientSecret) {
	log.err("CREDENTIALS", `Please provide a valid clientSecret in environment variables`);
	process.exit();
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });

const gmail = google.gmail({ version: "v1", auth });
const drive = google.drive({ version: "v3", auth });

const GoatBotApis = {
	async getUserInfo(apiKey, userId) {
		try {
			const response = await axios.get(`https://${config.apiDomain}/api/userInfo?userId=${userId}`, {
				headers: { "x-api-key": apiKey }
			});
			return response.data;
		} catch (error) {
			log.err("API", error.message);
			return null;
		}
	}
};

const utils = {
	axios,
	fs,
	path,
	cheerio,
	agent,
	moment,
	mimeDB,
	_,
	ora,
	log,
	isHexColor,
	colors,
	Prism,
	gmail,
	drive,
	GoatBotApis
};

module.exports = utils;