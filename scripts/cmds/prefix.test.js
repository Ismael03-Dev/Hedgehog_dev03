const assert = require('assert');
const sinon = require('sinon');
const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas } = require('canvas');
const prefixModule = require('./prefix');

describe('Prefix Module', () => {
  let sandbox;
  let messageStub;
  let threadsDataStub;
  let apiStub;
  let getLangStub;
  let utilsStub;

  const testThreadID = '123456789';
  const testUserID = '987654321';
  const testAdminID = '111111111';
  const testSuperAdminID = '222222222';

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    messageStub = {
      reply: sandbox.stub().resolves({}),
      react: sandbox.stub().resolves({})
    };

    threadsDataStub = {
      set: sandbox.stub().resolves({})
    };

    apiStub = {
      sendMessage: sandbox.stub().resolves({})
    };

    getLangStub = sandbox.stub().callsFake((key) => {
      const langs = {
        en: {
          reset: "✅ Prefix reset to default: %1",
          onlyAdmin: "🚫 Only admins can do this.",
          confirmGlobal: "💬 React within 60s to confirm global prefix change.",
          confirmThisThread: "💬 React within 60s to confirm prefix change in this chat.",
          successGlobal: "✅ Global prefix changed to: %1",
          successThisThread: "✅ Chat prefix changed to: %1",
          tooLong: "❌ Prefix too long (max 5 characters).",
          hasSpaces: "❌ Prefix cannot contain spaces.",
          samePrefix: "❌ New prefix is the same as current prefix.",
          locked: "🔒 This chat's prefix is locked. Ask an admin to unlock it.",
          expired: "⏰ Confirmation expired. Please try again.",
          wrongUser: "🚫 Only the person who requested this change can confirm it."
        },
        fr: {
          reset: "✅ Préfixe réinitialisé : %1",
          onlyAdmin: "🚫 Seuls les admins peuvent faire ça.",
          confirmGlobal: "💬 Réagis dans 60s pour confirmer le changement global.",
          confirmThisThread: "💬 Réagis dans 60s pour confirmer le changement dans ce salon.",
          successGlobal: "✅ Préfixe global changé en : %1",
          successThisThread: "✅ Préfixe du salon changé en : %1",
          tooLong: "❌ Préfixe trop long (max 5 caractères).",
          hasSpaces: "❌ Le préfixe ne peut pas contenir d'espaces.",
          samePrefix: "❌ Le nouveau préfixe est identique au préfixe actuel.",
          locked: "🔒 Le préfixe de ce salon est verrouillé. Demandez à un admin.",
          expired: "⏰ Confirmation expirée. Réessayez.",
          wrongUser: "🚫 Seul la personne ayant demandé le changement peut confirmer."
        }
      };
      return langs.en[key];
    });

    utilsStub = {
      getPrefix: sandbox.stub().returns('!'),
      getStreamsFromAttachment: sandbox.stub().resolves([])
    };

    global.utils = utilsStub;
    global.GoatBot = {
      config: { prefix: '!', language: 'en' },
      threadData: {},
      onReaction: new Map()
    };
    global.client = { dirConfig: path.join(__dirname, 'test_config.json') };

    // Clean up test files
    const testFiles = [prefixModule.config.LOGS_FILE, prefixModule.config.HISTORY_FILE, prefixModule.config.LOCKS_FILE, global.client.dirConfig];
    testFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  afterEach(() => {
    sandbox.restore();
    delete global.utils;
    delete global.GoatBot;
    delete global.client;

    // Clean up test files
    const testFiles = [prefixModule.config.LOGS_FILE, prefixModule.config.HISTORY_FILE, prefixModule.config.LOCKS_FILE, global.client.dirConfig];
    testFiles.forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  });

  describe('Config', () => {
    it('should have correct configuration', () => {
      assert.equal(prefixModule.config.name, 'prefix');
      assert.equal(prefixModule.config.version, '3.0');
      assert.equal(prefixModule.config.author, 'NTKhang');
      assert.equal(prefixModule.config.role, 0);
      assert.equal(prefixModule.config.category, 'config');
    });
  });

  describe('Helper Functions', () => {
    describe('loadJSON()', () => {
      it('should return fallback when file does not exist', () => {
        const result = prefixModule.loadJSON('nonexistent.json', { test: true });
        assert.deepEqual(result, { test: true });
      });

      it('should return parsed JSON when file exists', () => {
        const testFile = path.join(__dirname, 'test_load.json');
        fs.writeFileSync(testFile, JSON.stringify({ test: true }));
        const result = prefixModule.loadJSON(testFile, {});
        assert.deepEqual(result, { test: true });
        fs.unlinkSync(testFile);
      });

      it('should return fallback when file is corrupted', () => {
        const testFile = path.join(__dirname, 'test_corrupt.json');
        fs.writeFileSync(testFile, 'invalid json');
        const result = prefixModule.loadJSON(testFile, { test: true });
        assert.deepEqual(result, { test: true });
        fs.unlinkSync(testFile);
      });
    });

    describe('saveJSON()', () => {
      it('should save JSON to file', () => {
        const testFile = path.join(__dirname, 'test_save.json');
        prefixModule.saveJSON(testFile, { test: true });
        const content = fs.readFileSync(testFile, 'utf8');
        assert.equal(content, JSON.stringify({ test: true }, null, 2));
        fs.unlinkSync(testFile);
      });

      it('should handle errors silently', () => {
        const testFile = path.join('/root', 'test_save.json');
        assert.doesNotThrow(() => prefixModule.saveJSON(testFile, { test: true }));
      });
    });

    describe('addLog()', () => {
      it('should add log entry and limit to 50 entries', () => {
        for (let i = 0; i < 60; i++) {
          prefixModule.addLog(testUserID, testThreadID, 'old', 'new', 'test');
        }
        const logs = prefixModule.prefixLogs[testThreadID];
        assert.equal(logs.length, 50);
        assert.equal(logs[0].uid, testUserID);
        assert.equal(logs[0].oldPrefix, 'old');
        assert.equal(logs[0].newPrefix, 'new');
        assert.equal(logs[0].scope, 'test');
      });
    });

    describe('addHistory()', () => {
      it('should add history entry and limit to 5 entries', () => {
        for (let i = 0; i < 10; i++) {
          prefixModule.addHistory(testThreadID, `prefix${i}`);
        }
        const history = prefixModule.prefixHistory[testThreadID];
        assert.equal(history.length, 5);
        assert.equal(history[0], 'prefix9');
      });

      it('should not add duplicate consecutive entries', () => {
        prefixModule.addHistory(testThreadID, 'prefix1');
        prefixModule.addHistory(testThreadID, 'prefix1');
        const history = prefixModule.prefixHistory[testThreadID];
        assert.equal(history.length, 1);
      });
    });

    describe('getHistory()', () => {
      it('should return empty array when no history', () => {
        const history = prefixModule.getHistory(testThreadID);
        assert.deepEqual(history, []);
      });

      it('should return history when available', () => {
        prefixModule.addHistory(testThreadID, 'prefix1');
        prefixModule.addHistory(testThreadID, 'prefix2');
        const history = prefixModule.getHistory(testThreadID);
        assert.deepEqual(history, ['prefix2', 'prefix1']);
      });
    });

    describe('isLocked()', () => {
      it('should return false when thread is not locked', () => {
        assert.equal(prefixModule.isLocked(testThreadID), false);
      });

      it('should return true when thread is locked', () => {
        prefixModule.prefixLocks[testThreadID] = true;
        assert.equal(prefixModule.isLocked(testThreadID), true);
      });
    });

    describe('detectLang()', () => {
      it('should return "en" when language is not set to "fr"', () => {
        assert.equal(prefixModule.detectLang(testThreadID), 'en');
      });

      it('should return "fr" when language is set to "fr"', () => {
        global.GoatBot.config.language = 'fr';
        assert.equal(prefixModule.detectLang(testThreadID), 'fr');
      });
    });
  });

  describe('generatePrefixCard()', () => {
    it('should generate a buffer without errors', async () => {
      const buffer = await prefixModule.generatePrefixCard('!', '?', {
        prevPrefix: 'old',
        history: ['hist1', 'hist2'],
        locked: false,
        phase: 'normal',
        lang: 'en'
      });
      assert.ok(Buffer.isBuffer(buffer));
    });

    it('should handle different phases', async () => {
      const phases = ['normal', 'pending', 'confirmed'];
      for (const phase of phases) {
        const buffer = await prefixModule.generatePrefixCard('!', '?', { phase, lang: 'en' });
        assert.ok(Buffer.isBuffer(buffer));
      }
    });

    it('should handle different languages', async () => {
      const languages = ['en', 'fr'];
      for (const lang of languages) {
        const buffer = await prefixModule.generatePrefixCard('!', '?', { lang });
        assert.ok(Buffer.isBuffer(buffer));
      }
    });
  });

  describe('sendCard()', () => {
    it('should send message with attachment when image generation succeeds', async () => {
      const testFile = path.join(__dirname, 'test_send_card.png');
      sandbox.stub(prefixModule, 'generatePrefixCard').resolves(Buffer.from('test'));
      sandbox.stub(fs, 'writeFileSync');
      sandbox.stub(fs, 'unlinkSync');
      sandbox.stub(fs, 'createReadStream').returns('test-stream');

      await prefixModule.sendCard(messageStub, '!', '?', { lang: 'en' });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.deepEqual(replyArg, {
        body: "╭─────────────•┈┈\n│ 🦔 HEDGEHOG — PREFIX\n├─────────────•┈┈\n│ 🌐 System : !\n│ 💬 Chat   : ?\n╰─────────────•┈┈",
        attachment: 'test-stream'
      });

      fs.unlinkSync(testFile);
    });

    it('should send text message when image generation fails', async () => {
      sandbox.stub(prefixModule, 'generatePrefixCard').rejects(new Error('test error'));

      await prefixModule.sendCard(messageStub, '!', '?', { lang: 'en' });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.equal(replyArg, "╭─────────────•┈┈\n│ 🦔 HEDGEHOG — PREFIX\n├─────────────•┈┈\n│ 🌐 System : !\n│ 💬 Chat   : ?\n╰─────────────•┈┈");
    });
  });

  describe('onStart()', () => {
    it('should show current prefix when no args provided', async () => {
      const event = {
        senderID: testUserID,
        threadID: testThreadID,
        isGroup: true
      };

      await prefixModule.onStart({
        message: messageStub,
        role: 0,
        args: [],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(messageStub.reply.calledOnce);
    });

    it('should show history when "history" command is used', async () => {
      const event = {
        senderID: testUserID,
        threadID: testThreadID,
        isGroup: true
      };

      prefixModule.addHistory(testThreadID, 'prefix1');
      prefixModule.addHistory(testThreadID, 'prefix2');

      await prefixModule.onStart({
        message: messageStub,
        role: 0,
        args: ['history'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, 'RECENT PREFIX HISTORY');
      assert.include(replyArg, '1. prefix2');
      assert.include(replyArg, '2. prefix1');
    });

    it('should show error when trying to restore without admin role', async () => {
      const event = {
        senderID: testUserID,
        threadID: testThreadID,
        isGroup: true
      };

      prefixModule.addHistory(testThreadID, 'prefix1');

      await prefixModule.onStart({
        message: messageStub,
        role: 0,
        args: ['restore', '1'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, '🚫 Only admins can do this.');
    });

    it('should restore prefix from history when admin', async () => {
      const event = {
        senderID: testAdminID,
        threadID: testThreadID,
        isGroup: true
      };

      prefixModule.addHistory(testThreadID, 'prefix1');
      prefixModule.addHistory(testThreadID, 'prefix2');

      await prefixModule.onStart({
        message: messageStub,
        role: 1,
        args: ['restore', '1'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(threadsDataStub.set.calledOnce);
      assert.ok(messageStub.reply.calledOnce);
    });

    it('should show error when trying to list without super admin role', async () => {
      const event = {
        senderID: testAdminID,
        threadID: testThreadID,
        isGroup: true
      };

      await prefixModule.onStart({
        message: messageStub,
        role: 1,
        args: ['list'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, '🚫 Only admins can do this.');
    });

    it('should list custom prefixes when super admin', async () => {
      const event = {
        senderID: testSuperAdminID,
        threadID: testThreadID,
        isGroup: true
      };

      global.GoatBot.threadData = {
        '123456789': { data: { prefix: 'custom1' } },
        '987654321': { data: { prefix: 'custom2' } }
      };

      await prefixModule.onStart({
        message: messageStub,
        role: 2,
        args: ['list'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, 'CUSTOM PREFIX LIST');
      assert.include(replyArg, 'custom1');
      assert.include(replyArg, 'custom2');
    });

    it('should lock prefix when super admin', async () => {
      const event = {
        senderID: testSuperAdminID,
        threadID: testThreadID,
        isGroup: true
      };

      await prefixModule.onStart({
        message: messageStub,
        role: 2,
        args: ['lock'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(prefixModule.isLocked(testThreadID));
      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, '🔒 Prefix locked for this chat.');
    });

    it('should unlock prefix when super admin', async () => {
      const event = {
        senderID: testSuperAdminID,
        threadID: testThreadID,
        isGroup: true
      };

      prefixModule.prefixLocks[testThreadID] = true;

      await prefixModule.onStart({
        message: messageStub,
        role: 2,
        args: ['unlock'],
        commandName: 'prefix',
        event,
        threadsData: threadsDataStub,
        getLang: getLangStub,
        api: apiStub
      });

      assert.ok(!prefixModule.isLocked(testThreadID));
      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, '🔓 Prefix unlocked for this chat.');
    });

