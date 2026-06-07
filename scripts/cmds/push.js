const fs = require("fs");
const path = require("path");
const axios = require("axios");

const GITHUB_CONFIG = {
  username: "Ismael03-Dev",
  repo:     "Hedgehog_dev03",
  branch:   "main",
  token:    "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"
};

const GROQ_API_KEY     = "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";
const PASTEBIN_API_KEY = "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9";
const CMD_PATH         = path.join(process.cwd(), "scripts", "cmds");
const HISTORY_PATH     = path.join(process.cwd(), "data", "hedgehog_history.json");
const ALLOWED          = ["61578433048588"];

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
  error:    (msg) => `╭─────────────────────•\n│ ❌ ${msg}\n╰─────────────────────•`,
  info:     (title, lines) => {
    let msg = `╭─────────────────────•\n│ 📦 ${title}\n├─────────────────────•\n`;
    for (const line of lines) msg += `│ ${line}\n`;
    return msg + "╰─────────────────────•";
  },
  hedgehog: (lines) => {
    let msg = `╭─────────────────────•\n│ 🦔 HEDGEHOG GPT\n├─────────────────────•\n`;
    for (const line of lines) msg += `│ ${line}\n`;
    return msg + "╰─────────────────────•";
  },
  warn:     (msg) => `╭─────────────────────•\n│ ⚠️  ${msg}\n╰─────────────────────•`,
  loading:  (msg) => `╭─────────────────────•\n│ ⏳ ${msg}\n╰─────────────────────•`
};

const SYSTEM_PROMPT = `Tu es HedgehogGPT, un assistant IA expert en développement JavaScript et en bots Messenger (GoatBot/fca-unofficial).
Tu as un accès TOTAL au repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} et tu peux lire, analyser, modifier et push n'importe quel fichier.
Tu te souviens de toutes les discussions passées avec l'utilisateur et tu utilises ce contexte pour donner des réponses cohérentes et personnalisées.
Quand on te demande d'améliorer ou modifier un fichier, tu retournes UNIQUEMENT le code final sans explications, sans balises markdown, sans backticks, sans commentaires superflus.
Quand on te demande une analyse ou un avis, tu réponds de façon claire et concise en français.
Tu connais parfaitement la structure des modules GoatBot : config, onStart, onChat, onReply, getLang, message.reply, api, event, etc.
Tu peux aussi créer de nouveaux fichiers de commandes GoatBot à la demande.`;

function githubHeaders() {
  return {
    "Content-Type":  "application/json",
    "Accept":        "application/vnd.github.v3+json",
    "Authorization": `token ${GITHUB_CONFIG.token}`
  };
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
    return parts[parts.length - 1].split("?")[0].trim();
  }
  return input.trim();
}

async function fetchPastebinContent(input) {
  const key    = extractPastebinKey(input);
  const rawUrl = `https://pastebin.com/raw/${key}`;
  const res    = await axios.get(rawUrl, { timeout: 10000 });
  return { content: res.data, key, rawUrl };
}

