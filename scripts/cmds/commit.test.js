Here's the unit test code for the provided file:

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas } = require("canvas");
const assert = require("assert");
const sinon = require("sinon");

describe("HedgehogGPT Utilities", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    CONFIG = {
      github: { username: "Ismael03-Dev", repo: "Hedgehog_dev03", branch: "main", token: "test_token" },
      mistral: { key: "test_mistral_key" },
      pastebin: { key: "test_pastebin_key" },
      allowed: ["61578433048588"]
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("getConfig()", () => {
    it("should return the current config", () => {
      const config = getConfig();
      assert.deepStrictEqual(config, CONFIG);
    });
  });

  describe("loadConfig()", () => {
    it("should load config from API successfully", async () => {
      const mockResponse = { data: { github: { token: "new_token" } } };
      sandbox.stub(axios, "get").resolves(mockResponse);

      const result = await loadConfig();
      assert.strictEqual(result, true);
      assert.strictEqual(CONFIG.github.token, "new_token");
    });

    it("should handle API errors", async () => {
      sandbox.stub(axios, "get").rejects(new Error("API error"));
      const result = await loadConfig();
      assert.strictEqual(result, false);
    });
  });

  describe("checkToken()", () => {
    it("should validate a good token", async () => {
      const mockResponse = {
        data: { login: "test_user" },
        headers: { "x-oauth-scopes": "repo" }
      };
      sandbox.stub(axios, "get").resolves(mockResponse);

      const result = await checkToken();
      assert.strictEqual(result.valid, true);
    });

    it("should reject invalid token", async () => {
      sandbox.stub(axios, "get").rejects({ response: { status: 401 } });
      const result = await checkToken();
      assert.strictEqual(result.valid, false);
    });
  });

  describe("UI functions", () => {
    it("should create single line frame", () => {
      const result = UI.success("test");
      assert.strictEqual(result, "╭─────────────────────•\n│ ✅ test\n╰─────────────────────•");
    });

    it("should create multi-line frame", () => {
      const result = UI.info("line1\nline2");
      assert.strictEqual(result, "╭─────────────────────•\n│ 📦 line1\n├─────────────────────•\n│ line2\n╰─────────────────────•");
    });
  });

  describe("GitHub functions", () => {
    it("should get file SHA", async () => {
      const mockResponse = { data: { sha: "test_sha" } };
      sandbox.stub(axios, "get").resolves(mockResponse);

      const result = await getFileSha("test.js");
      assert.strictEqual(result, "test_sha");
    });

    it("should get remote files", async () => {
      const mockResponse = { data: [{ name: "test.js" }] };
      sandbox.stub(axios, "get").resolves(mockResponse);

      const result = await getRemoteFiles();
      assert.deepStrictEqual(result, [{ name: "test.js" }]);
    });
  });

  describe("Pastebin functions", () => {
    it("should extract pastebin key", () => {
      const result = extractPastebinKey("https://pastebin.com/abc123");
      assert.strictEqual(result, "abc123");
    });

    it("should fetch pastebin content", async () => {
      const mockResponse = { data: "test content" };
      sandbox.stub(axios, "get").resolves(mockResponse);

      const result = await fetchPastebinContent("abc123");
      assert.strictEqual(result.content, "test content");
    });
  });

  describe("Code analysis", () => {
    it("should detect syntax errors", () => {
      const code = "require('nonexistent')\ntry {}\nmodule.exports = {}";
      const errors = detectSyntaxErrors(code);
      assert.deepStrictEqual(errors, [
        'L1: "nonexistent" non installé',
        "1 try sans catch",
        "config manquant",
        "onStart/onChat requis"
      ]);
    });

    it("should normalize file name", () => {
      assert.strictEqual(normalizeName("test"), "test.js");
      assert.strictEqual(normalizeName("test.js"), "test.js");
    });
  });

  describe("Backup functions", () => {
    beforeEach(() => {
      sandbox.stub(fs, "existsSync").returns(true);
      sandbox.stub(fs, "readFileSync").returns("{}");
      sandbox.stub(fs, "writeFileSync");
    });

    it("should load backups", () => {
      const result = loadBackups();
      assert.deepStrictEqual(result, {});
    });

    it("should save backup", () => {
      saveBackup("test.js", "test content");
      assert(fs.writeFileSync.calledOnce);
    });
  });

  describe("Diff function", () => {
    it("should calculate diff between files", () => {
      const oldCode = "line1\nline2\nline3";
      const newCode = "line1\nline4\nline5";
      const result = diffFiles(oldCode, newCode);
      assert.deepStrictEqual(result, { added: 2, removed: 2, summary: "+2 / -2 lignes" });
    });
  });

  describe("Image creation", () => {
    it("should create code image", () => {
      const code = "const test = 'value';\n// comment";
      const result = createCodeImageSync(code, "test.js");
      assert(result instanceof require("canvas").Canvas);
    });
  });
});