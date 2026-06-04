const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";
const CASH_URL   = "https://cash-api-five.vercel.app/api/cash";

const MAX_LIMIT = 10n ** 261n;

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
    
    let scaled = big;
    let suffixIndex = 0;
    const thousand = 1000n;
    
    while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
        scaled = scaled / thousand;
        suffixIndex++;
    }
    
    if (suffixIndex === suffixes.length - 1 && scaled >= thousand) return "∞";
    
    const divisor = thousand ** BigInt(suffixIndex);
    const remainder = (big % divisor) * 100n / divisor;
    
    if (suffixIndex > 0 && remainder > 0n) {
        const decStr = remainder.toString().padStart(2, '0').slice(0, 2).replace(/0+$/, '');
        return decStr ? `${scaled}.${decStr}${suffixes[suffixIndex]}` : `${scaled}${suffixes[suffixIndex]}`;
    }
    
    if (suffixIndex === 0) {
        return big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    return `${scaled}${suffixes[suffixIndex]}`;
}

const SFX = {
    k: 1_000n,
    m: 1_000_000n,
    b: 1_000_000_000n,
    t: 1_000_000_000_000n,
    qa: 10n**15n,
    qi: 10n**18n,
    sx: 10n**21n,
    sp: 10n**24n,
    oc: 10n**27n,
    no: 10n**30n,
    dc: 10n**33n,
    udc: 10n**36n,
    ddc: 10n**39n,
    tdc: 10n**42n,
    qadc: 10n**45n,
    qidc: 10n**48n,
    sxdc: 10n**51n,
    spdc: 10n**54n,
    ocdc: 10n**57n,
    nodc: 10n**60n,
    kn: 10n**63n,
    mn: 10n**66n,
    bn: 10n**69n,
    tn: 10n**72n,
    qan: 10n**75n,
    qin: 10n**78n,
    sxn: 10n**81n,
    spn: 10n**84n,
    ocn: 10n**87n,
    non: 10n**90n,
    dcn: 10n**93n,
    ui: 10n**96n,
    di: 10n**99n,
    ti: 10n**102n,
    qi_i: 10n**105n,
    qii: 10n**108n,
    sxi: 10n**111n,
    spi: 10n**114n,
    oci: 10n**117n,
    noi: 10n**120n,
    dci: 10n**123n,
    uv: 10n**126n,
    dv: 10n**129n,
    tv: 10n**132n,
    qv: 10n**135n,
    qiv: 10n**138n,
    sxv: 10n**141n,
    spv: 10n**144n,
    ocv: 10n**147n,
    nov: 10n**150n,
    dcv: 10n**153n,
    ut: 10n**156n,
    dt: 10n**159n,
    tt: 10n**162n,
    qt: 10n**165n,
    qit: 10n**168n,
    sxt: 10n**171n,
    spt: 10n**174n,
    oct: 10n**177n,
    not: 10n**180n,
    dct: 10n**183n,
    utr: 10n**186n,
    dtr: 10n**189n,
    ttr: 10n**192n,
    qtr: 10n**195n,
    qitr: 10n**198n,
    sxtr: 10n**201n,
    sptr: 10n**204n,
    octr: 10n**207n,
    notr: 10n**210n,
    dctr: 10n**213n,
    uq: 10n**216n,
    dq: 10n**219n,
    tq: 10n**222n,
    qq: 10n**225n,
    qiq: 10n**228n,
    sxq: 10n**231n,
    spq: 10n**234n,
    ocq: 10n**237n,
    noq: 10n**240n,
    dcq: 10n**243n,
    uc: 10n**246n,
    du: 10n**249n,
    tu: 10n**252n,
    qu: 10n**255n,
    qiu: 10n**258n,
};

