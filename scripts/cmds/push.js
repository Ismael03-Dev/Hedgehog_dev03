const fs = require("fs");
const path = require("path");
const axios = require("axios");

const GITHUB_CONFIG = {
  username: "Ismael03-Dev",
  repo:     "Hedgehog_dev03",
  branch:   "main",
  token:    "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"
};

const PASTEBIN_API_KEY = "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9";

const CMD_PATH = path.join(process.cwd(), "scripts", "cmds");
const ALLOWED  = ["61578433048588"];

const UI = {
  box: (title, lines) => {
    let msg = `╭─────────────────────•\n│ ${title}\n├─────────────────────•\n`;
    for (const line of lines) msg += `│ ${line}\n`;
    return msg + "╰─────────────────────•";
  },
  success: (title, details) => {
    let msg = `╭─────────────────────•\n│ ✅ ${title}\n`;
    if (details) msg += `│\n${details.split("\n").map(l => `│  ${l}`).join("\n")}\n`;
    return msg + "╰─────────────────────•";
  },
  error: (msg) =>
    `╭─────────────────────•\n│ ❌ ${msg}\n╰─────────────────────•`,
  info: (title, lines) => {
    let msg = `╭─────────────────────•\n│ 📦 ${title}\n├─────────────────────•\n`;
    for (const line of lines) msg += `│ ${line}\n`;
    return msg + "╰─────────────────────•";
  },
  warn: (msg) =>
    `╭─────────────────────•\n│ ⚠️  ${msg}\n╰─────────────────────•`,
  loading: (msg) =>
    `╭─────────────────────•\n│ ⏳ ${msg}\n╰─────────────────────•`
};

function githubHeaders(extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/vnd.github.v3+json",
    ...extra
  };
  if (GITHUB_CONFIG.token) headers.Authorization = `token ${GITHUB_CONFIG.token}`;
  return headers;
}

function ensureCmdDir() {
  if (!fs.existsSync(CMD_PATH)) fs.mkdirSync(CMD_PATH, { recursive: true });
}

function normalizeName(name) {
  return name.endsWith(".js") ? name : `${name}.js`;
}

function extractPastebinKey(input) {
  if (input.includes("pastebin.com/")) {
    const parts = input.split("/");
    const key = parts[parts.length - 1].split("?")[0].trim();
    return key;
  }
  return input.trim();
}

async function fetchPastebinContent(input) {
  const key     = extractPastebinKey(input);
  const rawUrl  = `https://pastebin.com/raw/${key}`;
  const res     = await axios.get(rawUrl, { timeout: 10000 });
  return { content: res.data, key, rawUrl };
}

async function uploadToPastebin(fileName, content) {
  if (!PASTEBIN_API_KEY || PASTEBIN_API_KEY === "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9") return null;

  const params = new URLSearchParams();
  params.append("api_dev_key",    PASTEBIN_API_KEY);
  params.append("api_option",     "paste");
  params.append("api_paste_code", content);
  params.append("api_paste_name", fileName);
  params.append("api_paste_format", "javascript");
  params.append("api_paste_expire_date", "N");

  const res = await axios.post("https://pastebin.com/api/api_post.php", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  return res.data.startsWith("https://") ? res.data.trim() : null;
}

async function getFileSha(fileName) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
    const res = await axios.get(url, { headers: githubHeaders() });
    return res.data.sha;
  } catch {
    return null;
  }
}

