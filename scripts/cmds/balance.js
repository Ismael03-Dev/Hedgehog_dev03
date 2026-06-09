const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/format";

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
 const response = await axios.get(`${CONVERT_API_URL}?n=${bigNum.toString()}`, { timeout: 5000 });
 if (response.data && response.data.success) {
 if (response.data.isInfinity) return "∞";
 return response.data.formatted;
 }
 } catch (error) {}

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

async function getUserCash(userId) {
 try {
 const response = await axios.get(`${CASH_API_URL}/${userId}`, { timeout: 10000 });
 if (response.data && response.data.success && response.data.data) {
 const cashValue = toBigInt(response.data.data.cash);
 if (cashValue >= MAX_LIMIT) return MAX_LIMIT;
 return cashValue;
 }
 } catch (error) {}
 return 0n;
}

async function getUserBankData(userId) {
 try {
 const response = await axios.get(`https://bank-save-production.up.railway.app/api/bank/${userId}`, { timeout: 10000 });
 if (response.data && response.data.success && response.data.data) {
 const bankValue = toBigInt(response.data.data.bank || "0");
 return {
 bank: bankValue >= MAX_LIMIT ? MAX_LIMIT : bankValue,
 cardNumber: response.data.data.cardNumber || null,
 cardExpiry: response.data.data.cardExpiry || null
 };
 }
 } catch (error) {}
 return { bank: 0n, cardNumber: null, cardExpiry: null };
}

function getUserInfo(uid, api) {
 return new Promise((resolve) => {
 api.getUserInfo(uid, (err, data) => {
 if (err || !data || !data[uid]) {
 resolve({ name: `User_${String(uid).slice(-5)}`, thumbSrc: null, id: uid });
 } else {
 resolve({
 name: data[uid].name || `User_${String(uid).slice(-5)}`,
 thumbSrc: data[uid].thumbSrc || null,
 id: uid
 });
 }
 });
 });
}

