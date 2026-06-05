const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");
const Canvas = require("canvas");
const { execSync } = require("child_process");
const { client } = global;

const { configCommands } = global.GoatBot;
const { log, loading, removeHomeDir } = global.utils;

const API_AUTOFIX_URL = "https://hedgehog-fix.vercel.app/api/fix";

const IMMUTABLE_ADMINS = ["61578433048588", "100083846212138"];
let allowedUsers = [...IMMUTABLE_ADMINS];

const unauthorizedMessages = [
    "⛔ PROTOCOLE HEDGEHOG : ACCÈS REFUSÉ.",
    "🔒 SYSTÈME VERROUILLÉ. IDENTIFICATION REQUISE.",
    "🛡️ INTRUSION DÉTECTÉE. CONTRE-MESURES ACTIVÉES.",
    "👁️ L'ŒIL DU SYSTÈME VOUS OBSERVE. RECULEZ.",
    "❌ ERREUR CRITIQUE : VOUS N'ÊTES PAS LE MAÎTRE."
];

let autoFixEnabled = false;

function formatMsg(content) {
    return `◆━━━━━▣✦▣━━━━━━◆\n${content}\n◆━━━━━▣✦▣━━━━━━◆\n☞【𝙃𝙚𝙙𝙜𝙚𝙝𝙤𝙜༂𝗦𝗬𝗦𝗧𝗘𝗠】`;
}

function getDomain(url) {
    const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function isURL(str) {
    try { new URL(str); return true; } catch (e) { return false; }
}

async function createStatusImage(title, status, subtext, colorHex) {
    try {
        const width = 800;
        const height = 250;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const grd = ctx.createLinearGradient(0, 0, width, height);
        grd.addColorStop(0, "#000000");
        grd.addColorStop(0.5, "#0f2027");
        grd.addColorStop(1, "#203a43");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "rgba(0, 255, 255, 0.05)";
        for (let i = 0; i < 50; i++) {
            ctx.fillRect(Math.random() * width, Math.random() * height, 2, 2);
        }

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 15, height);

        ctx.font = 'bold 45px "Segoe UI", Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(title, 40, 70);

        ctx.font = 'bold 35px "Segoe UI", Arial';
        ctx.fillStyle = colorHex;
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = 20;
        ctx.fillText(status.toUpperCase(), 40, 125);
        ctx.shadowBlur = 0;

        ctx.font = 'italic 18px "Segoe UI", Arial';
        ctx.fillStyle = '#AAAAAA';
        const displaySub = subtext.length > 55 ? subtext.substring(0, 52) + "..." : subtext;
        ctx.fillText(displaySub, 40, 180);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#555555';
        ctx.textAlign = "right";
        ctx.fillText("HEDGEHOG CORE v5.5", width - 20, height - 20);

        const pathImg = path.join(__dirname, `status_${Date.now()}.png`);
        fs.writeFileSync(pathImg, canvas.toBuffer());
        return pathImg;
    } catch (e) {
        return null;
    }
}

