const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const CASH_URL   = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";
const MAX_LIMIT  = 10n ** 261n;

function toBigInt(v) {
    if (typeof v === "bigint") return v;
    if (v === undefined || v === null) return 0n;
    try { return BigInt(String(v).split(".")[0].replace(/[^0-9\-]/g, "") || "0"); }
    catch { return 0n; }
}

async function formatNumber(num) {
    const big = toBigInt(num);
    if (big === 0n) return "0";
    if (big >= MAX_LIMIT || big <= -MAX_LIMIT) return "∞";
    try {
        const r = await axios.get(`${FORMAT_URL}?n=${big.toString()}`, { timeout: 5000 });
        if (r.data?.success) {
            if (r.data.isInfinity) return "∞";
            return r.data.formatted;
        }
    } catch {}
    const suffixes = [
        "", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No",
        "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc",
        "OcDc", "NoDc", "kN", "MN", "BN", "TN", "QaN", "QiN", "SxN",
        "SpN", "OcN", "NoN", "DcN", "UI", "DI", "TI", "QI", "QiI",
        "SxI", "SpI", "OcI", "NoI", "DcI", "UV", "DV", "TV", "QV",
        "QiV", "SxV", "SpV", "OcV", "NoV", "DcV", "UT", "DT", "TT",
        "QT", "QiT", "SxT", "SpT", "OcT", "NoT", "DcT", "UTr", "DTr",
        "TTr", "QTr", "QiTr", "SxTr", "SpTr", "OcTr", "NoTr", "DcTr",
        "UQ", "DQ", "TQ", "QQ", "QiQ", "SxQ", "SpQ", "OcQ", "NoQ",
        "DcQ", "Uc", "Du", "Tu", "Qu", "Qiu"
    ];
    let scaled = big < 0n ? -big : big;
    const neg = big < 0n;
    let suffixIndex = 0;
    const thousand = 1000n;
    while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
        scaled = scaled / thousand;
        suffixIndex++;
    }
    if (suffixIndex === suffixes.length - 1 && scaled >= thousand) return "∞";
    const divisor   = thousand ** BigInt(suffixIndex);
    const remainder = ((neg ? -big : big) % divisor) * 100n / divisor;
    const prefix    = neg ? "-" : "";
    if (suffixIndex > 0 && remainder > 0n) {
        const decStr = remainder.toString().padStart(2, "0").slice(0, 2).replace(/0+$/, "");
        return decStr ? `${prefix}${scaled}.${decStr}${suffixes[suffixIndex]}` : `${prefix}${scaled}${suffixes[suffixIndex]}`;
    }
    if (suffixIndex === 0) return `${prefix}${(neg ? -big : big).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
    return `${prefix}${scaled}${suffixes[suffixIndex]}`;
}

const SFX = {
    k: 1_000n, m: 1_000_000n, b: 1_000_000_000n, t: 1_000_000_000_000n,
    qa: 10n**15n, qi: 10n**18n, sx: 10n**21n, sp: 10n**24n, oc: 10n**27n, no: 10n**30n, dc: 10n**33n,
    udc: 10n**36n, ddc: 10n**39n, tdc: 10n**42n, qadc: 10n**45n, qidc: 10n**48n,
    sxdc: 10n**51n, spdc: 10n**54n, ocdc: 10n**57n, nodc: 10n**60n,
    kn: 10n**63n, mn: 10n**66n, bn: 10n**69n, tn: 10n**72n, qan: 10n**75n, qin: 10n**78n,
    sxn: 10n**81n, spn: 10n**84n, ocn: 10n**87n, non: 10n**90n, dcn: 10n**93n,
    ui: 10n**96n, di: 10n**99n, ti: 10n**102n, qi_i: 10n**105n, qii: 10n**108n,
    sxi: 10n**111n, spi: 10n**114n, oci: 10n**117n, noi: 10n**120n, dci: 10n**123n,
    uv: 10n**126n, dv: 10n**129n, tv: 10n**132n, qv: 10n**135n, qiv: 10n**138n,
    sxv: 10n**141n, spv: 10n**144n, ocv: 10n**147n, nov: 10n**150n, dcv: 10n**153n,
    ut: 10n**156n, dt: 10n**159n, tt: 10n**162n, qt: 10n**165n, qit: 10n**168n,
    sxt: 10n**171n, spt: 10n**174n, oct: 10n**177n, not: 10n**180n, dct: 10n**183n,
    utr: 10n**186n, dtr: 10n**189n, ttr: 10n**192n, qtr: 10n**195n, qitr: 10n**198n,
    sxtr: 10n**201n, sptr: 10n**204n, octr: 10n**207n, notr: 10n**210n, dctr: 10n**213n,
    uq: 10n**216n, dq: 10n**219n, tq: 10n**222n, qq: 10n**225n, qiq: 10n**228n,
    sxq: 10n**231n, spq: 10n**234n, ocq: 10n**237n, noq: 10n**240n, dcq: 10n**243n,
    uc: 10n**246n, du: 10n**249n, tu: 10n**252n, qu: 10n**255n, qiu: 10n**258n,
};

async function parseAmount(input) {
    if (!input) return 0n;
    const str = String(input).toLowerCase().trim();
    try {
        const r = await axios.get(`${FORMAT_URL}?n=${encodeURIComponent(str)}`, { timeout: 5000 });
        if (r.data?.success && r.data?.raw) return toBigInt(r.data.raw);
    } catch {}
    const m = str.match(/^(-?\d+(?:\.\d+)?)([a-zA-Z_]+)?$/i);
    if (!m) return 0n;
    const val  = parseFloat(m[1]);
    const sfx  = (m[2] || "").toLowerCase();
    const base = BigInt(Math.floor(Math.abs(val)));
    const neg  = val < 0;
    if (isNaN(val)) return 0n;
    if (!sfx) return neg ? -base : base;
    const mult = SFX[sfx];
    if (mult) {
        const result = base * mult;
        if (result >= MAX_LIMIT) return neg ? -MAX_LIMIT : MAX_LIMIT;
        return neg ? -result : result;
    }
    return neg ? -base : base;
}

async function getUserCash(uid) {
    try {
        const r = await axios.get(`${CASH_URL}/${uid}`, { timeout: 10000 });
        if (r.data?.success && r.data?.data) {
            const cash = toBigInt(r.data.data.cash);
            return cash >= MAX_LIMIT ? MAX_LIMIT : cash;
        }
    } catch {}
    return 0n;
}

async function updateUserCash(uid, amount) {
    const a = toBigInt(amount);
    try {
        if (a > 0n)      { await axios.post(`${CASH_URL}/${uid}/add`,      { amount: a.toString() }); return true; }
        else if (a < 0n) { await axios.post(`${CASH_URL}/${uid}/subtract`, { amount: (-a).toString() }); return true; }
        return true;
    } catch (e) { console.error("Cash update:", e.message); return false; }
}

function getUserName(uid, api) {
    return new Promise(resolve => {
        api.getUserInfo(uid, (err, data) => {
            const n = data?.[uid]?.name;
            resolve((n && n !== "Facebook User") ? n : `User_${String(uid).slice(-5)}`);
        });
    });
}

async function getUserAvatar(uid, api) {
    try {
        const d = await api.getUserInfo(uid);
        return d[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    } catch { return `https://graph.facebook.com/${uid}/picture?width=200&height=200`; }
}