async function parseAmount(input) {
    if (!input) return 0n;
    const str = String(input).toLowerCase().trim();
    
    try {
        const r = await axios.get(`${FORMAT_URL}?n=${encodeURIComponent(str)}`, { timeout: 5000 });
        if (r.data?.success && r.data?.raw) return toBigInt(r.data.raw);
    } catch {}
    
    const m = str.match(/^(-?\d+(?:\.\d+)?)([a-zA-Z]+)?$/i);
    if (!m) return 0n;
    
    const val = parseFloat(m[1]);
    const sfx = (m[2] || "").toLowerCase();
    const base = BigInt(Math.floor(Math.abs(val)));
    const neg = val < 0;
    
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
        if (a > 0n) {
            await axios.post(`${CASH_URL}/${uid}/add`, { amount: a.toString() });
            return true;
        } else if (a < 0n) {
            await axios.post(`${CASH_URL}/${uid}/subtract`, { amount: (-a).toString() });
            return true;
        }
        return true;
    } catch (e) {
        console.error("Cash update:", e.message);
        return false;
    }
}

function getUserName(uid, api) {
    return new Promise(resolve => {
        api.getUserInfo(uid, (err, data) => {
            const n = data?.[uid]?.name;
            resolve((n && n !== "Facebook User" && n !== "Utilisateur") ? n : `User_${String(uid).slice(-5)}`);
        });
    });
}

async function getUserAvatar(uid, api) {
    try {
        const d = await api.getUserInfo(uid);
        return d[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    } catch { return `https://graph.facebook.com/${uid}/picture?width=200&height=200`; }
}

const COOLDOWN_FILE = "./slot_cooldowns.json";
let slotCooldowns = new Map();
if (fs.existsSync(COOLDOWN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
        slotCooldowns = new Map(Object.entries(data));
    } catch {}
}
function saveCooldowns() {
    try { fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(Object.fromEntries(slotCooldowns), null, 2)); } catch {}
}

const MAX_SPINS = 15;
const RESET_MS  = 30 * 60 * 1000;

