# atomic-codex

[Atomic VCS](https://atomic.dev) integration for [Codex](https://openai.com/codex) (OpenAI).

Automatic turn recording with AI provenance, intent tracking, and knowledge graph skills.

> **Definitive source:** this repository lives on Atomic storage at `https://atomic.atomic.storage/workspaces/oss/projects/atomic-codex/code`. The GitHub repo is a mirror.

## What it does

- **1 session = 1 view** — a draft view is created automatically when you start a Codex session
- **Every turn records with provenance** — model, vendor, session, turn number, timing
- **Tool executions tracked** — shell commands captured in a causal decision graph
- **Intent workflow** — AGENTS.md prompt guides problem-first development with vault intents

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

1. **Feature flag** — enables `[features] hooks = true` in `~/.codex/config.toml` (migrating the deprecated `codex_hooks` name if present)
2. **Hooks** — registers the hooks from `hooks/codex.atomic-hooks.json` into `~/.codex/hooks.json` by delegating to `atomic agent enable --hooks`. The hook definitions live in this repo, so updating Codex's hook wiring never requires rebuilding `atomic`.
3. **Skills & AGENTS.md** — symlinks the 3 skills into `~/.codex/skills/` and `AGENTS.md` into `~/.codex/AGENTS.md` (live updates on pull). `AGENTS.md` is still copied per-project for repo-local context.

## Prerequisites

- [Atomic VCS](https://atomic.dev) installed and on your PATH (`atomic --version`)
- A project with an `.atomic/` repository (`atomic init`)
- [Codex](https://openai.com/codex) installed
- Hooks feature flag enabled: `[features] hooks = true` in `~/.codex/config.toml`

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
3. Record shell command executions in a provenance graph
4. Record changes with provenance when a turn ends
5. Finalize the session attestation and restore the original view at session end

You never need to run `atomic add` or `atomic record` — the hooks handle it.

## Current limitations

Codex hooks are experimental and under active development:

- `PostToolUse` currently only fires for Bash tool calls (not Write, Edit, etc.)
- Codex caps `SessionEnd` hooks at 3 seconds, so Atomic hands finalization to a background worker
- Hooks require the `[features] hooks = true` feature flag
- Windows support is temporarily disabled

## Viewing provenance

```bash
# Show the causal decision graph (goals → tool calls → patch)
atomic change -p <hash>

# Show inline AI attestation (model, tokens, cost)
atomic change -a <hash>

# Show session-level attestations
atomic agent attest
```

## What's in the package

| File | Purpose |
|------|---------|
| `hooks/codex.atomic-hooks.json` | Hook manifest (source of truth) — merged into `~/.codex/hooks.json` by `atomic agent enable --hooks` |
| `AGENTS.md` | Agent instructions — symlinked to `~/.codex/AGENTS.md`, also copy to project roots |
| `skills/atomic-vault/SKILL.md` | Vault reference (goals, intents, memory) |
| `skills/atomic-vcs/SKILL.md` | VCS inspection (status, log, change `-p`/`-a`, diff) |
| `skills/code-intelligence/SKILL.md` | Knowledge graph query patterns |
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
  │   ├── Agent works (shell commands)
  │   │   └── PostToolUse[Bash] → Rust appends to provenance graph
  │   └── Turn ends
  │       └── Stop → Rust adds files, records change with provenance
  │
  ├── User sends another prompt → repeat
  │
  └── SessionEnd → Rust finalizes the attestation and restores the original view
```

## Uninstall

```bash
atomic agent disable --agent codex
```

Or manually:

```bash
atomic agent disable --hooks /path/to/atomic-codex/hooks/codex.atomic-hooks.json
```

The `[features] hooks = true` flag in `~/.codex/config.toml` and any `AGENTS.md` copied into projects must be removed manually.

## License

Apache-2.0 — same as [Atomic VCS](https://github.com/atomicdotdev/atomic).
