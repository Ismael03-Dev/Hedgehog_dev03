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
          ctx.fillStyle = "#d2a8