#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const hooks = JSON.parse(read("hooks/codex.atomic-hooks.json"));
const guard = "test -d .atomic || test -f .atomic-sandbox && ";
const expectedCommands = {
  SessionStart: `${guard}atomic agent hooks codex session-start || true`,
  SessionEnd: `${guard}atomic agent hooks codex session-end || true`,
  UserPromptSubmit: `${guard}atomic agent hooks codex user-prompt-submit || true`,
  Stop: `${guard}atomic agent hooks codex stop --foreground || true`,
  PreToolUse: `${guard}atomic agent hooks codex pre-tool || true`,
  PostToolUse: `${guard}atomic agent hooks codex post-tool || true`,
};

assert.equal(hooks.target, "~/.codex/hooks.json");
assert.equal(hooks.hooks_key, "hooks");
assert.equal(hooks.command_prefix, "atomic agent hooks codex");
assert.deepEqual(
  Object.keys(hooks.hooks).sort(),
  Object.keys(expectedCommands).sort(),
  "the package must install all six Codex lifecycle hooks",
);

for (const [event, command] of Object.entries(expectedCommands)) {
  const groups = hooks.hooks[event];
  assert.equal(groups.length, 1, `${event} must have one hook group`);
  assert.equal(groups[0].hooks.length, 1, `${event} must have one command`);
  assert.equal(groups[0].hooks[0].command, command, `${event} command drifted`);
}

assert.equal(
  hooks.hooks.SessionEnd[0].hooks[0].timeout,
  3,
  "Codex clamps SessionEnd to three seconds",
);
assert.equal(
  hooks.hooks.SessionStart[0].hooks[0].statusMessage,
  "Atomic: tracking session",
);

const manifest = read("atomic-integration.toml");
assert.match(manifest, /^version = "1\.1\.0"$/m);
assert.match(manifest, /^atomic = ">=0\.13\.0"$/m);
assert.match(manifest, /src = "skills\/decision-record\/SKILL\.md"/);

for (const source of manifest.matchAll(/^src = "([^"]+)"$/gm)) {
  assert.ok(
    fs.existsSync(path.join(root, source[1])),
    `manifest source does not exist: ${source[1]}`,
  );
}

