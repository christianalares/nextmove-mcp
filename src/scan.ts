import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export interface ProjectScan {
  hasGit: boolean
  stack: StackInfo
  missing: MissingSignal[]
  scripts: Record<string, string>
}

export interface StackInfo {
  language: "typescript" | "javascript" | "unknown"
  runtime: "node" | "bun" | "deno" | "unknown"
  framework: string | null
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown"
}

export interface MissingSignal {
  thing: string
  why: string
}

export function scanProject(cwd: string): ProjectScan {
  const has = (rel: string) => existsSync(join(cwd, rel))
  const hasAny = (...rels: string[]) => rels.some((r) => has(r))

  const hasGit = has(".git")

  const packageJson = readPackageJson(cwd)
  const scripts: Record<string, string> = packageJson?.scripts ?? {}
  const deps: Record<string, string> = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  }

  const stack = detectStack(cwd, deps, has)
  const missing = detectMissing(cwd, scripts, deps, has, hasAny, hasGit)

  return { hasGit, stack, missing, scripts }
}

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function readPackageJson(cwd: string): PackageJson | null {
  try {
    const raw = readFileSync(join(cwd, "package.json"), "utf-8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function detectStack(
  cwd: string,
  deps: Record<string, string>,
  has: (rel: string) => boolean,
): StackInfo {
  const language =
    has("tsconfig.json") || hasTsFiles(cwd) ? "typescript" : "javascript"

  const runtime =
    has("bun.lockb") || has("bunfig.toml")
      ? "bun"
      : has("deno.json") || has("deno.jsonc")
        ? "deno"
        : "node"

  const packageManager = has("bun.lockb")
    ? "bun"
    : has("pnpm-lock.yaml")
      ? "pnpm"
      : has("yarn.lock")
        ? "yarn"
        : "npm"

  const framework =
    "next" in deps
      ? "Next.js"
      : "vite" in deps
        ? "Vite"
        : "express" in deps
          ? "Express"
          : "fastify" in deps
            ? "Fastify"
            : "hono" in deps
              ? "Hono"
              : "@sveltejs/kit" in deps
                ? "SvelteKit"
                : "nuxt" in deps
                  ? "Nuxt"
                  : null

  return { language, runtime, framework, packageManager }
}

function detectMissing(
  cwd: string,
  scripts: Record<string, string>,
  _deps: Record<string, string>,
  has: (rel: string) => boolean,
  hasAny: (...rels: string[]) => boolean,
  hasGit: boolean,
): MissingSignal[] {
  const missing: MissingSignal[] = []

  if (!hasGit) {
    missing.push({
      thing: "git repository",
      why: "Nothing is tracked, no history, no way to collaborate or deploy safely",
    })
  }

  if (
    !hasAny(".github/workflows", ".gitlab-ci.yml", ".circleci", "Jenkinsfile")
  ) {
    missing.push({
      thing: "CI pipeline",
      why: "No automated checks on push — bugs ship without a safety net",
    })
  }

  const hasTestScript =
    "test" in scripts && !scripts.test?.includes("no test specified")
  const hasTestFiles =
    hasAny("src/__tests__", "tests", "test", "spec", "__tests__") ||
    hasTestFilesInSrc(cwd)

  if (!hasTestScript || !hasTestFiles) {
    missing.push({
      thing: "tests",
      why: "No test script or test files found — no way to verify changes don't break things",
    })
  }

  const hasLinter = hasAny(
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.json",
    ".eslintrc.cjs",
    "eslint.config.js",
    "eslint.config.mjs",
    "biome.json",
    ".biome.json",
  )
  if (!hasLinter) {
    missing.push({
      thing: "linter",
      why: "No ESLint or Biome config — code style and common errors go unchecked",
    })
  }

  const hasFormatter = hasAny(
    ".prettierrc",
    ".prettierrc.json",
    "prettier.config.js",
    "biome.json",
  )
  if (!hasFormatter) {
    missing.push({
      thing: "formatter",
      why: "No Prettier or Biome config — formatting will drift inconsistently",
    })
  }

  if (!has(".gitignore") && hasGit) {
    missing.push({
      thing: ".gitignore",
      why: "node_modules and secrets could accidentally get committed",
    })
  }

  return missing
}

function hasTsFiles(cwd: string): boolean {
  try {
    const srcPath = join(cwd, "src")
    const dir = existsSync(srcPath) ? srcPath : cwd
    return readdirSync(dir).some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  } catch {
    return false
  }
}

function hasTestFilesInSrc(cwd: string): boolean {
  try {
    const srcPath = join(cwd, "src")
    if (!existsSync(srcPath)) {
      return false
    }
    return readdirSync(srcPath).some(
      (f) => f.includes(".test.") || f.includes(".spec."),
    )
  } catch {
    return false
  }
}
