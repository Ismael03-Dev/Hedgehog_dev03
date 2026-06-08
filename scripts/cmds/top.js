const fs = require("fs");
const { createCanvas, loadImage, registerFont } = require("canvas");
const path = require("path");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";

const MAX_LIMIT = 10n ** 261n;

function toBigInt(value) {
 if (typeof value === 'bigint') return value;
 if (value === undefined || value === null) return 0n;
 try {
 return BigInt(String(value).split('.')[0]);
 } catch {
 return 0n;
 }
}

async function formatNumber(num) {
 const bigNum = toBigInt(num);
 if (bigNum === 0n) return "0";
 if (bigNum >= MAX_LIMIT || bigNum <= -MAX_LIMIT) return "∞";
 
 try {
 const r = await axios.get(`${FORMAT_URL}?n=${bigNum.toString()}`, { timeout: 5000 });
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
 
 let scaled = bigNum;
 let suffixIndex = 0;
 const thousand = 1000n;
 
 while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
 scaled = scaled / thousand;
 suffixIndex++;
 }
 
 if (suffixIndex === suffixes.length - 1 && scaled >= thousand) return "∞";
 
 const divisor = thousand ** BigInt(suffixIndex);
 const remainder = (bigNum % divisor) * 100n / divisor;
 
 if (suffixIndex > 0 && remainder > 0n) {
 const decStr = remainder.toString().padStart(2, '0').slice(0, 2).replace(/0+$/, '');
 return decStr ? `${scaled}.${decStr}${suffixes[suffixIndex]}` : `${scaled}${suffixes[suffixIndex]}`;
 }
 
 if (suffixIndex === 0) {
 return bigNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
 }
 
 return `${scaled}${suffixes[suffixIndex]}`;
}

async function getAllUsersCash() {
 try {
 const response = await axios.get(`${CASH_API_URL}/top?limit=50`, { timeout: 15000 });
 if (response.data && response.data.success && Array.isArray(response.data.data)) {
 return response.data.data;
 }
 } catch (error) {
 console.error("Cash API Error:", error.message);
 }
 
 try {
 const bankResponse = await axios.get(`https://bank-save-production.up.railway.app/api/bank/top`, { timeout: 10000 });
 if (bankResponse.data && bankResponse.data.success && Array.isArray(bankResponse.data.data)) {
 return bankResponse.data.data.map(item => ({
 userId: item.userId,
 cash: item.bank || 0
 }));
 }
 } catch (bankError) {
 console.error("Bank API Error:", bankError.message);
 }
 
 return [];
}

