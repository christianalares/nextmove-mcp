import type { NextMoveContext } from "./types.js"

export function formatContext(ctx: NextMoveContext): string {
  const sections: string[] = []

  sections.push(formatScanSection(ctx))

  if (ctx.git) {
    sections.push(formatGitSection(ctx))
  }

  if (ctx.github) {
    sections.push(formatGitHubSection(ctx))
  } else {
    sections.push(formatGitHubSkipped(ctx))
  }

  sections.push(formatInstructions(ctx))

  return sections.join("\n\n")
}

function formatScanSection(ctx: NextMoveContext): string {
  const { scan } = ctx
  const lines: string[] = []

  const stackParts = [
    scan.stack.language,
    scan.stack.framework ?? scan.stack.runtime,
    scan.stack.packageManager !== "npm" ? scan.stack.packageManager : null,
  ]
    .filter(Boolean)
    .join(" · ")

  lines.push(`## Project — ${stackParts}`)

  if (!scan.hasGit) {
    lines.push(`**No git repository detected** — this is an untracked project.`)
  }

  if (Object.keys(scan.scripts).length > 0) {
    const scriptNames = Object.keys(scan.scripts).join(", ")
    lines.push(`**Scripts:** \`${scriptNames}\``)
  }

  if (scan.missing.length > 0) {
    lines.push(`\n**Missing setup:**`)
    for (const m of scan.missing) {
      lines.push(`  - No ${m.thing} — ${m.why}`)
    }
  }

  return lines.join("\n")
}

function formatGitSection(ctx: NextMoveContext): string {
  const { git } = ctx
  if (!git) {
    return ""
  }

  const lines: string[] = []

  lines.push(`## Repo Pulse — \`${git.branch}\``)

  if (git.uncommitted.count > 0) {
    lines.push(
      `**Uncommitted changes:** ${git.uncommitted.count} files (+${git.uncommitted.additions} / -${git.uncommitted.deletions} lines)`,
    )
    for (const f of git.uncommitted.files.slice(0, 6)) {
      lines.push(`  - ${f}`)
    }
    if (git.uncommitted.files.length > 6) {
      lines.push(`  - ...and ${git.uncommitted.files.length - 6} more`)
    }
  } else {
    lines.push(`**Uncommitted changes:** none — working tree clean`)
  }

  if (!git.unpushed.hasRemote) {
    lines.push(`**Unpushed commits:** branch has never been pushed to remote`)
  } else if (git.unpushed.count > 0) {
    lines.push(
      `**Unpushed commits:** ${git.unpushed.count} commit${git.unpushed.count === 1 ? "" : "s"} ahead of origin — no PR open yet`,
    )
  }

  if (git.staleBranches.length > 0) {
    lines.push(`\n**Stale local branches (never pushed):**`)
    for (const b of git.staleBranches) {
      lines.push(`  - \`${b.name}\` — ${b.ageDays} days old`)
    }
  }

  if (git.churn.length > 0) {
    lines.push(`\n**Hottest files (last 30 days):**`)
    for (const entry of git.churn.slice(0, 8)) {
      lines.push(`  - \`${entry.path}\` (${entry.count} commits)`)
    }
  }

  if (git.recentCommits.length > 0) {
    lines.push(`\n**Recent commits:**`)
    for (const c of git.recentCommits.slice(0, 10)) {
      lines.push(`  - ${c.message}`)
    }
  }

  if (git.todos.length > 0) {
    lines.push(`\n**TODOs/FIXMEs in active files:**`)
    for (const t of git.todos) {
      lines.push(`  - \`${t.path}:${t.line}\` ${t.type}: ${t.text}`)
    }
  }

  return lines.join("\n")
}

function formatGitHubSkipped(ctx: NextMoveContext): string {
  const messages: Record<string, string> = {
    "no-token":
      "GitHub signals unavailable — no token found. Install the GitHub CLI (`brew install gh && gh auth login`) or set the `GITHUB_TOKEN` environment variable.",
    "no-remote":
      "GitHub signals unavailable — no GitHub remote detected on this repo.",
    "auth-failed":
      "GitHub signals unavailable — token was found but authentication failed. Try running `gh auth login` again.",
  }

  const reason = ctx.githubSkipReason ?? "no-token"
  return `## GitHub\n${messages[reason]}`
}

function formatGitHubSection(ctx: NextMoveContext): string {
  const { github } = ctx
  if (!github) {
    return ""
  }

  const lines: string[] = []
  lines.push(`## GitHub — \`${github.owner}/${github.repo}\``)

  if (github.ciStatus) {
    const icon =
      github.ciStatus.status === "passing"
        ? "✅"
        : github.ciStatus.status === "failing"
          ? "❌"
          : github.ciStatus.status === "pending"
            ? "⏳"
            : "❓"

    lines.push(`**CI on current branch:** ${icon} ${github.ciStatus.status}`)

    if (github.ciStatus.failingJobs.length > 0) {
      lines.push(`  Failing jobs: ${github.ciStatus.failingJobs.join(", ")}`)
    }
  }

  if (github.recentRelease) {
    lines.push(
      `**Last release:** ${github.recentRelease.tag} (${github.recentRelease.ageDays} days ago)`,
    )
  }

  if (github.reviewRequests.length > 0) {
    lines.push(`\n**PRs waiting for your review:**`)
    for (const pr of github.reviewRequests) {
      lines.push(
        `  - [#${pr.number}](${pr.url}) "${pr.title}" by @${pr.author} — ${pr.ageDays}d old`,
      )
    }
  }

  if (github.openPRs.length > 0) {
    lines.push(`\n**Your open PRs:**`)
    for (const pr of github.openPRs) {
      const draft = pr.isDraft ? " (draft)" : ""
      lines.push(
        `  - [#${pr.number}](${pr.url}) "${pr.title}"${draft} — ${pr.ageDays}d old`,
      )
    }
  }

  if (github.assignedIssues.length > 0) {
    lines.push(`\n**Assigned to you:**`)
    for (const issue of github.assignedIssues) {
      const labels =
        issue.labels.length > 0 ? ` [${issue.labels.join(", ")}]` : ""
      lines.push(
        `  - [#${issue.number}](${issue.url}) "${issue.title}"${labels}`,
      )
    }
  }

  return lines.join("\n")
}

