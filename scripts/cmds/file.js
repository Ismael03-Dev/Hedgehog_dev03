const fs = require('fs');
const path = require('path');

// Configuration des permissions
const AUTHORIZED_USERS = ["61578718657900"]; // Liste des utilisateurs autorisés
const AUTHORIZED_GROUPS = []; // Ajoute des IDs de groupes si besoin

// Vérifier si l'utilisateur est autorisé
function isAuthorized(senderID, threadID) {
    if (AUTHORIZED_USERS.includes(senderID)) return true;
    if (AUTHORIZED_GROUPS.includes(threadID)) return true;
    return false;
}

// Meta Bold uniquement pour le titre
const toBold = (text) => {
    const dict = {
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜', 'd': '𝐝', 'e': '𝐞', 'f': '𝐟', 'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 'j': '𝐣', 'k': '𝐤', 'l': '𝐥', 'm': '𝐦',
        'n': '𝐧', 'o': '𝐨', 'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 's': '𝐬', 't': '𝐭', 'u': '𝐮', 'v': '𝐯', 'w': '𝐰', 'x': '𝐱', 'y': '𝐲', 'z': '𝐳',
        'A': '𝐀', 'B': '𝐁', 'C': '𝐂', 'D': '𝐃', 'E': '𝐄', 'F': '𝐅', 'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 'J': '𝐉', 'K': '𝐊', 'L': '𝐋', 'M': '𝐌',
        'N': '𝐍', 'O': '𝐎', 'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 'S': '𝐒', 'T': '𝐓', 'U': '𝐔', 'V': '𝐕', 'W': '𝐖', 'X': '𝐗', 'Y': '𝐘', 'Z': '𝐙',
        '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗'
    };
    return text.split('').map(c => dict[c] || c).join('');
};

module.exports = {
    config: {
        name: "file",
        aliases: ["extract", "getcmd"],
        version: "1.1",
        author: "Master Charbel",
        countDown: 2,
        role: 2,
        category: "admin",
        shortDescription: { en: "Extrait le code source d'une commande." },
        guide: { en: "{pn} <nom_commande>" }
    },

    onStart: async function ({ api, event, args }) {
        const { threadID, messageID, senderID } = event;

        // Vérification des permissions
        if (!isAuthorized(senderID, threadID)) {
            return api.sendMessage("❌ Vous n'êtes pas autorisé à utiliser cette commande.", threadID, messageID);
        }

        const commandName = args[0];

        if (!commandName) {
            return api.sendMessage("⚠️ Usage: file <nom_commande>", threadID, messageID);
        }

        const filePath = path.join(__dirname, `${commandName.toLowerCase()}.js`);

        try {
            if (!fs.existsSync(filePath)) {
                return api.sendMessage(`❌ La commande "${commandName}.js" n'existe pas.`, threadID, messageID);
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');

            const header = `📦 ${toBold("EXTRACTION REUSSIE")} 📦\n📄 Fichier: ${commandName}.js\n━━━━━━━━━━━━━━━━━━━\n\n`;
            const footer = `\n━━━━━━━━━━━━━━━━━━━\n⚙️ Master Charbel Security`;

            return api.sendMessage(header + fileContent + footer, threadID, messageID);

        } catch (error) {
            console.log(`[Erreur File] ${error.message}`);
            return api.sendMessage("❌ Une erreur est survenue lors de la lecture du fichier.", threadID, messageID);
        }
    }
};