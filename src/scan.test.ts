import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { scanProject } from "./scan.js"

function createFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "nextmove-test-"))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(join(full, ".."), { recursive: true })
    writeFileSync(full, content)
  }
  return dir
}

const minimalPackageJson = JSON.stringify({
  name: "test-project",
  scripts: { build: "tsc" },
})

describe("scanProject — package managers", () => {
  let dir: string

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("detects npm via package-lock.json", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "package-lock.json": "{}",
    })
    expect(scanProject(dir).stack.packageManager).toBe("npm")
  })

  it("detects pnpm via pnpm-lock.yaml", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "pnpm-lock.yaml": "",
    })
    expect(scanProject(dir).stack.packageManager).toBe("pnpm")
  })

  it("detects yarn via yarn.lock", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "yarn.lock": "",
    })
    expect(scanProject(dir).stack.packageManager).toBe("yarn")
  })

  it("detects bun via bun.lockb", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "bun.lockb": "",
    })
    expect(scanProject(dir).stack.packageManager).toBe("bun")
  })

  it("falls back to npm when no lockfile is present", () => {
    dir = createFixture({ "package.json": minimalPackageJson })
    expect(scanProject(dir).stack.packageManager).toBe("npm")
  })
})

describe("scanProject — language detection", () => {
  let dir: string

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("detects typescript via tsconfig.json", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "tsconfig.json": "{}",
    })
    expect(scanProject(dir).stack.language).toBe("typescript")
  })

  it("detects typescript via .ts files in src/", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "src/index.ts": "",
    })
    expect(scanProject(dir).stack.language).toBe("typescript")
  })

  it("falls back to javascript when no ts indicators found", () => {
    dir = createFixture({ "package.json": minimalPackageJson })
    expect(scanProject(dir).stack.language).toBe("javascript")
  })
})

describe("scanProject — missing signals", () => {
  let dir: string

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("flags missing git repo", () => {
    dir = createFixture({ "package.json": minimalPackageJson })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).toContain("git repository")
  })

  it("does not flag missing git when .git exists", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      ".git/HEAD": "ref: refs/heads/main",
    })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).not.toContain("git repository")
  })

  it("flags missing CI when no workflow files present", () => {
    dir = createFixture({ "package.json": minimalPackageJson })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).toContain("CI pipeline")
  })

  it("does not flag missing CI when .github/workflows exists", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      ".github/workflows/ci.yml": "",
    })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).not.toContain("CI pipeline")
  })

  it("flags missing linter when no biome.json or eslint config", () => {
    dir = createFixture({ "package.json": minimalPackageJson })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).toContain("linter")
  })

  it("does not flag missing linter when biome.json exists", () => {
    dir = createFixture({
      "package.json": minimalPackageJson,
      "biome.json": "{}",
    })
    const missing = scanProject(dir).missing.map((m) => m.thing)
    expect(missing).not.toContain("linter")
  })
})

describe("scanProject — edge cases", () => {
  let dir: string

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("does not throw on a non-existent directory", () => {
    dir = "/tmp/definitely-does-not-exist-xyz"
    expect(() => scanProject(dir)).not.toThrow()
  })

  it("returns empty scripts when no package.json exists", () => {
    dir = createFixture({})
    expect(scanProject(dir).scripts).toEqual({})
  })
})
