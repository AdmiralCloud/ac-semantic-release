
const { describe, test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { satisfies, parseYarnLock, parsePackageLock, check } = require('../lib/audit')

const baseAlert = (name, range, severity = 'high', extra = {}) => ({
  number: 1,
  dependency: { package: { name }, manifest_path: 'package.json' },
  security_vulnerability: { vulnerable_version_range: range, severity, first_patched_version: { identifier: '9.9.9' } },
  security_advisory: { ghsa_id: `GHSA-${name}`, summary: 'test' },
  ...extra
})

describe('audit.js', () => {
  describe('satisfies', () => {
    test('handles GitHub advisory ranges', () => {
      assert.ok(satisfies('4.17.20', '< 4.17.21'))
      assert.ok(!satisfies('4.17.21', '< 4.17.21'))
      assert.ok(satisfies('2.0.5', '>= 2.0.0, < 2.1.3'))
      assert.ok(!satisfies('1.9.9', '>= 2.0.0, < 2.1.3'))
      assert.ok(satisfies('1.0.0', '= 1.0.0'))
    })

    test('orders prereleases before releases', () => {
      assert.ok(satisfies('2.0.0-beta.1', '< 2.0.0'))
      assert.ok(!satisfies('2.0.0', '< 2.0.0-beta.2'))
      assert.ok(satisfies('2.0.0-beta.2', '< 2.0.0-beta.10'))
    })
  })

  describe('lockfile parsing', () => {
    test('parses yarn v1 lockfile', () => {
      const lock = `# yarn lockfile v1\n\n"@scope/pkg@^1.0.0", "@scope/pkg@^1.1.0":\n  version "1.2.0"\n\nlodash@^4.17.0:\n  version "4.17.20"\n`
      const map = parseYarnLock(lock)
      assert.deepStrictEqual([...map.get('@scope/pkg')], ['1.2.0'])
      assert.deepStrictEqual([...map.get('lodash')], ['4.17.20'])
    })

    test('parses yarn berry lockfile', () => {
      const lock = `__metadata:\n  version: 8\n\n"lodash@npm:^4.17.0":\n  version: 4.17.20\n  resolution: "lodash@npm:4.17.20"\n`
      const map = parseYarnLock(lock)
      assert.deepStrictEqual([...map.get('lodash')], ['4.17.20'])
      assert.ok(!map.has('__metadata'))
    })

    test('parses package-lock v3 including nested copies', () => {
      const lock = JSON.stringify({ lockfileVersion: 3, packages: {
        '': { name: 'root' },
        'node_modules/lodash': { version: '4.17.21' },
        'node_modules/a/node_modules/lodash': { version: '4.17.20' }
      } })
      assert.deepStrictEqual([...parsePackageLock(lock).get('lodash')].sort(), ['4.17.20', '4.17.21'])
    })

    test('parses package-lock v1', () => {
      const lock = JSON.stringify({ lockfileVersion: 1, dependencies: { a: { version: '1.0.0', dependencies: { b: { version: '2.0.0' } } } } })
      assert.deepStrictEqual([...parsePackageLock(lock).get('b')], ['2.0.0'])
    })
  })

  describe('check', () => {
    // fixture project with a yarn.lock, alerts point to it via manifest_path
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acsemver-audit-'))
    fs.writeFileSync(path.join(dir, 'yarn.lock'), 'lodash@^4.17.0:\n  version "4.17.20"\n')
    const name = 'lodash'
    const version = '4.17.20'
    const alert = (pkg, range, severity, extra) => baseAlert(pkg, range, severity, { dependency: { package: { name: pkg }, manifest_path: path.join(dir, 'package.json') }, ...extra })

    after(() => fs.rmSync(dir, { recursive: true, force: true }))

    test('reports locked versions inside the vulnerable range', () => {
      const result = check([alert(name, `<= ${version}`)])
      assert.strictEqual(result.findings.length, 1)
      assert.strictEqual(result.failing.length, 1)
      assert.deepStrictEqual(result.findings[0].locked, [version])
    })

    test('ignores alerts already fixed in the lockfile', () => {
      const result = check([alert(name, `< ${version}`)])
      assert.strictEqual(result.findings.length, 0)
    })

    test('respects failOn threshold', () => {
      const result = check([alert(name, `<= ${version}`, 'medium')], { failOn: 'high' })
      assert.strictEqual(result.findings.length, 1)
      assert.strictEqual(result.failing.length, 0)
    })

    test('respects ignore list', () => {
      const result = check([alert(name, `<= ${version}`)], { ignore: [{ id: `GHSA-${name}`, reason: 'test' }] })
      assert.strictEqual(result.findings.length, 0)
      assert.strictEqual(result.ignored.length, 1)
    })

    test('warns about manifests without lockfile', () => {
      const result = check([alert(name, '< 1.0.0', 'high', { dependency: { package: { name }, manifest_path: 'does-not-exist/package.json' } })])
      assert.deepStrictEqual(result.missingLockfiles, ['does-not-exist'])
      assert.strictEqual(result.findings.length, 0)
    })
  })
})
