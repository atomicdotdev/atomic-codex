# atomic-codex

[Atomic VCS](https://atomic.dev) integration for [Codex](https://openai.com/codex) (OpenAI).

Automatic turn recording with AI provenance, intent tracking, and knowledge graph skills.

> **Definitive source:** this repository lives on Atomic storage at `https://atomic.atomic.storage/workspaces/oss/projects/atomic-codex/code`. The GitHub repo is a mirror.

## What it does

- **1 session = 1 view** — a draft view is created automatically when you start a Codex session
- **Every turn records with provenance** — model, vendor, session, turn number, timing
- **Tool executions tracked** — shell commands, file edits, MCP calls, and other supported local tools are captured in a causal decision graph
- **Conforming intent workflow** — each turn uses a directive-based intent with a mandatory `why`, validation, and attestation
- **Durable memory workflow** — decisions, lessons, constraints, preferences, and context are signed and linked to their source

## Install

### Quick start

Requires the [Atomic VCS](https://atomic.dev) CLI on your PATH. Then:

```bash
atomic agent enable --agent codex
```

The enable command syncs the package from Atomic storage and installs it.

### Development install

From a local checkout:

```bash
git clone https://github.com/atomicdotdev/atomic-codex
cd atomic-codex
atomic agent enable --agent codex --from .

# or the legacy script path:
./install.sh
```

### What install does

1. **Hooks** — registers the six hooks from `hooks/codex.atomic-hooks.json` into `~/.codex/hooks.json`. The hook definitions live in this repo, so updating Codex's hook wiring never requires rebuilding `atomic`.
2. **Skills & AGENTS.md** — installs 4 skills into `~/.codex/skills/` and `AGENTS.md` into `~/.codex/AGENTS.md`. The legacy development scripts use symlinks instead. `AGENTS.md` is still copied per-project for repo-local context.

[`Codex hooks`](https://developers.openai.com/codex/hooks) are stable and
enabled by default in current releases. The legacy
`install.js`/`install.sh` path still writes `[features] hooks = true` for
compatibility with older experimental Codex builds.

Codex asks you to review new or changed non-managed hooks before they run. Open
`/hooks` once after install, inspect the Atomic commands, and trust them.

## Prerequisites

- [Atomic VCS](https://atomic.dev) 0.13.0 or newer, installed and on your PATH (`atomic --version`)
- A project with an `.atomic/` repository (`atomic init`)
- A current [Codex](https://openai.com/codex) release with stable hooks installed

## Usage

```bash
cd my-project
atomic init                                       # if not already an atomic repo
cp /path/to/atomic-codex/AGENTS.md .              # add agent instructions
codex                                             # start Codex — hooks activate automatically
```

The hooks automatically:

1. Create a draft view when the session starts
2. Track your prompt and model info
3. Record supported local tool executions in a provenance graph
4. Record changes with full AI attestation when a turn ends
5. Finalize the session attestation and lifecycle state when the session ends, leaving the agent view selected for review

The installed agent instructions also guide each turn through `atomic intent new`,
`attest`, `validate`, `verify`, and high-signal durable-memory capture with
`/decision-record`.

You never need to run `atomic add` or `atomic record` — the hooks handle it.

## Current limitations

- Pre/Post tool provenance covers the local tool paths supported by Codex, including shell commands, `apply_patch`, MCP calls, and other local function tools; hosted tools such as web search do not emit these hooks
- Codex caps `SessionEnd` hooks at three seconds, so Atomic hands finalization to a short-lived background worker
- Token, cost, reasoning, and todo fields are only recorded when Codex exposes them in its hook payload or transcript
- The hook guard currently expects Codex to invoke hooks from the repository root or an Atomic sandbox marker
- Windows support is temporarily disabled

## Viewing provenance

```bash
# Show the change, inline AI metadata, and causal decision ledger
atomic change <hash>

# Emit machine-readable change metadata, including embedded provenance
atomic change <hash> -f json

# Project the captured ledger as a human-readable W3C PROV trace
atomic provenance trace <hash>

# Show session-level attestations
atomic agent attest
```

## What's in the package

| File | Purpose |
|------|---------|
| `hooks/codex.atomic-hooks.json` | Hook manifest (source of truth) — merged into `~/.codex/hooks.json` by `atomic agent enable --hooks` |
| `AGENTS.md` | Agent instructions — installed at `~/.codex/AGENTS.md`; legacy scripts symlink it, and projects can keep a repo-local copy |
| `skills/atomic-vault/SKILL.md` | Vault reference (goals, intents, memory) |
| `skills/atomic-vcs/SKILL.md` | VCS inspection (status, log, change, provenance, diff) |
| `skills/code-intelligence/SKILL.md` | Knowledge graph query patterns |
| `skills/decision-record/SKILL.md` | Durable-memory classification, signing, and source-linking workflow |
| `install.js` | Enables the feature flag, registers hooks via `atomic agent enable --hooks`, symlinks skills + AGENTS.md |
| `install.sh` | Development install (same steps) |

## How hooks work

Codex reads hooks from `.codex/hooks.json`. The Atomic hooks call back to `atomic agent hooks codex <verb>`:

```
Codex session start
  │
  ├── SessionStart → Rust creates haikunator-named draft view
  │
  ├── User sends prompt
  │   ├── UserPromptSubmit → Rust saves prompt + model on session
  │   ├── Agent works (supported local tools)
  │   │   ├── PreToolUse → Rust starts a provenance node
  │   │   └── PostToolUse → Rust completes the provenance node
  │   └── Turn ends
  │       └── Stop --foreground → Rust adds files and records the change
  │
  ├── User sends another prompt → repeat
  │
  └── SessionEnd (3-second hook)
      └── Rust hands finalization to a short-lived background worker
```

## Uninstall

```bash
atomic agent disable --agent codex
```

Or manually:

```bash
atomic agent disable --hooks /path/to/atomic-codex/hooks/codex.atomic-hooks.json
```

Any `[features] hooks = true` flag written by the legacy installer and any
`AGENTS.md` copied into projects must be removed manually.

## License

Apache-2.0 — same as [Atomic VCS](https://github.com/atomicdotdev/atomic).
