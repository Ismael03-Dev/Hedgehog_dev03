const fs   = require("fs-extra");
const path = require("path");
const { createCanvas } = require("canvas");
const { utils } = global;

const LOGS_FILE    = path.join(__dirname, "prefix_logs.json");
const HISTORY_FILE = path.join(__dirname, "prefix_history.json");
const LOCKS_FILE   = path.join(__dirname, "prefix_locks.json");

function loadJSON(file, fallback = {}) {
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch {}
    return fallback;
}
function saveJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch {}
}

let prefixLogs    = loadJSON(LOGS_FILE,    {});
let prefixHistory = loadJSON(HISTORY_FILE, {});
let prefixLocks   = loadJSON(LOCKS_FILE,   {});

function addLog(uid, threadID, oldPrefix, newPrefix, scope) {
    if (!prefixLogs[threadID]) prefixLogs[threadID] = [];
    prefixLogs[threadID].unshift({
        uid, oldPrefix, newPrefix, scope,
        date: new Date().toISOString(),
    });
    if (prefixLogs[threadID].length > 50) prefixLogs[threadID] = prefixLogs[threadID].slice(0, 50);
    saveJSON(LOGS_FILE, prefixLogs);
}

function addHistory(threadID, prefix) {
    if (!prefixHistory[threadID]) prefixHistory[threadID] = [];
    if (prefixHistory[threadID][0] === prefix) return;
    prefixHistory[threadID].unshift(prefix);
    if (prefixHistory[threadID].length > 5) prefixHistory[threadID] = prefixHistory[threadID].slice(0, 5);
    saveJSON(HISTORY_FILE, prefixHistory);
}

function getHistory(threadID) {
    return prefixHistory[threadID] || [];
}

function isLocked(threadID) {
    return !!prefixLocks[threadID];
}

function PENDING_TIMEOUT_MS() { return 60 * 1000; }

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

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const l of lines) {
        if (l === "---") { out += "├─────────────•┈┈\n"; continue; }
        out += `│ ${l}\n`;
    }
    return out + "╰─────────────•┈┈";
}

