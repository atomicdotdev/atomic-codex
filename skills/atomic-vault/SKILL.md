---
name: atomic-vault
description: Teaches the Atomic vault workflow for goals, intents, memory, and the development cycle.
---

# Atomic Vault Workflow

The vault is Atomic's built-in project management and context system. It tracks **goals** (work sessions), **intents** (units of work), and **memory** (persistent knowledge). Always use vault commands to stay organized.

## Core Concepts

- **Intent**: A unit of work (like a ticket). Has an ID, title, status, and a deliverable markdown file.
- **Goal**: A focused work session tied to one or more intents. Tracks what you're actively doing.
- **Memory**: Persistent knowledge entries the vault retains across sessions.

## Intent Commands

```bash
atomic intent list                              # List all intents (CHECK THIS FIRST)
atomic intent new "title"                       # Create a new intent
atomic intent show <id>                         # Show intent details
atomic intent update <id> --status <status>     # Update intent status
atomic intent link <id> --goal <goal>           # Link intent to a goal
```

### Intent Statuses

`backlog` → `todo` → `in_progress` → `done` (`icebox` is terminal work that will not be built)

### CRITICAL RULE: Always Check Before Creating

Before creating any intent, run `atomic intent list` first. Duplicate intents cause confusion and waste effort. Only create a new intent if no existing one covers the work.

## Goal Commands

```bash
atomic vault goal start "goal name"     # Start a new work session
atomic vault goal stop                  # Stop the current goal
atomic vault goal resume <name>         # Resume a suspended goal
atomic vault goal list                  # List all goals
```

### Goal Statuses

- **active** — Currently being worked on
- **suspended** — Paused (via `goal stop`), can be resumed
- **completed** — Finished

## Memory Commands

```bash
atomic vault memory list                # List all memory entries
atomic vault memory show <key>          # Show a specific memory entry
atomic vault memory write <key> "val"   # Write a memory entry
```

## The Intent File Is the Deliverable

Each intent has a markdown file at `.vault/intents/<id>/intent.md`. This file IS the deliverable — fill it in completely:

```markdown
:::why
What problem this intent solves and why it matters.
:::

:::acceptance-criterion{#proj-1-ac-1 status=unmet}
A concrete, testable outcome.
:::

:::task{#proj-1-1 status=unmet criteria=proj-1-ac-1}
A concrete work item and how it will be verified.
::file-ref{path=src/example.rs}
:::

:::scope-in
What this intent will change.
:::

:::scope-out
What this intent deliberately will not change.
:::

:::constraint
A rule the implementation must respect.
:::
```

Replace every generated HTML comment stub and placeholder file path, while preserving the directive names, IDs, and fences. Canonical rendering derives status from frontmatter; do not add a second prose `Status:` field.

After editing an intent file, run `atomic vault sync` to persist your changes to the vault database. The CLI reads `show`/`update`/`list` from the database, not the file — so sync **before** every `show` and `update`, or `show` will render the stale placeholder and `update` will re-materialize the database copy over your edits, clobbering them. (`atomic vault sync` is not `atomic record` — hooks handle recording; you still run `sync`.)

## Full Workflow (End to End)

Follow this sequence for every piece of work:

### 1. Check existing intents

```bash
atomic intent list
```

Look for an existing intent that matches your task. Do NOT create duplicates.

### 2. Create ONE intent (if needed)

```bash
atomic intent new "Implement user authentication"
```

Create exactly one intent per unit of work. Fill in the intent file at `.vault/intents/<id>/intent.md`.

### 3. Start a goal

```bash
atomic vault goal start "auth-implementation"
atomic intent link <intent-id> --goal auth-implementation
```

### 4. Do the work and check off TODOs as you go

Write code and iterate. As each task is completed, verify it meets its criteria, then mark its directive done in the intent file using your **file editing tool** (not Python, not bash, not sed — use the agent's native edit capability):

```
# In the intent file, change:
:::task{#proj-1-1 status=unmet criteria=proj-1-ac-1}
# to:
:::task{#proj-1-1 status=done criteria=proj-1-ac-1}
```

When a corresponding acceptance criterion is satisfied, change `status=unmet` to `status=met`. A canonical criterion that will be validated or attested must also carry real `verifiedBy` and `evidence` attributes. After every edit to the intent file, run `atomic vault sync` to persist to the database.

**Verify before checking off.** Run the actual commands or tests that prove the TODO is done. Do not mark a TODO complete speculatively.

**Never use Python, bash scripts, or sed to edit intent files.** Use your agent's native file editing tool. Raw file manipulation bypasses the vault's integrity guarantees.

You do **not** create or switch views, and you do **not** run `atomic add` or `atomic record` — the integration's hooks own all of that:

- **Session start** forks a draft view from your current view and switches into it automatically (a haikunator-named view, e.g. `early-ridge-ffd9`). Your whole session runs inside it.
- **Turn end** records automatically — the hook runs `status` → `add` (tracks new files) → `record --all` with full AI provenance (model, tokens, cost, session, decision graph).
- **Session end** switches back to your original view.

To review what the hooks recorded (diff, provenance, AI attestation), use the `atomic-vcs` skill: `atomic log -f oneline`, then `atomic change -p -a`.

### 5. Complete the intent

When all task directives are `status=done`:

1. **Verify** every acceptance criterion by running the actual commands/tests.
2. **Mark met** all satisfied acceptance criteria in the intent file using your file editing tool, including verification evidence where required.
3. **Sync** to persist your edits:
   ```bash
   atomic vault sync
   ```
4. **Mark done:**
   ```bash
   atomic intent update <id> --status done
   ```

Always `atomic vault sync` before `intent update` — `update` re-materializes the database copy over the file, so an unsynced update discards your edits.

### 6. Stop the goal when done

```bash
atomic vault goal stop
atomic vault sync
atomic intent update <id> --status done
```

### 7. Sync vault state

```bash
atomic vault sync
```

A final sync ensures every vault edit is in the database before the turn's automatic record captures it.

## Resuming Work

If you stopped a goal and need to come back:

```bash
atomic vault goal list                  # Find the suspended goal
atomic vault goal resume "auth-implementation"
# Continue working — the hooks manage the session view for you
```

## Tips

- One intent per unit of work — keep them focused
- Start every session by checking `atomic intent list` and `atomic vault goal list`
- Fill in every generated intent directive before starting implementation
- Run `atomic vault sync` after editing any vault markdown file, and before every `show`/`update`
- You don't manage views or recording — hooks fork a draft view at session start, record at turn end, then finalize the attestation and restore your original view at session end. Inspect the results with the `atomic-vcs` skill.
