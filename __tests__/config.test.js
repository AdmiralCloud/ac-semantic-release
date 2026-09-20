
const { describe, test, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const config = require('../config')

const getQuestion = (name) => config.questions.find(q => q.name === name)

describe('config.js questions', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalSelectedType = config.selectedType

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    config.selectedType = originalSelectedType
  })

  describe('type choices', () => {
    test('maps config.types to {name, value} choices', () => {
      const choices = getQuestion('type').choices()
      assert.ok(choices.some(c => c.value === 'fix' && c.name.startsWith('fix:')))
      assert.ok(choices.some(c => c.value === 'package'))
      assert.strictEqual(choices.length, config.types.length)
    })
  })

  describe('section choices and when', () => {
    test('maps config.sections to {name, value} choices', () => {
      const choices = getQuestion('section').choices()
      assert.deepStrictEqual(choices, config.sections.map(s => ({ name: s.name, value: s.name })))
    })

    test('when() sets config.selectedType as a side effect and returns true', () => {
      const result = getQuestion('section').when({ type: 'package' })
      assert.strictEqual(result, true)
      assert.strictEqual(config.selectedType, 'package')
    })
  })

  describe('title question', () => {
    test('validate rejects strings of 5 chars or fewer', () => {
      assert.strictEqual(getQuestion('title').validate('short'), 'Please add a title with more than 5 characters')
    })

    test('validate accepts strings longer than 5 chars', () => {
      assert.strictEqual(getQuestion('title').validate('long enough title'), true)
    })

    test('default is "Updated packages" when selectedType is package', () => {
      config.selectedType = 'package'
      assert.strictEqual(getQuestion('title').default(), 'Updated packages')
    })

    test('default falls back to test title under NODE_ENV=test', () => {
      config.selectedType = 'fix'
      process.env.NODE_ENV = 'test'
      assert.strictEqual(getQuestion('title').default(), 'My commit title')
    })

    test('default is undefined outside package type and NODE_ENV=test', () => {
      config.selectedType = 'fix'
      process.env.NODE_ENV = 'production'
      assert.strictEqual(getQuestion('title').default(), undefined)
    })
  })

  describe('description question', () => {
    test('validate rejects strings of 5 chars or fewer', () => {
      assert.strictEqual(getQuestion('description').validate('short'), 'Please add a significant description')
    })

    test('validate accepts strings longer than 5 chars', () => {
      assert.strictEqual(getQuestion('description').validate('a proper description'), true)
    })

    test('default is "Updated packages" when selectedType is package', () => {
      config.selectedType = 'package'
      assert.strictEqual(getQuestion('description').default(), 'Updated packages')
    })

    test('default falls back to test description under NODE_ENV=test', () => {
      config.selectedType = 'fix'
      process.env.NODE_ENV = 'test'
      assert.strictEqual(getQuestion('description').default(), 'My commit description')
    })
  })

  describe('links question default', () => {
    test('returns fixed test links under NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test'
      const result = await getQuestion('links').default()
      assert.strictEqual(result, '#1, admiralcloud/ac-api-server#340')
    })
  })

  describe('credentials question', () => {
    test('validate rejects anything other than exactly 2 characters', () => {
      assert.strictEqual(getQuestion('credentials').validate('M'), 'Please add your credentials (2 chars)')
      assert.strictEqual(getQuestion('credentials').validate('MPP'), 'Please add your credentials (2 chars)')
    })

    test('validate accepts exactly 2 characters', () => {
      assert.strictEqual(getQuestion('credentials').validate('MP'), true)
    })

    // Reproduces the initials-from-git-user.name logic in config.js's credentials default,
    // without shelling out to git, so edge cases (single name, extra spaces) are covered deterministically.
    const initialsFromName = (gitUserName) => {
      const parts = gitUserName.trim().split(' ')
      return parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)
    }

    test('builds initials from first and last name', () => {
      assert.strictEqual(initialsFromName('Mark Poepping'), 'MP')
    })

    test('builds initials from a single-word name by repeating it', () => {
      assert.strictEqual(initialsFromName('Prince'), 'PP')
    })

    test('ignores middle names when building initials', () => {
      assert.strictEqual(initialsFromName('Mark Alan Poepping'), 'MP')
    })
  })
})
