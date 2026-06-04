const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const CASH_URL   = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";

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

function rollDice() {
    return [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
    ];
}

const DICE_EMOJI = { 1:"⚀", 2:"⚁", 3:"⚂", 4:"⚃", 5:"⚄", 6:"⚅" };

function evaluateBet(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
    const isDouble = !isTriple && (
        dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]
    );
    
    switch (betType) {
        case "petit": 
            return !isTriple && sum >= 4 && sum <= 10;
        case "grand": 
            return !isTriple && sum >= 11 && sum <= 17;
        case "total": 
            return sum === betValue;
        case "triple": 
            return isTriple && (betValue === "any" || dice[0] === betValue);
        case "double":
            if (isDouble) {
                const counts = {};
                dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
                return betValue === "any" || counts[betValue] >= 2;
            }
            return false;
        case "simple": 
            return dice.includes(betValue);
        case "combo": 
            return dice.includes(betValue[0]) && dice.includes(betValue[1]) && betValue[0] !== betValue[1];
        default: 
            return false;
    }
}

const TOTAL_PAYOUTS = { 4:60, 5:30, 6:18, 7:12, 8:8, 9:7, 10:6, 11:6, 12:7, 13:8, 14:12, 15:18, 16:30, 17:60 };

function getPayout(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    if (betType === "total")  return TOTAL_PAYOUTS[sum] || 0;
    if (betType === "triple") return betValue === "any" ? 30 : 180;
    if (betType === "double") return betValue === "any" ? 5 : 10;
    if (betType === "simple") return 3;
    if (betType === "combo")  return 7;
    return 2;
}

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const line of lines) {
        if (line === "---") { out += "├─────────────•┈┈\n"; continue; }
        out += `│ ${line}\n`;
    }
    return out + "╰─────────────•┈┈";
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

