const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { assessDanger } = require("../../resources/claude-danger-indicator.js");

describe("assessDanger", () => {
  // Lv.3: Dangerous (external, destructive, privilege escalation)
  it("sudo → Lv.3", () => {
    assert.equal(assessDanger("sudo apt-get update").level, 3);
  });
  it("rm -rf → Lv.3", () => {
    assert.equal(assessDanger("rm -rf /tmp/data").level, 3);
  });
  it("git push --force → Lv.3", () => {
    assert.equal(assessDanger("git push --force origin main").level, 3);
  });
  it("DROP TABLE → Lv.3", () => {
    assert.equal(assessDanger("DROP TABLE users").level, 3);
  });
  it("chmod 777 → Lv.3", () => {
    assert.equal(assessDanger("chmod 777 /var/www").level, 3);
  });
  it("dd → Lv.3", () => {
    assert.equal(assessDanger("dd if=/dev/zero of=/dev/sda").level, 3);
  });
  it("git push → Lv.3", () => {
    assert.equal(assessDanger("git push origin main").level, 3);
  });
  it("curl -X POST → Lv.3", () => {
    assert.equal(assessDanger("curl -X POST https://api.example.com").level, 3);
  });
  it("npm publish → Lv.3", () => {
    assert.equal(assessDanger("npm publish").level, 3);
  });
  it("gh pr create → Lv.3", () => {
    assert.equal(assessDanger("gh pr create --title test").level, 3);
  });
  it("ssh → Lv.3", () => {
    assert.equal(assessDanger("ssh user@host").level, 3);
  });

  // Lv.2: Caution (local irreversible, process ops)
  it("rm (simple) → Lv.2", () => {
    assert.equal(assessDanger("rm temp.log").level, 2);
  });
  it("kill → Lv.2", () => {
    assert.equal(assessDanger("kill 1234").level, 2);
  });
  it("npm install → Lv.2", () => {
    assert.equal(assessDanger("npm install express").level, 2);
  });
  it("git reset → Lv.2", () => {
    assert.equal(assessDanger("git reset HEAD~1").level, 2);
  });
  it("brew install → Lv.2", () => {
    assert.equal(assessDanger("brew install jq").level, 2);
  });

  // Lv.1: Safe (read-only)
  it("cat → Lv.1", () => {
    assert.equal(assessDanger("cat README.md").level, 1);
  });
  it("ls → Lv.1", () => {
    assert.equal(assessDanger("ls -la").level, 1);
  });
  it("grep → Lv.1", () => {
    assert.equal(assessDanger("grep -r TODO .").level, 1);
  });
  it("git status → Lv.1", () => {
    assert.equal(assessDanger("git status").level, 1);
  });
  it("git log → Lv.1", () => {
    assert.equal(assessDanger("git log --oneline").level, 1);
  });
  it("pwd → Lv.1", () => {
    assert.equal(assessDanger("pwd").level, 1);
  });

  // Lv.2: Default (unknown commands)
  it("unknown command → Lv.2", () => {
    assert.equal(assessDanger("mycustomtool --flag").level, 2);
  });
  it("unknown command matchedPattern is null", () => {
    assert.equal(assessDanger("mycustomtool").matchedPattern, null);
  });

  // Priority: higher level wins
  it("rm -rf prioritized over rm (Lv.3 > Lv.2)", () => {
    assert.equal(assessDanger("rm -rf /tmp").level, 3);
  });
  it("git push --force prioritized over git push (both Lv.3)", () => {
    assert.equal(assessDanger("git push --force").level, 3);
  });

  // matchedPattern is recorded
  it("matched pattern is recorded", () => {
    const result = assessDanger("rm temp.log");
    assert.equal(result.matchedPattern, "rm");
  });
});
