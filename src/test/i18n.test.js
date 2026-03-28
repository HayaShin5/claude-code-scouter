const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { patterns: hookPatterns } = require("../../resources/claude-code-scouter.js");

const i18nDir = path.join(__dirname, "..", "..", "resources", "i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf-8"));
const ja = JSON.parse(fs.readFileSync(path.join(i18nDir, "ja.json"), "utf-8"));

// Collect all desc values from hook script (main patterns + env escalation)
function getAllDescs() {
  const descs = new Set();
  for (const level of [4, 3, 2, 1]) {
    for (const p of hookPatterns[level]) {
      descs.add(p.desc);
    }
  }
  // Environment escalation patterns
  const { envEscalation } = (() => {
    // Re-read the hook script to get envEscalation
    const scriptContent = fs.readFileSync(
      path.join(__dirname, "..", "..", "resources", "claude-code-scouter.js"),
      "utf-8"
    );
    // envEscalation is not exported, so we extract desc values manually
    const envDescs = [];
    const regex = /desc:\s*"([^"]+)".*summary:\s*"([^"]+)"/g;
    const envSection = scriptContent.slice(scriptContent.indexOf("envEscalation"));
    let match;
    while ((match = regex.exec(envSection)) !== null) {
      envDescs.push({ desc: match[1], summary: match[2] });
    }
    return { envEscalation: envDescs };
  })();
  for (const e of envEscalation) {
    descs.add(e.desc);
  }
  return descs;
}

// Collect all desc→summary mappings from hook script
function getAllDescSummaryPairs() {
  const pairs = [];
  for (const level of [4, 3, 2, 1]) {
    for (const p of hookPatterns[level]) {
      pairs.push({ desc: p.desc, summary: p.summary });
    }
  }
  return pairs;
}

// --- 5.1: Translation key coverage ---

describe("i18n key coverage", () => {
  const allDescs = getAllDescs();

  it("en.json patterns contains all hook script desc values", () => {
    for (const desc of allDescs) {
      assert.ok(
        desc in en.patterns,
        `en.json missing pattern key: "${desc}"`
      );
    }
  });

  it("ja.json patterns contains all hook script desc values", () => {
    for (const desc of allDescs) {
      assert.ok(
        desc in ja.patterns,
        `ja.json missing pattern key: "${desc}"`
      );
    }
  });

  it("en.json and ja.json have the same pattern keys", () => {
    const enKeys = Object.keys(en.patterns).sort();
    const jaKeys = Object.keys(ja.patterns).sort();
    assert.deepEqual(enKeys, jaKeys);
  });

  it("en.json and ja.json have the same ui keys", () => {
    const enKeys = Object.keys(en.ui).sort();
    const jaKeys = Object.keys(ja.ui).sort();
    assert.deepEqual(enKeys, jaKeys);
  });
});

// --- 5.2: en.json patterns match hook script summary ---

describe("en.json patterns match hook script summaries", () => {
  const pairs = getAllDescSummaryPairs();

  it("en.json pattern values match hook script summary values", () => {
    for (const { desc, summary } of pairs) {
      assert.equal(
        en.patterns[desc],
        summary,
        `en.json["${desc}"] = "${en.patterns[desc]}" but hook summary = "${summary}"`
      );
    }
  });
});

// --- 5.3: Same desc → same summary ---

describe("desc uniqueness constraint", () => {
  it("patterns with the same desc have the same summary", () => {
    const descToSummary = new Map();
    for (const level of [4, 3, 2, 1]) {
      for (const p of hookPatterns[level]) {
        if (descToSummary.has(p.desc)) {
          assert.equal(
            descToSummary.get(p.desc),
            p.summary,
            `desc "${p.desc}" has conflicting summaries: "${descToSummary.get(p.desc)}" vs "${p.summary}"`
          );
        } else {
          descToSummary.set(p.desc, p.summary);
        }
      }
    }
  });
});

// --- 5.4: Fallback behavior ---

describe("translation fallback", () => {
  // Simulate the t() function logic
  function t(translations, fallback, category, key) {
    const section = translations[category];
    if (section && key in section) {
      return section[key];
    }
    const fb = fallback[category];
    if (fb && key in fb) {
      return fb[key];
    }
    return key;
  }

  it("returns current language value when present", () => {
    const result = t(ja, en, "patterns", "sudo");
    assert.equal(result, ja.patterns["sudo"]);
  });

  it("falls back to English when key missing in current language", () => {
    const jaPartial = { patterns: {}, ui: {} };
    const result = t(jaPartial, en, "patterns", "sudo");
    assert.equal(result, en.patterns["sudo"]);
  });

  it("returns key string when missing from both languages", () => {
    const empty = { patterns: {}, ui: {} };
    const result = t(empty, empty, "patterns", "nonexistent-key");
    assert.equal(result, "nonexistent-key");
  });

  it("falls back for ui keys too", () => {
    const jaPartial = { patterns: {}, ui: {} };
    const result = t(jaPartial, en, "ui", "waiting");
    assert.equal(result, en.ui["waiting"]);
  });
});

// --- 5.5: Language resolution ---

describe("language resolution", () => {
  it("'en' setting resolves to English translations", () => {
    // Verify en.json is valid and loadable
    assert.ok(en.patterns);
    assert.ok(en.ui);
    assert.equal(en.ui.waiting, "Waiting...");
  });

  it("'ja' setting resolves to Japanese translations", () => {
    assert.ok(ja.patterns);
    assert.ok(ja.ui);
    assert.equal(ja.ui.waiting, "待機中...");
  });

  it("English and Japanese have different ui.waiting values", () => {
    assert.notEqual(en.ui.waiting, ja.ui.waiting);
  });

  it("English and Japanese have different pattern values", () => {
    assert.notEqual(en.patterns["sudo"], ja.patterns["sudo"]);
  });

  it("both translation files have required ui keys", () => {
    const requiredKeys = ["waiting", "waitingTooltip", "noCommand", "clickForDetails", "defaultSummary", "dangerWarning", "detailFormat"];
    for (const key of requiredKeys) {
      assert.ok(key in en.ui, `en.json missing ui key: "${key}"`);
      assert.ok(key in ja.ui, `ja.json missing ui key: "${key}"`);
    }
  });
});
