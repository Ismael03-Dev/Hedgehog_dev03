module.exports = {
  config: {
    name: "fb",
    version: "2.0",
    author: "The VOID KUN クン ",
    countDown: 10,
    role: 0,
    shortDescription: "Informations Facebook",
    longDescription: "Affiche les informations et l'avatar d'un utilisateur Facebook",
    category: "image"
  },

  onStart: async function ({ event, message, usersData, api, args }) {

    const uid1 = event.senderID;
    const uid2 = Object.keys(event.mentions)[0];
    let uid;

    if (args[0]) {
      // Vérifie si c'est un UID
      if (/^\d+$/.test(args[0])) {
        uid = args[0];
      }
      // Vérifie si c'est un lien Facebook
      else {
        const match = args[0].match(/profile\.php\?id=(\d+)/);
        if (match)
          uid = match[1];
      }
    }

    if (!uid) {
      uid =
        event.type === "message_reply"
          ? event.messageReply.senderID
          : uid2 || uid1;
    }

    api.getUserInfo(uid, async (err, userInfo) => {
      if (err)
        return message.reply("❌ Impossible de récupérer les informations de cet utilisateur.");

      const avatarUrl = await usersData.getAvatarUrl(uid);

      let genderText;
      switch (userInfo[uid].gender) {
        case 1:
          genderText = "𝐅𝐢𝐥𝐥𝐞 👧";
          break;
        case 2:
          genderText = "𝐆𝐚𝐫𝐜̧𝐨𝐧 👦";
          break;
        default:
          genderText = "𝐈𝐧𝐜𝐨𝐧𝐧𝐮 ❓";
      }

      const info =
`╭━━━━━━━━━━━━━━╮
┃ 👤 𝐈𝐍𝐅𝐎𝐒 𝐅𝐀𝐂𝐄𝐁𝐎𝐎𝐊
╰━━━━━━━━━━━━━━╯

✦ 𝐍𝐨𝐦
╰➤ ${userInfo[uid].name}

✦ 𝐋𝐢𝐞𝐧 𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤
╰➤ ${userInfo[uid].profileUrl}

✦ 𝐆𝐞𝐧𝐫𝐞
╰➤ ${genderText}

✦ 𝐓𝐲𝐩𝐞 𝐝𝐞 𝐜𝐨𝐦𝐩𝐭𝐞
╰➤ ${userInfo[uid].type}

✦ 𝐀𝐦𝐢 𝐝𝐮 𝐛𝐨𝐭
╰➤ ${userInfo[uid].isFriend ? "𝐎𝐮𝐢 ✅" : "𝐍𝐨𝐧 ❌"}

✦ 𝐀𝐧𝐧𝐢𝐯𝐞𝐫𝐬𝐚𝐢𝐫𝐞 𝐚𝐮𝐣𝐨𝐮𝐫𝐝'𝐡𝐮𝐢
╰➤ ${userInfo[uid].isBirthday ? "𝐎𝐮𝐢 🎂" : "𝐍𝐨𝐧"}

╭━━━━━━━━━━━━━━╮
┃ 🌸 𝐓𝐇𝐄 𝐕𝐎𝐈𝐃 𝐁𝐎𝐓
╰━━━━━━━━━━━━━━╯`;

      return message.reply({
        body: info,
        attachment: await global.utils.getStreamFromURL(avatarUrl)
      });
    });
  }
};