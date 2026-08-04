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
atomic intent new "<short title>"
```

This gives you an intent ID (e.g., HELL-4) and a file path.

### 2. Define the problem

The user's prompt is usually a **solution** ("build me X"). Reframe it as a **problem statement**.

Ask clarifying questions if the problem is ambiguous. Do not guess — ask.

Once the problem is clear, define:

- **Why** (`:::why`) — what problem are we solving and why
- **Acceptance criteria** (`:::acceptance-criterion`) — concrete, testable outcomes that mean "done"
- **Tasks** (`:::task`) — ordered work items, each with accurate `::file-ref` leaves
- **Scope and constraints** — what changes, what deliberately does not, and rules the implementation must respect

Write all of this into the generated directive scaffold. Replace every HTML comment stub and the placeholder `path/to/file`, but preserve the directive names, IDs, and fences.

Then run `atomic vault sync` to persist the file into the vault database. The intent file lives on disk, but `atomic intent show`/`update` read from the database — without `sync` they see the original placeholder template, and `update` will overwrite your file edits with it.

### 3. Execute the tasks

Work through the TODOs in order. After completing each one:

1. **Verify** it meets its criteria — run the commands or checks specified in the TODO.
2. **Edit the intent file** using your file editing tool to mark its task directive done:
   ```
   :::task{#proj-1 status=unmet ...}   →   :::task{#proj-1 status=done ...}
   ```
   When an acceptance criterion is satisfied, change `status=unmet` to `status=met` and include its real `verifiedBy` and `evidence` attributes if the intent will be validated or attested.
3. **Sync** so the database stays current:
   ```bash
   atomic vault sync
   ```

**Use your file editing tool to update directive attributes — not bash, not Python, not sed.** Raw file manipulation bypasses the vault.

### 4. Update the intent

```bash
atomic vault sync                          # persist file edits to the database first
atomic intent update <ID> --status done
```

Always `atomic vault sync` before `atomic intent show`/`update` — the CLI reads from the database, not the file, so an unsynced `show` renders the stale placeholder template and `update` re-materializes the database copy over the file, clobbering your edits.

**Do NOT run `atomic add` or `atomic record`.** The hook system records your changes automatically with full AI provenance (model, tokens, session, timing) when the turn ends. (`atomic vault sync` is not `atomic record` — it only moves your `.vault/` edits into the vault database, and you must run it even though hooks handle recording.)

## Rules

- **One intent per turn.** Every prompt gets its own intent.
- **Problem first.** Reframe solution-requests as problems. Ask questions if unclear.
- **Write the intent file before coding.** The plan goes in the file, not just in chat.
- **Simplification guard.** When you pick an approach simpler than or divergent from a reference (the standard library, an existing implementation, a spec, a prior version), the simpler choice almost always drops a behavior the reference guaranteed. Name what it drops — interrupted/partial operations, error or panic states, round-trip fidelity, ordering, resource cleanup, concurrency, overflow/empty/boundary inputs — and for each, either pin it as an acceptance criterion, record it explicitly as out-of-scope with the consequence stated, or ask the user. Never leave it unstated. A decision about API *shape* is not a decision about *behavior*: the same signature can be implemented correctly or incorrectly, so resolve behavioral gaps as separate items.
- **Do run `atomic vault sync` after editing any `.vault/` file**, and before `atomic intent show`/`update`. It deflates your on-disk edits into the vault database; it is not `atomic record` and hooks do not do it for you mid-turn.
- **Do not run `atomic add` or `atomic record`.** Hooks handle this with provenance.
- **Do not create or switch views.** The session view is created automatically.
- **Do not run `atomic agent enable`.** The integration is already configured globally.

## Skills

Use these for detailed reference when needed:

- `/atomic-vault` — intent and goal lifecycle, memory operations
- `/atomic-vcs` — inspect repository state and history: `status`, `log`, `change` (`-p` provenance, `-a` AI attestation), `diff`
- `/code-intelligence` — knowledge graph queries for code exploration