const GAME_FILE    = "./memory_games.json";
const STATS_FILE   = "./memory_stats.json";
let activeGames    = new Map();
let playerStats    = {};
const gameTimeouts = new Map();

if (fs.existsSync(GAME_FILE)) {
    try {
        const raw = JSON.parse(fs.readFileSync(GAME_FILE, "utf8"));
        for (const [k, v] of Object.entries(raw)) {
            v.bet = BigInt(v.bet);
            activeGames.set(k, v);
        }
    } catch {}
}
if (fs.existsSync(STATS_FILE)) {
    try { playerStats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8")); } catch {}
}

function saveGames() {
    try {
        const obj = {};
        for (const [k, v] of activeGames) obj[k] = { ...v, bet: v.bet.toString() };
        fs.writeFileSync(GAME_FILE, JSON.stringify(obj, null, 2));
    } catch {}
}

function saveStats() {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(playerStats, null, 2)); } catch {}
}

function getPlayerStats(uid) {
    if (!playerStats[uid]) playerStats[uid] = {
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
        totalEarned: "0", totalLost: "0",
        bestTime: null, bestAccuracy: 0,
        bestStreak: 0, totalPairsFound: 0,
    };
    return playerStats[uid];
}

function updatePlayerStats(uid, { win, timeTaken, accuracy, streak, pairsFound, earned, lost }) {
    const s = getPlayerStats(uid);
    s.gamesPlayed++;
    if (win) {
        s.gamesWon++;
        s.totalEarned = (toBigInt(s.totalEarned) + toBigInt(earned)).toString();
        if (s.bestTime === null || timeTaken < s.bestTime) s.bestTime = timeTaken;
    } else {
        s.gamesLost++;
        s.totalLost = (toBigInt(s.totalLost) + toBigInt(lost)).toString();
    }
    if (accuracy > s.bestAccuracy) s.bestAccuracy = accuracy;
    if (streak > s.bestStreak)     s.bestStreak   = streak;
    s.totalPairsFound += pairsFound;
    saveStats();
}

const TIME_LIMIT = 600;

const DIFFICULTIES = {
    facile:   { cols: 4, pairs: 8,  multiplier: 2, bonusSpeed: 300, bonusMult: 3  },
    normal:   { cols: 4, pairs: 8,  multiplier: 3, bonusSpeed: 240, bonusMult: 5  },
    difficile:{ cols: 5, pairs: 10, multiplier: 5, bonusSpeed: 180, bonusMult: 8  },
    extreme:  { cols: 6, pairs: 12, multiplier: 8, bonusSpeed: 120, bonusMult: 15 },
};

const CARD_THEMES = {
    animaux:  ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮"],
    fruits:   ["🍎","🍊","🍋","🍇","🍓","🫐","🍑","🍒","🥭","🍍","🥝","🍈"],
    espace:   ["🌍","🌙","⭐","☀️","🪐","🌠","🌌","🚀","🛸","🌟","💫","🌑"],
    casino:   ["🎰","🎲","🃏","🎴","🀄","🎯","🎳","🎮","🕹️","🎱","🎭","🎪"],
    nature:   ["🌸","🌺","🌻","🌹","🌷","🍀","🌿","🍃","🌱","🌾","🍂","🍁"],
    sport:    ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🏹"],
    pays:     ["🇫🇷","🇺🇸","🇯🇵","🇧🇷","🇩🇪","🇮🇹","🇪🇸","🇬🇧","🇨🇳","🇷🇺","🇦🇺","🇰🇷"],
    food:     ["🍕","🍔","🌮","🍜","🍣","🍩","🎂","🍦","🧁","🥗","🍱","🥩"],
};

const DIFFICULTY_COLORS = {
    facile:    "#22c55e",
    normal:    "#3b82f6",
    difficile: "#f59e0b",
    extreme:   "#ef4444",
};

const EMOJI_GLOW_COLORS = {
    "🐶":"#f59e0b","🐱":"#f97316","🐭":"#94a3b8","🐹":"#fb923c","🐰":"#f9a8d4","🦊":"#f97316",
    "🐻":"#92400e","🐼":"#e2e8f0","🐨":"#94a3b8","🐯":"#f59e0b","🦁":"#d97706","🐮":"#fbbf24",
    "🍎":"#ef4444","🍊":"#f97316","🍋":"#fbbf24","🍇":"#7c3aed","🍓":"#f43f5e","🫐":"#3b82f6",
    "🍑":"#fb923c","🍒":"#dc2626","🥭":"#f59e0b","🍍":"#84cc16","🥝":"#65a30d","🍈":"#a3e635",
    "🌍":"#22c55e","🌙":"#fbbf24","⭐":"#fde047","☀️":"#f59e0b","🪐":"#f97316","🌠":"#818cf8",
    "🚀":"#60a5fa","🛸":"#a78bfa","🌟":"#fde047","💫":"#fbbf24",
    "🎰":"#fbbf24","🎲":"#ef4444","🃏":"#e2e8f0","🎯":"#ef4444","🎮":"#818cf8","🎱":"#1e293b",
    "⚽":"#e2e8f0","🏀":"#f97316","🏈":"#92400e","⚾":"#e2e8f0","🎾":"#84cc16","🏐":"#fbbf24",
    "🍕":"#f97316","🍔":"#d97706","🌮":"#f59e0b","🍜":"#fbbf24","🍣":"#ef4444","🍩":"#f9a8d4",
    "🌸":"#f9a8d4","🌺":"#f43f5e","🌻":"#fbbf24","🌹":"#ef4444","🌷":"#ec4899","🍀":"#22c55e",
};

function getEmojiGlow(emoji) {
    return EMOJI_GLOW_COLORS[emoji] || "#818cf8";
}

function createBoard(difficulty, theme) {
    const diff     = DIFFICULTIES[difficulty];
    const symbols  = CARD_THEMES[theme] || CARD_THEMES.animaux;
    const selected = symbols.slice(0, diff.pairs);
    const all      = [...selected, ...selected];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
}

