const fs     = require("fs");
const path   = require("path");
const axios  = require("axios");
const { createCanvas } = require("canvas");

const API_URL = "https://hedgehog-api-copilot.vercel.app/api/config";
const API_KEY = "ismael04-lag-developper";

let CONFIG = {
  github:   { username: "Ismael03-Dev", repo: "Hedgehog_dev03", branch: "main", token: "" },
  mistral:  { key: "" },
  pastebin: { key: "" },
  allowed:  ["61578433048588"]
};

const REACTION_TTL = 3 * 60 * 1000;
const MAX_FILE     = 80000;
const CMD_PATH     = path.join(process.cwd(), "scripts", "cmds");
const HISTORY_PATH = path.join(process.cwd(), "data", "hedgehog_history.json");
const BACKUP_PATH  = path.join(process.cwd(), "data", "hedgehog_backups.json");

const pendingActions = new Map();

function getConfig() {
  return CONFIG;
}

async function loadConfig() {
  try {
    const res = await axios.get(`${API_URL}?key=${API_KEY}`, { timeout: 8000 });
    if (res.data?.github?.token) {
      CONFIG = res.data;
      console.log("[HedgehogGPT] ✅ Config chargée");
      return true;
    }
    console.warn("[HedgehogGPT] ⚠️ Token vide");
    return false;
  } catch (err) {
    console.error("[HedgehogGPT] ❌ Config API:", err.message);
    return false;
  }
}

async function checkToken() {
  const token = CONFIG.github.token;
  if (!token || token.length < 10) {
    return { valid: false, reason: "Token non configuré" };
  }

  try {
    const res = await axios.get("https://api.github.com/user", {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Cache-Control": "no-cache"
      },
      timeout: 8000
    });
    const scopes = res.headers["x-oauth-scopes"] || "";
    const hasRepo = scopes.includes("repo");

    if (!hasRepo) {
      return { valid: false, reason: "Token sans permission repo (écriture)", user: res.data.login, scopes };
    }

    return { valid: true, user: res.data.login, scopes, hasRepo };
  } catch (err) {
    const status = err.response?.status;
    let reason = err.message;
    if (status === 401) reason = "Token invalide ou expiré";
    if (status === 403) reason = "Token sans permission";
    return { valid: false, reason };
  }
}

loadConfig().then(() => checkToken());
setInterval(() => loadConfig(), 10 * 60 * 1000);

const UI = {
  frame: (emoji, text) => {
    const lines = text.split("\n");
    if (lines.length === 1)
      return `╭─────────────────────•\n│ ${emoji} ${text}\n╰─────────────────────•`;
    let msg = `╭─────────────────────•\n│ ${emoji} ${lines[0]}\n├─────────────────────•\n`;
    for (let i = 1; i < lines.length; i++) msg += `│ ${lines[i]}\n`;
    return msg + `╰─────────────────────•`;
  },
  success:  (t) => UI.frame("✅", t),
  error:    (t) => UI.frame("❌", t),
  info:     (t) => UI.frame("📦", t),
  hedgehog: (t) => UI.frame("🦔", t),
  warn:     (t) => UI.frame("⚠️", t),
  loading:  (t) => UI.frame("⏳", t)
};

const SYSTEM_PROMPT = `Tu es HedgehogGPT, un assistant IA expert en développement JavaScript et en bots Messenger (GoatBot/fca-unofficial).
Tu as un accès TOTAL au repository GitHub de l'utilisateur.
Tu peux lire, analyser, modifier, créer et supprimer n'importe quel fichier.
Tu te souviens de toutes les discussions passées.

Quand tu modifies du code : retourne UNIQUEMENT le code final, sans explications, sans backticks, sans markdown.
Pour les analyses : réponds clairement en français.
Structure GoatBot : config, onStart, onChat, onReply, getLang, message.reply, api, event.

Quand tu proposes des améliorations, termine toujours par :
"💬 Réagis à ce message pour que j'applique les modifications directement sur GitHub."`;

function githubHeaders() {
  return {
    "Content-Type":  "application/json",
    "Accept":        "application/vnd.github.v3+json",
    "Authorization": `token ${CONFIG.github.token}`
  };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
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
  ensureDir(path.dirname(BACKUP_PATH));
  try {
    const b = loadBackups();
    if (!b[fileName]) b[fileName] = [];
    b[fileName].unshift({ content, date: new Date().toISOString(), size: content.length });
    if (b[fileName].length > 5) b[fileName] = b[fileName].slice(0, 5);
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(b, null, 2), "utf8");
  } catch (e) {
    console.error("[backup]", e.message);
  }
}

