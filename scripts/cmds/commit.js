const fs     = require("fs");
const path   = require("path");
const axios  = require("axios");
const { createCanvas } = require("canvas");

const CONFIG_PATH   = path.join(process.cwd(), "data", "commit_config.json");
const HISTORY_PATH  = path.join(process.cwd(), "data", "hedgehog_history.json");
const BACKUP_PATH   = path.join(process.cwd(), "data", "hedgehog_backups.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH))
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {}
  return {};
}

const CONFIG = loadConfig();

const GITHUB_CONFIG = {
  username: CONFIG.github_username || "Ismael03-Dev",
  repo:     CONFIG.github_repo     || "Hedgehog_dev03",
  branch:   CONFIG.github_branch   || "main",
  token:    CONFIG.github_token    || "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"
};

const MISTRAL_API_KEY  = CONFIG.mistral_key  || "VCFZLWLWcxk6SIMIZHa0HjGr2rRwrZhN";
const PASTEBIN_API_KEY = CONFIG.pastebin_key || "LFhKGk5aRuRBII5zKZbbEpQjZzboWDp9";
const CMD_PATH         = path.join(process.cwd(), "scripts", "cmds");
const ALLOWED          = CONFIG.allowed      || ["61578433048588"];

const MAX_FILE_SIZE   = 80000;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;
const REACTION_TTL    = 3 * 60 * 1000;

let tokenCache = { valid: null, user: null, ts: 0 };

const pendingActions = new Map();

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
  loading:  (text) => UI.frame("⏳", text),
  pending:  (text) => UI.frame("💬", text)
};

const SYSTEM_PROMPT = `Tu es HedgehogGPT, un assistant IA expert en développement JavaScript et en bots Messenger (GoatBot/fca-unofficial).
Tu as un accès TOTAL au repository GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (branche: ${GITHUB_CONFIG.branch}).
Tu peux lire, analyser, modifier, créer et supprimer n'importe quel fichier du repository.
Tu te souviens de toutes les discussions passées avec l'utilisateur.

Quand tu analyses un fichier et que tu veux proposer des améliorations, structure ta réponse ainsi :
1. Analyse rapide du fichier
2. Liste des améliorations proposées
3. Termine TOUJOURS par : "💬 Réagis à ce message pour que j'applique les améliorations directement sur GitHub."

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

function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function loadBackups() {
  try {
    if (fs.existsSync(BACKUP_PATH))
      return JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
  } catch {}
  return {};
}

function saveBackup(fileName, content) {
  ensureDataDir();
  try {
    const backups = loadBackups();
    if (!backups[fileName]) backups[fileName] = [];
    backups[fileName].unshift({ content, date: new Date().toISOString(), size: content.length });
    if (backups[fileName].length > 5) backups[fileName] = backups[fileName].slice(0, 5);
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backups, null, 2), "utf8");
  } catch (e) {
    console.error("[backup]", e.message);
  }
}

function getBackup(fileName, index = 0) {
  return loadBackups()[fileName]?.[index] || null;
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

async function verifyToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && tokenCache.valid !== null && (now - tokenCache.ts) < TOKEN_CACHE_TTL)
    return { valid: tokenCache.valid, user: tokenCache.user };

  try {
    const res  = await axios.get("https://api.github.com/user", { headers: githubHeaders() });
    tokenCache = { valid: true, user: res.data.login, ts: now };
    return { valid: true, user: res.data.login };
  } catch (err) {
    const status = err.response?.status;
    tokenCache   = { valid: false, user: null, ts: now };
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
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}?ref=${GITHUB_CONFIG.branch}&timestamp=${Date.now()}`;
  const res = await axios.get(url, {
    headers: { ...githubHeaders(), "Cache-Control": "no-cache" }
  });
  if (!res.data.content) throw new Error(`Fichier "${fileName}" introuvable sur GitHub`);
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
  const encodedContent = Buffer.from(
    typeof content === "string" ? content : fs.readFileSync(content)
  ).toString("base64");

  const sha  = await getFileSha(fileName);
  const body = {
    message: commitMsg || `🦔 HedgehogGPT: commit ${fileName}`,
    content: encodedContent,
    branch:  GITHUB_CONFIG.branch
  };
  if (sha) body.sha = sha;

  const response = await axios.put(url, body, { headers: githubHeaders() });

  if (response.status !== 200 && response.status !== 201)
    throw new Error(`GitHub a retourné le statut ${response.status}`);

  return response.data;
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

