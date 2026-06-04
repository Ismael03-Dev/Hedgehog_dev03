const { config } = global.GoatBot;
module.exports = {
        config: {
                name: "wlt",
                version: "1.0",
                author: "rehat--",
                countDown: 5,
                role: 2,
                longDescription: {
                        en: "Add, remove, edit whiteListIds"
                },
                category: "owner",
                guide: {
                        en: '   {pn} [add | -a] <uid | @tag>: Add admin role for user'
                                + '\n   {pn} [remove | -r] <uid | @tag>: Remove admin role of user'
                                + '\n   {pn} [list | -l]: List all admins'
        + '\n   {pn} [ on | off ]: enable and disable whiteList mode'
                }
        },

        langs: {
                en: {
                        added: "✅ | Parfait ce ducon a mis pied sur le monde absolu. C'est lui :\n%2",
                        alreadyAdmin: "\n⚠ | Ah ce con a déjà vendu son âme pour nous rejoindre. Il s'agit de :\n%2",
                        missingIdAdd: "⚠ | Ça manque l'uid ou le tag 🥲",
                        removed: "✅ | Oh putain  %1 utilisateur à été banni du monde impénétrable. Il s'agit de :\n%2",
                        notAdmin: "⚠ | Putain, ce con n'a pas la permission de rejoindre notre monde. Je parle bien de :\n%2",
                        missingIdRemove: "⚠ | Il manque l'uid 🥲",
                        listAdmin: "👑 | Voici la liste des chefs du monde absolu :\n%1",
      enable: "Parfait technique d'ignorance activé. 😈",
      disable: "Et merde je me sentais si bien dans ce monde réservé aux puissants. \nMais bon, ce n'est pas grave 🐥"
                }
        },

        onStart: async function ({ message, args, usersData, event, getLang, api }) {
    const permission = ["100083846212138", "61589149033077", "61578433048588"];
    if (!permission.includes(event.senderID)) {
      api.sendMessage(
        "Oh merde 🐥 \nT'essaies de jouer au maître? Ducon tu ne peux pas utliser cette commande.\nTrou du cul. Reviens l'utiliser quand tu sauras compter.",
        event.threadID,
        event.messageID
      );
      return;
    }
    const { writeFileSync } = require("fs-extra");
                switch (args[0]) {
                        case "add":
                        case "-a": {
                                if (args[1]) {
                                        let uids = [];
                                        if (Object.keys(event.mentions).length > 0)
                                                uids = Object.keys(event.mentions);
                                        else if (event.messageReply)
                                                uids.push(event.messageReply.senderID);
                                        else
                                                uids = args.filter(arg => !isNaN(arg));
                                        const notAdminIds = [];
                                        const adminIds = [];
                                        for (const uid of uids) {
                                                if (config.whiteListMode.whiteListIds.includes(uid))
                                                        adminIds.push(uid);
                                                else
                                                        notAdminIds.push(uid);
                                        }

                                        config.whiteListMode.whiteListIds.push(...notAdminIds);
                                        const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
                                        writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
                                        return message.reply(
                                                (notAdminIds.length > 0 ? getLang("added", notAdminIds.length, getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "")
                                                + (adminIds.length > 0 ? getLang("alreadyAdmin", adminIds.length, adminIds.map(uid => `• ${uid}`).join("\n")) : "")
                                        );
                                }
                                else
                                        return message.reply(getLang("missingIdAdd"));
                        }
                        case "remove":
                        case "-r": {
                                if (args[1]) {
                                        let uids = [];
                                        if (Object.keys(event.mentions).length > 0)
                                                uids = Object.keys(event.mentions)[0];
                                        else
                                                uids = args.filter(arg => !isNaN(arg));
                                        const notAdminIds = [];
                                        const adminIds = [];
                                        for (const uid of uids) {
                                                if (config.whiteListMode.whiteListIds.includes(uid))
                                                        adminIds.push(uid);
                                                else
                                                        notAdminIds.push(uid);
                                        }
                                        for (const uid of adminIds)
                                                config.whiteListMode.whiteListIds.splice(config.whiteListMode.whiteListIds.indexOf(uid), 1);
                                        const getNames = await Promise.all(adminIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
                                        writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
                                        return message.reply(
                                                (adminIds.length > 0 ? getLang("removed", adminIds.length, getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "")
                                                + (notAdminIds.length > 0 ? getLang("notAdmin", notAdminIds.length, notAdminIds.map(uid => `• ${uid}`).join("\n")) : "")
                                        );
                                }
                                else
                                        return message.reply(getLang("missingIdRemove"));
                        }
                        case "list":
                        case "-l": {
                                const getNames = await Promise.all(config.whiteListMode.whiteListIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
                                return message.reply(getLang("listAdmin", getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")));
                        }
        case "on": {              
   config.whiteListMode.enable = true;
                writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
                return message.reply(getLang("enable"))
            }
            case "off": {
   config.whiteListMode.enable = false;
                writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
                return message.reply(getLang("disable"))
            }
            default:
                return message.SyntaxError();
        }
    }
};