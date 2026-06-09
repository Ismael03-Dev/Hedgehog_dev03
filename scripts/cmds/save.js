const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "save",
    aliases: ["save", "push", "github"],
    version: "1.0",
    author: "Master Charbel",
    countDown: 10,
    role: 2,
    shortDescription: "📤 Sauvegarde sur GitHub",
    longDescription: "Sauvegarde un fichier de commande directement sur ton repo GitHub.",
    category: "admin",
    guide: "{pn} <nom_fichier> ou {pn} all (toutes les cmd)"
  },

  onStart: async function ({ message, args, api, event }) {
    // ⚠️ CONFIGURATION GITHUB ⚠️
    const GITHUB_TOKEN = "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";
    const REPO_OWNER = "charl20000";
    const REPO_NAME = "master-bot-v2";
    const BRANCH = "main";
    const CMD_FOLDER = "scripts/cmds/";

    if (!args[0]) {
      return message.reply(
        `╔══════════════════════════╗\n` +
        `║  ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌  ║\n` +
        `╠══════════════════════════╣\n` +
        `║  Usage :               ║\n` +
        `║  ${global.utils.getPrefix(event.threadID)}backup <fichier>\n` +
        `║  ${global.utils.getPrefix(event.threadID)}backup all\n` +
        `╚══════════════════════════╝`
      );
    }

    if (GITHUB_TOKEN === "ghp_TON_TOKEN_ICI") {
      return message.reply("⚠️ Configure d'abord ton token GitHub dans le code !");
    }

    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    };

    const getFileSHA = async (filePath) => {
      try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`;
        const res = await axios.get(url, { headers });
        return res.data.sha;
      } catch {
        return null;
      }
    };

    const uploadFile = async (filePath, content) => {
      const sha = await getFileSHA(filePath);
      const body = {
        message: `⚡ Nexus Backup: ${path.basename(filePath)}`,
        content: Buffer.from(content).toString("base64"),
        branch: BRANCH,
      };
      if (sha) body.sha = sha;

      await axios.put(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
        body,
        { headers }
      );
    };

    // Envoi du message de statut initial
    const statusMsg = await message.reply(
      `╔══════════════════════════╗\n` +
      `║  📤 𝐁𝐀𝐂𝐊𝐔𝐏 𝐆𝐈𝐓𝐇𝐔𝐁 📤  ║\n` +
      `╠══════════════════════════╣\n` +
      `║  ⚡ Connexion...        ║\n` +
      `║  🔄 Upload en cours...  ║\n` +
      `╚══════════════════════════╝`
    );

    const threadID = event.threadID;
    const messageID = statusMsg.messageID;

    // Fonction utilitaire pour éditer le message
    const editMessage = async (newText) => {
      try {
        await api.editMessage(newText, messageID, (err) => {
          if (err) console.error("Erreur editMessage:", err);
        });
      } catch (err) {
        // Fallback : envoyer un nouveau message si l'édition échoue
        await message.reply(newText);
      }
    };

    try {
      const cmdsDir = path.join(__dirname);

      if (args[0].toLowerCase() === "all") {
        const files = fs.readdirSync(cmdsDir).filter(f => f.endsWith(".js"));
        let uploaded = 0;
        let failed = 0;

        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(cmdsDir, file), "utf8");
            await uploadFile(`${CMD_FOLDER}${file}`, content);
            uploaded++;
            await new Promise(r => setTimeout(r, 500));
          } catch {
            failed++;
          }
        }

        await editMessage(
          `╔══════════════════════════╗\n` +
          `║  ✅ 𝐁𝐀𝐂𝐊𝐔𝐏 𝐓𝐄𝐑𝐌𝐈𝐍É ✅  ║\n` +
          `╠══════════════════════════╣\n` +
          `║  📤 Uploadés : ${uploaded}/${files.length}\n` +
          `║  ❌ Échecs : ${failed}\n` +
          `║  📂 Repo : ${REPO_OWNER}/${REPO_NAME}\n` +
          `║  👤 Master Charbel     ║\n` +
          `╚══════════════════════════╝`
        );
      } else {
        let fileName = args[0];
        if (!fileName.endsWith(".js")) fileName += ".js";

        const filePath = path.join(cmdsDir, fileName);

        if (!fs.existsSync(filePath)) {
          await editMessage(
            `╔══════════════════════════╗\n` +
            `║  ❌ Fichier introuvable  ║\n` +
            `║  📁 ${fileName}          ║\n` +
            `╚══════════════════════════╝`
          );
          return;
        }

        const content = fs.readFileSync(filePath, "utf8");
        await uploadFile(`${CMD_FOLDER}${fileName}`, content);

        await editMessage(
          `╔══════════════════════════╗\n` +
          `║  ✅ 𝐁𝐀𝐂𝐊𝐔𝐏 𝐑É𝐔𝐒𝐒𝐈 ✅  ║\n` +
          `╠══════════════════════════╣\n` +
          `║  📄 ${fileName}\n` +
          `║  📂 ${REPO_OWNER}/${REPO_NAME}\n` +
          `║  📍 ${CMD_FOLDER}${fileName}\n` +
          `║  👤 Master Charbel     ║\n` +
          `╚══════════════════════════╝`
        );
      }
    } catch (err) {
      await editMessage(
        `╔══════════════════════════╗\n` +
        `║  ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌  ║\n` +
        `╠══════════════════════════╣\n` +
        `║  ${err.message.slice(0, 30)}\n` +
        `║  Vérifie ton token !  ║\n` +
        `╚══════════════════════════╝`
      );
    }
  }
};
