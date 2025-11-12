#!/usr/bin/env node
/**
 * Pre-commit guard: blocks restricted files and secrets from being committed.
 * - Fails on: env files, service accounts, private keys, credential files, .vercel dir
 * - Content scan: flags known secret env keys
 * - Warns on dev-only test scripts except on protected branches (main, production)
 */

const { execSync } = require('child_process')
const { existsSync, readFileSync, statSync } = require('fs')
const path = require('path')

const MAX_SCAN_SIZE_BYTES = 1024 * 1024 // 1MB safety
const protectedBranches = new Set(['main', 'master', 'production', 'prod'])

function getBranch() {
  try {
    const out = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'pipe'] })
    return String(out).trim()
  } catch {
    return ''
  }
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { stdio: ['ignore', 'pipe', 'pipe'] })
    return String(out)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const restrictedNameMatchers = [
  // Env files
  (f) => /^\.env(\..*)?$/.test(f) && f !== '.env.local.example',
  // Package manager configs with potential tokens
  (f) => /^\.npmrc$/.test(f) || /^\.yarnrc$/.test(f) || /^\.pnpmrc$/.test(f),
  // Service accounts and credentials
  (f) => /service[-_]?account.*\.json$/i.test(f),
  (f) => /credentials.*\.json$/i.test(f),
  // Private keys and certs
  (f) => /\.(pem|key|p12|crt|cert)$/i.test(f),
  // Local Vercel project directory files
  (f) => f.startsWith('.vercel/'),
]

const devOnlyWarnMatchers = [
  // Test scripts and local testers
  (f) => /^scripts\/test-.*\.(t|j)sx?$/.test(f),
  // Logs and debug files
  (f) => /(^|\/)debug\.log$/.test(f) || /-debug\.log$/.test(f),
]

const secretContentTokens = [
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'GOOGLE_PRIVATE_KEY',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'AWS_SECRET_ACCESS_KEY',
]

// Only scan potentially sensitive file types to reduce false positives in docs
const contentScanAllowExt = new Set([
  '', '.env', '.json', '.yaml', '.yml', '.toml', '.ini'
])

function scanFileContents(filePath) {
  try {
    if (!existsSync(filePath)) return null
    const ext = path.extname(filePath).toLowerCase()
    if (!contentScanAllowExt.has(ext)) return null
    const st = statSync(filePath)
    if (st.size > MAX_SCAN_SIZE_BYTES) return null
    const content = readFileSync(filePath, 'utf8')
    const hits = secretContentTokens.filter((tok) => content.includes(tok))
    return hits.length ? hits : null
  } catch {
    return null
  }
}

function main() {
  const branch = getBranch()
  const staged = getStagedFiles()

  const restricted = []
  const devWarn = []
  const contentFindings = []

  for (const f of staged) {
    const m1 = restrictedNameMatchers.some((fn) => fn(f))
    if (m1) restricted.push(f)

    const m2 = devOnlyWarnMatchers.some((fn) => fn(f))
    if (m2) devWarn.push(f)

    const hits = scanFileContents(f)
    if (hits && hits.length) contentFindings.push({ file: f, tokens: hits })
  }

  const problems = []

  if (restricted.length) {
    problems.push(
      `Restricted files detected in staged changes:\n${restricted.map((f) => `  - ${f}`).join('\n')}`
    )
  }

  if (contentFindings.length) {
    problems.push(
      `Potential secrets found in file contents:\n${contentFindings
        .map((r) => `  - ${r.file} -> ${r.tokens.join(', ')}`)
        .join('\n')}`
    )
  }

  const shouldBlockDevFiles = protectedBranches.has(branch)
  if (devWarn.length) {
    const msg = `Dev-only files staged:\n${devWarn.map((f) => `  - ${f}`).join('\n')}`
    if (shouldBlockDevFiles) {
      problems.push(`${msg}\nBranch '${branch}' is protected. Remove dev-only files from commit.`)
    } else {
      console.warn(`\n[pre-commit] Warning: ${msg}\n`)
    }
  }

  if (problems.length) {
    console.error('\n[pre-commit] Commit blocked to protect secrets/non-production assets.')
    console.error(problems.join('\n\n'))
    console.error('\nUse --no-verify only if you are CERTAIN there are no secrets.\n')
    process.exit(1)
  }

  process.exit(0)
}

main()
