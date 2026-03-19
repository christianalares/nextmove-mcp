import { describe, expect, it } from "vitest"
import { formatContext } from "./format.js"
import type { NextMoveContext } from "./types.js"

function makeContext(
  overrides: Partial<NextMoveContext> = {},
): NextMoveContext {
  return {
    git: null,
    github: null,
    githubSkipReason: "no-remote",
    scan: {
      hasGit: true,
      stack: {
        language: "typescript",
        runtime: "node",
        framework: null,
        packageManager: "pnpm",
      },
      missing: [],
      scripts: { build: "tsc", test: "vitest run" },
    },
    collectedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("formatContext — project section", () => {
  it("renders stack info", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("typescript")
    expect(output).toContain("pnpm")
  })

  it("shows no-git warning when hasGit is false", () => {
    const output = formatContext(
      makeContext({ scan: { ...makeContext().scan, hasGit: false } }),
    )
    expect(output).toContain("No git repository detected")
  })

  it("does not show no-git warning when hasGit is true", () => {
    const output = formatContext(makeContext())
    expect(output).not.toContain("No git repository detected")
  })

  it("shows missing setup signals", () => {
    const output = formatContext(
      makeContext({
        scan: {
          ...makeContext().scan,
          missing: [{ thing: "CI pipeline", why: "no automated checks" }],
        },
      }),
    )
    expect(output).toContain("CI pipeline")
  })

  it("does not show missing section when nothing is missing", () => {
    const output = formatContext(makeContext())
    expect(output).not.toContain("Missing setup")
  })
})

describe("formatContext — git section", () => {
  it("is omitted when git is null", () => {
    const output = formatContext(makeContext({ git: null }))
    expect(output).not.toContain("Repo Pulse")
  })

  it("renders branch name", () => {
    const output = formatContext(
      makeContext({
        git: {
          branch: "feature/my-branch",
          uncommitted: { count: 0, files: [], additions: 0, deletions: 0 },
          recentCommits: [],
          churn: [],
          todos: [],
        },
      }),
    )
    expect(output).toContain("feature/my-branch")
  })

  it("shows uncommitted changes count and files", () => {
    const output = formatContext(
      makeContext({
        git: {
          branch: "main",
          uncommitted: {
            count: 2,
            files: ["src/index.ts", "src/utils.ts"],
            additions: 30,
            deletions: 5,
          },
          recentCommits: [],
          churn: [],
          todos: [],
        },
      }),
    )
    expect(output).toContain("2 files")
    expect(output).toContain("src/index.ts")
  })

  it("shows 'working tree clean' when no uncommitted changes", () => {
    const output = formatContext(
      makeContext({
        git: {
          branch: "main",
          uncommitted: { count: 0, files: [], additions: 0, deletions: 0 },
          recentCommits: [],
          churn: [],
          todos: [],
        },
      }),
    )
    expect(output).toContain("working tree clean")
  })

  it("renders churn entries", () => {
    const output = formatContext(
      makeContext({
        git: {
          branch: "main",
          uncommitted: { count: 0, files: [], additions: 0, deletions: 0 },
          recentCommits: [],
          churn: [{ path: "src/api/handler.ts", count: 12 }],
          todos: [],
        },
      }),
    )
    expect(output).toContain("src/api/handler.ts")
    expect(output).toContain("12 commits")
  })

  it("renders TODOs with path and line number", () => {
    const output = formatContext(
      makeContext({
        git: {
          branch: "main",
          uncommitted: { count: 0, files: [], additions: 0, deletions: 0 },
          recentCommits: [],
          churn: [],
          todos: [
            {
              path: "src/cache.ts",
              line: 42,
              type: "TODO",
              text: "add retry logic",
            },
          ],
        },
      }),
    )
    expect(output).toContain("src/cache.ts:42")
    expect(output).toContain("add retry logic")
  })
})

describe("formatContext — GitHub section", () => {
  it("shows no-token message when githubSkipReason is no-token", () => {
    const output = formatContext(
      makeContext({ github: null, githubSkipReason: "no-token" }),
    )
    expect(output).toContain("brew install gh")
  })

  it("shows no-remote message when githubSkipReason is no-remote", () => {
    const output = formatContext(
      makeContext({ github: null, githubSkipReason: "no-remote" }),
    )
    expect(output).toContain("no GitHub remote detected")
  })

  it("shows auth-failed message when githubSkipReason is auth-failed", () => {
    const output = formatContext(
      makeContext({ github: null, githubSkipReason: "auth-failed" }),
    )
    expect(output).toContain("gh auth login")
  })

  it("renders repo name when github signals are present", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [],
          ciStatus: null,
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("acme/my-app")
  })

  it("renders failing CI with icon", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [],
          ciStatus: { status: "failing", failingJobs: ["build"] },
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("❌")
    expect(output).toContain("build")
  })

  it("renders review requests", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [
            {
              number: 42,
              title: "Add caching layer",
              author: "sarah",
              ageDays: 3,
              url: "https://github.com/acme/my-app/pull/42",
              isDraft: false,
            },
          ],
          openPRs: [],
          assignedIssues: [],
          ciStatus: null,
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("#42")
    expect(output).toContain("Add caching layer")
    expect(output).toContain("@sarah")
  })

  it("renders assigned issues with labels", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [
            {
              number: 99,
              title: "Fix memory leak",
              labels: ["bug", "perf"],
              url: "https://github.com/acme/my-app/issues/99",
            },
          ],
          ciStatus: null,
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("#99")
    expect(output).toContain("Fix memory leak")
    expect(output).toContain("bug")
  })
})

