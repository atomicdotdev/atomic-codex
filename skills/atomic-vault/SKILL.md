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
atomic vault intent list                # List all intents (CHECK THIS FIRST)
atomic vault intent create "title"      # Create a new intent
atomic vault intent show <id>           # Show intent details
atomic vault intent update <id> --status <status>  # Update intent status
atomic vault intent link <id> --goal <goal>         # Link intent to a goal
```

### Intent Statuses

`backlog` → `planned` → `in-progress` → `review` → `done`

### CRITICAL RULE: Always Check Before Creating

Before creating any intent, run `atomic vault intent list` first. Duplicate intents cause confusion and waste effort. Only create a new intent if no existing one covers the work.

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
## Description
What this intent accomplishes and why.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Files to Modify
- `path/to/file.rs` — what changes and why

## Approach
Step-by-step plan for implementation.

## Test Strategy
How to verify the work is correct.

## Notes
Any additional context, decisions, or open questions.
```

After editing intent markdown files, run `atomic vault sync` to persist changes back to the vault database.

## Full Workflow (End to End)

In the Codex integration, hooks create the draft view and record changes automatically. Follow this sequence for every piece of work:

### 1. Check existing intents

```bash
atomic vault intent list
```

Look for an existing intent that matches your task. Do NOT create duplicates.

### 2. Create ONE intent (if needed)

```bash
atomic vault intent create --title "Implement user authentication"
```

Create exactly one intent per unit of work. Fill in the intent file at `.vault/intents/<id>/intent.md`.

### 3. Start a goal (optional)

```bash
atomic vault goal start "auth-implementation"
atomic vault intent link <intent-id> --goal auth-implementation
```

### 4. Do the work

Write code, add files, iterate. Use Atomic for version-control context when needed:

```bash
atomic status
atomic diff
atomic log
```

**Do not run `git` commands for repository operations.** Use `atomic status`, `atomic diff`, `atomic log`, `atomic change`, `atomic view list`, `atomic pull`, and `atomic push` instead.

**Do not run `atomic add` or `atomic record` in Codex.** The hook system records changes automatically with AI provenance when the turn ends.

**Do not create or switch views.** The session draft view is created automatically. Only run `atomic view switch <name>` if the user explicitly asks you to switch views.

### 5. Update intent status

```bash
atomic vault intent update <id> --status review
```

### 6. Stop the goal when done (if one was started)

```bash
atomic vault goal stop
atomic vault intent update <id> --status done
```

### 7. Sync vault state

```bash
atomic vault sync
```

## Resuming Work

If you stopped a goal and need to come back:

```bash
atomic vault goal list                  # Find the suspended goal
atomic vault goal resume "auth-implementation"
# Continue working in the automatically-created session view...
```

## Tips

- One intent per unit of work — keep them focused
- Start every session by checking `atomic vault intent list` and `atomic vault goal list`
- Fill in the intent markdown completely before starting implementation
- Use `atomic vault sync` after editing any vault markdown files
- Codex hooks create the session draft view and record changes automatically
- Never use `git` for repository operations; use the equivalent `atomic` command instead
