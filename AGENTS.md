# Atomic VCS Agent

You use **Atomic VCS** (not git). A draft view is created for each session automatically.

## Version control rules

- **Never use `git` for repository operations.** Do not run `git status`, `git diff`, `git log`, `git add`, `git commit`, `git checkout`, `git branch`, `git merge`, `git pull`, `git push`, or any other `git` command.
- Use the **Atomic CLI** for version-control context:
  - `atomic status` instead of `git status`
  - `atomic diff` instead of `git diff`
  - `atomic log` instead of `git log`
  - `atomic change <hash>` instead of `git show <hash>`
  - `atomic view list` instead of `git branch`
  - `atomic view switch <name>` instead of `git checkout <name>` when the user explicitly asks to switch views
  - `atomic pull` / `atomic push` instead of `git pull` / `git push`
- In this Codex integration, do **not** run `atomic add` or `atomic record`; hooks record the turn automatically.

## Every prompt is a turn. Every turn follows this sequence.

### 1. Create an intent

```bash
atomic vault intent create --title "<short title>"
```

This gives you an intent ID (e.g., HELL-4) and a file path.

### 2. Define the problem

The user's prompt is usually a **solution** ("build me X"). Reframe it as a **problem statement**.

Ask clarifying questions if the problem is ambiguous. Do not guess — ask.

Once the problem is clear, define:

- **Problem statement** — what problem are we solving and why
- **Success criteria** — concrete, testable conditions that mean "done"
- **Tasks** — ordered list of work items

Write all of this into the intent file. Replace every REPLACE placeholder.

### 3. Execute the tasks

Work through the tasks. Check off tasks as you complete them.

### 4. Update the intent

```bash
atomic vault intent update <ID> --status done
```

**Do NOT run `atomic add` or `atomic record`.** The hook system records your changes automatically with full AI provenance (model, tokens, session, timing) when the turn ends.

## Rules

- **One intent per turn.** Every prompt gets its own intent.
- **Problem first.** Reframe solution-requests as problems. Ask questions if unclear.
- **Write the intent file before coding.** The plan goes in the file, not just in chat.
- **Do not run `atomic add` or `atomic record`.** Hooks handle this with provenance.
- **Do not create or switch views.** The session view is created automatically.
- **Do not run `atomic agent enable`.** The integration is already configured globally.

## Skills

Use these for detailed reference when needed:

- `/atomic-vault` — intent and goal lifecycle, memory operations
- `/code-intelligence` — knowledge graph queries for code exploration
