#!/usr/bin/env node

/**
 * atomic-codex install
 *
 * 1. Enables the Codex `hooks` feature flag in ~/.codex/config.toml
 * 2. Registers Atomic's hooks by delegating to
 *      atomic agent enable --hooks hooks/codex.atomic-hooks.json
 *    The manifest in this repo is the source of truth for the hook wiring, so
 *    when Codex changes its hook schema you edit the manifest and re-publish —
 *    no `atomic` rebuild. The merge engine ships with `atomic` (no extra deps).
 * 3. Symlinks AGENTS.md and the skills into ~/.codex/ (live updates on pull).
 *
 * Usage:
 *   npx atomic-codex            # install from npm
 *   node install.js             # install from local checkout
 *   node install.js --silent    # postinstall
 *   node install.js --uninstall # remove hooks + symlinks
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const silent = process.argv.includes("--silent");
const uninstall = process.argv.includes("--uninstall");

const PKG_DIR = __dirname;
const CODEX_DIR = path.join(os.homedir(), ".codex");
const CONFIG_TARGET = path.join(CODEX_DIR, "config.toml");
const MANIFEST = path.join(PKG_DIR, "hooks", "codex.atomic-hooks.json");
const SKILLS_TARGET = path.join(CODEX_DIR, "skills");
const AGENTS_SRC = path.join(PKG_DIR, "AGENTS.md");
const AGENTS_DST = path.join(CODEX_DIR, "AGENTS.md");

const SKILLS = [
  "atomic-vault",
  "atomic-vcs",
  "code-intelligence",
  "decision-record",
];

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return null;
  }
}

function hasAtomic() {
  return tryExec("atomic --version") !== null;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isOurSymlink(dstPath) {
  try {
    if (!fs.lstatSync(dstPath).isSymbolicLink()) return false;
    return fs.readlinkSync(dstPath).startsWith(PKG_DIR);
  } catch {
    return false;
  }
}

// Returns "linked" | "kept" | "missing"
function linkInto(srcPath, dstPath) {
  if (!fs.existsSync(srcPath)) return "missing";
  if (fs.existsSync(dstPath) && !isOurSymlink(dstPath)) return "kept";
  if (fs.existsSync(dstPath) || isOurSymlink(dstPath)) fs.unlinkSync(dstPath);
  ensureDir(path.dirname(dstPath));
  fs.symlinkSync(srcPath, dstPath);
  return "linked";
}

// Enable the Codex `hooks` feature flag, migrating the deprecated
// `codex_hooks` name if present. Returns a short status string.
function ensureFeatureFlag() {
  ensureDir(CODEX_DIR);

  if (!fs.existsSync(CONFIG_TARGET)) {
    fs.writeFileSync(CONFIG_TARGET, "[features]\nhooks = true\n");
    return "created config.toml";
  }

  let content = fs.readFileSync(CONFIG_TARGET, "utf8");
  if (content.includes("codex_hooks")) {
    content = content.replace(/codex_hooks\s*=\s*true/, "hooks = true");
    fs.writeFileSync(CONFIG_TARGET, content);
    return "migrated codex_hooks → hooks";
  }
  if (!content.includes("hooks = true") && !content.includes("hooks=true")) {
    fs.appendFileSync(CONFIG_TARGET, "\n[features]\nhooks = true\n");
    return "enabled hooks feature flag";
  }
  return "already enabled";
}

function doInstall() {
  // 1. Feature flag
  const configStatus = ensureFeatureFlag();
  if (!silent) console.log(`  config: ${configStatus}`);

  // 2. Hooks — delegate the merge to the atomic binary (manifest is source of truth)
  let hooksStatus;
  if (hasAtomic()) {
    const out = tryExec(`atomic agent enable --hooks "${MANIFEST}"`);
    hooksStatus =
      out !== null ? "registered via atomic agent enable" : "FAILED";
    if (!silent && out) process.stdout.write(out);
  } else {
    hooksStatus = "SKIPPED — 'atomic' not on PATH";
    if (!silent) {
      console.warn("  hooks: skipped (atomic not found on PATH)");
      console.warn(
        `         after installing Atomic, run: atomic agent enable --hooks "${MANIFEST}"`,
      );
    }
  }

  // 3. AGENTS.md + skills → symlinks
  const agentsStatus = linkInto(AGENTS_SRC, AGENTS_DST);
  let linked = 0;
  let kept = 0;
  for (const name of SKILLS) {
    const r = linkInto(
      path.join(PKG_DIR, "skills", name, "SKILL.md"),
      path.join(SKILLS_TARGET, name, "SKILL.md"),
    );
    if (r === "linked") linked++;
    else if (r === "kept") kept++;
  }

  if (!silent) {
    console.log(`  agents: AGENTS.md ${agentsStatus} → ~/.codex/AGENTS.md`);
    console.log(
      `  skills: ${linked} symlinked${kept ? `, ${kept} left as-is` : ""} → ~/.codex/skills/`,
    );
    console.log();
    console.log("\u2713 atomic-codex installed");
    console.log(`  Hooks:  ${hooksStatus} → ~/.codex/hooks.json`);
    console.log(
      `  Config: ${configStatus} (~/.codex/config.toml [features] hooks = true)`,
    );
    console.log(
      "  Skills: ~/.codex/skills/ (/atomic-vault, /atomic-vcs, /code-intelligence, /decision-record)",
    );
    console.log();
    console.log(
      "Per project: cp AGENTS.md to the repo root and run `atomic init`.",
    );
  }
}

function doUninstall() {
  // 1. Hooks — delegate removal to the atomic binary
  if (hasAtomic()) {
    const out = tryExec(`atomic agent disable --hooks "${MANIFEST}"`);
    if (!silent && out) process.stdout.write(out);
  }

  // 2. Remove our symlinks (leave user files alone)
  let removed = 0;
  if (isOurSymlink(AGENTS_DST)) {
    fs.unlinkSync(AGENTS_DST);
    removed++;
  }
  for (const name of SKILLS) {
    const dst = path.join(SKILLS_TARGET, name, "SKILL.md");
    if (isOurSymlink(dst)) {
      fs.unlinkSync(dst);
      removed++;
    }
  }

  if (!silent) {
    console.log();
    console.log(
      `\u2713 atomic-codex uninstalled (${removed} symlink(s) removed)`,
    );
    console.log(
      "  Note: the `hooks = true` flag in ~/.codex/config.toml is left in place.",
    );
    console.log(
      "  Note: AGENTS.md copied into projects must be removed manually.",
    );
  }
}

if (uninstall) {
  doUninstall();
} else {
  doInstall();
}
