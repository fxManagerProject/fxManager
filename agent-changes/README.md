# Agent change records

One record per change for work done with a coding agent, including the developer's confirmation that they read the resulting code. Entries are named after the branch and date and accumulate on `main` as history.

## Lifecycle

1. When a change involved a coding agent, copy `TEMPLATE.md` to `agent-changes/<branch>-YYYY-MM-DD.md`, replacing `/` in the branch name with `-`. For example, `feat/player-notes` on 11 November 2026 becomes `feat-player-notes-2026-11-11.md`.
2. Fill every field and commit the file with the change. Reviewers read it alongside the diff.
3. The developer completes `Developer review` after reading the diff.
4. If a file already exists for that branch and date, append a counter (`feat-player-notes-2026-11-11-2.md`) rather than editing or overwriting the existing entry.

## Rules

- One record per change. New files only; never rewrite or delete an existing entry.
- Keep the record in sync with the final diff; update it if the change grows before it is merged.
- The developer signs off only after reading every added or changed line, or lists what they skipped under `Developer review`. The minimum read is every changed line.
- Leave `Developer review: pending` until that confirmation; an agent must never sign on the developer's behalf.
- No secrets, tokens, personal data or `.env` contents. Agent name, model and developer handle are enough.
- Changes with no modified files (questions, reviews, investigations) need no record.

`.github/workflows/agent-records.yml` validates every record on pull requests and pushes to `main`: required fields must be present and filenames must end in `-YYYY-MM-DD.md` (optionally `-N`).
