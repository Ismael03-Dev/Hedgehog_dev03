const assert = require('assert');
const sinon = require('sinon');
const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const balanceModule = require('./balance');

describe('Balance Module', () => {
  let sandbox;
  let messageStub;
  let apiStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    messageStub = {
      reply: sandbox.stub().resolves({})
    };

    apiStub = {
      getUserInfo: sandbox.stub().callsFake((uid, callback) => {
        callback(null, {
          [uid]: {
            name: `Test User ${uid}`,
            thumbSrc: `https://graph.facebook.com/${uid}/picture?width=200&height=200`
          }
        });
      })
    };

    // Mock axios
    sandbox.stub(axios, 'get').callsFake(async (url) => {
      if (url.includes('cash-api-five.vercel.app')) {
        return {
          data: {
            success: true,
            data: { cash: '1000000' }
          }
        };
      } else if (url.includes('hedgehog-bank-api.vercel.app')) {
        return {
          data: {
            success: true,
            data: {
              bank: '5000000',
              cardNumber: '4532 **** **** 5772',
              cardExpiry: '12/28'
            }
          }
        };
      } else if (url.includes('numbers-conversion.vercel.app')) {
        return {
          data: {
            success: true,
            formatted: '1.0M'
          }
        };
      }
      throw new Error('Unexpected API call');
    });

    // Mock fs
    sandbox.stub(fs, 'writeFileSync');
    sandbox.stub(fs, 'unlinkSync');
    sandbox.stub(fs, 'createReadStream').returns('mock-stream');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Helper Functions', () => {
    describe('toBigInt()', () => {
      it('should convert bigint to bigint', () => {
        assert.equal(balanceModule.toBigInt(100n), 100n);
      });

      it('should convert string to bigint', () => {
        assert.equal(balanceModule.toBigInt('100'), 100n);
      });

      it('should convert number to bigint', () => {
        assert.equal(balanceModule.toBigInt(100), 100n);
      });

      it('should handle decimal numbers', () => {
        assert.equal(balanceModule.toBigInt('100.50'), 100n);
      });

      it('should return 0n for null/undefined', () => {
        assert.equal(balanceModule.toBigInt(null), 0n);
        assert.equal(balanceModule.toBigInt(undefined), 0n);
      });

      it('should return 0n for invalid values', () => {
        assert.equal(balanceModule.toBigInt('abc'), 0n);
      });
    });

    describe('formatNumber()', () => {
      it('should format small numbers with spaces', async () => {
        const result = await balanceModule.formatNumber(1000);
        assert.equal(result, '1 000');
      });

      it('should format large numbers with suffixes', async () => {
        const result = await balanceModule.formatNumber(1000000);
        assert.equal(result, '1.0M');
      });

      it('should handle very large numbers', async () => {
        const result = await balanceModule.formatNumber(balanceModule.MAX_LIMIT - 1n);
        assert.equal(result, '∞');
      });

      it('should return "0" for zero', async () => {
        const result = await balanceModule.formatNumber(0);
        assert.equal(result, '0');
      });

      it('should handle negative numbers', async () => {
        const result = await balanceModule.formatNumber(-1000000);
        assert.equal(result, '-1.0M');
      });
    });

    describe('getUserCash()', () => {
      it('should return user cash as bigint', async () => {
        const result = await balanceModule.getUserCash('123');
        assert.equal(result, 1000000n);
      });

      it('should return 0n when API fails', async () => {
        axios.get.restore();
        sandbox.stub(axios, 'get').rejects(new Error('API failure'));
        const result = await balanceModule.getUserCash('123');
        assert.equal(result, 0n);
      });

      it('should return MAX_LIMIT when cash exceeds limit', async () => {
        axios.get.restore();
        sandbox.stub(axios, 'get').resolves({
          data: {
            success: true,
            data: { cash: balanceModule.MAX_LIMIT.toString() }
          }
        });
        const result = await balanceModule.getUserCash('123');
        assert.equal(result, balanceModule.MAX_LIMIT);
      });
    });

    describe('getUserBankData()', () => {
      it('should return bank data', async () => {
        const result = await balanceModule.getUserBankData('123');
        assert.equal(result.bank, 5000000n);
        assert.equal(result.cardNumber, '4532 **** **** 5772');
        assert.equal(result.cardExpiry, '12/28');
      });

      it('should return default values when API fails', async () => {
        axios.get.restore();
        sandbox.stub(axios, 'get').rejects(new Error('API failure'));
        const result = await balanceModule.getUserBankData('123');
        assert.equal(result.bank, 0n);
        assert.equal(result.cardNumber, null);
        assert.equal(result.cardExpiry, null);
      });

      it('should return MAX_LIMIT when bank exceeds limit', async () => {
        axios.get.restore();
        sandbox.stub(axios, 'get').resolves({
          data: {
            success: true,
            data: { bank: balanceModule.MAX_LIMIT.toString() }
          }
        });
        const result = await balanceModule.getUserBankData('123');
        assert.equal(result.bank, balanceModule.MAX_LIMIT);
      });
    });

    describe('getUserInfo()', () => {
      it('should return user info from API', async () => {
        const result = await balanceModule.getUserInfo('123', apiStub);
        assert.equal(result.name, 'Test User 123');
        assert.equal(result.thumbSrc, 'https://graph.facebook.com/123/picture?width=200&height=200');
      });

      it('should return fallback info when API fails', async () => {
        apiStub.getUserInfo.callsFake((uid, callback) => {
          callback(new Error('API failure'), null);
        });
        const result = await balanceModule.getUserInfo('123', apiStub);
        assert.equal(result.name, 'User_00123');
        assert.equal(result.thumbSrc, null);
      });
    });

    describe('getAvatarUrl()', () => {
      it('should return avatar URL from user info', async () => {
        const result = await balanceModule.getAvatarUrl('123', apiStub);
        assert.equal(result, 'https://graph.facebook.com/123/picture?width=200&height=200');
      });

      it('should return fallback URL when user info fails', async () => {
        apiStub.getUserInfo.callsFake((uid, callback) => {
          callback(new Error('API failure'), null);
        });
        const result = await balanceModule.getAvatarUrl('123', apiStub);
        assert.equal(result, 'https://graph.facebook.com/123/picture?width=200&height=200');
      });
    });

    describe('formatStyledMessage()', () => {
      it('should format message with box style', () => {
        const result = balanceModule.formatStyledMessage(['Line 1', 'Line 2']);
        assert.equal(result, '╭─────────────•┈┈\n│ Line 1\n│ Line 2\n╰─────────────•┈┈');
      });
    });
  });

  describe('generatePremiumBalanceCard()', () => {
    it('should generate a buffer without errors', async () => {
      const userInfo = { name: 'Test User', id: '123' };
      const bankData = { bank: 1000000n, cardNumber: '4532 **** **** 5772', cardExpiry: '12/28' };
      const cashMoney = 500000n;

      // Mock loadImage to avoid actual image loading
      sandbox.stub(loadImage, 'bind').returns(() => Promise.resolve({}));

      const result = await balanceModule.generatePremiumBalanceCard(userInfo, bankData, cashMoney, apiStub);
      assert.ok(Buffer.isBuffer(result));
    });
  });

  describe('onStart()', () => {
    it('should show balance for current user when no mention', async () => {
      const event = {
        senderID: '123',
        mentions: {}
      };

      await balanceModule.onStart({ message: messageStub, event, api: apiStub });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg.body, 'Test User 123');
      assert.include(replyArg.body, 'POCHE: 1.0M$');
      assert.include(replyArg.body, 'BANQUE: 5.0M$');
    });

    it('should show balance for mentioned users', async () => {
      const event = {
        senderID: '123',
        mentions: {
          '456': 'User 456'
        }
      };

      await balanceModule.onStart({ message: messageStub, event, api: apiStub });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg.body, 'User 456');
      assert.include(replyArg.body, 'POCHE: 1.0M$');
    });

    it('should handle API errors gracefully', async () => {
      axios.get.restore();
      sandbox.stub(axios, 'get').rejects(new Error('API failure'));

      const event = {
        senderID: '123',
        mentions: {}
      };

      await balanceModule.onStart({ message: messageStub, event, api: apiStub });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg, '❌ Erreur lors de la récupération');
    });

    it('should handle very large numbers correctly', async () => {
      axios.get.restore();
      sandbox.stub(axios, 'get').callsFake(async (url) => {
        if (url.includes('cash-api-five.vercel.app')) {
          return {
            data: {
              success: true,
              data: { cash: balanceModule.MAX_LIMIT.toString() }
            }
          };
        } else if (url.includes('hedgehog-bank-api.vercel.app')) {
          return {
            data: {
              success: true,
              data: { bank: balanceModule.MAX_LIMIT.toString() }
            }
          };
        }
        return { data: { success: true, formatted: '∞' } };
      });

      const event = {
        senderID: '123',
        mentions: {}
      };

      await balanceModule.onStart({ message: messageStub, event, api: apiStub });

      assert.ok(messageStub.reply.calledOnce);
      const replyArg = messageStub.reply.firstCall.args[0];
      assert.include(replyArg.body, 'TOTAL: ∞$');
    });
  });
});