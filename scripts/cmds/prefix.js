const fs = require("fs-extra");
const path = require("path");
const { createCanvas } = require("canvas");
const { utils } = global;

module.exports = {
 config: {
 name: "prefix",
 version: "2.0",
 author: "NTKhang",
 countDown: 5,
 role: 0,
 description: "Change the bot prefix",
 category: "config",
 guide: {
 en: " {pn} <new prefix>\n"
 + " {pn} reset — Reset to default\n"
 + " {pn} <prefix> -g — Change globally (admin only)"
 }
 },

 langs: {
 en: {
 reset: "✅ Prefix reset to default: %1",
 onlyAdmin: "🚫 Only admins can change the global prefix.",
 confirmGlobal: "💬 React to this message to confirm the global prefix change.",
 confirmThisThread: "💬 React to this message to confirm the prefix change in this chat.",
 successGlobal: "✅ Global prefix changed to: %1",
 successThisThread: "✅ Prefix for this chat changed to: %1",
 tooLong: "❌ Prefix too long (max 5 characters).",
 noPrefix: "❌ Please provide a new prefix.",
 }
 },

 roundRect(ctx, x, y, w, h, r) {
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
 },

 async generatePrefixCard(systemPrefix, boxPrefix) {
 const W = 580, H = 240;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");

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
 borderG.addColorStop(0, "#d4af37");
 borderG.addColorStop(0.5, "#b8960c");
 borderG.addColorStop(1, "#d4af37");
 ctx.strokeStyle = borderG;
 ctx.lineWidth = 2.5;
 this.roundRect(ctx, 10, 10, W - 20, H - 20, 18);
 ctx.stroke();

 const hdrG = ctx.createLinearGradient(0, 0, W, 0);
 hdrG.addColorStop(0, "rgba(212,175,55,0.25)");
 hdrG.addColorStop(0.5, "rgba(212,175,55,0.08)");
 hdrG.addColorStop(1, "rgba(212,175,55,0.25)");
 ctx.fillStyle = hdrG;
 ctx.fillRect(10, 10, W - 20, 62);

 ctx.font = "bold 21px 'Courier New'";
 ctx.fillStyle = "#d4af37";
 ctx.shadowColor = "#d4af37";
 ctx.shadowBlur = 14;
 ctx.fillText("🦔 HEDGEHOG BOT — PREFIX", 28, 50);
 ctx.shadowBlur = 0;

 ctx.strokeStyle = "rgba(212,175,55,0.18)";
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(28, 82); ctx.lineTo(W - 28, 82);
 ctx.stroke();

 const drawBlock = (label, value, icon, color, yTop) => {
 ctx.fillStyle = "rgba(255,255,255,0.04)";
 this.roundRect(ctx, 28, yTop, W - 56, 52, 10);
 ctx.fill();
 ctx.strokeStyle = color + "33";
 ctx.lineWidth = 1;
 ctx.stroke();

 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.38)";
 ctx.fillText(label, 44, yTop + 16);

 ctx.font = "bold 22px 'Courier New'";
 ctx.fillStyle = color;
 ctx.shadowColor = color;
 ctx.shadowBlur = 10;
 ctx.fillText(`${icon} ${value}`, 44, yTop + 40);
 ctx.shadowBlur = 0;
 };

 drawBlock("SYSTEM PREFIX", systemPrefix, "🌐", "#d4af37", 92);
 drawBlock("THIS CHAT PREFIX", boxPrefix, "💬", "#818cf8", 156);

 const d = new Date();
 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = "rgba(212,175,55,0.35)";
 ctx.textAlign = "center";
 ctx.fillText(
 `HEDGEHOG BOT • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`,
 W / 2, H - 16
 );
 ctx.textAlign = "left";

 return canvas.toBuffer("image/png");
 },

 S(lines) {
 let out = "╭─────────────•┈┈\n";
 for (const l of lines) {
 if (l === "---") { out += "├─────────────•┈┈\n"; continue; }
 out += `│ ${l}\n`;
 }
 return out + "╰─────────────•┈┈";
 },

 async sendPrefixCard(message, systemPrefix, boxPrefix) {
 const body = this.S([
 "🦔 HEDGEHOG — PREFIX",
 "---",
 `🌐 System : ${systemPrefix}`,
 `💬 Chat : ${boxPrefix}`,
 ]);
 try {
 const img = await this.generatePrefixCard(systemPrefix, boxPrefix);
 const imgPath = path.join(__dirname, `prefix_card_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({ body, attachment: fs.createReadStream(imgPath) });
 fs.unlinkSync(imgPath);
 } catch {
 await message.reply(body);
 }
 },

 onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
 if (!args[0]) {
 const systemPrefix = global.GoatBot.config.prefix;
 const boxPrefix = utils.getPrefix(event.threadID);
 return this.sendPrefixCard(message, systemPrefix, boxPrefix);
 }

 if (args[0] === "reset") {
 await threadsData.set(event.threadID, null, "data.prefix");
 const systemPrefix = global.GoatBot.config.prefix;
 try {
 const img = await this.generatePrefixCard(systemPrefix, systemPrefix);
 const imgPath = path.join(__dirname, `prefix_reset_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({
 body: this.S(["✅ Prefix reset to default.", `🌐 Active prefix: ${systemPrefix}`]),
 attachment: fs.createReadStream(imgPath),
 });
 fs.unlinkSync(imgPath);
 } catch {
 message.reply(getLang("reset", systemPrefix));
 }
 return;
 }

 const newPrefix = args[0];
 if (newPrefix.length > 5) {
 return message.reply(this.S([getLang("tooLong")]));
 }

 const formSet = { commandName, author: event.senderID, newPrefix };
 if (args[1] === "-g") {
 if (role < 2) return message.reply(this.S([getLang("onlyAdmin")]));
 formSet.setGlobal = true;
 } else {
 formSet.setGlobal = false;
 }

 return message.reply(
 this.S([
 args[1] === "-g" ? "🌐 Global prefix change" : "💬 Chat prefix change",
 "---",
 `New prefix : ${newPrefix}`,
 "React to this message to confirm.",
 ]),
 (err, info) => {
 formSet.messageID = info.messageID;
 global.GoatBot.onReaction.set(info.messageID, formSet);
 }
 );
 },

 onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
 const { author, newPrefix, setGlobal } = Reaction;
 if (event.userID !== author) return;

 if (setGlobal) {
 global.GoatBot.config.prefix = newPrefix;
 fs.writeFileSync(
 global.client.dirConfig,
 JSON.stringify(global.GoatBot.config, null, 2)
 );
 try {
 const img = await this.generatePrefixCard(newPrefix, newPrefix);
 const imgPath = path.join(__dirname, `prefix_global_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({
 body: this.S(["✅ Global prefix updated.", `🌐 New prefix: ${newPrefix}`]),
 attachment: fs.createReadStream(imgPath),
 });
 fs.unlinkSync(imgPath);
 } catch {
 message.reply(getLang("successGlobal", newPrefix));
 }
 } else {
 await threadsData.set(event.threadID, newPrefix, "data.prefix");
 const systemPrefix = global.GoatBot.config.prefix;
 try {
 const img = await this.generatePrefixCard(systemPrefix, newPrefix);
 const imgPath = path.join(__dirname, `prefix_thread_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({
 body: this.S(["✅ Chat prefix updated.", `💬 New prefix: ${newPrefix}`]),
 attachment: fs.createReadStream(imgPath),
 });
 fs.unlinkSync(imgPath);
 } catch {
 message.reply(getLang("successThisThread", newPrefix));
 }
 }
 },

 onChat: async function ({ event, message }) {
 if (!event.body) return;
 const body = event.body.toLowerCase().trim();
 if (body !== "prefix") return;

 const systemPrefix = global.GoatBot.config.prefix;
 const boxPrefix = utils.getPrefix(event.threadID);
 return this.sendPrefixCard(message, systemPrefix, boxPrefix);
 }
};