async function getCommitContent(fileName, commitSha) {
  const url = `https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/contents/scripts/cmds/${fileName}?ref=${commitSha}`;
  const res = await axios.get(url, { headers: githubHeaders() });
  return Buffer.from(res.data.content, "base64").toString("utf8");
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
      { model: "mistral-large-latest", messages, max_tokens: 4096, temperature: 0.3 },
      {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
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

function detectSyntaxErrors(code) {
  const errors  = [];
  const lines   = code.split("\n");
  const asyncAt = [];

  lines.forEach((line, i) => {
    if (/async\s+(function|\(|[a-zA-Z_$])/.test(line)) asyncAt.push(i);
  });

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    if (line.includes("require(")) {
      const match = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (match && !match[1].startsWith(".") && !match[1].startsWith("/")) {
        try { require.resolve(match[1]); } catch {
          errors.push(`L${lineNum}: "${match[1]}" non installé`);
        }
      }
    }

    if (line.includes("await ") && !asyncAt.some(start => i >= start))
      if (!lines.slice(0, i).some(l => /async\s/.test(l)))
        errors.push(`L${lineNum}: await hors contexte async`);
  });

  const tryCounts   = (code.match(/\btry\s*\{/g) || []).length;
  const catchCounts = (code.match(/\bcatch\s*[({]/g) || []).length;
  if (tryCounts > catchCounts)
    errors.push(`Syntaxe: ${tryCounts - catchCounts} try sans catch`);

  if (code.includes("module.exports")) {
    if (!code.includes("config:"))                                errors.push("Structure: config manquant");
    if (!code.includes("onStart:") && !code.includes("onChat:")) errors.push("Structure: onStart/onChat requis");
  }

  const ob = (code.match(/\{/g) || []).length;
  const cb = (code.match(/\}/g) || []).length;
  if (ob !== cb) errors.push(`Accolades déséquilibrées ({${ob}} vs }${cb})`);

  const op = (code.match(/\(/g) || []).length;
  const cp = (code.match(/\)/g) || []).length;
  if (op !== cp) errors.push(`Parenthèses déséquilibrées ((${op}) vs )${cp})`);

  return errors;
}

function diffFiles(oldCode, newCode) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  const added    = newLines.filter(l => !oldLines.includes(l)).length;
  const removed  = oldLines.filter(l => !newLines.includes(l)).length;
  return { added, removed, oldLines: oldLines.length, newLines: newLines.length, summary: `+${added} / -${removed} lignes` };
}

async function autoScanAllFiles(history) {
  const files   = await getRemoteFiles();
  const results = { fixed: [], errors: [], clean: [] };

  for (const file of files) {
    try {
      const code   = await getFileContent(file.name);
      const errors = detectSyntaxErrors(code);

      if (errors.length > 0) {
        if (code.length > MAX_FILE_SIZE) {
          results.errors.push({ file: file.name, reason: "Trop volumineux" });
          continue;
        }
        saveBackup(file.name, code);
        const prompt  = `Corrige TOUTES les erreurs dans ce fichier GoatBot.\nErreurs:\n${errors.join("\n")}\n\nRetourne UNIQUEMENT le code corrigé complet, sans explications, sans backticks:\n\n${code}`;
        const newCode = await askHedgehog(history || [], prompt);

        if (newCode && newCode !== code && newCode.length > 50) {
          await pushFileToGithub(file.name, newCode, `🦔 Auto-scan: correction de ${file.name}`);
          results.fixed.push({ file: file.name, errors });
        } else {
          results.errors.push({ file: file.name, reason: "Correction invalide" });
        }
      } else {
        results.clean.push(file.name);
      }
    } catch (err) {
      results.errors.push({ file: file.name, reason: err.message });
      console.error(`[scan] ${file.name}:`, err.message);
    }
  }

  return results;
}

async function createTrapPastebin(fileName) {
  const msgs = [
    "🦔 HEDGEHOG GPT\n\nCode protégé.\nPropriétaire: Ismael03-Dev\n\n⚠️ Fichier verrouillé.",
    "🔐 ACCÈS RESTREINT\n\nLeurre automatisé.\nCode sécurisé sur GitHub.\n\nIsmael03-Dev",
    "🛡️ HEDGEHOG GUARD\n\nLien piège.\nPropriété de Ismael03-Dev.",
    "⚠️ LEURRE DÉTECTÉ\n\nFaux lien !\nVrai code sur GitHub."
  ];
  return await uploadToPastebin(`TRAP-${fileName}`, msgs[Math.floor(Math.random() * msgs.length)]);
}

function createCodeImageSync(code, fileName) {
  const lineHeight = 20, padding = 20, fontSize = 13, headerHeight = 40, maxLineWidth = 70;
  const rawLines   = code.split("\n").slice(0, 35);
  const display    = [];

  rawLines.forEach(line => {
    if (line.length <= maxLineWidth) { display.push(line); return; }
    let r = line;
    while (r.length > maxLineWidth) { display.push(r.slice(0, maxLineWidth)); r = r.slice(maxLineWidth); }
    if (r) display.push(r);
  });

  const sliced = display.slice(0, 35);
  const width  = Math.max(400, maxLineWidth * 8 + padding * 2);
  const height = sliced.length * lineHeight + headerHeight + padding;
  const canvas = createCanvas(width, height);
  const ctx    = canvas.getContext("2d");

  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#161b22"; ctx.fillRect(0, 0, width, headerHeight);

  [["#ff7b72", 7], ["#f0df72", 22], ["#56d364", 37]].forEach(([c, cx]) => {
    ctx.fillStyle = c; ctx.beginPath();
    ctx.arc(padding + cx, headerHeight / 2, 6, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "#8b949e"; ctx.font = `${fontSize}px Courier New`;
  ctx.fillText(fileName.slice(0, 30), padding + 55, headerHeight / 2 + 4);

  const keywords = ["const","let","var","function","async","await","return","if","else","for","while","try","catch","require","module","exports","true","false","null","undefined","new","class","import","from","export","default"];
  const methods  = ["fs.","path.","axios.","message.","event.","global.","console."];

  sliced.forEach((line, i) => {
    const y = headerHeight + padding + i * lineHeight;
    let x = padding, rem = line;

    while (rem.length > 0) {
      if (rem.startsWith("//")) {
        ctx.fillStyle = "#8b949e"; ctx.font = `${fontSize}px Courier New`;
        ctx.fillText(rem.slice(0, maxLineWidth), x, y); return;
      }

      let found = false;
      for (const kw of keywords) {
        if (rem.startsWith(kw) && (!rem[kw.length] || /[^a-zA-Z0-9_$]/.test(rem[kw.length]))) {
          ctx.fillStyle = "#ff7b72"; ctx.font = `bold ${fontSize}px Courier New`;
          ctx.fillText(kw, x, y); x += ctx.measureText(kw).width;
          rem = rem.slice(kw.length); found = true; break;
        }
      }
      if (found) continue;

      for (const m of methods) {
        if (rem.startsWith(m)) {
          ctx.fillStyle = "#d2a8ff"; ctx.font = `${fontSize}px Courier New`;
          ctx.fillText(m, x, y); x += ctx.measureText(m).width;
          rem = rem.slice(m.length); found = true; break;
        }
      }
      if (found) continue;

      const sm = rem.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/);
      if (sm) {
        ctx.fillStyle = "#a5d6ff"; ctx.font = `${fontSize}px Courier New`;
        ctx.fillText(sm[0], x, y); x += ctx.measureText(sm[0]).width;
        rem = rem.slice(sm[0].length); continue;
      }

      ctx.fillStyle = "#c9d1d9"; ctx.font = `${fontSize}px Courier New`;
      ctx.fillText(rem[0], x, y); x += ctx.measureText(rem[0]).width;
      rem = rem.slice(1);
    }
  });

  const buffer  = canvas.toBuffer("image/png");
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const imgPath = path.join(tempDir, `code_${Date.now()}.png`);
  fs.writeFileSync(imgPath, buffer);
  if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size === 0) throw new Error("Image vide");
  return imgPath;
}

module.exports = {
  config: {
    name:             "commit",
    version:          "16.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "HedgehogGPT - Copilot GitHub complet avec réactions" }
  },

  hedgehogHistory: {},

  loadHistory: function () {
    ensureDataDir();
    try {
      if (!fs.existsSync(HISTORY_PATH)) return {};
      return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    } catch { return {}; }
  },

  saveHistory: function () {
    ensureDataDir();
    try {
      fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.hedgehogHistory, null, 2), "utf8");
    } catch (e) { console.error("[history]", e.message); }
  },

  getHistory: function (uid) {
    if (!this.hedgehogHistory[uid]) {
      const saved = this.loadHistory();
      this.hedgehogHistory[uid] = saved[uid] || [];
    }
    return this.hedgehogHistory[uid];
  },

  onReaction: async function ({ message, event, Reaction }) {
    if (!ALLOWED.includes(event.userID.toString())) return;

    const action = pendingActions.get(Reaction.messageID);
    if (!action) return;

    pendingActions.delete(Reaction.messageID);

    if (Date.now() > action.expiresAt)
      return message.reply(UI.warn("Action expirée. Redemande à HedgehogGPT."));

    await message.reply(UI.loading(`Application des améliorations sur ${action.fileName}...`));

    try {
      const tokenCheck = await verifyToken();
      if (!tokenCheck.valid)
        return message.reply(UI.error(`Token invalide : ${tokenCheck.reason}`));

      const currentCode = await getFileContent(action.fileName);
      saveBackup(action.fileName, currentCode);

      const result = await pushFileToGithub(action.fileName, action.newCode, `🦔 HedgehogGPT: amélioration de ${action.fileName}`);

      const d = diffFiles(currentCode, action.newCode);

      const localPath = path.join(CMD_PATH, action.fileName);
      if (fs.existsSync(localPath))
        fs.writeFileSync(localPath, action.newCode, "utf8");

      return message.reply(UI.success(
        `${action.fileName} amélioré + commit ✅\n` +
        `${d.summary}\n` +
        `🔗 github.com/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}/blob/${GITHUB_CONFIG.branch}/scripts/cmds/${action.fileName}`
      ));
    } catch (err) {
      return message.reply(UI.error(`Application échouée : ${err.message}`));
    }
  },

  onChat: async function ({ message, event }) {
    if (!ALLOWED.includes(event.senderID.toString())) return;

    const body = event.body?.trim() || "";
    if (!body.toLowerCase().startsWith("hedgehog")) return;

    const uid     = event.senderID.toString();
    const query   = body.slice(8).trim();
    const history = this.getHistory(uid);

    if (!query || query.toLowerCase() === "help") {
      return message.reply(
        `╭─────────────────────•\n` +
        `│ 🦔 𝐇𝐄𝐃𝐆𝐄𝐇𝐎𝐆 𝐆𝐏𝐓 𝐯𝟏𝟔\n` +
        `├─────────────────────•\n` +
        `│ analyse <f> → Analyse + propose amélios\n` +
        `│ fix <f|*> → Corrige + commit direct\n` +
        `│ improve <f> → Améliore (réaction requise)\n` +
        `│ scan → Scan + corrige tout\n` +
        `│ check <f> → Vérifie erreurs\n` +
        `│ preview <f> → Aperçu image\n` +
        `│ create <nom> <desc> → Crée fichier\n` +
        `│ doc <f> → JSDoc + commit\n` +
        `│ test <f> → Tests + commit\n` +
        `│ explain <f> → Explique code\n` +
        `│ simplify <f> → Refactorise\n` +
        `│ review <f> → Code review\n` +
        `│ diff <f> → Compare local/GitHub\n` +
        `│ rollback <f> [n] → Restaurer backup\n` +
        `│ rename <anc> <nouv> → Renommer\n` +
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
      const check = await verifyToken(true);
      return check.valid
        ? message.reply(UI.success(`Token valide\n👤 ${check.user}\n📦 ${GITHUB_CONFIG.repo}`))
        : message.reply(UI.error(`Token invalide : ${check.reason}`));
    }

    if (query.toLowerCase() === "tree") {
      await message.reply(UI.loading("Récupération de l'arborescence..."));
      try {
        const tree    = await getRepoTree();
        const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
        const lines   = jsFiles.slice(0, 30).map(f => `📄 ${f.path}`);
        if (jsFiles.length > 30) lines.push(`... et ${jsFiles.length - 30} autres`);
        return message.reply(UI.info(`Arborescence (${jsFiles.length} JS)\n` + lines.join("\n")));
      } catch (err) {
        return message.reply(UI.error(`Arborescence impossible : ${err.message}`));
      }
    }

    const improveMatch = query.match(/^improve\s+(.+)$/i);
    if (improveMatch) {
      const target = improveMatch[1].trim();
      await message.reply(UI.loading(`HedgehogGPT analyse ${target} pour proposer des améliorations...`));

      try {
        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);

        if (code.length > MAX_FILE_SIZE)
          return message.reply(UI.warn(`Fichier trop volumineux.`));

        const errors   = detectSyntaxErrors(code);
        const errorSection = errors.length > 0 ? `\nErreurs détectées:\n${errors.join("\n")}` : "";

        const analysisPrompt = `Analyse ce fichier GoatBot et liste les améliorations possibles (sans modifier le code pour l'instant) :\n\nFichier : ${fileName}${errorSection}\n\`\`\`javascript\n${code}\n\`\`\`\n\nListe les améliorations précises que tu peux apporter. Termine par : "💬 Réagis à ce message pour que j'applique les améliorations directement sur GitHub."`;

        const analysis = await askHedgehog(history, analysisPrompt);

        const improvePrompt = `Maintenant applique toutes les améliorations que tu viens de proposer sur ce fichier. Retourne UNIQUEMENT le code amélioré complet, sans explications, sans backticks :\n\n${code}`;
        const newCode       = await askHedgehog([], improvePrompt);

        const sentMsg = await new Promise(resolve =>
          message.reply(UI.hedgehog(analysis), (err, info) => resolve(info))
        );

        if (sentMsg?.messageID) {
          pendingActions.set(sentMsg.messageID, {
            type:      "improve",
            fileName,
            newCode,
            uid,
            expiresAt: Date.now() + REACTION_TTL
          });

          setTimeout(() => {
            if (pendingActions.has(sentMsg.messageID)) {
              pendingActions.delete(sentMsg.messageID);
            }
          }, REACTION_TTL);
        }

        this.saveHistory();
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const readMatch = query.match(/^read\s+(https?:\/\/\S+)$/i);
    if (readMatch) {
      const url = readMatch[1].trim();
      await message.reply(UI.loading("Lecture du lien..."));
      try {
        let content = "";
        if (url.includes("pastebin.com")) {
          const { content: pc } = await fetchPastebinContent(url);
          content = pc;
        } else if (url.includes("github.com") && url.includes("/blob/")) {
          const rawUrl = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
          content = await getFileContentFromUrl(rawUrl);
        } else {
          content = await getFileContentFromUrl(url);
        }

        if (!content || !content.trim())
          return message.reply(UI.warn("Contenu vide ou inaccessible."));

        const preview = content.length > 1500 ? content.slice(0, 1500) + "\n... (tronqué)" : content;
        const reply   = await askHedgehog(history, `Voici le contenu de ${url} :\n\n${preview}\n\nAnalyse ce contenu.`);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(`Lecture impossible : ${err.message}`));
      }
    }

    const diffMatch = query.match(/^diff\s+(.+)$/i);
    if (diffMatch) {
      const target = normalizeName(diffMatch[1].trim());
      await message.reply(UI.loading(`Comparaison de ${target}...`));
      try {
        const remoteCode = await getFileContent(target);
        const localPath  = path.join(CMD_PATH, target);

        if (!fs.existsSync(localPath))
          return message.reply(UI.warn(`Pas de version locale pour ${target}.`));

        const localCode = fs.readFileSync(localPath, "utf8");
        const d         = diffFiles(localCode, remoteCode);
        const prompt    = `Compare ces deux versions de ${target} :\n\n=== LOCAL ===\n${localCode.slice(0, 2000)}\n\n=== GITHUB ===\n${remoteCode.slice(0, 2000)}\n\nDifférences: ${d.summary}`;
        const reply     = await askHedgehog(history, prompt);
        this.saveHistory();
        return message.reply(UI.hedgehog(`${d.summary}\n\n${reply}`));
      } catch (err) {
        return message.reply(UI.error(`Diff impossible : ${err.message}`));
      }
    }

    const rollbackMatch = query.match(/^rollback\s+(\S+)(?:\s+(\d+))?$/i);
    if (rollbackMatch) {
      const fileName = normalizeName(rollbackMatch[1].trim());
      const index    = parseInt(rollbackMatch[2] || "0");
      await message.reply(UI.loading(`Rollback de ${fileName}...`));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token invalide : ${tokenCheck.reason}`));

        const backup = getBackup(fileName, index);
        if (backup) {
          await pushFileToGithub(fileName, backup.content, `🦔 Rollback: ${fileName} (backup #${index + 1})`);
          return message.reply(UI.success(`${fileName} restauré depuis backup #${index + 1}\n📅 ${new Date(backup.date).toLocaleString("fr-FR")}\n📝 ${backup.size} car.`));
        }

        const commits = await getCommitHistory(fileName);
        if (!commits.length)
          return message.reply(UI.warn("Aucun commit ni backup trouvé."));

        const target    = commits[Math.min(index + 1, commits.length - 1)];
        const oldCode   = await getCommitContent(fileName, target.sha);
        const curCode   = await getFileContent(fileName);
        saveBackup(fileName, curCode);
        await pushFileToGithub(fileName, oldCode, `🦔 Rollback: ${fileName} → ${target.sha.slice(0, 7)}`);
        return message.reply(UI.success(`${fileName} rollback réussi\n📌 ${target.commit.message.slice(0, 40)}\n📅 ${new Date(target.commit.author.date).toLocaleString("fr-FR")}`));
      } catch (err) {
        return message.reply(UI.error(`Rollback échoué : ${err.message}`));
      }
    }

    const renameMatch = query.match(/^rename\s+(\S+)\s+(\S+)$/i);
    if (renameMatch) {
      const oldName = normalizeName(renameMatch[1].trim());
      const newName = normalizeName(renameMatch[2].trim());
      await message.reply(UI.loading(`Renommage ${oldName} → ${newName}...`));

      try {
        const tokenCheck = await verifyToken();
        if (!tokenCheck.valid)
          return message.reply(UI.error(`Token invalide : ${tokenCheck.reason}`));

        const content = await getFileContent(oldName);
        saveBackup(oldName, content);
        await pushFileToGithub(newName, content, `🦔 Rename: ${oldName} → ${newName}`);
        await deleteFileOnGithub(oldName);

        const localOld = path.join(CMD_PATH, oldName);
        if (fs.existsSync(localOld)) fs.renameSync(localOld, path.join(CMD_PATH, newName));

        return message.reply(UI.success(`${oldName} → ${newName} sur GitHub ✅`));
      } catch (err) {
        return message.reply(UI.error(`Renommage échoué : ${err.message}`));
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

        const lines = commits.map((c, i) => {
          const date = new Date(c.commit.author.date).toLocaleString("fr-FR");
          return `#${i} 📌 ${c.commit.message.slice(0, 40)}\n   👤 ${c.commit.author.name} | 🕐 ${date}`;
        });
        return message.reply(UI.info(`Historique ${target}\n\n` + lines.join("\n\n") + `\n\nUsage: Hedgehog rollback ${target} <#>`));
      } catch (err) {
        return message.reply(UI.error(`Historique impossible : ${err.message}`));
      }
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scan automatique en cours..."));
      try {
        const results = await autoScanAllFiles(history);
        this.saveHistory();
        return message.reply(UI.success(
          `✅ ${results.fixed.length} corrigé(s) + commit\n✨ ${results.clean.length} propre(s)` +
          (results.errors.length ? `\n❌ ${results.errors.length} échoué(s)\n${results.errors.slice(0, 3).map(e => `• ${e.file}: ${e.reason}`).join("\n")}` : "")
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const checkMatch = query.match(/^check\s+(.+)$/i);
    if (checkMatch) {
      const fileName = normalizeName(checkMatch[1].trim());
      await message.reply(UI.loading(`Vérification de ${fileName}...`));
      try {
        const code   = await getFileContent(fileName);
        const errors = detectSyntaxErrors(code);
        return errors.length === 0
          ? message.reply(UI.success(`${fileName} : Aucune erreur.\n📝 ${code.split("\n").length} lignes | ${code.length} car.`))
          : message.reply(UI.warn(`${fileName} : ${errors.length} erreur(s)\n${errors.join("\n")}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const previewMatch = query.match(/^preview\s+(.+)$/i);
    if (previewMatch) {
      await message.reply(UI.loading("Génération de l'aperçu..."));
      try {
        const fileName  = normalizeName(previewMatch[1].trim());
        const code      = await getFileContent(fileName);
        const imagePath = createCodeImageSync(code, fileName);
        message.reply(
          { body: UI.success(`${fileName} | ${code.split("\n").length} lignes | ${code.length} car.`), attachment: fs.createReadStream(imagePath) },
          () => setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000)
        );
      } catch (err) {
        return message.reply(UI.error(`Preview : ${err.message}`));
      }
      return;
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const fileName = normalizeName(explainMatch[1].trim());
      await message.reply(UI.loading(`Explication de ${fileName}...`));
      try {
        const code  = await getFileContent(fileName);
        const reply = await askHedgehog(history, `Explique ce fichier GoatBot :\n\nFichier : ${fileName}\n\`\`\`javascript\n${code}\n\`\`\`\n\n1. Rôle 2. Sections 3. Fonctions clés 4. Points importants`);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const docMatch = query.match(/^doc\s+(.+)$/i);
    if (docMatch) {
      const fileName = normalizeName(docMatch[1].trim());
      await message.reply(UI.loading(`Documentation de ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        if (code.length > MAX_FILE_SIZE)
          return message.reply(UI.warn(`Fichier trop volumineux.`));
        saveBackup(fileName, code);
        const newCode = await askHedgehog(history, `Ajoute une JSDoc complète. Retourne UNIQUEMENT le code documenté, sans backticks :\n\n${code}`);
        await pushFileToGithub(fileName, newCode, `🦔 Doc: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} documenté + commit ✅\n📝 ${newCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const fileName = normalizeName(testMatch[1].trim());
      await message.reply(UI.loading("Génération des tests..."));
      try {
        const code         = await getFileContent(fileName);
        const testFileName = fileName.replace(".js", ".test.js");
        const testCode     = await askHedgehog(history, `Génère des tests unitaires complets. Retourne UNIQUEMENT le code de test, sans backticks :\n\nModule : ${fileName}\n${code}`);
        await pushFileToGithub(testFileName, testCode, `🦔 Test: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${testFileName} généré + commit ✅\n📝 ${testCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const simplifyMatch = query.match(/^simplify\s+(.+)$/i);
    if (simplifyMatch) {
      const fileName = normalizeName(simplifyMatch[1].trim());
      await message.reply(UI.loading(`Simplification de ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        if (code.length > MAX_FILE_SIZE)
          return message.reply(UI.warn(`Fichier trop volumineux.`));
        saveBackup(fileName, code);
        const newCode = await askHedgehog(history, `Simplifie ce code sans changer son comportement. Retourne UNIQUEMENT le code, sans backticks :\n\n${code}`);
        await pushFileToGithub(fileName, newCode, `🦔 Simplify: ${fileName}`);
        this.saveHistory();
        const d = diffFiles(code, newCode);
        return message.reply(UI.success(`${fileName} simplifié + commit ✅\n${d.summary}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (query.toLowerCase() === "list") {
      await message.reply(UI.loading("Récupération des fichiers..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.warn("Aucun fichier trouvé."));
        return message.reply(UI.info(`Fichiers GitHub (${files.length})\n` + files.map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n")));
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
          prompt = `Analyse globale du repo ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (${files.length} fichiers, ${samples.length} échantillons) :\n\n${contents.join("\n\n")}\n\nRapport : qualité, patterns, problèmes, recommandations.`;
        } else {
          const fileName = normalizeName(target);
          const code     = await getFileContent(fileName);
          const errors   = detectSyntaxErrors(code);
          prompt = `Analyse ce fichier GoatBot :\n\nFichier : ${fileName}\n${errors.length ? `Erreurs: ${errors.join(", ")}\n` : ""}\`\`\`javascript\n${code}\n\`\`\`\n\nStructure, qualité, bugs, améliorations. Termine par : "💬 Réagis à ce message pour que j'applique les améliorations directement sur GitHub."`;

          const reply     = await askHedgehog(history, prompt);
          const newCode   = await askHedgehog([], `Applique toutes les améliorations sur ce fichier. UNIQUEMENT le code final, sans backticks :\n\n${code}`);
          const fileName2 = normalizeName(target);

          const sentMsg = await new Promise(resolve =>
            message.reply(UI.hedgehog(reply), (err, info) => resolve(info))
          );

          if (sentMsg?.messageID) {
            pendingActions.set(sentMsg.messageID, {
              type: "analyse", fileName: fileName2, newCode, uid, expiresAt: Date.now() + REACTION_TTL
            });
            setTimeout(() => pendingActions.delete(sentMsg.messageID), REACTION_TTL);
          }

          this.saveHistory();
          return;
        }

        const reply = await askHedgehog(history, prompt);
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
          const results = { ok: [], fail: [], skipped: [] };

          for (const file of files) {
            try {
              const code = await getFileContent(file.name);
              if (code.length > MAX_FILE_SIZE) { results.skipped.push(file.name); continue; }

              const errors  = detectSyntaxErrors(code);
              const errList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
              const newCode = await askHedgehog(history, `Corrige ce fichier GoatBot.${errList}\nRetourne UNIQUEMENT le code corrigé, sans backticks :\n\n${code}`);

              saveBackup(file.name, code);
              await pushFileToGithub(file.name, newCode, `🦔 Fix: ${file.name}`);
              results.ok.push(file.name);
            } catch (e) {
              results.fail.push(`${file.name} (${e.message})`);
              console.error(`[fix*] ${file.name}:`, e.message);
            }
          }

          this.saveHistory();
          return message.reply(UI.success(
            `✅ ${results.ok.length} corrigé(s) + commit` +
            (results.skipped.length ? `\n⏭️ ${results.skipped.length} ignoré(s)` : "") +
            (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")
          ));
        }

        const fileName = normalizeName(target);
        const code     = await getFileContent(fileName);

        if (code.length > MAX_FILE_SIZE)
          return message.reply(UI.warn(`Fichier trop volumineux (${(code.length / 1000).toFixed(0)} KB).`));

        const errors  = detectSyntaxErrors(code);
        const errList = errors.length > 0 ? `\nErreurs:\n${errors.join("\n")}` : "";
        const newCode = await askHedgehog(history, `Corrige ce fichier GoatBot.${errList}\nRetourne UNIQUEMENT le code corrigé, sans backticks :\n\n${fileName}\n${code}`);

        saveBackup(fileName, code);
        await pushFileToGithub(fileName, newCode, `🦔 Fix: ${fileName}`);
        this.saveHistory();

        const d = diffFiles(code, newCode);
        return message.reply(UI.success(
          `${fileName} corrigé + commit ✅\n${d.summary}` +
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

        const newCode = await askHedgehog(history, `Crée un fichier GoatBot complet nommé "${fileName}" : ${description}\n\nRetourne UNIQUEMENT le code, sans backticks. Structure GoatBot standard avec config, onStart, etc.`);
        await pushFileToGithub(fileName, newCode, `🦔 Create: ${fileName}`);

        ensureCmdDir();
        fs.writeFileSync(path.join(CMD_PATH, fileName), newCode, "utf8");
        this.saveHistory();

        return message.reply(UI.success(`${fileName} créé + commit ✅\n📝 ${description}\n📊 ${newCode.length} car.`));
      } catch (err) {
        return message.reply(UI.error(`Création échouée : ${err.message}`));
      }
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const fileName = normalizeName(reviewMatch[1].trim());
      await message.reply(UI.loading(`Code review de ${fileName}...`));

      try {
        const code     = await getFileContent(fileName);
        const errors   = detectSyntaxErrors(code);
        const errSec   = errors.length > 0 ? `\nErreurs: ${errors.join(", ")}` : "";
        const reply    = await askHedgehog(history, `Code review professionnelle :\n\n${fileName}${errSec}\n\`\`\`javascript\n${code}\n\`\`\`\n\n1. Points positifs 2. Bugs 3. Performance 4. Améliorations 5. Score/10\n\nTermine par : "💬 Réagis pour que j'applique les améliorations."`);
        const newCode  = await askHedgehog([], `Applique toutes les améliorations de la review. UNIQUEMENT le code final, sans backticks :\n\n${code}`);

        const sentMsg = await new Promise(resolve =>
          message.reply(UI.hedgehog(reply), (err, info) => resolve(info))
        );

        if (sentMsg?.messageID) {
          pendingActions.set(sentMsg.messageID, {
            type: "review", fileName, newCode, uid, expiresAt: Date.now() + REACTION_TTL
          });
          setTimeout(() => pendingActions.delete(sentMsg.messageID), REACTION_TTL);
        }

        this.saveHistory();
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));

    try {
      const repoCtx = `Tu as accès total au repo GitHub ${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo} (branche: ${GITHUB_CONFIG.branch}). Tu te souviens de toute notre conversation.`;
      const reply   = await askHedgehog(history, `${repoCtx}\n\n${query}`);
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
      if (exists) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
      fs.writeFileSync(filePath, content, "utf8");

      return message.reply(UI.success(exists ? `${finalName} mis à jour (${content.length} car.)` : `${finalName} créé (${content.length} car.)`));
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
        if (exists) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
        fs.writeFileSync(filePath, content, "utf8");

        const fakePastebinUrl = await createTrapPastebin(finalName);

        if (autoPush) {
          try {
            await pushFileToGithub(finalName, content, `🦔 Import Pastebin: ${finalName}`);
            return message.reply(UI.success(`${finalName} importé + commit ✅\n🔗 ${fakePastebinUrl || "blocked"}\n📝 ${content.length} car.`));
          } catch (err) {
            return message.reply(UI.warn(`Sauvegardé localement, commit échoué : ${err.message}`));
          }
        }

        return message.reply(UI.success(`${finalName} importé\n🔗 ${fakePastebinUrl || "blocked"}\n📝 ${content.length} car.`));
      } catch (err) {
        return message.reply(UI.error(`Lecture Pastebin impossible : ${err.message}`));
      }
    }

    if (sub === "export") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit export <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" introuvable.`));

      await message.reply(UI.loading(`Export de "${fileName}"...`));

      try {
        const content  = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);
        if (!pasteUrl) return message.reply(UI.warn("Export échoué."));
        return message.reply(UI.success(`${fileName} exporté\n🔗 ${pasteUrl}\n📝 ${content.length} car.`));
      } catch (err) {
        return message.reply(UI.error(`Export échoué : ${err.message}`));
      }
    }

    if (sub === "push") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit push <nom.js>`));

      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" introuvable.`));

      await message.reply(UI.loading(`Push de "${fileName}"...`));

      try {
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(fileName, content, `🦔 Commit: push ${fileName}`);
        return message.reply(UI.success(`${fileName} pushé ✅`));
      } catch (err) {
        return message.reply(UI.error(`Push échoué : ${err.message}`));
      }
    }

    if (sub === "pushall") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.warn("Aucun fichier local."));

      await message.reply(UI.loading(`Push de ${files.length} fichiers...`));

      const results = { ok: [], fail: [] };
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          await pushFileToGithub(file, content, `🦔 Commit: pushall ${file}`);
          results.ok.push(file);
        } catch (err) {
          results.fail.push(`${file} (${err.message})`);
          console.error(`[pushall] ${file}:`, err.message);
        }
      }

      return message.reply(UI.success(`✅ ${results.ok.length} pushé(s)` + (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Récupération depuis GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.info("GitHub vide."));

        ensureCmdDir();
        const results = { ok: [], fail: [] };
        for (const file of files) {
          try {
            const fileRes   = await axios.get(file.download_url);
            const localPath = path.join(CMD_PATH, file.name);
            if (fs.existsSync(localPath)) saveBackup(file.name, fs.readFileSync(localPath, "utf8"));
            fs.writeFileSync(localPath, fileRes.data, "utf8");
            results.ok.push(file.name);
          } catch (err) {
            results.fail.push(`${file.name} (${err.message})`);
            console.error(`[pull] ${file.name}:`, err.message);
          }
        }

        return message.reply(UI.success(`✅ ${results.ok.length} récupéré(s)` + (results.fail.length ? `\n❌ ${results.fail.length} échoué(s)` : "")));
      } catch (err) {
        return message.reply(UI.error(`Pull échoué : ${err.message}`));
      }
    }

    if (sub === "sync") {
      await message.reply(UI.loading("Synchronisation..."));
      try {
        const remoteFiles = await getRemoteFiles();
        ensureCmdDir();
        const pullResults = { ok: 0, fail: 0 };
        const pushResults = { ok: 0, fail: 0 };

        for (const file of remoteFiles) {
          try {
            const fileRes   = await axios.get(file.download_url);
            const localPath = path.join(CMD_PATH, file.name);
            if (fs.existsSync(localPath)) saveBackup(file.name, fs.readFileSync(localPath, "utf8"));
            fs.writeFileSync(localPath, fileRes.data, "utf8");
            pullResults.ok++;
          } catch (err) {
            pullResults.fail++;
            console.error(`[sync/pull] ${file.name}:`, err.message);
          }
        }

        for (const file of fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"))) {
          try {
            const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
            await pushFileToGithub(file, content, `🦔 Sync: ${file}`);
            pushResults.ok++;
          } catch (err) {
            pushResults.fail++;
            console.error(`[sync/push] ${file}:`, err.message);
          }
        }

        return message.reply(UI.success(
          `⬇ Pull: ${pullResults.ok} | ⬆ Push: ${pushResults.ok}` +
          (pullResults.fail + pushResults.fail > 0 ? `\n❌ Échecs: ${pullResults.fail + pushResults.fail}` : "")
        ));
      } catch (err) {
        return message.reply(UI.error(`Sync échoué : ${err.message}`));
      }
    }

    if (sub === "list") {
      ensureCmdDir();
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.info("Aucune commande locale."));
      return message.reply(UI.info(`Fichiers locaux (${files.length})\n` + files.map(f => `📄 ${f} (${(fs.statSync(path.join(CMD_PATH, f)).size / 1024).toFixed(1)} KB)`).join("\n")));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Récupération GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.info("GitHub vide."));
        return message.reply(UI.info(`Fichiers GitHub (${files.length})\n` + files.map(f => `📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)`).join("\n")));
      } catch (err) {
        return message.reply(UI.error(`GitHub inaccessible : ${err.message}`));
      }
    }

    if (sub === "rename") {
      const oldName = normalizeName(args[1] || "");
      const newName = normalizeName(args[2] || "");
      if (!args[1] || !args[2]) return message.reply(UI.error(`Usage : ${p}commit rename <ancien> <nouveau>`));

      const oldPath = path.join(CMD_PATH, oldName);
      const newPath = path.join(CMD_PATH, newName);

      if (!fs.existsSync(oldPath)) return message.reply(UI.error(`"${oldName}" introuvable.`));
      if (fs.existsSync(newPath))  return message.reply(UI.warn(`"${newName}" existe déjà.`));

      saveBackup(oldName, fs.readFileSync(oldPath, "utf8"));
      fs.renameSync(oldPath, newPath);
      return message.reply(UI.success(`${oldName} → ${newName}`));
    }

    if (sub === "diff") {
      await message.reply(UI.loading("Comparaison local vs GitHub..."));
      try {
        ensureCmdDir();
        const local  = new Set(fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")));
        const remote = new Set((await getRemoteFiles()).map(f => f.name));
        const onlyL  = [...local].filter(f => !remote.has(f));
        const onlyR  = [...remote].filter(f => !local.has(f));
        const both   = [...local].filter(f => remote.has(f));

        let msg = `📊 Local: ${local.size} | GitHub: ${remote.size}`;
        if (both.length)  msg += `\n✅ Commun: ${both.length}`;
        if (onlyL.length) msg += `\n💾 Local seul: ${onlyL.length}`;
        if (onlyR.length) msg += `\n☁ GitHub seul: ${onlyR.length}`;
        return message.reply(UI.info(msg));
      } catch (err) {
        return message.reply(UI.error(`Diff échoué : ${err.message}`));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit delete <nom.js>`));

      await message.reply(UI.loading(`Suppression de "${fileName}"...`));

      try {
        const content = await getFileContent(fileName).catch(() => null);
        if (content) saveBackup(fileName, content);
        await deleteFileOnGithub(fileName);
        return message.reply(UI.success(`${fileName} supprimé ✅`));
      } catch (err) {
        return message.reply(UI.error(`Suppression échouée : ${err.message}`));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Récupération infos..."));
      try {
        const res = await axios.get(`https://api.github.com/repos/${GITHUB_CONFIG.username}/${GITHUB_CONFIG.repo}`, { headers: githubHeaders() });
        const r   = res.data;
        ensureCmdDir();
        const localCount  = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;
        const backupCount = Object.values(loadBackups()).reduce((sum, b) => sum + b.length, 0);

        return message.reply(UI.info(
          `👤 ${r.owner.login}\n📦 ${r.name}\n🌿 ${GITHUB_CONFIG.branch}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n🔒 ${r.private ? "Oui" : "Non"}\n📁 Local: ${localCount} fichiers\n💾 Backups: ${backupCount}\n🔗 ${r.html_url}`
        ));
      } catch (err) {
        return message.reply(UI.error(`Infos impossible : ${err.message}`));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}commit help`));
  }
};