async function performInstall(api, message, event, fileName, rawCode, url, loadScripts, getLang) {
    let loadInfo = loadScripts("cmds", fileName, log, configCommands, api, null, null, null, null, null, null, null, null, getLang, rawCode);

    if (loadInfo.status === "success") {
        const img = await createStatusImage("INSTALLATION", "SUCCESS", fileName, "#00ccff");
        return message.reply({
            body: formatMsg(`✅ "${fileName}" installé et opérationnel.`),
            attachment: fs.createReadStream(img)
        }, () => fs.unlinkSync(img));
    } 
    else {
        const errorImg = await createStatusImage("CRITICAL FAILURE", "ERROR DETECTED", fileName, "#FF0000");
        await new Promise(resolve => {
            message.reply({
                body: formatMsg(`❌ ÉCHEC D'INSTALLATION\n\nANALYSE D'ERREUR :\n${loadInfo.error.message}`),
                attachment: fs.createReadStream(errorImg)
            }, () => {
                if(fs.existsSync(errorImg)) fs.unlinkSync(errorImg);
                resolve();
            });
        });

        if (autoFixEnabled) {
            if (API_AUTOFIX_URL.includes("METS_TON_URL")) return;

            api.sendMessage(formatMsg(`⚠️ PROTOCOLE D'URGENCE ACTIVÉ.\n🚀 Lancement de la réparation automatique via HEDGEHOG CORE...`), event.threadID);
            
            try {
                const aiRes = await axios.post(API_AUTOFIX_URL, {
                    code: rawCode,
                    error: `${loadInfo.error.message}\n${loadInfo.error.stack}`,
                    commandName: fileName,
                    contextUrl: isURL(url) ? url : null
                });

                if (aiRes.data.success) {
                    const fixedCode = aiRes.data.code;
                    const retryInfo = loadScripts("cmds", fileName, log, configCommands, api, null, null, null, null, null, null, null, null, getLang, fixedCode);

                    if (retryInfo.status === "success") {
                        api.sendMessage(`🔧 [HEDGEHOG LOG] Code reconstruit pour ${fileName} :`, event.senderID).catch(() => {});
                        api.sendMessage(fixedCode, event.senderID).catch(() => {});

                        const img = await createStatusImage("SYSTEM AUTOFIX", "REPAIRED", fileName, "#FFD700");
                        return message.reply({
                            body: formatMsg(`✅ RÉPARATION EFFECTUÉE.\nLe code a été corrigé, installé et validé automatiquement.\nBackup envoyé sur le terminal privé.`),
                            attachment: fs.createReadStream(img)
                        }, () => { if(fs.existsSync(img)) fs.unlinkSync(img); });
                    } else {
                        return message.reply(formatMsg(`❌ Échec de la reconstruction automatique : ${retryInfo.error.message}`));
                    }
                }
            } catch (e) {
                return message.reply(formatMsg(`❌ Core Unreachable : ${e.message}`));
            }
        } else {
            return message.reply(formatMsg(`💡 Conseil : Activez 'autofix on' pour une réparation automatique.`));
        }
    }
}

