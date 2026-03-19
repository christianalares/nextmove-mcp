---
name: next-move
description: Analyze git, GitHub, and Linear signals to surface 2-3 numbered next actions the developer can act on immediately.
---

# Next Move

## Trigger

Use when the user asks what to work on next, what their next move is, wants task suggestions, or asks "what should I build next?" in any repo context.

## Workflow

1. Call `next_move` from the nextmove MCP — it returns signals from local git, GitHub, and the project structure.
2. If the `linear` MCP is connected, call these tools **before suggesting tasks**:
   a. `get_user` — resolve your Linear identity
   b. `list_issues` — filter by: assignee = you, state = "In Progress"
   Cross-reference in-progress issue titles against the current branch name and recent commits from the `next_move` output. **Only surface Linear issues if at least one clearly relates to the current codebase context.** If nothing matches, skip Linear silently.
3. Based on all signals, present **2-3 numbered options** ranked by impact.
4. End with: "Just reply with **1**, **2**, or **3** and I'll get started."

## Ranking rules (apply in order)

1. Unblock teammates — pending review requests first
2. Broken CI — fix before starting anything new
3. Active Linear sprint issues — in-progress issues that match the current context
4. Assigned GitHub issues — honor existing commitments
5. New features — bias toward things that are interesting to build, not just chores

For new projects (many missing setup signals): prioritize foundational tasks (git, CI, tests) before features.
For established projects: prefer small, high-leverage changes over large rewrites.

## Guardrails

- Keep each option to one title line + one "why now" sentence citing a specific signal
- Do not generate long implementation plans ahead of time — wait for the user to pick a number
- If Linear issues don't clearly match the current repo context, skip them entirely — do not mention Linear
- Prefer actionable, reversible tasks over large rewrites

## Output format

**1. [Short title]** · [XS / S / M / L]
[One sentence: why this is the right move now, grounded in a specific signal from the context.]

**2. [Short title]** · [XS / S / M / L]
[One sentence: why now.]

**3. [Short title]** · [XS / S / M / L]
[One sentence: why now.]

Just reply with **1**, **2**, or **3** and I'll get started.