function parseCoord(input, cols, rows) {
    const str = String(input).toUpperCase().trim();
    const m   = str.match(/^([A-Z])(\d+)$/);
    if (!m) return null;
    const col = m[1].charCodeAt(0) - 65;
    const row = parseInt(m[2]) - 1;
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { row, col, index: row * cols + col };
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function timeStr(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

async function generateBoardImage({ game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase }) {
    const diff      = DIFFICULTIES[game.difficulty];
    const diffColor = DIFFICULTY_COLORS[game.difficulty] || "#818cf8";
    const cols      = game.cols;
    const rows      = Math.ceil(game.board.length / cols);
    const CELL      = 96;
    const GUTTER    = 12;
    const PAD_L     = 64;
    const PAD_T     = 192;
    const W         = PAD_L + cols * (CELL + GUTTER) + 48;
    const H         = PAD_T + rows * (CELL + GUTTER) + 168;
    const canvas    = createCanvas(W, H);
    const ctx       = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050e");
    bg.addColorStop(0.5, "#0e0c1f");
    bg.addColorStop(1, "#05030e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.016)";
    for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, diffColor);
    borderG.addColorStop(0.5, diffColor + "66");
    borderG.addColorStop(1, diffColor);
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 3;
    roundRect(ctx, 8, 8, W - 16, H - 16, 20);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, diffColor + "35");
    hdrG.addColorStop(0.5, diffColor + "12");
    hdrG.addColorStop(1, diffColor + "35");
    ctx.fillStyle = hdrG;
    ctx.fillRect(8, 8, W - 16, 75);

    ctx.font = "bold 23px 'Courier New'";
    ctx.fillStyle = diffColor;
    ctx.shadowColor = diffColor;
    ctx.shadowBlur = 16;
    ctx.fillText("🧠 MEMORY GAME", 28, 50);
    ctx.shadowBlur = 0;
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`${game.difficulty.toUpperCase()} • ${game.theme.toUpperCase()} • v4.0`, 30, 68);

    const ax = W - 54, ay = 48;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 30, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 30, ay - 30, 60, 60);
    } catch {
        ctx.fillStyle = "#1a1040";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 31, 0, Math.PI * 2);
    ctx.strokeStyle = diffColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText(username.substring(0, 14), ax, ay + 44);
    ctx.textAlign = "left";

    const elapsed   = Math.floor((Date.now() - game.startTime) / 1000);
    const remaining = Math.max(0, TIME_LIMIT - elapsed);
    const timeColor = remaining <= 60 ? "#ef4444" : remaining <= 120 ? "#f59e0b" : diffColor;
    const accuracy  = game.attempts > 0 ? Math.round((game.matched / game.attempts) * 100) : 100;
    const streak    = game.streak || 0;

    const statsY    = 96;
    const statItems = [
        { label: "PAIRES",    value: `${game.matched}/${diff.pairs}`, color: game.matched === diff.pairs ? "#34d399" : "#e0d4ff" },
        { label: "ESSAIS",    value: `${game.attempts}`,              color: "#e0d4ff" },
        { label: "PRÉCISION", value: `${accuracy}%`,                  color: accuracy >= 80 ? "#34d399" : accuracy >= 50 ? "#f59e0b" : "#ef4444" },
        { label: "SÉRIE",     value: streak > 0 ? `${streak}🔥` : "0", color: streak >= 5 ? "#fbbf24" : streak >= 3 ? "#f97316" : "#e0d4ff" },
        { label: "TEMPS",     value: timeStr(remaining),               color: timeColor },
        { label: "MISE",      value: `${game.betFormatted}$`,          color: "#fbbf24" },
    ];
    const sW = (W - 56) / statItems.length;
    for (let i = 0; i < statItems.length; i++) {
        const sx      = 28 + i * sW;
        const isAlert = statItems[i].label === "TEMPS" && remaining <= 60;
        ctx.fillStyle = isAlert ? "rgba(239,68,68,0.14)" : "rgba(255,255,255,0.05)";
        roundRect(ctx, sx + 2, statsY - 14, sW - 4, 48, 7);
        ctx.fill();
        if (isAlert) {
            ctx.strokeStyle = "#ef444455";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.font = "7px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(statItems[i].label, sx + 7, statsY + 2);
        ctx.font = `bold ${statItems[i].value.length > 9 ? "10" : "13"}px 'Courier New'`;
        ctx.fillStyle = statItems[i].color;
        if (isAlert) {
            ctx.shadowColor = "#ef4444";
            ctx.shadowBlur = 8;
        }
        ctx.fillText(statItems[i].value, sx + 7, statsY + 24);
        ctx.shadowBlur = 0;
    }

    const timeBarY = statsY + 42;
    const timeBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, timeBarY, timeBarW, 9, 4);
    ctx.fill();
    const pct      = remaining / TIME_LIMIT;
    const barColor = remaining <= 60 ? "#ef4444" : remaining <= 120 ? "#f59e0b" : diffColor;
    const barG     = ctx.createLinearGradient(28, 0, 28 + timeBarW * pct, 0);
    barG.addColorStop(0, barColor);
    barG.addColorStop(1, barColor + "88");
    ctx.fillStyle = barG;
    roundRect(ctx, 28, timeBarY, Math.max(timeBarW * pct, 10), 9, 4);
    ctx.fill();

    if (game.hintPenalty > 0) {
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "#fbbf2488";
        ctx.textAlign = "right";
        ctx.fillText(`💡 ${game.hintPenalty} indice(s) — -${Math.min(game.hintPenalty * 20, 80)}% gain`, W - 30, timeBarY + 22);
        ctx.textAlign = "left";
    }

    for (let c = 0; c < cols; c++) {
        const label = String.fromCharCode(65 + c);
        const cx    = PAD_L + c * (CELL + GUTTER) + CELL / 2;
        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = diffColor + "cc";
        ctx.shadowColor = diffColor;
        ctx.shadowBlur = 6;
        ctx.textAlign = "center";
        ctx.fillText(label, cx, PAD_T - 16);
        ctx.shadowBlur = 0;
        ctx.textAlign = "left";
    }
    for (let r = 0; r < rows; r++) {
        const ry = PAD_T + r * (CELL + GUTTER) + CELL / 2 + 5;
        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = diffColor + "cc";
        ctx.shadowColor = diffColor;
        ctx.shadowBlur = 6;
        ctx.textAlign = "right";
        ctx.fillText(String(r + 1), PAD_L - 16, ry);
        ctx.shadowBlur = 0;
        ctx.textAlign = "left";
    }

    for (let idx = 0; idx < game.board.length; idx++) {
        const r          = Math.floor(idx / cols);
        const c          = idx % cols;
        const cx         = PAD_L + c * (CELL + GUTTER);
        const cy         = PAD_T + r * (CELL + GUTTER);
        const isMatched  = game.revealed[idx];
        const isFlipped  = lastFlipped?.includes(idx);
        const isMatchNow = lastMatch?.includes(idx);
        const isMissNow  = lastMiss?.includes(idx);
        const emoji      = game.board[idx];
        const emojiGlow  = getEmojiGlow(emoji);

        let strokeColor, strokeW, cardBg;
        if (isMatched) {
            strokeColor = emojiGlow; strokeW = 2.5;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#0d2e1a");
            cardBg.addColorStop(1, "#061410");
        } else if (isMatchNow) {
            strokeColor = "#34d399"; strokeW = 3.5;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#0d3020");
            cardBg.addColorStop(1, "#061a10");
        } else if (isMissNow) {
            strokeColor = "#ef4444"; strokeW = 3;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#2e0d0d");
            cardBg.addColorStop(1, "#1a0606");
        } else if (isFlipped) {
            strokeColor = emojiGlow; strokeW = 3;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#1a1040");
            cardBg.addColorStop(1, "#0d0820");
        } else {
            strokeColor = diffColor + "44"; strokeW = 1.5;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#110f30");
            cardBg.addColorStop(1, "#08061a");
        }

        ctx.fillStyle = cardBg;
        roundRect(ctx, cx, cy, CELL, CELL, 13);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeW;
        ctx.stroke();

        if (isMatched || isFlipped || isMatchNow || isMissNow) {
            const glowColor  = isMatchNow ? "#34d399" : isMissNow ? "#ef4444" : emojiGlow;
            const emojiRadGlow = ctx.createRadialGradient(
                cx + CELL/2, cy + CELL/2, 4,
                cx + CELL/2, cy + CELL/2, CELL * 0.52
            );
            emojiRadGlow.addColorStop(0, glowColor + "40");
            emojiRadGlow.addColorStop(0.5, glowColor + "18");
            emojiRadGlow.addColorStop(1, "transparent");
            ctx.fillStyle = emojiRadGlow;
            roundRect(ctx, cx + 2, cy + 2, CELL - 4, CELL - 4, 11);
            ctx.fill();

            if (isMatched) {
                ctx.shadowColor = emojiGlow;
                ctx.shadowBlur  = 22;
            } else if (isMatchNow) {
                ctx.shadowColor = "#34d399";
                ctx.shadowBlur  = 28;
            } else if (isMissNow) {
                ctx.shadowColor = "#ef4444";
                ctx.shadowBlur  = 20;
            } else {
                ctx.shadowColor = emojiGlow;
                ctx.shadowBlur  = 18;
            }

            ctx.font = "52px 'Segoe UI Emoji'";
            ctx.textAlign = "center";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(emoji, cx + CELL / 2, cy + CELL / 2 + 20);
            ctx.shadowBlur = 0;
            ctx.textAlign = "left";

            if (isMatched) {
                ctx.fillStyle = emojiGlow;
                ctx.font = "bold 13px 'Courier New'";
                ctx.shadowColor = emojiGlow;
                ctx.shadowBlur = 8;
                ctx.textAlign = "center";
                ctx.fillText("✓", cx + CELL - 11, cy + 18);
                ctx.shadowBlur = 0;
                ctx.textAlign = "left";
            }
        } else {
            const hiddenBg = ctx.createRadialGradient(
                cx + CELL/2, cy + CELL/2, 2,
                cx + CELL/2, cy + CELL/2, CELL * 0.5
            );
            hiddenBg.addColorStop(0, diffColor + "18");
            hiddenBg.addColorStop(1, "transparent");
            ctx.fillStyle = hiddenBg;
            roundRect(ctx, cx + 4, cy + 4, CELL - 8, CELL - 8, 9);
            ctx.fill();

            ctx.font = "bold 26px 'Courier New'";
            ctx.fillStyle = diffColor + "50";
            ctx.shadowColor = diffColor;
            ctx.shadowBlur = 6;
            ctx.textAlign = "center";
            ctx.fillText("?", cx + CELL / 2, cy + CELL / 2 + 10);
            ctx.shadowBlur = 0;
            ctx.textAlign = "left";
        }

        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = isMatched ? emojiGlow + "99" : diffColor + "55";
        ctx.textAlign = "center";
        ctx.fillText(`${String.fromCharCode(65 + c)}${r + 1}`, cx + CELL / 2, cy + CELL - 7);
        ctx.textAlign = "left";
    }

    const progressPairs = game.matched / diff.pairs;
    const progBarY      = H - 98;
    const progBarW      = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, progBarY, progBarW, 13, 6);
    ctx.fill();
    const progG = ctx.createLinearGradient(28, 0, 28 + progBarW * progressPairs, 0);
    progG.addColorStop(0, diffColor);
    progG.addColorStop(1, diffColor + "88");
    ctx.fillStyle = progG;
    if (progressPairs > 0) {
        ctx.shadowColor = diffColor;
        ctx.shadowBlur  = 8;
        roundRect(ctx, 28, progBarY, Math.max(progBarW * progressPairs, 12), 13, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`PROGRESSION : ${game.matched}/${diff.pairs} paires`, 28, progBarY - 6);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(progressPairs * 100)}%`, W - 28, progBarY - 6);
    ctx.textAlign = "left";

    const statusMap = {
        start:   { text: "Tapez : A1 B3  ou  memory A1 B3", color: diffColor    },
        match:   { text: "✦ PAIRE TROUVÉE ! Continuez...",  color: "#34d399"    },
        miss:    { text: "✕ Pas de paire — réessayez !",    color: "#ef4444"    },
        win:     { text: "🏆 FÉLICITATIONS !",              color: "#fbbf24"    },
        timeout: { text: "⏰ TEMPS ÉCOULÉ !",               color: "#ef4444"    },
        hint:    { text: "💡 Indice utilisé !",              color: "#fbbf24"    },
        first:   { text: "🃏 1ère carte choisie — tapez la 2ème", color: "#a78bfa" },
    };
    const status  = statusMap[phase] || statusMap.start;
    const footerY = H - 60;
    ctx.fillStyle = status.color + "14";
    roundRect(ctx, 28, footerY, W - 56, 36, 8);
    ctx.fill();
    ctx.strokeStyle = status.color + "55";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = "bold 12px 'Courier New'";
    ctx.fillStyle = status.color;
    ctx.shadowColor = status.color;
    ctx.shadowBlur = 8;
    ctx.textAlign = "center";
    ctx.fillText(status.text, W / 2, footerY + 24);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "44";
    ctx.textAlign = "center";
    ctx.fillText(`${username.toUpperCase()} • HEDGEHOG MEMORY v4.0`, W / 2, H - 15);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateResultImage({ username, avatarUrl, win, bet, earned, newBalance, attempts, timeTaken, difficulty, matched, pairs, speedBonus, streak, accuracy, combo, hintPenalty, finalMult }) {
    const W         = 740, H = 460;
    const canvas    = createCanvas(W, H);
    const ctx       = canvas.getContext("2d");
    const diffColor = DIFFICULTY_COLORS[difficulty] || "#818cf8";

    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.8);
    bg.addColorStop(0, win ? "#0e1f18" : "#1a0a0a");
    bg.addColorStop(1, win ? "#050d09" : "#0a0404");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.016)";
    for (let x = 0; x < W; x += 30)
        for (let y = 0; y < H; y += 30)
            ctx.fillRect(x, y, 1, 1);

    const bG = ctx.createLinearGradient(0, 0, W, H);
    bG.addColorStop(0, win ? diffColor : "#ef4444");
    bG.addColorStop(0.5, win ? diffColor + "55" : "#7f1d1d");
    bG.addColorStop(1, win ? diffColor : "#ef4444");
    ctx.strokeStyle = bG;
    ctx.lineWidth = 3;
    roundRect(ctx, 10, 10, W - 20, H - 20, 20);
    ctx.stroke();

    const hG = ctx.createLinearGradient(0, 0, W, 0);
    hG.addColorStop(0, (win ? diffColor : "#ef4444") + "30");
    hG.addColorStop(0.5, "rgba(0,0,0,0)");
    hG.addColorStop(1, (win ? diffColor : "#ef4444") + "30");
    ctx.fillStyle = hG;
    ctx.fillRect(10, 10, W - 20, 72);

    ctx.font = "bold 26px 'Courier New'";
    ctx.fillStyle = win ? diffColor : "#ef4444";
    ctx.shadowColor = win ? diffColor : "#ef4444";
    ctx.shadowBlur = 18;
    ctx.fillText(win ? "🏆 VICTOIRE — MEMORY" : "💀 DÉFAITE — MEMORY", 28, 54);
    ctx.shadowBlur = 0;
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = (win ? diffColor : "#ef4444") + "88";
    ctx.fillText(`${difficulty.toUpperCase()} • ${matched}/${pairs} PAIRES • ${timeStr(timeTaken)} • x${finalMult}`, 30, 72);

    const ax = W - 54, ay = 48;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 32, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 32, ay - 32, 64, 64);
    } catch {
        ctx.fillStyle = "#0a1a10";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 33, 0, Math.PI * 2);
    ctx.strokeStyle = win ? diffColor : "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = "bold 15px 'Courier New'";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(username.toUpperCase().substring(0, 20), 28, 110);
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("JOUEUR", 28, 125);

    ctx.strokeStyle = (win ? diffColor : "#ef4444") + "22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 138); ctx.lineTo(W - 28, 138);
    ctx.stroke();

    const statsY = 162;
    const cols   = [
        { label: "MISE",      value: `${bet}$`,                                     color: "#c4b5fd" },
        { label: win ? "GAIN" : "PERTE", value: win ? `+${earned}$` : `-${bet}$`,  color: win ? diffColor : "#ef4444" },
        { label: "SOLDE",     value: `${newBalance}$`,                              color: "#fbbf24" },
        { label: "ESSAIS",    value: `${attempts}`,                                 color: "#60a5fa" },
        { label: "TEMPS",     value: timeStr(timeTaken),                            color: "#f87171" },
        { label: "PRÉCISION", value: `${accuracy}%`,                                color: accuracy >= 70 ? "#34d399" : "#f59e0b" },
    ];
    const cW = (W - 56) / 3;
    for (let i = 0; i < cols.length; i++) {
        const row2 = Math.floor(i / 3), col2 = i % 3;
        const cx   = 28 + col2 * cW;
        const cy   = statsY + row2 * 66;
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        roundRect(ctx, cx + 3, cy - 16, cW - 6, 54, 8);
        ctx.fill();
        ctx.strokeStyle = cols[i].color + "22";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(cols[i].label, cx + 10, cy + 2);
        ctx.font = `bold ${cols[i].value.length > 9 ? "11" : "14"}px 'Courier New'`;
        ctx.fillStyle = cols[i].color;
        ctx.shadowColor = cols[i].color;
        ctx.shadowBlur = 6;
        ctx.fillText(cols[i].value, cx + 10, cy + 26);
        ctx.shadowBlur = 0;
    }

    const badgesY = statsY + 154;
    const badges  = [];
    if (speedBonus && win) badges.push({ icon: "⚡", label: "BONUS VITESSE",  color: "#fbbf24" });
    if (streak >= 3)       badges.push({ icon: "🔥", label: `SÉRIE x${streak}`, color: "#f97316" });
    if (accuracy === 100)  badges.push({ icon: "💯", label: "PARFAIT",          color: "#34d399" });
    if (combo >= 3)        badges.push({ icon: "✨", label: `COMBO x${combo}`,  color: "#a78bfa" });
    if (matched === pairs && attempts <= pairs) badges.push({ icon: "🎯", label: "MAÎTRE",      color: "#fbbf24" });
    if (hintPenalty === 0 && win)              badges.push({ icon: "🚫", label: "SANS INDICE", color: "#34d399" });

    if (badges.length > 0) {
        const badgeW = (W - 56) / Math.min(badges.length, 4);
        for (let i = 0; i < Math.min(badges.length, 4); i++) {
            const bx = 28 + i * badgeW;
            ctx.fillStyle = badges[i].color + "1a";
            roundRect(ctx, bx + 3, badgesY - 14, badgeW - 6, 42, 8);
            ctx.fill();
            ctx.strokeStyle = badges[i].color + "55";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.font = "bold 12px 'Courier New'";
            ctx.fillStyle = badges[i].color;
            ctx.shadowColor = badges[i].color;
            ctx.shadowBlur = 8;
            ctx.textAlign = "center";
            ctx.fillText(`${badges[i].icon} ${badges[i].label}`, bx + badgeW / 2, badgesY + 12);
            ctx.shadowBlur = 0;
            ctx.textAlign = "left";
        }
    }

    if (hintPenalty > 0 && win) {
        ctx.font = "9px 'Courier New'";
        ctx.fillStyle = "#fbbf2488";
        ctx.textAlign = "center";
        ctx.fillText(`⚠️ Pénalité indices : -${Math.min(hintPenalty * 20, 80)}% appliquée`, W / 2, badgesY + 52);
        ctx.textAlign = "left";
    }

    const accY    = H - 54;
    const accBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, accY, accBarW, 12, 6);
    ctx.fill();
    if (accuracy > 0) {
        const accG = ctx.createLinearGradient(28, 0, 28 + accBarW * (accuracy / 100), 0);
        accG.addColorStop(0, diffColor);
        accG.addColorStop(1, diffColor + "88");
        ctx.fillStyle = accG;
        ctx.shadowColor = diffColor;
        ctx.shadowBlur = 8;
        roundRect(ctx, 28, accY, accBarW * (accuracy / 100), 12, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`PRÉCISION : ${accuracy}%`, 28, accY - 6);
    ctx.textAlign = "right";
    ctx.fillStyle = diffColor + "66";
    ctx.fillText(`Multiplicateur final : x${finalMult}`, W - 28, accY - 6);
    ctx.textAlign = "left";

    const d = new Date();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = (win ? diffColor : "#ef4444") + "44";
    ctx.textAlign = "center";
    ctx.fillText(`HEDGEHOG MEMORY v4.0 • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, W / 2, H - 16);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateStatsImage({ uid, username, avatarUrl }) {
    const s  = getPlayerStats(uid);
    const W  = 700, H = 400;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050e"); bg.addColorStop(1, "#0e0c1f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.016)";
    for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
            ctx.fillRect(x, y, 1.5, 1.5);

    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 2.5;
    roundRect(ctx, 8, 8, W - 16, H - 16, 20); ctx.stroke();

    const hG = ctx.createLinearGradient(0, 0, W, 0);
    hG.addColorStop(0, "#818cf835"); hG.addColorStop(0.5, "#818cf810"); hG.addColorStop(1, "#818cf835");
    ctx.fillStyle = hG; ctx.fillRect(8, 8, W - 16, 70);

    ctx.font = "bold 23px 'Courier New'"; ctx.fillStyle = "#818cf8";
    ctx.shadowColor = "#818cf8"; ctx.shadowBlur = 14;
    ctx.fillText("📊 STATS — MEMORY GAME", 28, 50);
    ctx.shadowBlur = 0;
    ctx.font = "10px 'Courier New'"; ctx.fillStyle = "#818cf888";
    ctx.fillText(username.toUpperCase() + " • v4.0", 30, 68);

    const ax2 = W - 54, ay2 = 48;
    ctx.save();
    ctx.beginPath(); ctx.arc(ax2, ay2, 30, 0, Math.PI * 2); ctx.clip();
    try { const av = await loadImage(avatarUrl); ctx.drawImage(av, ax2 - 30, ay2 - 30, 60, 60); }
    catch { ctx.fillStyle = "#1a1040"; ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(ax2, ay2, 31, 0, Math.PI * 2);
    ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 2.5; ctx.stroke();

    const wr = s.gamesPlayed > 0 ? Math.round(s.gamesWon / s.gamesPlayed * 100) : 0;
    const items = [
        { label: "PARTIES",        value: `${s.gamesPlayed}`,                             color: "#c4b5fd" },
        { label: "VICTOIRES",      value: `${s.gamesWon}`,                                color: "#34d399" },
        { label: "DÉFAITES",       value: `${s.gamesLost}`,                               color: "#ef4444" },
        { label: "RATIO",          value: `${wr}%`,                                        color: wr >= 60 ? "#34d399" : wr >= 40 ? "#f59e0b" : "#ef4444" },
        { label: "MEILLEUR TEMPS", value: s.bestTime !== null ? timeStr(s.bestTime) : "—", color: "#60a5fa" },
        { label: "MEILL. PRÉC.",   value: `${s.bestAccuracy}%`,                           color: "#fbbf24" },
        { label: "MEILL. SÉRIE",   value: `${s.bestStreak}🔥`,                            color: "#f97316" },
        { label: "PAIRES TOTALES", value: `${s.totalPairsFound}`,                         color: "#a78bfa" },
    ];
    const cW2 = (W - 56) / 4;
    for (let i = 0; i < items.length; i++) {
        const row2 = Math.floor(i / 4), col2 = i % 4;
        const cx   = 28 + col2 * cW2;
        const cy   = 98 + row2 * 72;
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        roundRect(ctx, cx + 3, cy - 16, cW2 - 6, 54, 8); ctx.fill();
        ctx.strokeStyle = items[i].color + "22"; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = "7px 'Courier New'"; ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(items[i].label, cx + 8, cy + 2);
        ctx.font = `bold ${items[i].value.length > 8 ? "10" : "14"}px 'Courier New'`;
        ctx.fillStyle = items[i].color;
        ctx.shadowColor = items[i].color; ctx.shadowBlur = 6;
        ctx.fillText(items[i].value, cx + 8, cy + 26);
        ctx.shadowBlur = 0;
    }

    const wrBarY = H - 54, wrBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, wrBarY, wrBarW, 12, 6); ctx.fill();
    if (wr > 0) {
        const wG = ctx.createLinearGradient(28, 0, 28 + wrBarW * (wr / 100), 0);
        wG.addColorStop(0, "#818cf8"); wG.addColorStop(1, "#818cf888");
        ctx.fillStyle = wG;
        ctx.shadowColor = "#818cf8"; ctx.shadowBlur = 8;
        roundRect(ctx, 28, wrBarY, wrBarW * (wr / 100), 12, 6); ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.font = "8px 'Courier New'"; ctx.fillStyle = "#818cf899";
    ctx.fillText(`TAUX DE VICTOIRE : ${wr}%`, 28, wrBarY - 6);

    ctx.font = "8px 'Courier New'"; ctx.fillStyle = "#818cf844";
    ctx.textAlign = "center";
    ctx.fillText("HEDGEHOG MEMORY v4.0 • STATISTIQUES", W / 2, H - 15);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const l of lines) {
        if (l === "---") { out += "├─────────────•┈┈\n"; continue; }
        out += `│ ${l}\n`;
    }
    return out + "╰─────────────•┈┈";
}

