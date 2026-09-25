const { exec: execCb } = require('child_process')
const util = require('util')
const exec = util.promisify(execCb)
const fs = require('fs')
const path = require('path')
const merge = require('lodash.merge')

const config = require('../config')

try {
  const customConfig = require(process.cwd() + '/.acsemver')
  merge(config, customConfig)
}
catch {
  // no custom config
}

const SEVERITIES = ['low', 'medium', 'high', 'critical']
const LOCKFILES = ['yarn.lock', 'package-lock.json', 'npm-shrinkwrap.json']

// VERSION MATCHING
// GitHub advisory ranges are comma separated comparators, e.g. ">= 2.0.0, < 2.1.3" or "= 1.0.0"
const parseVersion = (value) => {
  const m = `${value}`.trim().replace(/^v/, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/)
  if (!m) return
  return { nums: [+m[1], +(m[2] || 0), +(m[3] || 0)], pre: m[4] ? m[4].split('.') : [] }
}

const compareVersions = (a, b) => {
  for (let i = 0; i < 3; i++) {
    if (a.nums[i] !== b.nums[i]) return a.nums[i] - b.nums[i]
  }
  // a version without prerelease is higher than the same version with one
  if (!a.pre.length || !b.pre.length) return b.pre.length - a.pre.length
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i]
    const y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) return +x - +y
    if (nx) return -1
    if (ny) return 1
    return x < y ? -1 : 1
  }
  return 0
}

const satisfies = (version, range) => {
  const v = parseVersion(version)
  if (!v) return false
  return range.split(',').every(part => {
    const m = part.trim().match(/^(<=|>=|<|>|=)?\s*(.+)$/)
    const target = m && parseVersion(m[2])
    if (!target) return false
    const c = compareVersions(v, target)
    switch (m[1] || '=') {
      case '<': return c < 0
      case '<=': return c <= 0
      case '>': return c > 0
      case '>=': return c >= 0
      default: return c === 0
    }
  })
}

// LOCKFILE PARSING - returns Map<packageName, Set<version>>
const add = (map, name, version) => {
  if (!name || !version) return
  if (!map.has(name)) map.set(name, new Set())
  map.get(name).add(version)
}

// yarn v1 and yarn berry share the block layout: header line with specifiers, indented version line
const parseYarnLock = (content) => {
  const map = new Map()
  for (const block of content.split(/\n\s*\n/)) {
    const header = block.split('\n').find(l => l && !l.startsWith('#') && !l.startsWith(' '))
    const version = block.match(/^\s+version:?\s+"?([^"\s]+)"?/m)?.[1]
    if (!header || !version || header.startsWith('__metadata')) continue
    for (let spec of header.replace(/:$/, '').split(/,\s*/)) {
      spec = spec.replace(/^"|"$/g, '')
      add(map, spec.slice(0, spec.lastIndexOf('@')), version)
    }
  }
  return map
}

const parsePackageLock = (content) => {
  const map = new Map()
  const lock = JSON.parse(content)
  if (lock.packages) {
    // lockfileVersion 2 and 3
    for (const [key, entry] of Object.entries(lock.packages)) {
      const idx = key.lastIndexOf('node_modules/')
      if (idx === -1) continue
      add(map, key.slice(idx + 'node_modules/'.length), entry.version)
    }
  }
  else {
    // lockfileVersion 1
    const walk = (deps = {}) => {
      for (const [name, entry] of Object.entries(deps)) {
        add(map, name, entry.version)
        walk(entry.dependencies)
      }
    }
    walk(lock.dependencies)
  }
  return map
}

const readLockfile = (dir, lockfile) => {
  const candidates = lockfile ? [lockfile] : LOCKFILES
  for (const file of candidates) {
    const full = path.resolve(dir, file)
    if (!fs.existsSync(full)) continue
    const content = fs.readFileSync(full, 'utf8')
    const packages = content.trimStart().startsWith('{') ? parsePackageLock(content) : parseYarnLock(content)
    const relative = path.relative(process.cwd(), full)
    return { file: relative.startsWith('..') ? full : relative, packages }
  }
}

// GITHUB
const getRepoSlug = async(opts) => {
  if (opts.repo) return opts.repo
  let url = config?.repository?.url
  if (!url) {
    const { stdout } = await exec('git remote get-url origin')
    url = stdout.trim()
  }
  const m = `${url}`.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
  if (!m) throw new Error(`Cannot determine GitHub repository from "${url}" - set repository.url in .acsemver.js`)
  return `${m[1]}/${m[2]}`
}

const getToken = async() => {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN
  try {
    const { stdout } = await exec('gh auth token')
    if (stdout.trim()) return stdout.trim()
  }
  catch {
    // gh not installed or not logged in
  }
  throw new Error('No GitHub token found - set GITHUB_TOKEN or run "gh auth login"')
}

