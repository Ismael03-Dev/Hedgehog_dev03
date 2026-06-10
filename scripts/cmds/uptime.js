const os = require("os");
const moment = require("moment-timezone");
const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const TIMEZONE = "Africa/Douala";
const BOT_NAME = "HEDGEHOG GPT";
const BOT_EMOJI = "🦔";
const MAX_UPTIME = 30 * 86400;

function formatUptime(seconds) {
 const d = Math.floor(seconds / 86400);
 const h = Math.floor((seconds % 86400) / 3600);
 const m = Math.floor((seconds % 3600) / 60);
 const s = Math.floor(seconds % 60);
 return { d, h, m, s, total: seconds };
}

function getCpuLoad() {
 const cpus = os.cpus();
 let totalIdle = 0;
 let totalTick = 0;
 for (const cpu of cpus) {
 for (const type in cpu.times) totalTick += cpu.times[type];
 totalIdle += cpu.times.idle;
 }
 return Math.round((1 - totalIdle / totalTick) * 100);
}

function getStatusLevel(ramPct, cpuLoad) {
 if (ramPct > 0.9 || cpuLoad > 90) return { icon: "🔴", label: "Critique", color: "#ef4444", hex: "ef4444" };
 if (ramPct > 0.7 || cpuLoad > 70) return { icon: "🟡", label: "Modéré", color: "#f59e0b", hex: "f59e0b" };
 return { icon: "🟢", label: "Optimal", color: "#22c55e", hex: "22c55e" };
}

function getUptrend(seconds) {
 if (seconds > 7 * 86400) return "🔥 Excellent";
 if (seconds > 3 * 86400) return "💪 Stable";
 if (seconds > 86400) return "✅ Bon";
 if (seconds > 3600) return "🔄 Récent";
 return "⚡ Démarrage";
}

