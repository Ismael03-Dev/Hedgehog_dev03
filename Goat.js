/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 */

process.on('unhandledRejection', error => console.log(error));
process.on('uncaughtException', error => console.log(error));

const axios = require("axios");
const fs = require("fs-extra");
const google = require("googleapis").google;
const nodemailer = require("nodemailer");
const { execSync } = require('child_process');
const log = require('./logger/log.js');
const path = require("path");

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0;

function validJSON(pathDir) {
        try {
                if (!fs.existsSync(pathDir))
                        throw new Error(`File "${pathDir}" not found`);
                execSync(`npx jsonlint "${pathDir}"`, { stdio: 'pipe' });
                return true;
        }
        catch (err) {
                let msgError = err.message;
                msgError = msgError.split("\n").slice(1).join("\n");
                const indexPos = msgError.indexOf("    at");
                msgError = msgError.slice(0, indexPos != -1 ? indexPos - 1 : msgError.length);
                throw new Error(msgError);
        }
}

const { NODE_ENV } = process.env;
const isDev = ['production', 'development'].includes(NODE_ENV);

const configJsonPath = path.normalize(`${__dirname}/config.json`);
const configCommandsJsonPath = path.normalize(`${__dirname}/configCommands.json`);
const accountTxtPath = path.normalize(`${__dirname}/account.txt`);

if (!fs.existsSync(configJsonPath)) {
  fs.writeFileSync(configJsonPath, '{}', 'utf8');
  console.log('✅ Created missing config.json');
}

if (!fs.existsSync(configCommandsJsonPath)) {
  fs.writeFileSync(configCommandsJsonPath, '{}', 'utf8');
  console.log('✅ Created missing configCommands.json');
}

if (!fs.existsSync(accountTxtPath)) {
  fs.writeFileSync(accountTxtPath, '', 'utf8');
  console.log('✅ Created missing account.txt');
}

const dirConfig = path.normalize(`${__dirname}/config${isDev ? '.dev.json' : '.json'}`);
const dirConfigCommands = path.normalize(`${__dirname}/configCommands${isDev ? '.dev.json' : '.json'}`);
const dirAccount = path.normalize(`${__dirname}/account${isDev ? '.dev.txt' : '.txt'}`);

if (isDev) {
  if (!fs.existsSync(dirConfig)) {
    fs.writeFileSync(dirConfig, '{}', 'utf8');
    console.log(`✅ Created missing ${dirConfig}`);
  }
  if (!fs.existsSync(dirConfigCommands)) {
    fs.writeFileSync(dirConfigCommands, '{}', 'utf8');
    console.log(`✅ Created missing ${dirConfigCommands}`);
  }
  if (!fs.existsSync(dirAccount)) {
    fs.writeFileSync(dirAccount, '', 'utf8');
    console.log(`✅ Created missing ${dirAccount}`);
  }
}

if (!isDev) {
  for (const pathDir of [dirConfig, dirConfigCommands]) {
    try {
      validJSON(pathDir);
    }
    catch (err) {
      log.error("CONFIG", `Invalid JSON file "${pathDir.replace(__dirname, "")}":\n${err.message.split("\n").map(line => `  ${line}`).join("\n")}\nPlease fix it and restart bot`);
      process.exit(0);
    }
  }
} else {
  try {
    if (fs.existsSync(dirConfig)) {
      validJSON(dirConfig);
    }
    if (fs.existsSync(dirConfigCommands)) {
      validJSON(dirConfigCommands);
    }
  }
  catch (err) {
    log.error("CONFIG", `Invalid JSON file:\n${err.message.split("\n").map(line => `  ${line}`).join("\n")}\nPlease fix it and restart bot`);
    process.exit(0);
  }
}

const config = require(dirConfig);
if (config.whiteListMode?.whiteListIds && Array.isArray(config.whiteListMode.whiteListIds))
        config.whiteListMode.whiteListIds = config.whiteListMode.whiteListIds.map(id => id.toString());
const configCommands = require(dirConfigCommands);

global.GoatBot = {
        startTime: Date.now() - process.uptime() * 1000,
        commands: new Map(),
        eventCommands: new Map(),
        commandFilesPath: [],
        eventCommandsFilesPath: [],
        aliases: new Map(),
        onFirstChat: [],
        onChat: [],
        onEvent: [],
        onReply: new Map(),
        onReaction: new Map(),
        onAnyEvent: [],
        config,
        configCommands,
        envCommands: {},
        envEvents: {},
        envGlobal: {},
        reLoginBot: function () { },
        Listening: null,
        oldListening: [],
        callbackListenTime: {},
        storage5Message: [],
        fcaApi: null,
        botID: null
};

global.db = {
        allThreadData: [],
        allUserData: [],
        allDashBoardData: [],
        allGlobalData: [],
        threadModel: null,
        userModel: null,
        dashboardModel: null,
        globalModel: null,
        threadsData: null,
        usersData: null,
        dashBoardData: null,
        globalData: null,
        receivedTheFirstMessage: {}
};

global.client = {
        dirConfig,
        dirConfigCommands,
        dirAccount,
        countDown: {},
        cache: {},
        database: {
                creatingThreadData: [],
                creatingUserData: [],
                creatingDashBoardData: [],
                creatingGlobalData: []
        },
        commandBanned: configCommands.commandBanned
};

const utils = require("./utils.js");
global.utils = utils;
const { colors } = utils;