const fetchAlerts = async(repo, token) => {
  const alerts = []
  let url = `https://api.github.com/repos/${repo}/dependabot/alerts?state=open&ecosystem=npm&per_page=100`
  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (!res.ok) {
      const hint = res.status === 403 || res.status === 404 ? ' (token needs "security_events" / Dependabot alerts read access)' : ''
      throw new Error(`GitHub API ${res.status} ${res.statusText} for ${repo}${hint}`)
    }
    alerts.push(...await res.json())
    url = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1]
  }
  return alerts
}

// AUDIT
const isIgnored = (alert, ignore = []) => {
  const ids = [alert.security_advisory?.ghsa_id, alert.security_advisory?.cve_id, alert.dependency?.package?.name]
  return ignore.some(item => ids.includes(typeof item === 'string' ? item : item?.id))
}

// checks each open alert (reported for the default branch) against the lockfile(s) of the current checkout
const check = (alerts, opts = {}) => {
  const failOn = SEVERITIES.indexOf(opts.failOn || 'low')
  const lockfiles = new Map()
  const findings = []
  const ignored = []
  const missingLockfiles = new Set()

  for (const alert of alerts) {
    // monorepos: alerts carry the manifest path, use the lockfile next to it
    const dir = path.dirname(alert.dependency?.manifest_path || 'package.json')
    if (!lockfiles.has(dir)) lockfiles.set(dir, readLockfile(dir, opts.lockfile))
    const lock = lockfiles.get(dir)
    if (!lock) {
      missingLockfiles.add(dir)
      continue
    }

    const name = alert.dependency.package.name
    const range = alert.security_vulnerability.vulnerable_version_range
    const locked = [...(lock.packages.get(name) || [])].filter(v => satisfies(v, range))
    if (!locked.length) continue

    const finding = {
      number: alert.number,
      severity: alert.security_vulnerability.severity,
      package: name,
      range,
      locked,
      patched: alert.security_vulnerability.first_patched_version?.identifier,
      ghsa: alert.security_advisory?.ghsa_id,
      summary: alert.security_advisory?.summary,
      lockfile: lock.file,
      url: alert.html_url
    }
    if (isIgnored(alert, opts.ignore)) ignored.push(finding)
    else findings.push(finding)
  }

  const failing = findings.filter(f => SEVERITIES.indexOf(f.severity) >= failOn)
  return { total: alerts.length, findings, failing, ignored, missingLockfiles: [...missingLockfiles] }
}

const audit = async(opts = {}) => {
  opts = { ...config.audit, ...opts }
  const repo = await getRepoSlug(opts)
  const token = await getToken()
  const alerts = await fetchAlerts(repo, token)
  return { repo, ...check(alerts, opts) }
}

const report = (result, opts = {}) => {
  opts = { ...config.audit, ...opts }
  const bySeverity = (a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity)
  console.log('')
  console.log(`Dependabot audit for ${result.repo}`)
  for (const dir of result.missingLockfiles) {
    console.log(`  WARNING: no lockfile found in ${dir} - alerts for it were not checked`)
  }
  for (const f of result.findings.sort(bySeverity)) {
    const flag = result.failing.includes(f) ? 'STILL VULNERABLE' : 'below threshold '
    console.log(`  ${flag} ${f.severity.padEnd(8)} ${f.package}@${f.locked.join(', ')} | vulnerable ${f.range} | fixed in ${f.patched || 'n/a'} | ${f.ghsa} (${f.lockfile})`)
  }
  for (const f of result.ignored) {
    console.log(`  ignored          ${f.severity.padEnd(8)} ${f.package}@${f.locked.join(', ')} | ${f.ghsa}`)
  }
  console.log(`${result.total} open alerts on default branch | still vulnerable on this checkout: ${result.findings.length} | failing (>= ${opts.failOn || 'low'}): ${result.failing.length} | ignored: ${result.ignored.length}`)
  console.log('')
}

// CLI
const parseArgs = (argv) => {
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--json') opts.json = true
    else if (arg === '--fail-on') opts.failOn = argv[++i]
    else if (arg === '--lockfile') opts.lockfile = argv[++i]
    else if (arg === '--repo') opts.repo = argv[++i]
    else if (arg === '--ignore') opts.ignore = [...(config.audit?.ignore || []), ...argv[++i].split(',')]
  }
  if (process.env.AUDIT_FAIL_ON && !opts.failOn) opts.failOn = process.env.AUDIT_FAIL_ON
  if (opts.failOn && !SEVERITIES.includes(opts.failOn)) {
    throw new Error(`--fail-on must be one of ${SEVERITIES.join(', ')}`)
  }
  return opts
}

if (require.main === module) {
  (async() => {
    const opts = parseArgs(process.argv.slice(2))
    const result = await audit(opts)
    if (opts.json) console.log(JSON.stringify(result, null, 2))
    else report(result, opts)
    process.exitCode = result.failing.length ? 1 : 0
  })().catch(err => {
    console.error(err.message || err)
    process.exitCode = 2
  })
}

module.exports = { audit, check, report, satisfies, parseYarnLock, parsePackageLock, SEVERITIES }