function buildTextCard(data) {
 const { bot, serv, usedMem, totalMem, cpuLoad, cpuSpeed, status, currentTime, prefix, nodeVersion, platform, arch, cpuCores, networkInterfaces } = data;

 const ramPct = (usedMem / totalMem * 100).toFixed(1);
 const ramIcon = usedMem / totalMem > 0.85 ? "🔴" : usedMem / totalMem > 0.6 ? "🟡" : "🟢";
 const cpuIcon = cpuLoad > 85 ? "🔴" : cpuLoad > 60 ? "🟡" : "🟢";
 const botTrend = getUptrend(bot.total);
 const srvTrend = getUptrend(serv.total);

 const lines = [
 `${BOT_EMOJI} ${BOT_NAME} — STATUS`,
 "---",
 `⏱️ Bot : ${bot.d}j ${bot.h}h ${bot.m}m ${bot.s}s ${botTrend}`,
 `🖥️ Serveur : ${serv.d}j ${serv.h}h ${serv.m}m ${serv.s}s ${srvTrend}`,
 "---",
 `${ramIcon} RAM : ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB (${ramPct}%)`,
 `${cpuIcon} CPU : ${cpuLoad}% • ${cpuSpeed} MHz • ${cpuCores} cœurs`,
 "---",
 `🔧 OS : ${platform} ${arch}`,
 `💚 Node : ${nodeVersion}`,
 `🌐 Réseau : ${networkInterfaces}`,
 "---",
 `${status.icon} Statut : ${status.label}`,
 `📅 Heure : ${currentTime}`,
 `🔑 Prefix : ${prefix}`,
 ];

 let out = "╭─────────────────────•\n";
 for (const l of lines) {
 if (l === "---") { out += "├─────────────────────•\n"; continue; }
 out += `│ ${l}\n`;
 }
 return out + "╰─────────────────────•";
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

function drawGlowBar(ctx, x, y, w, h, pct, colorStart, colorEnd) {
 ctx.fillStyle = "rgba(255,255,255,0.05)";
 roundRect(ctx, x, y, w, h, h / 2);
 ctx.fill();

 const filled = Math.max(w * pct, h);
 const grad = ctx.createLinearGradient(x, 0, x + filled, 0);
 grad.addColorStop(0, colorStart);
 grad.addColorStop(1, colorEnd);
 ctx.fillStyle = grad;
 roundRect(ctx, x, y, filled, h, h / 2);
 ctx.fill();

 ctx.shadowColor = colorStart;
 ctx.shadowBlur = 8;
 roundRect(ctx, x, y, filled, h, h / 2);
 ctx.fill();
 ctx.shadowBlur = 0;
}

async function generateCard(data) {
 const { bot, serv, usedMem, totalMem, cpuLoad, cpuSpeed, status, currentTime, prefix, nodeVersion, platform, arch, cpuCores } = data;

 const W = 700, H = 580;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");
 const SC = status.color;

 const bg = ctx.createLinearGradient(0, 0, W, H);
 bg.addColorStop(0, "#06040f");
 bg.addColorStop(0.4, "#0e0c20");
 bg.addColorStop(1, "#050310");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = "rgba(255,255,255,0.015)";
 for (let x = 0; x < W; x += 30)
 for (let y = 0; y < H; y += 30)
 ctx.fillRect(x, y, 1, 1);

 const borderGrad = ctx.createLinearGradient(0, 0, W, H);
 borderGrad.addColorStop(0, SC);
 borderGrad.addColorStop(0.5, SC + "55");
 borderGrad.addColorStop(1, SC);
 ctx.strokeStyle = borderGrad;
 ctx.lineWidth = 2;
 roundRect(ctx, 6, 6, W - 12, H - 12, 20);
 ctx.stroke();

 ctx.shadowColor = SC;
 ctx.shadowBlur = 18;
 ctx.strokeStyle = SC + "33";
 ctx.lineWidth = 1;
 roundRect(ctx, 10, 10, W - 20, H - 20, 17);
 ctx.stroke();
 ctx.shadowBlur = 0;

 const hdrGrad = ctx.createLinearGradient(0, 0, W, 0);
 hdrGrad.addColorStop(0, SC + "30");
 hdrGrad.addColorStop(0.5, SC + "0a");
 hdrGrad.addColorStop(1, SC + "30");
 ctx.fillStyle = hdrGrad;
 ctx.fillRect(6, 6, W - 12, 70);

 ctx.font = "bold 20px 'Courier New'";
 ctx.fillStyle = SC;
 ctx.shadowColor = SC;
 ctx.shadowBlur = 10;
 ctx.fillText(`${BOT_EMOJI} ${BOT_NAME} — MONITORING`, 24, 38);
 ctx.shadowBlur = 0;

 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = SC + "99";
 ctx.fillText(`Prefix: ${prefix} • ${status.icon} ${status.label} • ${currentTime}`, 26, 60);

 const sectionTitle = (title, color, y) => {
 ctx.fillStyle = color + "15";
 roundRect(ctx, 22, y, W - 44, 30, 7);
 ctx.fill();
 ctx.strokeStyle = color + "40";
 ctx.lineWidth = 1;
 ctx.stroke();
 ctx.font = "bold 11px 'Courier New'";
 ctx.fillStyle = color;
 ctx.fillText(title, 34, y + 20);
 };

 const labeledBar = (label, pct, c1, c2, valueLabel, y) => {
 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.5)";
 ctx.fillText(label, 22, y);
 ctx.fillStyle = c1;
 ctx.textAlign = "right";
 ctx.fillText(valueLabel, W - 22, y);
 ctx.textAlign = "left";
 drawGlowBar(ctx, 22, y + 5, W - 44, 10, pct, c1, c2);
 };

 const miniStat = (label, value, color, cx, cy) => {
 ctx.fillStyle = "rgba(255,255,255,0.04)";
 roundRect(ctx, cx, cy, 152, 48, 7);
 ctx.fill();
 ctx.strokeStyle = color + "40";
 ctx.lineWidth = 1;
 ctx.stroke();
 ctx.font = "7px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.35)";
 ctx.fillText(label, cx + 8, cy + 14);
 ctx.font = `bold ${value.length > 10 ? "10" : "12"}px 'Courier New'`;
 ctx.fillStyle = color;
 ctx.fillText(value, cx + 8, cy + 34);
 };

 const bot = data.bot;
 const serv = data.serv;

 sectionTitle("⏱️ BOT UPTIME", "#818cf8", 88);
 ctx.font = "bold 13px 'Courier New'";
 ctx.fillStyle = "#c4b5fd";
 ctx.fillText(`${bot.d}j ${bot.h}h ${bot.m}m ${bot.s}s ${getUptrend(bot.total)}`, 22, 142);
 labeledBar("", Math.min(bot.total / MAX_UPTIME, 1), "#818cf8", "#c4b5fd", `${(Math.min(bot.total / MAX_UPTIME, 1) * 100).toFixed(1)}%`, 150);

 sectionTitle("🖥️ SERVER UPTIME", "#60a5fa", 178);
 ctx.font = "bold 13px 'Courier New'";
 ctx.fillStyle = "#93c5fd";
 ctx.fillText(`${serv.d}j ${serv.h}h ${serv.m}m ${serv.s}s ${getUptrend(serv.total)}`, 22, 232);
 labeledBar("", Math.min(serv.total / MAX_UPTIME, 1), "#60a5fa", "#93c5fd", `${(Math.min(serv.total / MAX_UPTIME, 1) * 100).toFixed(1)}%`, 240);

 sectionTitle("💾 MÉMOIRE & CPU", "#34d399", 268);
 const ramPct = usedMem / totalMem;
 const ramC = ramPct > 0.85 ? "#ef4444" : ramPct > 0.6 ? "#f59e0b" : "#34d399";
 const ramC2 = ramPct > 0.85 ? "#fca5a5" : ramPct > 0.6 ? "#fde68a" : "#6ee7b7";
 labeledBar(`RAM ${usedMem.toFixed(2)} / ${totalMem.toFixed(2)} GB`, ramPct, ramC, ramC2, `${(ramPct * 100).toFixed(1)}%`, 312);

 const cpuPct = cpuLoad / 100;
 const cpuC = cpuPct > 0.85 ? "#ef4444" : cpuPct > 0.6 ? "#f59e0b" : "#a78bfa";
 const cpuC2 = cpuPct > 0.85 ? "#fca5a5" : cpuPct > 0.6 ? "#fde68a" : "#ddd6fe";
 labeledBar(`CPU ${cpuLoad}% • ${cpuSpeed} MHz • ${cpuCores} cœurs`, cpuPct, cpuC, cpuC2, `${cpuLoad}%`, 334);

 sectionTitle("📊 INFORMATIONS SYSTÈME", "#fbbf24", 360);

 const stats = [
 { label: "PLATEFORME", value: platform, color: "#fbbf24" },
 { label: "ARCHITECTURE", value: arch, color: "#fbbf24" },
 { label: "CPU CŒURS", value: `${cpuCores}`, color: "#f59e0b" },
 { label: "NODE.JS", value: nodeVersion, color: "#34d399" },
 ];

 for (let i = 0; i < stats.length; i++) {
 const col = i % 4;
 miniStat(stats[i].label, stats[i].value, stats[i].color, 22 + col * 162, 400);
 }

 sectionTitle("🔢 MÉTRIQUES AVANCÉES", "#f472b6", 462);

 const memTotal = (os.totalmem() / (1024 ** 3)).toFixed(2);
 const heapUsed = (process.memoryUsage().heapUsed / (1024 ** 2)).toFixed(1);
 const heapTotal = (process.memoryUsage().heapTotal / (1024 ** 2)).toFixed(1);
 const rss = (process.memoryUsage().rss / (1024 ** 2)).toFixed(1);

 const advanced = [
 { label: "HEAP USED", value: `${heapUsed} MB`, color: "#f472b6" },
 { label: "HEAP TOTAL", value: `${heapTotal} MB`, color: "#f472b6" },
 { label: "RSS", value: `${rss} MB`, color: "#fb7185" },
 { label: "MEM TOTAL", value: `${memTotal} GB`, color: "#f9a8d4" },
 ];

 for (let i = 0; i < advanced.length; i++) {
 const col = i % 4;
 miniStat(advanced[i].label, advanced[i].value, advanced[i].color, 22 + col * 162, 502);
 }

 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = SC + "44";
 ctx.textAlign = "center";
 ctx.fillText(`${BOT_NAME} • SYSTÈME MONITORING • ${currentTime}`, W / 2, H - 12);
 ctx.textAlign = "left";

 return canvas.toBuffer("image/png");
}

