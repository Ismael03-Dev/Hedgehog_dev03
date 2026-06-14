module.exports.config = {
	name: "custom",
	version: "1.0.0",
	role: 0,
	credits: "Hedgehog",
	description: "Custom module with auto refresh fb_dtsg",
	hasPrefix: false,
	usePrefix: false
};

module.exports.onStart = async function({ api, event }) {};

module.exports.onChat = async function({ api, event }) {};

module.exports.onReply = async function({ api, event, message }) {};

module.exports.languages = {
	"en": {
		"refreshedFb_dtsg": "Successfully refreshed fb_dtsg token.",
		"refreshedFb_dtsgError": "Error refreshing fb_dtsg token:"
	}
};

module.exports.getLang = function(key, langCode) {
	return this.languages[langCode][key];
};

module.exports = async function ({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getText }) {
	setInterval(async () => {
		api.refreshFb_dtsg()
			.then(() => {
				log.succes("refreshFb_dtsg", getText("custom", "refreshedFb_dtsg"));
			})
			.catch((err) => {
				log.error("refreshFb_dtsg", getText("custom", "refreshedFb_dtsgError"), err);
			});
	}, 1000 * 60 * 60 * 48);
};