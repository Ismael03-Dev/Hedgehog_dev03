const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;

module.exports = {
 config: {
 name: "help",
 version: "2.0",
 author: "ʚʆɞ Ismael Sømå ʚʆɞ",
 countDown: 3,
 role: 0,
 shortDescription: { en: "Liste des commandes et aide" },
 longDescription: { en: "Affiche toutes les commandes ou les détails d'une commande spécifique." },
 category: "info",
 guide: { en: "{pn} [nom de la commande]" },
 priority: 1,
 },

 onStart: async function ({ message, args, event, threadsData, role }) {
 const threadID = event.threadID;
 const threadData = await threadsData.get(threadID);
 const prefix = getPrefix(threadID);
 const botName = global.GoatBot.config?.botName || "Bot";

 const isAdmin = role >= 1;
 const isBotAdmin = role >= 2;

 if (args.length === 0) {
 const categories = {};

 for (const [name, cmd] of commands) {
 if (cmd.config.role > 1 && !isBotAdmin) continue;
 if (cmd.config.role === 1 && !isAdmin) continue;
 const category = cmd.config.category || "Uncategorized";
 if (!categories[category]) categories[category] = [];
 categories[category].push(name);
 }

 const sortedCategories = Object.keys(categories).sort((a, b) => {
 const order = ["info", "admin", "tools", "fun", "media", "uncategorized"];
 const ia = order.indexOf(a.toLowerCase());
 const ib = order.indexOf(b.toLowerCase());
 if (ia !== -1 && ib !== -1) return ia - ib;
 if (ia !== -1) return -1;
 if (ib !== -1) return 1;
 return a.localeCompare(b);
 });

 const totalCmds = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);

 let msg = `╭─────────────────────•\n`;
 msg += `│ 🦔 ${botName.toUpperCase()}\n`;
 msg += `├─────────────────────•\n`;
 msg += `│ 📌 Préfixe : ${prefix}\n`;
 msg += `│ 📂 Commandes : ${totalCmds}\n`;
 msg += `│ 👤 Rôle : ${roleTextToString(role)}\n`;
 msg += `│ ⏱️ Uptime : ${formatUptime(process.uptime())}\n`;
 msg += `╰─────────────────────•\n\n`;

 for (const cat of sortedCategories) {
 const cmdList = categories[cat].sort();
 const emoji = getCategoryEmoji(cat);
 msg += `╭─${emoji} ${cat.toUpperCase()} (${cmdList.length})\n`;

 const perLine = 3;
 for (let i = 0; i < cmdList.length; i += perLine) {
 const chunk = cmdList.slice(i, i + perLine);
 const line = chunk.map(c => `⤷ ${c}`).join(" ");
 msg += `│ ${line}\n`;
 }
 msg += `╰─────────────\n`;
 }

 msg += `\n💡 ${prefix}help <commande> pour détails\n`;
 msg += `━━━━━━━━━━━━━━━━━`;

 return message.reply(msg);
 }

 const input = args[0].toLowerCase();
 const cmd = commands.get(input) || commands.get(aliases.get(input));

 if (!cmd) {
 const suggestions = findSuggestions(input, commands, aliases);
 let reply = `❌ \`${input}\` introuvable.`;
 if (suggestions.length > 0) {
 reply += `\n\n💡 Suggestions :\n${suggestions.map(s => ` ⤷ ${s}`).join("\n")}`;
 }
 reply += `\n\nTapez \`${prefix}help\` pour la liste.`;
 return message.reply(reply);
 }

 const cfg = cmd.config;
 const roleLevel = cfg.role || 0;
 const roleName = roleLevel === 0 ? "👥 Tout le monde" : roleLevel === 1 ? "🛡️ Admin groupe" : "👑 Admin bot";
 const cooldown = cfg.countDown || 1;

 let response = `╭─────────────────────•\n`;
 response += `│ 📖 ${cfg.name.toUpperCase()}\n`;
 response += `├─────────────────────•\n`;
 response += `│ 📝 ${cfg.longDescription?.en || cfg.shortDescription?.en || "Aucune description"}\n`;
 response += `│ ✍️ Auteur : ${cfg.author || "Inconnu"}\n`;
 response += `│ 🎚️ Rôle : ${roleName}\n`;
 response += `│ ⏱️ Cooldown : ${cooldown}s\n`;
 response += `│ 📁 Catégorie : ${cfg.category || "N/A"}\n`;
 response += `│ 🔢 Version : ${cfg.version || "1.0"}\n`;

 if (cfg.aliases?.length) {
 response += `│ 🏷️ Alias : ${cfg.aliases.join(", ")}\n`;
 }

 if (cfg.dependencies?.length) {
 response += `│ 📦 Dépendances : ${cfg.dependencies.join(", ")}\n`;
 }

 response += `╰─────────────────────•\n`;
 response += `\n🔧 Utilisation :\n`;
 const guide = cfg.guide?.en || "Pas d'exemple fourni.";
 const usage = guide
 .replace(/{p}/g, prefix)
 .replace(/{pn}/g, prefix + cfg.name)
 .replace(/{n}/g, cfg.name);
 response += `\`${usage}\``;

 if (cfg.longDescription?.en && cfg.longDescription.en.length > 100) {
 response += `\n\n📋 Détails supplémentaires disponibles.`;
 }

 return message.reply(response);
 },
};

function roleTextToString(role) {
 switch (role) {
 case 0: return "👥 Membre";
 case 1: return "🛡️ Admin";
 case 2: return "👑 Owner";
 default: return "❓ Inconnu";
 }
}

function formatUptime(seconds) {
 const d = Math.floor(seconds / 86400);
 const h = Math.floor((seconds % 86400) / 3600);
 const m = Math.floor((seconds % 3600) / 60);
 const s = Math.floor(seconds % 60);
 const parts = [];
 if (d > 0) parts.push(`${d}j`);
 if (h > 0) parts.push(`${h}h`);
 if (m > 0) parts.push(`${m}m`);
 parts.push(`${s}s`);
 return parts.join(" ");
}

function getCategoryEmoji(category) {
 const emojis = {
 info: "📖",
 admin: "🛡️",
 tools: "🔧",
 fun: "🎮",
 media: "🎬",
 economy: "💰",
 game: "🎲",
 utility: "🛠️",
 nsfw: "🔞",
 ai: "🤖",
 social: "👥",
 uncategorized: "📁"
 };
 return emojis[category.toLowerCase()] || "📄";
}

function findSuggestions(input, commands, aliases) {
 const allNames = [...commands.keys(), ...aliases.keys()];
 const suggestions = new Set();

 allNames.forEach(name => {
 if (name.startsWith(input) || name.includes(input)) {
 suggestions.add(name);
 }
 });

 const levenshtein = (a, b) => {
 const matrix = [];
 for (let i = 0; i <= b.length; i++) matrix[i] = [i];
 for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
 for (let i = 1; i <= b.length; i++) {
 for (let j = 1; j <= a.length; j++) {
 if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
 else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
 }
 }
 return matrix[b.length][a.length];
 };

 if (suggestions.size < 3) {
 allNames.forEach(name => {
 if (levenshtein(input, name) <= 2 && !suggestions.has(name)) {
 suggestions.add(name);
 }
 });
 }

 return [...suggestions].slice(0, 3);
}