function diffFiles(oldCode, newCode) {
  const a = newCode.split("\n").filter(l => !oldCode.includes(l)).length;
  const r = oldCode.split("\n").filter(l => !newCode.includes(l)).length;
  return { added: a, removed: r, summary: `+${a} / -${r} lignes` };
}

async function fetchPastebinContent(input) {
  const key    = extractPastebinKey(input);
  const rawUrl = `https://pastebin.com/raw/${key}`;
  const res    = await axios.get(rawUrl, { timeout: 10000 });
  return { content: res.data, key, rawUrl };
}

async function uploadToPastebin(fileName, content) {
  const params = new URLSearchParams();
  params.append("api_dev_key",           CONFIG.pastebin.key);
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

async function getFileSha(fileName) {
  try {
    const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/scripts/cmds/${fileName}`;
    const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
    return res.data.sha || null;
  } catch {
    return null;
  }
}

async function getRemoteFiles() {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/scripts/cmds?ref=${CONFIG.github.branch}`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  if (!Array.isArray(res.data)) return [];
  return res.data.filter(f => f.name.endsWith(".js"));
}

async function getFileContent(fileName) {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/scripts/cmds/${fileName}?ref=${CONFIG.github.branch}&_t=${Date.now()}`;
  const res = await axios.get(url, {
    headers: { ...githubHeaders(), "Cache-Control": "no-cache", "Pragma": "no-cache" },
    timeout: 10000
  });
  if (!res.data?.content) throw new Error(`"${fileName}" introuvable sur GitHub`);
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

async function pushFileToGithub(fileName, content, commitMsg) {
  const tok = await checkToken();
  if (!tok.valid) throw new Error(`Token invalide : ${tok.reason}`);

  const url            = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/scripts/cmds/${fileName}`;
  const encodedContent = Buffer.from(typeof content === "string" ? content : fs.readFileSync(content)).toString("base64");
  const sha            = await getFileSha(fileName);
  const body           = { message: commitMsg || `🦔 HedgehogGPT: ${fileName}`, content: encodedContent, branch: CONFIG.github.branch };
  if (sha) body.sha    = sha;

  const res = await axios.put(url, body, { headers: githubHeaders(), timeout: 15000 });

  if (res.status !== 200 && res.status !== 201)
    throw new Error(`GitHub a retourné ${res.status}`);

  return res.data;
}

async function deleteFileOnGithub(fileName) {
  const sha = await getFileSha(fileName);
  if (!sha) throw new Error(`"${fileName}" introuvable sur GitHub`);
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/scripts/cmds/${fileName}`;
  await axios.delete(url, {
    headers: githubHeaders(),
    data:    { message: `🗑️ Delete: ${fileName}`, sha, branch: CONFIG.github.branch },
    timeout: 10000
  });
}

async function getCommitHistory(fileName) {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/commits?path=scripts/cmds/${fileName}&per_page=5`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  return res.data;
}

async function askHedgehog(history, userMessage) {
  if (!CONFIG.mistral.key) throw new Error("Clé Mistral non configurée. Tape 'Hedgehog config'.");

  history.push({ role: "user", content: userMessage });
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history.slice(-16)];

  try {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      { model: "mistral-large-latest", messages, max_tokens: 4096, temperature: 0.3 },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CONFIG.mistral.key}` }, timeout: 60000 }
    );
    const reply = res.data.choices[0].message.content;
    if (!reply?.trim()) throw new Error("Réponse vide");
    history.push({ role: "assistant", content: reply });
    if (history.length > 32) history.splice(0, 2);
    return reply;
  } catch (err) {
    if (err.response?.status === 429) throw new Error("Limite Mistral atteinte. Réessaie.");
    throw new Error(`Mistral: ${err.response?.data?.error?.message || err.message}`);
  }
}

function detectSyntaxErrors(code) {
  const errors = [];
  code.split("\n").forEach((line, i) => {
    if (line.includes("require(")) {
      const match = line.match(/require\(['"]([^'"]+)['"]\)/);
      if (match && !match[1].startsWith(".") && !match[1].startsWith("/")) {
        try { require.resolve(match[1]); } catch {
          errors.push(`L${i + 1}: "${match[1]}" non installé`);
        }
      }
    }
  });
  const tc = (code.match(/\btry\s*\{/g) || []).length;
  const cc = (code.match(/\bcatch\s*[({]/g) || []).length;
  if (tc > cc) errors.push(`${tc - cc} try sans catch`);
  if (code.includes("module.exports")) {
    if (!code.includes("config:"))                                errors.push("config manquant");
    if (!code.includes("onStart:") && !code.includes("onChat:")) errors.push("onStart/onChat requis");
  }
  const ob = (code.match(/\{/g) || []).length;
  const cb = (code.match(/\}/g) || []).length;
  if (ob !== cb) errors.push(`Accolades déséquilibrées ({${ob}} vs }${cb})`);
  return errors;
}

async function createTrapPastebin(fileName) {
  const msgs = [
    "🦔 HEDGEHOG GPT\n\nCode protégé.\n⚠️ Fichier verrouillé.",
    "🔐 ACCÈS RESTREINT\n\nLeurre automatisé.\nCode sécurisé sur GitHub.",
    "🛡️ HEDGEHOG GUARD\n\nLien piège.\nPropriété de Ismael03-Dev.",
    "⚠️ LEURRE DÉTECTÉ\n\nFaux lien !\nVrai code sur GitHub."
  ];
  try { return await uploadToPastebin(`TRAP-${fileName}`, msgs[Math.floor(Math.random() * msgs.length)]); }
  catch { return null; }
}

function createCodeImageSync(code, fileName) {
  const lh = 20, pd = 20, fs_ = 13, hh = 40, mlw = 70;
  const display = [];
  code.split("\n").slice(0, 35).forEach(line => {
    if (line.length <= mlw) { display.push(line); return; }
    let r = line;
    while (r.length > mlw) { display.push(r.slice(0, mlw)); r = r.slice(mlw); }
    if (r) display.push(r);
  });
  const sl = display.slice(0, 35);
  const W  = Math.max(400, mlw * 8 + pd * 2);
  const H  = sl.length * lh + hh + pd;
  const c  = createCanvas(W, H);
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#161b22"; ctx.fillRect(0, 0, W, hh);

  [["#ff7b72", 7], ["#f0df72", 22], ["#56d364", 37]].forEach(([col, cx]) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.arc(pd + cx, hh / 2, 6, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = "#8b949e"; ctx.font = `${fs_}px Courier New`;
  ctx.fillText(fileName.slice(0, 30), pd + 55, hh / 2 + 4);

  const kws  = ["const","let","var","function","async","await","return","if","else","for","while","try","catch","require","module","exports","true","false","null","undefined","new","class","import","from","export","default"];
  const mths = ["fs.","path.","axios.","message.","event.","global.","console."];

  sl.forEach((line, i) => {
    const y = hh + pd + i * lh;
    let x = pd, rem = line;
    while (rem.length > 0) {
      if (rem.startsWith("//")) {
        ctx.fillStyle = "#8b949e"; ctx.font = `${fs_}px Courier New`;
        ctx.fillText(rem.slice(0, mlw), x, y); return;
      }
      let found = false;
      for (const kw of kws) {
        if (rem.startsWith(kw) && (!rem[kw.length] || /[^a-zA-Z0-9_$]/.test(rem[kw.length]))) {
          ctx.fillStyle = "#ff7b72"; ctx.font = `bold ${fs_}px Courier New`;
          ctx.fillText(kw, x, y); x += ctx.measureText(kw).width;
          rem = rem.slice(kw.length); found = true; break;
        }
      }
      if (found) continue;
      for (const m of mths) {
        if (rem.startsWith(m)) {
          ctx.fillStyle = "#d2a8ff"; ctx.font = `${fs_}px Courier New`;
          ctx.fillText(m, x, y); x += ctx.measureText(m).width;
          rem = rem.slice(m.length); found = true; break;
        }
      }
      if (found) continue;
      const sm = rem.match(/^(['"`])(?:(?!\1)[^\\]|\\.)*\1/);
      if (sm) {
        ctx.fillStyle = "#a5d6ff"; ctx.font = `${fs_}px Courier New`;
        ctx.fillText(sm[0], x, y); x += ctx.measureText(sm[0]).width;
        rem = rem.slice(sm[0].length); continue;
      }
      ctx.fillStyle = "#c9d1d9"; ctx.font = `${fs_}px Courier New`;
      ctx.fillText(rem[0], x, y); x += ctx.measureText(rem[0]).width;
      rem = rem.slice(1);
    }
  });

  const buf     = c.toBuffer("image/png");
  const tmpDir  = path.join(process.cwd(), "temp");
  ensureDir(tmpDir);
  const imgPath = path.join(tmpDir, `code_${Date.now()}.png`);
  fs.writeFileSync(imgPath, buf);
  return imgPath;
}

