const moment = require("moment-timezone");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");

const CASH_URL = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";
const MAX_LIMIT = 10n ** 261n;
const TIMEZONE = "Africa/Douala";

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
 let scaled = big < 0n ? -big : big;
 const neg = big < 0n;
 let si = 0;
 const T = 1000n;
 while (scaled >= T && si < suffixes.length - 1) { scaled = scaled / T; si++; }
 if (si === suffixes.length - 1 && scaled >= T) return "∞";
 const div = T ** BigInt(si);
 const rem = ((neg ? -big : big) % div) * 100n / div;
 const pfx = neg ? "-" : "";
 if (si > 0 && rem > 0n) {
 const dec = rem.toString().padStart(2, "0").slice(0, 2).replace(/0+$/, "");
 return dec ? `${pfx}${scaled}.${dec}${suffixes[si]}` : `${pfx}${scaled}${suffixes[si]}`;
 }
 if (si === 0) return `${pfx}${(neg ? -big : big).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
 return `${pfx}${scaled}${suffixes[si]}`;
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
 if (a > 0n) { await axios.post(`${CASH_URL}/${uid}/add`, { amount: a.toString() }); return true; }
 return true;
 } catch (e) { console.error("Cash update:", e.message); return false; }
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

const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_ICONS = ["☀️","🌙","🔥","⚡","🌊","🌟","🎯"];

function getMultiplier(dayNumber) {
 return (1.20) ** (dayNumber - 1);
}

function getDayReward(baseCoin, dayNumber) {
 return Math.floor(baseCoin * getMultiplier(dayNumber));
}

function getDayExp(baseExp, dayNumber) {
 return Math.floor(baseExp * getMultiplier(dayNumber));
}

async function generateDailyCard({ username, avatarUrl, streak, dayName, dayNumber, reward, expReward, newBalance, nextReward, milestoneBonus }) {
 const W = 700, H = 460;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");

 const bg = ctx.createLinearGradient(0, 0, 0, H);
 bg.addColorStop(0, "#09080f");
 bg.addColorStop(0.5, "#0d0c1e");
 bg.addColorStop(1, "#060510");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = "rgba(255,255,255,0.016)";
 for (let x = 0; x < W; x += 32)
 for (let y = 0; y < H; y += 32)
 ctx.fillRect(x, y, 1.5, 1.5);

 const borderG = ctx.createLinearGradient(0, 0, W, H);
 borderG.addColorStop(0, "#f59e0b");
 borderG.addColorStop(0.5, "#fbbf24");
 borderG.addColorStop(1, "#d97706");
 ctx.strokeStyle = borderG;
 ctx.lineWidth = 3;
 roundRect(ctx, 10, 10, W - 20, H - 20, 20);
 ctx.stroke();

 const hdrG = ctx.createLinearGradient(0, 0, W, 0);
 hdrG.addColorStop(0, "rgba(245,158,11,0.22)");
 hdrG.addColorStop(0.5, "rgba(245,158,11,0.07)");
 hdrG.addColorStop(1, "rgba(245,158,11,0.22)");
 ctx.fillStyle = hdrG;
 ctx.fillRect(10, 10, W - 20, 68);

 ctx.font = "bold 22px 'Courier New'";
 ctx.fillStyle = "#f59e0b";
 ctx.shadowColor = "#f59e0b";
 ctx.shadowBlur = 14;
 ctx.fillText("🎁 DAILY BONUS — HEDGEHOG BANK", 28, 50);
 ctx.shadowBlur = 0;
 ctx.font = "10px 'Courier New'";
 ctx.fillStyle = "rgba(245,158,11,0.55)";
 ctx.fillText(`${DAY_ICONS[dayNumber % 7]} ${dayName.toUpperCase()} — DAY ${dayNumber}/7`, 30, 68);

 const ax = W - 54, ay = 47;
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
 ctx.lineWidth = 2.5;
 ctx.stroke();

 ctx.font = "bold 14px 'Courier New'";
 ctx.fillStyle = "#e8e8e8";
 ctx.fillText(username.toUpperCase().substring(0, 20), 28, 102);
 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = streak >= 7 ? "#fbbf24" : streak >= 3 ? "#f97316" : "rgba(255,255,255,0.35)";
 ctx.fillText(`🔥 Streak : ${streak} day${streak > 1 ? "s" : ""}${streak >= 7 ? " ✦ WEEKLY CHAMPION !" : streak >= 3 ? " ✦ ON FIRE !" : ""}`, 28, 118);

 const calX = 28, calY = 136, calW = W - 56, calH = 88;
 ctx.fillStyle = "rgba(0,0,0,0.35)";
 roundRect(ctx, calX, calY, calW, calH, 14);
 ctx.fill();
 ctx.strokeStyle = "rgba(245,158,11,0.15)";
 ctx.lineWidth = 1;
 ctx.stroke();

 const DAYS_LABELS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
 const cellW = calW / 7;

 for (let i = 0; i < 7; i++) {
 const cx = calX + i * cellW;
 const dNum = i + 1;
 const isDone = dNum < dayNumber;
 const isToday = dNum === dayNumber;
 const isFuture = dNum > dayNumber;

 if (isToday) {
 ctx.fillStyle = "rgba(245,158,11,0.22)";
 roundRect(ctx, cx + 5, calY + 5, cellW - 10, calH - 10, 9);
 ctx.fill();
 ctx.strokeStyle = "#f59e0b";
 ctx.shadowColor = "#f59e0b";
 ctx.shadowBlur = 10;
 ctx.lineWidth = 2;
 ctx.stroke();
 ctx.shadowBlur = 0;
 }

 ctx.font = "bold 10px 'Courier New'";
 ctx.fillStyle = isToday ? "#fbbf24" : isDone ? "#86efac" : "rgba(255,255,255,0.22)";
 ctx.textAlign = "center";
 ctx.fillText(DAYS_LABELS[i], cx + cellW / 2, calY + 26);

 ctx.font = "22px 'Segoe UI Emoji'";
 const icon = isDone ? "✅" : isToday ? DAY_ICONS[i] : "⬛";
 ctx.fillText(icon, cx + cellW / 2, calY + 64);

 if (isToday) {
 ctx.font = "7px 'Courier New'";
 ctx.fillStyle = "#fbbf24";
 ctx.fillText("TODAY", cx + cellW / 2, calY + calH - 6);
 }
 ctx.textAlign = "left";
 }

 ctx.strokeStyle = "rgba(245,158,11,0.12)";
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(28, calY + calH + 18);
 ctx.lineTo(W - 28, calY + calH + 18);
 ctx.stroke();

 const rewardY = calY + calH + 36;
 ctx.fillStyle = "rgba(245,158,11,0.06)";
 roundRect(ctx, 28, rewardY, W - 56, 78, 12);
 ctx.fill();
 ctx.strokeStyle = "rgba(245,158,11,0.2)";
 ctx.lineWidth = 1;
 ctx.stroke();

 ctx.font = "9px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.4)";
 ctx.fillText("TODAY'S REWARD", 44, rewardY + 22);

 ctx.font = "bold 30px 'Courier New'";
 ctx.fillStyle = "#fbbf24";
 ctx.shadowColor = "#fbbf24";
 ctx.shadowBlur = 14;
 ctx.fillText(`+${reward}$`, 44, rewardY + 56);
 ctx.shadowBlur = 0;

 ctx.font = "bold 16px 'Courier New'";
 ctx.fillStyle = "#a78bfa";
 ctx.fillText(`+${expReward} EXP`, 44, rewardY + 76);

 ctx.font = "bold 22px 'Courier New'";
 ctx.fillStyle = "#34d399";
 ctx.textAlign = "right";
 ctx.shadowColor = "#34d399";
 ctx.shadowBlur = 10;
 ctx.fillText(`×${getMultiplier(dayNumber).toFixed(1)}`, W - 44, rewardY + 56);
 ctx.shadowBlur = 0;
 ctx.textAlign = "left";

 if (milestoneBonus > 0) {
 ctx.font = "bold 11px 'Courier New'";
 ctx.fillStyle = "#fbbf24";
 ctx.shadowColor = "#fbbf24";
 ctx.shadowBlur = 8;
 ctx.textAlign = "right";
 ctx.fillText(`🏆 MILESTONE BONUS +${milestoneBonus}$`, W - 44, rewardY + 78);
 ctx.shadowBlur = 0;
 ctx.textAlign = "left";
 }

 const statsY = rewardY + 100;
 const cols = [
 { label: "NEW BALANCE", value: `${newBalance}$`, color: "#fbbf24" },
 { label: "NEXT REWARD", value: `${nextReward}$`, color: "#60a5fa" },
 { label: "STREAK", value: `${streak}d 🔥`, color: streak >= 7 ? "#fbbf24" : "#f97316" },
 { label: "MULTIPLIER", value: `×${getMultiplier(dayNumber).toFixed(1)}`, color: "#34d399" },
 ];
 const colW = (W - 56) / 4;
 for (let i = 0; i < cols.length; i++) {
 const cx = 28 + i * colW;
 ctx.fillStyle = "rgba(255,255,255,0.045)";
 roundRect(ctx, cx + 3, statsY - 16, colW - 6, 54, 8);
 ctx.fill();
 ctx.strokeStyle = cols[i].color + "22";
 ctx.lineWidth = 1;
 ctx.stroke();
 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = "rgba(255,255,255,0.38)";
 ctx.fillText(cols[i].label, cx + 10, statsY);
 ctx.font = `bold ${cols[i].value.length > 10 ? "11" : "13"}px 'Courier New'`;
 ctx.fillStyle = cols[i].color;
 ctx.shadowColor = cols[i].color;
 ctx.shadowBlur = 5;
 ctx.fillText(cols[i].value, cx + 10, statsY + 24);
 ctx.shadowBlur = 0;
 }

 const d = new Date();
 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = "rgba(245,158,11,0.35)";
 ctx.textAlign = "center";
 ctx.fillText(
 `HEDGEHOG BANK • ${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()} • DAILY BONUS`,
 W / 2, H - 16
 );
 ctx.textAlign = "left";

 return canvas.toBuffer("image/png");
}

module.exports = {
 config: {
 name: "daily",
 version: "3.0",
 author: "Ismael04-lag",
 countDown: 5,
 role: 0,
 description: { en: "Claim your daily reward with streak bonuses" },
 category: "game",
 guide: {
 en: " {pn} — Claim daily reward\n"
 + " {pn} info — View reward calendar\n"
 + " {pn} streak — View your streak"
 },
 envConfig: {
 rewardFirstDay: { coin: 100, exp: 10 }
 }
 },

 langs: {
 en: {
 monday: "Monday",
 tuesday: "Tuesday",
 wednesday: "Wednesday",
 thursday: "Thursday",
 friday: "Friday",
 saturday: "Saturday",
 sunday: "Sunday",
 alreadyReceived: "You already claimed today's reward.",
 received: "You received %1$ and %2 exp.",
 }
 },

 onStart: async function ({ args, message, event, envCommands, usersData, commandName, getLang, api }) {
 const uid = String(event.senderID);
 const reward = envCommands[commandName].rewardFirstDay;
 const p = global.utils.getPrefix(event.threadID);
 const now = moment.tz(TIMEZONE);
 const today = now.format("DD/MM/YYYY");
 const currentDay = now.day();
 const dayNumber = currentDay === 0 ? 7 : currentDay;
 const dayName = getLang(DAY_NAMES[currentDay].toLowerCase());

 if (args[0] === "info") {
 const lines = ["📅 DAILY REWARD CALENDAR", "---"];
 for (let i = 1; i <= 7; i++) {
 const coin = getDayReward(reward.coin, i);
 const exp = getDayExp(reward.exp, i);
 const name = getLang(DAY_NAMES[i === 7 ? 0 : i].toLowerCase());
 const icon = DAY_ICONS[i - 1];
 const marker = i === dayNumber ? " ← TODAY" : "";
 lines.push(`${icon} ${name}: ${coin}$ + ${exp} EXP (×${getMultiplier(i).toFixed(1)})${marker}`);
 }
 lines.push("---");
 lines.push("🏆 MILESTONE BONUSES");
 lines.push("7-day streak → +500$");
 lines.push("30-day streak → +5 000$");
 lines.push("100-day streak → +50 000$");
 return message.reply(S(lines));
 }

 const userData = await usersData.get(uid);

 if (args[0] === "streak") {
 const streak = userData.data?.dailyStreak || 0;
 const nextMilestone = streak < 7 ? 7 : streak < 30 ? 30 : streak < 100 ? 100 : null;
 const lines = [
 "🔥 YOUR STREAK",
 "---",
 `📅 Current streak : ${streak} day${streak > 1 ? "s" : ""}`,
 streak >= 7 ? "🏆 Weekly champion achieved !" : `⏳ ${7 - streak} day(s) until weekly bonus`,
 streak >= 30 ? "🏆 Monthly champion achieved !" : null,
 streak >= 100 ? "🏆 Century champion achieved !" : null,
 nextMilestone ? `🎯 Next milestone : ${nextMilestone} days` : "🎖️ All milestones unlocked !",
 ].filter(Boolean);
 return message.reply(S(lines));
 }

 if (userData.data?.lastTimeGetReward === today) {
 const nextDay = now.clone().add(1, "day").startOf("day");
 const remaining = nextDay.diff(now, "minutes");
 const h = Math.floor(remaining / 60);
 const m = remaining % 60;
 return message.reply(S([
 "🎁 DAILY BONUS",
 "---",
 "✅ Already claimed today !",
 `⏳ Next reward in ${h}h ${m}m`,
 `📅 Come back tomorrow for Day ${dayNumber === 7 ? 1 : dayNumber + 1}/7`,
 ]));
 }

 const streak = (userData.data?.dailyStreak || 0) + 1;
 const getCoin = getDayReward(reward.coin, dayNumber);
 const getExp = getDayExp(reward.exp, dayNumber);

 let milestoneBonus = 0;
 if (streak === 7) milestoneBonus = 500;
 if (streak === 30) milestoneBonus = 5000;
 if (streak === 100) milestoneBonus = 50000;

 const totalCoin = getCoin + milestoneBonus;

 userData.data = userData.data || {};
 userData.data.lastTimeGetReward = today;
 userData.data.dailyStreak = streak;

 await usersData.set(uid, {
 money: userData.money + getCoin,
 exp: userData.exp + getExp,
 data: userData.data,
 });

 await updateUserCash(uid, BigInt(totalCoin));

 const newBalance = await getUserCash(uid);

 const nextDayNumber = dayNumber === 7 ? 1 : dayNumber + 1;
 const nextDayReward = getDayReward(reward.coin, nextDayNumber);

 const [fBal, fCoin, fNext] = await Promise.all([
 formatNumber(newBalance),
 formatNumber(BigInt(totalCoin)),
 formatNumber(BigInt(nextDayReward)),
 ]);

 const lines = [
 "🎁 DAILY BONUS CLAIMED !",
 "---",
 `${DAY_ICONS[dayNumber - 1]} ${dayName} — Day ${dayNumber}/7`,
 `🔥 Streak : ${streak} day${streak > 1 ? "s" : ""}`,
 "---",
 `💰 +${fCoin}$ (×${getMultiplier(dayNumber).toFixed(1)})`,
 `⭐ +${getExp} EXP`,
 milestoneBonus > 0 ? `🏆 Milestone bonus : +${milestoneBonus}$` : null,
 "---",
 `💳 Balance : ${fBal}$`,
 `📈 Tomorrow : +${fNext}$ (×${getMultiplier(nextDayNumber).toFixed(1)})`,
 ].filter(Boolean);

 await message.reply(S(lines));

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
 username, avatarUrl, streak, dayName, dayNumber,
 reward: fCoin, expReward: getExp,
 newBalance: fBal, nextReward: fNext,
 milestoneBonus,
 });
 const imgPath = path.join(__dirname, `daily_${uid}_${Date.now()}.png`);
 fs.writeFileSync(imgPath, img);
 await message.reply({ body: "🎁 Your reward card :", attachment: fs.createReadStream(imgPath) });
 setTimeout(() => { try { fs.unlinkSync(imgPath); } catch {} }, 5000);
 } catch (err) {
 console.error("Daily card error:", err);
 }
 }
 }
};