async function getAvatarUrl(uid, api) {
 try {
 const info = await getUserInfo(uid, api);
 return info.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
 } catch(e) {
 return `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
 }
}

function formatStyledMessage(contentLines) {
 let msg = `╭─────────────•┈┈\n`;
 for (let line of contentLines) {
 msg += `│ ${line}\n`;
 }
 msg += `╰─────────────•┈┈`;
 return msg;
}

function drawUnicodeText(ctx, text, x, y, options = {}) {
 const {
 fontSize = 24,
 fontWeight = "bold",
 color = "#ffffff",
 align = "left",
 shadow = false,
 shadowColor = "#000",
 shadowBlur = 0
 } = options;
 
 ctx.font = `${fontWeight} ${fontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Courier New'`;
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

async function generatePremiumBalanceCard(userInfo, bankData, cashMoney, api) {
 const width = 650;
 const height = 420;
 const canvas = createCanvas(width, height);
 const ctx = canvas.getContext("2d");

 const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
 bgGradient.addColorStop(0, "#0a0a1a");
 bgGradient.addColorStop(0.3, "#1a1c2b");
 bgGradient.addColorStop(0.7, "#0f1023");
 bgGradient.addColorStop(1, "#050510");
 ctx.fillStyle = bgGradient;
 ctx.fillRect(0, 0, width, height);

 ctx.strokeStyle = "rgba(212, 175, 55, 0.15)";
 ctx.lineWidth = 1;
 for (let i = 0; i < height; i += 30) {
 ctx.beginPath();
 ctx.moveTo(0, i);
 ctx.lineTo(width, i);
 ctx.stroke();
 }

 const borderGradient = ctx.createLinearGradient(0, 0, width, height);
 borderGradient.addColorStop(0, "#d4af37");
 borderGradient.addColorStop(0.5, "#ffd700");
 borderGradient.addColorStop(1, "#b8960c");
 ctx.strokeStyle = borderGradient;
 ctx.lineWidth = 2;
 ctx.strokeRect(12, 12, width - 24, height - 24);

 ctx.fillStyle = "rgba(212, 175, 55, 0.08)";
 ctx.fillRect(0, 55, width, 70);

 drawUnicodeText(ctx, "🏦 HEDGEHOG BANK", 30, 48, { fontSize: 20, fontWeight: "bold", color: "#d4af37" });
 drawUnicodeText(ctx, "BALANCE CARD • PREMIUM", 30, 68, { fontSize: 11, fontWeight: "normal", color: "rgba(212, 175, 55, 0.8)" });

 const avatarUrl = await getAvatarUrl(userInfo.id, api);
 if (avatarUrl) {
 try {
 const avatar = await loadImage(avatarUrl);
 ctx.save();
 ctx.beginPath();
 ctx.arc(width - 55, 55, 38, 0, Math.PI * 2);
 ctx.closePath();
 ctx.clip();
 ctx.drawImage(avatar, width - 93, 17, 76, 76);
 ctx.restore();
 ctx.beginPath();
 ctx.arc(width - 55, 55, 38, 0, Math.PI * 2);
 ctx.strokeStyle = "#d4af37";
 ctx.lineWidth = 2.5;
 ctx.stroke();
 ctx.beginPath();
 ctx.arc(width - 55, 55, 42, 0, Math.PI * 2);
 ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
 ctx.lineWidth = 1;
 ctx.stroke();
 } catch (e) {
 ctx.fillStyle = "rgba(212, 175, 55, 0.2)";
 ctx.beginPath();
 ctx.arc(width - 55, 55, 38, 0, Math.PI * 2);
 ctx.fill();
 drawUnicodeText(ctx, "👤", width - 72, 68, { fontSize: 30, fontWeight: "normal", color: "#d4af37" });
 }
 }

 ctx.fillStyle = "rgba(212, 175, 55, 0.1)";
 ctx.beginPath();
 ctx.moveTo(30 + 10, 90);
 ctx.lineTo(30 + 85 - 10, 90);
 ctx.quadraticCurveTo(30 + 85, 90, 30 + 85, 90 + 10);
 ctx.lineTo(30 + 85, 90 + 50 - 10);
 ctx.quadraticCurveTo(30 + 85, 90 + 50, 30 + 85 - 10, 90 + 50);
 ctx.lineTo(30 + 10, 90 + 50);
 ctx.quadraticCurveTo(30, 90 + 50, 30, 90 + 50 - 10);
 ctx.lineTo(30, 90 + 10);
 ctx.quadraticCurveTo(30, 90, 30 + 10, 90);
 ctx.closePath();
 ctx.fill();
 ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
 ctx.lineWidth = 1;
 ctx.stroke();
 drawUnicodeText(ctx, "CHIP", 58, 120, { fontSize: 13, fontWeight: "bold", color: "#d4af37" });
 for (let i = 0; i < 6; i++) {
 ctx.fillStyle = i % 2 === 0 ? "#d4af37" : "#b8960c";
 ctx.fillRect(35 + i * 8, 128, 3, 5);
 }

 ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
 ctx.fillRect(25, 150, width - 50, 3);

 const cardNumber = bankData.cardNumber || "4532 **** **** 5772";
 drawUnicodeText(ctx, cardNumber, 30, 195, { fontSize: 24, fontWeight: "bold", color: "#e0e0e0" });

 ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
 ctx.fillRect(30, 215, 160, 50);
 drawUnicodeText(ctx, "VALID THRU", 40, 235, { fontSize: 9, fontWeight: "normal", color: "rgba(255, 255, 255, 0.5)" });
 const expiry = bankData.cardExpiry || "12/28";
 drawUnicodeText(ctx, expiry, 40, 255, { fontSize: 15, fontWeight: "bold", color: "#ffffff" });

 ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
 ctx.fillRect(200, 215, 180, 50);
 drawUnicodeText(ctx, "CARD TYPE", 210, 235, { fontSize: 9, fontWeight: "normal", color: "rgba(255, 255, 255, 0.5)" });
 drawUnicodeText(ctx, "PREMIUM", 210, 255, { fontSize: 13, fontWeight: "bold", color: "#d4af37" });

 const cardHolderName = userInfo.name.toUpperCase().substring(0, 25);
 drawUnicodeText(ctx, cardHolderName, 30, 305, { fontSize: 18, fontWeight: "bold", color: "#ffffff" });

 drawUnicodeText(ctx, `ACCOUNT ID: ${userInfo.id}`, 30, 325, { fontSize: 9, fontWeight: "normal", color: "rgba(255, 255, 255, 0.3)" });

 ctx.fillStyle = "rgba(212, 175, 55, 0.1)";
 ctx.fillRect(width - 200, height - 100, 175, 75);
 ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
 ctx.lineWidth = 1;
 ctx.strokeRect(width - 200, height - 100, 175, 75);

 const formattedCash = await formatNumber(cashMoney);
 drawUnicodeText(ctx, `${formattedCash}$`, width - 195, height - 65, { fontSize: 28, fontWeight: "bold", color: "#d4af37" });
 drawUnicodeText(ctx, "CASH BALANCE", width - 195, height - 85, { fontSize: 10, fontWeight: "normal", color: "rgba(255, 255, 255, 0.5)" });

 const formattedBank = await formatNumber(bankData.bank);
 const totalAmount = cashMoney >= MAX_LIMIT || bankData.bank >= MAX_LIMIT ? MAX_LIMIT : cashMoney + bankData.bank;
 const formattedTotal = await formatNumber(totalAmount);

 drawUnicodeText(ctx, `BANK: ${formattedBank}$`, width - 195, height - 45, { fontSize: 10, fontWeight: "normal", color: "rgba(255, 255, 255, 0.5)" });
 drawUnicodeText(ctx, `TOTAL: ${formattedTotal}$`, width - 195, height - 30, { fontSize: 10, fontWeight: "normal", color: "rgba(255, 255, 255, 0.5)" });

 ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
 ctx.fillRect(0, height - 28, width, 28);
 const date = new Date().toISOString().split('T')[0];
 drawUnicodeText(ctx, `HEDGEHOG BANK • PREMIUM • ${date}`, width / 2 - 145, height - 12, { fontSize: 9, fontWeight: "normal", color: "rgba(212, 175, 55, 0.6)" });
 drawUnicodeText(ctx, "💳", width - 80, height - 12, { fontSize: 9, fontWeight: "normal", color: "rgba(255, 255, 255, 0.3)" });

 return canvas.toBuffer();
}

module.exports = {
 config: {
 name: "balance",
 aliases: ["bal"],
 version: "5.0",
 author: "Ismael Soma",
 countDown: 5,
 role: 0,
 description: { en: "View your money or the money of a tagged person" },
 category: "economy",
 guide: { en: "{pn} - view your balance\n{pn} @user - view tagged user's balance" }
 },

 onStart: async function ({ message, event, api }) {
 try {
 if (Object.keys(event.mentions).length > 0) {
 const uids = Object.keys(event.mentions);
 for (const uid of uids) {
 const [userMoney, bankData, userInfo] = await Promise.all([
 getUserCash(uid),
 getUserBankData(uid),
 getUserInfo(uid, api)
 ]);

 const formattedMoney = await formatNumber(userMoney);
 const formattedBank = await formatNumber(bankData.bank);
 const totalAmount = userMoney >= MAX_LIMIT || bankData.bank >= MAX_LIMIT ? MAX_LIMIT : userMoney + bankData.bank;
 const formattedTotal = await formatNumber(totalAmount);

 const img = await generatePremiumBalanceCard(userInfo, bankData, userMoney, api);
 const imgPath = path.join(__dirname, `balance_${uid}_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);

 await message.reply({
 body: formatStyledMessage([
 `👤 ${userInfo.name}`,
 `🆔 ID: ${uid}`,
 `━━━━━━━━━━━━━━━━━━`,
 `💰 POCHE: ${formattedMoney}$`,
 `🏦 BANQUE: ${formattedBank}$`,
 `━━━━━━━━━━━━━━━━━━`,
 `💵 TOTAL: ${formattedTotal}$`
 ]),
 attachment: fs.createReadStream(imgPath)
 });

 setTimeout(() => {
 try { fs.unlinkSync(imgPath); } catch (e) {}
 }, 5000);
 }
 return;
 }

 const uid = event.senderID;
 const [userMoney, bankData, userInfo] = await Promise.all([
 getUserCash(uid),
 getUserBankData(uid),
 getUserInfo(uid, api)
 ]);

 const formattedMoney = await formatNumber(userMoney);
 const formattedBank = await formatNumber(bankData.bank);
 const totalAmount = userMoney >= MAX_LIMIT || bankData.bank >= MAX_LIMIT ? MAX_LIMIT : userMoney + bankData.bank;
 const formattedTotal = await formatNumber(totalAmount);

 const img = await generatePremiumBalanceCard(userInfo, bankData, userMoney, api);
 const imgPath = path.join(__dirname, `balance_${uid}_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);

 await message.reply({
 body: formatStyledMessage([
 `👤 ${userInfo.name}`,
 `🆔 ID: ${uid}`,
 `━━━━━━━━━━━━━━━━━━`,
 `💰 POCHE: ${formattedMoney}$`,
 `🏦 BANQUE: ${formattedBank}$`,
 `━━━━━━━━━━━━━━━━━━`,
 `💵 TOTAL: ${formattedTotal}$`
 ]),
 attachment: fs.createReadStream(imgPath)
 });

 setTimeout(() => {
 try { fs.unlinkSync(imgPath); } catch (e) {}
 }, 5000);

 } catch (error) {
 await message.reply(formatStyledMessage(["❌ Erreur lors de la récupération", " de votre solde. Réessaie plus tard."]));
 }
 }
};