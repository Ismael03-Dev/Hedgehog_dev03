const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;
const doNotDelete = "[ ⚡ | 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 | ⚡ ]"; 

module.exports = {
    config: {
        name: "help",
        version: "3.0",
        author: "Master Charbel",
        countDown: 5,
        role: 0,
        shortDescription: {
            en: "🌀 Affiche l'aide et la liste des commandes du bot.",
        },
        longDescription: {
            en: "Affiche une liste complète des commandes par catégorie et le détail d'utilisation d'une commande spécifique.",
        },
        category: "info",
        guide: {
            en: "{pn} : Liste de toutes les commandes.\n{pn} <nom_commande> : Affiche les détails d'une commande.",
        },
        priority: 1,
    },
    onStart: async function ({ message, args, event, threadsData, role }) {
        const { threadID } = event;
        const threadData = await threadsData.get(threadID);
        const prefix = getPrefix(threadID);
        
        const roleTextToString = (role) => {
            switch (role) {
                case 0: return "👤 0 (Tous les utilisateurs)";
                case 1: return "🛡️ 1 (Administrateurs de groupe)";
                case 2: return "👑 2 (Administrateur du bot)";
                default: return "❓ Rôle inconnu";
            }
        };

        if (args.length === 0) {
            const categories = {};
            let msg = "";
            
            msg += `✨ ═══════════════════════════ ✨\n`;
            msg += `  🌌 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 🌌\n`;
            msg += `  ⚡ 𝙏𝙝𝙚 𝙂𝙖𝙩𝙚𝙬𝙖𝙮 𝙩𝙤 𝙋𝙤𝙬𝙚𝙧 ⚡\n`;
            msg += `✨ ═══════════════════════════ ✨\n`;
            msg += `┏━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
            msg += `┃  📂 𝐋𝐈𝐒𝐓𝐄 𝐃𝐄𝐒 𝐂𝐎𝐌𝐌𝐀𝐍𝐃𝐄𝐒 📂  ┃\n`;
            msg += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

            for (const [name, value] of commands) {
                if (value.config.role > role) continue; 
                
                const category = value.config.category || "Uncategorized";
                categories[category] = categories[category] || { commands: [] };
                categories[category].commands.push(name);
            }
            
            Object.keys(categories).sort().forEach((category) => {
                if (categories[category].commands.length === 0) return;
                
                const emojiCat = getCategoryEmoji(category);
                msg += `\n\n${emojiCat} ▸ ${category.toUpperCase()} ◂ ${emojiCat}`;
                msg += `\n┌─────────────────────────┐`;
                
                const names = categories[category].commands.sort();
                for (let i = 0; i < names.length; i += 2) {
                    const lineCommands = names.slice(i, i + 2).map((item) => `🔹 ${item}`);
                    msg += `\n│ ${lineCommands.join("    ")}`;
                }
                msg += `\n└─────────────────────────┘`;
            });
            
            const totalCommands = commands.size;
            msg += `\n\n╔══════════════════════════╗`;
            msg += `\n║  📊 Statistiques du Bot  ║`;
            msg += `\n╠══════════════════════════╣`;
            msg += `\n║  🔢 Commandes : ${totalCommands}`;
            msg += `\n║  ⚡ Préfixe : ${prefix}`;
            msg += `\n║  🟢 Statut : En ligne`;
            msg += `\n╚══════════════════════════╝`;
            msg += `\n\n💎 Tape ${prefix}help <commande> pour les détails`;
            msg += `\n🌐 Communauté : %uchihagc`;
            msg += `\n\n╔══════════════════════════╗`;
            msg += `\n║  "La puissance naît de   ║`;
            msg += `\n║   la connexion." 🧠💫   ║`;
            msg += `\n╚══════════════════════════╝`;
            
            await message.reply(msg);

        } else {
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName) || commands.get(aliases.get(commandName));

            if (!command) {
                const notFound = `
╔══════════════════════════╗
║      ❌ 𝐄𝐑𝐑𝐄𝐔𝐑 ❌      ║
╠══════════════════════════╣
║  🔍 "${commandName}"      ║
║  introuvable !           ║
║                          ║
║  💡 Tape ${prefix}help     ║
║  pour voir la liste.     ║
╚══════════════════════════╝`;
                await message.reply(notFound);
            } else {
                const configCommand = command.config;
                const roleText = roleTextToString(configCommand.role);
                const author = configCommand.author || "Inconnu";
                const longDescription = configCommand.longDescription?.en || "Pas de description détaillée.";
                const guideBody = configCommand.guide?.en || "Pas de guide disponible.";
                
                const usage = guideBody.replace(/{p}/g, prefix).replace(/{n}/g, configCommand.name);
                
                const response = `
╔══════════════════════════╗
║    📋 𝐃É𝐓𝐀𝐈𝐋𝐒 𝐂𝐌𝐃 📋    ║
╚══════════════════════════╝

🏷️ 𝗡𝗢𝗠
└─ ${configCommand.name}

📝 𝗗𝗘𝗦𝗖𝗥𝗜𝗣𝗧𝗜𝗢𝗡
└─ ${longDescription}

🔄 𝗔𝗟𝗜𝗔𝗦
└─ ${configCommand.aliases ? configCommand.aliases.join(", ") : "Aucun"}

📌 𝗩𝗘𝗥𝗦𝗜𝗢𝗡
└─ ${configCommand.version || "1.0"}

🔒 𝗥Ô𝗟𝗘 𝗥𝗘𝗤𝗨𝗜𝗦
└─ ${roleText}

⏱️ 𝗧𝗘𝗠𝗣𝗢
└─ ${configCommand.countDown || 1}s

✍️ 𝗔𝗨𝗧𝗘𝗨𝗥
└─ ${author}

⚙️ 𝗨𝗧𝗜𝗟𝗜𝗦𝗔𝗧𝗜𝗢𝗡
└─ ${usage}

💡 𝗡𝗢𝗧𝗘
└─ [a|b|c] = optionnel

╔══════════════════════════╗
║  ⚡ 𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓 ⚡  ║
╚══════════════════════════╝`;

                await message.reply(response);
            }
        }
    },
};

function getCategoryEmoji(category) {
    const emojis = {
        "info": "📚",
        "fun": "🎮",
        "game": "🎲",
        "music": "🎵",
        "admin": "🛡️",
        "moderation": "🔨",
        "utility": "🔧",
        "tools": "🛠️",
        "image": "🖼️",
        "video": "🎬",
        "nsfw": "🔞",
        "economy": "💰",
        "social": "👥",
        "anime": "🎌",
        "ai": "🤖",
        "education": "📖",
        "search": "🔍",
        "download": "📥",
    };
    return emojis[category.toLowerCase()] || "📦";
}