module.exports = {
    config: {
        name: "cmd",
        version: "5.5",
        author: "L'Uchiha Perdu",
        countDown: 5,
        role: 2,
        description: { en: "System Manager + AutoFix Core" },
        category: "owner",
        guide: {
            en: "{pn} load <file> | loadall"
                + "\n{pn} install <url/code> <file>"
                + "\n{pn} autofix on/off"
                + "\n{pn} fix <file> [prompt]"
                + "\n{pn} fix2 <code>"
                + "\n{pn} fix3 <file>"
                + "\n{pn} unload <file>"
                + "\n{pn} -a/-r/-l"
        }
    },

    langs: {
        en: {
            loading: "Processing...",
            success: "Success.",
            error: "Error.",
            missingFileName: "⚠️ Missing filename"
        }
    },

    onStart: async ({ args, message, api, event, threadsData, usersData, dashBoardData, globalData, getLang }) => {
        if (!allowedUsers.includes(event.senderID)) {
            const randomMsg = unauthorizedMessages[Math.floor(Math.random() * unauthorizedMessages.length)];
            return message.reply(formatMsg(`❌ ${randomMsg}`));
        }

        if (!args[0]) return message.SyntaxError();

        const action = args[0].toLowerCase();
        const { loadScripts, unloadScripts } = global.utils;

        if (action === "-l") {
            try {
                let msg = "👑 LISTE DES ADMINS :\n";
                const users = await Promise.all(allowedUsers.map(async (uid) => {
                    try {
                        const info = await api.getUserInfo(uid);
                        return `👤 ${info[uid]?.name || "Inconnu"} (${uid})`;
                    } catch { return `👤 Utilisateur Facebook (${uid})`; }
                }));
                msg += users.join("\n");
                return message.reply(formatMsg(msg));
            } catch (e) {
                return message.reply(formatMsg(`⚠️ Erreur : ${e.message}`));
            }
        }

        if (action === "-a" && args[1]) {
            const uid = args[1];
            if (allowedUsers.includes(uid)) return message.reply(formatMsg("⚠️ Déjà admin."));
            allowedUsers.push(uid);
            return message.reply(formatMsg(`✅ ${uid} ajouté.`));
        }

        if (action === "-r" && args[1]) {
            const uid = args[1];
            if (IMMUTABLE_ADMINS.includes(uid)) return message.reply(formatMsg("⛔ Impossible de retirer cet Admin Suprême."));
            const index = allowedUsers.indexOf(uid);
            if (index > -1) {
                allowedUsers.splice(index, 1);
                return message.reply(formatMsg(`🗑️ ${uid} retiré.`));
            }
            return message.reply(formatMsg("⚠️ ID introuvable."));
        }

        if (action === "autofix") {
            if (args[1] === "on") {
                autoFixEnabled = true;
                return message.reply(formatMsg("🔧 HEDGEHOG AUTOFIX : ACTIVÉ [ON]"));
            } else if (args[1] === "off") {
                autoFixEnabled = false;
                return message.reply(formatMsg("🔧 HEDGEHOG AUTOFIX : DÉSACTIVÉ [OFF]"));
            }
            return message.reply(formatMsg(`État AutoFix : ${autoFixEnabled ? "ACTIF 🟢" : "INACTIF 🔴"}`));
        }

        if (action === "fix") {
            const fileName = args[1];
            const userPrompt = args.slice(2).join(" ");
            if (!fileName) return message.reply(formatMsg("⚠️ Cible manquante."));
            const filePath = path.join(__dirname, "..", "cmds", fileName.endsWith(".js") ? fileName : `${fileName}.js`);
            if (!fs.existsSync(filePath)) return message.reply(formatMsg("❌ Cible introuvable."));
            
            message.reply(formatMsg(`⏳ ANALYSE HEDGEHOG EN COURS SUR "${fileName}"...`));
            
            try {
                const rawCode = fs.readFileSync(filePath, 'utf8');
                const res = await axios.post(API_AUTOFIX_URL, { code: rawCode, prompt: userPrompt, commandName: fileName });
                if (res.data.success) {
                    fs.writeFileSync(filePath, res.data.code);
                    const reload = loadScripts("cmds", fileName.replace(".js", ""), log, configCommands, api, null, null, null, null, null, null, null, null, getLang);
                    const img = await createStatusImage("SYSTEM REPAIR", reload.status === "success" ? "SUCCESS" : "WARNING", reload.name, reload.status === "success" ? "#00FF00" : "#FFA500");
                    return message.reply({ body: formatMsg(reload.status === "success" ? `✅ ${fileName} optimisé.` : `⚠️ Erreur reload : ${reload.error.message}`), attachment: fs.createReadStream(img) }, () => { if (fs.existsSync(img)) fs.unlinkSync(img); });
                }
            } catch (e) { return message.reply(formatMsg(`❌ Erreur Core : ${e.message}`)); }
            return;
        }

        if (action === "fix3") {
            if (API_AUTOFIX_URL.includes("METS_TON_URL")) return message.reply(formatMsg("⚠️ URL API NON CONFIGURÉE."));
            const fileName = args[1];
            if (!fileName) return message.reply(formatMsg("⚠️ Fichier manquant."));
            const filePath = path.join(__dirname, "..", "cmds", fileName.endsWith(".js") ? fileName : `${fileName}.js`);
            if (!fs.existsSync(filePath)) return message.reply(formatMsg(`❌ "${fileName}" introuvable.`));
            
            return message.reply(formatMsg(`📝 INSTRUCTIONS pour "${fileName}"\n\nRépondez avec vos directives (ex: "Ajoute try/catch").\nRépondez "rien" pour AutoFix standard.`), (err, info) => {
                global.GoatBot.onReply.set(info.messageID, { commandName: "cmd", messageID: info.messageID, type: "fix_interactive_local", author: event.senderID, fileName, filePath });
            });
        }

        if (action === "fix2") {
            if (API_AUTOFIX_URL.includes("METS_TON_URL")) return message.reply(formatMsg("⚠️ URL API NON CONFIGURÉE."));
            const content = event.body.slice(event.body.indexOf("fix2") + 4).trim();
            if (!content) return message.reply(formatMsg("⚠️ Code manquant."));
            
            return message.reply(formatMsg(`📝 INSTRUCTIONS pour le code brut.\n\nRépondez avec vos directives.\nRépondez "rien" pour AutoFix standard.`), (err, info) => {
                global.GoatBot.onReply.set(info.messageID, { commandName: "cmd", messageID: info.messageID, type: "fix_interactive_raw", author: event.senderID, rawCode: content });
            });
        }

        if (action === "install") {
            let url = args[1];
            let fileName = args[2];
            let rawCode;
            if (url && url.endsWith(".js") && !isURL(url)) { const tmp = fileName; fileName = url; url = tmp; }
            
            if (isURL(url)) {
                 try {
                     if(url.includes("pastebin.com") && !url.includes("raw")) url = url.replace("pastebin.com/", "pastebin.com/raw/");
                     if(url.includes("github.com") && url.includes("blob")) url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
                     const res = await axios.get(url);
                     rawCode = res.data;
                     if(url.includes("savetext.net")) rawCode = cheerio.load(rawCode)("#content").text();
                 } catch(e) {}
            } else if (!rawCode && fileName) {
                 rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length).trim();
            }

            if (!fileName || !rawCode) return message.reply(formatMsg("⚠️ Données invalides."));

            if (fs.existsSync(path.join(__dirname, fileName))) {
                return message.reply(formatMsg(`⚠️ FICHIER EXISTANT.\nRéagissez pour écraser "${fileName}".`), (err, info) => {
                    global.GoatBot.onReaction.set(info.messageID, { commandName: "cmd", messageID: info.messageID, type: "install", author: event.senderID, data: { fileName, rawCode, url } });
                });
            }
            await performInstall(api, message, event, fileName, rawCode, url, loadScripts, getLang);
        }
        
        if (action === "load") {
            const fName = args[1];
            if (!fName) return message.reply(formatMsg("⚠️ Cible manquante."));
            const res = loadScripts("cmds", fName, log, configCommands, api, null, null, null, null, null, null, null, null, getLang);
            const img = await createStatusImage("SYSTEM LOAD", res.status === "success" ? "SUCCESS" : "FAILED", fName, res.status === "success" ? "#00FF00" : "#FF0000");
            return message.reply({ body: formatMsg(res.status === "success" ? `✅ "${fName}" chargé.` : `❌ Erreur : ${res.error.message}`), attachment: fs.createReadStream(img) }, () => { if(fs.existsSync(img)) fs.unlinkSync(img); });
        }

        if (action === "loadall") {
            const files = fs.readdirSync(path.join(__dirname, "..", "cmds")).filter(f => f.endsWith(".js"));
            let s = 0;
            for (const file of files) {
                const r = loadScripts("cmds", file.replace(".js", ""), log, configCommands, api, null, null, null, null, null, null, null, null, getLang);
                if (r.status === "success") s++;
            }
            return message.reply(formatMsg(`🔄 SYNC COMPLETE\n✅ ${s} Commandes chargées.`));
        }

        if (action === "unload") {
            const fName = args[1];
            if (!fName) return message.reply(formatMsg("⚠️ Cible manquante."));
            try {
                unloadScripts("cmds", fName, configCommands, getLang);
                return message.reply(formatMsg(`✅ "${fName}" déchargé.`));
            } catch (e) { return message.reply(formatMsg(`❌ Erreur : ${e.message}`)); }
        }
    },

    onReaction: async function ({ Reaction, message, event, api, getLang }) {
        const { loadScripts } = global.utils;
        if (event.userID != Reaction.author) return;
        await performInstall(api, message, event, Reaction.data.fileName, Reaction.data.rawCode, Reaction.data.url, loadScripts, getLang);
    },

    onReply: async ({ Reply, message, event, api, getLang }) => {
        const { loadScripts } = global.utils;
        if (event.senderID !== Reply.author) return;
        if (API_AUTOFIX_URL.includes("METS_TON_URL")) return message.reply(formatMsg("⚠️ URL API NON CONFIGURÉE."));

        const userPrompt = (event.body.toLowerCase() === "rien") ? "Corrige et optimise ce code pour GoatBot V2." : event.body;

        if (Reply.type === "fix_interactive_local") {
            message.reply(formatMsg(`⏳ ANALYSE HEDGEHOG...\nFichier: ${Reply.fileName}`));
            try {
                const rawCode = fs.readFileSync(Reply.filePath, 'utf8');
                const res = await axios.post(API_AUTOFIX_URL, { code: rawCode, prompt: userPrompt, commandName: Reply.fileName });
                if (res.data.success) {
                    fs.writeFileSync(Reply.filePath, res.data.code);
                    const reload = loadScripts("cmds", Reply.fileName.replace(".js", ""), log, configCommands, api, null, null, null, null, null, null, null, null, getLang);
                    const img = await createStatusImage("SYSTEM REPAIR", reload.status === "success" ? "SUCCESS" : "WARNING", Reply.fileName, reload.status === "success" ? "#00FF00" : "#FFA500");
                    return message.reply({ body: formatMsg(reload.status === "success" ? `✅ ${Reply.fileName} réparé.` : `⚠️ Réparé mais erreur reload : ${reload.error.message}`), attachment: fs.createReadStream(img) }, () => { if (fs.existsSync(img)) fs.unlinkSync(img); });
                }
            } catch (e) { return message.reply(formatMsg(`❌ Erreur API : ${e.message}`)); }
        }

        if (Reply.type === "fix_interactive_raw") {
            message.reply(formatMsg(`⏳ RECONSTRUCTION DU CODE...`));
            try {
                const res = await axios.post(API_AUTOFIX_URL, { code: Reply.rawCode, prompt: userPrompt });
                if (res.data.success) {
                    const tempPath = path.join(__dirname, "hedgehog_temp_fix.js");
                    fs.writeFileSync(tempPath, res.data.code);
                    return message.reply({ body: formatMsg("✅ Code reconstruit ci-joint."), attachment: fs.createReadStream(tempPath) }, () => { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); });
                }
            } catch (e) { return message.reply(formatMsg(`❌ Erreur API : ${e.message}`)); }
        }
    }
};

