import type { NextMoveContext } from "./types.js"

export function formatContext(ctx: NextMoveContext): string {
  const sections: string[] = []

  sections.push(formatScanSection(ctx))

  if (ctx.git) {
    sections.push(formatGitSection(ctx))
  }

  if (ctx.github) {
    sections.push(formatGitHubSection(ctx))
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
      `A release landed ${recentReleaseDays} days ago — stabilization tasks may have higher value than new features right now.`,
    )
  }
  if (hasUncommitted) {
    hints.push(
      "You have uncommitted work and open PRs — consider whether to ship what's in progress before starting something new.",
    )
  }

  const lines = [
    `## Instructions for Cursor`,
    `Based on the signals above, suggest **2-3 ready-to-run Cursor agent tasks**.`,
    ``,
    `For each task:`,
    `- Give it a short title and a "why now" in one sentence citing the signals above`,
    `- Provide a scoped agent prompt the user can paste directly into Cursor agent`,
    `- The prompt must include: goal, files to touch, files NOT to touch, and a clear acceptance criterion`,
    `- Estimate effort as XS / S / M / L`,
    ``,
    `Rank by: fixing blockers for teammates > broken CI > sprint/assigned work > new features.`,
    `Prefer reversible, small-surface changes. Bias toward things worth building, not just chores.`,
  ]

  if (hints.length > 0) {
    lines.push(`\n**Prioritization hints:**`)
    for (const hint of hints) {
      lines.push(`- ${hint}`)
    }
  }

  return lines.join("\n")
}
