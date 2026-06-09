module.exports = {
  config: {
    name: "profil",
    version: "2.0",
    author: "The VOID KUN クン ",
    countDown: 10,
    role: 0,
    shortDescription: "Infos PROFIL fun",
    longDescription: "Récupère les infos et l'avatar d'un utilisateur Facebook, avec un style plus fun",
    category: "image",
  },

  onStart: async function ({ event, message, usersData, api, args }) {
    let avt
    const uid1 = event.senderID
    const uid2 = Object.keys(event.mentions)[0]
    let uid

    // Petit message d’attente stylé
    message.reply("Je fouille les archives secrètes de Facebook... attends un peu ✨")

    if (args[0]) {
      if (/^\d+$/.test(args[0])) {
        uid = args[0]
      } else {
        const match = args[0].match(/profile\.php\?id=(\d+)/)
        if (match) uid = match[1]
      }
    }

    if (!uid) {
      uid = event.type === "message_reply" ? event.messageReply.senderID : uid2  uid1
    }

    api.getUserInfo(uid, async (err, userInfo) => {
      if (err) {
        return message.reply("Oups... impossible de récupérer les infos. Facebook m’a fermé la porte.")
      }

      const avatarUrl = await usersData.getAvatarUrl(uid)

      let genderText
      switch (userInfo[uid].gender) {
        case 1:
          genderText = "Girl 🌸"
          break
        case 2:
          genderText = "Boy 🔵"
          break
        default:
          genderText = "Mystère 🌀"
      }

      // Ajout d’un petit texte fun aléatoire
      const vibes = [
        "Voici le dossier ultra confidentiel que j’ai trouvé 📂",
        "Regarde ce que j’ai déniché pour toi 👀",
        "Analyse terminée. Voilà le résultat 💫",
        "Données récupérées avec style 😎",
        "Mission accomplie, chef 🫡"
      ]

      const randomVibe = vibes[Math.floor(Math.random()  vibes.length)]

      const userInformation =
        randomVibe +
        "\n\n" +
        "✿ Nom: " + userInfo[uid].name +
        "\n✿ Lien FB: " + userInfo[uid].profileUrl +
        "\n✿ Genre: " + genderText +
        "\n✿ Type d’utilisateur: " + userInfo[uid].type +
        "\n✿ Ami: " + (userInfo[uid].isFriend ? "Oui 🤝" : "Non ❌") +
        "\n✿ Anniversaire aujourd’hui: " + (userInfo[uid].isBirthday ? "Oui 🎂" : "Non 📅")

      message.reply({
        body: userInformation,
        attachment: await global.utils.getStreamFromURL(avatarUrl)
      })
    })
  }
}