function getCooldown(uid) {
    const now = Date.now();
    if (!slotCooldowns.has(uid)) {
        slotCooldowns.set(uid, { spins: MAX_SPINS, resetTime: now + RESET_MS });
        saveCooldowns();
    }
    const c = slotCooldowns.get(uid);
    if (now > c.resetTime) {
        c.spins     = MAX_SPINS;
        c.resetTime = now + RESET_MS;
        slotCooldowns.set(uid, c);
        saveCooldowns();
    }
    return c;
}
function useSpin(uid) {
    const c = getCooldown(uid);
    if (c.spins <= 0) return false;
    c.spins--;
    slotCooldowns.set(uid, c);
    saveCooldowns();
    return true;
}
function timeLeft(ms) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}m ${s}s`;
}

const REELS = [
    ["🍒","🍒","🍒","🍒","🍋","🍋","🍋","🔔","🔔","⭐","💎","🎰"],
    ["🍒","🍒","🍒","🍋","🍋","🍋","🍋","🔔","🔔","⭐","💎","🎰"],
    ["🍒","🍒","🍒","🍋","🍋","🍋","🔔","🔔","🔔","⭐","💎","🎰"],
];

function spinReels() {
    return REELS.map(r => r[Math.floor(Math.random() * r.length)]);
}

function calcWin(s1, s2, s3, bet) {
    const b = toBigInt(bet);
    if (s1 === s2 && s2 === s3) {
        if (s1 === "💎") return { win: true, winAmount: b * 50n,  multiplier: 50,  rank: "JACKPOT 💎" };
        if (s1 === "🎰") return { win: true, winAmount: b * 25n,  multiplier: 25,  rank: "SUPER 🎰"   };
        if (s1 === "⭐") return { win: true, winAmount: b * 15n,  multiplier: 15,  rank: "ÉTOILE ⭐"  };
        if (s1 === "🔔") return { win: true, winAmount: b * 8n,   multiplier: 8,   rank: "BELLE 🔔"   };
        if (s1 === "🍋") return { win: true, winAmount: b * 5n,   multiplier: 5,   rank: "CITRON 🍋"  };
        if (s1 === "🍒") return { win: true, winAmount: b * 3n,   multiplier: 3,   rank: "CERISE 🍒"  };
    }
    if (s1 === s2 || s2 === s3 || s1 === s3) {
        const sym = s1 === s2 ? s1 : s2 === s3 ? s2 : s1;
        if (sym === "💎") return { win: true, winAmount: b * 4n, multiplier: 4, rank: "PAIRE 💎" };
        if (sym === "🎰") return { win: true, winAmount: b * 3n, multiplier: 3, rank: "PAIRE 🎰" };
        return { win: true, winAmount: b * 2n, multiplier: 2, rank: "PAIRE" };
    }
    return { win: false, winAmount: -b, multiplier: 0, rank: "PERDU" };
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

async function generateSlotCard({ username, bet, win, winAmount, newBalance, slots, multiplier, rank, remainingSpins, avatarUrl }) {
    const W = 700, H = 440;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.85);
    bg.addColorStop(0, "#1a0f2e");
    bg.addColorStop(1, "#070410");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let x = 0; x < W; x += 30)
        for (let y = 0; y < H; y += 30)
            ctx.fillRect(x, y, 1, 1);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0,   win ? "#f59e0b" : "#9333ea");
    borderG.addColorStop(0.5, win ? "#d97706" : "#6d28d9");
    borderG.addColorStop(1,   win ? "#f59e0b" : "#9333ea");
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, "rgba(245,158,11,0.2)");
    hdrG.addColorStop(0.5, "rgba(245,158,11,0.07)");
    hdrG.addColorStop(1, "rgba(245,158,11,0.2)");
    ctx.fillStyle = hdrG;
    ctx.fillRect(10, 10, W - 20, 65);

    ctx.font = "bold 22px 'Courier New'";
    ctx.fillStyle = "#f59e0b";
    ctx.fillText("🎰 HEDGEHOG SLOT MACHINE", 28, 50);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(245,158,11,0.55)";
    ctx.fillText("PREMIUM CASINO • SINCE 2025", 30, 66);

    const ax = W - 52, ay = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 30, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 30, ay - 30, 60, 60);
    } catch {
        ctx.fillStyle = "#1a0f2e";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 31, 0, Math.PI * 2);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "bold 14px 'Courier New'";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(username.toUpperCase().substring(0, 20), 28, 100);
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("JOUEUR", 28, 114);

    const machineX = 28, machineY = 128, machineW = W - 56, machineH = 130;
    const machineG = ctx.createLinearGradient(machineX, machineY, machineX, machineY + machineH);
    machineG.addColorStop(0, "#0d0820");
    machineG.addColorStop(1, "#060412");
    ctx.fillStyle = machineG;
    roundRect(ctx, machineX, machineY, machineW, machineH, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(245,158,11,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const lineY = machineY + machineH / 2;
    ctx.strokeStyle = win ? "rgba(245,158,11,0.7)" : "rgba(147,51,234,0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(machineX + 15, lineY);
    ctx.lineTo(machineX + machineW - 15, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    const reelW = 130, reelH = 96, reelGap = 18;
    const totalReelW = 3 * reelW + 2 * reelGap;
    const reelStartX = (W - totalReelW) / 2;
    const reelY = machineY + (machineH - reelH) / 2;

    for (let i = 0; i < 3; i++) {
        const rx = reelStartX + i * (reelW + reelGap);
        const rG = ctx.createLinearGradient(rx, reelY, rx, reelY + reelH);
        rG.addColorStop(0, "#1e1040");
        rG.addColorStop(0.5, "#140c30");
        rG.addColorStop(1, "#1e1040");
        ctx.fillStyle = rG;
        roundRect(ctx, rx, reelY, reelW, reelH, 10);
        ctx.fill();

        const isWinReel = win && (
            (slots[0] === slots[1] && slots[1] === slots[2]) ||
            (i === 0 && slots[0] === slots[1]) ||
            (i === 1 && (slots[0] === slots[1] || slots[1] === slots[2])) ||
            (i === 2 && slots[1] === slots[2])
        );
        ctx.strokeStyle = isWinReel ? "#f59e0b" : "rgba(147,51,234,0.4)";
        ctx.lineWidth = isWinReel ? 2.5 : 1.5;
        ctx.stroke();

        ctx.font = "52px 'Segoe UI Emoji'";
        ctx.textAlign = "center";
        ctx.fillText(slots[i], rx + reelW / 2, reelY + reelH / 2 + 20);
        ctx.textAlign = "left";

        if (isWinReel) {
            const glowG = ctx.createRadialGradient(rx + reelW / 2, reelY + reelH / 2, 10, rx + reelW / 2, reelY + reelH / 2, 60);
            glowG.addColorStop(0, "rgba(245,158,11,0.15)");
            glowG.addColorStop(1, "rgba(245,158,11,0)");
            ctx.fillStyle = glowG;
            roundRect(ctx, rx, reelY, reelW, reelH, 10);
            ctx.fill();
        }
    }

    const rankColor = win
        ? (multiplier >= 25 ? "#fbbf24" : multiplier >= 10 ? "#f59e0b" : "#86efac")
        : "#f87171";
    ctx.font = "bold 24px 'Courier New'";
    ctx.fillStyle = rankColor;
    ctx.textAlign = "center";
    ctx.fillText(rank, W / 2, machineY + machineH + 40);
    ctx.textAlign = "left";

    if (win && multiplier >= 25) {
        ctx.font = "bold 11px 'Courier New'";
        ctx.fillStyle = "rgba(251,191,36,0.6)";
        ctx.textAlign = "center";
        ctx.fillText("✦ ✦ ✦   JACKPOT   ✦ ✦ ✦", W / 2, machineY + machineH + 58);
        ctx.textAlign = "left";
    }

    ctx.strokeStyle = "rgba(245,158,11,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, machineY + machineH + 68);
    ctx.lineTo(W - 28, machineY + machineH + 68);
    ctx.stroke();

    const statsY = machineY + machineH + 90;
    const cols = [
        { label: "MISE",   value: `${await formatNumber(bet)}$`,                                             color: "#c4b5fd" },
        { label: win ? "GAIN" : "PERTE", value: win ? `+${await formatNumber(winAmount)}$` : `-${await formatNumber(-winAmount)}$`, color: win ? "#86efac" : "#f87171" },
        { label: "SOLDE",  value: `${await formatNumber(newBalance)}$`,                                       color: "#fbbf24" },
        { label: "TOURS",  value: `${remainingSpins}/${MAX_SPINS}`,                                           color: "#93c5fd" },
    ];
    const colW = (W - 56) / 4;
    for (let i = 0; i < cols.length; i++) {
        const cx = 28 + i * colW;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, cx + 3, statsY - 18, colW - 6, 56, 7);
        ctx.fill();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(cols[i].label, cx + 10, statsY);
        ctx.font = `bold ${cols[i].value.length > 10 ? "11" : "14"}px 'Courier New'`;
        ctx.fillStyle = cols[i].color;
        ctx.fillText(cols[i].value, cx + 10, statsY + 24);
    }

    const barY = H - 48;
    const barW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, barY, barW, 10, 5);
    ctx.fill();
    const pct = remainingSpins / MAX_SPINS;
    const barG2 = ctx.createLinearGradient(28, 0, 28 + barW * pct, 0);
    barG2.addColorStop(0, "#f59e0b");
    barG2.addColorStop(1, "#fbbf24");
    ctx.fillStyle = barG2;
    roundRect(ctx, 28, barY, Math.max(barW * pct, 8), 10, 5);
    ctx.fill();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = "rgba(245,158,11,0.5)";
    ctx.fillText(`TOURS RESTANTS : ${remainingSpins}/${MAX_SPINS}`, 28, barY - 6);

    const d = new Date();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = "rgba(245,158,11,0.3)";
    ctx.textAlign = "center";
    ctx.fillText(
        `HEDGEHOG CASINO • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
        W / 2, H - 16
    );
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

