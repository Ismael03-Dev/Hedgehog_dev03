const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const BANK_API_URL = "https://hedgehog-bank-api.vercel.app/api/bank";
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
        const response = await axios.get(`${CASH_API_URL}/top?limit=50`, { timeout: 10000 });
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        }
    } catch (error) {
        console.error("Cash API Error:", error.message);
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
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        msg += `│ ${line}\n`;
    }
    msg += `╰─────────────•┈┈`;
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

    ctx.font = "bold 32px 'Courier New'";
    ctx.fillStyle = "#ffd700";
    ctx.textAlign = "center";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 16;
    ctx.fillText("🏆 CLASSEMENT DES FORTUNES", W / 2, 52);
    ctx.shadowBlur = 0;

    ctx.font = "13px 'Courier New'";
    ctx.fillStyle = "rgba(212,175,55,0.7)";
    ctx.fillText("HEDGEHOG BANK • TOP 50", W / 2, 76);

    ctx.font = "bold 13px 'Courier New'";
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "right";
    ctx.fillText(`Page ${page}/${totalPages}`, W - 28, 48);
    ctx.textAlign = "left";

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
        ctx.font = `${medalSize}px 'Segoe UI Emoji'`;
        ctx.textAlign = "center";
        ctx.fillText(rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉", px + 130, medalY + medalSize);
        ctx.textAlign = "left";

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
            } catch(e) {
                ctx.fillStyle = medalColors[i] + "22";
                ctx.beginPath();
                ctx.arc(px + 130, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.font = "bold 15px 'Courier New'";
        ctx.fillStyle = "#e0e7ff";
        ctx.textAlign = "center";
        const name = user.name.length > 16 ? user.name.substring(0, 13) + "..." : user.name;
        ctx.fillText(name, px + 130, avatarY + avatarSize + 24);

        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = medalColors[i];
        ctx.fillText(user.formattedCash, px + 130, avatarY + avatarSize + 46);

        ctx.font = "10px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText(`#${rank}`, px + 130, avatarY + avatarSize + 64);
        ctx.textAlign = "left";
    }

    ctx.strokeStyle = "rgba(212,175,55,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, 310);
    ctx.lineTo(W - 25, 310);
    ctx.stroke();

    ctx.font = "bold 12px 'Courier New'";
    ctx.fillStyle = "#d4af37";
    ctx.fillText("RANG", 35, 338);
    ctx.fillText("JOUEUR", 90, 338);
    ctx.textAlign = "right";
    ctx.fillText("FORTUNE", W - 60, 338);
    ctx.textAlign = "left";

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
        ctx.font = "bold 14px 'Courier New'";
        ctx.fillStyle = rankColor;
        ctx.fillText(`${rank}`, 35, rowY + 8);

        if (rank <= 3) {
            ctx.font = "14px 'Segoe UI Emoji'";
            ctx.fillText(rank === 1 ? "👑" : rank === 2 ? "💎" : "🌟", 60, rowY + 8);
        }

        ctx.font = "13px 'Courier New'";
        ctx.fillStyle = "#e0e7ff";
        const rowName = user.name.length > 22 ? user.name.substring(0, 19) + "..." : user.name;
        ctx.fillText(rowName, 90, rowY + 8);

        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = rank <= 3 ? rankColor : "#fbbf24";
        ctx.textAlign = "right";
        ctx.fillText(user.formattedCash, W - 60, rowY + 8);
        ctx.textAlign = "left";
    }

    const footerY = H - 45;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, footerY, W, 45);

    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(212,175,55,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("💰 HEDGEHOG BANK • CLASSEMENT OFFICIEL • TOP 50 FORTUNES", W / 2, footerY + 20);

    const date = new Date();
    const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(dateStr, W / 2, footerY + 36);
    ctx.textAlign = "left";

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
                "   indisponible ou vide.",
                "",
                "💡 Utilisez `bank deposit` pour",
                "   commencer à gagner de l'argent !",
                "",
                "🔄 Réessaie plus tard."
            ]));
        }

        let page = args[0] ? parseInt(args[0]) : 1;
        const usersPerPage = 10;
        const totalPages = Math.ceil(Math.min(allUsers.length, 50) / usersPerPage);

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