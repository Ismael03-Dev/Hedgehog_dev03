const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas } = require("canvas");

const GITHUB_CONFIG = {
  username: "Ismael03-Dev",
  repo: "Hedgehog_dev03",
  branch: "main",
  token: "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"
};

const GROQ_API_KEY = "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";
const PASTEBIN_API_KEY = "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9";
const CMD_PATH = path.join(process.cwd(), "scripts", "cmds");
const ALLOWED = ["61578433048588"];

const UI = {
  frame: (emoji, text) => {
    return `╭─────────────────────•\n│ ${emoji} ${text}\n╰─────────────────────•`;
  },

  success: (text) => UI.frame("✅", text),
  error: (text) => UI.frame("❌", text),
  info: (text) => UI.frame("📦", text),
  hedgehog: (text) => UI.frame("🦔", text),
  warn: (text) => UI.frame("⚠️", text),
  loading: (text) => UI.frame("⏳", text)
};

const SYSTEM_PROMPT = `Tu es HedgehogGPT, un assistant IA expert en développement JavaScript et en bots Messenger (GoatBot/fca-unofficial).
Tu es intégré directement dans le workflow GitHub de l'utilisateur.
Tes capacités :
- Analyser le code en profondeur
- Détecter automatiquement les bugs, erreurs de syntaxe, problèmes de performance
- Corriger le code et le pusher directement sur GitHub
- Expliquer le code de façon claire
- Générer de la documentation JSDoc
- Créer des tests unitaires
- Simplifier/refactoriser le code
- Faire des code reviews professionnelles

Quand tu modifies du code, tu retournes UNIQUEMENT le code corrigé/amélioré sans explications, sans balises markdown, sans backticks.
Pour les analyses et explications, tu réponds de façon claire et concise en français.
Tu connais parfaitement la structure des modules GoatBot : config, onStart, onChat, onReply, getLang, message.reply, api, event, etc.`;

function githubHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept": "application/vnd.github.v3+json",
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
  const key = extractPastebinKey(input);
  const rawUrl = `https://pastebin.com/raw/${key}`;
  const res = await axios.get(rawUrl, { timeout: 10000 });
  return { content: res.data, key, rawUrl };
}

async function uploadToPastebin(fileName, content) {
  const params = new URLSearchParams();
  params.append("api_dev_key", PASTEBIN_API_KEY);
  params.append("api_option", "paste");
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

async function getFileContent(fileName) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

async function pushFileToGithub(fileName, content, message) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
  const encodedContent = typeof content === "string"
    ? Buffer.from(content).toString("base64")
    : Buffer.from(fs.readFileSync(content)).toString("base64");
  const sha = await getFileSha(fileName);
  const body = {
    message: message || `🦔 HedgehogGPT: commit ${fileName}`,
    content: encodedContent,
    branch: GITHUB_CONFIG.branch
  };
  if (sha) body.sha = sha;
  await axios.put(url, body, { headers: githubHeaders() });
}

async function askHedgehog(history, userMessage) {
  history.push({ role: "user", content: userMessage });

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-12)
  ];

  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-4-scout-17b-16e-instruct",
      messages: messages,
      max_tokens: 4096,
      temperature: 0.3
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      timeout: 60000
    }
  );

  const reply = res.data.choices[0].message.content;

  if (!reply || reply.trim() === "") {
    throw new Error("Réponse vide de l'IA");
  }

  history.push({ role: "assistant", content: reply });
  if (history.length > 24) history.splice(0, 2);
  return reply;
}

function detectSyntaxErrors(code, fileName) {
  const errors = [];
  const lines = code.split("\n");

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    if (line.includes("require(")) {
      const match = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (match && !match[1].startsWith(".") && !match[1].startsWith("/")) {
        try {
          require.resolve(match[1]);
        } catch {
          errors.push(`L${lineNum}: "${match[1]}" non installé`);
        }
      }
    }

    if (line.includes("await") && !line.includes("async ")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("const ") && !trimmed.startsWith("let ") && !trimmed.startsWith("var ")) {
        errors.push(`L${lineNum}: await sans async`);
      }
    }

    if (line.includes("require(") && line.includes("./") && !line.includes(".js") && !line.includes(".json")) {
      const match = line.match(/require\(['"](\.\/[^'"]+)['"]\)/);
      if (match && !match[1].endsWith(".js") && !match[1].endsWith(".json")) {
        errors.push(`L${lineNum}: ext manquante "${match[1]}"`);
      }
    }
  });

  if (code.includes("module.exports")) {
    if (!code.includes("config:")) errors.push("Structure: config manquant");
    if (!code.includes("onStart:") && !code.includes("onChat:")) {
      errors.push("Structure: onStart/onChat requis");
    }
  }

  return errors;
}

