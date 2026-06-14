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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function githubHeaders() {
  return {
    "Authorization": `token ${CONFIG.github.token}`,
    "User-Agent":    "HedgehogGPT",
    "Accept":        "application/vnd.github.v3+json"
  };
}

async function checkToken() {
  if (!CONFIG.github.token) return { valid: false, reason: "Token not set" };
  try {
    const res = await axios.get("https://api.github.com/user", {
      headers: githubHeaders(),
      timeout: 5000
    });
    const scopes = res.headers["x-oauth-scopes"]?.split(", ") || [];
    if (!scopes.includes("repo")) return { valid: false, reason: "Missing 'repo' scope" };
    return { valid: true, user: res.data.login, scopes };
  } catch (err) {
    return { valid: false, reason: err.response?.data?.message || err.message };
  }
}

async function loadConfig() {
  try {
    const res = await axios.get(API_URL, { params: { key: API_KEY }, timeout: 5000 });
    if (res.data) {
      if (res.data.github) {
        CONFIG.github.username = res.data.github.username || CONFIG.github.username;
        CONFIG.github.repo     = res.data.github.repo     || CONFIG.github.repo;
        CONFIG.github.branch   = res.data.github.branch   || CONFIG.github.branch;
        CONFIG.github.token    = res.data.github.token    || CONFIG.github.token;
      }
      if (res.data.mistral) CONFIG.mistral.key = res.data.mistral.key || CONFIG.mistral.key;
      if (res.data.pastebin) CONFIG.pastebin.key = res.data.pastebin.key || CONFIG.pastebin.key;
      if (res.data.allowed) CONFIG.allowed = res.data.allowed;
    }
  } catch (err) {
    console.error("[config]", err.message);
  }
}

function logAction(type, details) {
  const log = `[${new Date().toISOString()}] ${type} ${details}\n`;
  fs.appendFileSync(LOG_PATH, log, "utf8");
}

function saveBackup(filePath, content) {
  ensureDir(path.dirname(BACKUP_PATH));
  let backups = {};
  try {
    if (fs.existsSync(BACKUP_PATH)) backups = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
  } catch {}
  if (!backups[filePath]) backups[filePath] = [];
  backups[filePath].unshift({ date: Date.now(), content });
  if (backups[filePath].length > 10) backups[filePath].pop();
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(backups, null, 2), "utf8");
}

function loadBackups() {
  ensureDir(path.dirname(BACKUP_PATH));
  try {
    if (fs.existsSync(BACKUP_PATH)) return JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));
  } catch {}
  return {};
}

function extractPastebinKey(input) {
  const match = input.match(/(?:https?:\/\/)?(?:www\.)?pastebin\.com\/(?:raw\/)?([a-zA-Z0-9]+)/);
  return match ? match[1] : input;
}

function diffFiles(oldCode, newCode) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");
  let added = 0, removed = 0, changed = 0;
  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= oldLines.length) { added++; continue; }
    if (i >= newLines.length) { removed++; continue; }
    if (oldLines[i] !== newLines[i]) changed++;
  }
  return {
    summary: `🔺 ${added} | 🔻 ${removed} | 🔄 ${changed}`,
    added, removed, changed
  };
}

function sanitizeText(text) {
  return text.replace(/`/g, "").replace(/`/g, "'").trim();
}

const SYSTEM_PROMPT = `You are HedgehogGPT, an AI assistant directly connected to the GitHub repository Ismael03-Dev/Hedgehog_dev03.
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

const UI = {
  info:    (msg) => `🦔 HedgehogGPT\n${msg}`,
  success: (msg) => `✅ ${msg}`,
  warn:    (msg) => `⚠️ ${msg}`,
  error:   (msg) => `❌ ${msg}`,
  loading: (msg) => `⏳ ${msg}`,
  hedgehog: (msg) => `🦔 ${msg}`
};

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
    doc:       `A studious hedgehog writing documentation, library setting,