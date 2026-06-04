module.exports = {
 config: {
 name: "sensei",
 aliases: ["respect"],
 version: "1.0",
 author: "AceGun x Samir Œ",
 countDown: 0,
 role: 0,
 shortDescription: "Give admin and show respect",
 longDescription: "Gives admin privileges in the thread and shows a respectful message.",
 category: "admin",
 guide: "{pn} respect",
 },
 
 onStart: async function ({ message, args, api, event }) {
 try {
 console.log('Sender ID:', event.senderID);
 
 const permission = [
"61589149033077"
];
 if (!permission.includes(event.senderID)) {
 return api.sendMessage(
 "🙅| Accès refusé !",
 event.threadID,
 event.messageID
 );
 }
 
 const threadID = event.threadID;
 const adminID = event.senderID;
 
 // Change the user to an admin
 await api.changeAdminStatus(threadID, adminID, true);
 
 api.sendMessage(
 `✅| Ajout effectué !`,
 threadID
 );
 } catch (error) {
 console.error("Error promoting user to admin:", error);
 api.sendMessage("❌| Tentative échoué, veuillez vous assurer que je sois administrateur du groupe !", event.threadID);
 }
 },
}
