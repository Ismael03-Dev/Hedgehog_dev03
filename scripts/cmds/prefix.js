const fs = require("fs-extra");
const { utils } = global;
const path = require("path");
const { createCanvas } = require("canvas");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

module.exports = {
        config: {
                name: "prefix",
                version: "1.7",
                author: "NTKhang",
                countDown: 5,
                role: 0,
                description: "Thay đổi dấu lệnh của bot",
                category: "config",
                guide: { en: "   {pn} <new prefix>" }
        },

        langs: {
                en: {
                        reset: "Your prefix has been reset to default: %1",
                        onlyAdmin: "Only admin can change prefix of system bot",
                        confirmGlobal: "Please react to this message to confirm change prefix of system bot",
                        confirmThisThread: "Please react to this message to confirm change prefix in your box chat",
                        successGlobal: "Changed prefix of system bot to: %1",
                        successThisThread: "Changed prefix in your box chat to: %1"
                }
        },

        onStart: async function ({ message, role, args, commandName, event, threadsData, getLang }) {
                if (!args[0]) return message.SyntaxError();
                if (args[0] == 'reset') {
                        await threadsData.set(event.threadID, null, "data.prefix");
                        return message.reply(getLang("reset", global.GoatBot.config.prefix));
                }
                const newPrefix = args[0];
                const formSet = { commandName, author: event.senderID, newPrefix };
                if (args[1] === "-g") {
                        if (role < 2) return message.reply(getLang("onlyAdmin"));
                        else formSet.setGlobal = true;
                } else formSet.setGlobal = false;
                return message.reply(args[1] === "-g" ? getLang("confirmGlobal") : getLang("confirmThisThread"), (err, info) => {
                        formSet.messageID = info.messageID;
                        global.GoatBot.onReaction.set(info.messageID, formSet);
                });
        },

        onReaction: async function ({ message, threadsData, event, Reaction, getLang }) {
                const { author, newPrefix, setGlobal } = Reaction;
                if (event.userID !== author) return;
                if (setGlobal) {
                        global.GoatBot.config.prefix = newPrefix;
                        fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
                        return message.reply(getLang("successGlobal", newPrefix));
                } else {
                        await threadsData.set(event.threadID, newPrefix, "data.prefix");
                        return message.reply(getLang("successThisThread", newPrefix));
                }
        },

        onChat: async function ({ event, message, getLang }) {
                if (event.body && event.body.toLowerCase() === "prefix") {
                        const systemPrefix = global.GoatBot.config.prefix;
                        const boxPrefix = utils.getPrefix(event.threadID);
                        
                        const fullLines = [
                                "╭─⌾🌿𝙷𝙴𝙳𝙶𝙴𝙷𝙾𝙶🌿",
                                "│🦔|𝐒𝐲𝐬𝐭𝐞𝐦 𝐏𝐫𝐞𝐟𝐢𝐱: " + systemPrefix,
                                "│🔖|𝐁𝐨𝐱 𝐂𝐡𝐚𝐭 𝐏𝐫𝐞𝐟𝐢𝐱: " + boxPrefix,
                                "╰──────────⌾"
                        ];
                        
                        const fullText = fullLines.join("\n");
                        const frames = [];
                        const charPerFrame = 1;
                        const frameDelay = 60;
                        
                        for (let i = 1; i <= fullText.length; i++) {
                                const partialText = fullText.substring(0, i);
                                const lines = partialText.split("\n");
                                
                                const canvas = createCanvas(500, 200);
                                const ctx = canvas.getContext("2d");
                                
                                const gradient = ctx.createLinearGradient(0, 0, 500, 200);
                                gradient.addColorStop(0, "#0a0a1a");
                                gradient.addColorStop(0.5, "#1a1a2e");
                                gradient.addColorStop(1, "#0f3460");
                                ctx.fillStyle = gradient;
                                ctx.fillRect(0, 0, 500, 200);
                                
                                ctx.strokeStyle = "#d4af37";
                                ctx.lineWidth = 2;
                                ctx.strokeRect(5, 5, 490, 190);
                                
                                ctx.fillStyle = "#ffd700";
                                ctx.font = "bold 16px 'Courier New'";
                                ctx.fillText(lines[0] || "", 30, 45);
                                
                                if (lines[1]) {
                                        ctx.fillStyle = "#fff";
                                        ctx.font = "14px 'Courier New'";
                                        ctx.fillText(lines[1], 30, 90);
                                }
                                
                                if (lines[2]) {
                                        ctx.fillStyle = "#fff";
                                        ctx.font = "14px 'Courier New'";
                                        ctx.fillText(lines[2], 30, 135);
                                }
                                
                                if (lines[3]) {
                                        ctx.fillStyle = "#aaa";
                                        ctx.font = "12px 'Courier New'";
                                        ctx.fillText(lines[3], 30, 175);
                                }
                                
                                frames.push(canvas.toBuffer());
                        }
                        
                        const framePaths = [];
                        for (let f = 0; f < frames.length; f++) {
                                const framePath = path.join(__dirname, `frame_${f}.png`);
                                fs.writeFileSync(framePath, frames[f]);
                                framePaths.push(framePath);
                        }
                        
                        const gifPath = path.join(__dirname, `prefix_${event.threadID}.gif`);
                        try {
                                await execAsync(`ffmpeg -framerate 15 -i ${path.join(__dirname, "frame_%d.png")} -vf "scale=500:200:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -y ${gifPath}`);
                        } catch (e) {
                                console.error("ffmpeg error:", e);
                        }
                        
                        for (const fp of framePaths) {
                                fs.unlinkSync(fp);
                        }
                        
                        if (fs.existsSync(gifPath)) {
                                await message.reply({ attachment: fs.createReadStream(gifPath) });
                                fs.unlinkSync(gifPath);
                        } else {
                                const txt = `╭─⌾🌿𝙷𝙴𝙳𝙶𝙴𝙷𝙾𝙶🌿\n│🦔|𝐒𝐲𝐬𝐭𝐞𝐦 𝐏𝐫𝐞𝐟𝐢𝐱: ${systemPrefix}\n│🔖|𝐁𝐨𝐱 𝐂𝐡𝐚𝐭 𝐏𝐫𝐞𝐟𝐢𝐱: ${boxPrefix}\n╰──────────⌾`;
                                await message.reply(txt);
                        }
                        
                        return () => {};
                }
        }
};