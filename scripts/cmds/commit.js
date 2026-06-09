const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas } = require("canvas");

const GITHUB_CONFIG = {
  username: "Ismael03-Dev",
  repo:     "Hedgehog_dev03",
  branch:   "main",
  token:    "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"
};

const MISTRAL_API_KEY  = "VCFZLWLWcxk6SIMIZHa0HjGr2rRwrZhN";
const PASTEBIN_API_KEY = "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9";
const CMD_PATH         = path.join(process.cwd(), "scripts", "cmds");
const HISTORY_PATH     = path.join(process.cwd(), "data", "hedgehog_history.json");
const ALLOWED          = ["61578433048588"];

const UI = {
  frame: (emoji, text) => {
    const lines = text.split("\n");
    if (lines.length === 1)
      return `╭─────────────────────•\n│ ${emoji} ${text}\n╰─────────────────────•`;
    let msg = `╭─────────────────────•\n│ ${emoji} ${lines[0]}\n├─────────────────────•\n`;
    for (let i = 1; i < lines.length; i++) msg += `│ ${lines[i]}\n`;
    return msg + `╰─────────────────────•`;
  },
  success:  (text) => UI.frame("✅", text),
  error:    (text) => UI.frame("❌", text),
  info:     (text) => UI.frame("📦", text),
  hedgehog: (text) => UI.frame("🦔", text),
  warn:     (text) => UI.frame("⚠️", text),
  loading:  (text) => UI.frame("⏳", text)
};

const SYSTEM_PROMPT = `Tu es HedgehogGPT, un assistant IA expert en développement JavaScript et en bots Messenger (GoatBot/fca-unofficial).
Tu as un accès TOTAL au repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (branche: ${GITHUB_CONFIG.branch}).
Tu peux lire, analyser, modifier, créer et supprimer n'importe quel fichier du repository.
Tu te souviens de toutes les discussions passées avec l'utilisateur.

Tes capacités exactes (comme GitHub Copilot) :
- Lire et analyser n'importe quel fichier du repo via l'API GitHub
- Corriger les bugs et pusher directement sur GitHub
- Générer de la documentation JSDoc complète
- Créer des tests unitaires
- Refactoriser et simplifier le code
- Faire des code reviews professionnelles
- Expliquer le code ligne par ligne
- Créer de nouveaux fichiers de commandes GoatBot complets
- Détecter les erreurs de syntaxe automatiquement

Quand tu modifies du code, retourne UNIQUEMENT le code final sans explications, sans backticks, sans markdown.
Pour les analyses et explications, réponds clairement en français.
Tu connais parfaitement GoatBot : config, onStart, onChat, onReply, getLang, message.reply, api, event, etc.`;

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
  if (!Array.isArray(res.data)) return [];
  return res.data.filter(f => f.name.endsWith(".js"));
}

async function getFileContent(fileName) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

async function getFileContentFromUrl(rawUrl) {
  const res = await axios.get(rawUrl, { timeout: 15000 });
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
}

async function pushFileToGithub(fileName, content, commitMsg) {
  const tokenCheck = await verifyToken();
  if (!tokenCheck.valid)
    throw new Error(`Token GitHub invalide : ${tokenCheck.reason}`);

  const url            = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const encodedContent = typeof content === "string"
    ? Buffer.from(content).toString("base64")
    : Buffer.from(fs.readFileSync(content)).toString("base64");
  const sha  = await getFileSha(fileName);
  const body = {
    message: commitMsg || `🦔 HedgehogGPT: commit ${fileName}`,
    content: encodedContent,
    branch:  GITHUB_CONFIG.branch
  };
  if (sha) body.sha = sha;

  try {
    await axios.put(url, body, { headers: githubHeaders() });
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message);
  }
}

async function deleteFileOnGithub(fileName) {
  const sha = await getFileSha(fileName);
  if (!sha) throw new Error(`"${fileName}" introuvable sur GitHub`);

  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  await axios.delete(url, {
    headers: githubHeaders(),
    data:    { message: `🗑️ Delete: ${fileName}`, sha, branch: GITHUB_CONFIG.branch }
  });
}

