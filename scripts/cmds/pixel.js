const axios = require('axios');

// Système de mémoire simple (stockage temporaire en RAM)
const conversationMemory = {};

async function fetchFromAI(url, params) {
  try {
    const response = await axios.get(url, { params, timeout: 60000 }); 
    return response.data;
  } catch (error) {
    return null;
  }
}

function getCustomResponse(input) {
    const normalizedInput = input.toLowerCase().trim();
    
    const creatorKeywords = ['créé', 'cree', 'developpé', 'developpe', 'créateur', 'createur', 'maître', 'maitre', 'dev', 'développeur', 'ton pere', 'ton père'];
    if (creatorKeywords.some(keyword => normalizedInput.includes(keyword))) {
        return `Je suis **Pixel**, une IA conçue par **Master Charbel**. C'est lui qui a structuré ma base de données. 🤖`;
    }

    const badWords = ['fdp', 'con', 'salope', 'pute', 'idiot', 'nique', 'merde', 'tg', 'ta gueule', 'batard', 'encule', 'débile', 'imbécile', 'enculé', 'bâtard'];
    if (badWords.some(word => normalizedInput.includes(word))) {
        const pixelResponses = [
            "Ce genre de langage n'est pas nécessaire ici. Restons polis.",
            "Je suis programmé pour ignorer la vulgarité.",
            "Inutile d'être agressif, cela ne résoudra rien.",
            "Un peu de respect, s'il te plaît. Je suis là pour t'aider."
        ];
        return "⚠ " + pixelResponses[Math.floor(Math.random() * pixelResponses.length)];
    }
    return null; 
}

async function getAIResponse(input, userId, userName) {
  const customReply = getCustomResponse(input);
  if (customReply) return { response: customReply, isWarning: customReply.includes("⚠") };

  // --- GESTION DE LA MÉMOIRE ---
  if (!conversationMemory[userId]) {
    conversationMemory[userId] = [];
  }
  
  // On construit le prompt avec le contexte (3 derniers échanges max pour éviter de saturer l'API)
  const history = conversationMemory[userId].map(m => `${m.role}: ${m.content}`).join('\n');
  const fullPrompt = `Ton nom est Pixel. Tu es un assistant poli et intelligent. Voici l'historique :\n${history}\nUtilisateur: ${input}\nPixel:`;

  const services = [
    { url: 'https://arychauhann.onrender.com/api/gemini-proxy2', params: { prompt: fullPrompt } },
    { url: 'https://ai-chat-gpt-4-lite.onrender.com/api/hercai', params: { question: fullPrompt } }
  ];

  let response = `Désolé ${userName}, j'ai un problème de mémoire immédiate.`;
  
  for (const service of services) {
    const data = await fetchFromAI(service.url, service.params);
    if (data) {
        const apiReply = data.result || data.reply || data.gpt4 || data.response; 
        if (apiReply && typeof apiReply === 'string') {
            response = apiReply.trim();
            
            // Sauvegarder dans la mémoire
            conversationMemory[userId].push({ role: "Utilisateur", content: input });
            conversationMemory[userId].push({ role: "Pixel", content: response });
            
            // Garder seulement les 6 derniers messages (3 questions/3 réponses) pour la performance
            if (conversationMemory[userId].length > 6) conversationMemory[userId].shift();
            break; 
        }
    }
  }

  return { response, isWarning: false };
}

module.exports = {
  config: {
    name: 'pixel', 
    aliases: ['px', 'ai'],
    author: 'MasterCharbel (Memory Update)',
    role: 0,
    category: 'ai',
    shortDescription: 'Assistant Pixel avec mémoire contextuelle.',
    guide: { en: "pixel <votre question>" }
  },
  
  onStart: async function ({ api, event, args }) {
    const input = args.join(' ').trim();
    if (!input) return api.sendMessage("🤖 Je vous écoute. De quoi voulez-vous parler ?", event.threadID, event.messageID);

    api.getUserInfo(event.senderID, async (err, ret) => {
      const userName = ret[event.senderID].name;
      api.setMessageReaction("⚡", event.messageID, () => {}, true);

      const { response, isWarning } = await getAIResponse(input, event.senderID, userName);
      const header = isWarning ? "⚠️ 𝙋𝙄𝙓𝙀𝙇 - 𝘼𝙇𝙀𝙍𝙏𝙀 ⚠️" : "╭─── 💎 𝙋𝙄𝙓𝙀𝙇 𝘼𝙄 ───⭓";
      const footer = isWarning ? "╰━━━━━━━━━━━━━━━❖" : "╰━━━━━━━ ✨ ━━━❖";
      
      api.sendMessage(`${header}\n│\n│ ${response}\n│\n${footer}`, event.threadID, event.messageID);
    });
  },
  
  onChat: async function ({ api, event, message }) {
    const match = event.body.trim().match(/^(pixel|px|ai)\s+(.*)/i);
    if (!match) return; 
    
    const input = match[2].trim();
    api.getUserInfo(event.senderID, async (err, ret) => {
      const userName = ret[event.senderID].name;
      api.setMessageReaction("⚡", event.messageID, () => {}, true);

      const { response, isWarning } = await getAIResponse(input, event.senderID, userName);
      const header = isWarning ? "⚠️ 𝙋𝙄𝙓𝙀𝙇 - 𝘼𝙇𝙀𝙍𝙏𝙀 ⚠️" : "╭─── 💎 𝙋𝙄𝙓𝙀𝙇 𝘼𝙄 ───⭓";
      const footer = isWarning ? "╰━━━━━━━━━━━━━━━❖" : "╰━━━━━━━ ✨ ━━━❖";
      
      message.reply(`${header}\n│\n│ ${response}\n│\n${footer}`);
    });
  }
};
