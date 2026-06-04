const os = require("os");
const moment = require("moment-timezone");
const { createCanvas } = require("canvas");
const fs = require("fs");

const TIMEZONE = "Africa/Douala";

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return { d, h, m, s };
}

function uptimeBar(seconds, maxSeconds) {
    const pct  = Math.min(seconds / maxSeconds, 1);
    const fill = Math.round(pct * 20);
    return "█".repeat(fill) + "░".repeat(20 - fill) + ` ${(pct * 100).toFixed(1)}%`;
}

function ramBar(used, total) {
    const pct  = Math.min(used / total, 1);
    const fill = Math.round(pct * 20);
    const color = pct > 0.85 ? "🔴" : pct > 0.6 ? "🟡" : "🟢";
    return color + " " + "█".repeat(fill) + "░".repeat(20 - fill) + ` ${(pct * 100).toFixed(1)}%`;
}

function getSystemStatus(usedMem, totalMem, cpuLoad) {
    const ramPct = usedMem / totalMem;
    if (ramPct > 0.9 || cpuLoad > 90) return { icon: "🔴", label: "Critique" };
    if (ramPct > 0.7 || cpuLoad > 70) return { icon: "🟡", label: "Modéré" };
    return { icon: "🟢", label: "Optimal" };
}

function getCpuLoad() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
        for (const type in cpu.times) totalTick += cpu.times[type];
        totalIdle += cpu.times.idle;
    }
    return Math.round((1 - totalIdle / totalTick) * 100);
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

