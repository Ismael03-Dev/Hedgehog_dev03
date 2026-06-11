const { getPrefix } = global.utils;
const { commands, aliases } = global.GoatBot;

const CATEGORY_ICONS = {
 info: "ℹ️",
 admin: "⚙️",
 owner: "👑",
 system: "🖥️",
 fun: "🎉",
 utility: "🔧",
 media: "🎬",
 music: "🎵",
 game: "🎮",
 social: "💬",
 economy: "💰",
 education: "📚",
 moderation: "🛡️",
 ai: "🤖",
 image: "🖼️",
 uncategorized: "📦"
};

const ROLE_NAMES = {
 0: { label: "Tout le monde", icon: "👥" },
 1: { label: "Admin groupe", icon: "🔑" },
 2: { label: "Admin bot", icon: "👑" }
};

const PRIORITY_CATEGORIES = ["info", "system", "admin", "owner"];

function getCategoryIcon(cat) {
 return CATEGORY_ICONS[cat.toLowerCase()] || "📦";
}

function getRoleInfo(role) {
 return ROLE_NAMES[role] || { label: "Inconnu", icon: "❓" };
}

function formatGuide(guide, prefix, name) {
 return (guide || "Pas d'exemple fourni.")
 .replace(/{p}/g, prefix)
 .replace(/{pn}/g, prefix + name)
 .replace(/{n}/g, name);
}

function buildHeader(prefix, total, categories) {
 const catCount = Object.keys(categories).length;
 return (
 `╭─────────────────────•\n` +
 `│ 🦔 HEDGEHOG BOT — AIDE\n` +
 `├─────────────────────•\n` +
 `│ 🔹 Prefix : ${prefix}\n` +
 `│ 🔸 Commandes : ${total}\n` +
 `│ 📂 Catégories: ${catCount}\n` +
 `╰─────────────────────•\n`
 );
}

function buildCategoryBlock(cat, cmdList, prefix) {
 const icon = getCategoryIcon(cat);
 const title = cat.toUpperCase();
 let block = `\n╭──【 ${icon} ${title} 】\n`;

 const perLine = 2;
 for (let i = 0; i < cmdList.length; i += perLine) {
 const chunk = cmdList.slice(i, i + perLine);
 block += `│ ${chunk.map(c => `⤷ ${c}`).join(" ")}\n`;
 }

 block += `╰${"─".repeat(20)}\n`;
 return block;
}

function buildCommandDetail(cmd, prefix) {
 const cfg = cmd.config;
 const roleInfo = getRoleInfo(cfg.role || 0);
 const guide = formatGuide(cfg.guide?.en, prefix, cfg.name);
 const aliasText = cfg.aliases?.length ? cfg.aliases.join(", ") : "Aucun";
 const desc = cfg.longDescription?.en || cfg.shortDescription?.en || "Aucune description.";
 const version = cfg.version || "1.0";
 const cooldown = cfg.countDown || 1;
 const author = cfg.author || "Inconnu";

 const events = [];
 if (typeof cmd.onStart === "function") events.push("onStart");
 if (typeof cmd.onChat === "function") events.push("onChat");
 if (typeof cmd.onReply === "function") events.push("onReply");

 return (
 `╭─────────────────────•\n` +
 `│ 📖 ${cfg.name.toUpperCase()} v${version}\n` +
 `├─────────────────────•\n` +
 `│ 📝 ${desc}\n` +
 `├─────────────────────•\n` +
 `│ 👤 Auteur : ${author}\n` +
 `│ ${roleInfo.icon} Rôle : ${roleInfo.label} (${cfg.role || 0})\n` +
 `│ ⏱️ Cooldown : ${cooldown}s\n` +
 `│ 🏷️ Alias : ${aliasText}\n` +
 `│ 📂 Catégorie : ${getCategoryIcon(cfg.category || "uncategorized")} ${cfg.category || "Uncategorized"}\n` +
 `│ ⚡ Événements : ${events.join(", ") || "onStart"}\n` +
 `├─────────────────────•\n` +
 `│ 🔧 Usage :\n` +
 `│ ${guide}\n` +
 `╰─────────────────────•`
 );
}

function buildFooter(prefix) {
 return (
 `\n╭─────────────────────•\n` +
 `│ 💡 ${prefix}help <commande>\n` +
 `│ pour plus de détails\n` +
 `╰─────────────────────•`
 );
}