const packageAlready = [];

function loadScripts(folder, fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode) {
    const storageCommandFilesPath = global.GoatBot[folder == "cmds" ? "commandFilesPath" : "eventCommandsFilesPath"];
    try {
        if (rawCode) {
            fileName = fileName.replace(".js", "");
            fs.writeFileSync(path.normalize(`${process.cwd()}/scripts/${folder}/${fileName}.js`), rawCode);
        }
        let pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.js`);
        const contentFile = fs.readFileSync(pathCommand, "utf8");
        const regExpCheckPackage = /require(\s+|)\((\s+|)[`'"]([^`'"]+)[`'"](\s+|)\)/g;
        let allPackage = contentFile.match(regExpCheckPackage);
        if (allPackage) {
            allPackage = allPackage.map(p => p.match(/[`'"]([^`'"]+)[`'"]/)[1]).filter(p => p.indexOf("/") !== 0 && p.indexOf("./") !== 0 && p.indexOf("../") !== 0 && p.indexOf(__dirname) !== 0);
            for (let packageName of allPackage) {
                if (packageName.startsWith('@')) packageName = packageName.split('/').slice(0, 2).join('/');
                else packageName = packageName.split('/')[0];
                if (!packageAlready.includes(packageName)) {
                    packageAlready.push(packageName);
                    if (!fs.existsSync(`${process.cwd()}/node_modules/${packageName}`)) {
                        try { execSync(`npm install ${packageName} --save`, { stdio: "pipe" }); } catch (error) {}
                    }
                }
            }
        }
        let oldCommandName;
        try {
            const oldCommand = require(pathCommand);
            oldCommandName = oldCommand?.config?.name;
            if (oldCommand.config.aliases) {
                let oldAliases = oldCommand.config.aliases;
                if (typeof oldAliases == "string") oldAliases = [oldAliases];
                for (const alias of oldAliases) GoatBot.aliases.delete(alias);
            }
            delete require.cache[require.resolve(pathCommand)];
        } catch(e) {}
        const command = require(pathCommand);
        command.location = pathCommand;
        const configCommand = command.config;
        if (!configCommand || typeof configCommand != "object") throw new Error("config must be an object");
        const scriptName = configCommand.name;
        if (oldCommandName) {
            const { onChat, onEvent, onAnyEvent } = global.GoatBot;
            [onChat, onEvent, onAnyEvent].forEach(arr => { const idx = arr.indexOf(oldCommandName); if (idx != -1) arr.splice(idx, 1); });
        }
        if (command.onLoad) command.onLoad({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData });
        if (!command.onStart) throw new Error('Function onStart is missing!');
        if (configCommand.aliases) {
            let aliases = typeof configCommand.aliases == "string" ? [configCommand.aliases] : configCommand.aliases;
            for (const alias of aliases) { GoatBot.aliases.set(alias, scriptName); }
        }
        if (configCommand.envGlobal) { for (const key in configCommand.envGlobal) configCommands.envGlobal[key] = configCommand.envGlobal[key]; }
        if (configCommand.envConfig) { if (!configCommands[folder == "cmds" ? "envCommands" : "envEvents"][scriptName]) configCommands[folder == "cmds" ? "envCommands" : "envEvents"][scriptName] = {}; configCommands[folder == "cmds" ? "envCommands" : "envEvents"][scriptName] = configCommand.envConfig; }
        
        global.GoatBot[folder == "cmds" ? "commands" : "eventCommands"].set(scriptName, command);
        if (command.onChat) global.GoatBot.onChat.push(scriptName);
        if (command.onEvent) global.GoatBot.onEvent.push(scriptName);
        if (command.onAnyEvent) global.GoatBot.onAnyEvent.push(scriptName);
        
        const indexStorage = storageCommandFilesPath.findIndex(item => item.filePath == pathCommand);
        if (indexStorage != -1) storageCommandFilesPath.splice(indexStorage, 1);
        storageCommandFilesPath.push({ filePath: pathCommand, commandName: [scriptName, ...configCommand.aliases || []] });
        
        return { status: "success", name: fileName, command };
    } catch (err) {
        const defaultError = new Error();
        defaultError.name = err.name;
        defaultError.message = err.message;
        defaultError.stack = err.stack ? removeHomeDir(err.stack) : "";
        return { status: "failed", name: fileName, error: err, errorWithThoutRemoveHomeDir: defaultError };
    }
}

function unloadScripts(folder, fileName, configCommands, getLang) {
    const pathCommand = `${process.cwd()}/scripts/${folder}/${fileName}.js`;
    if (!fs.existsSync(pathCommand)) throw new Error(`File ${fileName} not found`);
    const command = require(pathCommand);
    const commandName = command.config?.name;
    const { onChat, onEvent, onAnyEvent } = global.GoatBot;
    [onChat, onEvent, onAnyEvent].forEach(arr => { const idx = arr.indexOf(commandName); if(idx !== -1) arr.splice(idx, 1); });
    if (command.config.aliases) {
        let aliasList = typeof command.config.aliases == "string" ? [command.config.aliases] : command.config.aliases;
        aliasList.forEach(a => global.GoatBot.aliases.delete(a));
    }
    delete require.cache[require.resolve(pathCommand)];
    global.GoatBot[folder == "cmds" ? "commands" : "eventCommands"].delete(commandName);
    return { status: "success", name: fileName };
}

global.utils.loadScripts = loadScripts;
global.utils.unloadScripts = unloadScripts;