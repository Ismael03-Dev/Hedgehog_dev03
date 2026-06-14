const { Model, DataTypes } = require("sequelize");

const config = {
  name: "userDashboard",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Hedgehog",
  description: "User dashboard model",
  usages: "Internal use",
  cooldowns: 0
};

module.exports = function (sequelize) {
  class userModel extends Model {}
  userModel.init({
    email: DataTypes.STRING,
    name: DataTypes.STRING,
    password: DataTypes.STRING,
    facebookUserID: {
      type: DataTypes.STRING,
      defaultValue: ""
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: "userDashboard"
  });

  async function onStart({ api, event }) {}

  async function onChat({ api, event, message }) {}

  return { config, onStart, onChat, model: userModel };
};