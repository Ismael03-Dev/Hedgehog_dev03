const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const path = require("path");

const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/format";
const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === undefined || value === null) return 0n;
    try {
        const clean = String(value).split('.')[0].replace(/[^0-9\-]/g, "") || "0";
        return BigInt(clean);
    } catch {
        return 0n;
    }
}

async function formatNumber(num) {
    const bigNum = toBigInt(num);
    if (bigNum === 0n) return "0";
    
    try {
        const response = await axios.get(`${CONVERT_API_URL}?n=${bigNum.toString()}`, { timeout: 5000 });
        if (response.data && response.data.success) return response.data.formatted;
    } catch (error) {
        console.error("Conversion API error:", error.message);
    }
    
    const suffixes = [
        "", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", 
        "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", 
        "OcDc", "NoDc", "V", "UV", "DV", "TV", "QaV", "QiV", "SxV", 
        "SpV", "OcV", "NoV", "DcV"
    ];
    
    let scaled = bigNum;
    let suffixIndex = 0;
    const thousand = 1000n;
    
    while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
        scaled = scaled / thousand;
        suffixIndex++;
    }
    
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
            return toBigInt(response.data.data.cash);
        }
    } catch (error) {
        console.error("Cash API Error:", error.message);
    }
    return 0n;
}

async function updateUserCash(userId, amount) {
    const bigAmount = toBigInt(amount);
    try {
        if (bigAmount > 0n) {
            await axios.post(`${CASH_API_URL}/${userId}/add`, { amount: bigAmount.toString() });
            return true;
        } else if (bigAmount < 0n) {
            await axios.post(`${CASH_API_URL}/${userId}/subtract`, { amount: (-bigAmount).toString() });
            return true;
        }
        return true;
    } catch (error) {
        console.error("Cash API Update Error:", error.message);
        return false;
    }
}