async function uploadToPastebin(fileName, content) {
  const params = new URLSearchParams();
  params.append("api_dev_key",           PASTEBIN_API_KEY);
  params.append("api_option",            "paste");
  params.append("api_paste_code",        content);
  params.append("api_paste_name",        fileName);
  params.append("api_paste_format",      "javascript");
  params.append("api_paste_expire_date", "N");

  const res = await axios.post("https://pastebin.com/api/api_post.php", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  return res.data.startsWith("https://") ? res.data.trim() : null;
}

async function verifyToken() {
  try {
    const res = await axios.get("https://api.github.com/user", { headers: githubHeaders() });
    return { valid: true, user: res.data.login };
  } catch (err) {
    const status = err.response?.status;
    if (status === 401) return { valid: false, reason: "Token invalide ou expiré" };
    if (status === 403) return { valid: false, reason: "Token sans permission d'écriture" };
    return { valid: false, reason: err.message };
  }
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

async function getFileContent(fileName) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

async function pushFileToGithub(fileName, content, commitMsg) {
  const tokenCheck = await verifyToken();
  if (!tokenCheck.valid)
    throw new Error(`Token GitHub invalide : ${tokenCheck.reason}`);

  const url            = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const encodedContent = Buffer.from(content).toString("base64");
  const sha            = await getFileSha(fileName);
  const body           = {
    message: commitMsg || `🤖 push: ${fileName}`,
    content: encodedContent,
    branch:  GITHUB_CONFIG.branch
  };
  if (sha) body.sha = sha;

  try {
    await axios.put(url, body, { headers: githubHeaders() });
    return { success: true };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

async function deleteFileOnGithub(fileName) {
  const tokenCheck = await verifyToken();
  if (!tokenCheck.valid)
    throw new Error(`Token GitHub invalide : ${tokenCheck.reason}`);

  const sha = await getFileSha(fileName);
  if (!sha) throw new Error(`"${fileName}" introuvable sur GitHub`);

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  await axios.delete(url, {
    headers: githubHeaders(),
    data:    { message: `🗑️ delete: ${fileName}`, sha, branch: GITHUB_CONFIG.branch }
  });
}

async function askHedgehog(history, userMessage) {
  history.push({ role: "user", content: userMessage });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-16)
  ];

  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model:       "llama-3.3-70b-versatile",
      messages:    messages,
      max_tokens:  4096,
      temperature: 0.3
    },
    {
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      timeout: 60000
    }
  );

  const reply = res.data.choices[0].message.content;
  if (!reply || reply.trim() === "") throw new Error("Réponse vide de l'IA");

  history.push({ role: "assistant", content: reply });
  if (history.length > 32) history.splice(0, 2);

  return reply;
}

