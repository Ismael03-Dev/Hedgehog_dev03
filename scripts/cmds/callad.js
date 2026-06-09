const { getStreamsFromAttachment, log } = global.utils;
const mediaTypes = ["photo", 'png', "animated_image", "video", "audio"];

module.exports = {
	config: {
		name: "callad",
		version: "3.0",
		author: "Master Charbel • NEXUS",
		countDown: 10,
		role: 0,
		description: {
			en: "📞 Contacter l'administrateur du bot"
		},
		category: "utility",
		guide: {
			en: "   {pn} <message> : Envoyer un message à l'admin"
		}
	},

	onStart: async function ({ args, message, event, usersData, threadsData, api, getLang }) {
		const { senderID, threadID, isGroup, messageID } = event;
		
		// ⚙️ CONFIGURATION - GROUPE ADMIN ⚙️
		const ADMIN_GROUP_ID = "27019957291032217"; // Ton groupe admin
		const ADMIN_IDS = ["61578718657900"]; // Ton ID Facebook
		
		if (!args[0]) {
			const prefix = global.utils.getPrefix(threadID);
			return message.reply(
				`╔══════════════════════════════════════════╗
║        📞 𝐂𝐀𝐋𝐋 𝐀𝐃𝐌𝐈𝐍 📞            ║
╠══════════════════════════════════════════╣
║                                          ║
║  📝 𝐔𝐬𝐚𝐠𝐞 :                             ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  ${prefix}callad <message>                ║
║                                          ║
║  📎 𝐄𝐱𝐞𝐦𝐩𝐥𝐞 :                           ║
║  ${prefix}callad Le bot ne répond plus    ║
║                                          ║
║  📎 𝐀𝐭𝐭𝐚𝐜𝐡𝐞𝐦𝐞𝐧𝐭𝐬 :                     ║
║  Vous pouvez joindre des images,         ║
║  vidéos ou fichiers.                     ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║
╚══════════════════════════════════════════╝`
			);
		}
		
		try {
			const senderName = await usersData.getName(senderID);
			const messageContent = args.join(" ");
			const time = new Date().toLocaleString('fr-FR');
			
			// Récupérer les infos du groupe si message envoyé depuis un groupe
			let groupName = "Message privé";
			let groupId = "N/A";
			if (isGroup) {
				try {
					const threadInfo = await api.getThreadInfo(threadID);
					groupName = threadInfo.threadName || "Groupe inconnu";
					groupId = threadID;
				} catch(e) {}
			}
			
			// Formatage du message pour les admins
			const adminMsg = 
`╔══════════════════════════════════════════╗
║     📝 𝐍𝐎𝐔𝐕𝐄𝐀𝐔 𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐂𝐀𝐋𝐋𝐀𝐃 📝      ║
╠══════════════════════════════════════════╣
║                                          ║
║  👤 𝐔𝐭𝐢𝐥𝐢𝐬𝐚𝐭𝐞𝐮𝐫 : ${senderName}                 ║
║  🆔 𝐔𝐬𝐞𝐫 𝐈𝐃 : ${senderID}                       ║
║  📍 𝐆𝐫𝐨𝐮𝐩𝐞 : ${groupName}                       ║
║  🆔 𝐆𝐫𝐨𝐮𝐩 𝐈𝐃 : ${groupId}                       ║
║  🕐 𝐇𝐞𝐮𝐫𝐞 : ${time}                            ║
║                                          ║
║  📝 𝐌𝐞𝐬𝐬𝐚𝐠𝐞 :                          ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  ${messageContent}                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║                                          ║
║  💡 𝐏𝐨𝐮𝐫 𝐫𝐞́𝐩𝐨𝐧𝐝𝐫𝐞 :                       ║
║  Répondez à ce message dans le groupe    ║
║  admin avec la commande:                 ║
║  reply ${senderID} <message>              ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║
╚══════════════════════════════════════════╝`;
			
			// Récupérer les attachements
			let attachments = [];
			try {
				attachments = await getStreamsFromAttachment(
					event.attachments.filter(item => mediaTypes.includes(item.type))
				);
			} catch(e) {}
			
			let sent = false;
			
			// Envoyer dans le GROUPE ADMIN
			try {
				await api.sendMessage({
					body: adminMsg,
					attachment: attachments
				}, ADMIN_GROUP_ID);
				sent = true;
				console.log(`✅ Message callad envoyé au groupe admin: ${ADMIN_GROUP_ID}`);
			} catch (err) {
				console.error("❌ Erreur envoi groupe admin:", err.message);
			}
			
			// FALLBACK : Envoyer à chaque admin individuellement
			if (!sent) {
				for (const adminID of ADMIN_IDS) {
					try {
						await api.sendMessage({
							body: adminMsg,
							attachment: attachments
						}, adminID);
						sent = true;
					} catch (err) {
						console.error(`❌ Erreur envoi à ${adminID}:`, err.message);
					}
				}
			}
			
			// Message de confirmation à l'utilisateur
			if (sent) {
				await message.reply(
					`╔══════════════════════════════════════════╗
║  ✅ 𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐄𝐍𝐕𝐎𝐘𝐄́ 𝐀𝐔𝐗 𝐀𝐃𝐌𝐈𝐍𝐒 ✅  ║
╠══════════════════════════════════════════╣
║                                          ║
║  📨 Votre message a été transmis         ║
║     aux administrateurs.                 ║
║                                          ║
║  💡 Vous recevrez une réponse            ║
║     dès que possible.                    ║
║                                          ║
║  📌 Une notification a été envoyée       ║
║     dans le groupe admin.                ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║
╚══════════════════════════════════════════╝`
				);
			} else {
				throw new Error("Aucun admin n'a reçu le message");
			}
			
		} catch (err) {
			console.error("❌ CALLAD ERROR:", err);
			await message.reply(
				`╔══════════════════════════════════════════╗
║  ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌                        ║
╠══════════════════════════════════════════╣
║                                          ║
║  ⚠️ Impossible d'envoyer le message.     ║
║                                          ║
║  🔧 Vérifie que :                        ║
║  • Le bot est dans le groupe admin       ║
║  • L'ID du groupe est correct            ║
║  • Le bot a les permissions              ║
║                                          ║
║  📝 Erreur: ${err.message.slice(0, 40)}      ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡               ║
╚══════════════════════════════════════════╝`
			);
		}
	}
};
