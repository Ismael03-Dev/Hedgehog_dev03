const fs = require("fs-extra");
const { utils } = global;

module.exports = {
	config: {
		name: "prefix",
		version: "1.5",
		author: "Master Charbel",
		countDown: 5,
		role: 0,
		description: "Changer le préfixe de Nexus Bot Ultimate",
		category: "config",
		guide: "{pn} <new prefix> ou {pn} reset"
	},

	langs: {
		en: {
			reset: "╔══════════════════════════════╗\n║ ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 ⚡ \n╠══════════════════════════════╣\n║ Préfixe réinitialisé à : %1 ║\n╚══════════════════════════════╝",
			onlyAdmin: "╔══════════════════════════════╗\n║ ❌ 𝐀𝐂𝐂È𝐒 𝐑𝐄𝐒𝐓𝐑𝐄𝐈𝐍𝐓 ❌ \n╠══════════════════════════════╣\n║ Seuls les admins Nexus peuvent\n║ modifier le préfixe global. ║\n╚══════════════════════════════╝",
			confirmGlobal: "╔══════════════════════════════╗\n║ ⚡ 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐓𝐈𝐎𝐍 𝐆𝐋𝐎𝐁𝐀𝐋 ⚡ \n╠══════════════════════════════╣\n║ Réagis avec une émotion pour\n║ confirmer le changement global.║\n╚══════════════════════════════╝",
			confirmThisThread: "╔══════════════════════════════╗\n║ ⚡ 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐓𝐈𝐎𝐍 𝐒𝐄𝐑𝐕𝐄𝐔𝐑 ⚡ \n╠══════════════════════════════╣\n║ Réagis avec une émotion pour\n║ changer le préfixe ici.      ║\n╚══════════════════════════════╝",
			successGlobal: "╔══════════════════════════════╗\n║ ✅ 𝐒𝐘𝐒𝐓𝐄𝐌𝐄 𝐌𝐀𝐉 𝐔𝐏𝐃𝐀𝐓𝐄 ⚡ \n╠══════════════════════════════╣\n║ Nouveau préfixe global : %1 ║\n╚══════════════════════════════╝",
			successThisThread: "╔══════════════════════════════╗\n║ ✅ 𝐒𝐄𝐑𝐕𝐄𝐔𝐑 𝐌𝐀𝐉 𝐔𝐏𝐃𝐀𝐓𝐄 ⚡ \n╠══════════════════════════════╣\n║ Nouveau préfixe local : %1  ║\n╚══════════════════════════════╝",
			myPrefix: "╔══════════════════════════════╗\n║ ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐁𝐎𝐓 𝐒𝐓𝐀𝐓𝐔𝐒 ⚡ \n╠══════════════════════════════╣\n║ 🌐 Global : %1\n║ 🛸 Local  : %2\n╚══════════════════════════════╝"
		}
	},

	onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
		if (!args[0]) return message.SyntaxError();

		if (args[0] == 'reset') {
			await threadsData.set(event.threadID, null, "data.prefix");
			return message.reply(getLang("reset", global.GoatBot.config.prefix));
		}

		const newPrefix = args[0];
		const formSet = { commandName, author: event.senderID, newPrefix };

		if (args[1] === "-g") {
			if (role < 2) return message.reply(getLang("onlyAdmin"));
			formSet.setGlobal = true;
		} else {
			formSet.setGlobal = false;
		}

		return message.reply(args[1] === "-g" ? getLang("confirmGlobal") : getLang("confirmThisThread"), (err, info) => {
			formSet.messageID = info.messageID;
			global.GoatBot.onReaction.set(info.messageID, formSet);
		});
	},

	onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
		const { author, newPrefix, setGlobal } = Reaction;
		if (event.userID !== author) return;
        
		if (setGlobal) {
			global.GoatBot.config.prefix = newPrefix;
			fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
			return message.reply(getLang("successGlobal", newPrefix));
		} else {
			await threadsData.set(event.threadID, newPrefix, "data.prefix");
			return message.reply(getLang("successThisThread", newPrefix));
		}
	},

	onChat: async function ({ event, message, getLang }) {
		if (event.body && event.body.toLowerCase() === "prefix")
			return message.reply(getLang("myPrefix", global.GoatBot.config.prefix, utils.getPrefix(event.threadID)));
	}
};
