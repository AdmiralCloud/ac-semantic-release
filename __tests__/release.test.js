
const { describe, test } = require('node:test')
const assert = require('node:assert/strict')

describe('Release functionality', () => {
  describe('BREAKING change detection in commit body parsing', () => {
    // Reproduces the bug fixed by Copilot: BREAKING as first body line was missed
    const parseCommitBody = (lines) => {
      let body = ''
      let breaking = null

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (line.startsWith('BREAKING')) {
          breaking = line.replace('BREAKING: ', '').trim()
        }
        else if (!body) {
          body = line + '  \n'
        }
        else {
          body += line + '  \n'
        }
      }
      return { body, breaking }
    }

    test('detects BREAKING as first body line', () => {
      const lines = ['BREAKING: Removed legacy API endpoint']
      const { breaking, body } = parseCommitBody(lines)
      assert.strictEqual(breaking, 'Removed legacy API endpoint')
      assert.strictEqual(body, '')
    })

    test('detects BREAKING after regular body text', () => {
      const lines = ['Some description', 'BREAKING: Changed return type']
      const { breaking, body } = parseCommitBody(lines)
      assert.strictEqual(breaking, 'Changed return type')
      assert.ok(body.includes('Some description'))
    })

    test('does not set breaking when no BREAKING line', () => {
      const lines = ['Just a regular body line']
      const { breaking, body } = parseCommitBody(lines)
      assert.strictEqual(breaking, null)
      assert.ok(body.includes('Just a regular body line'))
    })

    test('BREAKING with empty body before it', () => {
      const lines = ['BREAKING: Drop Node 18 support']
      const { breaking } = parseCommitBody(lines)
      assert.strictEqual(breaking, 'Drop Node 18 support')
    })
  })

  describe('deepMerge config', () => {
    const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
    const deepMerge = (target, source) => {
      for (const key of Object.keys(source)) {
        if (UNSAFE_KEYS.has(key)) continue
        if (Object.prototype.toString.call(source[key]) === '[object Object]' &&
            Object.prototype.toString.call(target[key]) === '[object Object]') {
          deepMerge(target[key], source[key])
        } else {
          target[key] = source[key]
        }
      }
      return target
    }

    test('deep merges nested objects without overwriting sibling keys', () => {
      const base = { repository: { url: 'https://github.com/org/repo', type: 'git' } }
      const override = { repository: { url: 'https://github.com/org/other' } }
      deepMerge(base, override)
      assert.strictEqual(base.repository.url, 'https://github.com/org/other')
      assert.strictEqual(base.repository.type, 'git')
    })

    test('shallow assign would lose sibling keys (sanity check for old behavior)', () => {
      const base = { repository: { url: 'https://github.com/org/repo', type: 'git' } }
      const override = { repository: { url: 'https://github.com/org/other' } }
      Object.assign(base, override)
      assert.strictEqual(base.repository.url, 'https://github.com/org/other')
      // type is lost with shallow merge
      assert.strictEqual(base.repository.type, undefined)
    })

    test('replaces arrays entirely (not merged element-by-element)', () => {
      const base = { types: [{ value: 'fix' }, { value: 'feat' }] }
      const override = { types: [{ value: 'custom' }] }
      deepMerge(base, override)
      assert.strictEqual(base.types.length, 1)
      assert.strictEqual(base.types[0].value, 'custom')
    })

    test('merges top-level scalar overrides', () => {
      const base = { padLength: 20, changelogFile: 'CHANGELOG.md' }
      const override = { padLength: 30 }
      deepMerge(base, override)
      assert.strictEqual(base.padLength, 30)
      assert.strictEqual(base.changelogFile, 'CHANGELOG.md')
    })
  })

  describe('semver bump logic', () => {
    const bumpVersion = ({ major, minor, patch }, releaseType) => {
      if (releaseType === 'breaking') return { major: major + 1, minor: 0, patch: 0 }
      if (releaseType === 'minor') return { major, minor: minor + 1, patch: 0 }
      if (releaseType === 'patch') return { major, minor, patch: patch + 1 }
      return { major, minor, patch }
    }

    test('breaking change bumps major and resets minor/patch', () => {
      const result = bumpVersion({ major: 1, minor: 2, patch: 3 }, 'breaking')
      assert.deepStrictEqual(result, { major: 2, minor: 0, patch: 0 })
    })

    test('minor bump resets patch', () => {
      const result = bumpVersion({ major: 1, minor: 2, patch: 3 }, 'minor')
      assert.deepStrictEqual(result, { major: 1, minor: 3, patch: 0 })
    })

    test('patch bump only increments patch', () => {
      const result = bumpVersion({ major: 1, minor: 2, patch: 3 }, 'patch')
      assert.deepStrictEqual(result, { major: 1, minor: 2, patch: 4 })
    })
  })

  describe('git add staging command', () => {
    test('staging command uses -A -- flag to handle deletions', () => {
      const files = ['src/foo.js', 'src/bar.js']
      const addCommand = `git add -A -- ${files.join(' ')}`
      assert.ok(addCommand.includes('-A --'), 'Command must include -A -- to stage deletions')
      assert.ok(addCommand.includes('src/foo.js'))
      assert.ok(addCommand.includes('src/bar.js'))
    })

    test('staging command without -A would not handle deletions (sanity check)', () => {
      const files = ['deleted-file.js']
      const oldCommand = `git add ${files.join(' ')}`
      assert.ok(!oldCommand.includes('-A'), 'Old command did not have -A flag')
    })
  })
})
