import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { formatContext } from "./format.js"
import { getGitHubSignals, resolveGitHubToken } from "./github.js"
import { getGitPulse } from "./pulse.js"
import { scanProject } from "./scan.js"
import type { NextMoveContext } from "./types.js"

const server = new McpServer({
  name: "nextmove",
  version: "0.1.0",
})

server.registerTool(
  "next_move",
  {
    description:
      "Gathers real-time signals from your local git repo and GitHub to surface what's worth working on next. " +
      "Returns structured context about branch state, recent activity, hotspots, open PRs, CI status, and assigned issues. " +
      "Use this context to suggest 2-3 ready-to-run Cursor agent tasks, ranked by impact. " +
      "Each suggested task should include a scoped agent prompt the user can paste directly into a Cursor agent run.",
    inputSchema: z.object({
      cwd: z
        .string()
        .optional()
        .describe(
          "Absolute path to the repo. Defaults to the process working directory.",
        ),
      github_token: z
        .string()
        .optional()
        .describe(
          "GitHub personal access token. Falls back to GITHUB_TOKEN env var.",
        ),
    }),
  },
  async ({ cwd, github_token }) => {
    const repoPath = cwd ?? process.cwd()
    const token = resolveGitHubToken(github_token)

    const [git, github, scan] = await Promise.all([
      getGitPulse(repoPath),
      token ? getGitHubSignals(repoPath, token) : Promise.resolve(null),
      Promise.resolve(scanProject(repoPath)),
    ])

    const context: NextMoveContext = {
      git,
      github,
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
