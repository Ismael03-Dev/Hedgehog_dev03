const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";
const CASH_URL   = "https://cash-api-five.vercel.app/api/cash";

const MAX_LIMIT = 10n ** 261n;

const STATS_FILE = path.join(__dirname, "tictactoe_stats.json");
const ASSETS_DIR = path.join(__dirname, "tictactoe_assets");

const BOT_UID  = global.botID;
const BOT_NAME = "Hedgehog GPT";

let games        = {};
let tournaments  = {};
let playerStats  = loadStats();
const playerCache       = new Map();
const imageModeByThread = {};

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function loadStats() {
    try { if (fs.existsSync(STATS_FILE)) return JSON.parse(fs.readFileSync(STATS_FILE, "utf8") || "{}"); }
    catch { return {}; }
    return {};
}
function saveStats() {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(playerStats, null, 2)); } catch {}
}
function ensurePlayerStats(id) {
    if (!playerStats[id]) playerStats[id] = { wins: 0, losses: 0, draws: 0, played: 0 };
}

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

function checkWinner(board) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of wins)
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    return null;
}
function isBoardFull(board) { return board.every(c => c !== null); }
function displayBoard(board) {
    let d = "";
    for (let i = 0; i < 9; i++) {
        d += board[i] === "❌" ? "❌" : board[i] === "⭕" ? "⭕" : "⬜";
        d += (i + 1) % 3 === 0 ? "\n" : " ";
    }
    return d;
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

async function getPlayerInfo(uid, usersData) {
    if (uid === "AI") {
        try {
            const avatar = await loadImage(`https://graph.facebook.com/${BOT_UID}/picture?width=512&height=512`);
            return { avatar, name: BOT_NAME, uid: "AI" };
        } catch { return { avatar: null, name: BOT_NAME, uid: "AI" }; }
    }
    const nuid = Number(uid);
    if (isNaN(nuid)) return { avatar: null, name: `Joueur ${uid}`, uid };
    if (playerCache.has(nuid)) return playerCache.get(nuid);
    try {
        const avatar = await loadImage(`https://graph.facebook.com/${nuid}/picture?width=512&height=512`);
        const name   = (await usersData.getName(nuid)) || `Joueur ${nuid}`;
        const info   = { avatar, name, uid: nuid };
        playerCache.set(nuid, info);
        setTimeout(() => playerCache.delete(nuid), 300000);
        return info;
    } catch {
        const info = { avatar: null, name: `Joueur ${nuid}`, uid: nuid };
        playerCache.set(nuid, info);
        return info;
    }
}

function resetGame(gameID, p1, p2, opts = {}) {
    const imageMode = opts.imageMode !== undefined ? opts.imageMode : imageModeByThread[opts.threadID] || false;
    games[gameID] = {
        board: Array(9).fill(null),
        players: [
            { id: p1.id, name: p1.name || `Joueur ${p1.id}`, symbol: "❌" },
            { id: p2.id, name: p2.name || `Joueur ${p2.id}`, symbol: "⭕" },
        ],
        currentPlayerIndex: 0,
        inProgress: true,
        isMathChallenge: false,
        threadID: opts.threadID || p1.threadID || null,
        isTournamentGame: !!opts.isTournamentGame,
        tournamentID: opts.tournamentID || null,
        matchIndex: opts.matchIndex != null ? opts.matchIndex : null,
        isAI: !!opts.isAI,
        aiDifficulty: opts.aiDifficulty || "normal",
        imageMode,
        moves: [],
        bets: opts.bets || null,
        odds: opts.odds || null,
    };
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

async function generateBoardImage(board, currentPlayer, players, usersData, gameType = "normal", bets = null, odds = null) {
    const W = 1400, H = 1060;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050f");
    bg.addColorStop(0.5, "#0f0d20");
    bg.addColorStop(1, "#070515");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 34)
        for (let y = 0; y < H; y += 34)
            ctx.fillRect(x, y, 1.5, 1.5);

    if (gameType === "tournament") {
        ctx.font = "bold 44px 'Courier New'";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 18;
        ctx.fillText("✦ TOURNOI ÉLITE ✦", W / 2, 68);
        ctx.shadowBlur = 0;
    } else {
        ctx.font = "bold 44px 'Courier New'";
        ctx.fillStyle = "#818cf8";
        ctx.textAlign = "center";
        ctx.shadowColor = "#818cf8";
        ctx.shadowBlur = 16;
        ctx.fillText("✦ MORPION ULTIMATE ✦", W / 2, 68);
        ctx.shadowBlur = 0;
    }

    const playerInfos = await Promise.all(players.map(p => getPlayerInfo(p.id, usersData)));

    const BOARD_SIZE = 540;
    const bx = W / 2 - BOARD_SIZE / 2;
    const by = 130;

    ctx.fillStyle = "rgba(15,12,35,0.85)";
    roundRect(ctx, bx - 18, by - 18, BOARD_SIZE + 36, BOARD_SIZE + 36, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(129,140,248,0.5)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
        ctx.moveTo(bx + (BOARD_SIZE / 3) * i, by);
        ctx.lineTo(bx + (BOARD_SIZE / 3) * i, by + BOARD_SIZE);
        ctx.moveTo(bx, by + (BOARD_SIZE / 3) * i);
        ctx.lineTo(bx + BOARD_SIZE, by + (BOARD_SIZE / 3) * i);
    }
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3), col = i % 3;
        const cx = bx + col * (BOARD_SIZE / 3) + BOARD_SIZE / 6;
        const cy = by + row * (BOARD_SIZE / 3) + BOARD_SIZE / 6;
        if (board[i] === "❌") {
            ctx.font = "bold 100px 'Courier New'";
            ctx.shadowColor = "#f87171"; ctx.shadowBlur = 22;
            ctx.fillStyle = "#f87171"; ctx.fillText("❌", cx, cy);
            ctx.shadowBlur = 0;
        } else if (board[i] === "⭕") {
            ctx.font = "bold 100px 'Courier New'";
            ctx.shadowColor = "#34d399"; ctx.shadowBlur = 22;
            ctx.fillStyle = "#34d399"; ctx.fillText("⭕", cx, cy);
            ctx.shadowBlur = 0;
        } else {
            ctx.font = "bold 28px 'Courier New'";
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            ctx.fillText(String(i + 1), cx, cy);
        }
    }
    ctx.textBaseline = "alphabetic";

    const PANEL_W = 320, PANEL_H = 480;
    for (let i = 0; i < 2; i++) {
        const info       = playerInfos[i];
        const pdata      = players[i];
        const isCurrent  = currentPlayer?.id === pdata.id;
        const px = i === 0 ? 55 : W - PANEL_W - 55;
        const py = 120;

        const panelG = ctx.createLinearGradient(px, py, px, py + PANEL_H);
        panelG.addColorStop(0, isCurrent ? "rgba(99,102,241,0.22)" : "rgba(20,18,45,0.7)");
        panelG.addColorStop(1, isCurrent ? "rgba(99,102,241,0.08)" : "rgba(10,8,25,0.7)");
        ctx.fillStyle = panelG;
        roundRect(ctx, px, py, PANEL_W, PANEL_H, 24);
        ctx.fill();
        ctx.strokeStyle = isCurrent ? "#818cf8" : "rgba(255,255,255,0.12)";
        ctx.lineWidth   = isCurrent ? 2.5 : 1.5;
        ctx.stroke();

        if (info.avatar) {
            const ax = px + PANEL_W / 2, ay = py + 100;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ax, ay, 70, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(info.avatar, ax - 70, ay - 70, 140, 140);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(ax, ay, 72, 0, Math.PI * 2);
            ctx.strokeStyle = pdata.symbol === "❌" ? "#f87171" : "#34d399";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.font = "bold 26px 'Courier New'";
        ctx.fillStyle = isCurrent ? "#e0e7ff" : "#9ca3af";
        ctx.textAlign = "center";
        ctx.fillText(info.name.substring(0, 18), px + PANEL_W / 2, py + 200);

        ctx.font = "bold 52px 'Courier New'";
        ctx.shadowColor = pdata.symbol === "❌" ? "#f87171" : "#34d399";
        ctx.shadowBlur = 18;
        ctx.fillStyle  = pdata.symbol === "❌" ? "#f87171" : "#34d399";
        ctx.fillText(pdata.symbol, px + PANEL_W / 2, py + 270);
        ctx.shadowBlur = 0;

        if (bets && odds) {
            const betKey = pdata.id;
            const betAmt = bets?.[betKey];
            const odd    = odds?.[betKey];
            if (betAmt !== undefined) {
                ctx.font = "bold 16px 'Courier New'";
                ctx.fillStyle = "#fbbf24";
                ctx.fillText(`Mise : ${await formatNumber(toBigInt(betAmt))}$`, px + PANEL_W / 2, py + 310);
                if (odd) {
                    ctx.fillStyle = "#86efac";
                    ctx.fillText(`Côte : x${odd}`, px + PANEL_W / 2, py + 334);
                    const potential = Math.floor(Number(toBigInt(betAmt)) * odd);
                    ctx.fillStyle = "#c4b5fd";
                    ctx.fillText(`Gain pot. : ${await formatNumber(toBigInt(potential))}$`, px + PANEL_W / 2, py + 358);
                }
            }
        }

        if (isCurrent) {
            ctx.font = "bold 22px 'Courier New'";
            ctx.fillStyle = "#818cf8";
            ctx.shadowColor = "#818cf8";
            ctx.shadowBlur = 10;
            ctx.fillText("⮞ À SON TOUR", px + PANEL_W / 2, py + PANEL_H - 30);
            ctx.shadowBlur = 0;
        }
    }
    ctx.textAlign = "left";

    if (currentPlayer) {
        ctx.font = "bold 34px 'Courier New'";
        ctx.fillStyle = "#e0e7ff";
        ctx.textAlign = "center";
        ctx.fillText(`Tour de : ${currentPlayer.name}`, W / 2, by + BOARD_SIZE + 52);

        const avail = board.map((c, idx) => c === null ? idx + 1 : null).filter(Boolean);
        ctx.font = "22px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(`Cases : ${avail.join(" · ")}`, W / 2, by + BOARD_SIZE + 86);
    }

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = "rgba(129,140,248,0.3)";
    ctx.textAlign = "center";
    ctx.fillText("HEDGEHOG MORPION • ULTIMATE", W / 2, H - 12);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateEndGameImage(board, winner, players, usersData, isDraw, gainInfo = null) {
    const W = 1400, H = 1000;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, isDraw ? "#050d18" : winner ? "#06100a" : "#100506");
    bg.addColorStop(1, "#07050f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 34)
        for (let y = 0; y < H; y += 34)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, isDraw ? "#60a5fa" : winner ? "#34d399" : "#f87171");
    borderG.addColorStop(1, isDraw ? "#3b82f6" : winner ? "#10b981" : "#ef4444");
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 3;
    roundRect(ctx, 10, 10, W - 20, H - 20, 20);
    ctx.stroke();

    const playerInfos = await Promise.all(players.map(p => getPlayerInfo(p.id, usersData)));

    const BOARD_SIZE = 460;
    const bx = W / 2 - BOARD_SIZE / 2;
    const by = 100;

    ctx.fillStyle = "rgba(10,8,25,0.85)";
    roundRect(ctx, bx - 16, by - 16, BOARD_SIZE + 32, BOARD_SIZE + 32, 18);
    ctx.fill();
    ctx.strokeStyle = isDraw ? "#60a5fa" : "#fbbf24";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = isDraw ? "#60a5fa" : "#fbbf24";
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
        ctx.moveTo(bx + (BOARD_SIZE / 3) * i, by);
        ctx.lineTo(bx + (BOARD_SIZE / 3) * i, by + BOARD_SIZE);
        ctx.moveTo(bx, by + (BOARD_SIZE / 3) * i);
        ctx.lineTo(bx + BOARD_SIZE, by + (BOARD_SIZE / 3) * i);
    }
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3), col = i % 3;
        const cx = bx + col * (BOARD_SIZE / 3) + BOARD_SIZE / 6;
        const cy = by + row * (BOARD_SIZE / 3) + BOARD_SIZE / 6;
        if (board[i] === "❌") {
            ctx.font = "bold 88px 'Courier New'";
            ctx.shadowColor = "#f87171"; ctx.shadowBlur = 20;
            ctx.fillStyle = "#f87171"; ctx.fillText("❌", cx, cy);
            ctx.shadowBlur = 0;
        } else if (board[i] === "⭕") {
            ctx.font = "bold 88px 'Courier New'";
            ctx.shadowColor = "#34d399"; ctx.shadowBlur = 20;
            ctx.fillStyle = "#34d399"; ctx.fillText("⭕", cx, cy);
            ctx.shadowBlur = 0;
        }
    }
    ctx.textBaseline = "alphabetic";

    const PANEL_W = 300, PANEL_H = 180;
    for (let i = 0; i < 2; i++) {
        const info    = playerInfos[i];
        const pdata   = players[i];
        const isWin   = winner?.id === pdata.id;
        const px = i === 0 ? 80 : W - PANEL_W - 80;
        const py = by + BOARD_SIZE + 55;

        ctx.fillStyle = isWin ? "rgba(251,191,36,0.18)" : "rgba(20,18,45,0.7)";
        roundRect(ctx, px, py, PANEL_W, PANEL_H, 18);
        ctx.fill();
        ctx.strokeStyle = isWin ? "#fbbf24" : "rgba(255,255,255,0.12)";
        ctx.lineWidth   = isWin ? 2.5 : 1.5;
        ctx.stroke();

        if (info.avatar) {
            const ax = px + 55, ay = py + PANEL_H / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(ax, ay, 44, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(info.avatar, ax - 44, ay - 44, 88, 88);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(ax, ay, 46, 0, Math.PI * 2);
            ctx.strokeStyle = pdata.symbol === "❌" ? "#f87171" : "#34d399";
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.font = "bold 22px 'Courier New'";
        ctx.fillStyle = isWin ? "#fbbf24" : "#e0e7ff";
        ctx.textAlign = "left";
        ctx.fillText(info.name.substring(0, 16), px + 112, py + 48);

        ctx.font = "bold 36px 'Courier New'";
        ctx.fillStyle = pdata.symbol === "❌" ? "#f87171" : "#34d399";
        ctx.fillText(pdata.symbol, px + 112, py + 96);

        if (isWin) {
            ctx.font = "bold 20px 'Courier New'";
            ctx.fillStyle = "#fbbf24";
            ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 10;
            ctx.fillText("🏆 GAGNANT", px + 112, py + 138);
            ctx.shadowBlur = 0;
        }
    }
    ctx.textAlign = "left";

    const resultY = by + BOARD_SIZE + 30;
    ctx.font = "bold 58px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillStyle = isDraw ? "#60a5fa" : "#fbbf24";
    ctx.shadowColor = isDraw ? "#60a5fa" : "#fbbf24";
    ctx.shadowBlur = 24;
    ctx.fillText(isDraw ? "═══ MATCH NUL ═══" : `═══ VICTOIRE ═══`, W / 2, resultY);
    if (!isDraw && winner) {
        ctx.font = "bold 42px 'Courier New'";
        ctx.fillText(winner.name, W / 2, resultY + 52);
    }
    ctx.shadowBlur = 0;

    if (gainInfo) {
        const gainY = by + BOARD_SIZE + 260;
        ctx.fillStyle = "rgba(16,185,129,0.12)";
        roundRect(ctx, W / 2 - 340, gainY - 30, 680, 120, 14);
        ctx.fill();
        ctx.strokeStyle = "rgba(16,185,129,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = "bold 20px 'Courier New'";
        ctx.fillStyle = "#6ee7b7";
        ctx.textAlign = "center";
        ctx.fillText(gainInfo.line1, W / 2, gainY + 10);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 26px 'Courier New'";
        ctx.fillText(gainInfo.line2, W / 2, gainY + 50);
        ctx.fillStyle = "#c4b5fd";
        ctx.font = "18px 'Courier New'";
        ctx.fillText(gainInfo.line3, W / 2, gainY + 82);
    }

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = "rgba(129,140,248,0.3)";
    ctx.textAlign = "center";
    ctx.fillText("HEDGEHOG MORPION • ULTIMATE", W / 2, H - 14);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateTournamentBracketImage(tournament, usersData) {
    const W = 2000, H = 1600;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050f"); bg.addColorStop(1, "#0f0d20");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 34)
        for (let y = 0; y < H; y += 34)
            ctx.fillRect(x, y, 1.5, 1.5);

    ctx.font = "bold 64px 'Courier New'";
    ctx.fillStyle = "#fbbf24"; ctx.textAlign = "center";
    ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 28;
    ctx.fillText("🏆 TOURNOI ÉLITE — BRACKET", W / 2, 90);
    ctx.shadowBlur = 0;
    ctx.font = "bold 32px 'Courier New'";
    ctx.fillStyle = "#e0e7ff";
    ctx.fillText(`Statut : ${getTournamentStatus(tournament)}`, W / 2, 148);

    if (tournament.status === "registration") {
        ctx.font = "bold 52px 'Courier New'";
        ctx.fillStyle = "#818cf8";
        ctx.fillText("EN ATTENTE DE JOUEURS", W / 2, H / 2 - 100);
        ctx.font = "bold 38px 'Courier New'";
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(`Inscrits : ${tournament.players.length} / ${tournament.requiredPlayers}`, W / 2, H / 2);
        let yList = H / 2 + 80;
        ctx.font = "28px 'Courier New'"; ctx.fillStyle = "#e0e7ff";
        tournament.players.forEach((p, i) => { ctx.fillText(`${i+1}. ${p.name}`, W / 2, yList + i * 44); });
        return canvas.toBuffer("image/png");
    }

    const roundCount = tournament.rounds.length;
    const colW       = (W - 200) / roundCount;
    const positions  = {};

    for (let r = 0; r < roundCount; r++) {
        const round = tournament.rounds[r];
        const x     = 100 + r * colW;
        ctx.font = "bold 34px 'Courier New'";
        ctx.fillStyle = r === tournament.currentRoundIndex ? "#fbbf24" : "#818cf8";
        ctx.textAlign = "center";
        ctx.fillText(round.name.toUpperCase(), x + 150, 220);

        positions[r] = [];
        for (let m = 0; m < round.matches.length; m++) {
            const match = round.matches[m];
            let y;
            if (r === 0) {
                const spacing = (H - 340) / round.matches.length;
                y = 340 + m * spacing + spacing / 2 - 55;
            } else {
                const p1 = positions[r-1][m*2], p2 = positions[r-1][m*2+1];
                y = (p1 && p2) ? (p1.y + p2.y) / 2 : 340 + m * 200;
            }
            positions[r].push({ x, y });

            const p1   = tournament.players.find(p => p.id === match.player1);
            const p2   = tournament.players.find(p => p.id === match.player2);
            const bW   = 300, bH = 110;

            if (r > 0) {
                const pa1 = positions[r-1][m*2], pa2 = positions[r-1][m*2+1];
                ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 2;
                ctx.beginPath();
                if (pa1) { ctx.moveTo(pa1.x + bW, pa1.y + bH/2); ctx.lineTo(x, y + bH/2); }
                if (pa2) { ctx.moveTo(pa2.x + bW, pa2.y + bH/2); ctx.lineTo(x, y + bH/2); }
                ctx.stroke();
            }

            ctx.fillStyle = match.completed ? "rgba(16,18,45,0.9)" : "rgba(20,18,50,0.8)";
            roundRect(ctx, x, y, bW, bH, 12); ctx.fill();
            ctx.strokeStyle = match.completed ? (match.winner ? "#34d399" : "#fbbf24") : "#818cf8";
            ctx.lineWidth = 3; ctx.stroke();

            ctx.font = "bold 22px 'Courier New'"; ctx.textAlign = "left";
            ctx.fillStyle = match.winner === match.player1 ? "#34d399" : "#e0e7ff";
            ctx.fillText((p1?.name || "???").substring(0, 14), x + 14, y + 38);
            ctx.fillStyle = match.winner === match.player2 ? "#34d399" : "#e0e7ff";
            ctx.fillText((p2?.name || "???").substring(0, 14), x + 14, y + 82);
            if (match.completed && match.winner) {
                ctx.font = "24px 'Courier New'"; ctx.fillStyle = "#fbbf24";
                ctx.fillText("👑", x + 262, match.winner === match.player1 ? y + 38 : y + 82);
            }
        }
    }

    if (tournament.winner) {
        const w = tournament.players.find(p => p.id === tournament.winner);
        ctx.font = "bold 64px 'Courier New'"; ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center"; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 36;
        ctx.fillText(`👑 ${w?.name || "Champion"} 👑`, W / 2, H - 80);
        ctx.shadowBlur = 0;
    }

    return canvas.toBuffer("image/png");
}

function getTournamentStatus(t) {
    const map = { registration: "⏳ INSCRIPTION", in_progress: "⚡ EN COURS", completed: "✅ TERMINÉ" };
    return map[t.status] || "❓";
}

async function generateStatsImage(pid, usersData) {
    const W = 1400, H = 900;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050f"); bg.addColorStop(1, "#0f0d20");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 34)
        for (let y = 0; y < H; y += 34)
            ctx.fillRect(x, y, 1.5, 1.5);

    ctx.strokeStyle = "rgba(129,140,248,0.3)"; ctx.lineWidth = 2;
    roundRect(ctx, 10, 10, W - 20, H - 20, 20); ctx.stroke();

    const info  = await getPlayerInfo(pid, usersData);
    const stats = playerStats[pid] || { wins: 0, losses: 0, draws: 0, played: 0 };
    const wr    = stats.played > 0 ? Math.round(stats.wins / stats.played * 100) : 0;

    ctx.font = "bold 56px 'Courier New'"; ctx.fillStyle = "#818cf8";
    ctx.textAlign = "center"; ctx.shadowColor = "#818cf8"; ctx.shadowBlur = 20;
    ctx.fillText("✦ STATISTIQUES MORPION", W / 2, 90); ctx.shadowBlur = 0;

    if (info.avatar) {
        ctx.save();
        ctx.beginPath(); ctx.arc(W / 2, 310, 110, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(info.avatar, W / 2 - 110, 200, 220, 220);
        ctx.restore();
        ctx.beginPath(); ctx.arc(W / 2, 310, 112, 0, Math.PI * 2);
        ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 5; ctx.stroke();
    }

    ctx.font = "bold 44px 'Courier New'"; ctx.fillStyle = "#e0e7ff";
    ctx.textAlign = "center"; ctx.fillText(info.name, W / 2, 490);

    const items = [
        { label: "🏆 Victoires", val: stats.wins,   color: "#34d399" },
        { label: "💀 Défaites",  val: stats.losses, color: "#f87171" },
        { label: "🤝 Nuls",      val: stats.draws,  color: "#60a5fa" },
        { label: "🎮 Parties",   val: stats.played, color: "#fbbf24" },
    ];
    const colW2 = (W - 120) / 4;
    const sy    = 540;
    for (let i = 0; i < items.length; i++) {
        const cx = 60 + i * colW2;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        roundRect(ctx, cx + 4, sy - 18, colW2 - 8, 80, 10); ctx.fill();
        ctx.strokeStyle = items[i].color + "55"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = "16px 'Courier New'"; ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.textAlign = "center"; ctx.fillText(items[i].label, cx + colW2 / 2, sy + 10);
        ctx.font = "bold 32px 'Courier New'"; ctx.fillStyle = items[i].color;
        ctx.fillText(String(items[i].val), cx + colW2 / 2, sy + 52);
    }

    const barY = 670, barW = W - 120;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 60, barY, barW, 18, 9); ctx.fill();
    if (stats.played > 0) {
        const pct  = stats.wins / stats.played;
        const barG = ctx.createLinearGradient(60, 0, 60 + barW * pct, 0);
        barG.addColorStop(0, "#34d399"); barG.addColorStop(1, "#10b981");
        ctx.fillStyle = barG;
        roundRect(ctx, 60, barY, Math.max(barW * pct, 12), 18, 9); ctx.fill();
    }
    ctx.font = "16px 'Courier New'"; ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left"; ctx.fillText(`RATIO VICTOIRES : ${wr}%`, 60, barY - 8);

    ctx.font = "8px 'Courier New'"; ctx.fillStyle = "rgba(129,140,248,0.3)";
    ctx.textAlign = "center"; ctx.fillText("HEDGEHOG MORPION • ULTIMATE", W / 2, H - 14);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function sendImage(api, threadID, buffer, text = "") {
    if (!buffer) return;
    const fp = path.join(ASSETS_DIR, `ttt_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
    await fs.writeFile(fp, buffer);
    await new Promise((resolve, reject) => {
        api.sendMessage({ body: text, attachment: fs.createReadStream(fp) }, threadID, (err) => {
            try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
            err ? reject(err) : resolve();
        });
    });
}

function getAvailableMoves(board) { return board.map((v,i) => v===null?i:-1).filter(i=>i!==-1); }
function aiMoveEasy(board) {
    const m = getAvailableMoves(board);
    return m.length ? m[Math.floor(Math.random()*m.length)] : null;
}
function aiMoveNormal(board, ai, human) {
    for (const m of getAvailableMoves(board)) { const c=[...board]; c[m]=ai; if (checkWinner(c)===ai) return m; }
    for (const m of getAvailableMoves(board)) { const c=[...board]; c[m]=human; if (checkWinner(c)===human) return m; }
    if (board[4]===null) return 4;
    const corners = [0,2,6,8].filter(i=>board[i]===null);
    if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
    return aiMoveEasy(board);
}
function aiMoveHard(board, ai, human) {
    function minimax(b, depth, isMax) {
        const w = checkWinner(b);
        if (w===ai) return 10-depth; if (w===human) return depth-10; if (isBoardFull(b)) return 0;
        let best = isMax ? -Infinity : Infinity;
        for (const m of getAvailableMoves(b)) {
            b[m] = isMax ? ai : human;
            const s = minimax(b, depth+1, !isMax);
            b[m] = null;
            best = isMax ? Math.max(best,s) : Math.min(best,s);
        }
        return best;
    }
    let bestScore=-Infinity, bestMove=null;
    for (const m of getAvailableMoves(board)) {
        board[m]=ai;
        const s=minimax(board,0,false);
        board[m]=null;
        if (s>bestScore) { bestScore=s; bestMove=m; }
    }
    return bestMove!==null ? bestMove : aiMoveEasy(board);
}

async function applyAIMove(gameID, api, usersData) {
    const game = games[gameID];
    if (!game?.inProgress || !game.isAI) return;
    const aiIdx = game.players.findIndex(p => p.id === "AI");
    if (aiIdx === -1 || game.currentPlayerIndex !== aiIdx) return;
    const aiSym    = game.players[aiIdx].symbol;
    const humanSym = game.players[1-aiIdx].symbol;
    const diff     = (game.aiDifficulty||"normal").toLowerCase();
    let pos;
    if (diff==="easy") pos = aiMoveEasy(game.board);
    else if (diff==="normal") pos = aiMoveNormal(game.board, aiSym, humanSym);
    else pos = aiMoveHard(game.board, aiSym, humanSym);
    if (pos==null) return;
    game.board[pos] = aiSym;
    game.moves.push({ player:"AI", position:pos, board:[...game.board] });
    const winner  = checkWinner(game.board);
    const isDraw  = isBoardFull(game.board);
    if (winner||isDraw) return handleGameEnd(gameID, api, { threadID:game.threadID, senderID:"AI" }, usersData);
    game.currentPlayerIndex = (game.currentPlayerIndex+1)%2;
    const next = game.players[game.currentPlayerIndex];
    if (game.imageMode) {
        const img = await generateBoardImage(game.board, next, game.players, usersData, "normal", game.bets, game.odds);
        if (img) await sendImage(api, game.threadID, img, `➲ Tour de : ${next.name}`);
    } else {
        await api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n${displayBoard(game.board)}\n\n➲ Tour de : ${next.name}\n◆━━━━━▣✦▣━━━━━━◆`, game.threadID);
    }
}

async function handleGameEnd(gameID, api, event, usersData) {
    const game = games[gameID];
    if (!game) return;
    const winnerSym = checkWinner(game.board);
    const isDraw    = isBoardFull(game.board) && !winnerSym;

    let gainInfo = null;

    if (winnerSym) {
        const winner = game.players.find(p => p.symbol === winnerSym);
        const loser  = game.players.find(p => p.symbol !== winnerSym);
        ensurePlayerStats(winner.id); ensurePlayerStats(loser.id);
        playerStats[winner.id].wins++; playerStats[winner.id].played++;
        playerStats[loser.id].losses++; playerStats[loser.id].played++;
        saveStats();

        if (game.bets) {
            if (game.isAI) {
                const humanId  = winner.id !== "AI" ? winner.id : loser.id;
                const humanWon = winner.id !== "AI";
                const betAmt   = toBigInt(game.bets[humanId] || 0n);
                const odd      = game.odds?.[humanId] || 2;
                if (humanWon) {
                    const gain = BigInt(Math.floor(Number(betAmt) * odd));
                    await updateUserCash(humanId, gain);
                    gainInfo = {
                        line1: `🏆 Victoire contre l'IA !`,
                        line2: `+${await formatNumber(gain)}$ (côte x${odd})`,
                        line3: `Mise : ${await formatNumber(betAmt)}$ → Gain net : +${await formatNumber(gain - betAmt)}$`,
                    };
                } else {
                    gainInfo = {
                        line1: `💀 Défaite contre l'IA`,
                        line2: `-${await formatNumber(betAmt)}$`,
                        line3: `Meilleure chance la prochaine fois !`,
                    };
                }
            } else {
                const wBet  = toBigInt(game.bets[winner.id] || 0n);
                const lBet  = toBigInt(game.bets[loser.id]  || 0n);
                const wOdd  = game.odds?.[winner.id] || 2;
                const gain  = BigInt(Math.floor(Number(wBet) * wOdd));
                const total = gain + lBet;
                await updateUserCash(winner.id, total);
                gainInfo = {
                    line1: `🏆 ${winner.name} remporte la partie !`,
                    line2: `+${await formatNumber(total)}$ (mise ${await formatNumber(wBet)}$ × côte ${wOdd} + mise adverse ${await formatNumber(lBet)}$)`,
                    line3: `${loser.name} perd sa mise de ${await formatNumber(lBet)}$`,
                };
            }
        }

        if (game.imageMode) {
            const img = await generateEndGameImage(game.board, winner, game.players, usersData, false, gainInfo);
            if (img) await sendImage(api, game.threadID, img);
        } else {
            let txt = `◆━━━━━▣✦▣━━━━━━◆\n${displayBoard(game.board)}\n\n🎉 ${winner.name} a gagné ! 🏆\n`;
            if (gainInfo) txt += `\n${gainInfo.line1}\n${gainInfo.line2}\n${gainInfo.line3}\n`;
            txt += `◆━━━━━▣✦▣━━━━━━◆`;
            await api.sendMessage(txt, game.threadID);
        }
        game.inProgress = false;

        if (game.isTournamentGame && tournaments[game.tournamentID]) {
            const T     = tournaments[game.tournamentID];
            const round = T.rounds[T.currentRoundIndex];
            const match = round.matches[game.matchIndex];
            if (match) { match.winner = winner.id; match.completed = true; }
            const doneAll = round.matches.every(m => m.completed);
            if (doneAll) {
                if (T.imageMode) { const bi = await generateTournamentBracketImage(T, usersData); await sendImage(api, game.threadID, bi); }
                await advanceTournamentRound(game.tournamentID, api, usersData);
            } else await initiateNextMatch(game.tournamentID, api, usersData);
        } else if (!game.imageMode) await api.sendMessage(`Tapez "restart" pour rejouer.`, game.threadID);

    } else if (isDraw) {
        game.players.forEach(p => { ensurePlayerStats(p.id); playerStats[p.id].draws++; playerStats[p.id].played++; });
        saveStats();

        if (game.bets && !game.isAI) {
            for (const p of game.players) {
                const betAmt = toBigInt(game.bets[p.id] || 0n);
                if (betAmt > 0n) await updateUserCash(p.id, betAmt);
            }
            gainInfo = { line1: "🤝 Match nul — mises remboursées", line2: "Chaque joueur récupère sa mise", line3: "" };
        } else if (game.bets && game.isAI) {
            const humanId = game.players.find(p => p.id !== "AI")?.id;
            if (humanId) {
                const betAmt = toBigInt(game.bets[humanId] || 0n);
                if (betAmt > 0n) await updateUserCash(humanId, betAmt);
                gainInfo = { line1: "🤝 Match nul contre l'IA", line2: "Mise remboursée", line3: "" };
            }
        }

        if (game.isTournamentGame && tournaments[game.tournamentID]) {
            const T     = tournaments[game.tournamentID];
            const round = T.rounds[T.currentRoundIndex];
            const match = round.matches[game.matchIndex];
            match.drawCount = (match.drawCount || 0) + 1;
            if (match.drawCount >= 3) {
                game.inProgress = true; game.isMathChallenge = true;
                await api.sendMessage(
                    `◆━━━━━▣✦▣━━━━━━◆\n🤯 3 MATCHS NULS !\n⚡ DÉPARTAGE MATHÉMATIQUE\n\nRésolvez : √(7 + √48)²⁰²⁴ × √(7 - √48)²⁰²⁴ + 1\n\nPremier qui répond gagne !\n◆━━━━━▣✦▣━━━━━━◆`,
                    game.threadID
                );
            } else {
                await api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n🤝 MATCH NUL (${match.drawCount}/3)\n🔄 Revanche !\n◆━━━━━▣✦▣━━━━━━◆`, game.threadID);
                resetGame(gameID, game.players[0], game.players[1], { isTournamentGame:true, tournamentID:game.tournamentID, matchIndex:game.matchIndex, threadID:game.threadID, imageMode:game.imageMode });
                if (game.imageMode) { const bi = await generateBoardImage(games[gameID].board, games[gameID].players[0], games[gameID].players, usersData, "tournament"); await sendImage(api, game.threadID, bi, `Nouvelle tentative — ${games[gameID].players[0].name}, à toi !`); }
                else await api.sendMessage(`Nouvelle partie ! ${games[gameID].players[0].name}, à toi !`, game.threadID);
            }
        } else {
            if (game.imageMode) { const img = await generateEndGameImage(game.board, null, game.players, usersData, true, gainInfo); if (img) await sendImage(api, game.threadID, img); }
            else {
                let txt = `◆━━━━━▣✦▣━━━━━━◆\n${displayBoard(game.board)}\n\n🤝 Match nul !\n`;
                if (gainInfo) txt += `${gainInfo.line1}\n`;
                txt += `◆━━━━━▣✦▣━━━━━━◆`;
                await api.sendMessage(txt, game.threadID);
            }
            game.inProgress = false;
            if (!game.imageMode) await api.sendMessage(`Tapez "restart" pour rejouer.`, game.threadID);
        }
    }

    game.restartPrompted = true;
}

function createTournament(threadID) {
    tournaments[threadID] = { id:threadID, players:[], status:"registration", rounds:[], currentRoundIndex:-1, winner:null, threadID, requiredPlayers:4, imageMode:imageModeByThread[threadID]||false };
    return tournaments[threadID];
}
function generateTournamentBracketText(T) {
    let t = `◆━━━━━▣✦▣━━━━━━◆\n🏆 TOURNOI MORPION\n◆━━━━━▣✦▣━━━━━━◆\n\n➲ Statut : ${getTournamentStatus(T)}\n➲ Joueurs : ${T.players.length}/${T.requiredPlayers}\n\n`;
    T.players.forEach((p,i) => { t += `${i+1}. ${p.name}\n`; });
    if (T.status!=="registration" && T.rounds.length>0) {
        t += "\n➲ Tours :\n";
        T.rounds.forEach(r => { t += `  • ${r.name}: ${r.matches.filter(m=>m.completed).length}/${r.matches.length}\n`; });
        const cr = T.rounds[T.currentRoundIndex];
        if (cr) {
            t += `\n➲ Tour actuel : ${cr.name}\n`;
            cr.matches.forEach((m,i) => {
                const p1=T.players.find(p=>p.id===m.player1), p2=T.players.find(p=>p.id===m.player2);
                const s = m.completed ? (m.winner ? `🏆 ${T.players.find(p=>p.id===m.winner)?.name}` : "🤝") : "⏳";
                t += `  Match ${i+1}: ${p1?.name||"??"} vs ${p2?.name||"??"} → ${s}\n`;
            });
        }
    }
    if (T.status==="completed"&&T.winner) t += `\n◆━━━━━▣✦▣━━━━━━◆\n🏆 CHAMPION : ${T.players.find(p=>p.id===T.winner)?.name||"?"}\n◆━━━━━▣✦▣━━━━━━◆`;
    else t += "\n◆━━━━━▣✦▣━━━━━━◆";
    return t;
}

async function startTournament(tournamentID, api, usersData) {
    const T = tournaments[tournamentID];
    if (!T) return;
    const num = T.players.length;
    if (![4,8,16].includes(num)) return api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n❌ Il faut 4, 8 ou 16 joueurs. Actuels: ${num}\n◆━━━━━▣✦▣━━━━━━◆`, T.threadID);
    T.status = "in_progress"; shuffleArray(T.players);
    let rounds=[];
    if (num===16) rounds=[{name:"Huitièmes",matches:[]},{name:"Quarts",matches:[]},{name:"Demi-finales",matches:[]},{name:"Finale",matches:[]}];
    else if (num===8) rounds=[{name:"Quarts",matches:[]},{name:"Demi-finales",matches:[]},{name:"Finale",matches:[]}];
    else rounds=[{name:"Demi-finales",matches:[]},{name:"Finale",matches:[]}];
    T.rounds=rounds; T.currentRoundIndex=0; T.winner=null;
    const m0=[];
    for (let i=0;i<num;i+=2) m0.push({player1:T.players[i].id,player2:T.players[i+1].id,winner:null,completed:false,gameID:null,drawCount:0});
    T.rounds[0].matches=m0;
    if (T.imageMode) { const bi=await generateTournamentBracketImage(T,usersData); await sendImage(api,T.threadID,bi,"◆━━━━━▣✦▣━━━━━━◆\n🎉 Le tournoi démarre !\n◆━━━━━▣✦▣━━━━━━◆"); }
    else await api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n🎉 Le tournoi démarre !\n${generateTournamentBracketText(T)}`, T.threadID);
    await initiateNextMatch(tournamentID, api, usersData);
}
async function initiateNextMatch(tournamentID, api, usersData) {
    const T=tournaments[tournamentID]; if (!T) return;
    const round=T.rounds[T.currentRoundIndex];
    const idx=round.matches.findIndex(m=>!m.completed&&m.gameID===null); if (idx===-1) return;
    const match=round.matches[idx];
    const p1=T.players.find(p=>p.id===match.player1), p2=T.players.find(p=>p.id===match.player2);
    if (!p1||!p2) { await api.sendMessage("❌ Erreur joueur introuvable.", T.threadID); return; }
    const i1=await getPlayerInfo(p1.id,usersData), i2=await getPlayerInfo(p2.id,usersData);
    const gID=`${T.threadID}:tournament:${T.id}:${T.currentRoundIndex}:${idx}`;
    resetGame(gID,{id:p1.id,name:i1.name,threadID:T.threadID},{id:p2.id,name:i2.name,threadID:T.threadID},{isTournamentGame:true,tournamentID,matchIndex:idx,threadID:T.threadID,imageMode:T.imageMode});
    round.matches[idx].gameID=gID;
    if (T.imageMode) { const bi=await generateBoardImage(games[gID].board,games[gID].players[0],games[gID].players,usersData,"tournament"); await sendImage(api,T.threadID,bi,`◆━━━━━▣✦▣━━━━━━◆\n🎬 ${round.name} — Match ${idx+1}\n${i1.name} ❌ vs ${i2.name} ⭕\n◆━━━━━▣✦▣━━━━━━◆`); }
    else await api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n🎬 ${round.name} — Match ${idx+1}\n${i1.name} ❌ vs ${i2.name} ⭕\n\n${displayBoard(games[gID].board)}\n\n${i1.name}, à toi (1-9).\n◆━━━━━▣✦▣━━━━━━◆`, T.threadID);
}
async function advanceTournamentRound(tournamentID, api, usersData) {
    const T=tournaments[tournamentID]; if (!T) return;
    const round=T.rounds[T.currentRoundIndex];
    const winners=round.matches.map(m=>m.winner).filter(Boolean);
    if (winners.length!==round.matches.length) { await api.sendMessage("⚠️ Certains matchs sont inachevés.", T.threadID); return; }
    if (T.currentRoundIndex===T.rounds.length-1) {
        T.winner=winners[0]; T.status="completed";
        const ci=await getPlayerInfo(T.winner,usersData);
        if (T.imageMode) { const bi=await generateTournamentBracketImage(T,usersData); await sendImage(api,T.threadID,bi,`◆━━━━━▣✦▣━━━━━━◆\n🎉 CHAMPION : ${ci.name} !\n◆━━━━━▣✦▣━━━━━━◆`); }
        else await api.sendMessage(`◆━━━━━▣✦▣━━━━━━◆\n🎉 TOURNOI TERMINÉ !\n\n🏆 CHAMPION : ${ci.name}\n◆━━━━━▣✦▣━━━━━━◆`, T.threadID);
        delete tournaments[tournamentID]; return;
    }
    T.currentRoundIndex++;
    const nr=T.rounds[T.currentRoundIndex]; nr.matches=[];
    for (let i=0;i<winners.length;i+=2) nr.matches.push({player1:winners[i],player2:winners[i+1],winner:null,completed:false,gameID:null,drawCount:0});
    if (T.imageMode) { const bi=await generateTournamentBracketImage(T,usersData); await sendImage(api,T.threadID,bi,`⚡ Tour ${nr.name.toUpperCase()} !`); }
    else await api.sendMessage(`⚡ Tour **${nr.name}** !`, T.threadID);
    await initiateNextMatch(tournamentID, api, usersData);
}

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const l of lines) { if (l==="---") { out+="├─────────────•┈┈\n"; continue; } out+=`│ ${l}\n`; }
    return out + "╰─────────────•┈┈";
}

module.exports = {
    config: {
        name: "tictactoe",
        aliases: ["ttt","morpion"],
        version: "12.0",
        author: "ʚʆɞ Sømå Sønïč ʚʆɞ",
        category: "game",
        shortDescription: { en: "TicTacToe Ultimate avec mises, IA et tournois" },
        longDescription: { en: "Morpion avancé avec IA, tournois, mises d'argent et visuels premium." },
        usage: { en: "ttt | ttt @mention <mise> [côte] | ttt ia [facile|normal|dur] <mise> [côte] | ttt stats | ttt image on/off | ttt tournoi | ttt join | ttt out | ttt help" }
    },

    onStart: async function ({ api, event, args, usersData }) {
        const threadID = event.threadID;
        const senderID = event.senderID;
        const p        = global.utils.getPrefix(threadID);
        ensurePlayerStats(senderID);

        const sub  = (args[0] || "").toLowerCase();
        const sub2 = (args[1] || "").toLowerCase();

        if (!sub || sub === "help") {
            return api.sendMessage(S([
                "🎮 MORPION ULTIMATE",
                "---",
                `${p}ttt @joueur <mise> [côte 1-20]`,
                `${p}ttt ia [facile|normal|dur] <mise> [côte]`,
                "---",
                "💰 MISES",
                "Côte entre 1 et 20 (ex : 2.5)",
                "Gagnant : mise × côte + mise adverse",
                "Match nul : mises remboursées",
                "---",
                `${p}ttt stats`,
                `${p}ttt tournoi / join / out`,
                `${p}ttt image on/off`,
                "---",
                "🎯 EN JEU : 1-9 | forfait | restart",
            ]), threadID);
        }

        if (sub === "image") {
            const on = sub2 === "on";
            imageModeByThread[threadID] = on;
            if (tournaments[threadID]) tournaments[threadID].imageMode = on;
            return api.sendMessage(S([`🎨 Mode image ${on?"activé":"désactivé"}.`]), threadID);
        }

        if (sub === "stats") {
            if (imageModeByThread[threadID]) {
                const img = await generateStatsImage(senderID, usersData);
                if (img) { await sendImage(api, threadID, img); return; }
            }
            const stats = playerStats[senderID]||{wins:0,losses:0,draws:0,played:0};
            const name  = (await usersData.getName(senderID))||`Joueur ${senderID}`;
            const wr    = stats.played>0?Math.round(stats.wins/stats.played*100):0;
            return api.sendMessage(S([`📊 Stats de ${name}`,"---",`🏆 Victoires : ${stats.wins}`,`💀 Défaites  : ${stats.losses}`,`🤝 Nuls      : ${stats.draws}`,`🎮 Parties   : ${stats.played}`,`📈 Ratio     : ${wr}%`]), threadID);
        }

        if (["tournoi","join","out"].includes(sub)) {
            if (!tournaments[threadID]) createTournament(threadID);
            const T = tournaments[threadID];

            if (sub === "join") {
                if (T.status!=="registration") return api.sendMessage(S(["❌ Aucun tournoi en inscription."]), threadID);
                if (T.players.find(p=>p.id===senderID)) return api.sendMessage(S(["⚠️ Déjà inscrit."]), threadID);
                if (T.players.length>=T.requiredPlayers) return api.sendMessage(S([`❌ Tournoi complet.`]), threadID);
                const name = (await usersData.getName(senderID))||`Joueur ${senderID}`;
                T.players.push({id:senderID,name});
                if (T.imageMode) { const bi=await generateTournamentBracketImage(T,usersData); await sendImage(api,threadID,bi,`✅ Inscription (${T.players.length}/${T.requiredPlayers})`); }
                else await api.sendMessage(S([`✅ Inscrit ! (${T.players.length}/${T.requiredPlayers})`]), threadID);
                return;
            }
            if (sub === "out") {
                if (T.status!=="registration") return api.sendMessage(S(["❌ Tournoi déjà démarré."]), threadID);
                const idx=T.players.findIndex(p=>p.id===senderID);
                if (idx===-1) return api.sendMessage(S(["⚠️ Pas inscrit."]), threadID);
                T.players.splice(idx,1);
                return api.sendMessage(S(["🚪 Vous avez quitté."]), threadID);
            }
            if (sub === "tournoi") {
                if (sub2==="cancel") { if (T.status!=="registration") return api.sendMessage(S(["❌ Tournoi déjà démarré."]),threadID); delete tournaments[threadID]; return api.sendMessage(S(["🗑️ Tournoi annulé."]),threadID); }
                if (sub2==="start") {
                    const num=T.players.length;
                    if (![4,8,16].includes(num)) return api.sendMessage(S([`❌ Faut 4, 8 ou 16 joueurs. Actuels: ${num}`]),threadID);
                    T.requiredPlayers=num; await startTournament(threadID,api,usersData); return;
                }
                if (T.imageMode) { const bi=await generateTournamentBracketImage(T,usersData); await sendImage(api,threadID,bi,`🏆 Tournoi — tapez ${p}ttt join`); }
                else await api.sendMessage(generateTournamentBracketText(T), threadID);
                return;
            }
        }

        if (sub === "ia" || sub === "ai") {
            const diff     = ["easy","normal","hard","facile","normal","dur"].includes(sub2) ? (sub2==="facile"?"easy":sub2==="dur"?"hard":sub2) : "normal";
            const betRaw   = args[2];
            const oddRaw   = parseFloat(args[3]) || 2;
            const clampOdd = Math.min(20, Math.max(1, oddRaw));
            const betAmt   = await parseAmount(betRaw);
            const userName = (await usersData.getName(senderID))||`Joueur ${senderID}`;

            if (betAmt > 0n) {
                const cash = await getUserCash(senderID);
                if (betAmt > cash) return api.sendMessage(S(["❌ Fonds insuffisants","---",`💰 Solde : ${await formatNumber(cash)}$`,`🎲 Mise   : ${await formatNumber(betAmt)}$`]), threadID);
                await updateUserCash(senderID, -betAmt);
            }

            const gID = `${threadID}:ai:${senderID}`;
            resetGame(gID,
                { id:senderID, name:userName },
                { id:"AI",     name:BOT_NAME },
                { isAI:true, aiDifficulty:diff, threadID, imageMode:imageModeByThread[threadID]||false,
                  bets: betAmt > 0n ? { [senderID]: betAmt.toString() } : null,
                  odds: betAmt > 0n ? { [senderID]: clampOdd } : null }
            );

            const betLine = betAmt>0n ? `💰 Mise : ${await formatNumber(betAmt)}$ | Côte : x${clampOdd} | Gain potentiel : ${await formatNumber(BigInt(Math.floor(Number(betAmt)*clampOdd)))}$` : "Aucune mise";
            if (games[gID].imageMode) {
                const img = await generateBoardImage(games[gID].board, games[gID].players[0], games[gID].players, usersData, "normal", games[gID].bets, games[gID].odds);
                await sendImage(api, threadID, img, S([`🎮 Partie contre IA (${diff})`,`${userName} ❌ vs ${BOT_NAME} ⭕`,"---",betLine]));
            } else {
                await api.sendMessage(S([`🎮 Partie contre IA (${diff})`,`${userName} ❌ vs ${BOT_NAME} ⭕`,"---",betLine,"---",displayBoard(games[gID].board),"---",`${userName}, joue (1-9)`]), threadID);
            }
            if (games[gID].players[games[gID].currentPlayerIndex].id==="AI") await applyAIMove(gID, api, usersData);
            return;
        }

        const mentions = event.mentions || {};
        let targetID   = Object.keys(mentions)[0] || null;
        if (!targetID && args[0]) { const ex=args[0].match(/\d+/); if (ex) targetID=ex[0]; }
        if (!targetID) return api.sendMessage(S(["❌ Mention invalide.", `${p}ttt @joueur <mise> [côte]`]), threadID);
        if (targetID===senderID) return api.sendMessage(S(["❌ Vous ne pouvez pas jouer contre vous-même."]), threadID);

        const betRaw1   = args[1];
        const oddRaw1   = parseFloat(args[2]) || 2;
        const clampOdd1 = Math.min(20, Math.max(1, oddRaw1));
        const betAmt1   = await parseAmount(betRaw1);

        const name1 = (await usersData.getName(senderID))||`Joueur ${senderID}`;
        const name2 = (mentions[targetID]||"").replace("@","")||(await usersData.getName(targetID))||`Joueur ${targetID}`;

        const bets = {}, odds = {};
        if (betAmt1 > 0n) {
            const cash1 = await getUserCash(senderID);
            if (betAmt1 > cash1) return api.sendMessage(S(["❌ Fonds insuffisants (J1)","---",`💰 Solde : ${await formatNumber(cash1)}$`]), threadID);
            await updateUserCash(senderID, -betAmt1);
            bets[senderID] = betAmt1.toString();
            odds[senderID] = clampOdd1;

            const cash2  = await getUserCash(targetID);
            if (betAmt1 > cash2) {
                await updateUserCash(senderID, betAmt1);
                return api.sendMessage(S(["❌ L'adversaire n'a pas assez pour miser la même somme.","---",`💰 Son solde : ${await formatNumber(cash2)}$`,`🎲 Mise : ${await formatNumber(betAmt1)}$`]), threadID);
            }
            await updateUserCash(targetID, -betAmt1);
            bets[targetID] = betAmt1.toString();
            odds[targetID] = clampOdd1;
        }

        const gID = `${threadID}:pvp:${senderID}:${targetID}`;
        resetGame(gID,
            { id:senderID, name:name1 },
            { id:targetID, name:name2 },
            { threadID, imageMode:imageModeByThread[threadID]||false,
              bets: betAmt1>0n ? bets : null,
              odds: betAmt1>0n ? odds : null }
        );

        const betLine = betAmt1>0n ? `💰 Mise : ${await formatNumber(betAmt1)}$ chacun | Côte : x${clampOdd1}` : "Aucune mise";
        if (games[gID].imageMode) {
            const img = await generateBoardImage(games[gID].board, games[gID].players[0], games[gID].players, usersData, "normal", games[gID].bets, games[gID].odds);
            await sendImage(api, threadID, img, S([`🎮 ${name1} ❌ vs ${name2} ⭕`,"---",betLine,"---",`${name1}, joue (1-9)`]));
        } else {
            await api.sendMessage(S([`🎮 ${name1} ❌ vs ${name2} ⭕`,"---",betLine,"---",displayBoard(games[gID].board),"---",`${name1}, joue (1-9)`]), threadID);
        }
    },

    onChat: async function ({ api, event, usersData }) {
        const threadID  = event.threadID;
        const senderID  = event.senderID;
        const msg       = (event.body || "").trim();
        const msgLower  = msg.toLowerCase();

        const gameID = Object.keys(games).find(id =>
            games[id].threadID === threadID &&
            games[id].players.some(p => p.id === senderID) &&
            games[id].inProgress
        );

        if (!gameID) {
            const finished = Object.keys(games).find(id =>
                games[id].threadID === threadID &&
                games[id].players.some(p => p.id === senderID) &&
                !games[id].inProgress
            );
            if (finished && msgLower === "restart") {
                const fg = games[finished];
                if (fg.isTournamentGame) return api.sendMessage(S(["❌ Impossible de relancer un match de tournoi."]), threadID);
                resetGame(finished, fg.players[0], fg.players[1], { isAI:fg.isAI, aiDifficulty:fg.aiDifficulty, threadID, imageMode:fg.imageMode });
                if (fg.imageMode) { const img=await generateBoardImage(games[finished].board,games[finished].players[0],games[finished].players,usersData); await sendImage(api,threadID,img,`🔄 Nouvelle partie ! ${games[finished].players[0].name}, à toi.`); }
                else await api.sendMessage(S([`🔄 Nouvelle partie !`,`${games[finished].players[0].name} ❌ vs ${games[finished].players[1].name} ⭕`,"---",displayBoard(games[finished].board),"---",`${games[finished].players[0].name}, joue (1-9)`]), threadID);
                if (fg.isAI && games[finished].players[games[finished].currentPlayerIndex].id==="AI") await applyAIMove(finished, api, usersData);
            }
            return;
        }

        const game = games[gameID];

        if (game.isMathChallenge) {
            if (msg==="2") {
                const winner = game.players.find(p=>p.id===senderID);
                const loser  = game.players.find(p=>p.id!==senderID);
                await api.sendMessage(S(["⚡ BONNE RÉPONSE !",`🏆 ${winner.name} remporte le tie-breaker !`]), threadID);
                game.board=Array(9).fill(winner.symbol); game.inProgress=false; game.isMathChallenge=false;
                ensurePlayerStats(winner.id); ensurePlayerStats(loser.id);
                playerStats[winner.id].wins++; playerStats[loser.id].losses++; saveStats();
                if (game.isTournamentGame && tournaments[game.tournamentID]) {
                    const T=tournaments[game.tournamentID], round=T.rounds[T.currentRoundIndex], match=round.matches[game.matchIndex];
                    if (match) { match.winner=winner.id; match.completed=true; }
                    const doneAll=round.matches.every(m=>m.completed);
                    if (doneAll) { if(T.imageMode){const bi=await generateTournamentBracketImage(T,usersData);await sendImage(api,game.threadID,bi);} await advanceTournamentRound(game.tournamentID,api,usersData); }
                    else await initiateNextMatch(game.tournamentID,api,usersData);
                }
            }
            return;
        }

        if (msgLower === "forfait") {
            const forfeiter = game.players.find(p=>p.id===senderID);
            const other     = game.players.find(p=>p.id!==senderID);
            if (!forfeiter||!other) return;
            game.inProgress=false;
            ensurePlayerStats(forfeiter.id); ensurePlayerStats(other.id);
            playerStats[forfeiter.id].losses++; playerStats[forfeiter.id].played++;
            playerStats[other.id].wins++;       playerStats[other.id].played++;
            saveStats();

            let gainInfo = null;
            if (game.bets) {
                if (game.isAI) {
                    const humanId = forfeiter.id !== "AI" ? forfeiter.id : other.id;
                    const humanWon = other.id !== "AI";
                    if (!humanWon) gainInfo = { line1:`💀 Abandon — mise perdue`, line2:`-${await formatNumber(toBigInt(game.bets[humanId]||0))}$`, line3:"" };
                } else {
                    const wBet  = toBigInt(game.bets[other.id]||0n);
                    const lBet  = toBigInt(game.bets[forfeiter.id]||0n);
                    const wOdd  = game.odds?.[other.id]||2;
                    const total = BigInt(Math.floor(Number(wBet)*wOdd)) + lBet;
                    await updateUserCash(other.id, total);
                    gainInfo = { line1:`🏳️ ${forfeiter.name} a abandonné`, line2:`${other.name} remporte +${await formatNumber(total)}$`, line3:"" };
                }
            }

            if (game.imageMode) { const img=await generateEndGameImage(game.board,other,game.players,usersData,false,gainInfo); if(img)await sendImage(api,threadID,img); }
            else {
                let txt=`◆━━━━━▣✦▣━━━━━━◆\n🏳️ ${forfeiter.name} a abandonné.\n🏆 ${other.name} gagne !\n`;
                if (gainInfo) txt+=`${gainInfo.line1}\n${gainInfo.line2}\n`;
                txt+=`◆━━━━━▣✦▣━━━━━━◆`;
                await api.sendMessage(txt, threadID);
            }

            if (game.isTournamentGame && tournaments[game.tournamentID]) {
                const T=tournaments[game.tournamentID], round=T.rounds[T.currentRoundIndex], match=round.matches[game.matchIndex];
                if (match) { match.winner=other.id; match.completed=true; }
                const done=round.matches.every(m=>m.completed);
                if (done) { if(T.imageMode){const bi=await generateTournamentBracketImage(T,usersData);await sendImage(api,threadID,bi);} await advanceTournamentRound(game.tournamentID,api,usersData); }
                else await initiateNextMatch(game.tournamentID,api,usersData);
            } else if (!game.imageMode) await api.sendMessage(`Tapez "restart" pour rejouer.`, threadID);
            return;
        }

        const current = game.players[game.currentPlayerIndex];
        if (senderID !== current.id) return;

        const pos = parseInt(msg) - 1;
        if (isNaN(pos) || pos < 0 || pos > 8) return;
        if (game.board[pos] !== null) {
            await api.sendMessage(S(["❌ Case invalide ou déjà prise."]), threadID);
            return;
        }

        game.board[pos] = current.symbol;
        game.moves.push({ player:current.id, position:pos, board:[...game.board] });

        const winner  = checkWinner(game.board);
        const isDraw2 = isBoardFull(game.board);
        if (winner||isDraw2) return handleGameEnd(gameID, api, { threadID, senderID }, usersData);

        game.currentPlayerIndex = (game.currentPlayerIndex+1)%2;
        const next = game.players[game.currentPlayerIndex];

        if (game.imageMode) {
            const img = await generateBoardImage(game.board, next, game.players, usersData, game.isTournamentGame?"tournament":"normal", game.bets, game.odds);
            if (img) await sendImage(api, threadID, img, `➲ Tour de : ${next.name}`);
        } else {
            await api.sendMessage(S([displayBoard(game.board),"---",`➲ Tour de : ${next.name}`]), threadID);
        }

        if (game.isAI && next.id==="AI") await applyAIMove(gameID, api, usersData);
    }
};