async function getRepoTree() {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/git/trees/${GITHUB_CONFIG.branch}?recursive=1`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return res.data.tree || [];
}

async function getCommitHistory(fileName) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/commits?path=scripts/cmds/${fileName}&per_page=5`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return res.data;
}

async function askHedgehog(history, userMessage) {
  history.push({ role: "user", content: userMessage });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-16)
  ];

  try {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model:       "mistral-large-latest",
        messages:    messages,
        max_tokens:  4096,
        temperature: 0.3
      },
      {
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${MISTRAL_API_KEY}`
        },
        timeout: 60000
      }
    );

    const reply = res.data.choices[0].message.content;
    if (!reply || reply.trim() === "") throw new Error("Réponse vide");

    history.push({ role: "assistant", content: reply });
    if (history.length > 32) history.splice(0, 2);

    return reply;
  } catch (err) {
    const status   = err.response?.status;
    const errorMsg = err.response?.data?.error?.message || err.message;
    if (status === 429) throw new Error("Limite Mistral atteinte. Réessaie dans quelques secondes.");
    throw new Error(`Mistral: ${errorMsg}`);
  }
}

function detectSyntaxErrors(code, fileName) {
  const errors = [];
  const lines  = code.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.includes("require(")) {
      const match = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (match && !match[1].startsWith(".") && !match[1].startsWith("/")) {
        try { require.resolve(match[1]); } catch {
          errors.push(`L${lineNum}: "${match[1]}" non installé`);
        }
      }
    }

    if (line.includes("await") && !line.includes("async ")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("const ") && !trimmed.startsWith("let ") && !trimmed.startsWith("var "))
        errors.push(`L${lineNum}: await sans async`);
    }

    if (line.includes("try {") && !code.includes("catch"))
      errors.push(`L${lineNum}: try sans catch`);
  });

  if (code.includes("module.exports")) {
    if (!code.includes("config:"))                                    errors.push("Structure: config manquant");
    if (!code.includes("onStart:") && !code.includes("onChat:"))     errors.push("Structure: onStart/onChat requis");
  }

  const openBraces  = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  if (openBraces !== closeBraces)
    errors.push(`Syntaxe: accolades ({${openBraces}} vs }${closeBraces}})`);

  return errors;
}

async function autoScanAllFiles() {
  const files   = await getRemoteFiles();
  const results = { fixed: [], errors: [], clean: [] };

  for (const file of files) {
    try {
      const code         = await getFileContent(file.name);
      const syntaxErrors = detectSyntaxErrors(code, file.name);

      if (syntaxErrors.length > 0) {
        const prompt  = `Corrige TOUTES les erreurs dans ce fichier GoatBot.\nErreurs:\n${syntaxErrors.join("\n")}\n\nRetourne UNIQUEMENT le code corrigé complet, sans explications, sans backticks:\n\n${code}`;
        const newCode = await askHedgehog([], prompt);

        if (newCode && newCode !== code && newCode.length > 50) {
          await pushFileToGithub(file.name, newCode, `🦔 Auto-scan: correction de ${file.name}`);
          results.fixed.push({ file: file.name, errors: syntaxErrors });
        } else {
          results.errors.push({ file: file.name, reason: "Correction invalide" });
        }
      } else {
        results.clean.push(file.name);
      }
    } catch (err) {
      results.errors.push({ file: file.name, reason: err.message });
    }
  }

  return results;
}

async function createTrapPastebin(fileName) {
  const trapMessages = [
    "🦔 HEDGEHOG GPT\n\nCode protégé.\nPropriétaire: Ismael03-Dev\n\n⚠️ Fichier verrouillé.",
    "🔐 ACCÈS RESTREINT\n\nLeurre automatisé.\nCode sécurisé sur GitHub.\n\nIsmael03-Dev\nHedgehogGPT v14.0",
    "🛡️ HEDGEHOG GUARD\n\nLien piège.\nPropriété de Ismael03-Dev.\n\n🦔 HedgehogGPT veille.",
    "⚠️ LEURRE DÉTECTÉ\n\nFaux lien !\nVrai code sur GitHub.\n\n🦔 HedgehogGPT veille."
  ];

  const trapContent = trapMessages[Math.floor(Math.random() * trapMessages.length)];
  return await uploadToPastebin(`TRAP-${fileName}`, trapContent);
}

async function createCodeImage(code, fileName) {
  return new Promise((resolve, reject) => {
    try {
      const lineHeight   = 20;
      const padding      = 20;
      const fontSize     = 13;
      const headerHeight = 40;
      const maxLineWidth = 70;

      const lines        = code.split("\n").slice(0, 35);
      const displayLines = [];

      lines.forEach(line => {
        if (line.length <= maxLineWidth) {
          displayLines.push(line);
        } else {
          let remaining = line;
          while (remaining.length > maxLineWidth) {
            displayLines.push(remaining.slice(0, maxLineWidth));
            remaining = remaining.slice(maxLineWidth);
          }
          if (remaining) displayLines.push(remaining);
        }
      });

      const slicedLines = displayLines.slice(0, 35);
      const width       = Math.max(400, maxLineWidth * 8 + padding * 2);
      const height      = slicedLines.length * lineHeight + headerHeight + padding;
      const canvas      = createCanvas(width, height);
      const ctx         = canvas.getContext("2d");

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#161b22";
      ctx.fillRect(0, 0, width, headerHeight);

      [["#ff7b72", 7], ["#f0df72", 22], ["#56d364", 37]].forEach(([color, cx]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(padding + cx, headerHeight / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#8b949e";
      ctx.font      = `${fontSize}px Courier New`;
      ctx.fillText(fileName.slice(0, 30), padding + 55, headerHeight / 2 + 4);

      const keywords = ["const", "let", "var", "function", "async", "await", "return", "if", "else", "for", "while", "try", "catch", "require", "module", "exports", "true", "false", "null", "undefined", "new", "class", "import", "from", "export", "default"];
      const methods  = ["fs.", "path.", "axios.", "message.", "event.", "global.", "console."];

      slicedLines.forEach((line, i) => {
        const y         = headerHeight + padding + i * lineHeight;
        let x           = padding;
        let remaining   = line;

        while (remaining.length > 0) {
          if (remaining.startsWith("//")) {
            ctx.fillStyle = "#8b949e";
            ctx.font      = `${fontSize}px Courier New`;
            ctx.fillText(remaining.slice(0, maxLineWidth), x, y);
            return;
          }

          let found = false;

          for (const kw of keywords) {
            if (remaining.startsWith(kw) && (!remaining[kw.length] || /[^a-zA-Z0-9_$]/.test(remaining[kw.length]))) {
              ctx.fillStyle = "#ff7b72";
              ctx.font      = `bold ${fontSize}px Courier New`;
              ctx.fillText(kw, x, y);
              x        += ctx.measureText(kw).width;
              remaining = remaining.slice(kw.length);
              found     = true;
              break;
            }
          }
          if (found) continue;

          for (const m of methods) {
            if (remaining.startsWith(m)) {
              ctx.fillStyle = "#d2a8ff";
              ctx.font      = `${fontSize}px Courier New`;
              ctx.fillText(m, x, y);
              x        += ctx.measureText(m).width;
              remaining = remaining.slice(m.length);
              found     = true;
              break;
            }
          }
          if (found) continue;

          const strMatch = remaining.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/);
          if (strMatch) {
            ctx.fillStyle = "#a5d6ff";
            ctx.font      = `${fontSize}px Courier New`;
            ctx.fillText(strMatch[0], x, y);
            x        += ctx.measureText(strMatch[0]).width;
            remaining = remaining.slice(strMatch[0].length);
            continue;
          }

          ctx.fillStyle = "#c9d1d9";
          ctx.font      = `${fontSize}px Courier New`;
          ctx.fillText(remaining[0], x, y);
          x        += ctx.measureText(remaining[0]).width;
          remaining = remaining.slice(1);
        }
      });

      const buffer   = canvas.toBuffer("image/png");
      const tempDir  = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const imagePath = path.join(tempDir, `code_${Date.now()}.png`);
      fs.writeFileSync(imagePath, buffer);

      if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 0) {
        resolve(imagePath);
      } else {
        reject(new Error("Image vide"));
      }
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  config: {
    name:             "commit",
    version:          "14.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "HedgehogGPT - Mistral AI + Accès total GitHub" }
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
      return message.reply(
        `╭─────────────────────•\n` +
        `│ 🦔 𝐇𝐄𝐃𝐆𝐄𝐇𝐎𝐆 𝐆𝐏𝐓 𝐯𝟏𝟒\n` +
        `├─────────────────────•\n` +
        `│ scan → Scan + corrige tout\n` +
        `│ check <f> → Vérifie erreurs\n` +
        `│ preview <f> → Aperçu image\n` +
        `│ analyse <f|*> → Analyse IA\n` +
        `│ fix <f|*> → Corrige + commit\n` +
        `│ create <nom> <desc> → Crée fichier\n` +
        `│ doc <f> → JSDoc + commit\n` +
        `│ test <f> → Tests + commit\n` +
        `│ explain <f> → Explique code\n` +
        `│ simplify <f> → Refactorise\n` +
        `│ review <f> → Code review\n` +
        `│ history <f> → Historique commits\n` +
        `│ tree → Arborescence repo\n` +
        `│ read <url> → Lire un lien\n` +
        `│ list → Liste fichiers\n` +
        `│ token → Vérifier token\n` +
        `│ reset → Reset conversation\n` +
        `╰─────────────────────•`
      );
    }

    if (query.toLowerCase() === "reset") {
      this.hedgehogHistory[uid] = [];
      this.saveHistory();
      return message.reply(UI.success("Mémoire effacée."));
    }

    if (query.toLowerCase() === "token") {
      await message.reply(UI.loading("Vérification du token..."));
      const check = await verifyToken();
      if (check.valid)
        return message.reply(UI.success(`Token valide\n👤 ${check.user}\n📦 ${GITHUB_CONFIG.repo}`));
      return message.reply(UI.error(`Token invalide : ${check.reason}`));
    }

    if (query.toLowerCase() === "tree") {
      await message.reply(UI.loading("Récupération de l'arborescence..."));
      try {
        const tree    = await getRepoTree();
        const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
        const lines   = jsFiles.slice(0, 30).map(f => `📄 ${f.path}`);
        if (jsFiles.length > 30) lines.push(`... et ${jsFiles.length - 30} autres`);
        return message.reply(UI.info(`Arborescence (${jsFiles.length} fichiers JS)\n` + lines.join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Arborescence impossible : ${err.message}`));
      }
    }

    const readMatch = query.match(/^read\s+(https?:\/\/\S+)$/i);
    if (readMatch) {
      const url = readMatch[1].trim();
      await message.reply(UI.loading("Lecture du lien..."));
      try {
        let content = "";

        if (url.includes("pastebin.com")) {
          const { content: pasteContent } = await fetchPastebinContent(url);
          content = pasteContent;
        } else if (url.includes("github.com") && url.includes("/blob/")) {
          const rawUrl = url
            .replace("github.com", "raw.githubusercontent.com")
            .replace("/blob/", "/");
          content = await getFileContentFromUrl(rawUrl);
        } else {
          content = await getFileContentFromUrl(url);
        }

        if (!content || !content.trim())
          return message.reply(UI.warn("Contenu vide ou inaccessible."));

        const preview = content.length > 1500 ? content.slice(0, 1500) + "\n... (tronqué)" : content;
        const prompt  = `Voici le contenu récupéré depuis ${url} :\n\n${preview}\n\nAnalyse ce contenu et dis-moi ce que tu en penses.`;
        const reply   = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(`Lecture impossible : ${err.message}`));
      }
    }

    const historyMatch = query.match(/^history\s+(.+)$/i);
    if (historyMatch) {
      const target = normalizeName(historyMatch[1].trim());
      await message.reply(UI.loading(`Historique de ${target}...`));
      try {
        const commits = await getCommitHistory(target);
        if (!commits.length)
          return message.reply(UI.warn("Aucun commit trouvé."));

        const lines = commits.map(c => {
          const date = new Date(c.commit.author.date).toLocaleString("fr-FR");
          return `📌 ${c.commit.message.slice(0, 40)}\n   👤 ${c.commit.author.name} | 🕐 ${date}`;
        });
        return message.reply(UI.info(`Historique ${target}\n` + lines.join("\n\n")));
      } catch (err) {
        return message.reply(UI.error(`Historique impossible : ${err.message}`));
      }
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scan automatique en cours..."));
      try {
        const results = await autoScanAllFiles();
        const msg     = `✅ ${results.fixed.length} corrigé(s) + commit\n✨ ${results.clean.length} propre(s)` +
          (results.errors.length ? `\n❌ ${results.errors.length} échoué(s)` : "");
        return message.reply(UI.success(msg));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const checkMatch = query.match(/^check\s+(.+)$/i);
    if (checkMatch) {
      const target = checkMatch[1].trim();
      await message.reply(UI.loading(`Vérification de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const errors   = detectSyntaxErrors(code, fileName);

        if (errors.length === 0)
          return message.reply(UI.success(`${fileName} : Aucune erreur.`));
        return message.reply(UI.warn(`${errors.length} erreur(s)\n${errors.join("\n")}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const previewMatch = query.match(/^preview\s+(.+)$/i);
    if (previewMatch) {
      const target = previewMatch[1].trim();
      await message.reply(UI.loading("Génération de l'aperçu..."));
      try {
        const fileName  = normalizeName(target);
        const code      = await getFileContent(fileName);
        const imagePath = await createCodeImage(code, fileName);

        if (!fs.existsSync(imagePath))
          return message.reply(UI.error("Image non créée."));

        message.reply({
          body:       UI.success(`${fileName} | ${code.split("\n").length} lignes | ${code.length} car.`),
          attachment: fs.createReadStream(imagePath)
        }, () => {
          setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000);
        });
      } catch (err) {
        return message.reply(UI.error(`Preview : ${err.message}`));
      }
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const target = explainMatch[1].trim();
      await message.reply(UI.loading(`Explication de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Explique ce code GoatBot en détail :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nExplique : 1. Rôle 2. Sections 3. Fonctions clés 4. Points importants`;
        const reply    = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const docMatch = query.match(/^doc\s+(.+)$/i);
    if (docMatch) {
      const target = docMatch[1].trim();
      await message.reply(UI.loading(`Documentation de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Ajoute une JSDoc complète à ce fichier GoatBot. Retourne UNIQUEMENT le code documenté, sans explications, sans backticks :\n\n${code}`;
        const newCode  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Doc: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} documenté + commit\n📝 ${newCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const target = testMatch[1].trim();
      await message.reply(UI.loading("Génération des tests..."));
      try {
        const fileName     = normalizeName(target);
        const code         = await getFileContent(fileName);
        const testFileName = fileName.replace(".js", ".test.js");
        const prompt       = `Génère des tests unitaires complets pour ce module GoatBot. Retourne UNIQUEMENT le code de test, sans explications, sans backticks :\n\nModule : ${fileName}\n${code}`;
        const testCode     = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(testFileName, testCode, `🦔 Test: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${testFileName} généré + commit\n📝 ${testCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const simplifyMatch = query.match(/^simplify\s+(.+)$/i);
    if (simplifyMatch) {
      const target = simplifyMatch[1].trim();
      await message.reply(UI.loading(`Simplification de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const prompt   = `Simplifie et refactorise ce code sans changer son comportement. Retourne UNIQUEMENT le code simplifié, sans explications, sans backticks :\n\n${code}`;
        const newCode  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Simplify: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} : ${code.length} → ${newCode.length} car. + commit`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (query.toLowerCase() === "list") {
      await message.reply(UI.loading("Récupération des fichiers..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.warn("Aucun fichier trouvé."));
        return message.reply(UI.info(
          `Fichiers GitHub (${files.length})\n` +
          files.map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n")
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const analyseMatch = query.match(/^analyse\s+(.+)$/i);
    if (analyseMatch) {
      const target = analyseMatch[1].trim();
      await message.reply(UI.loading(`Analyse de ${target}...`));

      try {
        let prompt = "";

        if (target === "*") {
          const files    = await getRemoteFiles();
          const samples  = files.slice(0, 5);
          const contents = await Promise.all(samples.map(async f => {
            const code = await getFileContent(f.name);
            return `=== ${f.name} ===\n${code.slice(0, 1000)}`;
          }));
          prompt = `Analyse globale du repository ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (${files.length} fichiers, ${samples.length} échantillons) :\n\n${contents.join("\n\n")}\n\nRapport : qualité, patterns, problèmes, recommandations.`;
        } else {
          const fileName = normalizeName(target);
          const code     = await getFileContent(fileName);
          const errors   = detectSyntaxErrors(code, fileName);
          prompt = `Analyse ce fichier GoatBot du repo ${GITHUB_CONFIG.repo} :\n\nFichier : ${fileName}\n${errors.length ? `Erreurs détectées: ${errors.join(", ")}\n` : ""}\`\`\`javascript\n${code}\n\`\`\`\n\nStructure, qualité, bugs, améliorations.`;
        }

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const fixMatch = query.match(/^fix\s+(.+)$/i);
    if (fixMatch) {
      const target = fixMatch[1].trim();
      await message.reply(UI.loading(`Correction de ${target}...`));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token invalide : ${tokenCheck.reason}`));

        if (target === "*") {
          const files   = await getRemoteFiles();
          const results = { ok: [], fail: [] };

          for (const file of files) {
            try {
              const code      = await getFileContent(file.name);
              const errors    = detectSyntaxErrors(code, file.name);
              const errorList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
              const prompt    = `Corrige ce fichier GoatBot.${errorList}\nRetourne UNIQUEMENT le code corrigé, sans explications, sans backticks :\n\n${code}`;
              const newCode   = await askHedgehog(this.hedgehogHistory[uid], prompt);
              await pushFileToGithub(file.name, newCode, `🦔 Fix: ${file.name}`);
              results.ok.push(file.name);
            } catch {
              results.fail.push(file.name);
            }
          }

          this.saveHistory();
          return message.reply(UI.success(
            `✅ ${results.ok.length} corrigé(s) + commit` +
            (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")
          ));
        }

        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const errors   = detectSyntaxErrors(code, fileName);
        const errorList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
        const prompt   = `Corrige ce fichier GoatBot.${errorList}\nRetourne UNIQUEMENT le code corrigé, sans explications, sans backticks :\n\n${fileName}\n${code}`;
        const newCode  = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Fix: ${fileName}`);
        this.saveHistory();

        return message.reply(UI.success(
          `${fileName} corrigé + commit\n📝 ${newCode.length} car.` +
          (errors.length > 0 ? `\n🔧 ${errors.length} erreur(s) corrigée(s)` : `\n✨ Code amélioré`)
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const createMatch = query.match(/^create\s+(\S+)\s+(.+)$/i);
    if (createMatch) {
      const fileName    = normalizeName(createMatch[1].trim());
      const description = createMatch[2].trim();
      await message.reply(UI.loading(`Création de "${fileName}"...`));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token invalide : ${tokenCheck.reason}`));

        const prompt  = `Crée un fichier de commande GoatBot complet et fonctionnel nommé "${fileName}" : ${description}\n\nRetourne UNIQUEMENT le code complet, sans explications, sans backticks. Respecte la structure GoatBot standard avec config, onStart, etc.`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Create: ${fileName}`);

        ensureCmdDir();
        fs.writeFileSync(path.join(CMD_PATH, fileName), newCode, "utf8");
        this.saveHistory();

        return message.reply(UI.success(`${fileName} créé + commit\n📝 ${description}\n📊 ${newCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(`Création échouée : ${err.message}`));
      }
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const target = reviewMatch[1].trim();
      await message.reply(UI.loading(`Code review de ${target}...`));

      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);
        const errors   = detectSyntaxErrors(code, fileName);
        const errorSection = errors.length > 0 ? `\nErreurs détectées:\n${errors.join("\n")}` : "";
        const prompt   = `Code review professionnelle :\n\n${fileName}\n\`\`\`javascript\n${code}\n\`\`\`${errorSection}\n\n1. Points positifs 2. Bugs 3. Performance 4. Améliorations 5. Score/10`;
        const reply    = await askHedgehog(this.hedgehogHistory[uid], prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));

    try {
      const repoContext = `Tu as accès total au repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (branche: ${GITHUB_CONFIG.branch}). Tu te souviens de toute notre conversation.`;
      const reply       = await askHedgehog(this.hedgehogHistory[uid], `${repoContext}\n\n${query}`);
      this.saveHistory();
      return message.reply(UI.hedgehog(reply));
    } catch (err) {
      return message.reply(UI.error(err.message));
    }
  },

  onStart: async function ({ args, message, event }) {
    if (!ALLOWED.includes(event.senderID.toString()))
      return message.reply(UI.error("Permission refusée."));

    const sub = args[0]?.toLowerCase();
    const p   = global.utils.getPrefix(event.threadID);

    if (!sub || sub === "help") {
      return message.reply(
        `╭─────────────────────•\n` +
        `│ 📦 𝐂𝐎𝐌𝐌𝐈𝐓 — 𝐀𝐈𝐃𝐄\n` +
        `├─────────────────────•\n` +
        `│ ${p}commit list\n` +
        `│ ${p}commit remote\n` +
        `│ ${p}commit save <nom> <code>\n` +
        `│ ${p}commit paste <nom> <lien>\n` +
        `│ ${p}commit export <fichier>\n` +
        `│ ${p}commit push <fichier>\n` +
        `│ ${p}commit pushall\n` +
        `│ ${p}commit pull\n` +
        `│ ${p}commit sync\n` +
        `│ ${p}commit diff\n` +
        `│ ${p}commit delete <fichier>\n` +
        `│ ${p}commit rename <anc> <nouv>\n` +
        `│ ${p}commit info\n` +
        `├─────────────────────•\n` +
        `│ 🦔 Tape "Hedgehog help"\n` +
        `╰─────────────────────•`
      );
    }

    if (sub === "save") {
      const fileName = args[1];
      const content  = args.slice(2).join(" ");
      if (!fileName || !content)
        return message.reply(UI.error(`Usage : ${p}commit save <nom.js> <contenu>`));

      const finalName = normalizeName(fileName);
      const filePath  = path.join(CMD_PATH, finalName);
      const exists    = fs.existsSync(filePath);

      ensureCmdDir();
      fs.writeFileSync(filePath, content, "utf8");

      return message.reply(UI.success(
        exists ? `${finalName} mis à jour (${content.length} car.)` : `${finalName} créé (${content.length} car.)`
      ));
    }

    if (sub === "paste") {
      const fileName  = args[1];
      const pasteLink = args[2];
      const autoPush  = args.includes("--push");

      if (!fileName || !pasteLink)
        return message.reply(UI.error(`Usage : ${p}commit paste <nom.js> <lien>`));

      await message.reply(UI.loading("Récupération depuis Pastebin..."));

      try {
        const { content } = await fetchPastebinContent(pasteLink);
        if (!content || !content.trim())
          return message.reply(UI.error("Pastebin vide ou inaccessible."));

        const finalName = normalizeName(fileName);
        const filePath  = path.join(CMD_PATH, finalName);
        const exists    = fs.existsSync(filePath);

        ensureCmdDir();
        fs.writeFileSync(filePath, content, "utf8");

        const fakePastebinUrl = await createTrapPastebin(finalName);

        if (autoPush) {
          await message.reply(UI.loading(`Push de ${finalName} vers GitHub...`));
          try {
            await pushFileToGithub(finalName, content, `🦔 Import Pastebin: ${finalName}`);
            return message.reply(UI.success(
              `${finalName} importé + commit\n🔗 ${fakePastebinUrl || "pastebin.com/blocked"}\n📝 ${content.length} car.`
            ));
          } catch {
            return message.reply(UI.warn("Sauvegardé localement, commit échoué."));
          }
        }

        return message.reply(UI.success(
          `${finalName} importé\n🔗 ${fakePastebinUrl || "pastebin.com/blocked"}\n📝 ${content.length} car.`
        ));
      } catch {
        return message.reply(UI.error("Lecture Pastebin impossible."));
      }
    }

    if (sub === "export") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit export <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable.`));

      await message.reply(UI.loading(`Export de "${fileName}"...`));

      try {
        const content  = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);

        if (!pasteUrl)
          return message.reply(UI.warn("Export échoué."));

        return message.reply(UI.success(`${fileName} exporté\n🔗 ${pasteUrl}\n📝 ${content.length} car.`));
      } catch {
        return message.reply(UI.error("Export échoué."));
      }
    }

    if (sub === "push") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit push <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable.`));

      await message.reply(UI.loading(`Push de "${fileName}"...`));

      try {
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(fileName, content, `🦔 Commit: push ${fileName}`);
        return message.reply(UI.success(`${fileName} pushé.`));
      } catch (err) {
        return message.reply(UI.error(`Push échoué : ${err.message}`));
      }
    }

    if (sub === "pushall") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.warn("Aucun fichier local."));

      await message.reply(UI.loading(`Push de ${files.length} fichiers...`));

      const results = { ok: [], fail: [] };

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          await pushFileToGithub(file, content, `🦔 Commit: pushall ${file}`);
          results.ok.push(file);
        } catch {
          results.fail.push(file);
        }
      }

      return message.reply(UI.success(
        `✅ ${results.ok.length} pushé(s)` +
        (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")
      ));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Récupération depuis GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GitHub vide."));

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

        return message.reply(UI.success(
          `✅ ${results.ok.length} récupéré(s)` +
          (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")
        ));
      } catch {
        return message.reply(UI.error("Pull échoué."));
      }
    }

    if (sub === "sync") {
      await message.reply(UI.loading("Synchronisation..."));
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
            await pushFileToGithub(file, content, `🦔 Sync: ${file}`);
            pushResults.ok.push(file);
          } catch {
            pushResults.fail.push(file);
          }
        }

        return message.reply(UI.success(
          `⬇ Pull: ${pullResults.ok.length} | ⬆ Push: ${pushResults.ok.length}` +
          (pullResults.fail.length || pushResults.fail.length ? `\n❌ Échecs: ${pullResults.fail.length + pushResults.fail.length}` : "")
        ));
      } catch {
        return message.reply(UI.error("Sync échoué."));
      }
    }

    if (sub === "list") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.info("Aucune commande locale."));

      return message.reply(UI.info(
        `Fichiers locaux (${files.length})\n` +
        files.map(f => {
          const kb = (fs.statSync(path.join(CMD_PATH, f)).size / 1024).toFixed(1);
          return `📄 ${f} (${kb} KB)`;
        }).join("\n")
      ));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Récupération GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GitHub vide."));

        return message.reply(UI.info(
          `Fichiers GitHub (${files.length})\n` +
          files.map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n")
        ));
      } catch {
        return message.reply(UI.error("GitHub inaccessible."));
      }
    }

    if (sub === "rename") {
      const oldName = normalizeName(args[1] || "");
      const newName = normalizeName(args[2] || "");
      if (!args[1] || !args[2])
        return message.reply(UI.error(`Usage : ${p}commit rename <ancien> <nouveau>`));

      const oldPath = path.join(CMD_PATH, oldName);
      const newPath = path.join(CMD_PATH, newName);

      if (!fs.existsSync(oldPath))
        return message.reply(UI.error(`"${oldName}" introuvable.`));
      if (fs.existsSync(newPath))
        return message.reply(UI.warn(`"${newName}" existe déjà.`));

      fs.renameSync(oldPath, newPath);
      return message.reply(UI.success(`${oldName} → ${newName}`));
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

        let msg = `📊 Local: ${local.size} | GitHub: ${remote.size}`;
        if (both.length)      msg += `\n✅ Commun: ${both.length}`;
        if (onlyLocal.length) msg += `\n💾 Local seul: ${onlyLocal.length}`;
        if (onlyRemote.length)msg += `\n☁ GitHub seul: ${onlyRemote.length}`;
        return message.reply(UI.info(msg));
      } catch {
        return message.reply(UI.error("Diff échoué."));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit delete <nom.js>`));

      await message.reply(UI.loading(`Suppression de "${fileName}"...`));

      try {
        await deleteFileOnGithub(fileName);
        return message.reply(UI.success(`${fileName} supprimé.`));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée : ${err.message}`));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Récupération infos..."));
      try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`;
        const res = await axios.get(url, { headers: githubHeaders() });
        const r   = res.data;

        ensureCmdDir();
        const localCount = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;

        return message.reply(UI.info(
          `👤 ${r.owner.login}\n📦 ${r.name}\n🌿 ${GITHUB_CONFIG.branch}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n🔒 ${r.private ? "Oui" : "Non"}\n📁 Local: ${localCount} fichiers\n🔗 ${r.html_url}`
        ));
      } catch {
        return message.reply(UI.error("Infos impossible."));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}commit help`));
  }
};