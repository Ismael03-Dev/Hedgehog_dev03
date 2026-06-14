module.exports.config = {
  name: "fbcookies",
  version: "1.0.0",
  role: 0,
  credits: "Hedgehog",
  description: "Get Facebook cookies from token",
  usage: "[token]",
  cooldown: 5
};

module.exports.onStart = async function({ api, event, args }) {
  try {
    const token = args.join(" ");
    if (!token) return api.sendMessage("Please provide a token.", event.threadID, event.messageID);

    const cookies = await this.getCookies(token);
    api.sendMessage(`Here are your Facebook cookies:\n${JSON.stringify(cookies, null, 2)}`, event.threadID, event.messageID);
  } catch (error) {
    api.sendMessage(`Error: ${error.message}`, event.threadID, event.messageID);
  }
};

module.exports.onChat = async function({ api, event }) {
  if (event.body.toLowerCase() === "fbcookies") {
    api.sendMessage("Please provide a token. Usage: fbcookies [token]", event.threadID, event.messageID);
  }
};

module.exports.getCookies = async function(tokenFullPermission) {
  const axios = require("axios");
  const response1 = await axios({
    url: 'https://graph.facebook.com/app',
    method: "GET",
    params: {
      access_token: tokenFullPermission
    }
  });
  if (response1.data.error)
    throw new Error("Token is invalid");

  const response2 = await axios({
    url: 'https://api.facebook.com/method/auth.getSessionforApp',
    method: "GET",
    params: {
      access_token: tokenFullPermission,
      format: "json",
      new_app_id: response1.data.id,
      generate_session_cookies: '1'
    }
  });
  if (response2.data.error_code)
    throw new Error("Token is invalid");
  else if (response2.data.session_cookies?.length >= 0)
    return response2.data.session_cookies.map(x => {
      x.key = x.name;
      delete x.name;
      return x;
    });
};💬 React to this message to apply changes directly on GitHub.