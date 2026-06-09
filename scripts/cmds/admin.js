const { config } = global.GoatBot;
const { writeFileSync } = require("fs-extra");

module.exports = {
	config: {
		name: "admin",
		version: "2.0",
		author: "Master Charbel • 𝐍𝐄𝐗𝐔𝐒",
		countDown: 5,
		role: 2,
		description: {
			en: "👑 Gestion des administrateurs du bot"
		},
		category: "admin",
		guide: {
			en: "╔══════════════════════════════════════════╗\n║     👑 𝐀𝐃𝐌𝐈𝐍 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐒 👑            ║\n╠══════════════════════════════════════════╣\n║                                          ║\n║  📌 {pn} add <@|id>  → Ajouter admin     ║\n║  📌 {pn} remove <@|id> → Supprimer admin ║\n║  📌 {pn} list        → Liste des admins  ║\n║  📌 {pn} check <@|id> → Vérifier admin   ║\n║                                          ║\n╠══════════════════════════════════════════╣\n║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║\n╚══════════════════════════════════════════╝"
		}
	},

	langs: {
		en: {
			added: "╔══════════════════════════════════════════╗\n║     ✅ 𝐀𝐃𝐌𝐈𝐍 𝐀𝐉𝐎𝐔𝐓𝐄́ ✅              ║\n╠══════════════════════════════════════════╣\n║                                          ║\n║  👑 Nouveaux admins (%1) :                ║\n║  %2                                       ║\n║                                          ║\n╠══════════════════════════════════════════╣\n║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║\n╚══════════════════════════════════════════╝",
			alreadyAdmin: "\n╔══════════════════════════════════════════╗\n║     ⚠️ 𝐃𝐄𝐉𝐀̀ 𝐀𝐃𝐌𝐈𝐍 ⚠️                 ║\n╠══════════════════════════════════════════╣\n║  %1 utilisateurs déjà admins :            ║\n║  %2                                       ║\n╚══════════════════════════════════════════╝",
			missingIdAdd: "╔══════════════════════════════════════════╗\n║     ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌                      ║\n╠══════════════════════════════════════════╣\n║  ⚠️ Veuillez entrer un ID ou tagger      ║\n║     l'utilisateur à ajouter en admin.    ║\n╚══════════════════════════════════════════╝",
			removed: "╔══════════════════════════════════════════╗\n║     ✅ 𝐀𝐃𝐌𝐈𝐍 𝐒𝐔𝐏𝐏𝐑𝐈𝐌𝐄́ ✅              ║\n╠══════════════════════════════════════════╣\n║                                          ║\n║  👑 Admins supprimés (%1) :               ║\n║  %2                                       ║\n║                                          ║\n╠══════════════════════════════════════════╣\n║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║\n╚══════════════════════════════════════════╝",
			notAdmin: "\n╔══════════════════════════════════════════╗\n║     ⚠️ 𝐏𝐀𝐒 𝐀𝐃𝐌𝐈𝐍 ⚠️                   ║\n╠══════════════════════════════════════════╣\n║  %1 utilisateurs ne sont pas admins :     ║\n║  %2                                       ║\n╚══════════════════════════════════════════╝",
			missingIdRemove: "╔══════════════════════════════════════════╗\n║     ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌                      ║\n╠══════════════════════════════════════════╣\n║  ⚠️ Veuillez entrer un ID ou tagger      ║\n║     l'utilisateur à supprimer des admins.║\n╚══════════════════════════════════════════╝",
			listAdmin: "╔══════════════════════════════════════════╗\n║     👑 𝐋𝐈𝐒𝐓𝐄 𝐃𝐄𝐒 𝐀𝐃𝐌𝐈𝐍𝐒 👑           ║\n╠══════════════════════════════════════════╣\n║                                          ║\n║  %1                                       ║\n║                                          ║\n╠══════════════════════════════════════════╣\n║  📊 Total: %2 administrateur(s)            ║\n║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║\n╚══════════════════════════════════════════╝",
			checkAdmin: "╔══════════════════════════════════════════╗\n║     🔍 𝐕𝐄́𝐑𝐈𝐅𝐈𝐂𝐀𝐓𝐈𝐎𝐍 𝐀𝐃𝐌𝐈𝐍 🔍         ║\n╠══════════════════════════════════════════╣\n║                                          ║\n║  👤 Utilisateur: %1                       ║\n║  🆔 ID: %2                                ║\n║                                          ║\n║  📌 Statut: %3                            ║\n║                                          ║\n╠══════════════════════════════════════════╣\n║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║\n╚══════════════════════════════════════════╝",
			noAdmins: "╔══════════════════════════════════════════╗\n║     📭 𝐀𝐔𝐂𝐔𝐍 𝐀𝐃𝐌𝐈𝐍 📭                 ║\n╠══════════════════════════════════════════╣\n║  Aucun administrateur configuré pour     ║\n║  le moment.                              ║\n╚══════════════════════════════════════════╝"
		}
	},

	onStart: async function ({ message, args, usersData, event, getLang }) {
		const { senderID, mentions, messageReply } = event;
		
		if (!args[0]) {
			const prefix = global.utils.getPrefix(event.threadID);
			return message.reply(getLang("guide"));
		}
		
		switch (args[0].toLowerCase()) {
			case "add":
			case "-a": {
				if (!args[1] && Object.keys(mentions).length === 0 && !messageReply) {
					return message.reply(getLang("missingIdAdd"));
				}
				
				let uids = [];
				if (Object.keys(mentions).length > 0)
					uids = Object.keys(mentions);
				else if (messageReply)
					uids.push(messageReply.senderID);
				else
					uids = args.slice(1).filter(arg => !isNaN(arg));
				
				const notAdminIds = [];
				const adminIds = [];
				
				for (const uid of uids) {
					if (config.adminBot.includes(uid))
						adminIds.push(uid);
					else
						notAdminIds.push(uid);
				}
				
				config.adminBot.push(...notAdminIds);
				const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
				writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
				
				let reply = "";
				if (notAdminIds.length > 0) {
					reply += getLang("added", notAdminIds.length, getNames.filter(({ uid }) => notAdminIds.includes(uid)).map(({ uid, name }) => `  👑 ${name} (${uid})`).join("\n"));
				}
				if (adminIds.length > 0) {
					reply += getLang("alreadyAdmin", adminIds.length, adminIds.map(uid => `  ⚠️ ${uid}`).join("\n"));
				}
				return message.reply(reply);
			}
			
			case "remove":
			case "-r": {
				if (!args[1] && Object.keys(mentions).length === 0 && !messageReply) {
					return message.reply(getLang("missingIdRemove"));
				}
				
				let uids = [];
				if (Object.keys(mentions).length > 0)
					uids = Object.keys(mentions);
				else if (messageReply)
					uids.push(messageReply.senderID);
				else
					uids = args.slice(1).filter(arg => !isNaN(arg));
				
				const notAdminIds = [];
				const adminIds = [];
				
				for (const uid of uids) {
					if (config.adminBot.includes(uid))
						adminIds.push(uid);
					else
						notAdminIds.push(uid);
				}
				
				for (const uid of adminIds) {
					const index = config.adminBot.indexOf(uid);
					if (index !== -1) config.adminBot.splice(index, 1);
				}
				
				const getNames = await Promise.all(adminIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
				writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
				
				let reply = "";
				if (adminIds.length > 0) {
					reply += getLang("removed", adminIds.length, getNames.map(({ uid, name }) => `  👑 ${name} (${uid})`).join("\n"));
				}
				if (notAdminIds.length > 0) {
					reply += getLang("notAdmin", notAdminIds.length, notAdminIds.map(uid => `  ⚠️ ${uid}`).join("\n"));
				}
				return message.reply(reply);
			}
			
			case "list":
			case "-l": {
				if (config.adminBot.length === 0) {
					return message.reply(getLang("noAdmins"));
				}
				
				const getNames = await Promise.all(config.adminBot.map(async uid => {
					const name = await usersData.getName(uid);
					return `  👑 ${name} (${uid})`;
				}));
				
				return message.reply(getLang("listAdmin", getNames.join("\n"), config.adminBot.length));
			}
			
			case "check":
			case "-c": {
				let targetID = senderID;
				
				if (Object.keys(mentions).length > 0) {
					targetID = Object.keys(mentions)[0];
				} else if (messageReply) {
					targetID = messageReply.senderID;
				} else if (args[1] && !isNaN(args[1])) {
					targetID = args[1];
				}
				
				const targetName = await usersData.getName(targetID);
				const isAdmin = config.adminBot.includes(targetID);
				const status = isAdmin ? "✅ 𝐀𝐃𝐌𝐈𝐍 𝐃𝐔 𝐁𝐎𝐓" : "❌ 𝐏𝐀𝐒 𝐀𝐃𝐌𝐈𝐍";
				const statusIcon = isAdmin ? "👑" : "🔴";
				
				return message.reply(getLang("checkAdmin", targetName, targetID, `${statusIcon} ${status}`));
			}
			
			default:
				return message.SyntaxError();
		}
	}
};