global.temp = {
        createThreadData: [],
        createUserData: [],
        createThreadDataError: [],
        filesOfGoogleDrive: {
                arraybuffer: {},
                stream: {},
                fileNames: {}
        },
        contentScripts: {
                cmds: {},
                events: {}
        }
};

const watchAndReloadConfig = (dir, type, prop, logName) => {
        let lastModified = fs.statSync(dir).mtimeMs;
        let isFirstModified = true;

        fs.watch(dir, (eventType) => {
                if (eventType === type) {
                        const oldConfig = global.GoatBot[prop];

                        setTimeout(() => {
                                try {
                                        if (isFirstModified) {
                                                isFirstModified = false;
                                                return;
                                        }
                                        if (lastModified === fs.statSync(dir).mtimeMs) {
                                                return;
                                        }
                                        global.GoatBot[prop] = JSON.parse(fs.readFileSync(dir, 'utf-8'));
                                        log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
                                }
                                catch (err) {
                                        log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}`);
                                        global.GoatBot[prop] = oldConfig;
                                }
                                finally {
                                        lastModified = fs.statSync(dir).mtimeMs;
                                }
                        }, 200);
                }
        });
};

watchAndReloadConfig(dirConfigCommands, 'change', 'configCommands', 'CONFIG COMMANDS');
watchAndReloadConfig(dirConfig, 'change', 'config', 'CONFIG');

global.GoatBot.envGlobal = global.GoatBot.configCommands.envGlobal;
global.GoatBot.envCommands = global.GoatBot.configCommands.envCommands;
global.GoatBot.envEvents = global.GoatBot.configCommands.envEvents;

const getText = global.utils.getText;

if (config.autoRestart) {
        const time = config.autoRestart.time;
        if (!isNaN(time) && time > 0) {
                utils.log.info("AUTO RESTART", getText("Goat", "autoRestart1", utils.convertTime(time, true)));
                setTimeout(() => {
                        utils.log.info("AUTO RESTART", "Restarting...");
                        process.exit(2);
                }, time);
        }
        else if (typeof time == "string" && time.match(/^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/gmi)) {
                utils.log.info("AUTO RESTART", getText("Goat", "autoRestart2", time));
                const cron = require("node-cron");
                cron.schedule(time, () => {
                        utils.log.info("AUTO RESTART", "Restarting...");
                        process.exit(2);
                });
        }
}

(async () => {
        let gmailAccount = config.credentials?.gmailAccount;
        
        if ((!gmailAccount || !gmailAccount.clientId) && isDev) {
          try {
            const devConfig = require(dirConfig);
            gmailAccount = devConfig.credentials?.gmailAccount;
            console.log('✅ Loaded Gmail credentials from dev config');
          } catch (err) {
            console.log('⚠️ Could not load dev config for credentials');
          }
        }
        
        if (!gmailAccount || !gmailAccount.clientId) {
          console.log('⚠️ No Gmail credentials found, using dummy values');
          gmailAccount = {
            email: '',
            clientId: '',
            clientSecret: '',
            refreshToken: ''
          };
        }
        
        const { email, clientId, clientSecret, refreshToken } = gmailAccount;
        const OAuth2 = google.auth.OAuth2;
        const OAuth2_client = new OAuth2(clientId, clientSecret);
        OAuth2_client.setCredentials({ refresh_token: refreshToken });
        let accessToken;
        try {
                accessToken = await OAuth2_client.getAccessToken();
        }
        catch (err) {
                console.log('⚠️ Gmail API not configured, skipping email features');
                accessToken = null;
        }
        
        if (accessToken) {
          const transporter = nodemailer.createTransport({
                  host: 'smtp.gmail.com',
                  service: 'Gmail',
                  auth: {
                          type: 'OAuth2',
                          user: email,
                          clientId,
                          clientSecret,
                          refreshToken,
                          accessToken
                  }
          });

          async function sendMail({ to, subject, text, html, attachments }) {
                  const transporter = nodemailer.createTransport({
                          host: 'smtp.gmail.com',
                          service: 'Gmail',
                          auth: {
                                  type: 'OAuth2',
                                  user: email,
                                  clientId,
                                  clientSecret,
                                  refreshToken,
                                  accessToken
                          }
                  });
                  const mailOptions = {
                          from: email,
                          to,
                          subject,
                          text,
                          html,
                          attachments
                  };
                  const info = await transporter.sendMail(mailOptions);
                  return info;
          }

          global.utils.sendMail = sendMail;
          global.utils.transporter = transporter;
        } else {
          global.utils.sendMail = async () => console.log('Email not sent: Gmail API not configured');
          global.utils.transporter = null;
        }

        const { data: { version } } = await axios.get("https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2/main/package.json");
        const currentVersion = require("./package.json").version;
        if (compareVersion(version, currentVersion) === 1)
                utils.log.master("NEW VERSION", getText(
                        "Goat",
                        "newVersionDetected",
                        colors.gray(currentVersion),
                        colors.hex("#eb6a07", version),
                        colors.hex("#eb6a07", "node update")
                ));
        const parentIdGoogleDrive = await utils.drive.checkAndCreateParentFolder("GoatBot");
        utils.drive.parentID = parentIdGoogleDrive;
        require(`./bot/login/login${NODE_ENV === 'development' ? '.dev.js' : '.js'}`);
})();

function compareVersion(version1, version2) {
        const v1 = version1.split(".");
        const v2 = version2.split(".");
        for (let i = 0; i < 3; i++) {
                if (parseInt(v1[i]) > parseInt(v2[i]))
                        return 1;
                if (parseInt(v1[i]) < parseInt(v2[i]))
                        return -1;
        }
        return 0;
}