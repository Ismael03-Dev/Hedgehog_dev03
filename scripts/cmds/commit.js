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

const REACTION_TTL   = 3 * 60 * 1000;
const MAX_FILE       = 80000;
const MAX_LINES_SHOW = 500;
const CMD_PATH       = path.join(process.cwd(), "scripts", "cmds");
const HISTORY_PATH   = path.join(process.cwd(), "data", "hedgehog_history.json");
const BACKUP_PATH    = path.join(process.cwd(), "data", "hedgehog_backups.json");
const LOG_PATH       = path.join(process.cwd(), "data", "hedgehog_actions.log");

const pendingActions = new Map();

async function loadConfig() {
  try {
    const res = await axios.get(`${API_URL}?key=${API_KEY}`, { timeout: 8000 });
    if (res.data?.github?.token) {
      CONFIG = res.data;
      console.log("[HedgehogGPT] Config loaded successfully");
      return true;
    }
    console.warn("[HedgehogGPT] Empty token in API config");
    return false;
  } catch (err) {
    console.error("[HedgehogGPT] Config API error:", err.message);
    return false;
  }
}

async function checkToken() {
  const token = CONFIG.github.token;
  if (!token || token.length < 10)
    return { valid: false, reason: "Token not configured" };

  try {
    const res = await axios.get("https://api.github.com/user", {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Cache-Control": "no-cache" },
      timeout: 8000
    });
    const scopes  = res.headers["x-oauth-scopes"] || "";
    const hasRepo = scopes.includes("repo");
    if (!hasRepo)
      return { valid: false, reason: "Token lacks repo permission", user: res.data.login, scopes };
    return { valid: true, user: res.data.login, scopes, hasRepo };
  } catch (err) {
    const status = err.response?.status;
    return { valid: false, reason: status === 401 ? "Invalid or expired token" : status === 403 ? "Token lacks permission" : err.message };
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
  hedgehog: (t) => t,
  warn:     (t) => UI.frame("⚠️", t),
  loading:  (t) => UI.frame("⏳", t)
};

const SYSTEM_PROMPT = `You are HedgehogGPT, an AI assistant directly connected to the GitHub repository ${CONFIG.github.username}/${CONFIG.github.repo}.
You work ONLY with the real code provided in context.

ABSOLUTE RULES:
1. If asked for code without being provided the file, reply "Use 'HedgehogGPT show <file>' to see the real code."
2. NEVER quote code from memory or invent it.
3. Base your analysis ONLY on the code provided between triple backticks.
4. When code is provided to you, it is the REAL file from GitHub.
5. When modifying code, return ONLY the final code, no explanations, no backticks, no markdown.
6. For analysis, respond clearly in English.
7. GoatBot structure: config, onStart, onChat, onReply, getLang, message.reply, api, event.
8. When proposing improvements, always end with "💬 React to this message to apply changes directly on GitHub."
9. NEVER use triple backticks in your responses. Use single backticks if needed.
10. NEVER use special fonts or formatting. Use plain text only.`;

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

function extractPastebinKey(input) {
  if (input.includes("pastebin.com/")) {
    const parts = input.split("/");
    return parts[parts.length - 1].split("?")[0].trim();
  }
  return input.trim();
}

function sanitizeText(text) {
  return text.replace(/```/g, "`");
}

function logAction(action, details) {
  ensureDir(path.dirname(LOG_PATH));
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${action} : ${details}\n`, "utf8");
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
  const added   = newCode.split("\n").filter(l => !oldCode.includes(l)).length;
  const removed = oldCode.split("\n").filter(l => !newCode.includes(l)).length;
  return { added, removed, summary: `+${added} / -${removed} lines` };
}

function smartTruncate(code, maxChars = 15000) {
  if (code.length <= maxChars) return code;
  const lines       = code.split("\n");
  const moduleStart = lines.findIndex(l => l.includes("module.exports"));
  if (moduleStart > 0) {
    const before = lines.slice(0, 25);
    const after  = lines.slice(moduleStart - 5);
    return before.join("\n") + "\n\n// ... (truncated for analysis) ...\n\n" + after.join("\n");
  }
  return lines.slice(0, 35).join("\n") + "\n\n// ... (truncated) ...\n\n" + lines.slice(-35).join("\n");
}

async function fetchPastebinContent(input) {
  const key    = extractPastebinKey(input);
  const rawUrl = `https://pastebin.com/raw/${key}`;
  const res    = await axios.get(rawUrl, { timeout: 10000 });
  return { content: res.data, key, rawUrl };
}

async function fetchUrlContent(url) {
  if (url.includes("pastebin.com")) {
    const { content } = await fetchPastebinContent(url);
    return content;
  }
  if (url.includes("github.com") && url.includes("/blob/")) {
    const rawUrl = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    const res = await axios.get(rawUrl, { timeout: 10000 });
    return res.data;
  }
  if (url.includes("raw.githubusercontent.com")) {
    const res = await axios.get(url, { timeout: 10000 });
    return res.data;
  }
  const res = await axios.get(url, { timeout: 10000 });
  return typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
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

async function getFileSha(filePath) {
  try {
    const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${filePath}`;
    const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
    return res.data.sha || null;
  } catch {
    return null;
  }
}

async function getRepoFiles(dirPath = "") {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${dirPath}?ref=${CONFIG.github.branch}`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  if (!Array.isArray(res.data)) return [];
  return res.data.filter(f => f.type === "file" && f.name.endsWith(".js"));
}

async function getRepoTree() {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/git/trees/${CONFIG.github.branch}?recursive=1`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  return res.data.tree || [];
}

async function getFileContent(filePath) {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${filePath}?ref=${CONFIG.github.branch}&_t=${Date.now()}`;
  const res = await axios.get(url, {
    headers: { ...githubHeaders(), "Cache-Control": "no-cache", "Pragma": "no-cache" },
    timeout: 10000
  });
  if (!res.data?.content) throw new Error(`"${filePath}" not found on GitHub`);
  return Buffer.from(res.data.content, "base64").toString("utf8");
}

async function pushFileToGithub(filePath, content, commitMsg) {
  const tok = await checkToken();
  if (!tok.valid) throw new Error(`Invalid token: ${tok.reason}`);

  const url            = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${filePath}`;
  const encodedContent = Buffer.from(typeof content === "string" ? content : fs.readFileSync(content)).toString("base64");
  const sha            = await getFileSha(filePath);
  const body           = { message: commitMsg || `🦔 HedgehogGPT: ${filePath}`, content: encodedContent, branch: CONFIG.github.branch };
  if (sha) body.sha    = sha;

  const res = await axios.put(url, body, { headers: githubHeaders(), timeout: 15000 });
  if (res.status !== 200 && res.status !== 201)
    throw new Error(`GitHub returned status ${res.status}`);

  logAction("PUSH", `${filePath} → ${CONFIG.github.repo}`);
  return res.data;
}

async function deleteFileOnGithub(filePath) {
  const sha = await getFileSha(filePath);
  if (!sha) throw new Error(`"${filePath}" not found on GitHub`);
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${filePath}`;
  await axios.delete(url, {
    headers: githubHeaders(),
    data:    { message: `🗑️ Delete: ${filePath}`, sha, branch: CONFIG.github.branch },
    timeout: 10000
  });
  logAction("DELETE", filePath);
}

async function getCommitHistory(filePath) {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/commits?path=${filePath}&per_page=5`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  return res.data;
}

async function getRepoInfo() {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}`;
  const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });
  return res.data;
}

async function setRepoVisibility(makePrivate) {
  const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}`;
  const res = await axios.patch(url, { private: makePrivate }, { headers: githubHeaders(), timeout: 10000 });
  logAction("VISIBILITY", makePrivate ? "private" : "public");
  return res.data;
}

async function askHedgehog(history, userMessage) {
  if (!CONFIG.mistral.key) throw new Error("Mistral key not configured. Type 'HedgehogGPT config'.");

  history.push({ role: "user", content: userMessage });
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history.slice(-16)];

  try {
    const res = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      { model: "mistral-large-latest", messages, max_tokens: 4096, temperature: 0.3 },
      { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CONFIG.mistral.key}` }, timeout: 120000 }
    );
    let reply = res.data.choices[0].message.content;
    if (!reply?.trim()) throw new Error("Empty response");
    reply = sanitizeText(reply);
    history.push({ role: "assistant", content: reply });
    if (history.length > 32) history.splice(0, 2);
    return reply;
  } catch (err) {
    if (err.response?.status === 429) throw new Error("Mistral rate limit reached. Try again.");
    if (err.code === "ECONNABORTED" || err.message.includes("timeout")) {
      throw new Error("Mistral timeout - file too large. Try 'HedgehogGPT simplify' first.");
    }
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
          errors.push(`L${i + 1}: "${match[1]}" not installed`);
        }
      }
    }
  });
  const tc = (code.match(/\btry\s*\{/g) || []).length;
  const cc = (code.match(/\bcatch\s*[({]/g) || []).length;
  if (tc > cc) errors.push(`${tc - cc} try without catch`);
  if (code.includes("module.exports")) {
    if (!code.includes("config:")) errors.push("config missing");
    if (!code.includes("onStart:") && !code.includes("onChat:")) errors.push("onStart/onChat required");
  }
  const ob = (code.match(/\{/g) || []).length;
  const cb = (code.match(/\}/g) || []).length;
  if (ob !== cb) errors.push(`Unbalanced braces ({${ob}} vs }${cb})`);
  return errors;
}

async function generateWorkImage(action, fileName, details) {
  const prompts = {
    scan:      `A cute hedgehog programmer fixing bugs in code, digital art style, purple and gold colors, text "Scan: ${details}"`,
    fix:       `A hedgehog developer repairing code files, cyberpunk style, neon colors, text "${fileName} fixed"`,
    analyse:   `A tech-savvy hedgehog analyzing code on multiple screens, futuristic, blue and purple, text "Analysis: ${fileName}"`,
    improve:   `A hedgehog upgrading and enhancing software, workshop setting, orange and blue, text "Improvement: ${fileName}"`,
    review:    `A professional hedgehog doing code review, office setting, green and gold, text "Review: ${fileName}"`,
    create:    `A creative hedgehog building a new project, construction theme, warm colors, text "${fileName} created"`,
    doc:       `A studious hedgehog writing documentation, library setting, brown and gold, text "Doc: ${fileName}"`,
    test:      `A scientist hedgehog running experiments, lab setting, teal and white, text "Tests: ${fileName}"`,
    simplify:  `A minimalist hedgehog cleaning up code, zen garden, white and green, text "Simplify: ${fileName}"`,
    scanlink:  `A detective hedgehog inspecting external code, magnifying glass, noir style, text "Link Scan: ${details}"`,
    default:   `Hedgehog programmer mascot, cool tech style, purple neon, text "${action}"`
  };

  const prompt = prompts[action] || prompts.default;

  try {
    const res = await axios.post("https://gem-tw6a.onrender.com/generate", {
      prompt: prompt,
      width: 512,
      height: 512
    }, {
      timeout: 30000,
      responseType: "arraybuffer"
    });

    const tempDir = path.join(process.cwd(), "temp");
    ensureDir(tempDir);
    const imgPath = path.join(tempDir, `hedgehog_${action}_${Date.now()}.png`);
    fs.writeFileSync(imgPath, Buffer.from(res.data));
    return imgPath;
  } catch (err) {
    console.error("[image]", err.message);
    return null;
  }
}

async function createTrapPastebin(fileName) {
  const msgs = [
    "🦔 HEDGEHOG GPT\n\nProtected code.\n⚠️ File locked.",
    "🔐 RESTRICTED ACCESS\n\nAutomated decoy.\nCode secured on GitHub.",
    "🛡️ HEDGEHOG GUARD\n\nTrap link.\nProperty of Ismael03-Dev.",
    "⚠️ DECOY DETECTED\n\nFake link!\nReal code on GitHub."
  ];
  try { return await uploadToPastebin(`TRAP-${fileName}`, msgs[Math.floor(Math.random() * msgs.length)]); }
  catch { return null; }
}

async function createShareablePastebin(fileName, code) {
  try {
    const url = await uploadToPastebin(fileName, code);
    return url;
  } catch (err) {
    console.error("[pastebin]", err.message);
    return null;
  }
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
  const sl  = display.slice(0, 35);
  const W   = Math.max(400, mlw * 8 + pd * 2);
  const H   = sl.length * lh + hh + pd;
  const c   = createCanvas(W, H);
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

  const buf    = c.toBuffer("image/png");
  const tmpDir = path.join(process.cwd(), "temp");
  ensureDir(tmpDir);
  const imgPath = path.join(tmpDir, `code_${Date.now()}.png`);
  fs.writeFileSync(imgPath, buf);
  return imgPath;
}

async function registerPending(message, reply, filePath, newCode, uid, type) {
  return new Promise(resolve => {
    message.reply(reply, (err, info) => {
      if (err || !info?.messageID) { resolve(null); return; }
      const msgID = info.messageID;
      pendingActions.set(msgID, { type, filePath, newCode, uid, expiresAt: Date.now() + REACTION_TTL });
      setTimeout(() => pendingActions.delete(msgID), REACTION_TTL);
      console.log("[pending] Registered", msgID, "for", type, filePath);
      resolve(msgID);
    });
  });
}

async function sendWithImage(message, text, imagePath) {
  const msg = { body: text };
  if (imagePath && fs.existsSync(imagePath)) {
    msg.attachment = fs.createReadStream(imagePath);
  }
  message.reply(msg, () => {
    if (imagePath) setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000);
  });
}

module.exports = {
  config: {
    name:             "commit",
    version:          "23.0",
    author:           "Ismael03-Dev",
    countDown:        5,
    role:             2,
    category:         "admin",
    shortDescription: { en: "HedgehogGPT — GitHub Copilot full access" }
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
    const userID = event?.userID?.toString() || event?.senderID?.toString() || Reaction?.userID?.toString();
    if (!CONFIG.allowed.includes(userID)) return;

    const msgID = Reaction?.messageID || event?.messageID || event?.reaction?.messageID;
    if (!msgID) return;

    const action = pendingActions.get(msgID);
    if (!action) return;

    if (Date.now() > action.expiresAt) {
      pendingActions.delete(msgID);
      return message.reply(UI.warn("Action expired. Ask HedgehogGPT again."));
    }

    if (userID !== action.uid) return;

    pendingActions.delete(msgID);
    await message.reply(UI.loading(`Applying changes to ${action.filePath}...`));

    try {
      const tok = await checkToken();
      if (!tok.valid)
        return message.reply(UI.error(`Invalid token: ${tok.reason}`));

      const currentCode = await getFileContent(action.filePath);
      saveBackup(action.filePath, currentCode);
      await pushFileToGithub(action.filePath, action.newCode, `🦔 HedgehogGPT: improved ${action.filePath}`);

      const d = diffFiles(currentCode, action.newCode);
      const localPath = path.join(CMD_PATH, action.filePath.split("/").pop());
      if (fs.existsSync(localPath)) fs.writeFileSync(localPath, action.newCode, "utf8");

      const imagePath = await generateWorkImage(action.type || "improve", action.filePath, d.summary);

      return sendWithImage(message, UI.success(
        `${action.filePath} improved + committed\n${d.summary}\n🔗 github.com/${CONFIG.github.username}/${CONFIG.github.repo}`
      ), imagePath);
    } catch (err) {
      console.error("[onReaction]", err.message);
      return message.reply(UI.error(`Push failed: ${err.message}`));
    }
  },

  onChat: async function ({ message, event }) {
    if (!CONFIG.allowed.includes(event.senderID.toString())) return;

    const body = event.body?.trim() || "";
    if (!body.toLowerCase().startsWith("hedgehoggpt")) return;

    const uid     = event.senderID.toString();
    const query   = body.slice(11).trim();
    const history = this.getHistory(uid);

    if (!query || query.toLowerCase() === "help") {
      return message.reply(UI.info(
        `🦔 HEDGEHOG GPT v23\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `token → Check token\n` +
        `config → Reload config\n` +
        `repo → Repo info\n` +
        `repo public/private → Visibility\n` +
        `tree → Full repo tree\n` +
        `list <path> → List directory\n` +
        `show <file> → View code\n` +
        `scan → Scan all JS + fix\n` +
        `scanlink <url> → Scan external link\n` +
        `check <file> → Check errors\n` +
        `preview <file> → Code image\n` +
        `analyse <file|*> → Analyze\n` +
        `fix <file|*> → Fix + commit\n` +
        `improve <file> → Improve\n` +
        `review <file> → Code review\n` +
        `create <path> <desc> → Create file\n` +
        `doc <file> → JSDoc + commit\n` +
        `test <file> → Tests + commit\n` +
        `explain <file> → Explain code\n` +
        `simplify <file> → Refactor\n` +
        `diff <file> → Compare local/GitHub\n` +
        `rollback <file> → Restore backup\n` +
        `history <file> → Commit history\n` +
        `rename <old> <new> → Rename\n` +
        `search <term> → Search in repo\n` +
        `backup list → List backups\n` +
        `stats → Statistics\n` +
        `reset → Reset conversation`
      ));
    }

    if (query.toLowerCase() === "reset") {
      this.hedgehogHistory[uid] = [];
      this.saveHistory();
      return message.reply(UI.success("Memory cleared."));
    }

    if (query.toLowerCase() === "token") {
      await message.reply(UI.loading("Checking token..."));
      const tok = await checkToken();
      return tok.valid
        ? message.reply(UI.success(`Token valid\n👤 ${tok.user}\n📦 ${CONFIG.github.repo}\n🔑 Scopes: ${tok.scopes || "N/A"}`))
        : message.reply(UI.error(`Token invalid\n${tok.reason}`));
    }

    if (query.toLowerCase() === "config") {
      await message.reply(UI.loading("Reloading config..."));
      await loadConfig();
      const tok = await checkToken();
      return tok.valid
        ? message.reply(UI.success(`Config reloaded\n👤 ${tok.user}\n📦 ${CONFIG.github.repo}`))
        : message.reply(UI.error(`Config reloaded but token invalid\n${tok.reason}`));
    }

    if (query.toLowerCase() === "repo") {
      await message.reply(UI.loading("Fetching repo info..."));
      try {
        const r = await getRepoInfo();
        const tok = await checkToken();
        return message.reply(UI.info(
          `📦 ${r.full_name}\n🌿 ${CONFIG.github.branch}\n🔒 ${r.private ? "Private" : "Public"}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n📝 ${r.description || "None"}\n🔑 Token: ${tok.valid ? "✅ " + tok.user : "❌ " + tok.reason}\n🔗 ${r.html_url}`
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const repoVisibilityMatch = query.match(/^repo\s+(public|private)$/i);
    if (repoVisibilityMatch) {
      const makePrivate = repoVisibilityMatch[1].toLowerCase() === "private";
      const label = makePrivate ? "private" : "public";
      await message.reply(UI.loading(`Setting repo to ${label}...`));
      try {
        const tok = await checkToken();
        if (!tok.valid) return message.reply(UI.error(`Invalid token: ${tok.reason}`));
        const before = await getRepoInfo();
        if (before.private === makePrivate) return message.reply(UI.warn(`Repo is already ${label}.`));
        const after = await setRepoVisibility(makePrivate);
        return message.reply(UI.success(`Repo ${label}\n📦 ${after.full_name}\n🔗 ${after.html_url}`));
      } catch (err) {
        return message.reply(UI.error(`Visibility change failed: ${err.message}`));
      }
    }

    if (query.toLowerCase() === "tree") {
      await message.reply(UI.loading("Fetching repository tree..."));
      try {
        const tree = await getRepoTree();
        const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
        const folders = new Set(jsFiles.map(f => f.path.split("/").slice(0, -1).join("/")));

        let msg = `Repository Tree (${jsFiles.length} JS files)\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;
        folders.forEach(folder => {
          msg += `📁 ${folder || "root"}\n`;
          jsFiles.filter(f => f.path.startsWith(folder)).slice(0, 5).forEach(f => {
            msg += `  └─ 📄 ${f.path.split("/").pop()}\n`;
          });
        });

        return message.reply(UI.info(msg));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const listMatch = query.match(/^list(?:\s+(.+))?$/i);
    if (listMatch) {
      const dirPath = listMatch[1] ? listMatch[1].trim().replace(/\/+$/, "") : "";
      const displayPath = dirPath || "root";

      await message.reply(UI.loading(`Listing files in ${displayPath}...`));

      try {
        const url = `https://api.github.com/repos/${CONFIG.github.username}/${CONFIG.github.repo}/contents/${dirPath}?ref=${CONFIG.github.branch}`;
        const res = await axios.get(url, { headers: githubHeaders(), timeout: 10000 });

        if (!Array.isArray(res.data)) return message.reply(UI.warn(`Invalid path: ${displayPath}`));
        if (!res.data.length) return message.reply(UI.warn(`Empty directory: ${displayPath}`));

        const folders = res.data.filter(f => f.type === "dir").sort((a, b) => a.name.localeCompare(b.name));
        const files = res.data.filter(f => f.type === "file" && f.name.endsWith(".js")).sort((a, b) => a.name.localeCompare(b.name));

        let msg = `📁 ${displayPath}\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n`;

        if (folders.length > 0) {
          msg += `\n📂 Folders (${folders.length}):\n`;
          folders.forEach(f => msg += `  📁 ${f.name}\n`);
        }

        if (files.length > 0) {
          msg += `\n📄 JS Files (${files.length}):\n`;
          files.forEach(f => msg += `  📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)\n`);
        }

        if (folders.length === 0 && files.length === 0) {
          msg += `\nNo JS files or folders found.`;
        }

        msg += `\n🔗 github.com/${CONFIG.github.username}/${CONFIG.github.repo}/tree/${CONFIG.github.branch}/${dirPath}`;

        return message.reply(UI.info(msg));
      } catch (err) {
        if (err.response?.status === 404) {
          return message.reply(UI.error(`Directory not found: ${displayPath}`));
        }
        return message.reply(UI.error(err.message));
      }
    }

    if (query.toLowerCase() === "stats") {
      const backups = loadBackups();
      const totalBackups = Object.values(backups).reduce((s, b) => s + b.length, 0);
      const totalFiles = Object.keys(backups).length;
      return message.reply(UI.info(
        `HedgehogGPT Stats\n💬 Messages: ${history.length}\n📁 Backed up files: ${totalFiles}\n💾 Total backups: ${totalBackups}\n📦 Repo: ${CONFIG.github.repo}\n🦔 Version: 23.0`
      ));
    }

    if (query.toLowerCase() === "backup list") {
      const backups = loadBackups();
      const files = Object.keys(backups);
      if (!files.length) return message.reply(UI.warn("No backups found."));
      return message.reply(UI.info(`Backups (${files.length})\n` + files.map(f => `📄 ${f}: ${backups[f].length} version(s)`).join("\n")));
    }

    const searchMatch = query.match(/^search\s+(.+)$/i);
    if (searchMatch) {
      const searchTerm = searchMatch[1].trim().toLowerCase();
      await message.reply(UI.loading(`Searching for "${searchTerm}"...`));
      try {
        const tree = await getRepoTree();
        const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
        const results = [];
        for (const file of jsFiles) {
          const code = await getFileContent(file.path);
          if (code.toLowerCase().includes(searchTerm) || file.path.toLowerCase().includes(searchTerm)) {
            const matchLines = code.split("\n").filter(l => l.toLowerCase().includes(searchTerm)).length;
            results.push(`📄 ${file.path} (${matchLines} occ.)`);
          }
        }
        return results.length > 0
          ? message.reply(UI.info(`Results (${results.length})\n` + results.join("\n")))
          : message.reply(UI.warn(`No results for "${searchTerm}".`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const showMatch = query.match(/^show\s+(.+)$/i);
    if (showMatch) {
      const filePath = showMatch[1].trim();
      await message.reply(UI.loading(`Reading ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        const lines = code.split("\n");
        const totalLines = lines.length;

        if (totalLines <= MAX_LINES_SHOW) {
          return message.reply(UI.info(`📄 ${filePath} (${totalLines} lines)\n\n${code}`));
        }

        const pastebinUrl = await createShareablePastebin(filePath.split("/").pop(), code);
        const preview = lines.slice(0, 30).join("\n");

        return message.reply(UI.info(
          `📄 ${filePath} (${totalLines} lines)\n` +
          `File exceeds ${MAX_LINES_SHOW} lines\n` +
          `Full code on Pastebin:\n${pastebinUrl || "Failed"}\n\n` +
          `Preview:\n${preview}\n...`
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const scanLinkMatch = query.match(/^scanlink\s+(https?:\/\/\S+)$/i);
    if (scanLinkMatch) {
      const url = scanLinkMatch[1].trim();
      await message.reply(UI.loading(`Scanning external link...`));

      try {
        const content = await fetchUrlContent(url);

        if (!content || !content.trim()) {
          return message.reply(UI.error("Empty or inaccessible content."));
        }

        const errs = detectSyntaxErrors(content);
        const lines = content.split("\n").length;
        const size = content.length;
        const fileName = url.split("/").pop()?.split("?")[0] || "unknown_file.js";

        if (errs.length > 0 && content.length <= MAX_FILE) {
          const truncatedCode = smartTruncate(content);
          const newCode = await askHedgehog(history, `Fix this file from an external link.\nDetected errors:\n${errs.join("\n")}\n\nReturn ONLY the corrected code, no backticks:\n\`\`\`\n${truncatedCode}\n\`\`\``);

          const imagePath = await generateWorkImage("scanlink", fileName, `${errs.length} error(s)`);

          return sendWithImage(message, UI.success(
            `Link scan complete\n` +
            `📄 ${fileName}\n` +
            `📝 ${lines} lines | ${(size / 1024).toFixed(1)} KB\n` +
            `🔧 ${errs.length} error(s) detected\n\n` +
            `File was NOT pushed (external link).\n` +
            `Use commit paste to import it.`
          ), imagePath);

        } else if (errs.length === 0) {
          return message.reply(UI.success(
            `Link scan complete\n` +
            `📄 ${fileName}\n` +
            `📝 ${lines} lines | ${(size / 1024).toFixed(1)} KB\n` +
            `No errors detected.`
          ));
        } else {
          return message.reply(UI.warn(
            `Link scan complete\n` +
            `📄 ${fileName}\n` +
            `📝 ${lines} lines | ${(size / 1024).toFixed(1)} KB\n` +
            `File too large (${(size / 1024).toFixed(0)} KB > ${(MAX_FILE / 1024).toFixed(0)} KB)`
          ));
        }

      } catch (err) {
        return message.reply(UI.error(`Link scan failed: ${err.message}`));
      }
    }

    if (query.toLowerCase() === "scan") {
      await message.reply(UI.loading("Scanning all JS files..."));
      try {
        const tree = await getRepoTree();
        const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
        const res = { ok: 0, clean: 0, fail: 0 };
        for (const file of jsFiles) {
          try {
            const code = await getFileContent(file.path);
            const errs = detectSyntaxErrors(code);
            if (errs.length > 0 && code.length <= MAX_FILE) {
              saveBackup(file.path, code);
              const truncatedCode = smartTruncate(code);
              const newCode = await askHedgehog([], `Fix:\n${errs.join("\n")}\n\nReturn ONLY the corrected code, no backticks:\n\n${truncatedCode}`);
              await pushFileToGithub(file.path, newCode, `🦔 Scan: ${file.path}`);
              res.ok++;
            } else if (errs.length === 0) {
              res.clean++;
            }
          } catch { res.fail++; }
        }
        const details = `${res.ok} fixed, ${res.clean} clean`;
        const imagePath = await generateWorkImage("scan", "", details);
        this.saveHistory();
        return sendWithImage(message, UI.success(`${res.ok} fixed, ${res.clean} clean` + (res.fail ? `, ${res.fail} failed` : "")), imagePath);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const previewMatch = query.match(/^preview\s+(.+)$/i);
    if (previewMatch) {
      await message.reply(UI.loading("Generating preview..."));
      try {
        const filePath = previewMatch[1].trim();
        const code = await getFileContent(filePath);
        const imagePath = createCodeImageSync(code, filePath);
        message.reply(
          { body: UI.success(`${filePath} | ${code.split("\n").length} lines`), attachment: fs.createReadStream(imagePath) },
          () => setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000)
        );
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const checkMatch = query.match(/^check\s+(.+)$/i);
    if (checkMatch) {
      const filePath = checkMatch[1].trim();
      await message.reply(UI.loading(`Checking ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        const errs = detectSyntaxErrors(code);
        const lines = code.split("\n").length;
        const size = code.length;
        const functions = (code.match(/function\s+\w+|async\s+function\s+\w+|=>/g) || []).length;
        const requires = (code.match(/require\(/g) || []).length;
        let msg = `📄 ${filePath}\n📝 ${lines} lines | ${(size / 1024).toFixed(1)} KB\n⚙️ ${functions} functions | 📦 ${requires} modules\n`;
        if (errs.length === 0) {
          msg += `No errors detected.`;
          return message.reply(UI.success(msg));
        } else {
          msg += `${errs.length} error(s):\n${errs.join("\n")}`;
          return message.reply(UI.warn(msg));
        }
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const fixMatch = query.match(/^fix\s+(.+)$/i);
    if (fixMatch) {
      const target = fixMatch[1].trim();
      await message.reply(UI.loading(`Fixing ${target}...`));
      try {
        if (target === "*") {
          const tree = await getRepoTree();
          const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
          const res = { ok: [], fail: [] };
          for (const file of jsFiles) {
            try {
              const code = await getFileContent(file.path);
              if (code.length > MAX_FILE) continue;
              const errs = detectSyntaxErrors(code);
              const errList = errs.length > 0 ? `\nErrors:\n${errs.join("\n")}` : "";
              const truncatedCode = smartTruncate(code);
              const newCode = await askHedgehog(history, `Fix this file.${errList}\nReturn ONLY the corrected code, no backticks:\n\n${truncatedCode}`);
              saveBackup(file.path, code);
              await pushFileToGithub(file.path, newCode, `🦔 Fix: ${file.path}`);
              res.ok.push(file.path);
            } catch { res.fail.push(file.path); }
          }
          const imagePath = await generateWorkImage("fix", "all files", `${res.ok.length} fixed`);
          this.saveHistory();
          return sendWithImage(message, UI.success(`${res.ok.length} fixed` + (res.fail.length ? `, ${res.fail.length} failed` : "")), imagePath);
        }

        const filePath = target;
        const code = await getFileContent(filePath);
        if (code.length > MAX_FILE) return message.reply(UI.warn("File too large."));
        const errs = detectSyntaxErrors(code);
        const errList = errs.length > 0 ? `\nErrors:\n${errs.join("\n")}` : "";
        const truncatedCode = smartTruncate(code);
        const newCode = await askHedgehog(history, `Fix this file.${errList}\nReturn ONLY the corrected code, no backticks:\n\n${truncatedCode}`);
        saveBackup(filePath, code);
        await pushFileToGithub(filePath, newCode, `🦔 Fix: ${filePath}`);
        const d = diffFiles(code, newCode);
        const imagePath = await generateWorkImage("fix", filePath, d.summary);
        this.saveHistory();
        return sendWithImage(message, UI.success(`${filePath} fixed + committed\n${d.summary}`), imagePath);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const improveMatch = query.match(/^improve\s+(.+)$/i);
    if (improveMatch) {
      const filePath = improveMatch[1].trim();
      await message.reply(UI.loading(`Improving ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        if (code.length > MAX_FILE) return message.reply(UI.warn("File too large."));
        const errs = detectSyntaxErrors(code);
        const errSec = errs.length > 0 ? `\nErrors: ${errs.join(", ")}` : "";
        const truncatedCode = smartTruncate(code);
        const analysis = await askHedgehog(history, `Here is the REAL code of ${filePath} from GitHub. Propose improvements:\n\`\`\`\n${truncatedCode}\n\`\`\`\n${errSec}\nEnd with "React to apply changes."`);
        const newCode = await askHedgehog([], `Apply ALL improvements to this EXACT code. Return ONLY the final code, no backticks:\n\n${code}`);
        const imagePath = await generateWorkImage("improve", filePath, "");
        await registerPending(message, analysis, filePath, newCode, uid, "improve");
        this.saveHistory();
        if (imagePath) {
          message.reply({ body: "", attachment: fs.createReadStream(imagePath) }, () => {
            setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000);
          });
        }
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const reviewMatch = query.match(/^review\s+(.+)$/i);
    if (reviewMatch) {
      const filePath = reviewMatch[1].trim();
      await message.reply(UI.loading(`Reviewing ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        const errs = detectSyntaxErrors(code);
        const errSec = errs.length > 0 ? `\nErrors: ${errs.join(", ")}` : "";
        const truncatedCode = smartTruncate(code);
        const reply = await askHedgehog(history, `Here is the REAL code of ${filePath} from GitHub. Do a code review:\n\`\`\`\n${truncatedCode}\n\`\`\`\n${errSec}\n1. Positives 2. Bugs 3. Performance 4. Improvements 5. Score/10\nEnd with "React to apply changes."`);
        const newCode = await askHedgehog([], `Apply review improvements to this EXACT code. Return ONLY the final code, no backticks:\n\n${code}`);
        const imagePath = await generateWorkImage("review", filePath, "");
        await registerPending(message, reply, filePath, newCode, uid, "review");
        this.saveHistory();
        if (imagePath) {
          message.reply({ body: "", attachment: fs.createReadStream(imagePath) }, () => {
            setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000);
          });
        }
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const analyseMatch = query.match(/^analyse\s+(.+)$/i);
    if (analyseMatch) {
      const target = analyseMatch[1].trim();
      await message.reply(UI.loading(`Analyzing ${target}...`));
      try {
        if (target === "*") {
          const tree = await getRepoTree();
          const jsFiles = tree.filter(f => f.type === "blob" && f.path.endsWith(".js"));
          const samples = jsFiles.slice(0, 5);
          const contents = await Promise.all(samples.map(async f => {
            const code = await getFileContent(f.path);
            return `${f.path}:\n\`\`\`\n${smartTruncate(code, 1000)}\n\`\`\``;
          }));
          const reply = await askHedgehog(history, `Global analysis (${jsFiles.length} files, ${samples.length} samples). Here are the REAL files from GitHub:\n\n${contents.join("\n\n")}`);
          this.saveHistory();
          return message.reply(UI.hedgehog(reply));
        }

        const filePath = target;
        const code = await getFileContent(filePath);
        const errs = detectSyntaxErrors(code);
        const truncatedCode = smartTruncate(code);
        const reply = await askHedgehog(history, `Here is the REAL code of ${filePath} from GitHub. Analyze it:\n\`\`\`\n${truncatedCode}\n\`\`\`\n${errs.length ? `Errors detected: ${errs.join(", ")}` : ""}\nEnd with "React to apply changes."`);
        const newCode = await askHedgehog([], `Apply improvements to this EXACT code. Return ONLY the final code, no backticks:\n\n${code}`);
        const imagePath = await generateWorkImage("analyse", filePath, "");
        await registerPending(message, reply, filePath, newCode, uid, "analyse");
        this.saveHistory();
        if (imagePath) {
          message.reply({ body: "", attachment: fs.createReadStream(imagePath) }, () => {
            setTimeout(() => { try { fs.unlinkSync(imagePath); } catch {} }, 5000);
          });
        }
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
      return;
    }

    const docMatch = query.match(/^doc\s+(.+)$/i);
    if (docMatch) {
      const filePath = docMatch[1].trim();
      await message.reply(UI.loading(`Documenting ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        saveBackup(filePath, code);
        const truncatedCode = smartTruncate(code);
        const newCode = await askHedgehog(history, `Add JSDoc to this EXACT code. Return ONLY the documented code, no backticks:\n\n${truncatedCode}`);
        await pushFileToGithub(filePath, newCode, `🦔 Doc: ${filePath}`);
        const imagePath = await generateWorkImage("doc", filePath, "");
        this.saveHistory();
        return sendWithImage(message, UI.success(`${filePath} documented + committed`), imagePath);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const testMatch = query.match(/^test\s+(.+)$/i);
    if (testMatch) {
      const filePath = testMatch[1].trim();
      await message.reply(UI.loading("Generating tests..."));
      try {
        const code = await getFileContent(filePath);
        const testPath = filePath.replace(".js", ".test.js");
        const truncatedCode = smartTruncate(code);
        const testCode = await askHedgehog(history, `Generate unit tests for this EXACT code. Return ONLY the test code, no backticks:\n\n${truncatedCode}`);
        await pushFileToGithub(testPath, testCode, `🦔 Test: ${filePath}`);
        const imagePath = await generateWorkImage("test", filePath, "");
        this.saveHistory();
        return sendWithImage(message, UI.success(`${testPath} generated + committed`), imagePath);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const simplifyMatch = query.match(/^simplify\s+(.+)$/i);
    if (simplifyMatch) {
      const filePath = simplifyMatch[1].trim();
      await message.reply(UI.loading(`Simplifying ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        saveBackup(filePath, code);
        const truncatedCode = smartTruncate(code);
        const newCode = await askHedgehog(history, `Simplify this EXACT code without changing behavior. Return ONLY the code, no backticks:\n\n${truncatedCode}`);
        await pushFileToGithub(filePath, newCode, `🦔 Simplify: ${filePath}`);
        const d = diffFiles(code, newCode);
        const imagePath = await generateWorkImage("simplify", filePath, d.summary);
        this.saveHistory();
        return sendWithImage(message, UI.success(`${filePath} simplified + committed\n${d.summary}`), imagePath);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const explainMatch = query.match(/^explain\s+(.+)$/i);
    if (explainMatch) {
      const filePath = explainMatch[1].trim();
      await message.reply(UI.loading(`Explaining ${filePath}...`));
      try {
        const code = await getFileContent(filePath);
        const truncatedCode = smartTruncate(code);
        const reply = await askHedgehog(history, `Explain this REAL GoatBot file from GitHub:\n\`\`\`\n${truncatedCode}\n\`\`\`\n1. Role 2. Sections 3. Key functions 4. Important points`);
        this.saveHistory();
        return message.reply(UI.hedgehog(reply));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const createMatch = query.match(/^create\s+(\S+)\s+(.+)$/i);
    if (createMatch) {
      const filePath = createMatch[1].trim();
      const description = createMatch[2].trim();
      await message.reply(UI.loading(`Creating ${filePath}...`));
      try {
        const newCode = await askHedgehog(history, `Create a complete file: ${description}\n\nReturn ONLY the code, no backticks.`);
        await pushFileToGithub(filePath, newCode, `🦔 Create: ${filePath}`);
        this.saveHistory();
        return sendWithImage(message, UI.success(`${filePath} created + committed`), null);
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const historyMatch = query.match(/^history\s+(.+)$/i);
    if (historyMatch) {
      const filePath = historyMatch[1].trim();
      await message.reply(UI.loading(`Fetching history for ${filePath}...`));
      try {
        const commits = await getCommitHistory(filePath);
        if (!commits.length) return message.reply(UI.warn("No commits found."));
        return message.reply(UI.info(
          `History: ${filePath}\n` +
          commits.map((c, i) => {
            const date = new Date(c.commit.author.date).toLocaleString("en-US");
            return `#${i} ${c.commit.message.slice(0, 45)}\n   ${date}`;
          }).join("\n\n")
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const renameMatch = query.match(/^rename\s+(\S+)\s+(\S+)$/i);
    if (renameMatch) {
      const oldPath = renameMatch[1].trim();
      const newPath = renameMatch[2].trim();
      await message.reply(UI.loading(`Renaming ${oldPath} → ${newPath}...`));
      try {
        const content = await getFileContent(oldPath);
        saveBackup(oldPath, content);
        await pushFileToGithub(newPath, content, `🦔 Rename: ${oldPath} → ${newPath}`);
        await deleteFileOnGithub(oldPath);
        return message.reply(UI.success(`${oldPath} → ${newPath}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const diffMatch = query.match(/^diff\s+(.+)$/i);
    if (diffMatch) {
      const filePath = diffMatch[1].trim();
      await message.reply(UI.loading(`Comparing ${filePath}...`));
      try {
        const remoteCode = await getFileContent(filePath);
        const localPath = path.join(CMD_PATH, filePath.split("/").pop());
        if (!fs.existsSync(localPath)) return message.reply(UI.warn("No local version found."));
        const localCode = fs.readFileSync(localPath, "utf8");
        const d = diffFiles(localCode, remoteCode);
        return message.reply(UI.info(`${filePath}\n${d.summary}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    const rollbackMatch = query.match(/^rollback\s+(.+)$/i);
    if (rollbackMatch) {
      const filePath = rollbackMatch[1].trim();
      await message.reply(UI.loading(`Rolling back ${filePath}...`));
      try {
        const backup = loadBackups()[filePath]?.[0];
        if (!backup) return message.reply(UI.warn("No backup found."));
        const curCode = await getFileContent(filePath);
        saveBackup(filePath, curCode);
        await pushFileToGithub(filePath, backup.content, `🦔 Rollback: ${filePath}`);
        return message.reply(UI.success(`${filePath} restored\n${new Date(backup.date).toLocaleString("en-US")}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    await message.reply(UI.loading("HedgehogGPT is thinking..."));
    try {
      const reply = await askHedgehog(history, query);
      this.saveHistory();
      return message.reply(reply);
    } catch (err) {
      return message.reply(UI.error(err.message));
    }
  },

  onStart: async function ({ args, message, event }) {
    if (!CONFIG.allowed.includes(event.senderID.toString()))
      return message.reply(UI.error("Permission denied."));

    const sub = args[0]?.toLowerCase();
    const p   = global.utils.getPrefix(event.threadID);

    if (!sub || sub === "help") {
      return message.reply(UI.info(
        `COMMIT — HELP\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `${p}commit list\n` +
        `${p}commit remote\n` +
        `${p}commit save <name> <code>\n` +
        `${p}commit paste <name> <link>\n` +
        `${p}commit export <file>\n` +
        `${p}commit push <file>\n` +
        `${p}commit pushall\n` +
        `${p}commit pull\n` +
        `${p}commit sync\n` +
        `${p}commit diff\n` +
        `${p}commit delete <file>\n` +
        `${p}commit rename <old> <new>\n` +
        `${p}commit info\n\n` +
        `Type "HedgehogGPT help"`
      ));
    }

    if (sub === "save") {
      const fileName = args[1];
      const content = args.slice(2).join(" ");
      if (!fileName || !content) return message.reply(UI.error(`Usage: ${p}commit save <name.js> <content>`));
      const finalName = fileName.endsWith(".js") ? fileName : fileName + ".js";
      const filePath = path.join(CMD_PATH, finalName);
      ensureDir(CMD_PATH);
      if (fs.existsSync(filePath)) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
      fs.writeFileSync(filePath, content, "utf8");
      return message.reply(UI.success(`${finalName} saved (${content.length} chars)`));
    }

    if (sub === "paste") {
      const fileName = args[1];
      const pasteLink = args[2];
      const autoPush = args.includes("--push");
      if (!fileName || !pasteLink) return message.reply(UI.error(`Usage: ${p}commit paste <name.js> <link>`));
      await message.reply(UI.loading("Importing from Pastebin..."));
      try {
        const { content } = await fetchPastebinContent(pasteLink);
        if (!content?.trim()) return message.reply(UI.error("Empty or inaccessible."));
        const finalName = fileName.endsWith(".js") ? fileName : fileName + ".js";
        const filePath = path.join(CMD_PATH, finalName);
        ensureDir(CMD_PATH);
        if (fs.existsSync(filePath)) saveBackup(finalName, fs.readFileSync(filePath, "utf8"));
        fs.writeFileSync(filePath, content, "utf8");
        const fakeUrl = await createTrapPastebin(finalName);
        if (autoPush) {
          await pushFileToGithub(`scripts/cmds/${finalName}`, content, `🦔 Import: ${finalName}`);
          return message.reply(UI.success(`${finalName} imported + committed\n${fakeUrl || "blocked"}`));
        }
        return message.reply(UI.success(`${finalName} imported\n${fakeUrl || "blocked"}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "export") {
      const fileName = args[1] || "";
      if (!fileName) return message.reply(UI.error(`Usage: ${p}commit export <name.js>`));
      const filePath = path.join(CMD_PATH, fileName.endsWith(".js") ? fileName : fileName + ".js");
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" not found.`));
      await message.reply(UI.loading("Exporting..."));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const pasteUrl = await uploadToPastebin(fileName, content);
        if (!pasteUrl) return message.reply(UI.warn("Export failed."));
        return message.reply(UI.success(`${fileName} exported\n${pasteUrl}`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "push") {
      const fileName = args[1] || "";
      if (!fileName) return message.reply(UI.error(`Usage: ${p}commit push <name.js>`));
      const filePath = path.join(CMD_PATH, fileName.endsWith(".js") ? fileName : fileName + ".js");
      if (!fs.existsSync(filePath)) return message.reply(UI.error(`"${fileName}" not found.`));
      await message.reply(UI.loading(`Pushing ${fileName}...`));
      try {
        const content = fs.readFileSync(filePath, "utf8");
        await pushFileToGithub(`scripts/cmds/${fileName}`, content, `🦔 Push: ${fileName}`);
        return message.reply(UI.success(`${fileName} pushed`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "pushall") {
      ensureDir(CMD_PATH);
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.warn("No files found."));
      await message.reply(UI.loading(`Pushing ${files.length} files...`));
      const res = { ok: 0, fail: 0 };
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(CMD_PATH, file), "utf8");
          await pushFileToGithub(`scripts/cmds/${file}`, content, `🦔 Pushall: ${file}`);
          res.ok++;
        } catch { res.fail++; }
      }
      return message.reply(UI.success(`${res.ok} pushed` + (res.fail ? `, ${res.fail} failed` : "")));
    }

    if (sub === "pull") {
      await message.reply(UI.loading("Pulling from GitHub..."));
      try {
        const files = await getRepoFiles("scripts/cmds");
        if (!files.length) return message.reply(UI.info("GitHub is empty."));
        ensureDir(CMD_PATH);
        for (const file of files) {
          const fileRes = await axios.get(file.download_url, { timeout: 10000 });
          const localPath = path.join(CMD_PATH, file.name);
          if (fs.existsSync(localPath)) saveBackup(file.name, fs.readFileSync(localPath, "utf8"));
          fs.writeFileSync(localPath, fileRes.data, "utf8");
        }
        return message.reply(UI.success(`${files.length} files pulled`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "list") {
      ensureDir(CMD_PATH);
      const files = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js"));
      if (!files.length) return message.reply(UI.info("No commands found."));
      return message.reply(UI.info(`Local files (${files.length})\n` + files.join("\n")));
    }

    if (sub === "remote") {
      await message.reply(UI.loading("Fetching GitHub..."));
      try {
        const files = await getRepoFiles("scripts/cmds");
        if (!files.length) return message.reply(UI.info("GitHub is empty."));
        return message.reply(UI.info(`GitHub files (${files.length})\n` + files.map(f => f.name).join("\n")));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "diff") {
      await message.reply(UI.loading("Comparing..."));
      try {
        ensureDir(CMD_PATH);
        const local = new Set(fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")));
        const remote = new Set((await getRepoFiles("scripts/cmds")).map(f => f.name));
        const onlyL = [...local].filter(f => !remote.has(f));
        const onlyR = [...remote].filter(f => !local.has(f));
        const both = [...local].filter(f => remote.has(f));
        let msg = `Local: ${local.size} | GitHub: ${remote.size}`;
        if (both.length) msg += `\nCommon: ${both.length}`;
        if (onlyL.length) msg += `\nLocal only: ${onlyL.length}`;
        if (onlyR.length) msg += `\nGitHub only: ${onlyR.length}`;
        return message.reply(UI.info(msg));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "delete") {
      const fileName = args[1] || "";
      if (!fileName) return message.reply(UI.error(`Usage: ${p}commit delete <name.js>`));
      await message.reply(UI.loading(`Deleting ${fileName}...`));
      try {
        const filePath = `scripts/cmds/${fileName.endsWith(".js") ? fileName : fileName + ".js"}`;
        const content = await getFileContent(filePath).catch(() => null);
        if (content) saveBackup(filePath, content);
        await deleteFileOnGithub(filePath);
        return message.reply(UI.success(`${fileName} deleted`));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    if (sub === "rename") {
      const oldName = args[1] || "";
      const newName = args[2] || "";
      if (!oldName || !newName) return message.reply(UI.error(`Usage: ${p}commit rename <old> <new>`));
      const oldPath = path.join(CMD_PATH, oldName.endsWith(".js") ? oldName : oldName + ".js");
      const newPath = path.join(CMD_PATH, newName.endsWith(".js") ? newName : newName + ".js");
      if (!fs.existsSync(oldPath)) return message.reply(UI.error(`"${oldName}" not found.`));
      if (fs.existsSync(newPath)) return message.reply(UI.warn(`"${newName}" already exists.`));
      saveBackup(oldName, fs.readFileSync(oldPath, "utf8"));
      fs.renameSync(oldPath, newPath);
      return message.reply(UI.success(`${oldName} → ${newName}`));
    }

    if (sub === "info") {
      await message.reply(UI.loading("Fetching info..."));
      try {
        const r = await getRepoInfo();
        const tok = await checkToken();
        ensureDir(CMD_PATH);
        const localCount = fs.readdirSync(CMD_PATH).filter(f => f.endsWith(".js")).length;
        const backupCount = Object.values(loadBackups()).reduce((s, b) => s + b.length, 0);
        return message.reply(UI.info(
          `👤 ${r.owner.login}\n📦 ${r.name}\n🌿 ${CONFIG.github.branch}\n🔒 ${r.private ? "Private" : "Public"}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count}\n📁 Local: ${localCount} | 💾 Backups: ${backupCount}\n🔑 Token: ${tok.valid ? "✅ " + tok.user : "❌ " + tok.reason}\n🔗 ${r.html_url}`
        ));
      } catch (err) {
        return message.reply(UI.error(err.message));
      }
    }

    return message.reply(UI.error(`Unknown command. Type ${p}commit help`));
  }
};