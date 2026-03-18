/**
 * Dev runner — use this to iterate without restarting Cursor.
 * Run: pnpm dev
 * Point at any local repo with: REPO=/path/to/repo pnpm dev
 */

import { formatContext } from "./format.js"
import { getGitHubSignals, resolveGitHubToken } from "./github.js"
import { getGitPulse } from "./pulse.js"
import { scanProject } from "./scan.js"
import type { GitHubSkipReason, NextMoveContext } from "./types.js"

const repoPath = process.env.REPO ?? process.cwd()
const token = resolveGitHubToken()

console.error(`\nAnalyzing: ${repoPath}`)
console.error(
  `GitHub: ${token ? "enabled (token resolved)" : "disabled — install gh CLI or set GITHUB_TOKEN"}`,
)
console.error("---\n")

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

const output = formatContext(context)
console.log(output)