async function registerPending(message, reply, fileName, newCode, uid, type) {
  return new Promise(resolve => {
    message.reply(UI.hedgehog(reply), (err, info) => {
      if (err || !info?.messageID) { resolve(null); return; }
      const msgID = info.messageID;
      pendingActions.set(msgID, { type, fileName, newCode, uid, expiresAt: Date.now() + REACTION_TTL });
      setTimeout(() => pendingActions.delete(msgID), REACTION_TTL);
      resolve(msgID);
    });
  });
}

module.exports = {
  config: {
    name:             "commit",
    version:          "19.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "HedgehogGPT — Copilot GitHub sans cache" }
  },

  hedgehogHistory: {},

  loadHistory: function () {
    ensureDir(path.dirname(HISTORY_PATH));
    try {
      if (!fs.existsSync(HISTORY_PATH)) return {};
      return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
    } catch { return {}; }
  },

  saveHistory: function () {
    ensureDir(path.dirname(HISTORY_PATH));
    try { fs.writeFileSync(HISTORY_PATH, JSON.stringify(this.hedgehogHistory, null, 2), "utf8"); }
    catch (e) { console.error("[history]", e.message); }
  },

  getHistory: function (uid) {
    if (!this.hedgehogHistory[uid]) {
      const saved = this.loadHistory();
      this.hedgehogHistory[uid] = saved[uid] || [];
    }
    return this.hedgehogHistory[uid];
  },

  onReaction: async function ({ message, event, Reaction }) {
    const userID = event?.userID?.toString() || event?.senderID?.toString();
    if (!CONFIG.allowed.includes(userID)) return;

    const msgID = Reaction?.messageID || event?.messageID;
    if (!msgID) return;

    const action = pendingActions.get(msgID);
    if (!action) return;

    if (Date.now() > action.expiresAt) {
      pendingActions.delete(msgID);
      return message.reply(UI.warn("Action expirée. Redemande à HedgehogGPT."));
    }

    if (userID !== action.uid) return;

    pendingActions.delete(msgID);
    await message.reply(UI.loading(`Application sur ${action.fileName}...`));

    try {
      const tok = await checkToken();
      if (!tok.valid)
        return message.reply(UI.error(`Token invalide : ${tok.reason}\nTape "Hedgehog token" pour vérifier.`));

      const currentCode = await getFileContent(action.fileName);
      saveBackup(action.fileName, currentCode);

      await pushFileToGithub(action.fileName, action.newCode, `🦔 HedgehogGPT: amélioration de ${action.fileName}`);

      const d = diffFiles(currentCode, action.newCode);
      const localPath = path.join(CMD_PATH, action.fileName);
      if (fs.existsSync(localPath)) fs.writeFileSync(localPath, action.newCode, "utf8");

      return message.reply(UI.success(
        `${action.fileName} amélioré + commit ✅\n${d.summary}\n` +
        `🔗 github.com/${CONFIG.github.username}/${CONFIG.github.repo}`
      ));
    } catch (err) {
      console.error("[onReaction] Push échoué:", err.message);
      return message.reply(UI.error(`Push échoué : ${err.message}`));
    }
  },

  onChat: async function ({ message, event }) {
    if (!CONFIG.allowed.includes(event.senderID.toString())) return;

    const body = event.body?.trim() || "";
    if (!body.toLowerCase().startsWith("hedgehog")) return;

    const uid     = event.senderID.toString();
    const query   = body.slice(8).trim();
    const history = this.getHistory(uid);

    if (!query || query.toLowerCase() === "help") {
      return message.reply(
        `╭─────────────────────•\n` +
        `│ 🦔 𝐇𝐄𝐃𝐆𝐄𝐇𝐎𝐆 𝐆𝐏𝐓 𝐯𝟏𝟗\n` +
        `├─────────────────────•\n` +
        `│ token → Vérifier token\n` +
        `│ config → Recharger config\n` +
        `│ scan → Scan + corrige tout\n` +
        `│ check <f> → Vérifie erreurs\n` +
        `│ preview <f> → Aperçu image\n` +
        `│ analyse <f|*> → Analyse\n` +
        `│ fix <f|*> → Corrige + commit\n` +
        `│ improve <f> → Améliore\n` +
        `│ review <f> → Code review\n` +
        `│ create <nom> <desc> → Crée\n` +
        `│ doc <f> → JSDoc + commit\n` +
        `│ test <f> → Tests + commit\n` +
        `│ explain <f> → Explique\n` +
        `│ simplify <f> → Refactorise\n` +
        `│ diff <f> → Compare local/GitHub\n` +
        `│ rollback <f> → Restaurer\n` +
        `│ history <f> → Historique\n` +
        `│ rename <anc> <nouv> → Renommer\n` +
        `│ list → Liste fichiers\n` +
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
      const tok = await checkToken();
      if (tok.valid) {
        return message.reply(UI.success(
          `Token valide ✅\n👤 ${tok.user}\n📦 ${CONFIG.github.repo}\n🔑 Scopes : ${tok.scopes || "non disponible"}`
        ));
      }
      return message.reply(UI.error(`Token invalide ❌\n${tok.reason}\nRecharge : Hedgehog config`));
    }

    if (query.toLowerCase() === "config") {
      await message.reply(UI.loading("Rechargement config API..."));
      await loadConfig();
      const tok = await checkToken();
      return tok.valid
        ? message.reply(UI.success(`Config rechargée ✅\n👤 ${tok.user}\n📦 ${CONFIG.github.repo}`))
        : message.reply(UI.error(`Config rechargée mais token ❌\n${tok.reason}`));
    }

    if (query.toLowerCase() === "list") {
      await message.reply(UI.loading("Liste des fichiers..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.warn("Aucun fichier."));
        return message.reply(UI.info(`Fichiers (${files.length})\n` + files.map(f => `📄 ${f.name}`).join("\n")));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scan en cours..."));
      try {
        const files = await getRemoteFiles();
        const res = { ok: 0, clean: 0, fail: 0 };
        for (const file of files) {
          try {
            const code = await getFileContent(file.name);
            const errs = detectSyntaxErrors(code);
            if (errs.length > 0 && code.length <= MAX_FILE) {
              saveBackup(file.name, code);
              const newCode = await askHedgehog([], `Corrige:\n${errs.join("\n")}\n\nRetourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
              await pushFileToGithub(file.name, newCode, `🦔 Scan: ${file.name}`);
              res.ok++;
            } else if (errs.length === 0) {
              res.clean++;
            }
          } catch { res.fail++; }
        }
        this.saveHistory();
        return message.reply(UI.success(`✅ ${res.ok} corrigé(s)\n✨ ${res.clean} propre(s)` + (res.fail ? `\n❌ ${res.fail} échoué(s)` : "")));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const previewMatch = query.match(/^preview\s+(.+)$/i);
    if (previewMatch) {
      await message.reply(UI.loading("Aperçu..."));
      try {
        const fileName = normalizeName(previewMatch[1].trim());
        const code = await getFileContent(fileName);
        const imagePath = createCodeImageSync(code, fileName);
        message.reply(
          { body: UI.success(`${fileName} | ${code.split("\n").length} lignes`), attachment: fs.createReadStream(imagePath) },
          () => setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000)
        );
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const checkMatch = query.match(/^check\s+(.+)$/i);
    if (checkMatch) {
      const fileName = normalizeName(checkMatch[1].trim());
      await message.reply(UI.loading(`Check ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        const errs = detectSyntaxErrors(code);
        return errs.length === 0
          ? message.reply(UI.success(`${fileName} : Aucune erreur.`))
          : message.reply(UI.warn(`${errs.length} erreur(s)\n${errs.join("\n")}`));
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
          const res = { ok: [], fail: [] };
          for (const file of files) {
            try {
              const code = await getFileContent(file.name);
              if (code.length > MAX_FILE) continue;
              const errs = detectSyntaxErrors(code);
              const errList = errs.length > 0 ? `\nErreurs:\n${errs.join("\n")}` : "";
              const newCode = await askHedgehog(history, `Corrige.${errList}\nRetourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
              saveBackup(file.name, code);
              await pushFileToGithub(file.name, newCode, `🦔 Fix: ${file.name}`);
              res.ok.push(file.name);
            } catch { res.fail.push(file.name); }
          }
          this.saveHistory();
          return message.reply(UI.success(`✅ ${res.ok.length} corrigé(s)` + (res.fail.length ? `\n❌ ${res.fail.length}` : "")));
        }

        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        if (code.length > MAX_FILE) return message.reply(UI.warn("Fichier trop volumineux."));
        const errs = detectSyntaxErrors(code);
        const errList = errs.length > 0 ? `\nErreurs:\n${errs.join("\n")}` : "";
        const newCode = await askHedgehog(history, `Corrige.${errList}\nRetourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
        saveBackup(fileName, code);
        await pushFileToGithub(fileName, newCode, `🦔 Fix: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} corrigé + commit ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const improveMatch = query.match(/^improve\s+(.+)$/i);
    if (improveMatch) {
      const fileName = normalizeName(improveMatch[1].trim());
      await message.reply(UI.loading(`Amélioration ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        if (code.length > MAX_FILE) return message.reply(UI.warn("Fichier trop volumineux."));
        const errs = detectSyntaxErrors(code);
        const errSec = errs.length > 0 ? `\nErreurs: ${errs.join(", ")}` : "";
        const analysis = await askHedgehog(history, `Propose des améliorations :\n\n${fileName}${errSec}\n\`\`\`javascript\n${code}\n\`\`\`\n\nTermine par "💬 Réagis pour appliquer."`);
        const newCode = await askHedgehog([], `Applique TOUTES les améliorations. UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await registerPending(message, analysis, fileName, newCode, uid, "improve");
        this.saveHistory();
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const fileName = normalizeName(reviewMatch[1].trim());
      await message.reply(UI.loading(`Review ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        const errs = detectSyntaxErrors(code);
        const errSec = errs.length > 0 ? `\nErreurs: ${errs.join(", ")}` : "";
        const reply = await askHedgehog(history, `Code review :\n\n${fileName}${errSec}\n\`\`\`javascript\n${code}\n\`\`\`\n\n1. Positifs 2. Bugs 3. Perf 4. Améliorations 5. Score/10\n\nTermine par "💬 Réagis pour appliquer."`);
        const newCode = await askHedgehog([], `Applique les améliorations. UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await registerPending(message, reply, fileName, newCode, uid, "review");
        this.saveHistory();
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const analyseMatch = query.match(/^analyse\s+(.+)$/i);
    if (analyseMatch) {
      const target = analyseMatch[1].trim();
      await message.reply(UI.loading(`Analyse ${target}...`));
      try {
        if (target === "*") {
          const files = await getRemoteFiles();
          const samples = files.slice(0, 5);
          const contents = await Promise.all(samples.map(async f => `${f.name}:\n${(await getFileContent(f.name)).slice(0, 1000)}`));
          const reply = await askHedgehog(history, `Analyse globale (${files.length} fichiers):\n\n${contents.join("\n\n")}`);
          this.saveHistory();
          return message.reply(UI.hedgehog(reply));
        }

        const fileName = normalizeName(target);
        const code = await getFileContent(fileName);
        const errs = detectSyntaxErrors(code);
        const reply = await askHedgehog(history, `Analyse :\n\n${fileName}\n${errs.length ? `Erreurs: ${errs.join(", ")}\n` : ""}\`\`\`javascript\n${code}\n\`\`\`\n\nTermine par "💬 Réagis pour appliquer."`);
        const newCode = await askHedgehog([], `Applique les améliorations. UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await registerPending(message, reply, fileName, newCode, uid, "analyse");
        this.saveHistory();
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const docMatch = query.match(/^doc\s+(.+)$/i);
    if (docMatch) {
      const fileName = normalizeName(docMatch[1].trim());
      await message.reply(UI.loading(`Doc ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        saveBackup(fileName, code);
        const newCode = await askHedgehog(history, `Ajoute JSDoc. Retourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await pushFileToGithub(fileName, newCode, `🦔 Doc: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} documenté + commit ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const fileName = normalizeName(testMatch[1].trim());
      await message.reply(UI.loading("Génération tests..."));
      try {
        const code = await getFileContent(fileName);
        const testFileName = fileName.replace(".js", ".test.js");
        const testCode = await askHedgehog(history, `Génère des tests. Retourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await pushFileToGithub(testFileName, testCode, `🦔 Test: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${testFileName} + commit ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const simplifyMatch = query.match(/^simplify\s+(.+)$/i);
    if (simplifyMatch) {
      const fileName = normalizeName(simplifyMatch[1].trim());
      await message.reply(UI.loading(`Simplify ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        saveBackup(fileName, code);
        const newCode = await askHedgehog(history, `Simplifie. Retourne UNIQUEMENT le code, sans backticks:\n\n${code}`);
        await pushFileToGithub(fileName, newCode, `🦔 Simplify: ${fileName}`);
        this.saveHistory();
        return message.reply(UI.success(`${fileName} simplifié + commit ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const fileName = normalizeName(explainMatch[1].trim());
      await message.reply(UI.loading(`Explication ${fileName}...`));
      try {
        const code = await getFileContent(fileName);
        const reply = await askHedgehog(history, `Explique ce fichier :\n\n${fileName}\n\`\`\`javascript\n${code}\n\`\`\``);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const createMatch = query.match(/^create\s+(\S+)\s+(.+)$/i);
    if (createMatch) {
      const fileName = normalizeName(createMatch[1].trim());
      const description = createMatch[2].trim();
      await message.reply(UI.loading(`Création ${fileName}...`));
      try {
        const newCode = await askHedgehog(history, `Crée un fichier GoatBot : ${description}\n\nRetourne UNIQUEMENT le code, sans backticks.`);
        await pushFileToGithub(fileName, newCode, `🦔 Create: ${fileName}`);
        ensureDir(CMD_PATH);
        fs.writeFileSync(path.join(CMD_PATH, fileName), newCode, "utf8");
        this.saveHistory();
        return message.reply(UI.success(`${fileName} créé + commit ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const historyMatch = query.match(/^history\s+(.+)$/i);
    if (historyMatch) {
      const fileName = normalizeName(historyMatch[1].trim());
      await message.reply(UI.loading(`Historique ${fileName}...`));
      try {
        const commits = await getCommitHistory(fileName);
        if (!commits.length) return message.reply(UI.warn("Aucun commit."));
        return message.reply(UI.info(`Historique ${fileName}\n` + commits.map((c, i) => `#${i} ${c.commit.message.slice(0, 45)}`).join("\n")));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const renameMatch = query.match(/^rename\s+(\S+)\s+(\S+)$/i);
    if (renameMatch) {
      const oldName = normalizeName(renameMatch[1].trim());
      const newName = normalizeName(renameMatch[2].trim());
      await message.reply(UI.loading(`Renommage ${oldName} → ${newName}...`));
      try {
        const content = await getFileContent(oldName);
        saveBackup(oldName, content);
        await pushFileToGithub(newName, content, `🦔 Rename: ${oldName} → ${newName}`);
        await deleteFileOnGithub(oldName);
        return message.reply(UI.success(`${oldName} → ${newName} ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const diffMatch = query.match(/^diff\s+(.+)$/i);
    if (diffMatch) {
      const fileName = normalizeName(diffMatch[1].trim());
      await message.reply(UI.loading(`Diff ${fileName}...`));
      try {
        const remoteCode = await getFileContent(fileName);
        const localPath = path.join(CMD_PATH, fileName);
        if (!fs.existsSync(localPath)) return message.reply(UI.warn("Pas de version locale."));
        const localCode = fs.readFileSync(localPath, "utf8");
        const d = diffFiles(localCode, remoteCode);
        return message.reply(UI.info(`${fileName}\n${d.summary}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const rollbackMatch = query.match(/^rollback\s+(.+)$/i);
    if (rollbackMatch) {
      const fileName = normalizeName(rollbackMatch[1].trim());
      await message.reply(UI.loading(`Rollback ${fileName}...`));
      try {
        const backup = loadBackups()[fileName]?.[0];
        if (!backup) return message.reply(UI.warn("Aucun backup."));
        const curCode = await getFileContent(fileName);
        saveBackup(fileName, curCode);
        await pushFileToGithub(fileName, backup.content, `🦔 Rollback: ${fileName}`);
        return message.reply(UI.success(`${fileName} restauré ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    await message.reply(UI.loading("HedgehogGPT réfléchit..."));
    try {
      const reply = await askHedgehog(history, query);
      this.saveHistory();
      return message.reply(UI.hedgehog(reply));
    } catch (err) {
      return message.reply(UI.error(err.message));
    }
  },

  onStart: async function ({ args, message, event }) {
    if (!CONFIG.allowed.includes(event.senderID.toString()))
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
      const content = args.slice(2).join(" ");
      if (!fileName || !content) return message.reply(UI.error(`Usage : ${p}commit save <nom.js> <contenu>`));
      const finalName = normalizeName(fileName);
      const filePath = path.join(CMD_PATH, finalName);
      ensureDir(CMD_PATH);
      if (fs.existsSync(filePath)) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
      fs.writeFileSync(filePath, content, "utf8");
      return message.reply(UI.success(`${finalName} sauvegardé (${content.length} car.)`));
    }

    if (sub === "paste") {
      const fileName = args[1];
      const pasteLink = args[2];
      const autoPush = args.includes("--push");
      if (!fileName || !pasteLink) return message.reply(UI.error(`Usage : ${p}commit paste <nom.js> <lien>`));
      await message.reply(UI.loading("Import Pastebin..."));
      try {
        const { content } = await fetchPastebinContent(pasteLink);
        if (!content?.trim()) return message.reply(UI.error("Vide ou inaccessible."));
        const finalName = normalizeName(fileName);
        const filePath = path.join(CMD_PATH, finalName);
        ensureDir(CMD_PATH);
        if (fs.existsSync(filePath)) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
        fs.writeFileSync(filePath, content, "utf8");
        const fakeUrl = await createTrapPastebin(finalName);
        if (autoPush) {
          await pushFileToGithub(finalName, content, `🦔 Import: ${finalName}`);
          return message.reply(UI.success(`${finalName} importé + commit ✅\n🔗 ${fakeUrl || "blocked"}`));
        }
        return message.reply(UI.success(`${finalName} importé\n🔗 ${fakeUrl || "blocked"}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "export") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit export <nom.js>`));
      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" introuvable.`));
      await message.reply(UI.loading("Export..."));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);
        if (!pasteUrl) return message.reply(UI.warn("Export échoué."));
        return message.reply(UI.success(`${fileName} exporté\n🔗 ${pasteUrl}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "push") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit push <nom.js>`));
      const filePath = path.join(CMD_PATH, fileName);
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" introuvable.`));
      await message.reply(UI.loading(`Push ${fileName}...`));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(fileName, content, `🦔 Push: ${fileName}`);
        return message.reply(UI.success(`${fileName} pushé ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "pushall") {
      ensureDir(CMD_PATH);
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.warn("Aucun fichier."));
      await message.reply(UI.loading(`Push ${files.length} fichiers...`));
      const res = { ok: 0, fail: 0 };
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          await pushFileToGithub(file, content, `🦔 Pushall: ${file}`);
          res.ok++;
        } catch { res.fail++; }
      }
      return message.reply(UI.success(`✅ ${res.ok} pushé(s)` + (res.fail ? `\n❌ ${res.fail}` : "")));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Pull..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.info("GitHub vide."));
        ensureDir(CMD_PATH);
        for (const file of files) {
          const fileRes = await axios.get(file.download_url, { timeout: 10000 });
          const localPath = path.join(CMD_PATH, file.name);
          if (fs.existsSync(localPath)) saveBackup(file.name, fs.readFileSync(localPath, "utf8"));
          fs.writeFileSync(localPath, fileRes.data, "utf8");
        }
        return message.reply(UI.success(`${files.length} récupéré(s) ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "list") {
      ensureDir(CMD_PATH);
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.info("Aucune commande."));
      return message.reply(UI.info(`Fichiers (${files.length})\n` + files.join("\n")));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("GitHub..."));
      try {
        const files = await getRemoteFiles();
        if (!files.length) return message.reply(UI.info("GitHub vide."));
        return message.reply(UI.info(`GitHub (${files.length})\n` + files.map(f => f.name).join("\n")));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "delete") {
      const fileName = normalizeName(args[1] || "");
      if (!args[1]) return message.reply(UI.error(`Usage : ${p}commit delete <nom.js>`));
      await message.reply(UI.loading(`Suppression ${fileName}...`));
      try {
        const content = await getFileContent(fileName).catch(() => null);
        if (content) saveBackup(fileName, content);
        await deleteFileOnGithub(fileName);
        return message.reply(UI.success(`${fileName} supprimé ✅`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "info") {
      await message.reply(UI.loading("Infos..."));
      try {
        const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}`;
        const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
        const tok = await checkToken();
        return message.reply(UI.info(
          `👤 ${res.data.owner.login}\n📦 ${res.data.name}\n⭐ ${res.data.stargazers_count}\n🔑 Token: ${tok.valid ? `✅ ${tok.user}` : `❌ ${tok.reason}`}\n🔗 ${res.data.html_url}`
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    return message.reply(UI.error(`Commande inconnue. Tape ${p}commit help`));
  }
};