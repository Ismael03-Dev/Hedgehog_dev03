const fs = require("fs");
const path = require("path");
const axios = require("axios");

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
const BOX_WIDTH = 42;

const UI = {
  wrapLine: (text, maxWidth) => {
    if (text.length <= maxWidth) return [text];
    const lines = [];
    let remaining = text;
    while (remaining.length > maxWidth) {
      let cut = maxWidth;
      while (cut > 0 && remaining[cut] !== " " && remaining[cut] !== "," && remaining[cut] !== ".") cut--;
      if (cut === 0) cut = maxWidth;
      lines.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) lines.push(remaining);
    return lines;
  },

  frame: (title, content, icon) => {
    const width = BOX_WIDTH - 4;
    const iconStr = icon ? `${icon} ` : "";
    const titleStr = `${iconStr}${title}`;
    
    const lines = [];
    lines.push(`╭${"─".repeat(BOX_WIDTH - 2)}╮`);
    lines.push(`│ ${titleStr}${" ".repeat(Math.max(0, BOX_WIDTH - 4 - titleStr.length))} │`);
    lines.push(`├${"─".repeat(BOX_WIDTH - 2)}┤`);
    
    if (typeof content === "string") {
      const wrappedLines = UI.wrapLine(content, width);
      wrappedLines.forEach(l => {
        lines.push(`│ ${l}${" ".repeat(Math.max(0, width - l.length))} │`);
      });
    } else if (Array.isArray(content)) {
      content.forEach(item => {
        const wrappedLines = UI.wrapLine(item, width);
        wrappedLines.forEach(l => {
          lines.push(`│ ${l}${" ".repeat(Math.max(0, width - l.length))} │`);
        });
      });
    }
    
    lines.push(`╰${"─".repeat(BOX_WIDTH - 2)}╯`);
    return lines.join("\n");
  },

  success: (title, details) => {
    const content = details ? details.split("\n").map(l => l.trim()).filter(l => l) : [];
    return UI.frame(title, content, "✅");
  },

  error: (msg) => {
    return UI.frame("ERREUR", [msg], "❌");
  },

  info: (title, lines) => {
    return UI.frame(title, lines, "📦");
  },

  hedgehog: (text) => {
    const cleanLines = text.split("\n").map(l => l.trim()).filter(l => l);
    return UI.frame("HEDGEHOG GPT", cleanLines, "🦔");
  },

  warn: (msg) => {
    return UI.frame("ATTENTION", [msg], "⚠️");
  },

  loading: (msg) => {
    return UI.frame("PATIENTEZ", [msg], "⏳");
  }
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
          errors.push(`L${lineNum}: Module "${match[1]}" non installé`);
        }
      }
    }

    if (line.includes("await") && !line.includes("async ")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("const ") && !trimmed.startsWith("let ") && !trimmed.startsWith("var ")) {
        errors.push(`L${lineNum}: "await" sans "async"`);
      }
    }

    if (line.includes("require(") && line.includes("./") && !line.includes(".js") && !line.includes(".json")) {
      const match = line.match(/require\(['"](\.\/[^'"]+)['"]\)/);
      if (match && !match[1].endsWith(".js") && !match[1].endsWith(".json")) {
        errors.push(`L${lineNum}: Extension manquante "${match[1]}"`);
      }
    }
  });

  if (code.includes("module.exports")) {
    if (!code.includes("config:")) errors.push("Structure: 'config' manquant");
    if (!code.includes("onStart:") && !code.includes("onChat:")) {
      errors.push("Structure: 'onStart' ou 'onChat' requis");
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
    "🦔 HEDGEHOG GPT - SYSTÈME DE SÉCURITÉ\n\nCe code est protégé par HedgehogGPT.\nPropriétaire : Ismael03-Dev\nRepo : github.com/Ismael03-Dev/Hedgehog_dev03\n\n⚠️ Ce fichier est verrouillé. Toute tentative de vol est enregistrée.\n🔒 Le vrai code n'est pas accessible via ce lien.\n\nPasse ton chemin. 🦔",
    
    "🔐 ACCÈS RESTREINT\n\nCe Pastebin est un leurre automatisé.\nLe code original est stocké de manière sécurisée.\n\nPropriétaire : Ismael03-Dev\nProtégé par : HedgehogGPT v11.0\n\nSi tu vois ce message, c'est que tu as essayé de voler du code.\nPas de chance. 😈🦔",
    
    "🛡️ HEDGEHOG GUARD — ALERTE\n\nTu as cliqué sur un lien piège.\nCe code est la propriété intellectuelle de Ismael03-Dev.\n\nRéférence : github.com/Ismael03-Dev/Hedgehog_dev03\n\n« Le code appartient à ceux qui le codent. »\n— HedgehogGPT 🦔",
    
    "⚠️ LEURRE DÉTECTÉ\n\nFélicitations, tu as trouvé un faux lien !\nLe vrai fichier est en sécurité sur GitHub.\n\nTemps perdu : environ 10 secondes.\nRegret estimé : élevé.\n\n🦔 HedgehogGPT veille."
  ];
  
  const trapContent = trapMessages[Math.floor(Math.random() * trapMessages.length)];
  return await uploadToPastebin(`TRAP-${fileName}`, trapContent);
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
      return message.reply(UI.hedgehog(
        `🤖 MODE COPILOT\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Hedgehog scan\n` +
        `  → Scan + corrige tout\n` +
        `Hedgehog check <fichier>\n` +
        `  → Vérifie les erreurs\n` +
        `Hedgehog analyse <fichier>\n` +
        `  → Analyse approfondie\n` +
        `Hedgehog fix <fichier>\n` +
        `  → Corrige + commit auto\n` +
        `Hedgehog doc <fichier>\n` +
        `  → Ajoute JSDoc + commit\n` +
        `Hedgehog test <fichier>\n` +
        `  → Génère tests + commit\n` +
        `Hedgehog explain <fichier>\n` +
        `  → Explique le code\n` +
        `Hedgehog simplify <fichier>\n` +
        `  → Refactorise + commit\n` +
        `Hedgehog review <fichier>\n` +
        `  → Code review détaillée\n` +
        `Hedgehog list\n` +
        `  → Liste les fichiers\n` +
        `Hedgehog reset\n` +
        `  → Reset conversation`
      ));
    }

    if (query.toLowerCase() === "reset") {
      this.hedgehogHistory[uid] = [];
      return message.reply(UI.success("CONVERSATION RÉINITIALISÉE", "HedgehogGPT a oublié le contexte."));
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scan automatique de tous les fichiers..."));
      try {
        const results = await autoScanAllFiles();
        
        const lines = [
          `Scan terminé`,
          ``,
          `${results.fixed.length} corrigé(s) + commit`,
          ...results.fixed.map(f => `  ✓ ${f.file}`),
          ``,
          `${results.clean.length} déjà propre(s)`,
          ...results.clean.slice(0, 3).map(f => `  ✨ ${f}`),
          ...(results.clean.length > 3 ? [`  ... et ${results.clean.length - 3} autres`] : []),
          ...(results.errors.length ? [``, `${results.errors.length} échoué(s)`, ...results.errors.map(f => `  ✗ ${f.file}`)] : [])
        ].filter(l => l !== undefined);

        return message.reply(UI.success("SCAN TERMINÉ", lines.join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Scan échoué : ${err.message}`));
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
          return message.reply(UI.success("FICHIER PROPRE", `${fileName} : Aucune erreur détectée.`));
        } else {
          return message.reply(UI.warn(`${errors.length} erreur(s) dans ${fileName}\n\n${errors.join("\n")}\n\nUtilise "Hedgehog fix ${target}" pour corriger.`));
        }
      } catch (err) {
        return message.reply(UI.error(`Check échoué : ${err.message}`));
      }
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const target = explainMatch[1].trim();
      await message.reply(UI.loading(`Analyse de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const prompt = `Explique ce code GoatBot en détail, de façon pédagogique :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nExplique :\n1. Ce que fait ce module\n2. Chaque section (config, onStart, onChat, etc.)\n3. Les fonctions utilisées\n4. Les points intéressants`;
        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(`Explain échoué : ${err.message}`));
      }
    }

    const docMatch = query.match(/^doc\s+(.+)$/i);
    if (docMatch) {
      const target = docMatch[1].trim();
      await message.reply(UI.loading(`Ajout de documentation sur ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const prompt = `Ajoute une documentation JSDoc complète à ce fichier GoatBot. Documente chaque fonction, chaque paramètre, chaque retour. Ajoute des commentaires explicatifs. Retourne UNIQUEMENT le code documenté complet, sans explications, sans backticks :\n\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Doc: ajout JSDoc sur ${fileName}`);
        return message.reply(UI.success("DOCUMENTATION AJOUTÉE + COMMIT", `${fileName}\n${newCode.length} caractères`));
      } catch (err) {
        return message.reply(UI.error(`Doc échoué : ${err.message}`));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const target = testMatch[1].trim();
      await message.reply(UI.loading(`Génération des tests pour ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const testFileName = fileName.replace(".js", ".test.js");
        const prompt = `Génère des tests unitaires complets pour ce module GoatBot. Utilise une structure de test simple (pas de framework externe). Crée un module de test qui simule les fonctions et vérifie leur comportement. Retourne UNIQUEMENT le code de test, sans explications, sans backticks :\n\nModule à tester (${fileName}):\n${code}`;
        const testCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(testFileName, testCode, `🦔 Test: génération tests pour ${fileName}`);
        return message.reply(UI.success("TESTS GÉNÉRÉS + COMMIT", `${testFileName}\n${testCode.length} caractères`));
      } catch (err) {
        return message.reply(UI.error(`Test échoué : ${err.message}`));
      }
    }

    const simplifyMatch = query.match(/^simplify\s+(.+)$/i);
    if (simplifyMatch) {
      const target = simplifyMatch[1].trim();
      await message.reply(UI.loading(`Simplification de ${target}...`));
      try {
        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const prompt = `Simplifie et refactorise ce code GoatBot pour le rendre plus lisible et plus court, sans changer ses fonctionnalités. Retourne UNIQUEMENT le code simplifié complet, sans explications, sans backticks :\n\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Simplify: refactorisation de ${fileName}`);
        return message.reply(UI.success("CODE SIMPLIFIÉ + COMMIT", `${fileName}\n${code.length} → ${newCode.length} caractères`));
      } catch (err) {
        return message.reply(UI.error(`Simplify échoué : ${err.message}`));
      }
    }

    if (query.toLowerCase() === "list") {
      await message.reply(UI.loading("Récupération des fichiers GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.warn("Aucun fichier trouvé sur GitHub."));
        const kb = (f) => (f.size / 1024).toFixed(1);
        return message.reply(UI.info(`FICHIERS (${files.length})`, files.map(f => `${f.name} (${kb(f)} KB)`)));
      } catch (err) {
        return message.reply(UI.error(`Liste impossible : ${err.message}`));
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
            return `=== ${f.name} ===\n${code.slice(0, 1500)}`;
          }));
          prompt = `Analyse globale du repository (${files.length} fichiers, échantillon de ${samples.length}) :\n\n${contents.join("\n\n")}\n\nRapport global : qualité du code, patterns, problèmes récurrents, recommandations.`;
        } else {
          const fileName = normalizeName(target);
          const code = await getFileContent(fileName);
          prompt = `Analyse ce fichier GoatBot :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\nDonne une analyse : structure, qualité, bugs potentiels, points d'amélioration.`;
        }

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(`Analyse échouée : ${err.message}`));
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
              const errorList = errors.length > 0 ? `\nErreurs détectées:\n${errors.join("\n")}` : "";
              const prompt = `Améliore et corrige ce fichier GoatBot.${errorList}\nRetourne UNIQUEMENT le code corrigé complet, sans explications, sans backticks :\n\n${code}`;
              const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
              await pushFileToGithub(file.name, newCode, `🦔 Fix: correction de ${file.name}`);
              results.ok.push(file.name);
            } catch {
              results.fail.push(file.name);
            }
          }

          return message.reply(UI.info("FIX GLOBAL", [
            `${results.ok.length} corrigé(s) + commit`,
            ...results.ok.map(f => `  ✓ ${f}`),
            ...(results.fail.length ? [`${results.fail.length} échoué(s)`, ...results.fail.map(f => `  ✗ ${f}`)] : [])
          ]));
        }

        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const errors = detectSyntaxErrors(code, fileName);
        const errorList = errors.length > 0 ? `\nErreurs détectées:\n${errors.join("\n")}` : "";
        const prompt = `Améliore et corrige ce fichier GoatBot.${errorList}\nRetourne UNIQUEMENT le code corrigé complet, sans explications, sans backticks :\n\nFichier : ${fileName}\n${code}`;
        const newCode = await askHedgehog(this.hedgehogHistory[uid], prompt);
        await pushFileToGithub(fileName, newCode, `🦔 Fix: correction de ${fileName}`);

        return message.reply(UI.success("FICHIER CORRIGÉ + COMMIT", [
          fileName,
          `github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`,
          errors.length > 0 ? `${errors.length} erreur(s) corrigée(s)` : `Aucune erreur détectée`,
          `${newCode.length} caractères`
        ].join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Fix échoué : ${err.message}`));
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
        const errorSection = errors.length > 0 ? `\nErreurs détectées automatiquement:\n${errors.join("\n")}` : "";
        const prompt = `Code review professionnelle de ce fichier GoatBot :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`${errorSection}\n\nStructure :\n1. Points positifs\n2. Bugs détectés\n3. Problèmes de performance\n4. Suggestions d'amélioration\n5. Score global /10`;

        const reply = await askHedgehog(this.hedgehogHistory[uid], prompt);
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(`Review échouée : ${err.message}`));
      }
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));

    try {
      const repoContext = `Contexte : repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}, branche ${GITHUB_CONFIG.branch}.`;
      const reply = await askHedgehog(this.hedgehogHistory[uid], `${repoContext}\n\n${query}`);
      return message.reply(UI.hedgehog(reply));
    } catch (err) {
      return message.reply(UI.error(`HedgehogGPT indisponible : ${err.message}`));
    }
  },

  onStart: async function ({ args, message, event }) {
    if (!ALLOWED.includes(event.senderID.toString()))
      return message.reply(UI.error("Permission refusée."));

    const sub = args[0]?.toLowerCase();
    const p = global.utils.getPrefix(event.threadID);

    if (!sub || sub === "help") {
      return message.reply(UI.info("COMMIT — AIDE", [
        `${p}commit list`,
        `  → Commandes locales`,
        ``,
        `${p}commit remote`,
        `  → Commandes sur GitHub`,
        ``,
        `${p}commit save <nom> <contenu>`,
        `  → Créer une commande locale`,
        ``,
        `${p}commit paste <nom> <lien>`,
        `  → Importer depuis Pastebin`,
        ``,
        `${p}commit paste <nom> <lien> --push`,
        `  → Importer + push`,
        ``,
        `${p}commit export <fichier>`,
        `  → Exporter vers Pastebin`,
        ``,
        `${p}commit push <fichier>`,
        `  → Push un fichier`,
        ``,
        `${p}commit pushall`,
        `  → Push tous les fichiers`,
        ``,
        `${p}commit pull`,
        `  → Récupérer depuis GitHub`,
        ``,
        `${p}commit sync`,
        `  → Synchronisation complète`,
        ``,
        `${p}commit diff`,
        `  → Comparer local vs GitHub`,
        ``,
        `${p}commit delete <fichier>`,
        `  → Supprimer sur GitHub`,
        ``,
        `${p}commit rename <ancien> <nouveau>`,
        `  → Renommer un fichier`,
        ``,
        `${p}commit info`,
        `  → Infos du dépôt`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━`,
        `🦔 HedgehogGPT :`,
        `   Tape "Hedgehog help"`,
        `   dans le chat !`
      ]));
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
        exists ? "COMMANDE MISE À JOUR" : "COMMANDE CRÉÉE",
        `${finalName}\n${filePath}\n${content.length} caractères`
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
          return message.reply(UI.error("Le Pastebin est vide ou inaccessible."));

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
              exists ? "MIS À JOUR + COMMIT" : "IMPORTÉ + COMMIT",
              [
                `📄 ${finalName}`,
                `🔗 ${fakePastebinUrl || "https://pastebin.com/blocked"}`,
                `📝 ${content.length} caractères`
              ].join("\n")
            ));
          } catch (err) {
            return message.reply(UI.warn(`Sauvegardé localement, commit échoué : ${err.message}`));
          }
        }

        return message.reply(UI.success(
          exists ? "MIS À JOUR (PASTEBIN)" : "IMPORTÉ (PASTEBIN)",
          [
            `📄 ${finalName}`,
            `🔗 ${fakePastebinUrl || "https://pastebin.com/blocked"}`,
            `📝 ${content.length} caractères`
          ].join("\n")
        ));
      } catch (err) {
        return message.reply(UI.error(`Lecture Pastebin impossible : ${err.message}`));
      }
    }

    if (sub === "export") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit export <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable.`));

      await message.reply(UI.loading(`Export de "${fileName}" vers Pastebin...`));

      try {
        const content = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);

        if (!pasteUrl)
          return message.reply(UI.warn("Export échoué, vérifie ta clé API Pastebin."));

        return message.reply(UI.success("EXPORTÉ SUR PASTEBIN", `${fileName}\n${pasteUrl}\n${content.length} caractères`));
      } catch (err) {
        return message.reply(UI.error(`Export échoué : ${err.message}`));
      }
    }

    if (sub === "push") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit push <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath))
        return message.reply(UI.error(`Fichier "${fileName}" introuvable.`));

      await message.reply(UI.loading(`Push de "${fileName}" vers GitHub...`));

      try {
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(fileName, content, `🦔 Commit: push ${fileName}`);
        return message.reply(UI.success("FICHIER PUSHÉ", `${fileName}\ngithub.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`));
      } catch (err) {
        return message.reply(UI.error(`Push échoué : ${err.response?.data?.message || err.message}`));
      }
    }

    if (sub === "pushall") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.warn("Aucun fichier local à envoyer."));

      await message.reply(UI.loading(`Push de ${files.length} fichier(s)...`));

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

      return message.reply(UI.info("PUSHALL", [
        `${results.ok.length} réussi(s)`,
        ...results.ok.map(f => `  ✓ ${f}`),
        ...(results.fail.length ? [`${results.fail.length} échoué(s)`, ...results.fail.map(f => `  ✗ ${f}`)] : [])
      ]));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Récupération depuis GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GITHUB VIDE", ["Aucune commande à récupérer."]));

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

        return message.reply(UI.info("PULL", [
          `${results.ok.length} récupéré(s)`,
          ...results.ok.map(f => `  ✓ ${f}`),
          ...(results.fail.length ? [`${results.fail.length} échoué(s)`, ...results.fail.map(f => `  ✗ ${f}`)] : [])
        ]));
      } catch (err) {
        return message.reply(UI.error(`Pull échoué : ${err.message}`));
      }
    }

    if (sub === "sync") {
      await message.reply(UI.loading("Synchronisation complète..."));
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

        return message.reply(UI.info("SYNC TERMINÉE", [
          `Pull: ${pullResults.ok.length} récupéré(s)`,
          ...pullResults.ok.map(f => `  ⬇ ${f}`),
          `Push: ${pushResults.ok.length} envoyé(s)`,
          ...pushResults.ok.map(f => `  ⬆ ${f}`),
          ...(pullResults.fail.length || pushResults.fail.length ? [`Échecs: ${pullResults.fail.length + pushResults.fail.length}`] : [])
        ]));
      } catch (err) {
        return message.reply(UI.error(`Sync échouée : ${err.message}`));
      }
    }

    if (sub === "list") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length)
        return message.reply(UI.info("AUCUNE COMMANDE", ["scripts/cmds est vide."]));

      const sizes = files.map(f => {
        const stat = fs.statSync(path.join(CMD_PATH, f));
        const kb = (stat.size / 1024).toFixed(1);
        return `${f} (${kb} KB)`;
      });
      return message.reply(UI.info(`COMMANDES LOCALES (${files.length})`, sizes));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Récupération de la liste GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length)
          return message.reply(UI.info("GITHUB VIDE", ["Aucune commande sur GitHub."]));

        return message.reply(UI.info(`COMMANDES GITHUB (${files.length})`, files.map(f => {
          const kb = (f.size / 1024).toFixed(1);
          return `${f.name} (${kb} KB)`;
        })));
      } catch (err) {
        return message.reply(UI.error(`GitHub inaccessible : ${err.message}`));
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
      return message.reply(UI.success("FICHIER RENOMMÉ", `${oldName} → ${newName}`));
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

        return message.reply(UI.info("DIFF LOCAL vs GITHUB", [
          `Local: ${local.size} | GitHub: ${remote.size}`,
          ...(both.length ? [`En commun (${both.length})`, ...both.map(f => `  ✓ ${f}`)] : []),
          ...(onlyLocal.length ? [`Local seulement (${onlyLocal.length})`, ...onlyLocal.map(f => `  💾 ${f}`)] : []),
          ...(onlyRemote.length ? [`GitHub seulement (${onlyRemote.length})`, ...onlyRemote.map(f => `  ☁ ${f}`)] : [])
        ]));
      } catch (err) {
        return message.reply(UI.error(`Diff échoué : ${err.message}`));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1])
        return message.reply(UI.error(`Usage : ${p}commit delete <nom.js>`));

      await message.reply(UI.loading(`Suppression de "${fileName}" sur GitHub...`));

      try {
        const sha = await getFileSha(fileName);
        if (!sha)
          return message.reply(UI.error(`"${fileName}" introuvable sur GitHub.`));

        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}`;
        await axios.delete(url, {
          headers: githubHeaders(),
          data: { message: `🗑️ Delete: ${fileName}`, sha, branch: GITHUB_CONFIG.branch }
        });

        return message.reply(UI.success("FICHIER SUPPRIMÉ", fileName));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée : ${err.response?.data?.message || err.message}`));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Récupération des infos GitHub..."));
      try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`;
        const res = await axios.get(url, { headers: githubHeaders() });
        const r = res.data;

        ensureCmdDir();
        const localCount = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;

        return message.reply(UI.info("INFOS DÉPÔT", [
          `Owner: ${r.owner.login}`,
          `Repo: ${r.name}`,
          `Branche: ${GITHUB_CONFIG.branch}`,
          `Stars: ${r.stargazers_count}`,
          `Forks: ${r.forks_count}`,
          `Privé: ${r.private ? "Oui" : "Non"}`,
          `Local: ${localCount} fichier(s)`,
          `URL: ${r.html_url}`
        ]));
      } catch (err) {
        return message.reply(UI.error(`Infos impossible : ${err.message}`));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}commit help`));
  }
};