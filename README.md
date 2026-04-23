# atomic-codex

[Atomic VCS](https://atomic.dev) integration for [Codex](https://openai.com/codex) (OpenAI).

Automatic turn recording with AI provenance, intent tracking, and knowledge graph skills.

## What it does

- **1 session = 1 view** — a draft view is created automatically when you start a Codex session
- **Every turn records with provenance** — model, vendor, session, turn number, timing
- **Tool executions tracked** — shell commands captured in a causal decision graph
- **Intent workflow** — AGENTS.md prompt guides problem-first development with vault intents

## Install

### Quick start

```bash
git clone https://github.com/atomicdotdev/atomic-codex
cd atomic-codex
./install.sh
```

### From npm (once published)

```bash
npx atomic-codex
```

### What install does

1. **Feature flag** — enables `codex_hooks = true` in `~/.codex/config.toml`
2. **Hooks** — installs hook entries into `~/.codex/hooks.json`
3. **AGENTS.md** — must be copied to each project root manually

## Prerequisites

- [Atomic VCS](https://atomic.dev) installed and on your PATH (`atomic --version`)
- A project with an `.atomic/` repository (`atomic init`)
- [Codex](https://openai.com/codex) installed
- Hooks feature flag enabled: `[features] codex_hooks = true` in `~/.codex/config.toml`

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
4. Record changes with full AI attestation when a turn ends

You never need to run `atomic add` or `atomic record` — the hooks handle it.

## Current limitations

Codex hooks are experimental and under active development:

- `PostToolUse` currently only fires for Bash tool calls (not Write, Edit, etc.)
- No `SessionEnd` event — session cleanup relies on the next session start
- Hooks require the `codex_hooks = true` feature flag
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
| `hooks.json` | Hooks config — merged into `~/.codex/hooks.json` |
| `AGENTS.md` | Agent instructions — copy to project roots |
| `skills/atomic-vault/SKILL.md` | Vault reference (goals, intents, memory) |
| `skills/code-intelligence/SKILL.md` | Knowledge graph query patterns |
| `install.js` | Installs hooks + enables feature flag |
| `install.sh` | Development install |

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
  └── Session ends (no hook — cleanup on next session start)
```

## Uninstall

```bash
npx atomic-codex --uninstall
```

Or manually:

```bash
atomic agent disable --agent codex --global
```

AGENTS.md files in projects must be removed manually.

## License

Apache-2.0 — same as [Atomic VCS](https://github.com/atomicdotdev/atomic).
