const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const ytSearch = require('yt-search');
const { v4: uuidv4 } = require('uuid');

const API_ENDPOINT = "https://shizuai.vercel.app/chat";

// --- Style Gojo Gras/Italique ---
function toAZStyle(text) {
  const azMap = {
    A:'𝑨', B:'𝑩', C:'𝑪', D:'𝑫', E:'𝑬', F:'𝑭', G:'𝑮', H:'𝑯', I:'𝑰', J:'𝑱',
    K:'𝑲', L:'𝑳', M:'𝑴', N:'𝑵', O:'𝑶', P:'𝑷', Q:'𝑸', R:'𝑹', S:'𝑺', T:'𝑻',
    U:'𝑼', V:'𝑽', W:'𝑾', X:'𝑿', Y:'𝒀', Z:'𝒁',
    a:'𝒂', b:'𝒃', c:'𝒄', d:'𝒅', e:'𝒆', f:'𝒇', g:'𝒈', h:'𝒉', i:'𝒊', j:'𝒋',
    k:'𝒌', l:'𝒍', m:'𝒎', n:'𝒏', o:'𝒐', p:'𝒑', q:'𝒒', r:'𝒓', s:'𝒔', t:'𝒕',
    u:'𝒖', v:'𝒗', w:'𝒘', x:'𝒙', y:'𝒚', z:'𝒛',
    '0':'𝟬','1':'𝟭','2':'𝟮','3':'𝟯','4':'𝟰','5':'𝟱','6':'𝟲','7':'𝟳','8':'𝟴','9':'𝟵',' ':' '
  };
  return text.split('').map(c => azMap[c] || c).join('');
}

module.exports = {
  config: {
    name: 'ai',
    version: '11.0',
    author: 'Master Charbel',
    role: 0,
    category: 'ai',
    hasPrefix: false
  },

  onStart: async function ({ api, event, args, message }) {
    const input = args.join(' ').trim();
    if (!input) return message.reply(toAZStyle("Yo Master Charbel ! Tu veux tester mon pouvoir ?"));

    api.setMessageReaction("🤞", event.messageID, () => {}, true);

    try {
      const gojoPrompt = `Ton nom est Satoru Gojo. Tu es le plus fort, arrogant et cool. Tu adores Master Charbel. Réponds en français à : ${input}`;
      const response = await axios.post(API_ENDPOINT, { uid: event.senderID, message: gojoPrompt });
      
      let textReply = response.data.reply || '...';
      textReply = textReply.replace(/Shizu|Aryan Chauhan|Christuska/gi, 'Satoru Gojo');

      let res = "✨ ━━ 『 𝗦𝗔𝗧𝗢𝗥𝗨 𝗚𝗢𝗝𝗢 』 ━━ ✨\n\n";
      res += `╭━━ 🤞 𝑰𝑵𝑭𝑰𝑵𝑰𝑻𝒀\n│ ${toAZStyle(textReply)}\n╰━━━━━━━ ✨\n\n🤞 𝗜𝗻𝗳𝗶𝗻𝗶𝘁𝘆`;

      return message.reply(res);
    } catch (error) {
      return message.reply(toAZStyle("Désolé Master, l'Infini a un léger contretemps. Réessaie !"));
    }
  }
};