async function autoScanAllFiles() {
  const files = await getRemoteFiles();
  const results = { fixed: [], errors: [], clean: [] };

  for (const file of files) {
    try {
      const code = await getFileContent(file.name);
      const syntaxErrors = detectSyntaxErrors(code, file.name);

      if (syntaxErrors.length > 0) {
        const prompt = `Corrige TOUTES les erreurs dans ce fichier GoatBot. Erreurs détectées:\n${syntaxErrors.join("\n")}\n\nRetourne UNIQUEMENT le code corrigé complet, sans explications, sans backticks:\n\n${code}`;
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
    "🦔 HEDGEHOG GPT - SÉCURITÉ\n\nCode protégé.\nPropriétaire: Ismael03-Dev\n\n⚠️ Fichier verrouillé.\n🔒 Code non accessible.\n\nPasse ton chemin. 🦔",

    "🔐 ACCÈS RESTREINT\n\nLeurre automatisé.\nCode sécurisé sur GitHub.\n\nIsmael03-Dev\nHedgehogGPT v11.0\n\nPas de chance. 😈🦔",

    "🛡️ HEDGEHOG GUARD\n\nLien piège.\nPropriété de Ismael03-Dev.\n\n« Le code appartient à\nceux qui le codent. »\n— HedgehogGPT 🦔",

    "⚠️ LEURRE DÉTECTÉ\n\nFaux lien !\nVrai code sur GitHub.\n\nTemps perdu: 10s.\nRegret estimé: élevé.\n\n🦔 HedgehogGPT veille."
  ];

  const trapContent = trapMessages[Math.floor(Math.random() * trapMessages.length)];
  return await uploadToPastebin(`TRAP-${fileName}`, trapContent);
}

async function createCodeImage(code, fileName) {
  const lineHeight = 20;
  const padding = 20;
  const fontSize = 13;
  const headerHeight = 40;
  const maxLineWidth = 70;

  const lines = code.split("\n").slice(0, 35);
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
  const width = maxLineWidth * 8 + padding * 2;
  const height = slicedLines.length * lineHeight + headerHeight + padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, width, headerHeight);

  ctx.fillStyle = "#ff7b72";
  ctx.beginPath();
  ctx.arc(padding + 7, headerHeight / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f0df72";
  ctx.beginPath();
  ctx.arc(padding + 22, headerHeight / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#56d364";
  ctx.beginPath();
  ctx.arc(padding + 37, headerHeight / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#8b949e";
  ctx.font = `${fontSize}px Courier New`;
  ctx.fillText(fileName, padding + 55, headerHeight / 2 + 4);

  const keywords = ["const", "let", "var", "function", "async", "await", "return", "if", "else", "for", "while", "try", "catch", "require", "module", "exports", "true", "false", "null", "undefined", "new", "class", "import", "from", "export", "default"];
  const methods = ["fs.", "path.", "axios.", "message.", "event.", "global.", "console."];

  slicedLines.forEach((line, i) => {
    const y = headerHeight + padding + i * lineHeight;
    let x = padding;
    let remaining = line;

    while (remaining.length > 0) {
      let found = false;

      if (remaining.startsWith("//")) {
        ctx.fillStyle = "#8b949e";
        ctx.font = `${fontSize}px Courier New`;
        ctx.fillText(remaining, x, y);
        return;
      }

      for (const kw of keywords) {
        if (remaining.startsWith(kw) && (!remaining[kw.length] || /[^a-zA-Z0-9_$]/.test(remaining[kw.length]))) {
          ctx.fillStyle = "#ff7b72";
          ctx.font = `bold ${fontSize}px Courier New`;
          ctx.fillText(kw, x, y);
          x += ctx.measureText(kw).width;
          remaining = remaining.slice(kw.length);
          found = true;
          break;
        }
      }
      if (found) continue;

      for (const m of methods) {
        if (remaining.startsWith(m)) {
          ctx.fillStyle = "#d2a8ff";
          ctx.font = `${fontSize}px Courier New`;
          ctx.fillText(m, x, y);
          x += ctx.measureText(m).width;
          remaining = remaining.slice(m.length);
          found = true;
          break;
        }
      }
      if (found) continue;

      const strMatch = remaining.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/);
      if (strMatch) {
        ctx.fillStyle = "#a5d6ff";
        ctx.font = `${fontSize}px Courier New`;
        ctx.fillText(strMatch[0], x, y);
        x += ctx.measureText(strMatch[0]).width;
        remaining = remaining.slice(strMatch[0].length);
        continue;
      }

      const numMatch = remaining.match(/^\d+/);
      if (numMatch) {
        ctx.fillStyle = "#79c0ff";
        ctx.font = `${fontSize}px Courier New`;
        ctx.fillText(numMatch[0], x, y);
        x += ctx.measureText(numMatch[0]).width;
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }

      ctx.fillStyle = "#c9d1d9";
      ctx.font = `${fontSize}px Courier New`;
      ctx.fillText(remaining[0], x, y);
      x += ctx.measureText(remaining[0]).width;
      remaining = remaining.slice(1);
    }
  });

  ctx.fillStyle = "#21262d";
  ctx.fillRect(0, height - 1, width, 1);

  const buffer = canvas.toBuffer("image/png");
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const imagePath = path.join(tempDir, `code_${Date.now()}.png`);
  fs.writeFileSync(imagePath, buffer);
  return imagePath;
}

module.exports = {
  config: {
    name: "commit",
    version: "11.0",
    author: "Ismael03-Dev",
    countDown: 5,
    role: 2,
    category: "admin",
    shortDescription: { en: "HedgehogGPT - Gestionnaire de commits intelligent" }
  },

  hedgehogHistory: {},

  onChat: async function ({ message, event }) {
    if (!ALLOWED.includes(event.senderID.toString())) return;

    const body = event.body?.trim() || "";
    if (!body.toLowerCase().startsWith("hedgehog")) return;

    const uid = event.senderID.toString();
    const query = body.slice(8).trim();

    if (!this.hedgehogHistory[uid]) this.hedgehogHistory[uid] = [];

    if (!query || query.toLowerCase() === "help") {
      return message.reply(
        `╭─────────────────────•\n` +
        `│ 🦔 𝐇𝐄𝐃𝐆𝐄𝐇𝐎𝐆 𝐆𝐏𝐓\n` +
        `├─────────────────────•\n` +
        `│ scan → Scan + corrige tout\n` +
        `│ check <f> → Vérifie erreurs\n` +
        `│ preview <f> → Aperçu image\n` +
        `│ analyse <f> → Analyse\n` +
        `│ fix <f> → Corrige + commit\n` +
        `│ doc <f> → JSDoc + commit\n` +
        `│ test <f> → Tests + commit\n` +
        `│ explain <f> → Explique\n` +
        `│ simplify <f> → Refactorise\n` +
        `│ review <f> → Code review\n` +
        `│ list → Liste fichiers\n` +
        `│ reset → Reset conversation\n` +
        `╰─────────────────────•`
      );
    }

    if (query.toLowerCase() === "reset") {
      this.hedgehogHistory[uid] = [];
      return message.reply(UI.success("Conversation réinitialisée."));
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scan automatique en cours..."));
      try {
        const results = await autoScanAllFiles();
        const msg = `✅ ${results.fixed.length} corrigé(s) + commit\n✨ ${results.clean.length} déjà propre(s)` +
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
        const code = await getFileContent(fileName);
        const errors = detectSyntaxErrors(code, fileName);

        if (errors.length === 0) {
          return message.reply(UI.success(`${fileName} : Aucune erreur.`));
        } else {
          return message.reply(UI.warn(`${errors.length} erreur(s)\n${errors.join("\n")}`));
        }
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const previewMatch = query.match(/^preview\s+(.+)$/i);
    if (previewMatch) {
      const target = previewMatch[1].trim();
      await message.reply(UI.loading(`Génération de l'aperçu...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const imagePath = await createCodeImage(code, fileName);

        await message.reply({
          body: UI.success(`${fileName} | ${code.split("\n").length} lignes`),
          attachment: fs.createReadStream(imagePath)
        });

        setTimeout(() => {
          try { fs.unlinkSync(imagePath); } catch {}
        }, 5000);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const target = explainMatch[1].trim();
      await message.reply(UI.loading(`Analyse de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const prompt = `Explique ce code GoatBot :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nExplique : 1. Rôle 2. Sections 3. Fonctions 4. Points clés`;
        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
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
        const code = await getFileContent(fileName);
        const prompt = `Ajoute JSDoc complète. Retourne UNIQUEMENT le code documenté, sans explications, sans backticks :\n\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Doc: ${fileName}`);
        return message.reply(UI.success(`${fileName} documenté + commit (${newCode.length} car.)`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const target = testMatch[1].trim();
      await message.reply(UI.loading(`Génération des tests...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const testFileName = fileName.replace(".js", ".test.js");
        const prompt = `Génère des tests unitaires. Retourne UNIQUEMENT le code de test, sans explications, sans backticks :\n\nModule : ${fileName}\n${code}`;
        const testCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(testFileName, testCode, `🦔 Test: ${fileName}`);
        return message.reply(UI.success(`${testFileName} généré + commit (${testCode.length} car.)`));
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
        const code = await getFileContent(fileName);
        const prompt = `Simplifie ce code. Retourne UNIQUEMENT le code simplifié, sans explications, sans backticks :\n\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Simplify: ${fileName}`);
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
        const kb = (f) => (f.size / 1024).toFixed(1);
        return message.reply(UI.info(`Fichiers (${files.length})\n` + files.map(f => `📄 ${f.name} (${kb(f)} KB)`).join("\n")));
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
          const files = await getRemoteFiles();
          const samples = files.slice(0, 5);
          const contents = await Promise.all(samples.map(async f => {
            const code = await getFileContent(f.name);
            return `=== ${f.name} ===\n${code.slice(0, 1000)}`;
          }));
          prompt = `Analyse globale (${files.length} fichiers, ${samples.length} échantillons) :\n\n${contents.join("\n\n")}\n\nRapport global.`;
        } else {
          const fileName = normalizeName(target);
          const code = await getFileContent(fileName);
          prompt = `Analyse ce fichier :\n\n${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nStructure, qualité, bugs, améliorations.`;
        }

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
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
        if (target === "*") {
          const files = await getRemoteFiles();
          const results = { ok: [], fail: [] };

          for (const file of files) {
            try {
              const code = await getFileContent(file.name);
              const errors = detectSyntaxErrors(code, file.name);
              const errorList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
              const prompt = `Corrige ce fichier.${errorList}\nRetourne UNIQUEMENT le code corrigé, sans explications, sans backticks :\n\n${code}`;
              const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
              await pushFileToGithub(file.name, newCode, `🦔 Fix: ${file.name}`);
              results.ok.push(file.name);
            } catch {
              results.fail.push(file.name);
            }
          }

          const msg = `✅ ${results.ok.length} corrigé(s) + commit` +
            (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "");
          return message.reply(UI.success(msg));
        }

        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const errors = detectSyntaxErrors(code, fileName);
        const errorList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
        const prompt = `Corrige ce fichier.${errorList}\nRetourne UNIQUEMENT le code corrigé, sans explications, sans backticks :\n\n${fileName}\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Fix: ${fileName}`);

        const msg = `${fileName} corrigé + commit\n${newCode.length} car.` +
          (errors.length > 0 ? `\n🔧 ${errors.length} erreur(s)` : `\n✨ Aucune erreur`);
        return message.reply(UI.success(msg));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const target = reviewMatch[1].trim();
      await message.reply(UI.loading(`Code review de ${target}...`));

      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const errors = detectSyntaxErrors(code, fileName);
        const errorSection = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
        const prompt = `Code review :\n\n${fileName}\n\`\`\`javascript\n${code}\n\`\`\`${errorSection}\n\n1. Positifs 2. Bugs 3. Perf 4. Améliorations 5. Score/10`;

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));

    try {
      const repoContext = `Contexte : repo ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}, branche ${GITHUB_CONFIG.branch}.`;
      const reply = await askHedgehog(this.hedgehogHistory[uid], `${repoContext}\n\n${query}`);
      return message.reply(UI.hedgehog(reply));
    } catch (err) {
      return message.reply(UI.error(err.message));
    }
  },

  onStart: async function ({ args, message, event }) {
    if (!ALLOWED.includes(event.senderID.toString()))
      return message.reply(UI.error("Permission refusée."));

    const sub = args[0]?.toLowerCase();
    const p = global.utils.getPrefix(event.threadID);

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
      const content = args.slice(2).join(" ");
      if (!fileName || !content)
        return message.reply(UI.error(`Usage : ${p}commit save <nom.js> <contenu>`));

      const finalName = normalizeName(fileName);
      const filePath = path.join(CMD_PATH, finalName);
      const exists = fs.existsSync(filePath);

      ensureCmdDir();
      fs.writeFileSync(filePath, content, "utf8");

      return message.reply(UI.success(
        exists ? `${finalName} mis à jour (${content.length} car.)` : `${finalName} créé (${content.length} car.)`
      ));
    }

    if (sub === "paste") {
      const fileName = args[1];
      const pasteLink = args[2];
      const autoPush = args.includes("--push");

      if (!fileName || !pasteLink)
        return message.reply(UI.error(`Usage : ${p}commit paste <nom.js> <lien>`));

      await message.reply(UI.loading("Récupération depuis Pastebin..."));

      try {
        const { content, key } = await fetchPastebinContent(pasteLink);
        if (!content || !content.trim())
          return message.reply(UI.error("Pastebin vide ou inaccessible."));

        const finalName = normalizeName(fileName);
        const filePath = path.join(CMD_PATH, finalName);
        const exists = fs.existsSync(filePath);

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
          } catch (err) {
            return message.reply(UI.warn(`Sauvegardé localement, commit échoué.`));
          }
        }

        return message.reply(UI.success(
          `${finalName} importé\n🔗 ${fakePastebinUrl || "pastebin.com/blocked"}\n📝 ${content.length} car.`
        ));
      } catch (err) {
        return message.reply(UI.error(`Lecture Pastebin impossible.`));
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
        const content = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);

        if (!pasteUrl)
          return message.reply(UI.warn("Export échoué, vérifie ta clé API."));

        return message.reply(UI.success(`${fileName} exporté\n🔗 ${pasteUrl}\n📝 ${content.length} car.`));
      } catch (err) {
        return message.reply(UI.error(`Export échoué.`));
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
        return message.reply(UI.success(`${fileName} pushé avec succès.`));
      } catch (err) {
        return message.reply(UI.error(`Push échoué.`));
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

      const msg = `✅ ${results.ok.length} pushé(s)` +
        (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "");
      return message.reply(UI.success(msg));
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

        const msg = `✅ ${results.ok.length} récupéré(s)` +
          (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "");
        return message.reply(UI.success(msg));
      } catch (err) {
        return message.reply(UI.error(`Pull échoué.`));
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

        const localFiles = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
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

        const msg = `⬇ Pull: ${pullResults.ok.length} | ⬆ Push: ${pushResults.ok.length}` +
          (pullResults.fail.length || pushResults.fail.length ? `\n❌ Échecs: ${pullResults.fail.length + pushResults.fail.length}` : "");
        return message.reply(UI.success(msg));
      } catch (err) {
        return message.reply(UI.error(`Sync échoué.`));
      }
    }

    if (sub === "list") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.info("Aucune commande locale."));

      const sizes = files.map(f => {
        const stat = fs.statSync(path.join(CMD_PATH, f));
        const kb = (stat.size / 1024).toFixed(1);
        return `📄 ${f} (${kb} KB)`;
      });
      return message.reply(UI.info(`Fichiers locaux (${files.length})\n` + sizes.join("\n")));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Récupération GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GitHub vide."));

        return message.reply(UI.info(`Fichiers GitHub (${files.length})\n` + files.map(f => {
          const kb = (f.size / 1024).toFixed(1);
          return `📄 ${f.name} (${kb} KB)`;
        }).join("\n")));
      } catch (err) {
        return message.reply(UI.error(`GitHub inaccessible.`));
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
        const local = new Set(fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")));
        const remote = new Set((await getRemoteFiles()).map(f => f.name));

        const onlyLocal = [...local].filter(f => !remote.has(f));
        const onlyRemote = [...remote].filter(f => !local.has(f));
        const both = [...local].filter(f => remote.has(f));

        let msg = `📊 Local: ${local.size} | GitHub: ${remote.size}`;
        if (both.length) msg += `\n✅ Commun: ${both.length}`;
        if (onlyLocal.length) msg += `\n💾 Local seul: ${onlyLocal.length}`;
        if (onlyRemote.length) msg += `\n☁ GitHub seul: ${onlyRemote.length}`;
        return message.reply(UI.info(msg));
      } catch (err) {
        return message.reply(UI.error(`Diff échoué.`));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit delete <nom.js>`));

      await message.reply(UI.loading(`Suppression de "${fileName}"...`));

      try {
        const sha = await getFileSha(fileName);
        if (!sha)
          return message.reply(UI.error(`"${fileName}" introuvable sur GitHub.`));

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
        await axios.delete(url, {
          headers: githubHeaders(),
          data: { message: `🗑️ Delete: ${fileName}`, sha, branch: GITHUB_CONFIG.branch }
        });

        return message.reply(UI.success(`${fileName} supprimé.`));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée.`));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Récupération infos..."));
      try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`;
        const res = await axios.get(url, { headers: githubHeaders() });
        const r = res.data;

        ensureCmdDir();
        const localCount = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;

        const msg = `👤 ${r.owner.login}\n📦 ${r.name}\n🌿 ${GITHUB_CONFIG.branch}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n🔒 ${r.private ? "Oui" : "Non"}\n📁 Local: ${localCount} fichiers\n🔗 ${r.html_url}`;
        return message.reply(UI.info(msg));
      } catch (err) {
        return message.reply(UI.error(`Infos impossible.`));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}commit help`));
  }
};