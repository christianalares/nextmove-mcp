import { existsSync, readFileSync } from "node:fs"
import { simpleGit } from "simple-git"
import type { ChurnEntry, CommitSummary, GitPulse, TodoEntry } from "./types.js"

const TODO_PATTERN = /\/\/\s*(TODO|FIXME)[:\s](.+)/

export async function getGitPulse(cwd: string): Promise<GitPulse | null> {
  try {
    return await _getGitPulse(cwd)
  } catch {
    return null
  }
}

async function _getGitPulse(cwd: string): Promise<GitPulse> {
  const git = simpleGit(cwd)

  const [status, log, churnRaw, diffStat] = await Promise.all([
    git.status(),
    git.log({ maxCount: 30, "--no-merges": null } as object),
    getChurn(git),
    getUncommittedDiff(git),
  ])

  const todos = await scanTodos(churnRaw.slice(0, 8), cwd)

  return {
    branch: status.current ?? "unknown",
    uncommitted: {
      count: status.files.length,
      files: status.files.map((f) => f.path),
      additions: diffStat.additions,
      deletions: diffStat.deletions,
    },
    recentCommits: log.all.map(
      (c): CommitSummary => ({
        message: c.message,
        date: c.date,
      }),
    ),
    churn: churnRaw,
    todos,
  }
}

async function getUncommittedDiff(
  git: ReturnType<typeof simpleGit>,
): Promise<{ additions: number; deletions: number }> {
  try {
    const raw = await git.diff(["--shortstat"])
    return parseDiffStat(raw)
  } catch {
    return { additions: 0, deletions: 0 }
  }
}

function parseDiffStat(raw: string): { additions: number; deletions: number } {
  const additions = parseInt(raw.match(/(\d+) insertion/)?.[1] ?? "0", 10)
  const deletions = parseInt(raw.match(/(\d+) deletion/)?.[1] ?? "0", 10)
  return { additions, deletions }
}

async function getChurn(
  git: ReturnType<typeof simpleGit>,
): Promise<ChurnEntry[]> {
  try {
    const raw = await git.raw([
      "log",
      "--name-only",
      "--since=30 days ago",
      "--pretty=format:",
      "--no-merges",
    ])

    const counts: Record<string, number> = {}
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("commit")) {
        counts[trimmed] = (counts[trimmed] ?? 0) + 1
      }
    }

    return Object.entries(counts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
  } catch {
    return []
  }
}

async function scanTodos(
  churnEntries: ChurnEntry[],
  cwd: string,
): Promise<TodoEntry[]> {
  const todos: TodoEntry[] = []

  for (const entry of churnEntries) {
    const fullPath = `${cwd}/${entry.path}`
    if (!existsSync(fullPath)) {
      continue
    }

    try {
      const content = readFileSync(fullPath, "utf-8")
      const lines = content.split("\n")

      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(TODO_PATTERN)
        if (match) {
          todos.push({
            path: entry.path,
            line: i + 1,
            type: match[1] as "TODO" | "FIXME",
            text: match[2].trim(),
          })
        }
      }
    } catch {
      // skip unreadable files
    }
  }

  return todos.slice(0, 10)
}
