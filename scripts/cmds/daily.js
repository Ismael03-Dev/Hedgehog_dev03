const moment = require("moment-timezone");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";

const MAX_LIMIT = 10n ** 261n;

function toBigInt(v) {
 if (typeof v === "bigint") return v;
 if (v === undefined || v === null) return 0n;
 try { return BigInt(String(v).split(".")[0].replace(/[^0-9\-]/g, "") || "0"); }
 catch { return 0n; }
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
 if (suffixIndex === 0) return bigNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
 return `${scaled}${suffixes[suffixIndex]}`;
}

async function getUserCash(uid) {
 try {
 const r = await axios.get(`${CASH_API_URL}/${uid}`, { timeout: 10000 });
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
 await axios.post(`${CASH_API_URL}/${uid}/add`, { amount: a.toString() });
 return true;
 } else if (a < 0n) {
 await axios.post(`${CASH_API_URL}/${uid}/subtract`, { amount: (-a).toString() });
 return true;
 }
 return true;
 } catch (e) {
 console.error("Cash update:", e.message);
 return false;
 }
}

async function getUserName(uid, api) {
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

// Amélioration : Couleurs pour les jours de la semaine
const DAY_COLORS = {
 1: "#ff6b6b", // Lundi
 2: "#feca57", // Mardi
 3: "#ff9ff3", // Mercredi
 4: "#54a0ff", // Jeudi
 5: "#5f27cd", // Vendredi
 6: "#00d2d3", // Samedi
 7: "#f0932b" // Dimanche
};

async function generateDailyCard({ username, avatarUrl, streak, dayName, dayNumber, reward, newBalance, nextReward, multiplier, expReward }) {
 const W = 680, H = 440;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");

 const bg = ctx.createLinearGradient(0, 0, 0, H);
 bg.addColorStop(0, "#0a0f1a");
 bg.addColorStop(0.5, "#0d1225");
 bg.addColorStop(1, "#060912");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = "rgba(255,255,255,0.015)";
 for (let x = 0; x < W; x += 30)
 for (let y = 0; y < H; y += 30)
 ctx.fillRect(x, y, 1.5, 1.5);

 const dayColor = DAY_COLORS[dayNumber] || "#f59e0b";
 const borderG = ctx.createLinearGradient(0, 0, W, H);
 borderG.addColorStop(0, dayColor);
 borderG.addColorStop(0.5, "#fbbf24");
 borderG.addColorStop(1, dayColor);
 ctx.strokeStyle = borderG;
 ctx.lineWidth = 2.5;
 roundRect(ctx, 10, 10, W - 20, H - 20, 16);
 ctx.stroke();

 const hdrG = ctx.createLinearGradient(0, 0, W, 0);
 hdrG.addColorStop(0, "rgba(245,158,11,0.2)");
 hdrG.addColorStop(0.5, "rgba(245,158,11,0.06)");
 hdrG.addColorStop(1, "rgba(245,158,11,0.2)");
 ctx.fillStyle = hdrG;
 ctx.fillRect(10, 10, W - 20, 65);

 ctx.font = "bold 22px 'Courier New'";
 ctx.fillStyle = "#f59e0b";
 ctx.fillText("🎁 RÉCOMPENSE QUOTIDIENNE", 28, 48);
 ctx.font = "10px 'Courier New'";
 ctx.fillStyle = "rgba(245,158,11,0.55)";
 ctx.fillText("HEDGEHOG BANK • DAILY BONUS", 30, 66);

 const ax = W - 52, ay = 46;
 ctx.save();
 ctx.beginPath();
 ctx.arc(ax, ay, 28, 0, Math.PI * 2);
 ctx.clip();
 try {
 const avatar = await loadImage(avatarUrl);
 ctx.drawImage(avatar, ax - 28, ay - 28, 56, 56);
 } catch {
 ctx.fillStyle = "#1a0f2e";
 ctx.fill();
 }
 ctx.restore();
 ctx.beginPath();
 ctx.arc(ax, ay, 29, 0, Math.PI * 2);
 ctx.strokeStyle = "#f59e0b";
 ctx.lineWidth = 2;
 ctx.stroke();

 ctx.font = "bold 14px 'Courier New'";
 ctx.fillStyle = "#e8e8e8";
 ctx.fillText(username.toUpperCase().substring(0, 20), 28, 98);
 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.35)";
 
 // Amélioration : Icône de flamme pour la série
 const flameIcon = streak >= 7 ? "🔥🔥🔥" : streak >= 3 ? "🔥🔥" : streak >= 1 ? "🔥" : "💤";
 ctx.fillText(`${flameIcon} Série : ${streak} jour${streak > 1 ? "s" : ""}`, 28, 114);

 const calX = 28, calY = 135, calW = W - 56, calH = 80;
 ctx.fillStyle = "rgba(0,0,0,0.3)";
 roundRect(ctx, calX, calY, calW, calH, 12);
 ctx.fill();
 ctx.strokeStyle = "rgba(245,158,11,0.2)";
 ctx.lineWidth = 1;
 ctx.stroke();

 const days = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
 const cellW = calW / 7;
 for (let i = 0; i < 7; i++) {
 const cx = calX + i * cellW;
 const isActive = i < streak % 7 || (streak % 7 === 0 && i === 6);
 const isToday = i === (dayNumber - 1) || (dayNumber === 0 && i === 6);

 if (isToday) {
 const glowG = ctx.createRadialGradient(cx + cellW / 2, calY + calH / 2, 5, cx + cellW / 2, calY + calH / 2, 35);
 glowG.addColorStop(0, "rgba(245,158,11,0.3)");
 glowG.addColorStop(1, "rgba(245,158,11,0)");
 ctx.fillStyle = glowG;
 roundRect(ctx, cx + 4, calY + 4, cellW - 8, calH - 8, 8);
 ctx.fill();
 
 ctx.fillStyle = "rgba(245,158,11,0.15)";
 roundRect(ctx, cx + 4, calY + 4, cellW - 8, calH - 8, 8);
 ctx.fill();
 ctx.strokeStyle = "#f59e0b";
 ctx.lineWidth = 1.5;
 ctx.stroke();
 }

 ctx.font = "bold 11px 'Courier New'";
 ctx.fillStyle = isActive ? "#fbbf24" : "rgba(255,255,255,0.2)";
 ctx.textAlign = "center";
 ctx.fillText(days[i], cx + cellW / 2, calY + 28);

 ctx.font = "18px 'Segoe UI Emoji'";
 ctx.fillStyle = isActive ? (isToday ? "#fbbf24" : "#34d399") : "rgba(255,255,255,0.15)";
 ctx.fillText(isActive ? "✅" : "⬜", cx + cellW / 2, calY + 58);
 ctx.textAlign = "left";
 }

 ctx.strokeStyle = "rgba(245,158,11,0.12)";
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(28, calY + calH + 18);
 ctx.lineTo(W - 28, calY + calH + 18);
 ctx.stroke();

 const rewardY = calY + calH + 38;
 ctx.fillStyle = "rgba(245,158,11,0.08)";
 roundRect(ctx, 28, rewardY, W - 56, 85, 12);
 ctx.fill();

 ctx.font = "bold 13px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.5)";
 ctx.fillText("RÉCOMPENSE DU JOUR", 45, rewardY + 26);

 ctx.font = "bold 28px 'Courier New'";
 ctx.fillStyle = "#fbbf24";
 ctx.fillText(`+${reward}$`, 45, rewardY + 58);

 ctx.font = "bold 16px 'Courier New'";
 ctx.fillStyle = "#60a5fa";
 ctx.fillText(`+${expReward} exp`, 45, rewardY + 78);

 ctx.font = "bold 24px 'Courier New'";
 ctx.fillStyle = "#34d399";
 ctx.textAlign = "right";
 ctx.fillText(`x${multiplier.toFixed(1)}`, W - 45, rewardY + 54);
 ctx.textAlign = "left";

 const statsY = rewardY + 105;
 const cols = [
 { label: "SOLDE", value: `${newBalance}$`, color: "#fbbf24" },
 { label: "PROCHAIN", value: `${nextReward}$`, color: "#60a5fa" },
 { label: "JOUR", value: dayName, color: dayColor },
 ];
 const colW = (W - 56) / 3;
 for (let i = 0; i < cols.length; i++) {
 const cx = 28 + i * colW;
 ctx.fillStyle = "rgba(255,255,255,0.04)";
 roundRect(ctx, cx + 3, statsY - 16, colW - 6, 52, 7);
 ctx.fill();
 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.38)";
 ctx.fillText(cols[i].label, cx + 10, statsY);
 ctx.font = `bold ${cols[i].value.length > 10 ? "11" : "14"}px 'Courier New'`;
 ctx.fillStyle = cols[i].color;
 ctx.fillText(cols[i].value, cx + 10, statsY + 24);
 }

 const footerY = H - 44;
 ctx.fillStyle = "rgba(0,0,0,0.3)";
 ctx.fillRect(0, footerY, W, 44);

 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = "rgba(245,158,11,0.5)";
 ctx.textAlign = "center";
 const d = new Date();
 ctx.fillText(
 `HEDGEHOG BANK • ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} • DAILY BONUS`,
 W / 2, footerY + 18
 );
 ctx.fillStyle = "rgba(255,255,255,0.3)";
 ctx.fillText("💳", W - 45, footerY + 18);
 ctx.textAlign = "left";

 return canvas.toBuffer("image/png");
}

