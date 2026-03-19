# Next Move — Cursor Plugin

Ask **"what's my next move?"** in any repo and get 2-3 numbered, agent-ready tasks ranked by impact. Reply with a number and Cursor starts working immediately.

## What it does

- Calls the `nextmove` MCP to gather signals from local git, GitHub, and project structure
- Optionally cross-references your in-progress Linear issues against the current branch and recent commits
- Presents 2-3 numbered options — reply with a number to act on it immediately

## Signals analyzed

- **Git** — branch, uncommitted changes, hottest files, recent commits, TODOs
- **GitHub** — PRs waiting on your review, CI status, assigned issues, recent releases
- **Project setup** — stack, package manager, missing CI/tests/linter
- **Linear** — in-progress issues matched against current branch context (only if relevant)

## Task ranking

1. Unblock teammates (pending review requests)
2. Broken CI
3. Active Linear sprint work matching the current context
4. Assigned GitHub issues
5. New features worth building

## Requirements

- [GitHub CLI](https://cli.github.com) authenticated (`gh auth login`) for GitHub signals
- [Linear MCP](https://linear.app) connected in Cursor for Linear signals (optional)
