const axios = require('axios');
const fs = require('fs');
module.exports = {
 config: {
  name: "wasted",
  version: "1.1",
  author: "OtinXSandip",
  countDown: 5,
  role: 0,
  shortDescription: {
    vi: "Làm thú cưng cho ai đó.",
    en: "gay."
  },
  longDescription: {
    vi: "Làm thú cưng cho ai đó.",
    en: "meme."
  },
  category: "fun",
  guide: {
    vi: "{pn} [ chỗ trống | trả lời | đề cập | uid ]",
    en: "{pn} [ blank | reply | mention | uid ]"
  }
 },

 onStart: async function({ event, api, args , message }) {
		const { threadID, messageID, senderID, body } = event;
		let id;
		if (args.join().indexOf('@') !== -1) {
			id = Object.keys(event.mentions);
		} else {
			id = args[0] || senderID;
		}
		if (event.type == "message_reply") {
			id = event.messageReply.senderID;
		}
		
		const response = await axios.get(`https://sandip-api.onrender.com/wasted?uid=${id}`, { responseType: 'stream' });
		const tempFilePath = './temp.png';
		const writer = fs.createWriteStream(tempFilePath);
		response.data.pipe(writer);
		
		writer.on('finish', async () => {
			const attachment = fs.createReadStream(tempFilePath);
			await api.sendMessage({ body: "", attachment: attachment }, threadID, messageID);
			
			fs.unlinkSync(tempFilePath);
		});
	}
};