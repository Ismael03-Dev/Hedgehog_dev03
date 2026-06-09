const axios = require("axios");

module.exports = {
  config: {
    name: "déesse",
    version: "1.0",
    author: "𝕿𝖍𝖊 𝖁𝖔𝖎𝖉 𝕶𝖚𝖓 クン",
    countDown: 5,
    role: 1,
    shortDescription: "Mode Déesse IA",
    longDescription: "Active une IA fun qui répond automatiquement dans le groupe",
    category: "fun"
  },

  langs: {
    en: {
      on: "🌸 La Déesse s'éveille...\n\nQui a osé troubler mon sommeil ?\nJ'espère que vos conversations seront plus intéressantes que mes rêves.\n\n✨ Mode Déesse activé.",
      off: "🌙 La Déesse retourne dormir...\n\nContinuez vos discussions sans moi.\n\n✨ Mode Déesse désactivé.",
      error: "Je n'ai pas compris ton message..."
    }
  },

  onStart: async function ({ args, threadsData, message, event, getLang }) {

    const status = await threadsData.get(event.threadID, "settings.deesse");

    // ACTIVER / DÉSACTIVER
    if (args[0] === "on") {
      await threadsData.set(event.threadID, true, "settings.deesse");

      return message.reply(
`╭────── ✦ ──────╮
🌸 La Déesse s'éveille...

Qui a osé troubler mon sommeil ?
J'espère que vos conversations seront plus intéressantes que mes rêves.

✨ Mode Déesse activé.
╰────── ✦ ──────╯`
      );
    }

    if (args[0] === "off") {
      await threadsData.set(event.threadID, false, "settings.deesse");

      return message.reply(
`╭────── ✦ ──────╮
🌙 La Déesse retourne dormir...

Continuez vos discussions sans moi.

✨ Mode Déesse désactivé.
╰────── ✦ ──────╯`
      );
    }

    if (args[0] === "statut") {
      const data = await threadsData.get(event.threadID, "deesseData") || {};

      const start = data.startTime || 0;
      const uptime = start ? Date.now() - start : 0;

      const format = ms => {
        let s = Math.floor(ms / 1000);
        let h = Math.floor(s / 3600);
        let m = Math.floor((s % 3600) / 60);
        s = s % 60;
        return `${h}h ${m}m ${s}s`;
      };

      return message.reply(
`╭────── ✦ ──────╮
🌸 𝐒𝐓𝐀𝐓𝐔𝐓 𝐃𝐄 𝐋𝐀 𝐃𝐄́𝐄𝐒𝐒𝐄
╰────── ✦ ──────╯

✨ État : ${status ? "Active 🌸" : "Inactive 🌙"}

🕒 Temps actif :
${start ? format(uptime) : "0h 0m 0s"}

💬 Messages analysés :
${data.messages || 0}

🤖 Réponses envoyées :
${data.replies || 0}

👥 Utilisateurs vus :
${(data.users || []).length}

╰────── ✦ ──────╯`
      );
    }
  },

  onChat: async function ({ event, message, threadsData }) {

    const enabled = await threadsData.get(event.threadID, "settings.deesse");
    if (!enabled) return;

    const text = event.body?.toLowerCase();
    if (!text) return;

    // IGNORE TROP LONG
    if (text.length > 8888) return;

    // IGNORE TROP COURT
    if (text.length < 6) return;

    // IGNORE COMMANDES
    if (text.startsWith("/")) return;

    // 35% chance de réponse
    if (Math.random() > 0.35) return;

    // DATA STORAGE
    let data = await threadsData.get(event.threadID, "deesseData") || {};

    data.messages = (data.messages || 0) + 1;
    data.users = data.users || [];
    data.replies = data.replies || 0;

    if (!data.users.includes(event.senderID)) {
      data.users.push(event.senderID);
    }

    // ANALYSE SIMPLE
    let response = "";

    const randomReplies = [
      "J'espère que tu as réfléchi avant d'écrire ça 👀",
      "Intéressant... enfin je crois.",
      "Tu es sûr de toi ou tu tapes au hasard ? 😏",
      "Même mon sommeil était plus logique que ça.",
      "Continue, je t'observe."
    ];

    if (/^[a-zA-Z]{6,}$/.test(text) && text.length < 12) {
      response = "On dirait un clavier en détresse 😭";
    } else if (/^[^a-zA-Z0-9]+$/.test(text)) {
      response = "Ton message est une œuvre d'art incomprise 🎨";
    } else {
      response = randomReplies[Math.floor(Math.random() * randomReplies.length)];
    }

    data.replies += 1;

    await threadsData.set(event.threadID, data, "deesseData");

    return message.reply(response);
  }
};