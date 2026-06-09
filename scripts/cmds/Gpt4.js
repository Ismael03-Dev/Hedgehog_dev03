const axios = require('axios');

const services = [
  { url: 'https://gpt-four.vercel.app/gpt', param: { prompt: 'prompt' }, isCustom: true }
];

async function callService(service, prompt, senderID) {
  try {
    const url = new URL(service.url);
    
    if (service.isCustom) {
      url.searchParams.append(service.param.prompt, prompt);
    } else {
      for (const [key, value] of Object.entries(service.param)) {
        url.searchParams.append(key, key === 'uid' ? senderID : prompt);
      }
    }

    const response = await axios.get(url.toString());
    // On cherche la propriété 'answer' ou on prend la donnée brute
    return response.data.answer || response.data;
  } catch (error) {
    console.error(`Error from ${service.url}: ${error.message}`);
    throw error;
  }
}

async function getFastestValidAnswer(prompt, senderID) {
  const promises = services.map(service => callService(service, prompt, senderID));
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return result.value;
    }
  }
  throw new Error('Désolé, aucun service n\'est disponible pour le moment.');
}

const ArYAN = ['gpt4', '¥gpt4'];

module.exports = {
  config: {
    name: 'Gpt4',
    version: '1.0.2',
    author: 'ArYAN',
    role: 0,
    category: 'ai',
    longDescription: {
      en: 'AI assistant using GPT-4 API to answer your questions.',
    },
    guide: {
      en: 'Usage: gpt4 [question] or reply to a bot message.',
    },
  },

  langs: {
    en: {
      header: "☮▁▂☾♛David 🚀 mpongo",
      footer: "▓█►─═David═─◄█▓▒",
      error: "❌ Une erreur est survenue : "
    }
  },

  onStart: async function () {},

  onChat: async function ({ api, event, getLang }) {
    const { body, messageReply, type, threadID, messageID, senderID } = event;
    if (!body) return;

    try {
      let prompt = "";
      const prefix = ArYAN.find(p => body.toLowerCase().startsWith(p));
      const header = getLang("header");

      // 1. Gestion du Reply (Réponse à un message précédent du bot)
      if (type === 'message_reply') {
        if (messageReply.body && messageReply.body.startsWith(header)) {
          // On nettoie le message précédent pour ne pas renvoyer le header à l'IA
          prompt = `Contexte précédent: ${messageReply.body.replace(header, "").trim()}\nQuestion actuelle: ${body.trim()}`;
        } else {
          return;
        }
      } 
      // 2. Gestion de la commande directe par préfixe
      else if (prefix) {
        prompt = body.substring(prefix.length).trim();
      } else {
        return;
      }

      // Message d'accueil si vide
      if (!prompt || prompt.toLowerCase() === 'gpt4') {
        const greeting = `${header}\n✌✌(•ิ‿•ิ)✌✌ 𝒀𝒐🫡 𝒉𝒖𝒎𝒂𝒊𝒏(𝒆).🥴 𝑪'𝒆𝒔𝒕 David ✔. 𝑩𝒂𝒍𝒂𝒏𝒄𝒆 𝒕𝒐𝒏 𝒑𝒓𝒐𝒃𝒍è𝒎𝒆🧐, 𝒋𝒆 𝒔𝒖𝒊𝒔 𝒍𝒆 𝒔𝒆𝒖𝒍 à 𝒑𝒐𝒖𝒗𝒐𝒊𝒓 𝒕'𝒂𝒊𝒅𝒆𝒓 𝒆𝒏 3𝒔⏳🛌🪅 ✨\n${getLang("footer")}`;
        return api.sendMessage(greeting, threadID, messageID);
      }

      // Appel des services
      const fastestAnswer = await getFastestValidAnswer(prompt, senderID);
      const finalMsg = `${header}\n${fastestAnswer}\n${getLang("footer")}`;
      
      api.sendMessage(finalMsg, threadID, messageID);

    } catch (error) {
      api.sendMessage(`${getLang("error")}${error.message}`, threadID, messageID);
    }
  }
};
