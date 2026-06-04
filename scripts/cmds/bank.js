const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

const API_URL = "https://hedgehog-bank-api.vercel.app/api/bank";
const CASH_URL = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";
const BOT_ADMIN = "61589149033077";

const VIP_FILE = path.join(__dirname, "bank_vips.json");
const PENDING_FILE = path.join(__dirname, "bank_pending.json");

let vipList = [];
try { if (fs.existsSync(VIP_FILE)) vipList = JSON.parse(fs.readFileSync(VIP_FILE, "utf8")); } catch(e) {}
function saveVIPs() { try { fs.writeFileSync(VIP_FILE, JSON.stringify(vipList, null, 2)); } catch(e) {} }

let pendingTransactions = new Map();
try { if (fs.existsSync(PENDING_FILE)) pendingTransactions = new Map(Object.entries(JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")))); } catch(e) {}
const pendingTimeouts = new Map();
function savePending() { try { fs.writeFileSync(PENDING_FILE, JSON.stringify(Object.fromEntries(pendingTransactions), null, 2)); } catch(e) {} }

function toBigInt(v) {
    if (typeof v === "bigint") return v;
    if (v === undefined || v === null) return 0n;
    try {
        const clean = String(v).split(".")[0].replace(/[^0-9\-]/g, "") || "0";
        return BigInt(clean);
    } catch { return 0n; }
}

// ── Cache local pour éviter trop d'appels API ──
const formatCache = new Map();

async function formatNumber(num) {
    const big = toBigInt(num);
    const key = big.toString();

    if (formatCache.has(key)) return formatCache.get(key);

    try {
        const res = await axios.get(`${FORMAT_URL}?n=${key}`, { timeout: 3000 });
        if (res.data?.success) {
            const result = res.data.formatted;
            formatCache.set(key, result);
            // Limite du cache à 500 entrées
            if (formatCache.size > 500) formatCache.delete(formatCache.keys().next().value);
            return result;
        }
    } catch(e) {
        // Fallback local si l'API est down
        console.error("Format API down, using local fallback:", e.message);
    }
    return localFormatFallback(big);
}

// ── Formatage batch (multiple nombres en 1 appel) ──
async function formatNumbers(nums) {
    const bigs = nums.map(n => toBigInt(n));
    const keys = bigs.map(b => b.toString());

    // Quels sont déjà en cache ?
    const uncached = keys.filter(k => !formatCache.has(k));

    if (uncached.length > 0) {
        try {
            const res = await axios.post(FORMAT_URL, { numbers: uncached }, { timeout: 3000 });
            if (res.data?.success) {
                for (const r of res.data.results) {
                    formatCache.set(r.raw, r.formatted);
                }
            }
        } catch(e) {
            console.error("Format batch API down:", e.message);
        }
    }

    return keys.map(k => formatCache.get(k) || localFormatFallback(BigInt(k)));
}

// ── Fallback local (si l'API est hors ligne) ──
function localFormatFallback(big) {
    if (big < 0n) return "-" + localFormatFallback(-big);
    if (big === 0n) return "0";
    if (big > 10n ** 260n) return "∞";

    const TIERS = [
        { v: 10n**258n, s: "Qiu" }, { v: 10n**255n, s: "Qu" }, { v: 10n**252n, s: "Tu" },
        { v: 10n**249n, s: "Du" }, { v: 10n**246n, s: "Uc" }, { v: 10n**243n, s: "DcQ" },
        { v: 10n**93n, s: "DcN" }, { v: 10n**90n, s: "NoN" }, { v: 10n**87n, s: "OcN" },
        { v: 10n**84n, s: "SpN" }, { v: 10n**81n, s: "SxN" }, { v: 10n**78n, s: "QiN" },
        { v: 10n**75n, s: "QaN" }, { v: 10n**72n, s: "TN" }, { v: 10n**69n, s: "BN" },
        { v: 10n**66n, s: "MN" }, { v: 10n**63n, s: "kN" }, { v: 10n**60n, s: "NoDc" },
        { v: 10n**57n, s: "OcDc" }, { v: 10n**54n, s: "SpDc" }, { v: 10n**51n, s: "Qt" },
        { v: 10n**48n, s: "Qo" }, { v: 10n**45n, s: "Qs" }, { v: 10n**42n, s: "Dz" },
        { v: 10n**39n, s: "Dq" }, { v: 10n**36n, s: "Ud" }, { v: 10n**33n, s: "De" },
        { v: 10n**30n, s: "Non" }, { v: 10n**27n, s: "Oct" }, { v: 10n**24n, s: "Sep" },
        { v: 10n**21n, s: "Sxt" }, { v: 10n**18n, s: "Qin" }, { v: 10n**15n, s: "Qd" },
        { v: 10n**12n, s: "Tr" }, { v: 10n**9n, s: "Md" }, { v: 10n**6n, s: "M" },
        { v: 10n**3n, s: "k" },
    ];

    for (const tier of TIERS) {
        if (big >= tier.v) {
            const intPart = big / tier.v;
            const remainder = big % tier.v;
            const decPart = (remainder * 100n) / tier.v;
            if (decPart > 0n) {
                const dec = Number(decPart).toString().padStart(2, "0").replace(/0+$/, "");
                if (dec === "") return `${intPart}${tier.s}`;
                return `${intPart}.${dec}${tier.s}`;
            }
            return `${intPart}${tier.s}`;
        }
    }
    return big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

async function getCash(userId) {
    try {
        const response = await axios.get(`${CASH_URL}/${userId}`, { timeout: 5000 });
        if (response.data?.success) return toBigInt(response.data.data.cash);
    } catch(e) {}
    return 0n;
}

async function addCash(userId, amount) {
    const a = toBigInt(amount);
    try {
        if (a >= 0n) await axios.post(`${CASH_URL}/${userId}/add`, { amount: a.toString() });
        else await axios.post(`${CASH_URL}/${userId}/subtract`, { amount: (-a).toString() });
    } catch(e) { console.error("Cash API:", e.message); }
}

async function apiCall(endpoint, method = "GET", body = null) {
    try {
        const opts = { method, headers: { "Content-Type": "application/json" } };
        if (body) opts.body = JSON.stringify(body);
        const response = await fetch(`${API_URL}${endpoint}`, opts);
        return await response.json();
    } catch(e) { return { success: false, error: e.message }; }
}

function clearPending(userId) {
    if (pendingTimeouts.has(userId)) { clearTimeout(pendingTimeouts.get(userId)); pendingTimeouts.delete(userId); }
    pendingTransactions.delete(userId);
    savePending();
}

function setPending(userId, data, onExpire) {
    clearPending(userId);
    const serialized = {};
    for (const [k, v] of Object.entries(data)) {
        serialized[k] = typeof v === "bigint" ? v.toString() : v;
    }
    pendingTransactions.set(userId, { ...serialized, _hasBigInt: true });
    savePending();
    const timeout = setTimeout(() => {
        if (pendingTransactions.has(userId)) {
            pendingTransactions.delete(userId);
            savePending();
            if (onExpire) onExpire();
        }
        pendingTimeouts.delete(userId);
    }, 20000);
    pendingTimeouts.set(userId, timeout);
}

function getPendingAmount(pending) {
    if (!pending?.amount) return 0n;
    return toBigInt(pending.amount);
}

function wrapText(text, maxW = 40) {
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (test.length <= maxW) cur = test;
        else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines;
}

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const line of lines) {
        if (line === "---") { out += "├─────────────•┈┈\n"; continue; }
        for (const w of wrapText(String(line), 40)) out += `│ ${w}\n`;
    }
    return out + "╰─────────────•┈┈";
}

async function drawCard(ctx, width, height, theme = "dark") {
    const themes = {
        dark: ["#0d0d1a", "#1a1035", "#0a0a2e"],
        gold: ["#1a1200", "#2a1f00", "#1a1000"],
        green: ["#001a0d", "#00260f", "#001508"],
        purple: ["#0d001a", "#1a0035", "#0a002e"],
    };
    const cols = themes[theme] || themes.dark;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, cols[0]);
    bg.addColorStop(0.5, cols[1]);
    bg.addColorStop(1, cols[2]);
    ctx.fillStyle = bg;

    const r = 22;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(width - r, 0);
    ctx.quadraticCurveTo(width, 0, width, r);
    ctx.lineTo(width, height - r);
    ctx.quadraticCurveTo(width, height, width - r, height);
    ctx.lineTo(r, height);
    ctx.quadraticCurveTo(0, height, 0, height - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(width * 0.75, height * 0.3, 60 + i * 35, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,0.03)`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 52, width, 38);

    const shine = ctx.createLinearGradient(0, 0, 0, 90);
    shine.addColorStop(0, "rgba(255,255,255,0.07)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, width, 90);
}

async function generateBankCard(opts = {}) {
    const { title = "CARD", balance = "0", username = "USER", cardData = null, cvv = null, avatarUrl = null, theme = "dark", subtitle = "", note = "" } = opts;
    const W = 640, H = 385;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    await drawCard(ctx, W, H, theme);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 17px 'Courier New'";
    ctx.fillText("HEDGEHOG", 28, 35);
    ctx.fillStyle = "rgba(212,175,55,0.6)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("PREMIUM BANKING", 28, 48);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.ellipse(W - 55, 28, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W - 35, 28, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 11px 'Courier New'";
    ctx.fillText("HBK", W - 62, 33);

    if (avatarUrl) {
        try {
            const avatar = await loadImage(avatarUrl);
            const ax = W - 78, ay = 95, ar = 30;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ax, ay, ar, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(ax, ay, ar + 2, 0, Math.PI * 2);
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2;
            ctx.stroke();
        } catch(e) {}
    }

    ctx.fillStyle = "#c8a415";
    ctx.beginPath();
    ctx.roundRect(28, 98, 52, 38, 5);
    ctx.fill();
    ctx.strokeStyle = "#a88010";
    ctx.lineWidth = 0.8;
    [[28,107,80,107], [28,117,80,117], [28,127,80,127], [44,98,44,136], [58,98,58,136]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    ctx.fillStyle = "#e8c020";
    ctx.fillRect(44, 107, 14, 20);

    const cardNum = cardData?.cardNumber || "4532 **** **** 5772";
    ctx.fillStyle = "#e8e8e8";
    ctx.font = "bold 22px 'Courier New'";
    ctx.letterSpacing = "2px";
    ctx.fillText(cardNum, 28, 180);
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("VALID", 28, 202);
    ctx.fillText("THRU", 28, 212);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Courier New'";
    ctx.fillText(cardData?.cardExpiry || "12/28", 28, 225);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 15px 'Courier New'";
    ctx.fillText(username.toUpperCase().substring(0, 24), 28, 265);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("CARDHOLDER", 28, 277);

    ctx.fillStyle = "rgba(212,175,55,0.12)";
    ctx.beginPath();
    ctx.roundRect(W - 220, H - 100, 205, 82, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(212,175,55,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("SOLDE", W - 210, H - 80);
    ctx.fillStyle = "#d4af37";
    ctx.font = `bold ${balance.length > 10 ? "16" : "22"}px 'Courier New'`;
    ctx.fillText(`${balance}$`, W - 210, H - 57);

    if (subtitle) {
        ctx.fillStyle = "#88ff88";
        ctx.font = "11px 'Courier New'";
        ctx.fillText(subtitle.substring(0, 28), W - 210, H - 38);
    }
    if (note) {
        ctx.fillStyle = "#aaaaaa";
        ctx.font = "10px 'Courier New'";
        ctx.fillText(note.substring(0, 28), W - 210, H - 22);
    }

    if (cvv) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "8px 'Courier New'";
        ctx.fillText("CVV", W - 210, 115);
        ctx.fillStyle = "#d4af37";
        ctx.font = "bold 14px 'Courier New'";
        ctx.fillText(String(cvv), W - 210, 130);
    }

    ctx.fillStyle = "rgba(212,175,55,0.5)";
    ctx.font = "10px 'Courier New'";
    ctx.fillText(title.toUpperCase(), W - 210, H - 8);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, H - 20, W, 20);
    ctx.fillStyle = "rgba(212,175,55,0.4)";
    ctx.font = "8px 'Courier New'";
    const date = new Date();
    ctx.fillText(`HEDGEHOG BANK • PREMIUM • ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`, W / 2 - 145, H - 6);

    return canvas.toBuffer("image/png");
}

async function generateCasinoCard(opts = {}) {
    const { username = "USER", win = false, choice = "", result = "", amount = "0", winAmount = "0", balance = "0", mode = "gamble" } = opts;
    const W = 640, H = 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d0005");
    bg.addColorStop(0.5, "#200010");
    bg.addColorStop(1, "#0a0003");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(0,80,30,0.15)";
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, W * 0.45, H * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,120,50,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = win ? "#00ff88" : "#ff4444";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(6, 6, W - 12, H - 12, 14);
    ctx.stroke();

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    const modeTitle = mode === "gamble" ? "HEDGEHOG CASINO" : mode === "lottery" ? "HEDGEHOG LOTTERY" : "HEDGEHOG CASINO";
    ctx.fillText(modeTitle, 28, 42);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText(mode === "gamble" ? "PILE OU FACE" : mode === "lottery" ? "LUCKY DRAW" : "ROULETTE", 28, 56);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Courier New'";
    ctx.fillText(username.toUpperCase().substring(0, 20), 28, 90);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("JOUEUR", 28, 103);

    if (mode === "gamble") {
        const coinX = W / 2, coinY = H / 2 - 10;
        ctx.fillStyle = result === "pile" ? "#d4af37" : "#c0c0c0";
        ctx.beginPath();
        ctx.arc(coinX, coinY, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = result === "pile" ? "#a08010" : "#909090";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 16px 'Courier New'";
        ctx.textAlign = "center";
        ctx.fillText(result === "pile" ? "PILE" : "FACE", coinX, coinY + 6);
        ctx.textAlign = "left";

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "11px 'Courier New'";
        ctx.fillText(`Votre choix : ${choice.toUpperCase()}`, 28, 155);
        ctx.fillText(`Résultat    : ${result.toUpperCase()}`, 28, 172);
    }

    ctx.fillStyle = win ? "#00ff88" : "#ff4444";
    ctx.font = "bold 22px 'Courier New'";
    ctx.fillText(win ? "✓ GAGNÉ !" : "✗ PERDU !", 28, 215);

    ctx.fillStyle = win ? "#88ffaa" : "#ff8888";
    ctx.font = "15px 'Courier New'";
    ctx.fillText(win ? `+ ${winAmount}$` : `- ${amount}$`, 28, 240);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText(`${balance}$`, W - 230, H - 40);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("NOUVEAU SOLDE", W - 230, H - 25);

    const date = new Date();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText(`${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`, W - 100, H - 10);

    return canvas.toBuffer("image/png");
}

async function sendWithCard(message, bodyLines, cardOpts, imageMode) {
    const body = S(bodyLines);
    if (!imageMode) return message.reply(body);
    try {
        const img = await generateBankCard(cardOpts);
        const imgPath = path.join(__dirname, `bank_tmp_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
        fs.writeFileSync(imgPath, img);
        await message.reply({ body, attachment: fs.createReadStream(imgPath) });
        fs.unlinkSync(imgPath);
    } catch(e) {
        console.error("Card gen error:", e.message);
        await message.reply(body);
    }
}

async function sendWithCasino(message, bodyLines, casinoOpts, imageMode) {
    const body = S(bodyLines);
    if (!imageMode) return message.reply(body);
    try {
        const img = await generateCasinoCard(casinoOpts);
        const imgPath = path.join(__dirname, `casino_tmp_${Date.now()}.png`);
        fs.writeFileSync(imgPath, img);
        await message.reply({ body, attachment: fs.createReadStream(imgPath) });
        fs.unlinkSync(imgPath);
    } catch(e) {
        console.error("Casino gen error:", e.message);
        await message.reply(body);
    }
}

function formatStyledMessage(contentLines) {
    let msg = `╭─────────────•┈┈\n`;
    for (const line of contentLines) {
        const wrapped = wrapText(line, 42);
        for (const w of wrapped) {
            msg += `│ ${w}\n`;
        }
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

module.exports = {
    config: {
        name: "bank",
        description: "Hedgehog Bank - Système bancaire complet",
        guide: { en: "bank deposit|withdraw|balance|transfer|gamble|lottery|parrainage|rob|vip|loan|save|shop|gift|stats|daily|invest|leaderboard|history|top|interest|card|image" },
        category: "economy",
        countDown: 2,
        role: 0,
        author: "Ismael Soma"
    },

    onStart: async function ({ args, message, event, api }) {
        const { getPrefix } = global.utils;
        const p = getPrefix(event.threadID);
        const user = String(event.senderID);
        
        let userInfo;
        try {
            userInfo = await api.getUserInfo(user);
        } catch(e) {
            userInfo = {};
        }
        const username = userInfo[user]?.name || "Utilisateur";
        const isVip = vipList.includes(user);

        let bankRes = await apiCall(`/${user}`);
        let bankData = bankRes.success ? bankRes.data : { bank: "0", card: null, dailyStreak: 0, totalInvested: "0", parrainCount: 0, lastDaily: 0, savings: { amount: "0", releaseDate: 0 }, loans: [] };
        const imageMode = bankData.imageMode !== false;

        async function getAvatar(uid) {
            try {
                const info = await api.getUserInfo(uid);
                return info[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
            } catch(e) { return null; }
        }

        async function getName(uid) {
            try { 
                const info = await api.getUserInfo(uid); 
                return info[uid]?.name || uid; 
            } catch(e) { return uid; }
        }

        async function parseAmount(input) {
            if (!input) return 0n;
            const str = String(input).toLowerCase().trim();
            const match = str.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/i);
            if (!match) return 0n;
            const val = parseFloat(match[1]);
            const sfx = match[2];
            if (isNaN(val)) return 0n;
            const base = toBigInt(Math.floor(val));
            if (!sfx) return base;
            const SFX = {
                k: 1000n, m: 1000000n, md: 1000000000n, b: 1000000000n,
                tr: 10n**12n, qd: 10n**15n, qin: 10n**18n, sxt: 10n**21n,
                sep: 10n**24n, oct: 10n**27n, non: 10n**30n, de: 10n**33n,
                ud: 10n**36n, dq: 10n**39n, dz: 10n**42n, qs: 10n**45n,
                qo: 10n**48n, qt: 10n**51n, nodc: 10n**60n, ocdc: 10n**57n,
                spdc: 10n**54n,
                qa: 10n**75n, qi: 10n**78n, sx: 10n**81n, sp: 10n**84n,
                oc: 10n**87n, no: 10n**90n, dc: 10n**93n,
            };
            if (SFX[sfx]) return base * SFX[sfx];
            return base;
        }

        const cmd = args[0]?.toLowerCase();

        const pending = pendingTransactions.get(user);
        if (pending && /^\d{3,6}$/.test(cmd || "")) {
            const cvv = parseInt(cmd);
            clearPending(user);
            if (cvv !== bankData.card?.cardCvv)
                return message.reply(S(["❌ CVV incorrect !", "Transaction annulée."]));

            const amount = getPendingAmount(pending);
            const avatarUrl = await getAvatar(user);

            if (pending.type === "deposit") {
                const cash = await getCash(user);
                if (amount > cash)
                    return message.reply(S(["❌ Solde cash insuffisant.", `💰 Poche : ${await formatNumber(cash)}$`, `🎯 Montant : ${await formatNumber(amount)}$`]));
                const result = await apiCall(`/${user}/deposit`, "POST", { amount: amount.toString(), cvv });
                if (result.success) {
                    await addCash(user, -amount);
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    await sendWithCard(message,
                        ["✅ Dépôt effectué !", "---", `➕ +${await formatNumber(amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                        { title: "DEPOSIT", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(amount)}$`, theme: "dark" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ Erreur : ${result.error || "Dépôt échoué"}`]));
                }
            } else if (pending.type === "withdraw") {
                const bal = toBigInt(bankData.bank);
                if (amount > bal)
                    return message.reply(S(["❌ Solde bancaire insuffisant.", `💰 Banque : ${await formatNumber(bal)}$`]));
                const result = await apiCall(`/${user}/withdraw`, "POST", { amount: amount.toString(), cvv });
                if (result.success) {
                    await addCash(user, amount);
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    await sendWithCard(message,
                        ["💸 Retrait effectué !", "---", `➖ -${await formatNumber(amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                        { title: "WITHDRAW", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `- ${await formatNumber(amount)}$`, theme: "dark" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ Erreur : ${result.error || "Retrait échoué"}`]));
                }
            } else if (pending.type === "transfer") {
                const bal = toBigInt(bankData.bank);
                if (amount > bal)
                    return message.reply(S(["❌ Solde bancaire insuffisant."]));
                const result = await apiCall(`/${user}/transfer`, "POST", { targetId: pending.targetId, amount: amount.toString(), cvv });
                if (result.success) {
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    await sendWithCard(message,
                        ["💸 Transfert réussi !", "---", `🎯 Vers : ${pending.targetName}`, `➖ -${await formatNumber(amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                        { title: "TRANSFER", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `→ ${pending.targetName}`, note: `- ${await formatNumber(amount)}$`, theme: "dark" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ Erreur : ${result.error || "Transfert échoué"}`]));
                }
            } else if (pending.type === "gift") {
                const result = await apiCall(`/${user}/transfer`, "POST", { targetId: pending.targetId, amount: amount.toString(), cvv: bankData.card?.cardCvv });
                if (result.success) {
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    await sendWithCard(message,
                        ["🎁 CADEAU ENVOYÉ !", "---", `🎯 À : ${pending.targetName}`, `💝 Montant : ${await formatNumber(amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                        { title: "GIFT", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `🎁 ${await formatNumber(amount)}$ offert`, theme: "purple" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ Erreur : ${result.error || "Cadeau échoué"}`]));
                }
            }
            return;
        }

        switch (cmd) {
            case "deposit": {
                const amount = await parseAmount(args[1]);
                if (amount <= 0n) return message.reply(S(["❌ Montant invalide.", `📝 ${p}bank deposit <montant>`]));
                if (!bankData.card?.cardCreated) return message.reply(S([`❌ Créez d'abord une carte`, `📝 ${p}bank card`]));
                const cash = await getCash(user);
                if (amount > cash) return message.reply(S(["❌ Solde cash insuffisant.", `💰 Poche : ${await formatNumber(cash)}$`, `🎯 Montant : ${await formatNumber(amount)}$`]));
                setPending(user, { amount: amount.toString(), type: "deposit" }, () => message.reply(S(["⏰ Transaction expirée."])));
                return message.reply(S([`💳 Dépôt de ${await formatNumber(amount)}$`, "---", "🔐 Entrez votre CVV pour confirmer", "📝 Exemple : bank 123", "⏰ 20 secondes"]));
            }

            case "withdraw": {
                const amount = await parseAmount(args[1]);
                if (amount <= 0n) return message.reply(S(["❌ Montant invalide.", `📝 ${p}bank withdraw <montant>`]));
                if (!bankData.card?.cardCreated) return message.reply(S([`❌ Créez d'abord une carte.`]));
                if (amount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde bancaire insuffisant.", `💰 Banque : ${await formatNumber(bankData.bank)}$`]));
                setPending(user, { amount: amount.toString(), type: "withdraw" }, () => message.reply(S(["⏰ Transaction expirée."])));
                return message.reply(S([`💳 Retrait de ${await formatNumber(amount)}$`, "---", "🔐 Entrez votre CVV pour confirmer", "⏰ 20 secondes"]));
            }

            case "balance":
            case "show": {
                const cash = await getCash(user);
                const bal = toBigInt(bankData.bank);
                const avatarUrl = await getAvatar(user);
                await sendWithCard(message,
                    ["💰 VOS SOLDES", "---", `🏦 Banque : ${await formatNumber(bal)}$`, `💵 Poche : ${await formatNumber(cash)}$`, isVip ? "⭐ Statut : VIP" : "👤 Statut : Standard"],
                    { title: "BALANCE", balance: await formatNumber(bal), username, cardData: bankData.card, avatarUrl, subtitle: `Poche: ${await formatNumber(cash)}$`, theme: "dark" },
                    imageMode
                );
                break;
            }

            case "card": {
                const result = await apiCall(`/${user}/card`, "POST");
                if (!result.success) return message.reply(S([`❌ ${result.error || "Erreur création carte"}`]));
                const cardData = result.data;
                bankData.card = cardData;
                const avatarUrl = await getAvatar(user);
                await sendWithCard(message,
                    ["💳 VOTRE CARTE BANCAIRE", "---", `🏦 N° : ${cardData.cardNumber}`, `📅 Exp : ${cardData.cardExpiry}`, `🔐 CVV : ${cardData.cardCvv}`, "---", "⚠️ Gardez votre CVV secret !"],
                    { title: "MY CARD", balance: await formatNumber(toBigInt(bankData.bank)), username, cardData: cardData, cvv: cardData.cardCvv, avatarUrl, theme: "gold" },
                    imageMode
                );
                break;
            }

            case "transfer":
            case "send": {
                const targetId = Object.keys(event.mentions)[0] || args[1];
                const amount = await parseAmount(args[2]);
                if (!targetId || targetId === user) return message.reply(S(["❌ Cible invalide.", `📝 ${p}bank transfer @mention <montant>`]));
                if (amount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                if (!bankData.card?.cardCreated) return message.reply(S([`❌ Créez d'abord une carte.`]));
                if (amount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde insuffisant."]));
                const targetName = await getName(targetId);
                setPending(user, { amount: amount.toString(), type: "transfer", targetId, targetName }, () => message.reply(S(["⏰ Transfert expiré."])));
                return message.reply(S([`💸 Transfert de ${await formatNumber(amount)}$`, `🎯 Vers : ${targetName}`, "---", "🔐 Entrez votre CVV pour confirmer", "⏰ 20 secondes"]));
            }

            case "interest": {
                if (toBigInt(bankData.bank) <= 0n) return message.reply(S(["❌ Pas d'argent en banque."]));
                const result = await apiCall(`/${user}/interest`, "POST");
                if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                bankData = (await apiCall(`/${user}`)).data || bankData;
                const earned = toBigInt(result.interestEarned);
                const avatarUrl = await getAvatar(user);
                await sendWithCard(message,
                    ["📈 Intérêts crédités !", "---", `✨ Gain : +${await formatNumber(earned)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                    { title: "INTEREST", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(earned)}$`, theme: "green" },
                    imageMode
                );
                break;
            }

            case "top":
            case "richest": {
                const result = await apiCall("/top");
                if (!result.success || !result.data?.length)
                    return message.reply(S(["👑 Classement vide.", "Faites bank card pour commencer !"]));
                const medals = ["🥇", "🥈", "🥉"];
                const lines = ["👑 TOP BANQUE", "---"];
                for (let i = 0; i < Math.min(result.data.length, 15); i++) {
                    const userEntry = result.data[i];
                    const name = await getName(userEntry.userId);
                    const bal = await formatNumber(userEntry.bank || "0");
                    lines.push(`${medals[i] || `${i + 1}.`} ${name}`);
                    lines.push(`   💰 ${bal}$`);
                }
                return message.reply(S(lines));
            }

            case "gamble":
            case "bet": {
                const sub = args[1]?.toLowerCase();
                if (!sub || sub === "help")
                    return message.reply(S(["🎰 GAMBLE — PILE OU FACE", "---", `📝 ${p}bank gamble play <montant> <pile/face>`]));
                if (sub !== "play") break;
                const amount = await parseAmount(args[2]);
                const choice = args[3]?.toLowerCase();
                if (amount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                if (!["pile", "face"].includes(choice)) return message.reply(S(["❌ Choisissez pile ou face."]));
                if (amount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde insuffisant."]));
                const result = await apiCall(`/${user}/gamble`, "POST", { amount: amount.toString(), choice });
                if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                bankData = (await apiCall(`/${user}`)).data || bankData;
                const win = result.win;
                const resChoice = result.result;
                const winAmount = toBigInt(result.winAmount);
                await sendWithCasino(message,
                    [win ? "🎉 VICTOIRE AU GAMBLE !" : "💀 PERDU AU GAMBLE", "---",
                        `🪙 Votre choix : ${choice.toUpperCase()}`,
                        `🎲 Résultat : ${resChoice.toUpperCase()}`,
                        win ? `✨ Gain : +${await formatNumber(winAmount)}$` : `📉 Perte : -${await formatNumber(amount)}$`,
                        `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                    { username, win, choice, result: resChoice, amount: await formatNumber(amount), winAmount: await formatNumber(winAmount), balance: await formatNumber(bankData.bank), mode: "gamble" },
                    imageMode
                );
                break;
            }

            case "lottery": {
                const sub = args[1]?.toLowerCase();
                if (!sub || sub === "help")
                    return message.reply(S(["🎲 LOTERIE", "---", `📝 ${p}bank lottery play <montant>`, "🎁 Gains : x2 (2/3), x10 (3/3), x100 (jackpot)"]));
                if (sub !== "play") break;
                const ticket = await parseAmount(args[2]);
                if (ticket <= 0n) return message.reply(S(["❌ Montant invalide."]));
                const cash = await getCash(user);
                if (ticket > cash) return message.reply(S(["❌ Solde cash insuffisant.", `💰 Poche : ${await formatNumber(cash)}$`]));
                const result = await apiCall(`/${user}/lottery`, "POST", { ticketPrice: ticket.toString() });
                if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                const netChange = result.win ? toBigInt(result.winAmount) - ticket : -ticket;
                await addCash(user, netChange);
                bankData = (await apiCall(`/${user}`)).data || bankData;
                const winAmount = toBigInt(result.winAmount || "0");
                await sendWithCasino(message,
                    [result.win ? "🎉 VICTOIRE À LA LOTERIE !" : "💀 PERDU À LA LOTERIE", "---",
                        `🔢 Vos numéros : ${result.userNumbers?.join(" - ")}`,
                        `🎲 Tirés : ${result.drawnNumbers?.join(" - ")}`,
                        `✅ Correspondances : ${result.matchCount}/3`,
                        result.win ? `✨ Gain : +${await formatNumber(winAmount)}$ (x${result.multiplier})` : `📉 Perte : -${await formatNumber(ticket)}$`],
                    { username, win: result.win, amount: await formatNumber(ticket), winAmount: await formatNumber(winAmount), balance: await formatNumber(bankData.bank), mode: "lottery" },
                    imageMode
                );
                break;
            }

            case "parrainage":
            case "parrain": {
                const sub = args[1]?.toLowerCase();
                if (!sub || sub === "help")
                    return message.reply(S(["🎁 PARRAINAGE", "---", `📝 ${p}bank parrainage creer`, `📝 ${p}bank parrainage utiliser <code>`, "🎁 Parrain: +5000$ | Parrainé: +10000$"]));
                if (sub === "creer" || sub === "create") {
                    const result = await apiCall(`/${user}/parrain/create`, "POST");
                    if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                    return message.reply(S(["🎁 CODE CRÉÉ !", "---", `🔑 ${result.code}`, "---", "📝 Partagez ce code à vos amis !"]));
                }
                if (sub === "utiliser" || sub === "use") {
                    const code = args[2];
                    if (!code) return message.reply(S(["❌ Code manquant."]));
                    const result = await apiCall(`/${user}/parrain/use`, "POST", { code });
                    if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    return message.reply(S(["🎉 Parrainage réussi !", "---", `🎁 Bonus : +10000$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`]));
                }
                break;
            }

            case "history": {
                const limit = Math.min(parseInt(args[1]) || 10, 20);
                const result = await apiCall(`/${user}/transactions?limit=${limit}`);
                if (!result.success || !result.data?.length)
                    return message.reply(S(["📜 Aucune transaction.", "Faites des opérations pour voir l'historique !"]));
                const emojiMap = { deposit: "⬆️", withdraw: "⬇️", interest: "📈", transfer_sent: "💸", transfer_received: "💰", gamble_win: "🎉", gamble_lose: "💀", lottery_win: "🎉", lottery_lose: "💀", rob_sent: "🦹", rob_received: "😱" };
                const lines = [`📜 HISTORIQUE (${result.data.length})`, "---"];
                for (const tx of result.data) {
                    const emoji = emojiMap[tx.type] || "💱";
                    const amt = toBigInt(tx.amount);
                    const sign = amt >= 0n ? "+" : "";
                    const date = new Date(tx.date).toLocaleString("fr-FR");
                    lines.push(`${emoji} ${tx.type}`);
                    lines.push(`   ${sign}${await formatNumber(amt)}$ | ${date}`);
                }
                return message.reply(S(lines));
            }

            case "rob": {
                if (!isVip) return message.reply(S(["❌ Seuls les VIP peuvent utiliser rob !", `📝 Contactez un admin`]));
                const targetId = Object.keys(event.mentions)[0] || args[1];
                if (!targetId || targetId === user) return message.reply(S(["❌ Cible invalide.", `📝 ${p}bank rob @mention <montant>`, "⚠️ 50% de chance de réussir"]));
                const targetBankRes = await apiCall(`/${targetId}`);
                const targetBal = toBigInt(targetBankRes.data?.bank || "0");
                if (targetBal <= 0n) return message.reply(S(["❌ Cette personne n'a rien en banque."]));
                let amount = await parseAmount(args[2]);
                if (amount <= 0n) {
                    const percentage = Math.random() * 0.15 + 0.05;
                    amount = toBigInt(Math.floor(Number(targetBal) * percentage)) || 1n;
                }
                if (amount > targetBal) amount = targetBal;
                const targetName = await getName(targetId);
                const success = Math.random() < 0.5;
                if (!success) {
                    return message.reply(S(["🛡️ VOL ÉCHOUÉ !", "---", `🎯 Cible : ${targetName}`, `💵 Tentative : ${await formatNumber(amount)}$`, "❌ Vous avez été repéré !"]));
                }
                const result = await apiCall(`/${user}/rob`, "POST", { targetId, amount: amount.toString() });
                if (!result.success) return message.reply(S([`❌ ${result.error || "Erreur technique"}`]));
                bankData = (await apiCall(`/${user}`)).data || bankData;
                const avatarUrl = await getAvatar(user);
                await sendWithCard(message,
                    ["🦹 VOL RÉUSSI !", "---", `🎯 Cible : ${targetName}`, `💰 Volé : +${await formatNumber(amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                    { title: "ROB", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(amount)}$ volé`, theme: "purple" },
                    imageMode
                );
                break;
            }

            case "vip": {
                const sub = args[1]?.toLowerCase();
                if (sub === "list") {
                    if (!vipList.length) return message.reply(S(["👑 Aucun VIP pour l'instant."]));
                    const lines = [`👑 VIP (${vipList.length})`, "---"];
                    for (let i = 0; i < vipList.length; i++) lines.push(`⭐ ${i + 1}. ${await getName(vipList[i])}`);
                    return message.reply(S(lines));
                }
                if (sub === "-a") {
                    if (user !== BOT_ADMIN) return message.reply(S(["❌ Accès refusé."]));
                    const uid = args[2];
                    if (!uid) return message.reply(S(["❌ UID manquant."]));
                    if (vipList.includes(uid)) return message.reply(S(["⚠️ Déjà VIP."]));
                    vipList.push(uid);
                    saveVIPs();
                    return message.reply(S([`✅ ${await getName(uid)} ajouté aux VIP.`]));
                }
                if (sub === "-r") {
                    if (user !== BOT_ADMIN) return message.reply(S(["❌ Accès refusé."]));
                    const uid = args[2];
                    const index = vipList.indexOf(uid);
                    if (index === -1) return message.reply(S(["❌ Pas dans la liste VIP."]));
                    vipList.splice(index, 1);
                    saveVIPs();
                    return message.reply(S([`✅ ${uid} retiré des VIP.`]));
                }
                return message.reply(S([isVip ? "⭐ Vous êtes VIP !" : "👤 Vous n'êtes pas VIP", "---", "Avantages VIP :", "🦹 Accès à bank rob", `📝 ${p}bank vip list → Liste VIP`]));
            }

            case "image": {
                const sub = args[1]?.toLowerCase();
                if (sub === "on") return message.reply(S(["🖼️ Mode carte activé."]));
                if (sub === "off") return message.reply(S(["📝 Mode texte activé."]));
                return message.reply(S([`🖼️ ${p}bank image on/off`]));
            }

            case "loan": {
                const loanAmount = await parseAmount(args[1]);
                if (loanAmount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                const maxLoan = toBigInt(bankData.bank) * 5n;
                if (loanAmount > maxLoan) return message.reply(S([`❌ Emprunt max : ${await formatNumber(maxLoan)}$`]));
                const interest = loanAmount * 10n / 100n;
                const totalToPay = loanAmount + interest;
                const result = await apiCall(`/${user}/loan`, "POST", { amount: loanAmount.toString() });
                if (result.success) {
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    const avatarUrl = await getAvatar(user);
                    await sendWithCard(message,
                        ["💰 EMPRUNT CONTRACTÉ", "---", `🏦 Montant : +${await formatNumber(loanAmount)}$`, `📈 Intérêts : ${await formatNumber(interest)}$`, `💳 Total à rembourser : ${await formatNumber(totalToPay)}$`],
                        { title: "LOAN", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(loanAmount)}$ emprunté`, theme: "gold" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ ${result.error}`]));
                }
                break;
            }

            case "save": {
                const saveAmount = await parseAmount(args[1]);
                if (saveAmount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                if (!bankData.savings) bankData.savings = { amount: "0", releaseDate: 0 };
                if (saveAmount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde insuffisant."]));
                const result = await apiCall(`/${user}/save`, "POST", { amount: saveAmount.toString() });
                if (result.success) {
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    const avatarUrl = await getAvatar(user);
                    await sendWithCard(message,
                        ["🏦 ÉPARGNE BLOQUÉE", "---", `💰 Montant épargné : +${await formatNumber(saveAmount)}$`, `📅 Libération dans 7 jours`, `🎁 Intérêts : +5% à maturité`],
                        { title: "SAVINGS", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(saveAmount)}$`, theme: "green" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ ${result.error}`]));
                }
                break;
            }

            case "shop": {
                const items = [
                    { id: 1, name: "VIP", price: 50000000n, desc: "Accès à bank rob" },
                    { id: 2, name: "Double XP", price: 1000000n, desc: "Double gains pendant 24h" },
                    { id: 3, name: "Couleur Carte", price: 100000n, desc: "Change la couleur de ta carte" }
                ];
                if (!args[1]) {
                    const shopMsg = ["🛒 BOUTIQUE", "---"];
                    for (const item of items) {
                        shopMsg.push(`${item.id}. ${item.name} - ${await formatNumber(item.price)}$`);
                        shopMsg.push(`   ${item.desc}`);
                    }
                    shopMsg.push("---", `📝 Utilisation : ${p}bank shop buy <id>`);
                    return message.reply(S(shopMsg));
                }
                if (args[1] === "buy") {
                    const itemId = parseInt(args[2]);
                    const item = items.find(i => i.id === itemId);
                    if (!item) return message.reply(S(["❌ Article invalide."]));
                    if (toBigInt(bankData.bank) < item.price) return message.reply(S(["❌ Solde insuffisant."]));
                    const result = await apiCall(`/${user}/shop/buy`, "POST", { itemId: item.id });
                    if (result.success) {
                        bankData = (await apiCall(`/${user}`)).data || bankData;
                        if (item.name === "VIP" && !vipList.includes(user)) {
                            vipList.push(user);
                            saveVIPs();
                        }
                        return message.reply(S([`✅ Achat effectué !`, `🛒 ${item.name} ajouté à votre compte.`]));
                    } else {
                        return message.reply(S([`❌ ${result.error}`]));
                    }
                }
                break;
            }

            case "gift": {
                const targetId = Object.keys(event.mentions)[0] || args[1];
                const giftAmount = await parseAmount(args[2]);
                if (!targetId || targetId === user) return message.reply(S(["❌ Destinataire invalide."]));
                if (giftAmount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                if (giftAmount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde insuffisant."]));
                const targetName = await getName(targetId);
                setPending(user, { amount: giftAmount.toString(), type: "gift", targetId, targetName }, () => message.reply(S(["⏰ Cadeau annulé."])));
                return message.reply(S([`🎁 Cadeau de ${await formatNumber(giftAmount)}$ à ${targetName}`, "---", "✅ Confirmez avec votre CVV", "📝 Exemple: bank 123", "⏰ 20 secondes"]));
            }

            case "confirm": {
                const pendingTrans = pendingTransactions.get(user);
                if (!pendingTrans) return message.reply(S(["❌ Aucune transaction en attente."]));
                const cvv = parseInt(args[1]);
                if (isNaN(cvv) || cvv !== bankData.card?.cardCvv) return message.reply(S(["❌ CVV incorrect !"]));
                if (pendingTrans.type === "gift") {
                    const result = await apiCall(`/${user}/transfer`, "POST", { targetId: pendingTrans.targetId, amount: pendingTrans.amount, cvv });
                    if (result.success) {
                        bankData = (await apiCall(`/${user}`)).data || bankData;
                        clearPending(user);
                        const avatarUrl = await getAvatar(user);
                        await sendWithCard(message,
                            ["🎁 CADEAU ENVOYÉ !", "---", `🎯 À : ${pendingTrans.targetName}`, `💝 Montant : ${await formatNumber(pendingTrans.amount)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                            { title: "GIFT", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `🎁 ${await formatNumber(pendingTrans.amount)}$ offert`, theme: "purple" },
                            imageMode
                        );
                    } else {
                        return message.reply(S([`❌ Erreur : ${result.error || "Cadeau échoué"}`]));
                    }
                }
                break;
            }

            case "stats": {
                const result = await apiCall(`/${user}/transactions?limit=100`);
                let totalSpent = 0n, totalEarned = 0n, winCount = 0, loseCount = 0;
                if (result.success && result.data) {
                    for (const tx of result.data) {
                        const amt = toBigInt(tx.amount);
                        if (amt < 0n) totalSpent += -amt;
                        else totalEarned += amt;
                        if (tx.type === "gamble_win") winCount++;
                        if (tx.type === "gamble_lose") loseCount++;
                    }
                }
                return message.reply(S([
                    "📊 STATISTIQUES", "---",
                    `💰 Total gagné : ${await formatNumber(totalEarned)}$`,
                    `💸 Total dépensé : ${await formatNumber(totalSpent)}$`,
                    `🎰 Gambling : ${winCount} victoires / ${loseCount} défaites`,
                    `🎁 Parrainage : ${bankData.parrainCount || 0} filleuls`
                ]));
            }

            case "daily": {
                const lastDaily = bankData.lastDaily || 0;
                const now = Date.now();
                const dayMs = 86400000;
                if (now - lastDaily < dayMs) {
                    const remaining = Math.ceil((dayMs - (now - lastDaily)) / 3600000);
                    return message.reply(S([`⏰ Bonus déjà réclamé !`, `Prochain dans ${remaining}h`]));
                }
                const result = await apiCall(`/${user}/daily`, "POST");
                if (result.success) {
                    bankData = (await apiCall(`/${user}`)).data || bankData;
                    const reward = toBigInt(result.reward);
                    const streak = result.streak || 1;
                    const avatarUrl = await getAvatar(user);
                    await sendWithCard(message,
                        ["🎁 BONUS QUOTIDIEN", "---", `✨ +${await formatNumber(reward)}$`, `🔥 Streak : ${streak} jours`],
                        { title: "DAILY", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: `+ ${await formatNumber(reward)}$`, theme: "purple" },
                        imageMode
                    );
                } else {
                    return message.reply(S([`❌ ${result.error}`]));
                }
                break;
            }

            case "invest": {
                const investAmount = await parseAmount(args[1]);
                if (investAmount <= 0n) return message.reply(S(["❌ Montant invalide."]));
                if (investAmount > toBigInt(bankData.bank)) return message.reply(S(["❌ Solde insuffisant."]));
                const result = await apiCall(`/${user}/invest`, "POST", { amount: investAmount.toString() });
                if (!result.success) return message.reply(S([`❌ ${result.error}`]));
                bankData = (await apiCall(`/${user}`)).data || bankData;
                const profit = toBigInt(result.profit);
                const avatarUrl = await getAvatar(user);
                await sendWithCard(message,
                    ["📊 INVESTISSEMENT", "---", profit >= 0n ? `📈 +${await formatNumber(profit)}$` : `📉 ${await formatNumber(profit)}$`, `💰 Solde : ${await formatNumber(bankData.bank)}$`],
                    { title: "INVEST", balance: await formatNumber(bankData.bank), username, cardData: bankData.card, avatarUrl, subtitle: profit >= 0n ? `+ ${await formatNumber(profit)}$` : `${await formatNumber(profit)}$`, theme: profit >= 0n ? "green" : "dark" },
                    imageMode
                );
                break;
            }

            case "leaderboard": {
                const result = await apiCall("/leaderboard");
                if (!result.success || !result.data?.length) {
                    return message.reply(S(["🏆 TOP INVESTISSEURS", "---", "Aucun investisseur pour l'instant."]));
                }
                const lines = ["🏆 TOP INVESTISSEURS", "---"];
                for (let i = 0; i < Math.min(result.data.length, 10); i++) {
                    const userEntry = result.data[i];
                    const name = await getName(userEntry.userId);
                    const total = await formatNumber(userEntry.totalInvested || "0");
                    lines.push(`${i + 1}. ${name} - ${total}$`);
                }
                return message.reply(S(lines));
            }

            default: {
                return message.reply(S([
                    "🦔 HEDGEHOG BANK",
                    "━━━━━━━━━━━━━━━",
                    "💰 TRANSACTIONS",
                    `⤷ ${p}bank deposit <montant>`,
                    `⤷ ${p}bank withdraw <montant>`,
                    `⤷ ${p}bank balance`,
                    `⤷ ${p}bank transfer @mention <mnt>`,
                    `⤷ ${p}bank gift @mention <mnt>`,
                    "---",
                    "📈 GAINS",
                    `⤷ ${p}bank interest`,
                    `⤷ ${p}bank gamble play <mnt> <pile/face>`,
                    `⤷ ${p}bank lottery play <mnt>`,
                    `⤷ ${p}bank invest <mnt>`,
                    `⤷ ${p}bank daily`,
                    "---",
                    "🏦 SERVICES",
                    `⤷ ${p}bank loan <mnt>`,
                    `⤷ ${p}bank save <mnt>`,
                    `⤷ ${p}bank shop`,
                    "---",
                    "🎮 SOCIAL",
                    `⤷ ${p}bank rob @mention (VIP)`,
                    `⤷ ${p}bank parrainage creer`,
                    "---",
                    "📊 INFOS",
                    `⤷ ${p}bank history [nb]`,
                    `⤷ ${p}bank top`,
                    `⤷ ${p}bank stats`,
                    `⤷ ${p}bank leaderboard`,
                    `⤷ ${p}bank vip`,
                    "---",
                    "⚙️ AUTRES",
                    `⤷ ${p}bank card`,
                    `⤷ ${p}bank image on/off`,
                ]));
            }
        }
    }
};