async function getAvatarUrl(uid, api) {
 try {
 const info = await api.getUserInfo(uid);
 return info[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
 } catch(e) {
 return `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
 }
}

async function getUserName(uid, api) {
 return new Promise((resolve) => {
 api.getUserInfo(uid, (err, data) => {
 if (err || !data || !data[uid]) {
 resolve(`User_${String(uid).slice(-5)}`);
 } else {
 const name = data[uid].name;
 if (name && name !== "Facebook User" && name !== "Utilisateur") {
 resolve(name);
 } else {
 resolve(`User_${String(uid).slice(-5)}`);
 }
 }
 });
 });
}

function formatStyledMessage(contentLines) {
 let msg = `╭────────────────────────•┈┈\n`;
 for (let line of contentLines) {
 msg += `│ ${line}\n`;
 }
 msg += `╰────────────────────────•┈┈`;
 return msg;
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

function drawTextWithEmojiSupport(ctx, text, x, y, options = {}) {
 const {
 fontSize = 24,
 fontWeight = "bold",
 color = "#ffffff",
 align = "left",
 shadow = false,
 shadowColor = "#000",
 shadowBlur = 0
 } = options;
 
 ctx.font = `${fontWeight} ${fontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Courier New', monospace`;
 ctx.fillStyle = color;
 ctx.textAlign = align;
 
 if (shadow && shadowBlur > 0) {
 ctx.shadowColor = shadowColor;
 ctx.shadowBlur = shadowBlur;
 }
 
 ctx.fillText(text, x, y);
 
 if (shadow && shadowBlur > 0) {
 ctx.shadowBlur = 0;
 }
}

function drawEmojiWithGlow(ctx, emoji, x, y, size = 48, glowColor = "#fbbf24", isWinning = false) {
 const glowStrength = isWinning ? 32 : 18;
 
 ctx.font = `${size}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji'`;
 ctx.textAlign = "center";
 ctx.fillStyle = "#ffffff";
 
 if (isWinning) {
 ctx.shadowColor = glowColor;
 ctx.shadowBlur = glowStrength;
 }
 
 ctx.fillText(emoji, x, y);
 ctx.shadowBlur = 0;
 ctx.textAlign = "left";
}

function drawStyledText(ctx, text, x, y, options = {}) {
 const {
 fontSize = 24,
 fontWeight = "bold",
 color = "#ffffff",
 align = "left",
 isJoinFont = false
 } = options;
 
 let displayText = text;
 
 if (isJoinFont) {
 const joinMap = {
 'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆',
 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍',
 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔',
 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
 'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠',
 'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧',
 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮',
 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
 '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓',
 '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
 };
 displayText = displayText.split('').map(c => joinMap[c] || c).join('');
 }
 
 ctx.font = `${fontWeight} ${fontSize}px 'Segoe UI Emoji', 'Courier New'`;
 ctx.fillStyle = color;
 ctx.textAlign = align;
 ctx.fillText(displayText, x, y);
}

async function generatePremiumTopImage(users, page, totalPages, avatars) {
 const W = 900;
 const H = 680;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");

 const bg = ctx.createLinearGradient(0, 0, 0, H);
 bg.addColorStop(0, "#07050f");
 bg.addColorStop(0.3, "#0d0b1e");
 bg.addColorStop(0.7, "#0a0818");
 bg.addColorStop(1, "#050310");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = "rgba(255,255,255,0.015)";
 for (let x = 0; x < W; x += 30)
 for (let y = 0; y < H; y += 30)
 ctx.fillRect(x, y, 1.5, 1.5);

 const borderG = ctx.createLinearGradient(0, 0, W, H);
 borderG.addColorStop(0, "#d4af37");
 borderG.addColorStop(0.5, "#ffd700");
 borderG.addColorStop(1, "#b8960c");
 ctx.strokeStyle = borderG;
 ctx.lineWidth = 2.5;
 roundRect(ctx, 10, 10, W - 20, H - 20, 16);
 ctx.stroke();

 const hdrG = ctx.createLinearGradient(0, 0, W, 0);
 hdrG.addColorStop(0, "rgba(212,175,55,0.2)");
 hdrG.addColorStop(0.5, "rgba(212,175,55,0.08)");
 hdrG.addColorStop(1, "rgba(212,175,55,0.2)");
 ctx.fillStyle = hdrG;
 ctx.fillRect(10, 10, W - 20, 80);

 drawTextWithEmojiSupport(ctx, "🏆 CLASSEMENT DES FORTUNES", W / 2, 52, {
 fontSize: 32,
 fontWeight: "bold",
 color: "#ffd700",
 align: "center",
 shadow: true,
 shadowColor: "#ffd700",
 shadowBlur: 16
 });

 drawTextWithEmojiSupport(ctx, "HEDGEHOG BANK • TOP 50", W / 2, 76, {
 fontSize: 13,
 fontWeight: "normal",
 color: "rgba(212,175,55,0.7)",
 align: "center"
 });

 drawTextWithEmojiSupport(ctx, `Page ${page}/${totalPages}`, W - 28, 48, {
 fontSize: 13,
 fontWeight: "bold",
 color: "#fbbf24",
 align: "right"
 });

 const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];

 for (let i = 0; i < 3 && i < users.length; i++) {
 const user = users[i];
 const rank = (page - 1) * 10 + i + 1;
 const px = 35 + i * 280;
 const py = 108;

 const podiumG = ctx.createLinearGradient(px, py, px, py + 180);
 podiumG.addColorStop(0, medalColors[i] + "18");
 podiumG.addColorStop(1, "rgba(0,0,0,0)");
 ctx.fillStyle = podiumG;
 roundRect(ctx, px, py, 260, 180, 14);
 ctx.fill();
 ctx.strokeStyle = medalColors[i] + "55";
 ctx.lineWidth = 1.5;
 ctx.stroke();

 const medalSize = rank === 1 ? 44 : rank === 2 ? 38 : 34;
 const medalY = py + 25;
 
 const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
 drawEmojiWithGlow(ctx, medalEmoji, px + 130, medalY + medalSize, medalSize, medalColors[i], true);

 const avatarSize = rank === 1 ? 70 : 60;
 const avatarX = px + 130 - avatarSize / 2;
 const avatarY = medalY + medalSize + 12;

 if (avatars[user.userId]) {
 try {
 const avatar = await loadImage(avatars[user.userId]);
 ctx.save();
 ctx.beginPath();
 ctx.arc(px + 130, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
 ctx.clip();
 ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
 ctx.restore();
 ctx.beginPath();
 ctx.arc(px + 130, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
 ctx.strokeStyle = medalColors[i];
 ctx.lineWidth = 2.5;
 ctx.stroke();
 } catch(e) {}
 }

 const name = user.name.length > 16 ? user.name.substring(0, 13) + "..." : user.name;
 drawTextWithEmojiSupport(ctx, name, px + 130, avatarY + avatarSize + 24, {
 fontSize: 15,
 fontWeight: "bold",
 color: "#e0e7ff",
 align: "center"
 });

 drawTextWithEmojiSupport(ctx, user.formattedCash, px + 130, avatarY + avatarSize + 46, {
 fontSize: 13,
 fontWeight: "bold",
 color: medalColors[i],
 align: "center"
 });

 drawTextWithEmojiSupport(ctx, `#${rank}`, px + 130, avatarY + avatarSize + 64, {
 fontSize: 10,
 fontWeight: "bold",
 color: "rgba(255,255,255,0.4)",
 align: "center"
 });
 }

 ctx.strokeStyle = "rgba(212,175,55,0.15)";
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(25, 310);
 ctx.lineTo(W - 25, 310);
 ctx.stroke();

 drawTextWithEmojiSupport(ctx, "RANG", 35, 338, { fontSize: 12, fontWeight: "bold", color: "#d4af37" });
 drawTextWithEmojiSupport(ctx, "JOUEUR", 90, 338, { fontSize: 12, fontWeight: "bold", color: "#d4af37" });
 drawTextWithEmojiSupport(ctx, "FORTUNE", W - 60, 338, { fontSize: 12, fontWeight: "bold", color: "#d4af37", align: "right" });

 ctx.fillStyle = "rgba(212,175,55,0.2)";
 ctx.fillRect(25, 348, W - 50, 2);

 const startY = 365;
 const rowHeight = 30;

 for (let i = 3; i < Math.min(users.length, 10); i++) {
 const user = users[i];
 const rank = (page - 1) * 10 + i + 1;
 const rowY = startY + (i - 3) * rowHeight;

 if (i % 2 === 0) {
 ctx.fillStyle = "rgba(255,255,255,0.03)";
 roundRect(ctx, 25, rowY - 8, W - 50, rowHeight, 6);
 ctx.fill();
 }

 const rankColor = rank <= 3 ? medalColors[rank - 1] : "#9ca3af";
 
 drawTextWithEmojiSupport(ctx, `${rank}`, 35, rowY + 8, {
 fontSize: 14,
 fontWeight: "bold",
 color: rankColor
 });

 if (rank <= 3) {
 const rankEmoji = rank === 1 ? "👑" : rank === 2 ? "💎" : "🌟";
 drawEmojiWithGlow(ctx, rankEmoji, 60, rowY + 12, 14, rankColor, false);
 }

 const rowName = user.name.length > 22 ? user.name.substring(0, 19) + "..." : user.name;
 drawTextWithEmojiSupport(ctx, rowName, 90, rowY + 8, {
 fontSize: 13,
 fontWeight: "normal",
 color: "#e0e7ff"
 });

 drawTextWithEmojiSupport(ctx, user.formattedCash, W - 60, rowY + 8, {
 fontSize: 13,
 fontWeight: "bold",
 color: rank <= 3 ? rankColor : "#fbbf24",
 align: "right"
 });
 }

 const footerY = H - 45;
 ctx.fillStyle = "rgba(0,0,0,0.3)";
 ctx.fillRect(0, footerY, W, 45);

 drawTextWithEmojiSupport(ctx, "💰 HEDGEHOG BANK • CLASSEMENT OFFICIEL • TOP 50 FORTUNES", W / 2, footerY + 20, {
 fontSize: 10,
 fontWeight: "normal",
 color: "rgba(212,175,55,0.5)",
 align: "center"
 });

 const date = new Date();
 const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
 drawTextWithEmojiSupport(ctx, dateStr, W / 2, footerY + 36, {
 fontSize: 10,
 fontWeight: "normal",
 color: "rgba(255,255,255,0.35)",
 align: "center"
 });

 return canvas.toBuffer("image/png");
}

module.exports = {
 config: {
 name: "top",
 version: "4.0",
 author: "Ismael Soma",
 role: 0,
 shortDescription: { en: "Top richest users" },
 longDescription: { en: "Displays the top 50 richest users with premium avatars and real names" },
 category: "economy",
 guide: { en: "{pn} [page]" }
 },

 onStart: async function ({ api, args, message, event }) {
 const allUsers = await getAllUsersCash();

 if (allUsers.length === 0) {
 return message.reply(formatStyledMessage([
 "📊 CLASSEMENT INDISPONIBLE",
 "━━━━━━━━━━━━━━━━━━",
 "❌ L'API Cash est actuellement",
 " indisponible ou vide.",
 "",
 "💡 Utilisez `bank deposit` pour",
 " commencer à gagner de l'argent !",
 "",
 "🔄 Réessaie plus tard."
 ]));
 }

 let page = args[0] ? parseInt(args[0]) : 1;
 const usersPerPage = 10;
 const totalUsers = Math.min(allUsers.length, 50);
 const totalPages = Math.ceil(totalUsers / usersPerPage);

 if (page < 1 || page > totalPages) {
 return message.reply(formatStyledMessage([`❌ Page invalide. Il y a ${totalPages} pages disponibles.`]));
 }

 const startIndex = (page - 1) * usersPerPage;
 const endIndex = startIndex + usersPerPage;
 const usersOnPage = allUsers.slice(startIndex, endIndex);

 const avatars = {};
 const enrichedUsers = [];

 for (const user of usersOnPage) {
 try {
 let name = `User_${String(user.userId).slice(-5)}`;
 try {
 const userInfo = await api.getUserInfo(user.userId);
 if (userInfo && userInfo[user.userId] && userInfo[user.userId].name) {
 const realName = userInfo[user.userId].name;
 if (realName && realName !== "Facebook User" && realName !== "Utilisateur") {
 name = realName;
 }
 }
 } catch (nameErr) {}

 if (!avatars[user.userId]) {
 avatars[user.userId] = await getAvatarUrl(user.userId, api);
 }

 const cashAmount = toBigInt(user.cash || 0);
 const formattedCash = await formatNumber(cashAmount);
 enrichedUsers.push({
 ...user,
 name: name,
 formattedCash
 });
 } catch (error) {
 console.error(`Erreur pour ${user.userId}:`, error.message);
 const cashAmount = toBigInt(user.cash || 0);
 enrichedUsers.push({
 ...user,
 name: `User_${String(user.userId).slice(-5)}`,
 formattedCash: await formatNumber(cashAmount)
 });
 }
 }

 let textMsg = `🏆 TOP 50 - LES PLUS RICHES\n━━━━━━━━━━━━━━━━━━\n`;
 for (let i = 0; i < enrichedUsers.length; i++) {
 const user = enrichedUsers[i];
 const rank = startIndex + i + 1;
 const prefix = rank === 1 ? "🥇" : (rank === 2 ? "🥈" : (rank === 3 ? "🥉" : "▸"));
 textMsg += `${prefix} ${rank}. ${user.name}: ${user.formattedCash}\n`;
 }
 textMsg += `━━━━━━━━━━━━━━━━━━\n📜 Page ${page}/${totalPages}`;

 await message.reply(textMsg);

 try {
 const img = await generatePremiumTopImage(enrichedUsers, page, totalPages, avatars);
 const imgPath = path.join(__dirname, `top_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({
 body: "💳 Classement officiel :",
 attachment: fs.createReadStream(imgPath)
 });
 setTimeout(() => {
 try { fs.unlinkSync(imgPath); } catch (e) {}
 }, 5000);
 } catch (error) {
 console.error("Erreur génération image:", error);
 }
 }
};