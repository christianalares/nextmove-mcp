#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { formatContext } from "./format.js"
import { getGitHubSignals, resolveGitHubToken } from "./github.js"
import { getGitPulse } from "./pulse.js"
import { scanProject } from "./scan.js"
import type { GitHubSkipReason, NextMoveContext } from "./types.js"

const server = new McpServer({
  name: "nextmove",
  version: "0.1.0",
})

async function resolveRepoPath(explicit?: string): Promise<string> {
  if (explicit) {
    return explicit
  }

  try {
    const { roots } = await server.server.listRoots()
    for (const root of roots) {
      if (!root.uri?.startsWith("file://")) {
        continue
      }
      const dir = decodeURIComponent(root.uri.replace("file://", ""))
      if (isProjectRoot(dir)) {
        return dir
      }
      const nested = findProjectInChildren(dir)
      if (nested) {
        return nested
      }
    }
  } catch {
    // client doesn't support roots — fall back silently
  }

  return process.cwd()
}

function isProjectRoot(dir: string): boolean {
  return existsSync(join(dir, ".git")) || existsSync(join(dir, "package.json"))
}

function findProjectInChildren(dir: string): string | null {
  try {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".") || entry === "node_modules") {
        continue
      }
      const child = join(dir, entry)
      if (statSync(child).isDirectory() && isProjectRoot(child)) {
        return child
      }
    }
  } catch {
    // unreadable directory
  }
  return null
}

server.registerTool(
  "next_move",
  {
    description:
      "Gathers real-time signals from your local git repo and GitHub to surface what's worth working on next. " +
      "Returns branch state, recent activity, hotspots, open PRs, CI status, and assigned issues, " +
      "then suggests 2-3 numbered options the user can act on immediately by replying with a number.",
    inputSchema: z.object({
      cwd: z
        .string()
        .optional()
        .describe(
          "Absolute path to the repo to analyze. Auto-detected from the workspace if omitted.",
        ),
      github_token: z
        .string()
        .optional()
        .describe(
          "GitHub personal access token. Falls back to GITHUB_TOKEN env var or gh CLI.",
        ),
    }),
  },
  async ({ cwd, github_token }) => {
    const repoPath = await resolveRepoPath(cwd)
    const token = resolveGitHubToken(github_token)

    const githubPromise = token
      ? getGitHubSignals(repoPath, token)
      : Promise.resolve({
          signals: null,
          skipReason: "no-token" as GitHubSkipReason,
        })

    const [git, githubResult, scan] = await Promise.all([
      getGitPulse(repoPath),
      githubPromise,
      Promise.resolve(scanProject(repoPath)),
    ])

    const context: NextMoveContext = {
      git,
      github: githubResult.signals,
      githubSkipReason: githubResult.skipReason,
      scan,
      collectedAt: new Date().toISOString(),
    }

    const formatted = formatContext(context)

    return {
      content: [
        {
          type: "text",
          text: formatted,
        },
      ],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("nextmove MCP server running")
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
