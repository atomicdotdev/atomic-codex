#!/usr/bin/env node

/**
 * atomic-codex install
 *
 * Installs Atomic hooks into ~/.codex/hooks.json and enables the feature flag.
 *
 * Usage:
 *   npx atomic-codex            # install from npm
 *   node install.js             # install from local checkout
 *   node install.js --silent    # postinstall
 *   node install.js --uninstall # remove hooks
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const silent = process.argv.includes("--silent");
const uninstall = process.argv.includes("--uninstall");

const PKG_DIR = __dirname;
const CODEX_DIR = path.join(os.homedir(), ".codex");
const HOOKS_TARGET = path.join(CODEX_DIR, "hooks.json");
const CONFIG_TARGET = path.join(CODEX_DIR, "config.toml");
const ATOMIC_PREFIX = "atomic agent hooks codex";

function copyDirSync(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

function tryExec(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function readHooksJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { hooks: {} };
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { hooks: {} };
  }
}

function writeHooksJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function ensureFeatureFlag() {
  if (!fs.existsSync(CODEX_DIR)) fs.mkdirSync(CODEX_DIR, { recursive: true });

  if (fs.existsSync(CONFIG_TARGET)) {
    let content = fs.readFileSync(CONFIG_TARGET, "utf8");
    // Migrate deprecated codex_hooks → hooks
    if (content.includes("codex_hooks")) {
      content = content.replace(/codex_hooks\s*=\s*true/, "hooks = true");
      fs.writeFileSync(CONFIG_TARGET, content);
      if (!silent) console.log("  config: migrated codex_hooks → hooks");
    } else if (
      !content.includes("hooks = true") &&
      !content.includes("hooks=true")
    ) {
      fs.appendFileSync(CONFIG_TARGET, "\n[features]\nhooks = true\n");
      if (!silent) console.log("  config: enabled hooks feature flag");
    }
  } else {
    fs.writeFileSync(CONFIG_TARGET, "[features]\nhooks = true\n");
    if (!silent)
      console.log("  config: created config.toml with hooks enabled");
  }
}

function doInstall() {
  // Enable feature flag
  ensureFeatureFlag();

  // Always write the correct Codex hooks directly.
  //
  // We don't rely on `atomic agent enable --agent codex --global` because:
  // 1. It may not support codex yet (falls through to a warning, exits 0)
  // 2. Even if it did, another agent's hooks (e.g. claude-code) may already
  //    be installed and need to be replaced with the codex equivalents.
  const source = readHooksJson(path.join(PKG_DIR, "hooks.json"));
  const target = readHooksJson(HOOKS_TARGET);

  if (!target.hooks) target.hooks = {};
  let added = 0;

  for (const [event, matchers] of Object.entries(source.hooks || {})) {
    if (!target.hooks[event]) target.hooks[event] = [];

    // Remove any existing Codex hooks so we can write fresh ones.
    // Only touch entries whose commands include our prefix — leave
    // hooks from other agents or other tools untouched.
    const before = target.hooks[event].length;
    target.hooks[event] = target.hooks[event].filter((m) => {
      const cmds = (m.hooks || []).map((h) => h.command || "");
      return !cmds.some((c) => c.includes(ATOMIC_PREFIX));
    });
    const removed = before - target.hooks[event].length;

    for (const matcher of matchers) {
      target.hooks[event].push(matcher);
      added++;
    }

    if (removed > 0 && !silent) {
      console.log(`  hooks: replaced ${removed} existing hook(s) for ${event}`);
    }
  }

  if (added > 0) writeHooksJson(HOOKS_TARGET, target);

  if (!silent) {
    console.log(
      `  hooks: ${added > 0 ? `merged ${added} hooks` : "already installed"}`,
    );
  }

  // Install AGENTS.md globally so all Codex sessions get Atomic instructions
  const agentsSrc = path.join(PKG_DIR, "AGENTS.md");
  const agentsDst = path.join(CODEX_DIR, "AGENTS.md");
  if (fs.existsSync(agentsSrc)) {
    fs.copyFileSync(agentsSrc, agentsDst);
    if (!silent) console.log("  agents: installed AGENTS.md");
  }

  // Install skills globally
  const skillsSrc = path.join(PKG_DIR, "skills");
  const skillsDst = path.join(CODEX_DIR, "skills");
  if (fs.existsSync(skillsSrc)) {
    copyDirSync(skillsSrc, skillsDst);
    if (!silent) console.log("  skills: installed to ~/.codex/skills/");
  }

  if (!silent) {
    console.log();
    console.log("\u2713 atomic-codex installed");
  }
}

function doUninstall() {
  const hasAtomic = tryExec("atomic --version");
  if (hasAtomic) tryExec("atomic agent disable --agent codex --global");

  if (fs.existsSync(HOOKS_TARGET)) {
    const target = readHooksJson(HOOKS_TARGET);
    let removed = 0;

    for (const event of Object.keys(target.hooks || {})) {
      const before = target.hooks[event].length;
      target.hooks[event] = target.hooks[event].filter((m) => {
        const cmds = (m.hooks || []).map((h) => h.command);
        return !cmds.some((c) => c.includes(ATOMIC_PREFIX));
      });
      removed += before - target.hooks[event].length;
      if (target.hooks[event].length === 0) delete target.hooks[event];
    }

    if (removed > 0) writeHooksJson(HOOKS_TARGET, target);
    if (!silent) console.log(`  hooks: removed ${removed} entries`);
  }

  if (!silent) {
    console.log();
    console.log("\u2713 atomic-codex uninstalled");
    console.log("  Note: AGENTS.md in projects must be removed manually.");
  }
}

function printInstructions() {
  console.log();
  console.log("  Copy AGENTS.md into your project root:");
  console.log(
    `    cp ${path.join(PKG_DIR, "AGENTS.md")} /path/to/your/project/`,
  );
  console.log();
  console.log("  Ensure hooks are enabled in ~/.codex/config.toml:");
  console.log("    [features]");
  console.log("    hooks = true");
  console.log();
}

if (uninstall) {
  doUninstall();
} else {
  doInstall();
}
