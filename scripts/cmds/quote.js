// ============================================
// 🎭 CITATION COMMAND - GOJO STYLE
// ✨ Par Satoru Gojo - Le Philosophe Suprême
// 💠 Style: Infinite Wisdom
// ============================================

const axios = require('axios');

// 🌀 GOJO STYLISH TEXT GENERATOR
const applyGojoStyle = (text) => {
    const styleMap = {
        A: '𝘼', B: '𝘽', C: '𝘾', D: '𝘿', E: '𝙀', F: '𝙁', G: '𝙂',
        H: '𝙃', I: '𝙄', J: '𝙅', K: '𝙆', L: '𝙇', M: '𝙈', N: '𝙉',
        O: '𝙊', P: '𝙋', Q: '𝙌', R: '𝙍', S: '𝙎', T: '𝙏', U: '𝙐',
        V: '𝙑', W: '𝙒', X: '𝙓', Y: '𝙔', Z: '𝙕',
        a: '𝙖', b: '𝙗', c: '𝙘', d: '𝙙', e: '𝙚', f: '𝙛', g: '𝙜',
        h: '𝙝', i: '𝙞', j: '𝙟', k: '𝙠', l: '𝙡', m: '𝙢', n: '𝙣',
        o: '𝙤', p: '𝙥', q: '𝙦', r: '𝙧', s: '𝙨', t: '𝙩', u: '𝙪',
        v: '𝙫', w: '𝙬', x: '𝙭', y: '𝙮', z: '𝙯'
    };
    
    return text
        .split('')
        .map(char => styleMap[char] || char)
        .join('');
};

// 📚 CATÉGORIES DE CITATIONS
const quoteCategories = {
    gojo: [
        {
            quote: "Je suis toujours le plus fort. Que tu le veuilles ou non.",
            author: "Satoru Gojo",
            source: "Jujutsu Kaisen"
        },
        {
            quote: "Être le plus fort, ce n'est pas seulement une question de pouvoir. C'est une responsabilité.",
            author: "Satoru Gojo",
            source: "Jujutsu Kaisen"
        },
        {
            quote: "Je déteste les efforts inutiles. Mais pour protéger ce qui est important, je ferai l'impossible.",
            author: "Satoru Gojo",
            source: "Jujutsu Kaisen"
        },
        {
            quote: "L'ennui est le pire des maux. C'est pourquoi je cherche toujours de nouveaux défis.",
            author: "Satoru Gojo",
            source: "Jujutsu Kaisen"
        },
        {
            quote: "Le véritable pouvoir, c'est de pouvoir protéger ceux qui vous sont chers.",
            author: "Satoru Gojo",
            source: "Jujutsu Kaisen"
        }
    ],
    
    wisdom: [
        {
            quote: "Le plus grand danger pour un village, ce n'est pas la guerre, mais quand ceux qui le gouvernent perdent la foi.",
            author: "Madara Uchiha",
            source: "Naruto"
        },
        {
            quote: "Ceux qui ne comprennent pas la véritable douleur ne peuvent jamais comprendre la véritable paix.",
            author: "Nagato",
            source: "Naruto"
        },
        {
            quote: "La volonté du feu, c'est de protéger le village. C'est le feu qui brûle en chacun de nous.",
            author: "Hashirama Senju",
            source: "Naruto"
        },
        {
            quote: "Un shinobi est celui qui endure. Peu importe ce qu'il vit, il continue d'avancer.",
            author: "Naruto Uzumaki",
            source: "Naruto"
        },
        {
            quote: "Dans ce monde, où que vous alliez, où qu'il y ait de la lumière, il y aura toujours des ombres.",
            author: "Itachi Uchiha",
            source: "Naruto"
        }
    ],
    
    anime: [
        {
            quote: "Les gens ne peuvent pas montrer leur véritable force tant qu'ils croient en quelque chose.",
            author: "Kenpachi Zaraki",
            source: "Bleach"
        },
        {
            quote: "Si vous ne risquez pas votre vie, vous ne pouvez pas créer d'avenir.",
            author: "Monkey D. Luffy",
            source: "One Piece"
        },
        {
            quote: "Il n'y a pas de mal à rêver, tant que vous vous réveillez.",
            author: "Sung Jin-Woo",
            source: "Solo Leveling"
        },
        {
            quote: "La vraie force, c'est de protéger ce qui est important pour vous.",
            author: "Goku",
            source: "Dragon Ball"
        },
        {
            quote: "Même si vous êtes faible maintenant, vous pouvez devenir fort.",
            author: "Izuku Midoriya",
            source: "My Hero Academia"
        }
    ],
    
    motivation: [
        {
            quote: "Le succès n'est pas final, l'échec n'est pas fatal : c'est le courage de continuer qui compte.",
            author: "Winston Churchill",
            source: "Citation"
        },
        {
            quote: "La seule limite à notre réalisation de demain sera nos doutes d'aujourd'hui.",
            author: "Franklin D. Roosevelt",
            source: "Citation"
        },
        {
            quote: "La vie, c'est comme faire du vélo. Pour garder l'équilibre, il faut avancer.",
            author: "Albert Einstein",
            source: "Citation"
        },
        {
            quote: "Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur moment, c'est maintenant.",
            author: "Proverbe chinois",
            source: "Citation"
        },
        {
            quote: "Ne regarde pas l'horloge ; fais ce qu'elle fait. Continue.",
            author: "Sam Levenson",
            source: "Citation"
        }
    ],
    
    random: [
        {
            quote: "La plus grande gloire n'est pas de ne jamais tomber, mais de se relever à chaque chute.",
            author: "Confucius",
            source: "Citation"
        },
        {
            quote: "Sois le changement que tu veux voir dans le monde.",
            author: "Mahatma Gandhi",
            source: "Citation"
        },
        {
            quote: "La seule chose nécessaire au triomphe du mal est l'inaction des gens de bien.",
            author: "Edmund Burke",
            source: "Citation"
        },
        {
            quote: "La simplicité est la sophistication suprême.",
            author: "Leonardo da Vinci",
            source: "Citation"
        },
        {
            quote: "La vie, ce n'est pas d'attendre que les orages passent, c'est d'apprendre à danser sous la pluie.",
            author: "Sénèque",
            source: "Citation"
        }
    ]
};