async function generatePrefixCard(systemPrefix, boxPrefix, opts = {}) {
    const { prevPrefix = null, history = [], locked = false, phase = "normal", lang = "en" } = opts;
    const W = 620, H = history.length > 0 ? 310 : 260;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const accentColor = phase === "pending" ? "#60a5fa" : phase === "confirmed" ? "#34d399" : "#d4af37";

    const bg = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, "#0d0b1e");
    bg.addColorStop(0.6, "#100e22");
    bg.addColorStop(1, "#07050f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.016)";
    for (let x = 0; x < W; x += 30)
        for (let y = 0; y < H; y += 30)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, accentColor);
    borderG.addColorStop(0.5, accentColor + "88");
    borderG.addColorStop(1, accentColor);
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, accentColor + "28");
    hdrG.addColorStop(0.5, accentColor + "08");
    hdrG.addColorStop(1, accentColor + "28");
    ctx.fillStyle = hdrG;
    ctx.fillRect(10, 10, W - 20, 62);

    const title = phase === "pending"
        ? (lang === "fr" ? "🦔 HEDGEHOG — CHANGEMENT EN COURS..." : "🦔 HEDGEHOG — CHANGE PENDING...")
        : phase === "confirmed"
        ? (lang === "fr" ? "🦔 HEDGEHOG — PRÉFIXE CONFIRMÉ !" : "🦔 HEDGEHOG — PREFIX CONFIRMED !")
        : (lang === "fr" ? "🦔 HEDGEHOG BOT — PRÉFIXE" : "🦔 HEDGEHOG BOT — PREFIX");

    ctx.font = "bold 20px 'Courier New'";
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 14;
    ctx.fillText(title, 28, 50);
    ctx.shadowBlur = 0;

    if (locked) {
        ctx.font = "bold 10px 'Courier New'";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "right";
        ctx.fillText("🔒 LOCKED", W - 28, 50);
        ctx.textAlign = "left";
    }

    ctx.strokeStyle = accentColor + "22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 80); ctx.lineTo(W - 28, 80);
    ctx.stroke();

    const drawBlock = (label, value, icon, color, yTop, struck = false) => {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, 28, yTop, W - 56, 52, 10);
        ctx.fill();
        ctx.strokeStyle = color + "33";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(label, 44, yTop + 16);

        ctx.font = "bold 22px 'Courier New'";
        ctx.fillStyle = struck ? color + "55" : color;
        ctx.shadowColor = struck ? "transparent" : color;
        ctx.shadowBlur = struck ? 0 : 10;
        ctx.fillText(`${icon}  ${value}`, 44, yTop + 40);
        ctx.shadowBlur = 0;

        if (struck) {
            ctx.strokeStyle = "#ef4444";
            ctx.lineWidth = 2;
            const textW = ctx.measureText(`${icon}  ${value}`).width;
            ctx.beginPath();
            ctx.moveTo(44, yTop + 32);
            ctx.lineTo(44 + textW, yTop + 32);
            ctx.stroke();
        }
    };

    const sysLabel  = lang === "fr" ? "PRÉFIXE SYSTÈME"   : "SYSTEM PREFIX";
    const chatLabel = lang === "fr" ? "PRÉFIXE CE SALON"  : "THIS CHAT PREFIX";
    const prevLabel = lang === "fr" ? "PRÉFIXE PRÉCÉDENT" : "PREVIOUS PREFIX";

    drawBlock(sysLabel,  systemPrefix, "🌐", accentColor, 88);
    drawBlock(chatLabel, boxPrefix,    "💬", "#818cf8",   150, false);

    if (prevPrefix && prevPrefix !== boxPrefix) {
        drawBlock(prevLabel, prevPrefix, "↩️", "#94a3b8", 212, true);
    }

    if (history.length > 0) {
        const histY = prevPrefix && prevPrefix !== boxPrefix ? 278 : 216;
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillText(lang === "fr" ? "HISTORIQUE RÉCENT :" : "RECENT HISTORY :", 28, histY);

        const itemW = (W - 56 - (history.length - 1) * 8) / Math.min(history.length, 5);
        for (let i = 0; i < Math.min(history.length, 5); i++) {
            const hx = 28 + i * (itemW + 8);
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            roundRect(ctx, hx, histY + 10, itemW, 32, 6);
            ctx.fill();
            ctx.strokeStyle = "#818cf833";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = "bold 13px 'Courier New'";
            ctx.fillStyle = "#c4b5fd";
            ctx.textAlign = "center";
            ctx.fillText(history[i], hx + itemW / 2, histY + 32);
            ctx.textAlign = "left";

            ctx.font = "7px 'Courier New'";
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            ctx.textAlign = "center";
            ctx.fillText(`#${i + 1}`, hx + itemW / 2, histY + 16);
            ctx.textAlign = "left";
        }
    }

    const d = new Date();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = accentColor + "44";
    ctx.textAlign = "center";
    ctx.fillText(
        `HEDGEHOG BOT • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
        W / 2, H - 16
    );
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function sendCard(message, systemPrefix, boxPrefix, opts = {}) {
    const body = S([
        opts.lang === "fr" ? "🦔 HEDGEHOG — PRÉFIXE" : "🦔 HEDGEHOG — PREFIX",
        "---",
        `🌐 ${opts.lang === "fr" ? "Système" : "System"} : ${systemPrefix}`,
        `💬 ${opts.lang === "fr" ? "Salon" : "Chat"}   : ${boxPrefix}`,
        ...(opts.locked ? [`🔒 ${opts.lang === "fr" ? "Salon verrouillé" : "Chat locked"}`] : []),
    ]);
    try {
        const img     = await generatePrefixCard(systemPrefix, boxPrefix, opts);
        const imgPath = path.join(__dirname, `prefix_card_${Date.now()}.png`);
        fs.writeFileSync(imgPath, img);
        await message.reply({ body, attachment: fs.createReadStream(imgPath) });
        fs.unlinkSync(imgPath);
    } catch {
        await message.reply(body);
    }
}

function detectLang(threadID) {
    try {
        const cfg = global.GoatBot?.config;
        if (cfg?.language === "fr") return "fr";
    } catch {}
    return "en";
}

module.exports = {
    config: {
        name: "prefix",
        version: "3.0",
        author: "NTKhang",
        countDown: 5,
        role: 0,
        description: "Change the bot prefix",
        category: "config",
        guide: {
            en: "   {pn} <new prefix>\n"
              + "   {pn} reset          — Reset to default\n"
              + "   {pn} history        — View recent prefixes\n"
              + "   {pn} restore <n>    — Restore prefix #n from history\n"
              + "   {pn} list           — List all custom prefixes (admin)\n"
              + "   {pn} lock           — Lock prefix for this chat (admin)\n"
              + "   {pn} unlock         — Unlock prefix for this chat (admin)\n"
              + "   {pn} logs           — View prefix change logs (admin)\n"
              + "   {pn} <prefix> -g    — Change globally (admin only)"
        }
    },

    langs: {
        en: {
            reset:             "✅ Prefix reset to default: %1",
            onlyAdmin:         "🚫 Only admins can do this.",
            confirmGlobal:     "💬 React within 60s to confirm global prefix change.",
            confirmThisThread: "💬 React within 60s to confirm prefix change in this chat.",
            successGlobal:     "✅ Global prefix changed to: %1",
            successThisThread: "✅ Chat prefix changed to: %1",
            tooLong:           "❌ Prefix too long (max 5 characters).",
            hasSpaces:         "❌ Prefix cannot contain spaces.",
            samePrefix:        "❌ New prefix is the same as current prefix.",
            locked:            "🔒 This chat's prefix is locked. Ask an admin to unlock it.",
            expired:           "⏰ Confirmation expired. Please try again.",
            wrongUser:         "🚫 Only the person who requested this change can confirm it.",
        },
        fr: {
            reset:             "✅ Préfixe réinitialisé : %1",
            onlyAdmin:         "🚫 Seuls les admins peuvent faire ça.",
            confirmGlobal:     "💬 Réagis dans 60s pour confirmer le changement global.",
            confirmThisThread: "💬 Réagis dans 60s pour confirmer le changement dans ce salon.",
            successGlobal:     "✅ Préfixe global changé en : %1",
            successThisThread: "✅ Préfixe du salon changé en : %1",
            tooLong:           "❌ Préfixe trop long (max 5 caractères).",
            hasSpaces:         "❌ Le préfixe ne peut pas contenir d'espaces.",
            samePrefix:        "❌ Le nouveau préfixe est identique au préfixe actuel.",
            locked:            "🔒 Le préfixe de ce salon est verrouillé. Demandez à un admin.",
            expired:           "⏰ Confirmation expirée. Réessayez.",
            wrongUser:         "🚫 Seul la personne ayant demandé le changement peut confirmer.",
        }
    },

    onStart: async function ({ message, role, args, commandName, event, threadsData, getLang, api }) {
        const uid      = String(event.senderID);
        const threadID = String(event.threadID);
        const lang     = detectLang(threadID);
        const sysPfx   = global.GoatBot.config.prefix;
        const boxPfx   = utils.getPrefix(threadID);
        const locked   = isLocked(threadID);
        const history  = getHistory(threadID);

        if (!args[0]) {
            return sendCard(message, sysPfx, boxPfx, { history, locked, lang });
        }

        const cmd = args[0].toLowerCase();

        if (cmd === "history") {
            if (!history.length) return message.reply(S(["📜 No recent prefix history for this chat."]));
            const lines = ["📜 RECENT PREFIX HISTORY", "---"];
            history.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
            lines.push("---");
            lines.push("Use: prefix restore <n>");
            return message.reply(S(lines));
        }

        if (cmd === "restore") {
            if (role < 1) return message.reply(S([getLang("onlyAdmin")]));
            if (locked)   return message.reply(S([getLang("locked")]));
            const idx = parseInt(args[1]) - 1;
            if (isNaN(idx) || idx < 0 || idx >= history.length)
                return message.reply(S(["❌ Invalid history index.", `Available: 1–${history.length}`]));
            const restored = history[idx];
            const old      = boxPfx;
            await threadsData.set(threadID, restored, "data.prefix");
            addHistory(threadID, restored);
            addLog(uid, threadID, old, restored, "restore");
            return sendCard(message, sysPfx, restored, { prevPrefix: old, history: getHistory(threadID), locked, lang, phase: "confirmed" });
        }

        if (cmd === "list") {
            if (role < 2) return message.reply(S([getLang("onlyAdmin")]));
            const lines = ["📋 CUSTOM PREFIX LIST", "---"];
            let count = 0;
            for (const [tid, data] of Object.entries(global.GoatBot.threadData || {})) {
                const p = data?.data?.prefix;
                if (p) { lines.push(`• Thread ${tid.slice(-6)} : ${p}`); count++; }
            }
            if (!count) lines.push("No custom prefixes set.");
            lines.push("---");
            lines.push(`Total : ${count} chat(s)`);
            return message.reply(S(lines));
        }

        if (cmd === "lock") {
            if (role < 2) return message.reply(S([getLang("onlyAdmin")]));
            prefixLocks[threadID] = true;
            saveJSON(LOCKS_FILE, prefixLocks);
            return message.reply(S(["🔒 Prefix locked for this chat.", "Only admins can change it now."]));
        }

        if (cmd === "unlock") {
            if (role < 2) return message.reply(S([getLang("onlyAdmin")]));
            delete prefixLocks[threadID];
            saveJSON(LOCKS_FILE, prefixLocks);
            return message.reply(S(["🔓 Prefix unlocked for this chat."]));
        }

        if (cmd === "logs") {
            if (role < 2) return message.reply(S([getLang("onlyAdmin")]));
            const logs = prefixLogs[threadID] || [];
            if (!logs.length) return message.reply(S(["📜 No logs for this chat."]));
            const lines = [`📜 PREFIX LOGS (${logs.length})`, "---"];
            for (const log of logs.slice(0, 10)) {
                const d = new Date(log.date);
                lines.push(`${d.getDate()}/${d.getMonth()+1} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} — ${log.oldPrefix} → ${log.newPrefix} (${log.scope})`);
            }
            return message.reply(S(lines));
        }

        if (cmd === "reset") {
            if (locked && role < 2) return message.reply(S([getLang("locked")]));
            const old = boxPfx;
            await threadsData.set(threadID, null, "data.prefix");
            addHistory(threadID, old);
            addLog(uid, threadID, old, sysPfx, "reset");
            return sendCard(message, sysPfx, sysPfx, { prevPrefix: old, history: getHistory(threadID), locked, lang, phase: "confirmed" });
        }

        const newPrefix = args[0];

        if (newPrefix.length > 5)  return message.reply(S([getLang("tooLong")]));
        if (/\s/.test(newPrefix))  return message.reply(S([getLang("hasSpaces")]));
        if (newPrefix === boxPfx && !args[1]) return message.reply(S([getLang("samePrefix")]));

        if (locked && role < 2) return message.reply(S([getLang("locked")]));

        const isGlobal = args[1] === "-g";
        if (isGlobal && role < 2) return message.reply(S([getLang("onlyAdmin")]));

        const formSet = {
            commandName, author: uid, newPrefix,
            setGlobal: isGlobal, threadID, lang,
            oldPrefix: isGlobal ? sysPfx : boxPfx,
            expiresAt: Date.now() + PENDING_TIMEOUT_MS(),
        };

        const pendingImg = await generatePrefixCard(
            isGlobal ? newPrefix : sysPfx,
            isGlobal ? newPrefix : newPrefix,
            { phase: "pending", lang, history }
        ).catch(() => null);

        const confirmText = isGlobal ? getLang("confirmGlobal") : getLang("confirmThisThread");

        return message.reply(
            S([
                isGlobal ? "🌐 Global prefix change" : "💬 Chat prefix change",
                "---",
                `New prefix : ${newPrefix}`,
                `Old prefix : ${formSet.oldPrefix}`,
                "React within 60s to confirm.",
            ]),
            async (err, info) => {
                formSet.messageID = info.messageID;
                global.GoatBot.onReaction.set(info.messageID, formSet);

                setTimeout(() => {
                    if (global.GoatBot.onReaction.has(info.messageID)) {
                        global.GoatBot.onReaction.delete(info.messageID);
                        message.reply(S([getLang("expired")])).catch(() => {});
                    }
                }, PENDING_TIMEOUT_MS());

                if (pendingImg) {
                    const imgPath = path.join(__dirname, `prefix_pending_${Date.now()}.png`);
                    fs.writeFileSync(imgPath, pendingImg);
                    await message.reply({ body: confirmText, attachment: fs.createReadStream(imgPath) });
                    fs.unlinkSync(imgPath);
                } else {
                    await message.reply(confirmText);
                }
            }
        );
    },

    onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
        const { author, newPrefix, setGlobal, threadID, lang, oldPrefix, expiresAt } = Reaction;

        if (event.userID !== author) {
            return message.reply(S([getLang("wrongUser")]));
        }

        if (Date.now() > expiresAt) {
            global.GoatBot.onReaction.delete(Reaction.messageID);
            return message.reply(S([getLang("expired")]));
        }

        global.GoatBot.onReaction.delete(Reaction.messageID);

        const uid      = String(event.userID);
        const sysPfx   = global.GoatBot.config.prefix;
        const locked   = isLocked(threadID);
        const detLang  = lang || detectLang(threadID);

        if (setGlobal) {
            global.GoatBot.config.prefix = newPrefix;
            fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
            addHistory(threadID, oldPrefix);
            addLog(uid, threadID, oldPrefix, newPrefix, "global");
            return sendCard(message, newPrefix, newPrefix, {
                prevPrefix: oldPrefix,
                history: getHistory(threadID),
                locked,
                lang: detLang,
                phase: "confirmed",
            });
        } else {
            await threadsData.set(threadID, newPrefix, "data.prefix");
            addHistory(threadID, oldPrefix);
            addLog(uid, threadID, oldPrefix, newPrefix, "thread");
            return sendCard(message, sysPfx, newPrefix, {
                prevPrefix: oldPrefix,
                history: getHistory(threadID),
                locked,
                lang: detLang,
                phase: "confirmed",
            });
        }
    },

    onChat: async function ({ event, message }) {
        if (!event.body) return;
        const body = event.body.trim();
        if (!/^[!?~\-\.]?prefix[?!]?$/i.test(body)) return;

        const threadID = String(event.threadID);
        const lang     = detectLang(threadID);
        const sysPfx   = global.GoatBot.config.prefix;
        const boxPfx   = utils.getPrefix(threadID);
        const locked   = isLocked(threadID);
        const history  = getHistory(threadID);

        return sendCard(message, sysPfx, boxPfx, { history, locked, lang });
    }
};