module.exports = {
 config: {
 name: "daily",
 version: "2.0",
 author: "Ismael04-lag",
 countDown: 5,
 role: 0,
 description: {
 vi: "Nhận quà hàng ngày",
 en: "Receive daily gift"
 },
 category: "game",
 guide: {
 vi: " {pn}: Nhận quà hàng ngày"
 + "\n {pn} info: Xem thông tin quà hàng ngày",
 en: " {pn}"
 + "\n {pn} info: View daily gift information"
 }
 },

 onStart: async function ({ args, message, event, usersData, getLang, api }) {
 // FIX: Correction de l'erreur senderID
 const senderID = event.senderID;
 const uid = String(senderID);
 
 if (!senderID) {
 return message.reply(S(["❌ Erreur: Impossible d'identifier l'utilisateur"]));
 }

 const reward = { coin: 100, exp: 10 };
 const date = new Date();
 const currentDay = date.getDay();
 const today = new Date().toDateString();

 if (args[0] === "info") {
 let msg = S(["📅 CALENDRIER DES RÉCOMPENSES", "---"]);
 for (let i = 1; i < 8; i++) {
 const getCoin = Math.floor(reward.coin * (1 + 20 / 100) ** ((i === 0 ? 7 : i) - 1));
 const getExp = Math.floor(reward.exp * (1 + 20 / 100) ** ((i === 0 ? 7 : i) - 1));
 const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
 const day = dayNames[i === 7 ? 0 : i];
 msg += `│ ${day}: ${getCoin} coins, ${getExp} exp\n`;
 }
 msg += "╰─────────────•┈┈";
 return message.reply(msg);
 }

 const userData = await usersData.get(senderID);
 const lastReward = userData.data?.lastTimeGetReward;
 const isRewarded = lastReward === today;

 if (isRewarded) {
 const remaining = 24;
 return message.reply(S([
 "🎁 RÉCOMPENSE QUOTIDIENNE",
 "---",
 "❌ Vous avez déjà reçu votre récompense aujourd'hui !",
 `⏳ Prochaine dans ${remaining}h`,
 ]));
 }

 const dayNumber = currentDay === 0 ? 7 : currentDay;
 const multiplier = (1 + 20 / 100) ** (dayNumber - 1);
 const getCoin = Math.floor(reward.coin * multiplier);
 const getExp = Math.floor(reward.exp * multiplier);

 const streak = (userData.data?.dailyStreak || 0) + (isRewarded ? 0 : 1);

 // Mise à jour des données utilisateur
 userData.data = userData.data || {};
 userData.data.lastTimeGetReward = today;
 userData.data.dailyStreak = streak;

 await usersData.set(senderID, {
 money: (userData.money || 0) + getCoin,
 exp: (userData.exp || 0) + getExp,
 data: userData.data
 });

 await updateUserCash(uid, BigInt(getCoin));

 const newBalance = await getUserCash(uid);
 const formattedBalance = await formatNumber(newBalance);

 const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
 const dayName = dayNames[currentDay];

 const nextDayNumber = dayNumber === 7 ? 1 : dayNumber + 1;
 const nextMultiplier = (1 + 20 / 100) ** (nextDayNumber - 1);
 const nextReward = Math.floor(reward.coin * nextMultiplier);
 const formattedNextReward = await formatNumber(BigInt(nextReward));

 // Message texte
 await message.reply(S([
 "🎁 RÉCOMPENSE QUOTIDIENNE",
 "---",
 `📅 ${dayName} (Jour ${dayNumber}/7)`,
 `🔥 Série : ${streak} jour${streak > 1 ? "s" : ""}`,
 "---",
 `💰 +${getCoin}$ (x${multiplier.toFixed(1)})`,
 `⭐ +${getExp} exp`,
 "---",
 `💳 Solde : ${formattedBalance}$`,
 `📈 Prochain gain : ${formattedNextReward}$`,
 ]));

 // Carte image
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
 const img = await generateDailyCard({
 username,
 avatarUrl,
 streak,
 dayName,
 dayNumber,
 reward: getCoin,
 newBalance: formattedBalance,
 nextReward: formattedNextReward,
 multiplier,
 expReward: getExp
 });
 const imgPath = path.join(__dirname, `daily_${uid}_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({
 body: "💳 Votre carte de récompense :",
 attachment: fs.createReadStream(imgPath)
 });
 setTimeout(() => {
 try { fs.unlinkSync(imgPath); } catch (e) {}
 }, 5000);
 } catch (err) {
 console.error("Erreur carte daily:", err);
 }
 }
 }
};