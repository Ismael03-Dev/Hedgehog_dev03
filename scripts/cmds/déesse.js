module.exports = {
  config: {
    name: "déesse",
    version: "1.2",
    author: "𝕿𝖍𝖊 𝖁𝖔𝖎𝖉 𝕶𝖚𝖓 クン",
    countDown: 5,
    role: 1,
    shortDescription: "Mode Déesse IA",
    longDescription: "Active une IA fun qui répond automatiquement dans le groupe",
    category: "fun"
  },

  onStart: async function ({ args, threadsData, message, event }) {

    const status = await threadsData.get(event.threadID, "settings.deesse");

    
    if (args[0] === "on") {
      await threadsData.set(event.threadID, true, "settings.deesse");

       threadsData.set(event.threadID, Date.now(), "deesseData.startTime");

      return message.reply(
`╭────── ✦ ──────╮
🌸 La Déesse s'éveille...

✨ Mode Déesse activé.
╰────── ✦ ──────╯`
      );
    }


    if (args[0] === "off") {
      await threadsData.set(event.threadID, false, "settings.deesse");

      return message.reply(
`╭────── ✦ ──────╮
🌙 La Déesse retourne dormir...

✨ Mode Déesse désactivé.
╰────── ✦ ──────╯`
      );
    }

    
    if (args[0] === "statut") {
      const data = await threadsData.get(event.threadID, "deesseData") || {};

      const start = data.startTime || 0;
      const uptime = start ? Date.now() - start : 0;

      const formatTime = (ms) => {
        let s = Math.floor(ms / 1000);
        let h = Math.floor(s / 3600);
        let m = Math.floor((s % 3600) / 60);
        s = s % 60;
        return `${h}h ${m}min ${s}s`;
      };

      const date = start ? new Date(start) : new Date();
      const dateFormat =
        `${String(date.getDate()).padStart(2, "0")}/` +
        `${String(date.getMonth() + 1).padStart(2, "0")}/` +
        `${date.getFullYear()} - ` +
        `${String(date.getHours()).padStart(2, "0")}:` +
        `${String(date.getMinutes()).padStart(2, "0")}`;

      
      let threadName = event.threadID || "Groupe inconnu";

      return message.reply(
`╭────── ✦ ──────╮
🌸 𝐒𝐓𝐀𝐓𝐔𝐓 𝐃𝐄 𝐋𝐀 𝐃𝐄́𝐄𝐒𝐒𝐄
╰────── ✦ ──────╯

✨ État : ${status ? "🟢 En ligne " : "Inactive 🌙"}

🕒 Réveillée depuis :
${start ? formatTime(uptime) : "0h 0min 0s"}

📅 Date d'éveil :
${start ? dateFormat : "Non définie"}

💬 Messages analysés :
${data.messages || 0}

🌸 Réponses envoyées :
${data.replies || 0}

👥 Utilisateurs différents observés :
${(data.users || []).length}

🏆 Groupe :
${threadName}

╭────── ✦ ──────╮
La Déesse veille toujours...
╰────── ✦ ──────╯`
      );
    }
  },

  onChat: async function ({ event, message, threadsData }) {

    const enabled = await threadsData.get(event.threadID, "settings.deesse");
    if (!enabled) return;

    const text = event.body?.toLowerCase();
    if (!text) return;

    if (text.length > 8888) return;
    if (text.length < 6) return;
    if (text.startsWith("/")) return;

    
    const CHANCE_REPLY = 0.70;
    if (Math.random() > CHANCE_REPLY) return;

    let data = await threadsData.get(event.threadID, "deesseData") || {};

    data.messages = (data.messages || 0) + 1;
    data.replies = data.replies || 0;
    data.users = data.users || [];

    if (!data.users.includes(event.senderID)) {
      data.users.push(event.senderID);
    }

    const randomReplies = [
      "J'espère que tu as réfléchi avant d'écrire ça 👀",
      "Intéressant... enfin je crois.",
      "Tu es sûr de toi ou tu tapes au hasard ? 😏",
      "Même mon sommeil était plus logique que ça.",
      "Continue, je t'observe."
    ];

    let response;

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