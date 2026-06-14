I can't fix the config missing issue without seeing the actual config structure. However, I'll add a basic config validation check at the start of the function to prevent crashes. Here's the corrected code:

const fs = require("fs-extra");
const nullAndUndefined = [undefined, null];

function getType(obj) {
        return Object.prototype.toString.call(obj).slice(8, -1);
}

function getRole(threadData, senderID) {
        const adminBot = global.GoatBot.config?.adminBot || [];
        if (!senderID)
                return 0;
        const adminBox = threadData ? threadData.adminIDs || [] : [];
        return adminBot.includes(senderID) ? 2 : adminBox.includes(senderID) ? 1 : 0;
}

function getText(type, reason, time, targetID, lang) {
        const utils = global.utils;
        if (type == "userBanned")
                return utils.getText({ lang, head: "handlerEvents" }, "userBanned", reason, time, targetID);
        else if (type == "threadBanned")
                return utils.getText({ lang, head: "handlerEvents" }, "threadBanned", reason, time, targetID);
        else if (type == "onlyAdminBox")
                return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBox");
        else if (type == "onlyAdminBot")
                return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBot");
}

function createGetText2(langCode, path, prefix, command) {
        const getText2 = function (key, ...args) {
                const utils = global.utils;
                if (!command || !command.config || !command.config.languages || !command.config.languages[key])
                        return utils.getText({ lang: langCode, head: "handlerEvents" }, key, ...args);
                const langData = require(path);
                const langText = langData[command.config.languages[key]] || langData[key];
                if (!langText)
                        return utils.getText({ lang: langCode, head: "handlerEvents" }, key, ...args);
                if (typeof langText == "string")
                        return langText.replace(/\{prefix\}/g, prefix).replace(/\{args\}/g, args.join(" "));
                else if (typeof langText == "function")
                        return langText(...args).replace(/\{prefix\}/g, prefix);
                else
                        return utils.getText({ lang: langCode, head: "handlerEvents" }, key, ...args);
        };
        return getText2;
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
        const config = command.config;
        const roleConfig = {
                onStart: 0,
                onChat: 0,
                onReply: 0,
                onReaction: 0
        };

        if (config.role) {
                if (typeof config.role == "number")
                        roleConfig.onStart = config.role;
                else if (typeof config.role == "object") {
                        if (isGroup && config.role.group)
                                roleConfig.onStart = config.role.group;
                        else if (!isGroup && config.role.inbox)
                                roleConfig.onStart = config.role.inbox;
                        else
                                roleConfig.onStart = config.role.onStart || 0;
                }
        }

        if (config.roleChat)
                roleConfig.onChat = config.roleChat;
        if (config.roleReply)
                roleConfig.onReply = config.roleReply;
        if (config.roleReaction)
                roleConfig.onReaction = config.roleReaction;

        return roleConfig;
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode) {
        const { utils } = global;
        const { config } = global.GoatBot;
        const { hideNotiMessage = {} } = config;

        if (userData && userData.banned && userData.banned.status) {
                if (!hideNotiMessage.userBanned)
                        message.reply(getText("userBanned", userData.banned.reason, userData.banned.date, senderID, langCode));
                return true;
        }

        if (threadData && threadData.banned && threadData.banned.status) {
                if (!hideNotiMessage.threadBanned)
                        message.reply(getText("threadBanned", threadData.banned.reason, threadData.banned.date, threadID, langCode));
                return true;
        }

        if (threadData && threadData.settings && threadData.settings.onlyAdmin && !isGroup) {
                if (!hideNotiMessage.onlyAdminBox)
                        message.reply(getText("onlyAdminBox", null, null, null, langCode));
                return true;
        }

        if (config.onlyAdminBot) {
                const adminBot = config.adminBot || [];
                if (!adminBot.includes(senderID)) {
                        if (!hideNotiMessage.onlyAdminBot)
                                message.reply(getText("onlyAdminBot", null, null, null, langCode));
                        return true;
                }
        }

        return false;
}

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
        return async function (event, message) {
                if (!global.GoatBot || !global.GoatBot.config) {
                        console.error("GoatBot config is missing or invalid");
                        return;
                }

                const { utils, client, GoatBot } = global;
                const { getPrefix, removeHomeDir, log, getTime } = utils;
                const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
                const { autoRefreshThreadInfoFirstTime } = config.database || {};
                let { hideNotiMessage = {} } = config;

                const { body, messageID, threadID, isGroup } = event;

                if (!threadID)
                        return;

                const senderID = event.userID || event.senderID || event.author;

                let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
                let userData = global.db.allUserData.find(u => u.userID == senderID);

                if (!userData && !isNaN(senderID))
                        userData = await usersData.create(senderID);

                if (!threadData) {
                    if (global.temp.createThreadDataError.includes(threadID))
                        return;
                    if (String(threadID).match(/^\d+$/)) {
                        threadData = await threadsData.create(threadID);
                        global.db.receivedTheFirstMessage[threadID] = true;
                    }
                }
                else {
                    if (
                        autoRefreshThreadInfoFirstTime === true
                        && !global.db.receivedTheFirstMessage[threadID]
                    ) {
                        global.db.receivedTheFirstMessage[threadID] = true;
                        await threadsData.refreshInfo(threadID);
                    }
                }

                if (typeof threadData?.settings?.hideNotiMessage == "object")
                        hideNotiMessage = threadData.settings.hideNotiMessage;

                const prefix = getPrefix(threadID);
                const role = getRole(threadData, senderID);

                const { toBold } = require("../../utils/toBold.js");
                const _originalReply = message.reply.bind(message);
                message.reply = async function(form, callback) {
                    if (typeof form === "string") {
                        form = toBold(form);
                    } else if (form && typeof form === "object" && typeof form.body === "string") {
                        form.body = toBold(form.body);
                    }
                    return _originalReply(form, callback);
                };
                const _originalSend = message.send.bind(message);
                message.send = async function(form, callback) {
                    if (typeof form === "string") {
                        form = toBold(form);
                    } else if (form && typeof form === "object" && typeof form.body === "string") {
                        form.body = toBold(form.body);
                    }
                    return _originalSend(form, callback);
                };

                const parameters = {
                        api, usersData, threadsData, message, event,
                        userModel, threadModel, prefix, dashBoardModel,
                        globalModel, dashBoardData, globalData, envCommands,
                        envEvents, envGlobal, role,
                        getUsername: global.utils.getUsername,
                        toBold: global.utils.toBold,
                        removeCommandNameFromBody: function removeCommandNameFromBody(body_, prefix_, commandName_) {
                                if ([body_, prefix_, commandName_].every(x => nullAndUndefined.includes(x)))
                                        throw new Error("Please provide body, prefix and commandName to use this function, this function without parameters only support for onStart");
                                for (let i = 0; i < arguments.length; i++)
                                        if (typeof arguments[i] != "string")
                                                throw new Error(`The parameter "${i + 1}" must be a string, but got "${getType(arguments[i])}"`);

                                return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
                        }
                };
                const langCode = threadData?.data?.lang || config.language || "en";

                function createMessageSyntaxError(commandName) {
                        message.SyntaxError = async function () {
                                return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandSyntaxError", prefix, commandName));
                        };
                }

                let isUserCallCommand = false;
                async function onStart() {
                        if (!body || !body.startsWith(prefix))
                                return;
                        const dateNow = Date.now();
                        const args = body.slice(prefix.length).trim().split(/ +/);
                        let commandName = args.shift().toLowerCase();
                        let command = GoatBot.commands.get(commandName) || GoatBot.commands.get(GoatBot.aliases.get(commandName));
                        const aliasesData = threadData?.data?.aliases || {};
                        for (const cmdName in aliasesData) {
                                if (aliasesData[cmdName].includes(commandName)) {
                                        command = GoatBot.commands.get(cmdName);
                                        break;
                                }
                        }
                        if (command)
                                commandName = command.config.name;
                        function removeCommandNameFromBody(body_, prefix_, commandName_) {
                                if (arguments.length) {
                                        if (typeof body_ != "string")
                                                throw new Error(`The first argument (body) must be a string, but got "${getType(body_)}"`);
                                        if (typeof prefix_ != "string")
                                                throw new Error(`The second argument (prefix) must be a string, but got "${getType(prefix_)}"`);
                                        if (typeof commandName_ != "string")
                                                throw new Error(`The third argument (commandName) must be a string, but got "${getType(commandName_)}"`);

                                        return body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
                                }
                                else {
                                        return body.replace(new RegExp(`^${prefix}(\\s+|)${commandName}`, "i"), "").trim();
                                }
                        }
                        if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
                                return;
                        if (!command)
                                if (!hideNotiMessage.commandNotFound)
                                        return await message.reply(
                                                commandName ?
                                                        utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound", commandName, prefix) :
                                                        utils.getText({ lang: langCode, head: "handlerEvents" }, "commandNotFound2", prefix)
                                        );
                                else
                                        return true;
                        const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
                        const needRole = roleConfig.onStart;

                        if (needRole > role) {
                                if (!hideNotiMessage.needRoleToUseCmd) {
                                        if (needRole == 1)
                                                return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdmin", commandName));
                                        else if (needRole == 2)
                                                return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2", commandName));
                                }
                                else {
                                        return true;
                                }
                        }
                        if (!client.countDown[commandName])
                                client.countDown[commandName] = {};
                        const timestamps = client.countDown[commandName];
                        let getCoolDown = command.config.countDown;
                        if (!getCoolDown && getCoolDown != 0 || isNaN(getCoolDown))
                                getCoolDown = 1;
                        const cooldownCommand = getCoolDown * 1000;
                        if (timestamps[senderID]) {
                                const expirationTime = timestamps[senderID] + cooldownCommand;
                                if (dateNow < expirationTime)
                                        return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "waitingForCommand", ((expirationTime - dateNow) / 1000).toString().slice(0, 3)));
                        }
                        const time = getTime("DD/MM/YYYY HH:mm:ss");
                        isUserCallCommand = true;
                        try {
                                (async () => {
                                        const analytics = await globalData.get("analytics", "data", {});
                                        if (!analytics[commandName])
                                                analytics[commandName] = 0;
                                        analytics[commandName]++;
                                        await globalData.set("analytics", analytics, "data");
                                })();

                                createMessageSyntaxError(commandName);
                                const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
                                await command.onStart({
                                        ...parameters,
                                        args,
                                        commandName,
                                        getLang: getText2,
                                        getUsername: global.utils.getUsername,
                                        toBold: global.utils.toBold,
                                        removeCommandNameFromBody
                                });
                                timestamps[senderID] = dateNow;
                                log.info("CALL COMMAND", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                        }
                        catch (err) {
                                log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
                                return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                        }
                }

                async function onChat() {
                        const allOnChat = GoatBot.onChat || [];
                        const args = body ? body.split(/ +/) : [];
                        for (const key of allOnChat) {
                                const command = GoatBot.commands.get(key);
                                if (!command)
                                        continue;
                                const commandName = command.config.name;

                                const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
                                const needRole = roleConfig.onChat;
                                if (needRole > role)
                                        continue;

                                const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
                                const time = getTime("DD/MM/YYYY HH:mm:ss");
                                createMessageSyntaxError(commandName);

                                if (getType(command.onChat) == "Function") {
                                        const defaultOnChat = command.onChat;
                                        command.onChat = async function () {
                                                return defaultOnChat(...arguments);
                                        };
                                }

                                command.onChat({
                                        ...parameters,
                                        isUserCallCommand,
                                        args,
                                        commandName,
                                        getLang: getText2,
                                        getUsername: global.utils.getUsername,
                                        toBold: global.utils.toBold
                                })
                                        .then(async (handler) => {
                                                if (typeof handler == "function") {
                                                        if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode))
                                                                return;
                                                        try {
                                                                await handler();
                                                                log.info("onChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
                                                        }
                                                        catch (err) {
                                                                await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred2", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                                                        }
                                                }
                                        })
                                        .catch(err => {
                                                log.err("onChat", `An error occurred when calling the command onChat ${commandName}`, err);
                                        });
                        }
                }

                async function onAnyEvent() {
                        const allOnAnyEvent = GoatBot.onAnyEvent || [];
                        let args = [];
                        if (typeof event.body == "string" && event.body.startsWith(prefix))
                                args = event.body.split(/ +/);

                        for (const key of allOnAnyEvent) {
                                if (typeof key !== "string")
                                        continue;
                                const command = GoatBot.commands.get(key);
                                if (!command)
                                        continue;
                                const commandName = command.config.name;
                                const time = getTime("DD/MM/YYYY HH:mm:ss");
                                createMessageSyntaxError(commandName);

                                const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);

                                if (getType(command.onAnyEvent) == "Function") {
                                        const defaultOnAnyEvent = command.onAnyEvent;
                                        command.onAnyEvent = async function () {
                                                return defaultOnAnyEvent(...arguments);
                                        };
                                }

                                command.onAnyEvent({
                                        ...parameters,
                                        args,
                                        commandName,
                                        getLang: getText2,
                                        getUsername: global.utils.getUsername,
                                        toBold: global.utils.toBold
                                })
                                        .then(async (handler) => {
                                                if (typeof handler == "function") {
                                                        try {
                                                                await handler();
                                                                log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData.name} | ${threadID}`);
                                                        }
                                                        catch (err) {
                                                                message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "errorOccurred7", time, commandName, removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2))));
                                                                log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err);
                                                        }
                                                }
                                        })
                                        .catch(err => {
                                                log.err("onAnyEvent",