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
    const content = fs.readFileSync(CONFIG_TARGET, "utf8");
    if (!content.includes("codex_hooks")) {
      fs.appendFileSync(CONFIG_TARGET, "\n[features]\ncodex_hooks = true\n");
      if (!silent) console.log("  config: enabled codex_hooks feature flag");
    }
  } else {
    fs.writeFileSync(CONFIG_TARGET, "[features]\ncodex_hooks = true\n");
    if (!silent) console.log("  config: created config.toml with codex_hooks enabled");
  }
}

function doInstall() {
  // Enable feature flag
  ensureFeatureFlag();

  // Try atomic CLI first
  const hasAtomic = tryExec("atomic --version");
  if (hasAtomic) {
    const installed = tryExec("atomic agent enable --agent codex --global");
    if (!silent) {
      if (installed) {
        console.log("  hooks: installed via atomic CLI");
      } else {
        console.log("  hooks: atomic CLI install failed, trying manual merge");
      }
    }

    if (installed && fs.existsSync(HOOKS_TARGET)) {
      if (!silent) {
        console.log();
        console.log("\u2713 atomic-codex installed");
        printInstructions();
      }
      return;
    }
  }

  // Manual merge fallback
  const source = readHooksJson(path.join(PKG_DIR, "hooks.json"));
  const target = readHooksJson(HOOKS_TARGET);

  if (!target.hooks) target.hooks = {};
  let added = 0;

  for (const [event, matchers] of Object.entries(source.hooks || {})) {
    if (!target.hooks[event]) target.hooks[event] = [];
    for (const matcher of matchers) {
      const commands = (matcher.hooks || []).map((h) => h.command);
      const existing = target.hooks[event].flatMap((m) => (m.hooks || []).map((h) => h.command));
      for (const cmd of commands) {
        if (!existing.some((c) => c.includes(ATOMIC_PREFIX))) {
          target.hooks[event].push(matcher);
          added++;
          break;
        }
      }
    }
  }

  if (added > 0) writeHooksJson(HOOKS_TARGET, target);

  if (!silent) {
    console.log(`  hooks: ${added > 0 ? `merged ${added} hooks` : "already installed"}`);
    console.log();
    console.log("\u2713 atomic-codex installed");
    printInstructions();
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
  console.log(`    cp ${path.join(PKG_DIR, "AGENTS.md")} /path/to/your/project/`);
  console.log();
  console.log("  Ensure codex_hooks is enabled in ~/.codex/config.toml:");
  console.log("    [features]");
  console.log("    codex_hooks = true");
  console.log();
}

if (uninstall) {
  doUninstall();
} else {
  doInstall();
}
