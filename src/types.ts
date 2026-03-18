export interface GitPulse {
  branch: string
  uncommitted: {
    count: number
    files: string[]
    additions: number
    deletions: number
  }
  recentCommits: CommitSummary[]
  churn: ChurnEntry[]
  todos: TodoEntry[]
}

export interface CommitSummary {
  message: string
  date: string
}

export interface ChurnEntry {
  path: string
  count: number
}

export interface TodoEntry {
  path: string
  line: number
  type: "TODO" | "FIXME"
  text: string
}

export interface GitHubSignals {
  owner: string
  repo: string
  reviewRequests: PullRequest[]
  openPRs: PullRequest[]
  assignedIssues: Issue[]
  ciStatus: CIStatus | null
  recentRelease: Release | null
}

export interface PullRequest {
  number: number
  title: string
  author: string
  ageDays: number
  url: string
  isDraft: boolean
}

export interface Issue {
  number: number
  title: string
  labels: string[]
  url: string
}

export interface CIStatus {
  status: "passing" | "failing" | "pending" | "unknown"
  failingJobs: string[]
}

export interface Release {
  tag: string
  ageDays: number
}

export type GitHubSkipReason = "no-token" | "no-remote" | "auth-failed"

export interface NextMoveContext {
  git: GitPulse | null
  github: GitHubSignals | null
  githubSkipReason: GitHubSkipReason | null
  scan: import("./scan.js").ProjectScan
  collectedAt: string
}
