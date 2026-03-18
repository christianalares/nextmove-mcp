import { execSync } from "node:child_process"
import { Octokit } from "@octokit/rest"
import { simpleGit } from "simple-git"
import type {
  CIStatus,
  GitHubSignals,
  GitHubSkipReason,
  Issue,
  PullRequest,
  Release,
} from "./types.js"

export function resolveGitHubToken(explicit?: string): string | null {
  if (explicit) {
    return explicit
  }
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN
  }
  try {
    const token = execSync("gh auth token", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
    if (token) {
      return token
    }
  } catch {
    // gh CLI not installed or not authenticated
  }
  return null
}

interface RepoCoords {
  owner: string
  repo: string
}

export type GitHubResult =
  | { signals: GitHubSignals; skipReason: null }
  | { signals: null; skipReason: GitHubSkipReason }

export async function getGitHubSignals(
  cwd: string,
  token: string,
): Promise<GitHubResult> {
  const coords = await detectRepoCoords(cwd)
  if (!coords) {
    return { signals: null, skipReason: "no-remote" }
  }

  const octokit = new Octokit({ auth: token })

  const username = await getAuthenticatedUser(octokit)
  if (!username) {
    return { signals: null, skipReason: "auth-failed" }
  }

  const branch = await getCurrentBranch(cwd)

  const [reviewRequests, openPRs, assignedIssues, ciStatus, recentRelease] =
    await Promise.all([
      getReviewRequests(octokit, coords, username),
      getOpenPRs(octokit, coords, username),
      getAssignedIssues(octokit, coords, username),
      getCIStatus(octokit, coords, branch),
      getRecentRelease(octokit, coords),
    ])

  return {
    signals: {
      owner: coords.owner,
      repo: coords.repo,
      reviewRequests,
      openPRs,
      assignedIssues,
      ciStatus,
      recentRelease,
    },
    skipReason: null,
  }
}

async function detectRepoCoords(cwd: string): Promise<RepoCoords | null> {
  try {
    const git = simpleGit(cwd)
    const remotes = await git.getRemotes(true)
    const origin = remotes.find((r) => r.name === "origin")
    if (!origin) {
      return null
    }

    const url = origin.refs.fetch ?? origin.refs.push ?? ""
    return parseGitHubUrl(url)
  } catch {
    return null
  }
}

function parseGitHubUrl(url: string): RepoCoords | null {
  // handles: git@github.com:owner/repo.git and https://github.com/owner/repo.git
  const sshMatch = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] }
  }
  return null
}

async function getCurrentBranch(cwd: string): Promise<string> {
  try {
    const git = simpleGit(cwd)
    const status = await git.status()
    return status.current ?? "main"
  } catch {
    return "main"
  }
}

async function getAuthenticatedUser(octokit: Octokit): Promise<string | null> {
  try {
    const { data } = await octokit.rest.users.getAuthenticated()
    return data.login
  } catch {
    return null
  }
}

async function getReviewRequests(
  octokit: Octokit,
  coords: RepoCoords,
  username: string,
): Promise<PullRequest[]> {
  try {
    const { data } = await octokit.rest.search.issuesAndPullRequests({
      q: `is:pr is:open review-requested:${username} repo:${coords.owner}/${coords.repo}`,
      per_page: 10,
    })

    return data.items.map((item) => ({
      number: item.number,
      title: item.title,
      author: item.user?.login ?? "unknown",
      ageDays: daysSince(item.created_at),
      url: item.html_url,
      isDraft: false,
    }))
  } catch {
    return []
  }
}

async function getOpenPRs(
  octokit: Octokit,
  coords: RepoCoords,
  username: string,
): Promise<PullRequest[]> {
  try {
    const { data } = await octokit.rest.pulls.list({
      owner: coords.owner,
      repo: coords.repo,
      state: "open",
      per_page: 20,
    })

    return data
      .filter((pr) => pr.user?.login === username)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "unknown",
        ageDays: daysSince(pr.created_at),
        url: pr.html_url,
        isDraft: pr.draft ?? false,
      }))
  } catch {
    return []
  }
}

async function getAssignedIssues(
  octokit: Octokit,
  coords: RepoCoords,
  username: string,
): Promise<Issue[]> {
  try {
    const { data } = await octokit.rest.issues.listForRepo({
      owner: coords.owner,
      repo: coords.repo,
      state: "open",
      assignee: username,
      per_page: 15,
    })

    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        labels: issue.labels
          .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
          .filter(Boolean),
        url: issue.html_url,
      }))
  } catch {
    return []
  }
}

async function getCIStatus(
  octokit: Octokit,
  coords: RepoCoords,
  branch: string,
): Promise<CIStatus | null> {
  try {
    const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner: coords.owner,
      repo: coords.repo,
      branch,
      per_page: 5,
    })

    if (data.total_count === 0) {
      return null
    }

    const latest = data.workflow_runs[0]
    if (!latest) {
      return null
    }

    const conclusion = latest.conclusion
    let status: CIStatus["status"] = "unknown"

    if (latest.status === "in_progress" || latest.status === "queued") {
      status = "pending"
    } else if (conclusion === "success") {
      status = "passing"
    } else if (conclusion === "failure") {
      status = "failing"
    }

    const failingJobs: string[] = []
    if (status === "failing") {
      try {
        const { data: jobs } =
          await octokit.rest.actions.listJobsForWorkflowRun({
            owner: coords.owner,
            repo: coords.repo,
            run_id: latest.id,
          })
        for (const job of jobs.jobs) {
          if (job.conclusion === "failure") {
            failingJobs.push(job.name)
          }
        }
      } catch {
        // best effort
      }
    }

    return { status, failingJobs }
  } catch {
    return null
  }
}

async function getRecentRelease(
  octokit: Octokit,
  coords: RepoCoords,
): Promise<Release | null> {
  try {
    const { data } = await octokit.rest.repos.listReleases({
      owner: coords.owner,
      repo: coords.repo,
      per_page: 1,
    })

    if (data.length === 0) {
      return null
    }

    const latest = data[0]
    return {
      tag: latest.tag_name,
      ageDays: daysSince(latest.published_at ?? latest.created_at),
    }
  } catch {
    return null
  }
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}
