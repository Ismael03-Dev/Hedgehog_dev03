const os = require("os");
const fs = require("fs-extra");
const path = require("path");

// Meta Bold Function
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

// Progress Bar
const progressBar = (percent, width = 20) => {
    const filled = Math.round((width * percent) / 100);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
};

// Format uptime
function getUptime() {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return { days, hours, minutes, seconds };
}

// Format date
function getStartTime() {
    const startTime = Date.now() - process.uptime() * 1000;
    return new Date(startTime).toLocaleString('fr-FR');
}

// Get RAM Usage
function getRAMUsage() {
    const totalRAM = os.totalmem();
    const freeRAM = os.freemem();
    const usedRAM = totalRAM - freeRAM;
    const percent = (usedRAM / totalRAM) * 100;
    return {
        used: (usedRAM / 1024 / 1024 / 1024).toFixed(2),
        free: (freeRAM / 1024 / 1024 / 1024).toFixed(2),
        total: (totalRAM / 1024 / 1024 / 1024).toFixed(2),
        percent: percent.toFixed(1)
    };
}

// Get CPU Load
function getCPULoad() {
    const cpus = os.cpus();
    const load = os.loadavg()[0];
    const percent = (load / cpus.length) * 100;
    return { load: load.toFixed(2), percent: Math.min(percent, 100).toFixed(1) };
}

module.exports = {
    config: {
        name: "uptime",
        aliases: ["up", "status", "info"],
        version: "2.0",
        author: "Master Charbel • 𝐍𝐄𝐗𝐔𝐒",
        countDown: 5,
        role: 0,
        shortDescription: { en: "📊 Affiche les statistiques du bot" },
        longDescription: { en: "Affiche l'uptime, les performances et les statistiques du bot" },
        category: "info",
        guide: { en: "{pn} : Affiche les statistiques\n{pn} details : Affiche plus de détails" }
    },

    onStart: async function ({ message, args, event }) {
        const { threadID } = event;
        const uptime = getUptime();
        const startTime = getStartTime();
        const ram = getRAMUsage();
        const cpu = getCPULoad();
        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-FR');
        const dateStr = now.toLocaleDateString('fr-FR');

        // Version détaillée
        if (args[0] && args[0].toLowerCase() === "details") {
            const cpus = os.cpus();
            const networkInterfaces = os.networkInterfaces();
            let ip = "N/A";
            
            for (const iface of Object.values(networkInterfaces)) {
                for (const addr of iface) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        ip = addr.address;
                        break;
                    }
                }
            }

            const messageDetails = 
`╔══════════════════════════════════════════╗
║        ${toBold('📊 NEXUS ULTIMATE STATS')}        ║
╠══════════════════════════════════════════╣
║                                          ║
║  ${toBold('⏱️ UPTIME')}                               ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  • Jours     : ${uptime.days}j                           ║
║  • Heures    : ${uptime.hours}h                          ║
║  • Minutes   : ${uptime.minutes}m                        ║
║  • Secondes  : ${uptime.seconds}s                        ║
║                                          ║
║  ${toBold('💾 RAM')}                                   ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  • Utilisée  : ${ram.used} GB / ${ram.total} GB           ║
║  • Libre     : ${ram.free} GB                         ║
║  • ${progressBar(parseFloat(ram.percent))} ${ram.percent}%          ║
║                                          ║
║  ${toBold('🖥️ CPU')}                                   ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  • Modèle    : ${cpus[0]?.model.slice(0, 30)}...      ║
║  • Cœurs     : ${cpus.length}                          ║
║  • Charge    : ${cpu.load} (${cpu.percent}%)                ║
║  • ${progressBar(parseFloat(cpu.percent))} ${cpu.percent}%          ║
║                                          ║
║  ${toBold('🌐 RÉSEAU')}                                ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  • IP        : ${ip}                            ║
║  • Hostname  : ${os.hostname()}                     ║
║                                          ║
║  ${toBold('📅 SYSTÈME')}                              ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║  • OS        : ${os.type()} ${os.arch()}            ║
║  • Plateforme: ${os.platform()}                       ║
║  • Démarrage : ${startTime}                 ║
║  • Actuel    : ${dateStr} ${timeStr}              ║
║                                          ║
╠══════════════════════════════════════════╣
║  ⚡ ${toBold('𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄 𝐁𝐎𝐓')} ⚡               ║
╚══════════════════════════════════════════╝`;

            return message.reply(messageDetails);
        }

        // Version simple et stylée
        const statusIcon = ram.percent < 50 ? "🟢" : ram.percent < 75 ? "🟡" : "🔴";
        
        const uptimeMsg = 
`╔══════════════════════════════════════════╗
║        ${toBold('⚡ NEXUS UPTIME ⚡')}              ║
╠══════════════════════════════════════════╣
║                                          ║
║  ${toBold('⏱️ TEMPS DE FONCTIONNEMENT')}                 ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║                                          ║
║     ${uptime.days}d ${uptime.hours}h ${uptime.minutes}m ${uptime.seconds}s
║                                          ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║                                          ║
║  ${toBold('💾 MÉMOIRE RAM')}                           ║
║  • ${ram.used} GB / ${ram.total} GB                    ║
║  • ${progressBar(parseFloat(ram.percent))} ${ram.percent}%     ║
║                                          ║
║  ${toBold('🖥️ CHARGE CPU')}                           ║
║  • ${cpu.load} / ${os.cpus().length} cœurs               ║
║  • ${progressBar(parseFloat(cpu.percent))} ${cpu.percent}%     ║
║                                          ║
║  ${toBold('📊 STATUT')}                               ║
║  • État      : ${statusIcon} ${statusIcon === "🟢" ? toBold("PERFORMANCE MAX") : statusIcon === "🟡" ? toBold("CHARGE MODÉRÉE") : toBold("CHARGE ÉLEVÉE")}
║  • Démarrage : ${startTime.split(' ')[0]}              ║
║                                          ║
╠══════════════════════════════════════════╣
║  📅 ${dateStr}  │  🕐 ${timeStr}                    ║
║  💡 Tape ${toBold('uptime details')} pour plus d'infos    ║
║  ⚡ ${toBold('𝐍𝐄𝐗𝐔𝐒 𝐔𝐋𝐓𝐈𝐌𝐀𝐓𝐄')} ⚡               ║
╚══════════════════════════════════════════╝`;

        return message.reply(uptimeMsg);
    }
};