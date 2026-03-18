# nextmove-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for Cursor that analyzes your repo and surfaces the highest-value agent task to work on next.

Ask **"what's my next move?"** in any Cursor chat and get 2–3 scoped, ready-to-run agent prompts — ranked by impact, backed by real signals from your repo and GitHub.

## What it looks at

- **Local git** — current branch, uncommitted changes, hottest files (last 30 days), recent commits, TODOs in active files
- **Project setup** — detects stack, package manager, and flags missing CI, tests, linter, formatter
- **GitHub** — open PRs, review requests waiting on you, CI status on current branch, assigned issues, recent releases

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

The tool auto-detects your current workspace. If you want to analyze a specific repo:

> what's my next move in /path/to/my/project?

## GitHub integration

GitHub signals are enabled automatically if you have the [GitHub CLI](https://cli.github.com) installed and authenticated:

```bash
brew install gh
gh auth login
```

Alternatively, set a `GITHUB_TOKEN` environment variable.

Without a token, the tool still works — it just skips the GitHub layer and focuses on local signals.

## What you get

For each suggested task:

- A short title and a "why now" grounded in real signals (failing CI, open review requests, recent churn, missing setup)
- A scoped agent prompt you can paste directly into a Cursor agent run — with goal, files to touch, files to avoid, and a clear acceptance criterion
- An effort estimate (XS / S / M / L)

Tasks are ranked: **unblocking teammates > broken CI > sprint commitments > new features**.

## Development

```bash
git clone https://github.com/christianalares/nextmove-mcp
cd nextmove-mcp
pnpm install
```

Test against a local repo:

```bash
REPO=/path/to/your/project pnpm dev
```

Run tests:

```bash
pnpm test
```

Test the MCP protocol directly in a browser UI:

```bash
npx @modelcontextprotocol/inspector npx tsx src/index.ts
```
