/**
 * Dev test runner — use this to iterate without restarting Cursor.
 * Run: npm test
 * Point at any local repo with: REPO=/path/to/repo npm test
 */

import { formatContext } from "./format.js"
import { getGitHubSignals, resolveGitHubToken } from "./github.js"
import { getGitPulse } from "./pulse.js"
import { scanProject } from "./scan.js"
import type { NextMoveContext } from "./types.js"

const repoPath = process.env.REPO ?? process.cwd()
const token = resolveGitHubToken()

console.error(`\nAnalyzing: ${repoPath}`)
console.error(
  `GitHub: ${token ? "enabled (token resolved)" : "disabled — install gh CLI or set GITHUB_TOKEN"}`,
)
console.error("---\n")

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

const output = formatContext(context)
console.log(output)
