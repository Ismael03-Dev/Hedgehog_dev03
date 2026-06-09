const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;
const doNotDelete = "[ ⚡ | 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 | ⚡ ]"; 

// Fonction Meta Bold pour tout le texte
const metaBold = (text) => {
    const boldMap = {
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆',
        'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌', 'N': '𝐍',
        'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔',
        'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠',
        'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦', 'n': '𝐧',
        'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮',
        'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒',
        '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return text.split('').map(char => boldMap[char] || char).join('');
};

// Barre de progression stylisée
const progressBar = (percentage, width = 30) => {
    const filled = Math.round((width * percentage) / 100);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
};

module.exports = {
    config: {
        name: "help2",
        version: "3.0",
        author: "Master Charbel • 𝐍𝐄𝐗𝐔𝐒",
        countDown: 5,
        role: 0,
        shortDescription: {
            en: "🌀 𝐀𝐟𝐟𝐢𝐜𝐡𝐞 𝐥'𝐚𝐢𝐝𝐞 𝐝𝐮 𝐛𝐨𝐭",
        },
        longDescription: {
            en: "𝐀𝐟𝐟𝐢𝐜𝐡𝐞 𝐥𝐚 𝐥𝐢𝐬𝐭𝐞 𝐝𝐞𝐬 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐞𝐬 𝐩𝐚𝐫 𝐜𝐚𝐭é𝐠𝐨𝐫𝐢𝐞",
        },
        category: "info",
        guide: {
            en: "{pn} : 𝐋𝐢𝐬𝐭𝐞 𝐝𝐞𝐬 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐞𝐬\n{pn} <𝐧𝐨𝐦> : 𝐃é𝐭𝐚𝐢𝐥𝐬 𝐝'𝐮𝐧𝐞 𝐜𝐨𝐦𝐦𝐚𝐧𝐝𝐞",
        },
        priority: 1,
    },

    onStart: async function ({ message, args, event, threadsData, role }) {
        const { threadID } = event;
        const threadData = await threadsData.get(threadID);
        const prefix = getPrefix(threadID);
        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('fr-FR');

        const roleTextToString = (role) => {
            switch (role) {
                case 0: return "👤 𝐓𝐨𝐮𝐬 𝐥𝐞𝐬 𝐮𝐭𝐢𝐥𝐢𝐬𝐚𝐭𝐞𝐮𝐫𝐬";
                case 1: return "🛡️ 𝐀𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐭𝐞𝐮𝐫𝐬 𝐝𝐞 𝐠𝐫𝐨𝐮𝐩𝐞";
                case 2: return "👑 𝐀𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐭𝐞𝐮𝐫 𝐝𝐮 𝐛𝐨𝐭";
                default: return "❓ 𝐑ô𝐥𝐞 𝐢𝐧𝐜𝐨𝐧𝐧𝐮";
            }
        };

        if (args.length === 0) {
            const categories = {};
            
            for (const [name, value] of commands) {
                if (value.config.role > role) continue; 
                const category = value.config.category || "𝐔𝐧𝐜𝐚𝐭𝐞𝐠𝐨𝐫𝐢𝐳𝐞𝐝";
                categories[category] = categories[category] || { commands: [] };
                categories[category].commands.push(name);
            }
            
            let msg = "";
            msg += `╔══════════════════════════════════════════╗\n`;
            msg += `║     ${metaBold('✨ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ✨')}       ║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  ${metaBold('⚡ 𝕋𝕙𝕖 𝔾𝕒𝕥𝕖𝕨𝕒𝕪 𝕥𝕠 ℙ𝕠𝕨𝕖𝕣 ⚡')}      ║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  ${metaBold('📂 𝐋𝐈𝐒𝐓𝐄 𝐃𝐄𝐒 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄𝐒')}            ║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;

            // Affichage par catégorie avec graphique
            const totalCommands = commands.size;
            const userCommands = Array.from(commands.values()).filter(cmd => cmd.config.role <= role).length;
            const accessPercent = (userCommands / totalCommands) * 100;
            
            Object.keys(categories).sort().forEach((category) => {
                if (categories[category].commands.length === 0) return;
                const emojiCat = getCategoryEmoji(category);
                const catPercent = (categories[category].commands.length / totalCommands) * 100;
                
                msg += `\n║  ${emojiCat} ${metaBold(category.toUpperCase())} ${emojiCat}        ║\n`;
                msg += `║  ${progressBar(catPercent, 20)} ${Math.round(catPercent)}%        ║\n`;
                
                const names = categories[category].commands.sort();
                const chunks = [];
                for (let i = 0; i < names.length; i += 2) {
                    const line = names.slice(i, i + 2).map(item => `🔹 ${item}`).join('    ');
                    msg += `║  ${line.padEnd(44)}║\n`;
                }
            });
            
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  ${metaBold('📊 𝐒𝐓𝐀𝐓𝐈𝐒𝐓𝐈𝐐𝐔𝐄𝐒 𝐃𝐔 𝐁𝐎𝐓')}          ║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  🔢 ${metaBold('Commandes')} : ${totalCommands}                           ║\n`;
            msg += `║  📊 ${metaBold('Accès')}    : ${accessPercent}% ${progressBar(accessPercent, 15)} ║\n`;
            msg += `║  ⚡ ${metaBold('Préfixe')}   : ${prefix.padEnd(35)}║\n`;
            msg += `║  🟢 ${metaBold('Statut')}   : ${metaBold('𝐄𝐍 𝐋𝐈𝐆𝐍𝐄')}                        ║\n`;
            msg += `║  📅 ${metaBold('Date')}     : ${dateStr.padEnd(35)}║\n`;
            msg += `║  🕐 ${metaBold('Heure')}    : ${timeStr.padEnd(35)}║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  💡 ${metaBold('Tape')} ${prefix}help <${metaBold('commande')}> ${metaBold('détails')}   ║\n`;
            msg += `║  🌐 ${metaBold('Communauté')} : @NexusUltimate                 ║\n`;
            msg += `╠══════════════════════════════════════════╣\n`;
            msg += `║  ${metaBold('"La puissance naît de la connexion." 🧠💫')}   ║\n`;
            msg += `╚══════════════════════════════════════════╝`;
            
            await message.reply(msg);

        } else {
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName) || commands.get(aliases.get(commandName));

            if (!command) {
                const notFound = `
╔══════════════════════════════════════════╗
║           ❌ ${metaBold('𝐄𝐑𝐑𝐄𝐔𝐑')} ❌           ║
╠══════════════════════════════════════════╣
║  🔍 "${metaBold(commandName)}"                 ║
║  ${metaBold('𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄 𝐈𝐍𝐓𝐑𝐎𝐔𝐕𝐀𝐁𝐋𝐄 !')}        ║
║                                          ║
║  💡 ${metaBold('Tape')} ${prefix}help ${metaBold('pour voir la liste')}   ║
╚══════════════════════════════════════════╝`;
                await message.reply(notFound);
            } else {
                const configCommand = command.config;
                const roleText = roleTextToString(configCommand.role);
                const author = configCommand.author || "𝐈𝐧𝐜𝐨𝐧𝐧𝐮";
                const longDescription = configCommand.longDescription?.en || "𝐏𝐚𝐬 𝐝𝐞 𝐝𝐞𝐬𝐜𝐫𝐢𝐩𝐭𝐢𝐨𝐧 𝐝é𝐭𝐚𝐢𝐥𝐥é𝐞.";
                const guideBody = configCommand.guide?.en || "𝐏𝐚𝐬 𝐝𝐞 𝐠𝐮𝐢𝐝𝐞 𝐝𝐢𝐬𝐩𝐨𝐧𝐢𝐛𝐥𝐞.";
                const usage = guideBody.replace(/{p}/g, prefix).replace(/{n}/g, configCommand.name);
                
                const response = `
╔══════════════════════════════════════════╗
║     ${metaBold('📋 𝐃É𝐓𝐀𝐈𝐋𝐒 𝐃𝐄 𝐋𝐀 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄')}       ║
╠══════════════════════════════════════════╣
║                                          ║
║  🏷️ ${metaBold('𝐍𝐎𝐌')}                                 ║
║  └─ ${configCommand.name}                              ║
║                                          ║
║  📝 ${metaBold('𝐃𝐄𝐒𝐂𝐑𝐈𝐏𝐓𝐈𝐎𝐍')}                         ║
║  └─ ${longDescription.slice(0, 45)}${longDescription.length > 45 ? '...' : ''}    ║
║                                          ║
║  🔄 ${metaBold('𝐀𝐋𝐈𝐀𝐒')}                               ║
║  └─ ${configCommand.aliases ? configCommand.aliases.slice(0, 3).join(", ") : "𝐀𝐮𝐜𝐮𝐧"}${configCommand.aliases?.length > 3 ? '...' : ''}    ║
║                                          ║
║  📌 ${metaBold('𝐕𝐄𝐑𝐒𝐈𝐎𝐍')}                             ║
║  └─ ${configCommand.version || "1.0"}                  ║
║                                          ║
║  🔒 ${metaBold('𝐑Ô𝐋𝐄 𝐑𝐄𝐐𝐔𝐈𝐒')}                         ║
║  └─ ${roleText}                        ║
║                                          ║
║  ⏱️ ${metaBold('𝐓𝐄𝐌𝐏𝐒 (𝐜𝐨𝐨𝐥𝐝𝐨𝐰𝐧)')}                    ║
║  └─ ${configCommand.countDown || 1} 𝐬𝐞𝐜𝐨𝐧𝐝𝐞(𝐬)                ║
║                                          ║
║  ✍️ ${metaBold('𝐀𝐔𝐓𝐄𝐔𝐑')}                              ║
║  └─ ${author}                                     ║
║                                          ║
║  ⚙️ ${metaBold('𝐔𝐓𝐈𝐋𝐈𝐒𝐀𝐓𝐈𝐎𝐍')}                          ║
║  └─ ${usage.slice(0, 50)}${usage.length > 50 ? '...' : ''}    ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ ${metaBold('𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓')} ${metaBold('⚡')}        ║
║  🕐 ${timeStr}  │  📅 ${dateStr}                    ║
╚══════════════════════════════════════════╝`;
                
                await message.reply(response);
            }
        }
    },
};

function getCategoryEmoji(category) {
    const emojis = {
        "info": "📚", "fun": "🎮", "game": "🎲", "music": "🎵",
        "admin": "🛡️", "moderation": "🔨", "utility": "🔧",
        "tools": "🛠️", "image": "🖼️", "video": "🎬",
        "nsfw": "🔞", "economy": "💰", "social": "👥",
        "anime": "🎌", "ai": "🤖", "education": "📖",
        "search": "🔍", "download": "📥", "config": "⚙️"
    };
    return emojis[category.toLowerCase()] || "📦";
}