async function generateUptimeCard({ botUptime, serverUptime, usedMem, totalMem, cpuSpeed, cpuLoad, currentTime, status, prefix }) {
    const W = 680, H = 520;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07050f");
    bg.addColorStop(0.5, "#100e22");
    bg.addColorStop(1, "#060410");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderColor = status.icon === "🟢" ? "#22c55e" : status.icon === "🟡" ? "#f59e0b" : "#ef4444";
    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, borderColor);
    borderG.addColorStop(0.5, borderColor + "66");
    borderG.addColorStop(1, borderColor);
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 8, 8, W - 16, H - 16, 18);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, borderColor + "28");
    hdrG.addColorStop(0.5, borderColor + "0a");
    hdrG.addColorStop(1, borderColor + "28");
    ctx.fillStyle = hdrG;
    ctx.fillRect(8, 8, W - 16, 68);

    ctx.font = "bold 22px 'Courier New'";
    ctx.fillStyle = borderColor;
    ctx.fillText("🦔 HEDGEHOG BOT — STATUS", 28, 46);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = borderColor + "99";
    ctx.fillText(`Prefix : ${prefix}  •  ${status.icon} Système ${status.label}  •  ${currentTime}`, 30, 66);

    const drawSection = (title, color, y) => {
        ctx.fillStyle = color + "18";
        roundRect(ctx, 28, y, W - 56, 34, 8);
        ctx.fill();
        ctx.strokeStyle = color + "44";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = color;
        ctx.fillText(title, 42, y + 23);
    };

    const drawBar = (label, pct, color, y) => {
        const barW = W - 56;
        ctx.font = "9px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fillText(label, 28, y);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        roundRect(ctx, 28, y + 6, barW, 12, 6);
        ctx.fill();
        const fg = ctx.createLinearGradient(28, 0, 28 + barW * pct, 0);
        fg.addColorStop(0, color);
        fg.addColorStop(1, color + "88");
        ctx.fillStyle = fg;
        roundRect(ctx, 28, y + 6, Math.max(barW * pct, 10), 12, 6);
        ctx.fill();
        ctx.font = "9px 'Courier New'";
        ctx.fillStyle = color;
        ctx.textAlign = "right";
        ctx.fillText(`${(pct * 100).toFixed(1)}%`, W - 28, y);
        ctx.textAlign = "left";
    };

    const drawStat = (label, value, color, cx, cy) => {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, cx, cy, 180, 52, 8);
        ctx.fill();
        ctx.strokeStyle = color + "44";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(label, cx + 10, cy + 16);
        ctx.font = `bold ${value.length > 12 ? "11" : "14"}px 'Courier New'`;
        ctx.fillStyle = color;
        ctx.fillText(value, cx + 10, cy + 38);
    };

    const bot  = formatUptime(botUptime);
    const serv = formatUptime(serverUptime);

    drawSection("⏱️ BOT UPTIME", "#818cf8", 90);
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(`${bot.d}j ${bot.h}h ${bot.m}m ${bot.s}s`, 28, 148);
    drawBar("", Math.min(botUptime / (7 * 86400), 1), "#818cf8", 155);

    drawSection("🖥️ SERVER UPTIME", "#60a5fa", 186);
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText(`${serv.d}j ${serv.h}h ${serv.m}m ${serv.s}s`, 28, 244);
    drawBar("", Math.min(serverUptime / (30 * 86400), 1), "#60a5fa", 251);

    drawSection("💾 MEMORY & CPU", "#34d399", 282);
    const ramPct = usedMem / totalMem;
    const ramColor = ramPct > 0.85 ? "#ef4444" : ramPct > 0.6 ? "#f59e0b" : "#34d399";
    drawBar(`RAM : ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB`, ramPct, ramColor, 326);
    const cpuPct = cpuLoad / 100;
    const cpuColor = cpuPct > 0.85 ? "#ef4444" : cpuPct > 0.6 ? "#f59e0b" : "#a78bfa";
    drawBar(`CPU : ${cpuLoad}% utilisé  •  ${cpuSpeed} MHz`, cpuPct, cpuColor, 348);

    drawSection("📊 INFOS SYSTEM", "#fbbf24", 372);
    const statItems = [
        { label: "PLATEFORME", value: os.platform(),          color: "#fbbf24" },
        { label: "ARCHITECTURE", value: os.arch(),            color: "#fbbf24" },
        { label: "CPU CŒURS",  value: `${os.cpus().length}`, color: "#f59e0b" },
        { label: "NODE.JS",    value: process.version,        color: "#34d399" },
    ];
    for (let i = 0; i < statItems.length; i++) {
        const col = i % 3, row = Math.floor(i / 3);
        drawStat(statItems[i].label, statItems[i].value, statItems[i].color, 28 + col * 190, 412 + row * 62);
    }

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = borderColor + "55";
    ctx.textAlign = "center";
    ctx.fillText("HEDGEHOG GPT • SYSTÈME MONITORING", W / 2, H - 14);
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
        name: "uptime",
        aliases: ["upt", "up", "status"],
        version: "2.0",
        author: "Ismael04-lag",
        role: 0,
        shortDescription: { en: "Affiche le statut complet du bot et du serveur." },
        longDescription: { en: "Uptime bot/serveur, RAM, CPU, plateforme, heure au Cameroun — avec carte visuelle." },
        category: "system",
        guide: { en: "Use {p}uptime" }
    },

    onStart: async function ({ api, event, prefix }) {
        try {
            const botUptime    = process.uptime();
            const serverUptime = os.uptime();
            const totalMem     = os.totalmem() / (1024 ** 3);
            const freeMem      = os.freemem()  / (1024 ** 3);
            const usedMem      = totalMem - freeMem;
            const cpuSpeed     = os.cpus()[0]?.speed || 0;
            const cpuLoad      = getCpuLoad();
            const status       = getSystemStatus(usedMem, totalMem, cpuLoad);
            const now          = moment().tz(TIMEZONE);
            const currentTime  = now.format("DD/MM/YYYY  HH:mm:ss");
            const bot          = formatUptime(botUptime);
            const serv         = formatUptime(serverUptime);
            const ramPct       = (usedMem / totalMem * 100).toFixed(1);
            const ramIcon      = usedMem / totalMem > 0.85 ? "🔴" : usedMem / totalMem > 0.6 ? "🟡" : "🟢";

            await api.sendMessage(S([
                "🦔 HEDGEHOG GPT — STATUS",
                "---",
                `⏱️ Bot uptime   : ${bot.d}j ${bot.h}h ${bot.m}m ${bot.s}s`,
                `🖥️ Server uptime: ${serv.d}j ${serv.h}h ${serv.m}m ${serv.s}s`,
                "---",
                `${ramIcon} RAM : ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB (${ramPct}%)`,
                `⚡ CPU : ${cpuLoad}%  •  ${cpuSpeed} MHz`,
                `🔧 OS  : ${os.platform()} ${os.arch()}`,
                `💚 Node: ${process.version}`,
                "---",
                `${status.icon} System : ${status.label}`,
                `📅 Hour Cameroon : ${currentTime}`,
                `🔑 Prefix : ${prefix}`,
            ]), event.threadID);

            try {
                const img = await generateUptimeCard({
                    botUptime, serverUptime, usedMem, totalMem,
                    cpuSpeed, cpuLoad, currentTime, status, prefix,
                });
                const imgPath = `./uptime_card_${Date.now()}.png`;
                fs.writeFileSync(imgPath, img);
                await api.sendMessage(
                    { body: "📊 Carte de statut :", attachment: fs.createReadStream(imgPath) },
                    event.threadID
                );
                fs.unlinkSync(imgPath);
            } catch {}

        } catch (error) {
            console.error("Uptime error:", error);
            api.sendMessage(S([
                "🔴 Erreur système",
                "---",
                error.message,
            ]), event.threadID);
        }
    }
};