async function generateSicboCard({ username, betDisplay, bet, win, winAmount, newBalance, dice, sum, isTriple, payout, avatarUrl }) {
    const W = 680, H = 420;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.85);
    bg.addColorStop(0, "#0e1a14");
    bg.addColorStop(1, "#050d08");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let x = 20; x < W; x += 28)
        for (let y = 20; y < H; y += 28)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, win ? "#50c878" : "#c05050");
    borderGrad.addColorStop(0.5, win ? "#1a7a40" : "#7a1a1a");
    borderGrad.addColorStop(1, win ? "#50c878" : "#c05050");
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, "rgba(80,200,120,0.15)");
    headerGrad.addColorStop(0.5, "rgba(80,200,120,0.06)");
    headerGrad.addColorStop(1, "rgba(80,200,120,0.15)");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(10, 10, W - 20, 58);

    ctx.font = "bold 20px 'Courier New'";
    ctx.fillStyle = "#50c878";
    ctx.fillText("🎲 HEDGEHOG SIC BO", 30, 48);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(80,200,120,0.55)";
    ctx.fillText("CASINO • PREMIUM", 32, 62);

    const ax = W - 55, ay = 50;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 32, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 32, ay - 32, 64, 64);
    } catch {
        ctx.fillStyle = "#0a1f10";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 33, 0, Math.PI * 2);
    ctx.strokeStyle = "#50c878";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "bold 13px 'Courier New'";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(username.toUpperCase().substring(0, 20), 30, 98);
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("JOUEUR", 30, 112);

    const diceZoneX = 30, diceZoneY = 128, diceZoneW = W - 60, diceZoneH = 110;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, diceZoneX, diceZoneY, diceZoneW, diceZoneH, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(80,200,120,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const diceSize = 80, diceGap = 30;
    const totalDiceW = 3 * diceSize + 2 * diceGap;
    const startX = (W - totalDiceW) / 2;
    const diceY = diceZoneY + (diceZoneH - diceSize) / 2;

    for (let i = 0; i < 3; i++) {
        const dx = startX + i * (diceSize + diceGap);
        const diceBg = ctx.createLinearGradient(dx, diceY, dx, diceY + diceSize);
        diceBg.addColorStop(0, "#1a2e20");
        diceBg.addColorStop(1, "#0d1a10");
        ctx.fillStyle = diceBg;
        roundRect(ctx, dx, diceY, diceSize, diceSize, 10);
        ctx.fill();
        ctx.strokeStyle = isTriple ? "rgba(255,215,0,0.7)" : "rgba(80,200,120,0.4)";
        ctx.lineWidth = isTriple ? 2 : 1.5;
        ctx.stroke();
        ctx.font = "44px 'Segoe UI Emoji'";
        ctx.textAlign = "center";
        ctx.fillText(DICE_EMOJI[dice[i]], dx + diceSize / 2, diceY + diceSize / 2 + 17);
        ctx.textAlign = "left";
    }

    if (isTriple) {
        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = "#ffd700";
        ctx.textAlign = "center";
        ctx.fillText("✦ TRIPLE ! ✦", W / 2, diceZoneY + diceZoneH - 8);
        ctx.textAlign = "left";
    }

    const resultLabel = win
        ? (payout >= 30 ? "JACKPOT 🎰" : payout >= 10 ? "GRANDE VICTOIRE !" : "VICTOIRE !")
        : "PERDU";
    ctx.font = "bold 22px 'Courier New'";
    ctx.fillStyle = win ? "#6eff9e" : "#ff6e6e";
    ctx.textAlign = "center";
    ctx.fillText(resultLabel, W / 2, diceZoneY + diceZoneH + 38);
    ctx.textAlign = "left";

    ctx.strokeStyle = "rgba(80,200,120,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, diceZoneY + diceZoneH + 50);
    ctx.lineTo(W - 30, diceZoneY + diceZoneH + 50);
    ctx.stroke();

    const statsY = diceZoneY + diceZoneH + 72;
    const cols = [
        { label: "MISE",   value: `${await formatNumber(bet)}$`,                                           color: "#aaaaff" },
        { label: "PARI",   value: betDisplay.length > 12 ? betDisplay.substring(0, 11) + "…" : betDisplay, color: "#80d4ff" },
        { label: win ? "GAIN" : "PERTE", value: win ? `+${await formatNumber(winAmount)}$` : `-${await formatNumber(bet)}$`, color: win ? "#6eff9e" : "#ff6e6e" },
        { label: "SOLDE",  value: `${await formatNumber(newBalance)}$`,                                     color: "#50c878" },
    ];

    const colW = (W - 60) / 4;
    for (let i = 0; i < cols.length; i++) {
        const cx = 30 + i * colW;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, cx + 4, statsY - 16, colW - 8, 52, 7);
        ctx.fill();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(cols[i].label, cx + 10, statsY);
        ctx.font = `bold ${cols[i].value.length > 10 ? "11" : "14"}px 'Courier New'`;
        ctx.fillStyle = cols[i].color;
        ctx.fillText(cols[i].value, cx + 10, statsY + 24);
    }

    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText(`TOTAL DES DÉS : ${sum}`, 30, H - 44);

    ctx.fillStyle = "rgba(80,200,120,0.28)";
    ctx.font = "8px 'Courier New'";
    const d = new Date();
    ctx.fillText(
        `HEDGEHOG SIC BO • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
        30, H - 18
    );

    return canvas.toBuffer("image/png");
}

module.exports = {
    config: {
        name: "sicbo",
        version: "7.0",
        author: "Itachi Soma",
        countDown: 3,
        role: 0,
        category: "fun",
        shortDescription: { en: "Sic Bo - Jeu des 3 dés" },
        longDescription: { en: "🎲 Sic Bo avec paris variés. Triple x180, Combo x7, Petit/Grand x2..." }
    },

    onStart: async function ({ args, message, event, api, usersData }) {
        const uid = String(event.senderID);
        const p   = global.utils.getPrefix(event.threadID);
        const sub = args[0]?.toLowerCase();

        const bankPath = "./bank.json";
        let imageMode = true;
        if (fs.existsSync(bankPath)) {
            try {
                const bd = JSON.parse(fs.readFileSync(bankPath, "utf8"));
                if (bd[uid]?.imageMode === false) imageMode = false;
            } catch {}
        }

        const userMoney = await getUserCash(uid);

        if (!sub || sub === "help") {
            return message.reply(S([
                "🎲 SIC BO — 3 DÉS",
                "---",
                `${p}sicbo petit <mise>    → x2`,
                `${p}sicbo grand <mise>    → x2`,
                `${p}sicbo total <mise> <4-17>`,
                `${p}sicbo triple <mise> [1-6/any]`,
                `${p}sicbo double <mise> [1-6/any]`,
                `${p}sicbo simple <mise> <1-6> → x3`,
                `${p}sicbo combo <mise> <1-6> <1-6> → x7`,
                `${p}sicbo bonus`,
                "---",
                "💎 Triple spécifique x180",
                "💎 Triple quelconque x30",
                "💎 Total extrême (4/17) x60",
                "---",
                `💰 Solde : ${await formatNumber(userMoney)}$`,
            ]));
        }

        if (sub === "balance" || sub === "solde") {
            return message.reply(S([`💰 Solde : ${await formatNumber(userMoney)}$`]));
        }

        if (sub === "bonus") {
            const now = Date.now();
            const dayMs = 86400000;
            const userData = (await usersData?.get(uid)) || {};
            const lastBonus = userData.lastBonus || 0;
            if (now - lastBonus < dayMs) {
                const remaining = Math.ceil((dayMs - (now - lastBonus)) / 3600000);
                return message.reply(S(["🎁 Bonus déjà reçu !", `⏳ Prochain dans ${remaining}h`]));
            }
            await updateUserCash(uid, 200n);
            const newBalance = await getUserCash(uid);
            if (usersData) await usersData.set(uid, { ...userData, lastBonus: now });
            return message.reply(S(["🎁 BONUS QUOTIDIEN", "---", "✨ +200$", `💰 Solde : ${await formatNumber(newBalance)}$`]));
        }

        const betType = sub;
        const validTypes = ["petit", "grand", "total", "triple", "double", "simple", "combo"];
        if (!validTypes.includes(betType)) {
            return message.reply(S(["❌ Type de pari inconnu", `📝 ${p}sicbo help`]));
        }

        const amount = await parseAmount(args[1]);
        if (amount <= 0n) {
            return message.reply(S(["❌ Montant invalide", "Exemples : 50k, 1.5M, 2B, 100T, 10Qa"]));
        }
        if (amount > userMoney) {
            return message.reply(S([
                "❌ Fonds insuffisants",
                "---",
                `💰 Solde : ${await formatNumber(userMoney)}$`,
                `🎲 Mise   : ${await formatNumber(amount)}$`,
            ]));
        }

        let betValue = null;
        if (betType === "total") {
            betValue = parseInt(args[2]);
            if (isNaN(betValue) || betValue < 4 || betValue > 17)
                return message.reply(S(["❌ Total invalide → entre 4 et 17"]));
        }
        if (betType === "triple" || betType === "double") {
            betValue = args[2] || "any";
            if (betValue !== "any" && (parseInt(betValue) < 1 || parseInt(betValue) > 6))
                return message.reply(S(["❌ Valeur invalide → 1-6 ou any"]));
            if (betValue !== "any") betValue = parseInt(betValue);
        }
        if (betType === "simple") {
            betValue = parseInt(args[2]);
            if (isNaN(betValue) || betValue < 1 || betValue > 6)
                return message.reply(S(["❌ Valeur invalide → 1 à 6"]));
        }
        if (betType === "combo") {
            const n1 = parseInt(args[2]), n2 = parseInt(args[3]);
            if (isNaN(n1) || isNaN(n2) || n1 < 1 || n1 > 6 || n2 < 1 || n2 > 6 || n1 === n2)
                return message.reply(S(["❌ Combinaison invalide → 2 chiffres différents 1-6"]));
            betValue = [n1, n2];
        }

        const updateSuccess = await updateUserCash(uid, -amount);
        if (!updateSuccess) {
            return message.reply(S(["❌ Erreur lors du prélèvement"]));
        }

        const dice = rollDice();
        const sum = dice[0] + dice[1] + dice[2];
        const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
        const diceDisplay = dice.map(d => DICE_EMOJI[d]).join("  ");

        const realWin = evaluateBet(betType, betValue, dice);
        let win = false;
        
        if (realWin) {
            win = true;
        } else {
            let secondChanceThreshold = 0.45;
            
            if (betType === "total") {
                secondChanceThreshold = 0.48;
            } else if (betType === "triple") {
                secondChanceThreshold = 0.49;
            } else if (betType === "combo") {
                secondChanceThreshold = 0.42;
            }
            
            if (Math.random() < secondChanceThreshold) {
                win = true;
            }
        }

        const payout = win ? getPayout(betType, betValue, dice) : 0;
        const winAmount = win ? amount * BigInt(payout) : 0n;

        if (win) await updateUserCash(uid, winAmount);
        const newBalance = await getUserCash(uid);

        let betDisplay = "";
        if (betType === "total")  betDisplay = `Total = ${betValue}`;
        else if (betType === "triple") betDisplay = `Triple ${betValue === "any" ? "any" : betValue}`;
        else if (betType === "double") betDisplay = `Double ${betValue === "any" ? "any" : betValue}`;
        else if (betType === "simple") betDisplay = `Numéro ${betValue}`;
        else if (betType === "combo")  betDisplay = `Combo ${betValue[0]}+${betValue[1]}`;
        else betDisplay = betType === "petit" ? "Petit (4-10)" : "Grand (11-17)";

        const [fBet, fNew, fWin] = await Promise.all([
            formatNumber(amount),
            formatNumber(newBalance),
            formatNumber(winAmount),
        ]);

        await message.reply(S([
            "🎲 SIC BO — RÉSULTAT",
            "---",
            `🎲 Dés : ${diceDisplay}`,
            `📊 Total : ${sum}${isTriple ? "  ✦ TRIPLE !" : ""}`,
            "---",
            `📋 Pari : ${betDisplay}`,
            `💰 Mise : ${fBet}$`,
            "---",
            win
                ? `🎉 VICTOIRE — +${fWin}$ (x${payout})`
                : `💀 PERDU — -${fBet}$`,
            `💳 Solde : ${fNew}$`,
        ]));

        if (imageMode) {
            try {
                const [username, avatarUrl] = await Promise.all([
                    getUserName(uid, api),
                    getUserAvatar(uid, api),
                ]);
                const img = await generateSicboCard({
                    username, betDisplay, bet: amount, win,
                    winAmount, newBalance, dice, sum, isTriple, payout, avatarUrl,
                });
                const imgPath = `./sicbo_card_${uid}_${Date.now()}.png`;
                fs.writeFileSync(imgPath, img);
                await message.reply({ body: "🎲 Votre carte de résultat :", attachment: fs.createReadStream(imgPath) });
                setTimeout(() => {
                    try { fs.unlinkSync(imgPath); } catch (e) {}
                }, 5000);
            } catch (err) {
                console.error("Erreur carte:", err);
            }
        }
    }
};