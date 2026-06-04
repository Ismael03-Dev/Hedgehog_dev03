const DIG = require("discord-image-generation");
const fs = require("fs-extra");

module.exports = {
  config: {
    name: "wanted2",
    version: "1.0",
    author: "KSHITIZ",
    countDown: 1,
    role: 0,
    shortDescription: "wanted poster",
    longDescription: "",
    category: "fun",
    guide: "{pn} {{[on | off]}}",
    envConfig: {
      deltaNext: 5
    }
  },

  langs: {
    vi: {
      noTag: "Tag ce déserteur ayant trahi le village"
    },
    en: {
      noTag: "You must tag two friends you want to "
    }
  },

  onStart: async function ({ event, message, usersData, args, getLang }) 
  {

    let mention = Object.keys(event.mentions)
    let uid;

  

    if(event.type == "message_reply"){
    uid = event.messageReply.senderID
    } else{
      if (mention[0]){
        uid = mention[0]
      }else{
        console.log(" jsjsj")
        uid = event.senderID}
    }

let url = await usersData.getAvatarUrl(uid)
let avt = await new DIG.Wanted().getImage(url)


 
      const pathSave = `${__dirname}/tmp/wanted.png`;
  fs.writeFileSync(pathSave, Buffer.from(avt));
    let body = "DÉSERTEUR DE KONOHA"
    if(!mention[0]) body="DÉSERTEUR DE KONOHA"
    message.reply({body:body,
attachment: fs.createReadStream(pathSave)
    }, () => fs.unlinkSync(pathSave));


  }
};