function formatInstructions(ctx: NextMoveContext): string {
  const hasCIFailure = ctx.github?.ciStatus?.status === "failing"
  const hasReviewRequests = (ctx.github?.reviewRequests.length ?? 0) > 0
  const hasUncommitted =
    ctx.github &&
    ctx.github.openPRs.length > 0 &&
    (ctx.git?.uncommitted.count ?? 0) > 0
  const recentReleaseDays = ctx.github?.recentRelease?.ageDays ?? null
  const isPostRelease = recentReleaseDays !== null && recentReleaseDays <= 14
  const isNewProject = ctx.scan.missing.length >= 3
  const hasUnpushedWork =
    ctx.git && (!ctx.git.unpushed.hasRemote || ctx.git.unpushed.count > 0)
  const hasStaleBranches = (ctx.git?.staleBranches.length ?? 0) > 0

  const hints: string[] = []

  if (!ctx.scan.hasGit) {
    hints.push(
      "This project has no git repo — initializing git should be the first task.",
    )
  }
  if (hasCIFailure) {
    hints.push(
      "CI is failing on this branch — fixing it likely unblocks other work.",
    )
  }
  if (hasReviewRequests) {
    hints.push(
      "There are PRs waiting on your review — teammates may be blocked.",
    )
  }
  if (isPostRelease) {
    hints.push(
      `A release landed ${recentReleaseDays} days ago — prefer stabilization and polish over new features.`,
    )
  }
  if (hasUncommitted) {
    hints.push(
      "You have uncommitted work and open PRs — consider shipping what's in progress before starting something new.",
    )
  }
  if (hasUnpushedWork) {
    hints.push(
      "You have commits not yet pushed to remote — opening a PR is a high-value next step.",
    )
  }
  if (hasStaleBranches) {
    hints.push(
      "You have local branches that were never pushed — decide whether to ship or clean them up.",
    )
  }

  const branchAndCommits = [
    ctx.git?.branch,
    ...(ctx.git?.recentCommits.slice(0, 5).map((c) => c.message) ?? []),
  ]
    .filter(Boolean)
    .join(", ")

  const linearStep = [
    `### Step 1 — Check Linear for active work (if connected)`,
    `If the \`linear\` MCP server is available, call these tools **now, before suggesting tasks**:`,
    ``,
    `1. \`get_user\` — resolve your Linear identity`,
    `2. \`list_issues\` — filter by: assignee = you, state = "In Progress"`,
    ``,
    `Current branch and recent commits for context: \`${branchAndCommits || "unknown"}\``,
    ``,
    `**Only surface Linear issues if at least one in-progress issue title clearly relates to the current branch name or recent commit messages above.** The branch name is the strongest signal — a branch called \`feat/payment-flow\` matches a Linear issue titled "Payment flow". If nothing overlaps with the current codebase context, skip Linear completely and do not mention it.`,
    ``,
    `If Linear is not connected, skip this step silently.`,
  ]

  const lines = [
    `## Instructions for Cursor`,
    `You are acting as a senior engineer and co-pilot helping the developer decide what to work on next.`,
    ``,
    ...linearStep,
    ``,
    `### Step 2 — Suggest tasks`,
    `Based on all signals above (git, GitHub, and Linear if relevant), present **2-3 numbered options** ranked by impact.`,
    ``,
    `**Format each option like this:**`,
    ``,
    `**1. [Short title]** · [XS / S / M / L]`,
    `[One sentence explaining why this is the right move now, citing a specific signal.]`,
    ``,
    `**Ranking rules (apply in order):**`,
    `1. Unblock teammates — pending review requests first`,
    `2. Broken CI — fix before starting anything new`,
    `3. Active sprint issues — in-progress Linear tasks before not-started ones`,
    `4. Assigned GitHub issues — honor existing commitments`,
    `5. New features — bias toward things that are interesting to build, not just chores`,
    ``,
    isNewProject
      ? `This project has multiple missing setup signals — prioritize foundational tasks (git, CI, tests) before features.`
      : `This is an established project — prefer small, high-leverage changes over large rewrites.`,
    ``,
    `After the list, end with exactly this line:`,
    `> Just reply with **1**, **2**, or **3** and I'll get started.`,
  ]

  if (hints.length > 0) {
    lines.push(`\n**Prioritization hints:**`)
    for (const hint of hints) {
      lines.push(`- ${hint}`)
    }
  }

  return lines.join("\n")
}