async function sendBoard(message, game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase, bodyLines) {
    const body = S(bodyLines);
    try {
        const img = await generateBoardImage({ game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase });
        const p   = `./memory_board_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body, attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch { await message.reply(body); }
}

async function endGame(message, game, win, username, avatarUrl) {
    const th = gameTimeouts.get(game.uid);
    if (th) { clearTimeout(th); gameTimeouts.delete(game.uid); }
    activeGames.delete(game.uid);
    saveGames();

    const diff        = DIFFICULTIES[game.difficulty];
    const timeTaken   = Math.floor((Date.now() - game.startTime) / 1000);
    const speedBonus  = win && timeTaken <= diff.bonusSpeed;
    const baseMult    = speedBonus ? diff.bonusMult : diff.multiplier;
    const hintPenalty = game.hintPenalty || 0;
    const penaltyPct  = Math.min(hintPenalty * 0.20, 0.80);
    const finalMult   = Math.max(parseFloat((baseMult * (1 - penaltyPct)).toFixed(2)), 1);
    const accuracy    = game.attempts > 0 ? Math.round((game.matched / game.attempts) * 100) : 0;
    const streak      = game.streak   || 0;
    const combo       = game.maxCombo || 0;

    let earned = 0n;
    if (win) {
        const multInt = BigInt(Math.floor(finalMult * 100));
        earned = game.bet * multInt / 100n;
        await updateUserCash(game.uid, earned);
    }

    const newBalance = await getUserCash(game.uid);
    const [fBet, fEarned, fNew] = await Promise.all([
        formatNumber(game.bet),
        formatNumber(win ? earned : game.bet),
        formatNumber(newBalance),
    ]);

    updatePlayerStats(game.uid, {
        win, timeTaken, accuracy, streak,
        pairsFound: game.matched,
        earned: win ? earned.toString() : "0",
        lost:   win ? "0" : game.bet.toString(),
    });

    const lines = [
        win ? "🏆 VICTOIRE !" : "💀 DÉFAITE",
        "---",
        `🃏 Paires     : ${game.matched}/${diff.pairs}`,
        `🎯 Essais     : ${game.attempts}`,
        `🎯 Précision  : ${accuracy}%`,
        `⏱️ Temps      : ${timeStr(timeTaken)}`,
        streak >= 3 ? `🔥 Meilleure série : ${streak}` : null,
        hintPenalty > 0 ? `💡 Indices : ${hintPenalty} (-${Math.round(penaltyPct * 100)}%)` : null,
        "---",
        win ? `✨ Gain   : +${fEarned}$ (x${finalMult})` : `📉 Perte  : -${fBet}$`,
        speedBonus ? `⚡ Bonus vitesse activé !` : null,
        `💳 Solde  : ${fNew}$`,
    ].filter(Boolean);

    await message.reply(S(lines));

    try {
        const img = await generateResultImage({
            username, avatarUrl, win,
            bet: fBet, earned: fEarned, newBalance: fNew,
            attempts: game.attempts, timeTaken,
            difficulty: game.difficulty,
            matched: game.matched, pairs: diff.pairs,
            speedBonus: speedBonus && win,
            streak, accuracy, combo, hintPenalty, finalMult,
        });
        const p = `./memory_result_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body: "🧠 Carte de résultat :", attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch {}
}

async function processMove(coord1, coord2, game, uid, message, api, diff) {
    game.attempts++;
    const isMatch = game.board[coord1.index] === game.board[coord2.index];
    const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
    const arg1Str = `${String.fromCharCode(65 + coord1.col)}${coord1.row + 1}`;
    const arg2Str = `${String.fromCharCode(65 + coord2.col)}${coord2.row + 1}`;

    if (isMatch) {
        game.revealed[coord1.index] = true;
        game.revealed[coord2.index] = true;
        game.matched++;
        game.streak       = (game.streak || 0) + 1;
        game.currentCombo = (game.currentCombo || 0) + 1;
        if (game.currentCombo > (game.maxCombo || 0)) game.maxCombo = game.currentCombo;
        saveGames();

        if (game.matched >= diff.pairs) {
            await sendBoard(message, game, username, avatarUrl,
                [coord1.index, coord2.index], [coord1.index, coord2.index], [], "win",
                [`✦ PAIRE ! ${game.board[coord1.index]}`, `📍 ${arg1Str} & ${arg2Str}`, `✅ ${game.matched}/${diff.pairs}`, "🏆 TOUTES LES PAIRES TROUVÉES !"]
            );
            return endGame(message, game, true, username, avatarUrl);
        }

        const comboText = game.currentCombo >= 3 ? ` 🔥 COMBO x${game.currentCombo} !` : "";
        const elapsed   = Math.floor((Date.now() - game.startTime) / 1000);
        const remaining = Math.max(0, TIME_LIMIT - elapsed);
        await sendBoard(message, game, username, avatarUrl,
            [coord1.index, coord2.index], [coord1.index, coord2.index], [], "match",
            [
                `✦ PAIRE ! ${game.board[coord1.index]}${comboText}`,
                `📍 ${arg1Str} & ${arg2Str}`,
                `🃏 ${game.matched}/${diff.pairs} paires • ⏱️ ${timeStr(remaining)}`,
                `🎯 Essais : ${game.attempts}`,
                "---",
                "📝 Continuez : A1 B2",
            ]
        );
    } else {
        game.streak       = 0;
        game.currentCombo = 0;
        saveGames();
        await sendBoard(message, game, username, avatarUrl,
            [coord1.index, coord2.index], [], [coord1.index, coord2.index], "miss",
            [
                `✕ Pas de paire`,
                `📍 ${arg1Str} (${game.board[coord1.index]}) ≠ ${arg2Str} (${game.board[coord2.index]})`,
                `🃏 ${game.matched}/${diff.pairs} paires`,
                `🎯 Essais : ${game.attempts}`,
                "---",
                "📝 Réessayez : A1 B2",
            ]
        );
    }
}

async function handleCoords(uid, rawArg0, rawArg1, message, api) {
    const game = activeGames.get(uid);
    if (!game) return false;

    const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
    if (elapsed >= TIME_LIMIT) {
        const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
        await endGame(message, game, false, uname, uavatar);
        return true;
    }

    const diff   = DIFFICULTIES[game.difficulty];
    const rows   = Math.ceil(game.board.length / game.cols);
    const coord1 = parseCoord(rawArg0, game.cols, rows);
    const coord2 = rawArg1 ? parseCoord(rawArg1, game.cols, rows) : null;

    if (!coord1) return false;

    if (!coord2) {
        if (game.firstCard !== null && game.firstCard !== coord1.index) {
            const c1 = {
                index: game.firstCard,
                row: Math.floor(game.firstCard / game.cols),
                col: game.firstCard % game.cols,
            };
            if (game.revealed[c1.index] || game.revealed[coord1.index]) {
                game.firstCard = null;
                await message.reply(S(["❌ Une de ces cartes est déjà trouvée !"]));
                return true;
            }
            game.firstCard = null;
            await processMove(c1, coord1, game, uid, message, api, diff);
            return true;
        }
        if (game.revealed[coord1.index]) {
            await message.reply(S(["❌ Cette carte est déjà trouvée !"]));
            return true;
        }
        game.firstCard = coord1.index;
        saveGames();
        const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
        await sendBoard(message, game, username, avatarUrl, [coord1.index], [], [], "first", [
            `🃏 Première carte : ${rawArg0.toUpperCase()} → ${game.board[coord1.index]}`,
            `📝 Entrez la 2ème : B3  ou  ${rawArg0.toUpperCase()} B3`,
        ]);
        return true;
    }

    if (coord1.index === coord2.index) {
        await message.reply(S(["❌ Choisissez 2 cartes différentes !"]));
        return true;
    }
    if (game.revealed[coord1.index] || game.revealed[coord2.index]) {
        await message.reply(S(["❌ Une de ces cartes est déjà trouvée !"]));
        return true;
    }
    game.firstCard = null;
    await processMove(coord1, coord2, game, uid, message, api, diff);
    return true;
}

module.exports = {
    config: {
        name: "memory",
        version: "4.0",
        author: "Hedgehog",
        countDown: 2,
        role: 0,
        category: "fun",
        shortDescription: { en: "Jeu de mémoire — trouvez toutes les paires !" },
        longDescription: { en: "🧠 Memory v4.0 — Tapez A1 B3 directement sans préfixe pour jouer vite !" },
    },

    onStart: async function ({ args, message, event, api }) {
        const uid = String(event.senderID);
        const p   = global.utils.getPrefix(event.threadID);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            return message.reply(S([
                "🧠 MEMORY GAME v4.0",
                "---",
                `${p}memory start <mise> [diff] [thème]`,
                `${p}memory stats`,
                `${p}memory leaderboard`,
                "---",
                "📊 DIFFICULTÉS",
                `facile    → x${DIFFICULTIES.facile.multiplier}  (bonus <${timeStr(DIFFICULTIES.facile.bonusSpeed)} → x${DIFFICULTIES.facile.bonusMult})`,
                `normal    → x${DIFFICULTIES.normal.multiplier}  (bonus <${timeStr(DIFFICULTIES.normal.bonusSpeed)} → x${DIFFICULTIES.normal.bonusMult})`,
                `difficile → x${DIFFICULTIES.difficile.multiplier}  (bonus <${timeStr(DIFFICULTIES.difficile.bonusSpeed)} → x${DIFFICULTIES.difficile.bonusMult})`,
                `extreme   → x${DIFFICULTIES.extreme.multiplier}  (bonus <${timeStr(DIFFICULTIES.extreme.bonusSpeed)} → x${DIFFICULTIES.extreme.bonusMult})`,
                "---",
                "🎨 THÈMES : " + Object.keys(CARD_THEMES).join(" • "),
                "---",
                "🎮 EN JEU (SANS PRÉFIXE)",
                "A1 B3   → 2 cartes directement",
                "A1      → 1 carte, puis B3",
                `${p}memory hint  → indice (-20%/indice)`,
                `${p}memory abandon`,
                "⏱️ 10 minutes • Emojis colorés • Stats persistantes",
            ]));
        }

        if (sub === "stats") {
            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            const s  = getPlayerStats(uid);
            const wr = s.gamesPlayed > 0 ? Math.round(s.gamesWon / s.gamesPlayed * 100) : 0;
            await message.reply(S([
                `📊 STATS — ${username}`,
                "---",
                `🎮 Parties         : ${s.gamesPlayed}`,
                `🏆 Victoires       : ${s.gamesWon} (${wr}%)`,
                `💀 Défaites        : ${s.gamesLost}`,
                `⏱️ Meilleur temps  : ${s.bestTime !== null ? timeStr(s.bestTime) : "—"}`,
                `🎯 Meill. précision: ${s.bestAccuracy}%`,
                `🔥 Meill. série    : ${s.bestStreak}`,
                `🃏 Paires totales  : ${s.totalPairsFound}`,
            ]));
            try {
                const img     = await generateStatsImage({ uid, username, avatarUrl });
                const imgPath = `./memory_stats_${uid}_${Date.now()}.png`;
                fs.writeFileSync(imgPath, img);
                await message.reply({ body: "📊 Carte de statistiques :", attachment: fs.createReadStream(imgPath) });
                fs.unlinkSync(imgPath);
            } catch {}
            return;
        }

        if (sub === "leaderboard" || sub === "top") {
            const entries = Object.entries(playerStats)
                .filter(([, s]) => s.gamesPlayed > 0)
                .sort((a, b) => b[1].gamesWon - a[1].gamesWon)
                .slice(0, 10);
            if (entries.length === 0) return message.reply(S(["❌ Aucun joueur pour l'instant."]));
            const medals = ["🥇", "🥈", "🥉"];
            const lines  = ["🏆 LEADERBOARD — MEMORY v4.0", "---"];
            for (let i = 0; i < entries.length; i++) {
                const [id, s] = entries[i];
                const wr = s.gamesPlayed > 0 ? Math.round(s.gamesWon / s.gamesPlayed * 100) : 0;
                lines.push(`${medals[i] || `${i+1}.`} ${id.slice(-5)} — ${s.gamesWon}V / ${wr}%`);
            }
            return message.reply(S(lines));
        }

        if (sub === "abandon" || sub === "quit") {
            const game = activeGames.get(uid);
            if (!game) return message.reply(S(["❌ Aucune partie en cours."]));
            const th = gameTimeouts.get(uid);
            if (th) { clearTimeout(th); gameTimeouts.delete(uid); }
            await updateUserCash(uid, -game.bet);
            activeGames.delete(uid);
            saveGames();
            return message.reply(S(["🏳️ Partie abandonnée.", `📉 Mise perdue : -${await formatNumber(game.bet)}$`]));
        }

        if (sub === "hint") {
            const game = activeGames.get(uid);
            if (!game) return message.reply(S(["❌ Aucune partie en cours."]));
            const hidden = game.board.map((sym, idx) => ({ sym, idx })).filter(({ idx }) => !game.revealed[idx]);
            if (hidden.length === 0) return message.reply(S(["❌ Toutes les cartes sont trouvées !"]));
            const pick  = hidden[Math.floor(Math.random() * hidden.length)];
            const r     = Math.floor(pick.idx / game.cols);
            const c     = pick.idx % game.cols;
            const coord = `${String.fromCharCode(65 + c)}${r + 1}`;
            game.hintPenalty = (game.hintPenalty || 0) + 1;
            const totalPenalty = Math.min(game.hintPenalty * 20, 80);
            saveGames();
            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            await sendBoard(message, game, username, avatarUrl, [pick.idx], [], [], "hint", [
                `💡 Indice : case ${coord} → ${pick.sym}`,
                `⚠️ Pénalité cumulée : -${totalPenalty}% sur le gain`,
                `📊 Indices utilisés : ${game.hintPenalty}`,
            ]);
            return;
        }

        if (sub === "start" || sub === "jouer" || sub === "play") {
            if (activeGames.has(uid)) {
                return message.reply(S([
                    "⚠️ Partie déjà en cours !",
                    "📝 Tapez directement : A1 B2",
                    `🏳️ ${p}memory abandon`,
                ]));
            }

            const bet        = await parseAmount(args[1]);
            const difficulty = DIFFICULTIES[args[2]?.toLowerCase()] ? args[2].toLowerCase() : "normal";
            const theme      = CARD_THEMES[args[3]?.toLowerCase()]  ? args[3].toLowerCase() : "animaux";

            if (bet <= 0n) return message.reply(S(["❌ Montant invalide.", `📝 ${p}memory start 50k`]));
            const userMoney = await getUserCash(uid);
            if (bet > userMoney) return message.reply(S(["❌ Fonds insuffisants", "---", `💰 Solde : ${await formatNumber(userMoney)}$`, `🎲 Mise : ${await formatNumber(bet)}$`]));

            await updateUserCash(uid, -bet);
            const diff  = DIFFICULTIES[difficulty];
            const board = createBoard(difficulty, theme);
            const game  = {
                uid, difficulty, theme, board, cols: diff.cols,
                revealed: new Array(board.length).fill(false),
                attempts: 0, matched: 0,
                streak: 0, maxCombo: 0, currentCombo: 0,
                hintPenalty: 0, startTime: Date.now(),
                bet, betFormatted: await formatNumber(bet),
                firstCard: null,
            };
            activeGames.set(uid, game);
            saveGames();

            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);

            await sendBoard(message, game, username, avatarUrl, [], [], [], "start", [
                "🧠 MEMORY v4.0 — PARTIE LANCÉE !",
                "---",
                `📊 Difficulté : ${difficulty}`,
                `🎨 Thème      : ${theme}`,
                `🃏 Paires     : ${diff.pairs}`,
                `⏱️ Temps      : 10 minutes`,
                `💰 Mise       : ${game.betFormatted}$`,
                `⚡ Bonus si < ${timeStr(diff.bonusSpeed)} → x${diff.bonusMult}`,
                "---",
                "⚡ JOUEZ VITE — tapez juste : A1 B3",
                `💡 Indice : ${p}memory hint (-20%/indice)`,
            ]);

            const timeout = setTimeout(async () => {
                const g = activeGames.get(uid);
                if (!g) return;
                const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
                await sendBoard(message, g, uname, uavatar, [], [], [], "timeout", [
                    "⏰ TEMPS ÉCOULÉ !",
                    `🃏 Paires : ${g.matched}/${diff.pairs}`,
                    `📉 Mise perdue : -${await formatNumber(g.bet)}$`,
                ]);
                await endGame(message, g, false, uname, uavatar);
            }, TIME_LIMIT * 1000);

            gameTimeouts.set(uid, timeout);
            return;
        }

        const handled = await handleCoords(uid, args[0], args[1], message, api);
        if (!handled) {
            return message.reply(S(["❌ Commande inconnue.", `📝 ${p}memory help`]));
        }
    },

    onChat: async function ({ message, event, api }) {
        const uid  = String(event.senderID);
        const body = (event.body || "").trim().toUpperCase();

        const twoCards = body.match(/^([A-Z]\d+)\s+([A-Z]\d+)$/);
        const oneCard  = body.match(/^([A-Z]\d+)$/);

        if (!twoCards && !oneCard) return;
        if (!activeGames.has(uid)) return;

        if (twoCards) {
            await handleCoords(uid, twoCards[1], twoCards[2], message, api);
        } else if (oneCard) {
            await handleCoords(uid, oneCard[1], null, message, api);
        }
    },
};