module.exports = {
 config: {
 name: "uptime",
 aliases: ["upt", "up", "status", "ping"],
 version: "3.0",
 author: "Ismael04-lag",
 role: 0,
 shortDescription: { en: "Statut complet du bot et du serveur avec carte visuelle." },
 longDescription: { en: "Uptime bot/serveur, RAM, CPU, heap, réseau, plateforme — carte HD avec barres animées." },
 category: "system",
 guide: { en: "Use {p}uptime" }
 },

 onStart: async function ({ api, event, prefix }) {
 try {
 const botUptime = process.uptime();
 const serverUptime = os.uptime();
 const totalMem = os.totalmem() / (1024 ** 3);
 const freeMem = os.freemem() / (1024 ** 3);
 const usedMem = totalMem - freeMem;
 const cpuSpeed = os.cpus()[0]?.speed || 0;
 const cpuCores = os.cpus().length;
 const cpuLoad = getCpuLoad();
 const nodeVersion = process.version;
 const platform = os.platform();
 const arch = os.arch();
 const status = getStatusLevel(usedMem / totalMem, cpuLoad);
 const now = moment().tz(TIMEZONE);
 const currentTime = now.format("DD/MM/YYYY HH:mm:ss");
 const bot = formatUptime(botUptime);
 const serv = formatUptime(serverUptime);

 const nets = os.networkInterfaces();
 const ipList = [];
 for (const name in nets) {
 for (const net of nets[name]) {
 if (net.family === "IPv4" && !net.internal) ipList.push(net.address);
 }
 }
 const networkInterfaces = ipList.length ? ipList[0] : "local";

 const cardData = {
 bot, serv, usedMem, totalMem, cpuLoad, cpuSpeed,
 cpuCores, status, currentTime, prefix,
 nodeVersion, platform, arch, networkInterfaces
 };

 await api.sendMessage(
 buildTextCard(cardData),
 event.threadID
 );

 try {
 const imgBuffer = await generateCard(cardData);
 const imgPath = path.join(process.cwd(), `uptime_${Date.now()}.png`);
 fs.writeFileSync(imgPath, imgBuffer);

 await api.sendMessage(
 { body: "📊 Carte de monitoring :", attachment: fs.createReadStream(imgPath) },
 event.threadID
 );

 fs.unlinkSync(imgPath);
 } catch (imgErr) {
 console.error("[uptime] Carte image échouée :", imgErr.message);
 }

 } catch (err) {
 console.error("[uptime] Erreur :", err);
 api.sendMessage(
 `╭─────────────────────•\n│ 🔴 Erreur système\n├─────────────────────•\n│ ${err.message}\n╰─────────────────────•`,
 event.threadID
 );
 }
 }
};