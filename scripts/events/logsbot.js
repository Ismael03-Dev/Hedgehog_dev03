const { getTime } = global.utils;

module.exports = {
	config: {
		name: "logsbot",
		isBot: true,
		version: "1.4",
		author: "NTKhang",
		envConfig: {
			allow: true
		},
		category: "events"
	},

	langs: {
		vi: {
			title: "====== Nhật ký bot ======",
			added: "\n✅\nSự kiện: bot được thêm vào nhóm mới\n- Người thêm: %1",
			kicked: "\n❌\nSự kiện: bot bị kick\n- Người kick: %1",
			footer: "\n- User ID: %1\n- Nhóm: %2\n- ID nhóm: %3\n- Thời gian: %4"
		},
		en: {
			title: "====== ᏰᎧᏖ ᏝᎧᎶᏕ ======",
			added: "\n🫠\n𝙴𝚟𝚎𝚗𝚝: 𝙱𝚘𝚝 𝚑𝚊𝚜 𝚋𝚎𝚎𝚗 𝚊𝚍𝚍𝚎𝚍 𝚝𝚘 𝚊 𝚗𝚎𝚠 𝚐𝚛𝚘𝚞𝚙\n- 𝙰𝚍𝚍𝚎𝚍 𝚋𝚢: %1",
			kicked: "\n🙆‍♂️\n𝙴𝚟𝚎𝚗𝚝: 𝙱𝚘𝚝 𝚑𝚊𝚜 𝚋𝚎𝚎𝚗 𝚔𝚒𝚌𝚔𝚎𝚍\n- 𝙺𝚒𝚌𝚔𝚎𝚍 𝚋𝚢: %1",
			footer: "\n- 𝚄𝚜𝚎𝚛 𝙸𝙳: %1\n- 𝙶𝚛𝚘𝚞𝚙: %2\n- 𝙶𝚛𝚘𝚞𝚙 𝙸𝙳: %3\n- 𝚃𝚒𝚖𝚎: %4"
		}
	},

	onStart: async ({ usersData, threadsData, event, api, getLang }) => {
		if (
			(event.logMessageType == "log:subscribe" && event.logMessageData.addedParticipants.some(item => item.userFbId == api.getCurrentUserID()))
			|| (event.logMessageType == "log:unsubscribe" && event.logMessageData.leftParticipantFbId == api.getCurrentUserID())
		) return async function () {
			let msg = getLang("title");
			const { author, threadID } = event;
			if (author == api.getCurrentUserID())
				return;
			let threadName;
			const { config } = global.GoatBot;

			if (event.logMessageType == "log:subscribe") {
				if (!event.logMessageData.addedParticipants.some(item => item.userFbId == api.getCurrentUserID()))
					return;
				threadName = (await api.getThreadInfo(threadID)).threadName;
				const authorName = await usersData.getName(author);
				msg += getLang("added", authorName);
			}
			else if (event.logMessageType == "log:unsubscribe") {
				if (event.logMessageData.leftParticipantFbId != api.getCurrentUserID())
					return;
				const authorName = await usersData.getName(author);
				const threadData = await threadsData.get(threadID);
				threadName = threadData.threadName;
				msg += getLang("kicked", authorName);
			}
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			msg += getLang("footer", author, threadName, threadID, time);

			for (const adminID of config.adminBot)
				api.sendMessage(msg, adminID);
		};
	}
};