// 🎯 GET RANDOM QUOTE
const getRandomQuote = (category = 'random') => {
    const categories = Object.keys(quoteCategories);
    const selectedCategory = quoteCategories[category] || quoteCategories.random;
    
    const randomIndex = Math.floor(Math.random() * selectedCategory.length);
    return selectedCategory[randomIndex];
};

// 🌐 GET EXTERNAL QUOTE (Fallback)
const getExternalQuote = async () => {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        const data = response.data;
        return {
            quote: data.content,
            author: data.author,
            source: "Quotable API"
        };
    } catch (error) {
        // Fallback to local quote
        return getRandomQuote();
    }
};

// 🎨 FORMAT QUOTE
const formatQuote = (quoteData, category) => {
    const { quote, author, source } = quoteData;
    
    const styledQuote = applyGojoStyle(quote);
    const styledAuthor = applyGojoStyle(`- ${author}`);
    
    const categoryEmojis = {
        'gojo': '🌀',
        'wisdom': '🧠',
        'anime': '🎌',
        'motivation': '⚡',
        'random': '🎲'
    };
    
    const emoji = categoryEmojis[category] || '💬';
    
    return `
╔═══════════════════════════════╗
   ${emoji}  ${applyGojoStyle("CITATION")}  ${emoji}
╚═══════════════════════════════╝

"${styledQuote}"

${styledAuthor}
📚 ${source}

╭─────────────────────────────╮
│ 📊 Catégorie: ${category.charAt(0).toUpperCase() + category.slice(1)}
│ ✨ Sagesse infinie
│ ⚡ Powered by master charbel
╰─────────────────────────────╯
`;
};

module.exports = {
    config: {
        name: "quote",
        version: "1.0",
        author: "Satoru Gojo",
        countDown: 3,
        role: 0,
        shortDescription: {
            en: "Affiche des citations inspirantes",
            fr: "Montre des citations de sagesse"
        },
        longDescription: {
            en: "Domaine d'Expansion: Infinite Wisdom - Citations inspirantes de Gojo et d'ailleurs",
            fr: "La sagesse infinie du sorcier suprême et d'autres grands esprits"
        },
        category: "fun",
        guide: {
            en: "{pn} [gojo|wisdom|anime|motivation|random]",
            fr: "{pn} [gojo|sagesse|anime|motivation|random]"
        },
        priority: 1,
    },

    onStart: async function ({ message, args }) {
        try {
            const categories = ['gojo', 'wisdom', 'anime', 'motivation', 'random'];
            const input = args[0]?.toLowerCase();
            
            let category = 'random';
            if (input && categories.includes(input)) {
                category = input;
            } else if (input) {
                // Trouver la catégorie la plus proche
                const matched = categories.find(cat => cat.startsWith(input));
                if (matched) category = matched;
            }
            
            // Obtenir une citation
            let quoteData;
            if (category === 'random' && Math.random() > 0.7) {
                // 30% de chance d'avoir une citation externe pour la catégorie random
                quoteData = await getExternalQuote();
            } else {
                quoteData = getRandomQuote(category);
            }
            
            // Formater et envoyer
            const formattedQuote = formatQuote(quoteData, category);
            await message.reply(formattedQuote);
            
        } catch (error) {
            console.error("Quote command error:", error);
            
            // Citation d'erreur stylisée
            const errorQuote = {
                quote: "Même l'Infini a ses limites. Réessaie plus tard.",
                author: "Satoru Gojo",
                source: "Sagesse d'erreur"
            };
            
            const formattedError = formatQuote(errorQuote, 'gojo');
            await message.reply(formattedError);
        }
    },

    onChat: async function ({ event, message }) {
        const msg = event.body?.toLowerCase() || '';
        const triggers = ['citation', 'quote', 'sagesse', 'philosophie', 'inspire moi'];
        
        if (triggers.some(trigger => msg.includes(trigger)) && !msg.startsWith('!')) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return this.onStart({ message, args: [] });
        }
    }
};

// 🎨 ASCII ART FOR EXTRA COOLNESS
/*
    ╔═══════════════════════════════╗
    ║         GOJO QUOTE SYSTEM     ║
    ║    💬  INFINITE WISDOM       💬║
    ║    🌀  DOMAIN: KNOWLEDGE     🌀║
    ║    ⚡  WISDOM: UNLIMITED      ⚡║
    ╚═══════════════════════════════╝
*/