module.exports = {
  config: {
    name:             "push",
    version:          "11.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "Gérer le repo GitHub + HedgehogGPT avec mémoire persistante" }
  },

  hedgehogHistory: {},

  loadHistory: function () {
    try {
      if (!fs.existsSync(path.dirname(HISTORY_PATH)))
        fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
      if (!fs.existsSync(HISTORY_PATH)) return {};
      return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    } catch {
      return {};
    }
  },

  saveHistory: function () {
    try {
      if (!fs.existsSync(path.dirname(HISTORY_PATH)))
        fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.hedgehogHistory, null, 2), "utf8");
    } catch {}
  },

  onChat: async function ({ message, event }) {
    if (!ALLOWED.includes(event.senderID.toString())) return;

    const body = event.body?.trim() || "";
    if (!body.toLowerCase().startsWith("hedgehog")) return;

    const uid   = event.senderID.toString();
    const query = body.slice(8).trim();

    if (!this.hedgehogHistory[uid]) {
      const saved = this.loadHistory();
      this.hedgehogHistory[uid] = saved[uid] || [];
    }

    if (!query || query.toLowerCase() === "help") {
      return message.reply(UI.box("🦔 HEDGEHOG GPT — AIDE", [
        `Hedgehog <message>`,
        `   → Discuter librement (avec mémoire)`,
        ``,
        `Hedgehog analyse <fichier|*>`,
        `   → Analyser un ou tous les fichiers`,
        ``,
        `Hedgehog fix <fichier|*>`,
        `   → Corriger + push un ou tous les fichiers`,
        ``,
        `Hedgehog create <nom> <description>`,
        `   → Créer un nouveau fichier de commande`,
        ``,
        `Hedgehog review <fichier>`,
        `   → Code review détaillée avec score`,
        ``,
        `Hedgehog compare <fichier1> <fichier2>`,
        `   → Comparer deux fichiers`,
        ``,
        `Hedgehog refactor <fichier>`,
        `   → Refactoriser sans changer le comportement`,
        ``,
        `Hedgehog list`,
        `   → Lister les fichiers du repo`,
        ``,
        `Hedgehog token`,
        `   → Vérifier le token GitHub`,
        ``,
        `Hedgehog reset`,
        `   → Effacer la mémoire de conversation`
      ]));
    }

    if (query.toLowerCase() === "reset") {
      this.hedgehogHistory[uid] = [];
      this.saveHistory();
      return message.reply(UI.success("MÉMOIRE EFFACÉE", "HedgehogGPT a oublié toute la conversation."));
    }

    if (query.toLowerCase() === "token") {
      await message.reply(UI.loading("Vérification du token GitHub..."));
      const check = await verifyToken();
      if (check.valid)
        return message.reply(UI.success("TOKEN VALIDE", `👤 Connecté en tant que : ${check.user}\n🔗 Repo : ${GITHUB_CONFIG.repo}`));
      return message.reply(UI.error(`Token invalide : ${check.reason}`));
    }

    if (query.toLowerCase() === "list") {
      await message.reply(UI.loading("Récupération des fichiers GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.warn("Aucun fichier trouvé sur GitHub."));
        return message.reply(UI.info(`FICHIERS DU REPO (${files.length})`, files.map(f => {
          const kb = (f.size / 1024).toFixed(1);
          return `📄 ${f.name}  (${kb} KB)`;
        })));
      } catch (err) {
        return message.reply(UI.error(`Impossible de récupérer la liste : ${err.message}`));
      }
    }

    const analyseMatch = query.match(/^analyse\s+(.+)$/i);
    if (analyseMatch) {
      const target = analyseMatch[1].trim();
      await message.reply(UI.loading("HedgehogGPT analyse le code..."));

      try {
        let prompt = "";

        if (target === "*") {
          const files    = await getRemoteFiles();
          const samples  = files.slice(0, 5);
          const contents = await Promise.all(samples.map(async f => {
            const code = await getFileContent(f.name);
            return `=== ${f.name} ===\n${code.slice(0, 1500)}`;
          }));
          prompt = `Analyse globale du repository ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (${files.length} fichiers, échantillon de ${samples.length}) :\n\n${contents.join("\n\n")}\n\nRapport global : qualité du code, patterns, problèmes récurrents, recommandations prioritaires.`;
        } else {
          const fileName = normalizeName(target);
          const code     = await getFileContent(fileName);
          prompt = `Analyse ce fichier GoatBot du repo ${GITHUB_CONFIG.repo} :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nDonne une analyse complète : structure, qualité, bugs potentiels, points d'amélioration.`;
        }

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply.split("\n").filter(l => l.trim())));
      } catch (err) {
        return message.reply(UI.error(`Analyse échouée : ${err.message}`));
      }
    }

    const fixMatch = query.match(/^fix\s+(.+)$/i);
    if (fixMatch) {
      const target = fixMatch[1].trim();
      await message.reply(UI.loading("HedgehogGPT améliore et push le code..."));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token GitHub invalide : ${tokenCheck.reason}`));

        if (target === "*") {
          const files   = await getRemoteFiles();
          const results = { ok: [], fail: [] };

          for (const file of files) {
            try {
              const code    = await getFileContent(file.name);
              const prompt  = `Améliore et corrige ce fichier GoatBot. Retourne UNIQUEMENT le code final, sans explication, sans backticks, sans markdown :\n\n${code}`;
              const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
              await pushFileToGithub(file.name, newCode, `🦔 HedgehogGPT: amélioration de ${file.name}`);
              results.ok.push(file.name);
            } catch (e) {
              results.fail.push(`${file.name} (${e.message})`);
            }
          }

          this.saveHistory();
          return message.reply(UI.info("FIX GLOBAL TERMINÉ", [
            `✅ ${results.ok.length} fichier(s) amélioré(s) et pushé(s)`,
            ...results.ok.map(f => `   📄 ${f}`),
            ...(results.fail.length ? [`❌ ${results.fail.length} échoué(s)`, ...results.fail.map(f => `   ⚠️ ${f}`)] : [])
          ]));
        }

        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Améliore et corrige ce fichier GoatBot. Retourne UNIQUEMENT le code final, sans explication, sans backticks, sans markdown :\n\nFichier : ${fileName}\n${code}`;
        const newCode  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 HedgehogGPT: amélioration de ${fileName}`);
        this.saveHistory();

        return message.reply(UI.success("FICHIER AMÉLIORÉ ET PUSHÉ", [
          `📄 ${fileName}`,
          `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`,
          `📝 ${newCode.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Fix échoué : ${err.message}`));
      }
    }

    const createMatch = query.match(/^create\s+(\S+)\s+(.+)$/i);
    if (createMatch) {
      const fileName    = normalizeName(createMatch[1].trim());
      const description = createMatch[2].trim();
      await message.reply(UI.loading(`HedgehogGPT crée "${fileName}"...`));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token GitHub invalide : ${tokenCheck.reason}`));

        const prompt  = `Crée un fichier de commande GoatBot complet et fonctionnel nommé "${fileName}" avec la description suivante : ${description}\n\nRetourne UNIQUEMENT le code complet, sans explication, sans backticks, sans markdown. Le fichier doit respecter la structure GoatBot standard avec config, onStart, etc.`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 HedgehogGPT: création de ${fileName}`);

        ensureCmdDir();
        fs.writeFileSync(path.join(CMD_PATH, fileName), newCode, "utf8");
        this.saveHistory();

        return message.reply(UI.success("COMMANDE CRÉÉE ET PUSHÉE", [
          `📄 ${fileName}`,
          `📝 ${description}`,
          `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`,
          `📊 ${newCode.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Création échouée : ${err.message}`));
      }
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const target = reviewMatch[1].trim();
      await message.reply(UI.loading("HedgehogGPT fait la code review..."));

      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Code review professionnelle de ce fichier GoatBot :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nStructure ta réponse :\n1. Points positifs\n2. Bugs détectés\n3. Problèmes de performance\n4. Suggestions d'amélioration\n5. Score global /10`;

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply.split("\n").filter(l => l.trim())));
      } catch (err) {
        return message.reply(UI.error(`Review échouée : ${err.message}`));
      }
    }

    const refactorMatch = query.match(/^refactor\s+(.+)$/i);
    if (refactorMatch) {
      const target = refactorMatch[1].trim();
      await message.reply(UI.loading("HedgehogGPT refactorise le code..."));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token GitHub invalide : ${tokenCheck.reason}`));

        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Refactorise ce fichier GoatBot sans changer son comportement. Améliore la lisibilité, réduis la duplication, optimise la structure. Retourne UNIQUEMENT le code refactorisé, sans explication, sans backticks :\n\nFichier : ${fileName}\n${code}`;
        const newCode  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 HedgehogGPT: refactoring de ${fileName}`);
        this.saveHistory();

        return message.reply(UI.success("FICHIER REFACTORISÉ ET PUSHÉ", [
          `📄 ${fileName}`,
          `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`,
          `📝 ${newCode.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Refactor échoué : ${err.message}`));
      }
    }

    const compareMatch = query.match(/^compare\s+(\S+)\s+(\S+)$/i);
    if (compareMatch) {
      const file1 = normalizeName(compareMatch[1].trim());
      const file2 = normalizeName(compareMatch[2].trim());
      await message.reply(UI.loading(`Comparaison de ${file1} et ${file2}...`));

      try {
        const [code1, code2] = await Promise.all([
          getFileContent(file1),
          getFileContent(file2)
        ]);

        const prompt = `Compare ces deux fichiers GoatBot et donne une analyse comparative :\n\n=== ${file1} ===\n${code1.slice(0, 2000)}\n\n=== ${file2} ===\n${code2.slice(0, 2000)}\n\nPoints à comparer : structure, qualité, performance, style de code, lequel est le meilleur et pourquoi.`;
        const reply  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply.split("\n").filter(l => l.trim())));
      } catch (err) {
        return message.reply(UI.error(`Comparaison échouée : ${err.message}`));
      }
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));

    try {
      const repoContext = `Tu as accès complet au repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (branche: ${GITHUB_CONFIG.branch}). Tu te souviens de toute notre conversation précédente.`;
      const reply       = await askHedgehog(this.hedgehogHistory[uid], `${repoContext}\n\n${query}`);
      this.saveHistory();
      return message.reply(UI.hedgehog(reply.split("\n").filter(l => l.trim())));
    } catch (err) {
      return message.reply(UI.error(`HedgehogGPT indisponible : ${err.message}`));
    }
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
        `${p}push paste <nom> <lien>`,
        `   → Importer depuis Pastebin`,
        ``,
        `${p}push paste <nom> <lien> --push`,
        `   → Importer depuis Pastebin + push GitHub`,
        ``,
        `${p}push export <fichier>`,
        `   → Exporter un fichier vers Pastebin`,
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
        `${p}push sync`,
        `   → Synchronisation complète`,
        ``,
        `${p}push diff`,
        `   → Comparer local vs GitHub`,
        ``,
        `${p}push delete <fichier>`,
        `   → Supprimer un fichier sur GitHub`,
        ``,
        `${p}push rename <ancien> <nouveau>`,
        `   → Renommer un fichier local`,
        ``,
        `${p}push info`,
        `   → Infos du dépôt GitHub`,
        ``,
        `${p}push token`,
        `   → Vérifier le token GitHub`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━`,
        `🦔 HedgehogGPT : tape`,
        `   "Hedgehog <message>"`,
        `   sans prefix !`
      ]));
    }

    if (sub === "token") {
      await message.reply(UI.loading("Vérification du token GitHub..."));
      const check = await verifyToken();
      if (check.valid)
        return message.reply(UI.success("TOKEN VALIDE", `👤 Connecté en tant que : ${check.user}\n🔗 Repo : ${GITHUB_CONFIG.repo}`));
      return message.reply(UI.error(`Token invalide : ${check.reason}\nMets à jour GITHUB_CONFIG.token dans le code.`));
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

    if (sub === "paste") {
      const fileName  = args[1];
      const pasteLink = args[2];
      const autoPush  = args.includes("--push");

      if (!fileName || !pasteLink)
        return message.reply(UI.error(`Usage : ${p}push paste <nom.js> <lien_pastebin>`));

      await message.reply(UI.loading(`Récupération depuis Pastebin...`));

      try {
        const { content, rawUrl } = await fetchPastebinContent(pasteLink);
        if (!content || !content.trim())
          return message.reply(UI.error("Le Pastebin est vide ou inaccessible."));

        const finalName = normalizeName(fileName);
        const filePath  = path.join(CMD_PATH, finalName);
        const exists    = fs.existsSync(filePath);

        ensureCmdDir();
        fs.writeFileSync(filePath, content, "utf8");

        if (autoPush) {
          await message.reply(UI.loading(`Push de ${finalName} vers GitHub...`));
          try {
            await pushFileToGithub(finalName, content);
            return message.reply(UI.success(
              exists ? "MIS À JOUR + PUSHÉ" : "IMPORTÉ + PUSHÉ",
              `📄 ${finalName}\n🔗 Pastebin : ${rawUrl}\n☁️  GitHub : github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}\n📝 ${content.length} caractères`
            ));
          } catch (err) {
            return message.reply(UI.warn(`Sauvegardé localement mais push échoué : ${err.message}`));
          }
        }

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
        const content  = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);

        if (!pasteUrl)
          return message.reply(UI.warn("Export échoué. Vérifie ta clé API Pastebin."));

        return message.reply(UI.success("FICHIER EXPORTÉ SUR PASTEBIN", [
          `📄 ${fileName}`,
          `🔗 ${pasteUrl}`,
          `📝 ${content.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Export Pastebin échoué : ${err.message}`));
      }
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
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(fileName, content);
        return message.reply(UI.success("FICHIER PUSHÉ", [
          `📄 ${fileName}`,
          `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Push échoué : ${err.message}`));
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
          const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          await pushFileToGithub(file, content);
          results.ok.push(file);
        } catch (e) {
          results.fail.push(`${file} (${e.message})`);
        }
      }

      return message.reply(UI.info("RÉSULTAT PUSHALL", [
        `✅ ${results.ok.length} réussi(s)`,
        ...results.ok.map(f => `   📄 ${f}`),
        ...(results.fail.length ? [`❌ ${results.fail.length} échoué(s)`, ...results.fail.map(f => `   ⚠️ ${f}`)] : [])
      ]));
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

        return message.reply(UI.info("RÉSULTAT PULL", [
          `✅ ${results.ok.length} récupéré(s)`,
          ...results.ok.map(f => `   📄 ${f}`),
          ...(results.fail.length ? [`❌ ${results.fail.length} échoué(s)`, ...results.fail.map(f => `   📄 ${f}`)] : [])
        ]));
      } catch (err) {
        return message.reply(UI.error(`Pull échoué : ${err.message}`));
      }
    }

    if (sub === "sync") {
      await message.reply(UI.loading("Synchronisation complète en cours..."));
      try {
        const remoteFiles = await getRemoteFiles();
        ensureCmdDir();
        const pullResults = { ok: [], fail: [] };

        for (const file of remoteFiles) {
          try {
            const fileRes = await axios.get(file.download_url);
            fs.writeFileSync(path.join(CMD_PATH, file.name), fileRes.data, "utf8");
            pullResults.ok.push(file.name);
          } catch {
            pullResults.fail.push(file.name);
          }
        }

        const localFiles  = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
        const pushResults = { ok: [], fail: [] };

        for (const file of localFiles) {
          try {
            const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
            await pushFileToGithub(file, content);
            pushResults.ok.push(file);
          } catch {
            pushResults.fail.push(file);
          }
        }

        return message.reply(UI.info("SYNC TERMINÉE", [
          `⬇️  Pull : ${pullResults.ok.length} récupéré(s)`,
          ...pullResults.ok.map(f => `   📄 ${f}`),
          ``,
          `⬆️  Push : ${pushResults.ok.length} envoyé(s)`,
          ...pushResults.ok.map(f => `   📄 ${f}`),
          ...(pullResults.fail.length || pushResults.fail.length ? [``, `❌ Échecs : ${pullResults.fail.length + pushResults.fail.length}`] : [])
        ]));
      } catch (err) {
        return message.reply(UI.error(`Sync échouée : ${err.message}`));
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

        return message.reply(UI.info(`COMMANDES GITHUB (${files.length})`, files.map(f => {
          const kb = (f.size / 1024).toFixed(1);
          return `📄 ${f.name}  (${kb} KB)`;
        })));
      } catch (err) {
        return message.reply(UI.error(`Impossible de contacter GitHub : ${err.message}`));
      }
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

    if (sub === "diff") {
      await message.reply(UI.loading("Comparaison local vs GitHub..."));
      try {
        ensureCmdDir();
        const local  = new Set(fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")));
        const remote = new Set((await getRemoteFiles()).map(f => f.name));

        const onlyLocal  = [...local].filter(f => !remote.has(f));
        const onlyRemote = [...remote].filter(f => !local.has(f));
        const both       = [...local].filter(f => remote.has(f));

        return message.reply(UI.info("DIFF LOCAL vs GITHUB", [
          `📊 Local : ${local.size}  |  GitHub : ${remote.size}`,
          ``,
          ...(both.length       ? [`✅ En commun (${both.length})`,               ...both.map(f => `   📄 ${f}`), ``] : []),
          ...(onlyLocal.length  ? [`💾 Local seulement (${onlyLocal.length})`,    ...onlyLocal.map(f => `   📄 ${f}`), ``] : []),
          ...(onlyRemote.length ? [`☁️  GitHub seulement (${onlyRemote.length})`, ...onlyRemote.map(f => `   📄 ${f}`)] : [])
        ]));
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
        await deleteFileOnGithub(fileName);
        return message.reply(UI.success("FICHIER SUPPRIMÉ SUR GITHUB", `📄 ${fileName}`));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée : ${err.message}`));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Récupération des infos GitHub..."));
      try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`;
        const res = await axios.get(url, { headers: githubHeaders() });
        const r   = res.data;

        ensureCmdDir();
        const localCount = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;

        return message.reply(UI.info("INFOS DÉPÔT GITHUB", [
          `👤 Owner   : ${r.owner.login}`,
          `📦 Repo    : ${r.name}`,
          `🌿 Branche : ${GITHUB_CONFIG.branch}`,
          `⭐ Stars   : ${r.stargazers_count}`,
          `🍴 Forks   : ${r.forks_count}`,
          `🔒 Privé   : ${r.private ? "Oui" : "Non"}`,
          ``,
          `📁 Local   : ${localCount} fichier(s)`,
          `🔗 URL     : ${r.html_url}`
        ]));
      } catch (err) {
        return message.reply(UI.error(`Impossible de récupérer les infos : ${err.message}`));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}push help`));
  }
};