const agents = read("AGENTS.md");
for (const command of [
  "atomic intent new",
  "atomic intent validate",
  "atomic intent attest",
  "atomic intent verify",
  "atomic memory attest",
  "atomic memory validate",
  "atomic memory verify",
]) {
  assert.ok(agents.includes(command), `AGENTS.md is missing ${command}`);
}
assert.ok(agents.includes("/decision-record"));
assert.ok(agents.includes("status=unmet` → `status=done"));
assert.match(
  agents,
  /atomic intent attest <ID>[\s\S]{0,180}atomic intent validate <ID>[\s\S]{0,180}atomic intent verify <ID>/,
);
assert.doesNotMatch(
  agents,
  /```bash\s*atomic vault intent create/,
  "AGENTS.md must not instruct Codex to create a legacy intent",
);

const installerJs = read("install.js");
const installerSh = read("install.sh");
assert.ok(installerJs.includes('"decision-record"'));
assert.match(installerSh, /atomic-vault atomic-vcs code-intelligence decision-record/);

const readme = read("README.md");
assert.doesNotMatch(readme, /No `SessionEnd` event/);
assert.doesNotMatch(readme, /only fires for Bash/);
assert.ok(readme.includes("Stop --foreground"));
assert.ok(readme.includes("enabled by default"));
assert.ok(readme.includes("`apply_patch`, MCP calls"));
assert.ok(readme.includes("Open\n`/hooks` once after install"));

const userDocs = [
  readme,
  agents,
  read("skills/atomic-vcs/SKILL.md"),
  read("skills/atomic-vault/SKILL.md"),
  read("skills/code-intelligence/SKILL.md"),
  read("skills/decision-record/SKILL.md"),
].join("\n");
assert.doesNotMatch(
  userDocs,
  /atomic change[^\n`]*\s-(?:a|p)(?:\s|`|$)/,
  "Atomic 0.13 removed the legacy change -a/-p flags",
);
assert.doesNotMatch(
  userDocs,
  /atomic vault query/,
  "new documentation should use the canonical atomic query command",
);
assert.doesNotMatch(userDocs, /`planned` → `in-progress`/);
assert.ok(
  userDocs.includes("`backlog` → `todo` → `in_progress` → `done`"),
);
assert.ok(userDocs.includes("atomic provenance trace"));

const atomicBin = process.env.ATOMIC_BIN;
if (atomicBin) {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "atomic-codex-contract-"),
  );
  try {
    const integrationsHome = path.join(tempRoot, "integration-state");
    const atomicEnv = {
      ...process.env,
      ATOMIC_INTEGRATIONS_HOME: integrationsHome,
    };
    const target = path.join(tempRoot, "hooks.json");
    const tempManifest = path.join(tempRoot, "codex.atomic-hooks.json");
    const userCommand = "echo user-owned-hook";
    fs.writeFileSync(
      target,
      JSON.stringify({
        customSetting: true,
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: userCommand }] }],
        },
      }),
    );
    fs.writeFileSync(
      tempManifest,
      JSON.stringify({ ...hooks, target }),
    );

    const runAtomicAt = (cwd, ...args) => {
      const result = childProcess.spawnSync(atomicBin, args, {
        cwd,
        env: atomicEnv,
        encoding: "utf8",
      });
      assert.equal(
        result.status,
        0,
        `${atomicBin} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
      );
      return result;
    };
    const runAtomic = (...args) => runAtomicAt(tempRoot, ...args);
    const runHookAt = (cwd, verb, payload, ...args) => {
      const result = childProcess.spawnSync(
        atomicBin,
        ["agent", "hooks", "codex", verb, ...args],
        {
          cwd,
          env: atomicEnv,
          input: JSON.stringify(payload),
          encoding: "utf8",
        },
      );
      assert.equal(
        result.status,
        0,
        `Codex ${verb} hook failed:\n${result.stdout}\n${result.stderr}`,
      );
      return result;
    };

    for (const args of [
      ["change", "--help"],
      ["provenance", "trace", "--help"],
      ["provenance", "show", "--help"],
      ["agent", "attest", "--help"],
      ["query", "code", "--help"],
    ]) {
      runAtomic(...args);
    }

    runAtomic("agent", "enable", "--hooks", tempManifest);
    const installed = JSON.parse(fs.readFileSync(target, "utf8"));
    assert.equal(installed.customSetting, true);
    assert.ok(
      installed.hooks.Stop.some((group) =>
        group.hooks.some((hook) => hook.command === userCommand),
      ),
      "install must preserve user-owned hooks",
    );
    for (const command of Object.values(expectedCommands)) {
      assert.ok(
        Object.values(installed.hooks).some((groups) =>
          groups.some((group) =>
            group.hooks.some((hook) => hook.command === command),
          ),
        ),
        `installed settings are missing ${command}`,
      );
    }
    assert.equal(installed.hooks.SessionEnd[0].hooks[0].timeout, 3);

    runAtomic("agent", "disable", "--hooks", tempManifest);
    const uninstalled = JSON.parse(fs.readFileSync(target, "utf8"));
    assert.equal(uninstalled.customSetting, true);
    assert.ok(
      uninstalled.hooks.Stop.some((group) =>
        group.hooks.some((hook) => hook.command === userCommand),
      ),
      "uninstall must preserve user-owned hooks",
    );
    assert.ok(
      !JSON.stringify(uninstalled).includes("atomic agent hooks codex"),
      "uninstall must remove only Atomic's Codex hooks",
    );

    // Exercise the same data-driven package installer used by
    // `atomic agent enable --agent codex`, but rewrite all destinations into
    // this temporary directory so the test cannot touch a real Codex setup.
    const packageCopy = path.join(tempRoot, "package");
    fs.cpSync(root, packageCopy, {
      recursive: true,
      filter: (source) => {
        const parts = path.relative(root, source).split(path.sep);
        return !parts.includes(".git") && !parts.includes("node_modules");
      },
    });

    const installedCodex = path.join(tempRoot, "installed", ".codex");
    const tomlPath = installedCodex.replaceAll("\\", "\\\\");
    const packageManifestPath = path.join(
      packageCopy,
      "atomic-integration.toml",
    );
    fs.writeFileSync(
      packageManifestPath,
      fs
        .readFileSync(packageManifestPath, "utf8")
        .replaceAll("~/.codex/", `${tomlPath}/`),
    );

    fs.mkdirSync(installedCodex, { recursive: true });
    const installedHooksPath = path.join(installedCodex, "hooks.json");
    fs.writeFileSync(
      installedHooksPath,
      JSON.stringify({
        customSetting: true,
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: userCommand }] }],
        },
      }),
    );
    const packageHooksPath = path.join(
      packageCopy,
      "hooks",
      "codex.atomic-hooks.json",
    );
    fs.writeFileSync(
      packageHooksPath,
      JSON.stringify({ ...hooks, target: installedHooksPath }),
    );

    const repo = path.join(tempRoot, "repo");
    fs.mkdirSync(repo);
    runAtomicAt(repo, "init", "--no-vault");
    const enable = runAtomicAt(
      repo,
      "agent",
      "enable",
      "--agent",
      "codex",
      "--from",
      packageCopy,
    );
    assert.match(enable.stdout, /Installed Codex integration v1\.1\.0/);

    const installedFiles = [
      "AGENTS.md",
      "skills/atomic-vault/SKILL.md",
      "skills/atomic-vcs/SKILL.md",
      "skills/code-intelligence/SKILL.md",
      "skills/decision-record/SKILL.md",
    ];
    for (const relativePath of installedFiles) {
      assert.equal(
        fs.readFileSync(path.join(installedCodex, relativePath), "utf8"),
        read(relativePath),
        `package install drifted for ${relativePath}`,
      );
    }
    assert.ok(
      !fs.existsSync(path.join(installedCodex, "config.toml")),
      "the data-driven installer must not rewrite Codex config.toml",
    );

    const packageInstalledHooks = JSON.parse(
      fs.readFileSync(installedHooksPath, "utf8"),
    );
    assert.equal(packageInstalledHooks.customSetting, true);
    for (const command of Object.values(expectedCommands)) {
      assert.ok(
        Object.values(packageInstalledHooks.hooks).some((groups) =>
          groups.some((group) =>
            group.hooks.some((hook) => hook.command === command),
          ),
        ),
        `package install is missing ${command}`,
      );
    }

    const receiptPath = path.join(
      integrationsHome,
      "codex",
      "receipt.json",
    );
    const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    assert.equal(receipt.version, "1.1.0");
    assert.equal(receipt.files.length, installedFiles.length);
    assert.equal(receipt.settings[0].target, installedHooksPath);

    runAtomicAt(repo, "agent", "disable", "--agent", "codex");
    for (const relativePath of installedFiles) {
      assert.ok(
        !fs.existsSync(path.join(installedCodex, relativePath)),
        `package uninstall left ${relativePath}`,
      );
    }
    const packageUninstalledHooks = JSON.parse(
      fs.readFileSync(installedHooksPath, "utf8"),
    );
    assert.equal(packageUninstalledHooks.customSetting, true);
    assert.ok(JSON.stringify(packageUninstalledHooks).includes(userCommand));
    assert.ok(
      !JSON.stringify(packageUninstalledHooks).includes(
        "atomic agent hooks codex",
      ),
    );
    assert.ok(!fs.existsSync(receiptPath));

    // Replay a real Codex turn through the current Atomic binary. This proves
    // that a non-Bash tool reaches the decision ledger, Stop records in the
    // foreground, and the manifest's background SessionEnd path finalizes the
    // attestation while leaving the working copy on the reviewable agent view.
    const sessionId = "atomic-codex-contract-session";
    const commonHookInput = {
      session_id: sessionId,
      cwd: repo,
      model: "gpt-5.6-codex",
    };
    runHookAt(repo, "session-start", {
      ...commonHookInput,
      hook_event_name: "SessionStart",
      source: "startup",
    });
    runHookAt(repo, "user-prompt-submit", {
      ...commonHookInput,
      hook_event_name: "UserPromptSubmit",
      prompt: "Create a lifecycle contract fixture",
    });
    runHookAt(repo, "pre-tool", {
      ...commonHookInput,
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_use_id: "tool-call-1",
      tool_input: { command: "add lifecycle.txt" },
    });
    fs.writeFileSync(
      path.join(repo, "lifecycle.txt"),
      "recorded through the Codex lifecycle\n",
    );
    runHookAt(repo, "post-tool", {
      ...commonHookInput,
      hook_event_name: "PostToolUse",
      tool_name: "apply_patch",
      tool_use_id: "tool-call-1",
      tool_input: { command: "add lifecycle.txt" },
      tool_response: {
        output: "Done!",
        success: true,
        duration_ms: 12,
      },
    });
    const stop = runHookAt(
      repo,
      "stop",
      {
        ...commonHookInput,
        hook_event_name: "Stop",
        last_assistant_message: "Lifecycle fixture created and verified.",
      },
      "--foreground",
      "--json",
    );
    const stopResult = JSON.parse(stop.stdout.trim());
    assert.equal(stopResult.recorded, true);
    assert.ok(stopResult.change_hash);
    assert.ok(stopResult.files.includes("lifecycle.txt"));

    const changeJson = JSON.parse(
      runAtomicAt(
        repo,
        "change",
        stopResult.change_hash,
        "-f",
        "json",
      ).stdout,
    );
    assert.equal(changeJson.has_provenance, true);
    assert.equal(changeJson.provenance.model, "gpt-5.6-codex");
    assert.equal(changeJson.provenance.vendor.toLowerCase(), "openai");
    const changeText = runAtomicAt(
      repo,
      "change",
      stopResult.change_hash,
    ).stdout;
    assert.match(changeText, /=== Attestation ===/);
    assert.match(changeText, /=== Change Ledger ===/);
    assert.match(changeText, /apply_patch/);
    const provenanceTrace = runAtomicAt(
      repo,
      "provenance",
      "trace",
      stopResult.change_hash,
    ).stdout;
    assert.match(provenanceTrace, /activity urn:atomic:activity:/);
    assert.match(provenanceTrace, /agent urn:atomic:agent:codex/);

    runHookAt(repo, "session-end", {
      ...commonHookInput,
      hook_event_name: "SessionEnd",
      reason: "other",
    });

    // Give the detached writer first access to the repository before polling
    // with read-only commands; otherwise an aggressive test loop can starve
    // finalization even though a real Codex process is simply exiting.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    let finalized = false;
    let lastAttestations = "";
    let lastAttestationDetail = "";
    let lastViews = "";
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      lastAttestations = runAtomicAt(repo, "agent", "attest").stdout;
      lastViews = runAtomicAt(repo, "view", "list").stdout;
      const attestationHash = lastAttestations.match(
        /^\s+([A-Z2-7]{12})\s+/m,
      )?.[1];
      if (attestationHash) {
        lastAttestationDetail = runAtomicAt(
          repo,
          "agent",
          "attest",
          "--hash",
          attestationHash,
        ).stdout;
      }
      if (
        lastAttestationDetail.includes(sessionId) &&
        new RegExp(`^\\*\\s+${stopResult.view}\\b`, "m").test(lastViews)
      ) {
        finalized = true;
        break;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
    assert.equal(
      finalized,
      true,
      `background SessionEnd did not attest the session and retain ${stopResult.view}:\n${lastAttestations}\n${lastAttestationDetail}\n${lastViews}`,
    );

    // Execute the exact signed intent and durable-memory workflow taught by
    // AGENTS.md. This catches command-order drift and gate requirements that
    // a static documentation assertion cannot see.
    runAtomicAt(repo, "vault", "init");
    const createdIntent = runAtomicAt(
      repo,
      "intent",
      "new",
      "Validate Codex release workflow",
    ).stdout;
    const intentId = createdIntent.match(/^Created intent:\s+(.+)$/m)?.[1];
    const intentRelativePath = createdIntent.match(
      /^\s+file:\s+\.vault\/(.+)$/m,
    )?.[1];
    assert.ok(intentId && intentRelativePath, createdIntent);

    const intentPath = path.join(repo, ".vault", intentRelativePath);
    const scaffold = fs.readFileSync(intentPath, "utf8");
    const uid = scaffold.match(/^uid:\s*["']?([^"'\n]+)["']?$/m)?.[1];
    const frontmatterEnd = scaffold.indexOf("\n---\n", 4);
    assert.ok(uid && frontmatterEnd > 0, scaffold);
    const frontmatter = scaffold.slice(0, frontmatterEnd + 5);
    fs.writeFileSync(
      intentPath,
      `${frontmatter}\n:::why\nThe Codex release must teach a workflow that the current Atomic CLI accepts.\n:::\n\n:::acceptance-criterion{#${uid}-ac-1 status=met verifiedBy="validate-integration.js" evidence="signed lifecycle contract passed"}\nThe installed workflow creates a signed, conforming intent and a source-linked memory.\n:::\n\n:::task{#${uid}-1 status=done criteria=${uid}-ac-1}\nExercise intent and memory attestation.\n::file-ref{path=test/validate-integration.js}\n:::\n\n:::scope-in\nThe atomic-codex integration contract.\n:::\n\n:::scope-out\nPublishing the package to Atomic Storage.\n:::\n\n:::constraint\nRun only in a temporary repository.\n:::\n`,
    );
    runAtomicAt(repo, "vault", "sync");
    runAtomicAt(repo, "intent", "update", intentId, "--status", "done");
    runAtomicAt(repo, "vault", "sync");
    runAtomicAt(repo, "intent", "attest", intentId);
    runAtomicAt(repo, "intent", "validate", intentId);
    runAtomicAt(repo, "intent", "verify", intentId);

    const memoryText =
      "The Codex release contract must test signed intent and memory workflows against the current Atomic binary so package documentation cannot drift from the CLI.";
    const derivedFrom = [
      `urn:atomic:ac:${uid}-ac-1`,
      `urn:atomic:intent:${uid}`,
    ];
    const createdMemory = JSON.parse(
      runAtomicAt(
        repo,
        "memory",
        "new",
        "--kind",
        "decision",
        "--text",
        memoryText,
        "--derived-from",
        derivedFrom.join(","),
        "--json",
      ).stdout,
    );
    runAtomicAt(repo, "memory", "attest", createdMemory.id);
    runAtomicAt(repo, "memory", "validate", createdMemory.id);
    runAtomicAt(repo, "memory", "verify", createdMemory.id);
    const shownMemory = JSON.parse(
      runAtomicAt(
        repo,
        "memory",
        "show",
        createdMemory.id,
        "--json",
      ).stdout,
    );
    assert.equal(shownMemory.text, memoryText);
    assert.deepEqual(shownMemory.derivedFrom, derivedFrom);
    assert.ok(shownMemory.attributedTo);
    assert.ok(shownMemory.proof);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

console.log("atomic-codex integration contract: OK");
