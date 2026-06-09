const axios = require('axios');
const { GoatWrapper } = require('fca-liane-utils');

let fontEnabled = true;

// Fonction de formatage optimisée
function formatFont(text) {
  if (!fontEnabled) return text;
  
  const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖥", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹"
  };

  return text.split('').map(char => fontMapping[char] || char).join('');
}

module.exports = {
  config: {
    name: "google",
    aliases: ["bard", "palm"],
    version: "1.1",
    author: "cliff / arranged by Gemini",
    countDown: 5,
    role: 0,
    category: "𝗔𝗜"
  },

  onStart: async function({ api, event, args }) {
    const { threadID, messageID } = event;
    const query = args.join(' ');

    if (!query) {
      return api.sendMessage(formatFont('Veuillez poser une question après la commande.'), threadID, messageID);
    }

    // Message d'attente
    const waitingMsg = await new Promise(resolve => {
      api.sendMessage(formatFont('🔍 Recherche en cours, patientez...'), threadID, (err, info) => {
        resolve(info);
      }, messageID);
    });

    try {
      // Appel API
      const res = await axios.get(`http://158.101.198.227:8609/google?prompt=${encodeURIComponent(query)}`);
      const responseData = res.data.response || "Aucune réponse reçue de l'IA.";
      
      const formattedResponse = `(𝗨𝗟𝗠 𝗠𝗢𝗗𝗘𝗟-Trained by Google)\n▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱\n${responseData}`;

      // Edition du message d'attente avec la réponse
      return api.editMessage(formatFont(formattedResponse), waitingMsg.messageID);

    } catch (err) {
      console.error("Erreur commande Google:", err);
      return api.editMessage(formatFont("❌ Une erreur est survenue lors de la connexion au service Google."), waitingMsg.messageID);
    }
  }
};

const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });
