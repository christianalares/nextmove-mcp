<p align="center">
  <img src="logo.png" alt="Next Move" width="140" />
</p>

# nextmove-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Cursor that analyzes your repo and tells you what to work on next — presented as numbered options you can act on immediately.

Ask **"what's my next move?"** and get back something like:

> **1. Wire up the goals screen with real data** · M
> `goals/index.tsx` was just added but has no data fetching yet — good moment to finish it while the context is fresh.
>
> **2. Fix the failing CI job** · S
> The `build` job has been failing on this branch for 2 days and is likely blocking a merge.
>
> **3. Add tests for the goals API** · S
> No test files exist yet — the goals logic is a low-risk place to establish the pattern.
>
> Just reply with **1**, **2**, or **3** and I'll get started.

Reply with a number and Cursor starts working on it immediately — no copy-pasting prompts.

## What it looks at

- **Local git** — current branch, uncommitted changes, unpushed commits, stale local branches, hottest files (last 30 days), recent commits, TODOs in active files
- **GitHub** — PRs waiting on your review, your open PRs, CI status on current branch, assigned issues, recent releases
- **Project setup** — detects stack, package manager, and flags missing CI, tests, linter, formatter
- **Linear** — if the Linear MCP is connected in Cursor, in-progress issues are cross-referenced against your current branch and recent commits. Only surfaced if they're clearly relevant to the current codebase.

## Install

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nextmove": {
      "command": "npx",
      "args": ["-y", "nextmove-mcp"]
    }
  }
}
```

Restart Cursor. That's it.

## Usage

In any Cursor chat:

> what's my next move?

The tool auto-detects your current workspace. You can also target a specific repo:

> what's my next move in /path/to/my/project?

Reply with a number and Cursor acts on it immediately — no prompts to copy, no context to re-explain.

## GitHub integration

GitHub signals are enabled automatically if you have the [GitHub CLI](https://cli.github.com) installed and authenticated:

```bash
brew install gh
gh auth login
```

Alternatively, set a `GITHUB_TOKEN` environment variable.

Without a token the tool still works — it skips the GitHub layer and focuses on local git and project signals.

## Linear integration

If the Linear MCP server is connected in Cursor (Settings → Tools & MCP → Linear), nextmove automatically checks your in-progress Linear issues and cross-references them against your current branch name and recent commits. If a sprint issue clearly relates to what you're already working on, it's surfaced as a task. If nothing matches the current codebase context, Linear is skipped silently.

No configuration required.

## Ranking

Tasks are ranked in this order:

1. **Unblock teammates** — pending review requests first
2. **Broken CI** — fix before starting anything new
3. **Active sprint work** — in-progress Linear issues that match the current context
4. **Assigned GitHub issues** — honor existing commitments
5. **New features** — bias toward things worth building, not just chores

## Development

```bash
git clone https://github.com/christianalares/nextmove-mcp
cd nextmove-mcp
pnpm install
```

Preview the output against a local repo:

```bash
REPO=/path/to/your/project pnpm dev
```

Run tests:

```bash
pnpm test
```

Test the MCP protocol directly in a browser UI:

```bash
npx @modelcontextprotocol/inspector tsx src/index.ts
```
