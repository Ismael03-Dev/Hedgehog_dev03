const { login } = require('./fb-chat-api');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 10000;

global.utils = require('./utils.js');
global.config = config;

global.db = {
  data: {},
  load: function() {
    try {
      const data = fs.readFileSync('./database.json', 'utf8');
      this.data = JSON.parse(data);
    } catch (err) {
      console.log('New database created');
      this.data = {};
    }
  },
  save: function() {
    fs.writeFileSync('./database.json', JSON.stringify(this.data, null, 2));
  },
  get: function(key) {
    return this.data[key];
  },
  set: function(key, value) {
    this.data[key] = value;
    this.save();
  }
};

global.db.load();

global.getText = function(lang, key, ...args) {
  try {
    const langFile = require(`./languages/${lang}.js`);
    let text = langFile[key];
    if (!text) text = require(`./languages/en.js`)[key];
    if (!text) return key;
    for (let i = 0; i < args.length; i++) {
      text = text.replace(`{${i}}`, args[i]);
    }
    return text;
  } catch (err) {
    return key;
  }
};

global.getPrefix = function(threadID) {
  const prefix = global.db.get(`prefix_${threadID}`);
  return prefix || config.prefix || '!';
};

async function startBot() {
  const credentials = {
    appState: JSON.parse(fs.readFileSync('./appstate.json', 'utf8'))
  };

  login(credentials, (err, api) => {
    if (err) {
      console.error('Login error:', err);
      return process.exit(1);
    }

    global.api = api;

    api.setOptions({
      listenEvents: true,
      listenTyping: false,
      updatePresence: false,
      autoMarkDelivery: true,
      autoMarkRead: false,
      autoReconnect: true
    });

    const commands = new Map();
    const events = new Map();

    const cmdsPath = path.join(__dirname, 'scripts', 'cmds');
    if (fs.existsSync(cmdsPath)) {
      const cmdFiles = fs.readdirSync(cmdsPath).filter(f => f.endsWith('.js'));
      for (const file of cmdFiles) {
        try {
          const cmd = require(path.join(cmdsPath, file));
          commands.set(cmd.config.name, cmd);
          console.log(`✅ Command loaded: ${cmd.config.name}`);
        } catch (err) {
          console.error(`❌ Error loading command ${file}:`, err.message);
        }
      }
    }

    const eventsPath = path.join(__dirname, 'scripts', 'events');
    if (fs.existsSync(eventsPath)) {
      const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
      for (const file of eventFiles) {
        try {
          const event = require(path.join(eventsPath, file));
          events.set(event.config.name, event);
          console.log(`✅ Event loaded: ${event.config.name}`);
        } catch (err) {
          console.error(`❌ Error loading event ${file}:`, err.message);
        }
      }
    }

    api.listenMqtt(async (err, event) => {
      if (err) {
        console.error('Listen error:', err);
        return;
      }

      if (event.type === 'message' || event.type === 'message_reply') {
        const prefix = global.getPrefix(event.threadID);
        const body = event.body || '';
        
        if (body.startsWith(prefix)) {
          const args = body.slice(prefix.length).trim().split(/ +/);
          const commandName = args.shift().toLowerCase();
          const command = commands.get(commandName);

          if (command) {
            try {
              const msg = {
                reply: (text, callback) => {
                  api.sendMessage(text, event.threadID, callback);
                },
                replyWithImage: (imageUrl, caption, callback) => {
                  api.sendMessage({ body: caption, attachment: fs.createReadStream(imageUrl) }, event.threadID, callback);
                }
              };

              await command.onStart({
                message: msg,
                event: event,
                args: args,
                api: api,
                commandName: commandName
              });
            } catch (err) {
              console.error(`Command error ${commandName}:`, err);
              api.sendMessage(`❌ Error: ${err.message}`, event.threadID);
            }
          }
        }
      }

      for (const [name, eventHandler] of events) {
        if (eventHandler.onEvent && eventHandler.config.eventType.includes(event.type)) {
          try {
            await eventHandler.onEvent({ api: api, event: event });
          } catch (err) {
            console.error(`Event error ${name}:`, err);
          }
        }
      }
    });

    console.log('🤖 HedgehogGPT bot started successfully!');
  });
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('HedgehogGPT bot is online!\n');
  res.write(`Time: ${new Date().toISOString()}\n`);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
  startBot();
});