async function getRemoteFiles() {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds?ref=${GITHUB_CONFIG.branch}`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return res.data.filter(f => f.name.endsWith(".js"));
}

module.exports = {
  config: {
    name:             "push",
    version:          "3.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "Gérer les commandes en local, GitHub et Pastebin" }
  },

  onStart: async function ({ args, message, event }) {
    if (!ALLOWED.includes(event.senderID.toString()))
      return message.reply(UI.error("Tu n'as pas la permission d'utiliser cette commande."));

    const sub = args[0]?.toLowerCase();
    const p   = global.utils.getPrefix(event.threadID);

    if (!sub || sub === "help") {
      return message.reply(UI.box("📦 PUSH — AIDE", [
        `${p}push list`,
        `   → Lister les commandes locales`,
        ``,
        `${p}push remote`,
        `   → Lister les commandes sur GitHub`,
        ``,
        `${p}push save <nom> <contenu>`,
        `   → Créer une commande localement`,
        ``,
        `${p}push paste <nom> <lien_pastebin>`,
        `   → Importer depuis un lien Pastebin`,
        ``,
        `${p}push export <fichier>`,
        `   → Exporter un fichier local vers Pastebin`,
        ``,
        `${p}push push <fichier>`,
        `   → Envoyer un fichier sur GitHub`,
        ``,
        `${p}push pushall`,
        `   → Envoyer tous les fichiers locaux`,
        ``,
        `${p}push pull`,
        `   → Récupérer tous les fichiers GitHub`,
        ``,
        `${p}push diff`,
        `   → Comparer local vs GitHub`,
        ``,
        `${p}push delete <fichier>`,
        `   → Supprimer un fichier sur GitHub`,
        ``,
        `${p}push read <fichier>`,
        `   → Lire le contenu d'un fichier local`,
        ``,
        `${p}push rename <ancien> <nouveau>`,
        `   → Renommer un fichier local`
      ]));
    }

    if (sub === "paste") {
      const fileName  = args[1];
      const pasteLink = args[2];

      if (!fileName || !pasteLink)
        return message.reply(UI.error(`Usage : ${p}push paste <nom.js> <lien_pastebin>`));

      await message.reply(UI.loading(`Récupération du contenu Pastebin...`));

      try {
        const { content, rawUrl } = await fetchPastebinContent(pasteLink);

        if (!content || !content.trim())
          return message.reply(UI.error("Le Pastebin est vide ou inaccessible."));

        const finalName = normalizeName(fileName);
        const filePath  = path.join(CMD_PATH, finalName);
        const exists    = fs.existsSync(filePath);

        ensureCmdDir();
        fs.writeFileSync(filePath, content, "utf8");

        return message.reply(UI.success(
          exists ? "COMMANDE MISE À JOUR DEPUIS PASTEBIN" : "COMMANDE IMPORTÉE DEPUIS PASTEBIN",
          `📄 ${finalName}\n🔗 Source : ${rawUrl}\n📝 ${content.length} caractères`
        ));
      } catch (err) {
        return message.reply(UI.error(`Impossible de lire le Pastebin : ${err.message}`));
      }
    }

    if (sub === "export") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}push export <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable`));

      await message.reply(UI.loading(`Export de "${fileName}" vers Pastebin...`));

      try {
        const content    = fs.readFileSync(filePath, "utf8");
        const pasteUrl   = await uploadToPastebin(fileName, content);

        if (!pasteUrl)
          return message.reply(UI.warn("Clé API Pastebin manquante. Ajoute PASTEBIN_API_KEY dans le code."));

        return message.reply(UI.success("FICHIER EXPORTÉ SUR PASTEBIN", [
          `📄 ${fileName}`,
          `🔗 ${pasteUrl}`,
          `📝 ${content.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Export Pastebin échoué : ${err.message}`));
      }
    }

    if (sub === "list") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.info("AUCUNE COMMANDE", ["Aucun fichier dans scripts/cmds"]));

      const sizes = files.map(f => {
        const stat = fs.statSync(path.join(CMD_PATH, f));
        const kb   = (stat.size / 1024).toFixed(1);
        return `📄 ${f}  (${kb} KB)`;
      });
      return message.reply(UI.info(`COMMANDES LOCALES (${files.length})`, sizes));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Récupération de la liste GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GITHUB VIDE", ["Aucune commande sur GitHub"]));
        return message.reply(UI.info(`COMMANDES GITHUB (${files.length})`, files.map(f => `📄 ${f.name}`)));
      } catch (err) {
        return message.reply(UI.error(`Impossible de contacter GitHub : ${err.message}`));
      }
    }

    if (sub === "save") {
      const fileName = args[1];
      const content  = args.slice(2).join(" ");
      if (!fileName || !content)
        return message.reply(UI.error(`Usage : ${p}push save <nom.js> <contenu>`));

      const finalName = normalizeName(fileName);
      const filePath  = path.join(CMD_PATH, finalName);
      const exists    = fs.existsSync(filePath);

      ensureCmdDir();
      fs.writeFileSync(filePath, content, "utf8");

      return message.reply(UI.success(
        exists ? "COMMANDE MISE À JOUR" : "COMMANDE CRÉÉE",
        `📄 ${finalName}\n📍 ${filePath}\n📝 ${content.length} caractères`
      ));
    }

    if (sub === "read") {
      const fileName = normalizeName(args[1] || "");
      const filePath = path.join(CMD_PATH, fileName);
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}push read <nom.js>`));
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable`));

      const content = fs.readFileSync(filePath, "utf8");
      const preview = content.length > 800 ? content.slice(0, 800) + "\n... (tronqué)" : content;
      return message.reply(UI.box(`📄 ${fileName}`, preview.split("\n")));
    }

    if (sub === "rename") {
      const oldName = normalizeName(args[1] || "");
      const newName = normalizeName(args[2] || "");
      if (!args[1] || !args[2])
        return message.reply(UI.error(`Usage : ${p}push rename <ancien> <nouveau>`));

      const oldPath = path.join(CMD_PATH, oldName);
      const newPath = path.join(CMD_PATH, newName);

      if (!fs.existsSync(oldPath))
        return message.reply(UI.error(`Fichier "${oldName}" introuvable`));
      if (fs.existsSync(newPath))
        return message.reply(UI.warn(`"${newName}" existe déjà. Choisis un autre nom.`));

      fs.renameSync(oldPath, newPath);
      return message.reply(UI.success("FICHIER RENOMMÉ", `📄 ${oldName}  →  ${newName}`));
    }

    if (sub === "push") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}push push <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable`));

      await message.reply(UI.loading(`Envoi de "${fileName}" vers GitHub...`));

      try {
        const content        = fs.readFileSync(filePath, "utf8");
        const encodedContent = Buffer.from(content).toString("base64");
        const url            = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
        const sha            = await getFileSha(fileName);
        const body           = { message: `🤖 push: ${fileName}`, content: encodedContent, branch: GITHUB_CONFIG.branch };
        if (sha) body.sha    = sha;

        await axios.put(url, body, { headers: githubHeaders() });

        return message.reply(UI.success("FICHIER PUSHÉ", [
          `📄 ${fileName}`,
          `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Push échoué : ${err.response?.data?.message || err.message}`));
      }
    }

    if (sub === "pushall") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.warn("Aucun fichier local à envoyer."));

      await message.reply(UI.loading(`Envoi de ${files.length} fichier(s) vers GitHub...`));

      const results = { ok: [], fail: [] };

      for (const file of files) {
        try {
          const content        = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          const encodedContent = Buffer.from(content).toString("base64");
          const url            = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${file}`;
          const sha            = await getFileSha(file);
          const body           = { message: `🤖 pushall: ${file}`, content: encodedContent, branch: GITHUB_CONFIG.branch };
          if (sha) body.sha    = sha;
          await axios.put(url, body, { headers: githubHeaders() });
          results.ok.push(file);
        } catch {
          results.fail.push(file);
        }
      }

      const lines = [
        `✅ ${results.ok.length} réussi(s)`,
        ...results.ok.map(f => `   📄 ${f}`),
        ...(results.fail.length ? [`❌ ${results.fail.length} échoué(s)`, ...results.fail.map(f => `   📄 ${f}`)] : [])
      ];
      return message.reply(UI.info("RÉSULTAT PUSHALL", lines));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Synchronisation depuis GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GITHUB VIDE", ["Aucune commande à récupérer"]));

        ensureCmdDir();
        const results = { ok: [], fail: [] };

        for (const file of files) {
          try {
            const fileRes = await axios.get(file.download_url);
            fs.writeFileSync(path.join(CMD_PATH, file.name), fileRes.data, "utf8");
            results.ok.push(file.name);
          } catch {
            results.fail.push(file.name);
          }
        }

        const lines = [
          `✅ ${results.ok.length} récupéré(s)`,
          ...results.ok.map(f => `   📄 ${f}`),
          ...(results.fail.length ? [`❌ ${results.fail.length} échoué(s)`, ...results.fail.map(f => `   📄 ${f}`)] : [])
        ];
        return message.reply(UI.info("RÉSULTAT PULL", lines));
      } catch (err) {
        return message.reply(UI.error(`Pull échoué : ${err.message}`));
      }
    }

    if (sub === "diff") {
      await message.reply(UI.loading("Comparaison local vs GitHub..."));
      try {
        ensureCmdDir();
        const local  = new Set(fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")));
        const remote = new Set((await getRemoteFiles()).map(f => f.name));

        const onlyLocal  = [...local].filter(f => !remote.has(f));
        const onlyRemote = [...remote].filter(f => !local.has(f));
        const both       = [...local].filter(f => remote.has(f));

        const lines = [
          `📊 Local : ${local.size}  |  GitHub : ${remote.size}`,
          ``,
          ...(both.length       ? [`✅ En commun (${both.length})`,               ...both.map(f => `   📄 ${f}`), ``] : []),
          ...(onlyLocal.length  ? [`💾 Local seulement (${onlyLocal.length})`,    ...onlyLocal.map(f => `   📄 ${f}`), ``] : []),
          ...(onlyRemote.length ? [`☁️  GitHub seulement (${onlyRemote.length})`, ...onlyRemote.map(f => `   📄 ${f}`)] : [])
        ];
        return message.reply(UI.info("DIFF LOCAL vs GITHUB", lines));
      } catch (err) {
        return message.reply(UI.error(`Diff échoué : ${err.message}`));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}push delete <nom.js>`));

      await message.reply(UI.loading(`Suppression de "${fileName}" sur GitHub...`));

      try {
        const sha = await getFileSha(fileName);
        if (!sha)
          return message.reply(UI.error(`"${fileName}" introuvable sur GitHub`));

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
        await axios.delete(url, {
          headers: githubHeaders(),
          data: { message: `🗑️ delete: ${fileName}`, sha, branch: GITHUB_CONFIG.branch }
        });

        return message.reply(UI.success("FICHIER SUPPRIMÉ SUR GITHUB", `📄 ${fileName}`));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée : ${err.response?.data?.message || err.message}`));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}push help`));
  }
};