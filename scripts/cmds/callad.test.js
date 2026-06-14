const assert = require('assert');
const sinon = require('sinon');
const { expect } = require('chai');
const calladModule = require('./callad');

describe('callad Module', () => {
  let sandbox;
  let apiStub;
  let messageStub;
  let usersDataStub;
  let threadsDataStub;
  let getLangStub;
  let utilsStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    apiStub = {
      sendMessage: sandbox.stub().resolves({}),
      getThreadInfo: sandbox.stub().resolves({ threadName: 'Test Group' })
    };

    messageStub = {
      reply: sandbox.stub().resolves({})
    };

    usersDataStub = {
      getName: sandbox.stub().resolves('Test User')
    };

    threadsDataStub = {};

    getLangStub = sandbox.stub().returns('en');

    utilsStub = {
      getPrefix: sandbox.stub().returns('!'),
      getStreamsFromAttachment: sandbox.stub().resolves([])
    };

    global.utils = utilsStub;
  });

  afterEach(() => {
    sandbox.restore();
    delete global.utils;
  });

  describe('config', () => {
    it('should have correct configuration', () => {
      assert.equal(calladModule.config.name, 'callad');
      assert.equal(calladModule.config.version, '3.0');
      assert.equal(calladModule.config.author, 'Master Charbel • NEXUS');
      assert.equal(calladModule.config.role, 0);
      assert.equal(calladModule.config.category, 'utility');
      assert.deepEqual(calladModule.config.description, { en: "📞 Contacter l'administrateur du bot" });
    });
  });

  describe('onStart', () => {
    it('should show help message when no args provided', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: false,
        messageID: '789'
      };

      await calladModule.onStart({
        args: [],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(messageStub.reply.calledOnce).to.be.true;
      const replyArg = messageStub.reply.firstCall.args[0];
      expect(replyArg).to.include('𝐂𝐀𝐋𝐋 𝐀𝐃𝐌𝐈𝐍');
      expect(replyArg).to.include('!callad <message>');
    });

    it('should send message to admin group when args provided', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: true,
        messageID: '789',
        body: '!callad test message',
        attachments: []
      };

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(apiStub.sendMessage.calledOnce).to.be.true;
      expect(messageStub.reply.calledOnce).to.be.true;
      const replyArg = messageStub.reply.firstCall.args[0];
      expect(replyArg).to.include('𝐌𝐄𝐒𝐒𝐀𝐆𝐄 𝐄𝐍𝐕𝐎𝐘𝐄́ 𝐀𝐔𝐗 𝐀𝐃𝐌𝐈𝐍𝐒');
    });

    it('should handle attachments in message', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: true,
        messageID: '789',
        body: '!callad test message',
        attachments: [{ type: 'photo' }]
      };

      utilsStub.getStreamsFromAttachment.resolves([{ stream: 'test-stream' }]);

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(apiStub.sendMessage.calledOnce).to.be.true;
      const sendArg = apiStub.sendMessage.firstCall.args[0];
      expect(sendArg.attachment).to.deep.equal([{ stream: 'test-stream' }]);
    });

    it('should fallback to individual admin messages when group send fails', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: true,
        messageID: '789',
        body: '!callad test message',
        attachments: []
      };

      apiStub.sendMessage.onFirstCall().rejects(new Error('Group send failed'));
      apiStub.sendMessage.onSecondCall().resolves({});

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(apiStub.sendMessage.calledTwice).to.be.true;
      expect(messageStub.reply.calledOnce).to.be.true;
    });

    it('should show error message when all sends fail', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: true,
        messageID: '789',
        body: '!callad test message',
        attachments: []
      };

      apiStub.sendMessage.rejects(new Error('All sends failed'));

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(messageStub.reply.calledOnce).to.be.true;
      const replyArg = messageStub.reply.firstCall.args[0];
      expect(replyArg).to.include('❌ 𝐄𝐑𝐑𝐄𝐔𝐑');
    });

    it('should handle private messages correctly', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: false,
        messageID: '789',
        body: '!callad test message',
        attachments: []
      };

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(apiStub.sendMessage.calledOnce).to.be.true;
      const sendArg = apiStub.sendMessage.firstCall.args[0];
      expect(sendArg.body).to.include('Message privé');
    });

    it('should handle thread info errors gracefully', async () => {
      const event = {
        senderID: '123',
        threadID: '456',
        isGroup: true,
        messageID: '789',
        body: '!callad test message',
        attachments: []
      };

      apiStub.getThreadInfo.rejects(new Error('Thread info failed'));

      await calladModule.onStart({
        args: ['test', 'message'],
        message: messageStub,
        event,
        usersData: usersDataStub,
        threadsData: threadsDataStub,
        api: apiStub,
        getLang: getLangStub
      });

      expect(apiStub.sendMessage.calledOnce).to.be.true;
      const sendArg = apiStub.sendMessage.firstCall.args[0];
      expect(sendArg.body).to.include('Groupe inconnu');
    });
  });
});