function getUserInfo(uid, api) {
    return new Promise((resolve) => {
        api.getUserInfo(uid, (err, data) => {
            if (err || !data || !data[uid]) {
                resolve({ name: `User_${String(uid).slice(-5)}`, thumbSrc: null });
            } else {
                resolve({
                    name: data[uid].name || `User_${String(uid).slice(-5)}`,
                    thumbSrc: data[uid].thumbSrc || null
                });
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

async function parseAmountWithSuffix(input) {
    if (!input) return 0n;
    const strInput = String(input).toLowerCase().trim();
    
    try {
        const response = await axios.get(`${CONVERT_API_URL}?n=${encodeURIComponent(strInput)}`, { timeout: 5000 });
        if (response.data && response.data.success && response.data.raw) {
            return toBigInt(response.data.raw);
        }
    } catch (error) {
        console.error("Parse amount API error:", error.message);
    }
    
    const SUFFIXES = {
        'k': 1_000n, 
        'm': 1_000_000n, 
        'b': 1_000_000_000n,
        't': 1_000_000_000_000n, 
        'qa': 1_000_000_000_000_000n,
        'qi': 1_000_000_000_000_000_000n,
        'sx': 1_000_000_000_000_000_000_000n,
        'sp': 1_000_000_000_000_000_000_000_000n,
        'oc': 1_000_000_000_000_000_000_000_000_000n,
        'no': 1_000_000_000_000_000_000_000_000_000_000n,
        'dc': 1_000_000_000_000_000_000_000_000_000_000_000n
    };
    
    const match = strInput.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)?$/);
    if (!match) return 0n;
    
    const value = parseFloat(match[1]);
    const suffix = (match[2] || "").toLowerCase();
    
    if (isNaN(value)) return 0n;
    
    if (suffix && SUFFIXES[suffix]) {
        return toBigInt(Math.floor(value)) * SUFFIXES[suffix];
    }
    
    return toBigInt(Math.floor(value));
}

async function generatePremiumTransferImage(senderName, receiverName, amount, icon, senderAvatarUrl, targetAvatarUrl, transactionId) {
    const canvas = createCanvas(900, 500);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, "#0a0a1a");
    gradient.addColorStop(0.5, "#1a1a2e");
    gradient.addColorStop(1, "#0f1023");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 500);

    ctx.strokeStyle = "rgba(212, 175, 55, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 500; i += 25) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(900, i);
        ctx.stroke();
    }

    const borderGradient = ctx.createLinearGradient(0, 0, 900, 500);
    borderGradient.addColorStop(0, "#d4af37");
    borderGradient.addColorStop(0.5, "#ffd700");
    borderGradient.addColorStop(1, "#b8960c");
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 880, 480);

    ctx.fillStyle = "rgba(212, 175, 55, 0.08)";
    ctx.fillRect(0, 45, 900, 65);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 22px 'Courier New'";
    ctx.fillText("🏦 HEDGEHOG BANK", 30, 52);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(212, 175, 55, 0.7)";
    ctx.fillText("PREMIUM TRANSFER SERVICE", 30, 72);

    ctx.fillStyle = "rgba(212, 175, 55, 0.2)";
    ctx.fillRect(770, 30, 60, 40);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 1;
    ctx.strokeRect(770, 30, 60, 40);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 16px 'Courier New'";
    ctx.fillText("VIP", 785, 55);

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 26px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("TRANSFERT BANCAIRE", 450, 52);
    ctx.textAlign = "left";

    async function drawAvatar(x, y, radius, avatarUrl, label, name) {
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
            ctx.lineWidth = 1;
            ctx.stroke();
        } catch (error) {
            ctx.fillStyle = "rgba(212, 175, 55, 0.2)";
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#d4af37";
            ctx.font = "bold 40px 'Courier New'";
            ctx.fillText("👤", x - 25, y + 12);
        }

        ctx.fillStyle = "#fff";
        ctx.font = "bold 15px 'Courier New'";
        ctx.textAlign = "center";
        const shortName = name.length > 15 ? name.substring(0, 12) + "..." : name;
        ctx.fillText(shortName.toUpperCase(), x, y + radius + 35);
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "10px 'Courier New'";
        ctx.fillText(label, x, y + radius + 55);
        ctx.textAlign = "left";
    }

    await drawAvatar(160, 210, 65, senderAvatarUrl, "EXPÉDITEUR", senderName);
    await drawAvatar(740, 210, 65, targetAvatarUrl, "DESTINATAIRE", receiverName);

    ctx.beginPath();
    ctx.moveTo(280, 210);
    ctx.lineTo(620, 210);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(620, 210);
    ctx.lineTo(590, 190);
    ctx.lineTo(590, 230);
    ctx.closePath();
    ctx.fillStyle = "#d4af37";
    ctx.fill();

    ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
    ctx.beginPath();
    ctx.roundRect(250, 130, 400, 40, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#44ff44";
    ctx.font = "bold 24px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText(`${amount} $`, 450, 158);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(30, 320, 840, 3);

    ctx.font = "bold 40px 'Courier New'";
    ctx.fillStyle = "#d4af37";
    ctx.textAlign = "center";
    ctx.fillText(icon, 450, 370);
    ctx.textAlign = "left";

    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 14px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("TRANSFERT RÉUSSI ✓", 450, 430);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText(`TRANSACTION ID: ${transactionId}`, 30, 460);

    const date = new Date();
    const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getFullYear()} - ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "10px 'Courier New'";
    ctx.textAlign = "right";
    ctx.fillText(dateStr, 870, 460);
    
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 470, 900, 30);
    ctx.fillStyle = "rgba(212, 175, 55, 0.6)";
    ctx.font = "9px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("HEDGEHOG BANK • PREMIUM TRANSFER • SECURE TRANSACTION", 450, 490);
    ctx.textAlign = "left";

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "give",
        version: "5.0",
        author: "Ismael Soma",
        countDown: 5,
        role: 0,
        category: "economy"
    },

    onStart: async function ({ args, message, event, api }) {
        const { senderID, messageReply } = event;

        let targetID;
        let targetName;

        if (messageReply) {
            targetID = messageReply.senderID;
            const targetInfo = await getUserInfo(targetID, api);
            targetName = targetInfo.name;
        } else if (Object.keys(event.mentions).length > 0) {
            targetID = Object.keys(event.mentions)[0];
            const targetInfo = await getUserInfo(targetID, api);
            targetName = targetInfo.name;
        } else {
            return message.reply(formatStyledMessage([
                "❌ COMMENT DONNER ?",
                "━━━━━━━━━━━━━━━━",
                "📝 2 façons :",
                "",
                "💬 give @user 5000",
                "   → Mentionne la personne",
                "",
                "💬 give 5000 (en répondant)",
                "   → Réponds à son message",
                "━━━━━━━━━━━━━━━━",
                "📝 Exemples :",
                "1k = 1 000",
                "2.5k = 2 500",
                "1M = 1 000 000",
                "1B = 1 000 000 000",
                "1T = 1 000 000 000 000",
                "all = tout ton argent"
            ]));
        }

        if (targetID === senderID) {
            return message.reply(formatStyledMessage(["❌ Tu ne peux pas te donner à toi-même"]));
        }

        if (!args[0]) {
            return message.reply(formatStyledMessage(["❌ Montant manquant"]));
        }

        const senderMoney = await getUserCash(senderID);
        let amount;

        if (args[0].toLowerCase() === "all") {
            amount = senderMoney;
        } else {
            amount = await parseAmountWithSuffix(args[0]);
        }

        if (amount <= 0n) {
            return message.reply(formatStyledMessage(["❌ Montant invalide"]));
        }

        if (amount > senderMoney) {
            return message.reply(formatStyledMessage([
                "❌ Fonds insuffisants",
                "━━━━━━━━━━━━━━━━",
                `💰 Ton solde : ${await formatNumber(senderMoney)}$`,
                `🎁 Montant : ${await formatNumber(amount)}$`
            ]));
        }

        const updateSender = await updateUserCash(senderID, -amount);
        if (!updateSender) {
            return message.reply(formatStyledMessage(["❌ Erreur lors du prélèvement"]));
        }

        const updateReceiver = await updateUserCash(targetID, amount);
        if (!updateReceiver) {
            await updateUserCash(senderID, amount);
            return message.reply(formatStyledMessage(["❌ Erreur lors du transfert. Remboursement effectué."]));
        }

        const newSenderMoney = await getUserCash(senderID);
        const formattedAmount = await formatNumber(amount);

        const icons = ["🎁", "💝", "💸", "🤝", "🎉", "💎", "✨", "🌟"];
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];

        const [senderInfo, targetInfo] = await Promise.all([
            getUserInfo(senderID, api),
            getUserInfo(targetID, api)
        ]);
        
        const senderName = senderInfo.name;
        const targetRealName = targetInfo.name;

        let senderThumb, targetThumb;
        try {
            const si = await api.getUserInfo(senderID);
            senderThumb = si?.thumbSrc || si?.[senderID]?.thumbSrc || `https://graph.facebook.com/${senderID}/picture?width=200&height=200`;
        } catch (e) {
            senderThumb = `https://graph.facebook.com/${senderID}/picture?width=200&height=200`;
        }
        try {
            const ti = await api.getUserInfo(targetID);
            targetThumb = ti?.thumbSrc || ti?.[targetID]?.thumbSrc || `https://graph.facebook.com/${targetID}/picture?width=200&height=200`;
        } catch (e) {
            targetThumb = `https://graph.facebook.com/${targetID}/picture?width=200&height=200`;
        }

        const transactionId = `TRX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        await message.reply(formatStyledMessage([
            `${randomIcon} TRANSFERT RÉUSSI ${randomIcon}`,
            "━━━━━━━━━━━━━━━━",
            `💸 ${formattedAmount}$ → ${targetName}`,
            `🆔 Transaction: ${transactionId}`,
            "━━━━━━━━━━━━━━━━",
            `💰 Nouveau solde : ${await formatNumber(newSenderMoney)}$`
        ]));

        try {
            const transferImage = await generatePremiumTransferImage(
                senderName,
                targetRealName,
                formattedAmount,
                randomIcon,
                senderThumb,
                targetThumb,
                transactionId
            );
            const imgPath = path.join(__dirname, `transfer_${senderID}_${targetID}_${Date.now()}.png`);
            fs.writeFileSync(imgPath, transferImage);
            await message.reply({
                body: "💳 Reçu du transfert :",
                attachment: fs.createReadStream(imgPath)
            });
            setTimeout(() => {
                try { fs.unlinkSync(imgPath); } catch (e) {}
            }, 5000);
        } catch (error) {
            console.error("Erreur generation image:", error);
        }
    }
};