module.exports = {
    config: {
        name: "slot",
        version: "7.0",
        author: "Itachi Soma",
        countDown: 3,
        role: 0,
        category: "fun",
        shortDescription: { en: "Slot machine premium" },
        longDescription: { en: "🎰 Slot machine avec 6 symboles. 💎 x50 | 🎰 x25 | ⭐ x15 | 🔔 x8 | 🍋 x5 | 🍒 x3 | Paire x2-x4. 15 tours / 30 min." }
    },

    onStart: async function ({ args, message, event, api }) {
        const uid = String(event.senderID);
        const p   = global.utils.getPrefix(event.threadID);
        const sub = args[0]?.toLowerCase();

        if (sub === "stats") {
            const c   = getCooldown(uid);
            const tr  = Math.max(0, c.resetTime - Date.now());
            const pct = Math.floor(c.spins / MAX_SPINS * 20);
            const bar = "█".repeat(pct) + "░".repeat(20 - pct);
            return message.reply(S([
                "🎰 SLOT STATS",
                "---",
                `🎲 Tours restants : ${c.spins}/${MAX_SPINS}`,
                `📊 [${bar}]`,
                `⏰ Recharge dans : ${timeLeft(tr)}`,
                "---",
                "💎 x50  🎰 x25  ⭐ x15  🔔 x8",
                "🍋 x5   🍒 x3   Paire x2 à x4",
            ]));
        }

        if (!sub || sub === "help") {
            return message.reply(S([
                "🎰 SLOT MACHINE",
                "---",
                `${p}slot <montant>`,
                `${p}slot stats`,
                "---",
                "💎 Trio 💎 → x50 (JACKPOT)",
                "🎰 Trio 🎰 → x25",
                "⭐ Trio ⭐ → x15",
                "🔔 Trio 🔔 → x8",
                "🍋 Trio 🍋 → x5",
                "🍒 Trio 🍒 → x3",
                "🃏 Paire    → x2 à x4",
                "---",
                `🎲 ${MAX_SPINS} tours / 30 minutes`,
            ]));
        }

        const c = getCooldown(uid);
        if (c.spins <= 0) {
            return message.reply(S([
                "❌ Plus de tours !",
                "---",
                `⏰ Recharge dans : ${timeLeft(Math.max(0, c.resetTime - Date.now()))}`,
                `📝 ${p}slot stats pour les détails`,
            ]));
        }

        const amount = await parseAmount(sub);
        if (amount <= 0n) {
            return message.reply(S([
                "❌ Montant invalide",
                "---",
                `📝 ${p}slot <montant>`,
                "💳 Exemple : ~slot 50k",
            ]));
        }

        const userMoney = await getUserCash(uid);
        if (amount > userMoney) {
            return message.reply(S([
                "❌ Fonds insuffisants",
                "---",
                `💰 Solde : ${await formatNumber(userMoney)}$`,
                `🎰 Mise   : ${await formatNumber(amount)}$`,
            ]));
        }

        const ok = await updateUserCash(uid, -amount);
        if (!ok) return message.reply(S(["❌ Erreur lors de la mise à jour du solde."]));

        const [s1, s2, s3] = spinReels();
        const { win, winAmount, multiplier, rank } = calcWin(s1, s2, s3, amount);

        useSpin(uid);
        if (win) await updateUserCash(uid, winAmount);

        const newBalance    = await getUserCash(uid);
        const updated       = getCooldown(uid);
        const [fBet, fNew, fWin] = await Promise.all([
            formatNumber(amount),
            formatNumber(newBalance),
            formatNumber(win ? winAmount : -winAmount),
        ]);

        await message.reply(S([
            "🎰 SLOT MACHINE",
            "---",
            `🎲 [ ${s1} | ${s2} | ${s3} ]`,
            "---",
            `💰 Mise : ${fBet}$`,
            "---",
            win ? `🎉 ${rank} — +${fWin}$ (x${multiplier})` : `💀 ${rank} — -${fWin}$`,
            `💳 Solde : ${fNew}$`,
            "---",
            `🎲 Tours restants : ${updated.spins}/${MAX_SPINS}`,
        ]));

        const bankPath = "./bank.json";
        let imageMode = true;
        if (fs.existsSync(bankPath)) {
            try {
                const bd = JSON.parse(fs.readFileSync(bankPath, "utf8"));
                if (bd[uid]?.imageMode === false) imageMode = false;
            } catch {}
        }

        if (imageMode) {
            try {
                const [username, avatarUrl] = await Promise.all([
                    getUserName(uid, api),
                    getUserAvatar(uid, api),
                ]);
                const img = await generateSlotCard({
                    username, bet: amount, win,
                    winAmount: win ? winAmount : -winAmount,
                    newBalance, slots: [s1, s2, s3],
                    multiplier, rank,
                    remainingSpins: updated.spins,
                    avatarUrl,
                });
                const imgPath = `./slot_card_${uid}_${Date.now()}.png`;
                fs.writeFileSync(imgPath, img);
                await message.reply({ body: "🎰 Votre carte de résultat :", attachment: fs.createReadStream(imgPath) });
                setTimeout(() => {
                    try { fs.unlinkSync(imgPath); } catch (e) {}
                }, 5000);
            } catch (err) {
                console.error("Erreur carte:", err);
            }
        }
    }
};