describe("formatContext — instructions section", () => {
  it("always includes instructions", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("Instructions for Cursor")
  })

  it("shows no-git hint when hasGit is false", () => {
    const output = formatContext(
      makeContext({ scan: { ...makeContext().scan, hasGit: false } }),
    )
    expect(output).toContain("initializing git should be the first task")
  })

  it("shows CI failure hint when CI is failing", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [],
          ciStatus: { status: "failing", failingJobs: [] },
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("CI is failing")
  })

  it("shows review request hint when PRs are waiting", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [
            {
              number: 1,
              title: "Fix bug",
              author: "bob",
              ageDays: 1,
              url: "",
              isDraft: false,
            },
          ],
          openPRs: [],
          assignedIssues: [],
          ciStatus: null,
          recentRelease: null,
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("teammates may be blocked")
  })

  it("shows stabilization hint within 14 days of a release", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [],
          ciStatus: null,
          recentRelease: { tag: "v1.0.0", ageDays: 7 },
        },
        githubSkipReason: null,
      }),
    )
    expect(output).toContain("stabilization")
  })

  it("does not show stabilization hint when release is older than 14 days", () => {
    const output = formatContext(
      makeContext({
        github: {
          owner: "acme",
          repo: "my-app",
          reviewRequests: [],
          openPRs: [],
          assignedIssues: [],
          ciStatus: null,
          recentRelease: { tag: "v1.0.0", ageDays: 30 },
        },
        githubSkipReason: null,
      }),
    )
    expect(output).not.toContain("stabilization")
  })

  it("uses new-project framing when 3 or more setup signals are missing", () => {
    const output = formatContext(
      makeContext({
        scan: {
          ...makeContext().scan,
          hasGit: false,
          missing: [
            { thing: "git repository", why: "nothing tracked" },
            { thing: "CI pipeline", why: "no checks" },
            { thing: "tests", why: "no test files" },
          ],
        },
      }),
    )
    expect(output).toContain("foundational tasks")
  })

  it("uses established-project framing when fewer than 3 signals are missing", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("established project")
  })

  it("includes Linear step 1 instructions", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("list_cycles")
    expect(output).toContain("list_issues")
    expect(output).toContain("get_user")
  })

  it("tells Cursor to skip Linear silently when not connected", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("skip this step silently")
  })

  it("instructs Cursor to cross-reference sprint issues with branch and commits", () => {
    const output = formatContext(makeContext())
    expect(output).toContain("branch name and recent commit messages")
  })

  it("ranks active sprint issues above assigned GitHub issues", () => {
    const output = formatContext(makeContext())
    const sprintRuleIndex = output.indexOf("Active sprint issues")
    const githubIssueRuleIndex = output.indexOf("Assigned GitHub issues")
    expect(sprintRuleIndex).toBeGreaterThan(-1)
    expect(githubIssueRuleIndex).toBeGreaterThan(-1)
    expect(sprintRuleIndex).toBeLessThan(githubIssueRuleIndex)
  })
})
