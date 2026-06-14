Here's the corrected code:

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
});