function buildSearchResults(results, prefix) {
 if (!results.length)
 return null;

 let msg = `╭─────────────────────•\n│ 🔍 RÉSULTATS\n├─────────────────────•\n`;
 for (const name of results) {
 const cmd = commands.get(name);
 const icon = getCategoryIcon(cmd?.config?.category || "");
 msg += `│ ${icon} ${name}\n`;
 }
 msg += `╰─────────────────────•`;
 return msg;
}

module.exports = {
 config: {
 name: "help",
 version: "2.0",
 author: "Ismael03-Dev",
 countDown: 5,
 role: 0,
 shortDescription: { en: "Liste des commandes et aide" },
 longDescription: { en: "Affiche toutes les commandes ou les détails d'une commande spécifique." },
 category: "info",
 guide: { en: "{pn} [commande | catégorie | search <mot>]" },
 priority: 0
 },

 onStart: async function ({ message, args, event, role }) {
 const threadID = event.threadID;
 const prefix = getPrefix(threadID);

 if (args.length === 0) {
 const categories = {};
 let visibleCount = 0;

 for (const [name, cmd] of commands) {
 if ((cmd.config.role || 0) > (role || 0)) continue;
 const cat = (cmd.config.category || "uncategorized").toLowerCase();
 if (!categories[cat]) categories[cat] = [];
 categories[cat].push(name);
 visibleCount++;
 }

 for (const cat in categories) categories[cat].sort();

 const sortedCategories = Object.keys(categories).sort((a, b) => {
 const ia = PRIORITY_CATEGORIES.indexOf(a);
 const ib = PRIORITY_CATEGORIES.indexOf(b);
 if (ia !== -1 && ib !== -1) return ia - ib;
 if (ia !== -1) return -1;
 if (ib !== -1) return 1;
 return a.localeCompare(b);
 });

 let msg = buildHeader(prefix, visibleCount, categories);

 for (const cat of sortedCategories) {
 msg += buildCategoryBlock(cat, categories[cat], prefix);
 }

 msg += buildFooter(prefix);
 return message.reply(msg);
 }

 if (args[0].toLowerCase() === "search" || args[0].toLowerCase() === "s") {
 const keyword = args.slice(1).join(" ").toLowerCase();
 if (!keyword)
 return message.reply(`╭─────────────────────•\n│ ⚠️ Fournis un mot-clé\n│ Usage : ${prefix}help search <mot>\n╰─────────────────────•`);

 const results = [];
 for (const [name, cmd] of commands) {
 const cfg = cmd.config;
 const inName = name.includes(keyword);
 const inDesc = (cfg.shortDescription?.en || "").toLowerCase().includes(keyword);
 const inCat = (cfg.category || "").toLowerCase().includes(keyword);
 const inAlias = (cfg.aliases || []).some(a => a.includes(keyword));
 if (inName || inDesc || inCat || inAlias) results.push(name);
 }

 const resultMsg = buildSearchResults(results, prefix);
 if (!resultMsg)
 return message.reply(`╭─────────────────────•\n│ ❌ Aucun résultat pour "${keyword}"\n╰─────────────────────•`);

 return message.reply(resultMsg);
 }

 const catInput = args[0].toLowerCase();
 const catCommands = [];
 for (const [name, cmd] of commands) {
 if ((cmd.config.category || "").toLowerCase() === catInput)
 catCommands.push(name);
 }

 if (catCommands.length > 0) {
 catCommands.sort();
 const icon = getCategoryIcon(catInput);
 let msg = `╭─────────────────────•\n│ ${icon} CATÉGORIE : ${catInput.toUpperCase()}\n│ ${catCommands.length} commande(s)\n├─────────────────────•\n`;
 for (const name of catCommands) {
 const cmd = commands.get(name);
 const desc = cmd?.config?.shortDescription?.en || "";
 msg += `│ ⤷ ${name}${desc ? ` — ${desc}` : ""}\n`;
 }
 msg += `╰─────────────────────•`;
 return message.reply(msg);
 }

 const input = args[0].toLowerCase();
 const cmd = commands.get(input) || commands.get(aliases.get(input));

 if (!cmd)
 return message.reply(
 `╭─────────────────────•\n` +
 `│ ❌ "${input}" introuvable\n` +
 `├─────────────────────•\n` +
 `│ 💡 ${prefix}help → liste complète\n` +
 `│ 💡 ${prefix}help search <mot>\n` +
 `╰─────────────────────•`
 );

 return message.reply(buildCommandDetail(cmd, prefix));
 }
};