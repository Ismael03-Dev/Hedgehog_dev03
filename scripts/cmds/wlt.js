module.exports = {
 config: {
 name: "wlt",
 version: "3.0",
 author: "rehat--",
 countDown: 3,
 role: 2,
 longDescription: {
 en: "Gérer la whitelist (ajouter, retirer, lister, activer/désactiver, stats, exporter)"
 },
 category: "owner",
 guide: {
 en: " {pn} add <uid|@tag> : Ajouter\n"
 + " {pn} remove <uid|@tag>: Retirer\n"
 + " {pn} list : Voir la liste\n"
 + " {pn} on | off : Activer / Désactiver\n"
 + " {pn} clear : Vider\n"
 + " {pn} check <uid> : Vérifier\n"
 + " {pn} stats : Statistiques\n"
 + " {pn} export : Exporter la liste"
 }
 },

 onStart: async function({ message, args, usersData, event, getLang, api }) {
 const { config } = global.GoatBot;
 const { writeFileSync } = require("fs-extra");
 const { createCanvas } = require("canvas");
 const fs = require("fs");

 const ALLOWED = ["100083846212138", "61589149033077", "61578433048588"];

 const saveConfig = () => {
 try {
 writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
 return true;
 } catch (e) {
 console.error("[wlt] Erreur sauvegarde:", e.message);
 return false;
 }
 };

 const extractUids = (args, event) => {
 if (Object.keys(event.mentions).length > 0) return Object.keys(event.mentions);
 if (event.messageReply) return [event.messageReply.senderID];
 return args.filter(a => /^\d+$/.test(a));
 };

 const formatUsers = async (uids, usersData) => {
 const names = await Promise.all(
 uids.map(uid =>
 usersData.getName(uid)
 .then(n => ` • ${n || "Inconnu"} (${uid})`)
 .catch(() => ` • Inconnu (${uid})`)
 )
 );
 return names.join("\n");
 };

 const S = (lines) => {
 let out = "╭─────────────•┈┈\n";
 for (const l of lines) {
 if (l === "---") { out += "├─────────────•┈┈\n"; continue; }
 out += `│ ${l}\n`;
 }
 return out + "╰─────────────•┈┈";
 };

 const generateCard = async ({ title, lines, color }) => {
 const W = 680, PADDING = 28, LINE_H = 28;
 const H = 80 + lines.length * LINE_H + 60;
 const canvas = createCanvas(W, H);
 const ctx = canvas.getContext("2d");

 const bg = ctx.createLinearGradient(0, 0, W, H);
 bg.addColorStop(0, "#07050e");
 bg.addColorStop(0.5, "#0e0c1f");
 bg.addColorStop(1, "#05030e");
 ctx.fillStyle = bg;
 ctx.fillRect(0, 0, W, H);

 ctx.fillStyle = "rgba(255,255,255,0.016)";
 for (let x = 0; x < W; x += 32)
 for (let y = 0; y < H; y += 32)
 ctx.fillRect(x, y, 1.5, 1.5);

 ctx.strokeStyle = color;
 ctx.lineWidth = 2.5;
 ctx.beginPath();
 ctx.moveTo(18, 8); ctx.lineTo(W - 18, 8);
 ctx.quadraticCurveTo(W - 8, 8, W - 8, 18);
 ctx.lineTo(W - 8, H - 18);
 ctx.quadraticCurveTo(W - 8, H - 8, W - 18, H - 8);
 ctx.lineTo(18, H - 8);
 ctx.quadraticCurveTo(8, H - 8, 8, H - 18);
 ctx.lineTo(8, 18);
 ctx.quadraticCurveTo(8, 8, 18, 8);
 ctx.closePath();
 ctx.stroke();

 const hG = ctx.createLinearGradient(0, 0, W, 0);
 hG.addColorStop(0, color + "30");
 hG.addColorStop(0.5, color + "10");
 hG.addColorStop(1, color + "30");
 ctx.fillStyle = hG;
 ctx.fillRect(8, 8, W - 16, 52);

 ctx.font = "bold 20px 'Courier New'";
 ctx.fillStyle = color;
 ctx.shadowColor = color;
 ctx.shadowBlur = 12;
 ctx.fillText(title, PADDING, 44);
 ctx.shadowBlur = 0;

 for (let i = 0; i < lines.length; i++) {
 const y = 78 + i * LINE_H;
 const txt = String(lines[i]);
 const isSep = txt === "---";
 if (isSep) {
 ctx.strokeStyle = color + "22";
 ctx.lineWidth = 1;
 ctx.beginPath();
 ctx.moveTo(PADDING, y + 6);
 ctx.lineTo(W - PADDING, y + 6);
 ctx.stroke();
 continue;
 }
 const isKey = txt.startsWith("•") || txt.startsWith("🔑") || txt.startsWith("✅") || txt.startsWith("❌");
 ctx.font = isKey ? "bold 12px 'Courier New'" : "12px 'Courier New'";
 ctx.fillStyle = isKey ? color : "rgba(255,255,255,0.75)";
 ctx.fillText(txt.substring(0, 72), PADDING, y + 16);
 }

 const d = new Date();
 ctx.font = "8px 'Courier New'";
 ctx.fillStyle = color + "44";
 ctx.textAlign = "center";
 ctx.fillText(`HEDGEHOG BOT • WHITELIST v3.0 • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, W / 2, H - 16);
 ctx.textAlign = "left";

 return canvas.toBuffer("image/png");
 };

 const sendCard = async (message, title, lines, color) => {
 const body = S([title, "---", ...lines]);
 try {
 const img = await generateCard({ title, lines, color });
 const path = `./wlt_card_${Date.now()}.png`;
 fs.writeFileSync(path, img);
 await message.reply({ body, attachment: fs.createReadStream(path) });
 fs.unlinkSync(path);
 } catch {
 await message.reply(body);
 }
 };

 if (!ALLOWED.includes(String(event.senderID)))
 return message.reply(S(["🚫 Permission refusée."]));

 const whitelist = config.whiteListMode.whiteListIds;
 const isEnabled = config.whiteListMode.enable;
 const cmd = args[0]?.toLowerCase();

 if (!cmd || cmd === "help") {
 return message.reply(S([
 "🛡️ WHITELIST v3.0",
 "---",
 "add <uid|@tag> → Ajouter",
 "remove <uid|@tag> → Retirer",
 "list → Voir la liste",
 "on | off → Activer/Désactiver",
 "clear → Vider",
 "check <uid> → Vérifier",
 "stats → Statistiques",
 "export → Exporter",
 "---",
 `Statut : ${isEnabled ? "🟢 Activée" : "🔴 Désactivée"}`,
 `Entrées : ${whitelist.length}`,
 ]));
 }

 switch (cmd) {
 case "add":
 case "-a": {
 const uids = extractUids(args.slice(1), event);
 if (!uids.length) return message.reply(S(["⚠️ Fournis un UID ou tague un utilisateur."]));

 const toAdd = uids.filter(u => !whitelist.includes(u));
 const already = uids.filter(u => whitelist.includes(u));

 if (toAdd.length) whitelist.push(...toAdd);
 if (toAdd.length && !saveConfig()) return message.reply(S(["❌ Erreur de sauvegarde."]));

 const addedNames = toAdd.length ? await formatUsers(toAdd, usersData) : null;
 const alreadyNames = already.length ? await formatUsers(already, usersData) : null;

 const lines = [];
 if (addedNames) lines.push(`✅ ${toAdd.length} ajouté(s) :`, ...addedNames.split("\n"));
 if (alreadyNames) lines.push("---", `⚠️ Déjà dans la liste :`, ...alreadyNames.split("\n"));

 return sendCard(message, "🛡️ WHITELIST — ADD", lines, "#22c55e");
 }

 case "remove":
 case "-r": {
 const uids = extractUids(args.slice(1), event);
 if (!uids.length) return message.reply(S(["⚠️ Fournis un UID ou tague un utilisateur."]));

 const toRemove = uids.filter(u => whitelist.includes(u));
 const notFound = uids.filter(u => !whitelist.includes(u));

 for (const uid of toRemove) {
 const idx = whitelist.indexOf(uid);
 if (idx !== -1) whitelist.splice(idx, 1);
 }
 if (toRemove.length && !saveConfig()) return message.reply(S(["❌ Erreur de sauvegarde."]));

 const removedNames = toRemove.length ? await formatUsers(toRemove, usersData) : null;
 const notFoundNames = notFound.length ? await formatUsers(notFound, usersData) : null;

 const lines = [];
 if (removedNames) lines.push(`✅ ${toRemove.length} retiré(s) :`, ...removedNames.split("\n"));
 if (notFoundNames) lines.push("---", `⚠️ Pas dans la liste :`, ...notFoundNames.split("\n"));

 return sendCard(message, "🛡️ WHITELIST — REMOVE", lines, "#ef4444");
 }

 case "list":
 case "-l": {
 if (!whitelist.length) return message.reply(S(["📋 La whitelist est vide."]));
 const formatted = await formatUsers(whitelist, usersData);
 const lines = [
 `👑 ${whitelist.length} utilisateur(s) :`,
 "---",
 ...formatted.split("\n"),
 "---",
 `Statut : ${isEnabled ? "🟢 Activée" : "🔴 Désactivée"}`,
 ];
 return sendCard(message, "🛡️ WHITELIST — LISTE", lines, "#818cf8");
 }

 case "on": {
 config.whiteListMode.enable = true;
 if (!saveConfig()) return message.reply(S(["❌ Erreur de sauvegarde."]));
 return sendCard(message, "🛡️ WHITELIST — ON", [
 "✅ Mode whitelist ACTIVÉ.",
 "Seuls les utilisateurs autorisés peuvent interagir.",
 `📋 ${whitelist.length} utilisateur(s) autorisé(s).`,
 ], "#22c55e");
 }

 case "off": {
 config.whiteListMode.enable = false;
 if (!saveConfig()) return message.reply(S(["❌ Erreur de sauvegarde."]));
 return sendCard(message, "🛡️ WHITELIST — OFF", [
 "🔓 Mode whitelist DÉSACTIVÉ.",
 "Tout le monde peut interagir avec le bot.",
 ], "#f59e0b");
 }

 case "clear": {
 const count = whitelist.length;
 if (!count) return message.reply(S(["⚠️ La whitelist est déjà vide."]));
 whitelist.splice(0, whitelist.length);
 if (!saveConfig()) return message.reply(S(["❌ Erreur de sauvegarde."]));
 return sendCard(message, "🛡️ WHITELIST — CLEAR", [
 `🗑️ ${count} utilisateur(s) retiré(s).`,
 "La whitelist est maintenant vide.",
 ], "#ef4444");
 }

 case "check": {
 const uid = args[1] || event.messageReply?.senderID;
 if (!uid) return message.reply(S(["⚠️ Fournis un UID à vérifier."]));
 const name = await usersData.getName(uid).catch(() => "Inconnu");
 const found = whitelist.includes(String(uid));
 return sendCard(message, "🛡️ WHITELIST — CHECK", [
 found ? `✅ ${name} EST dans la whitelist.` : `❌ ${name} n'est PAS dans la whitelist.`,
 `🔑 UID : ${uid}`,
 `📋 Position : ${found ? whitelist.indexOf(String(uid)) + 1 : "—"}/${whitelist.length}`,
 ], found ? "#22c55e" : "#ef4444");
 }

 case "stats": {
 const d = new Date();
 const time = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
 return sendCard(message, "📊 WHITELIST — STATS", [
 `📋 Total autorisés : ${whitelist.length}`,
 `🛡️ Mode whitelist : ${isEnabled ? "🟢 Activée" : "🔴 Désactivée"}`,
 `👑 Admins autorisés : ${ALLOWED.length}`,
 "---",
 `🕐 Dernière vérif. : ${time}`,
 `📦 Config path : ${global.client.dirConfig?.split("/").pop() || "config.json"}`,
 ], "#818cf8");
 }

 case "export": {
 if (!whitelist.length) return message.reply(S(["📋 Rien à exporter."]));
 const lines = whitelist.map((uid, i) => `${i + 1}. ${uid}`);
 const content = `WHITELIST EXPORT — ${new Date().toISOString()}\n${"─".repeat(40)}\n${lines.join("\n")}\n${"─".repeat(40)}\nTotal : ${whitelist.length} entrée(s)`;
 const path = `./whitelist_export_${Date.now()}.txt`;
 fs.writeFileSync(path, content);
 await message.reply({
 body: S([`📤 Export — ${whitelist.length} entrée(s)`, "Fichier .txt joint."]),
 attachment: fs.createReadStream(path),
 });
 fs.unlinkSync(path);
 return;
 }

 default:
 return message.reply(S(["⚠️ Commande invalide.", "Tape wlt help pour l'aide."]));
 }
 },

 onChat: async function({ message, event, getLang }) {
 const { config } = global.GoatBot;
 if (!config.whiteListMode.enable) return;
 const whitelist = config.whiteListMode.whiteListIds;
 if (!whitelist.includes(String(event.senderID))) {
 message.reply("🚫 Ce bot est en mode whitelist. Vous n'êtes pas autorisé à interagir.");
 return { block: true };
 }
 }
};