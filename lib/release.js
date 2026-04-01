const { exec: execCb } = require('child_process')
const util = require('util')
const exec = util.promisify(execCb)
const fs = require('fs').promises

const pjson = require(process.env.PWD + '/package.json')

const config = require('../config')
try {
  const customConfig = require(process.env.PWD + '/.acsemver')
  Object.assign(config, customConfig)
}
catch {
  // no custom config
}

const repositoryUrl = config?.repository?.url ||
  (pjson.repository && typeof pjson.repository === 'object'
    ? (pjson.repository.url || '').replace('.git', '')
    : pjson.repository)
const changelogFile = config.changelogFile

const padLength = config.padLength ?? 20

// ENVIRONEMT OPTIONS
const debugMode = process.env.DEBUGMODE || false

// FIXED VERSION
const fixedVersion = process.env.FIXEDVERSION

const escapeDoubleQuotes = (notes) => `${notes}`.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")

const pad = (str, len, char = ' ') => {
  const total = len - str.length
  if (total <= 0) return str
  const left = Math.floor(total / 2)
  const right = total - left
  return char.repeat(left) + str + char.repeat(right)
}

// Inline changelog templates (replaces EJS template files + lodash.template)
const renderEntry = ({ release, version, repositoryUrl, tag, newTag, dateTime }) => {
  const heading = release === 'Patch' ? '##' : '#'
  return `${heading} [${version}](${repositoryUrl}/compare/${tag}..${newTag}) (${dateTime})\n\n\n`
}
const renderSection = ({ prettyType }) => `### ${prettyType}\n\n\n`
const renderCommit = ({ section, title, commit, repositoryUrl, body }) =>
  `* **${section}:** ${title} | [${commit}](${repositoryUrl}/commit/${commit})    \n${body || ''}\n`
const renderBreaking = ({ section, breaking }) => `* **${section}:** ${breaking}\n`

// RELEASE
const release = async () => {
  console.log('')
  console.log(pad('  Release Management  ', 80, '*'))
  console.log('')

  let tag
  let newTag
  let currentSemver = { major: 0, minor: 0, patch: 0 }
  let breaking
  let commits = []
  let releaseNotes = ''

  // Step 1: fetch latest tag
  try {
    const { stdout } = await exec('git tag | sort -V | tail -1')
    if (stdout) {
      const regex = /^v\d{1,}\.\d{1,}\.\d{1,}/i
      tag = stdout.match(regex)?.[0]
      if (tag) {
        const elements = tag.replace('v', '').split('.')
        currentSemver = {
          major: parseInt(elements[0]),
          minor: parseInt(elements[1]),
          patch: parseInt(elements[2])
        }
      }
    }
  } catch (err) {
    if (err?.code !== 128) throw err
  }

  // Step 2: fetch commits
  {
    const command = tag ? `git log ${tag}..HEAD` : 'git log'
    const { stdout } = await exec(command)

    const lines = stdout.split('\n')
    const titleRegex = /(\w*)\((\w.*)\):\s(.*)/i

    let commit = {}
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (line.startsWith('commit')) {
        if (Object.keys(commit).length > 0) {
          commit.body = (commit.body || '').trim()
          commits.push(commit)
        }
        commit = { commit: line.replace('commit ', ''), repositoryUrl }
      }
      else if (line.startsWith('Author:')) {
        commit.author = line.replace('Author: ', '')
      }
      else if (line.startsWith('Date:')) {
        commit.date = line.replace('Date: ', '').trim()
      }
      else if (titleRegex.test(line)) {
        const elements = line.match(titleRegex)
        commit.type = elements[1]
        commit.section = elements[2]
        commit.title = elements[3]
      }
      else if (line.startsWith('Merge:')) {
        commit.merge = true
      }
      else if (line === '') {
        // do nothing
      }
      else {
        if (!commit.body) {
          commit.body = line + '  \n'
        }
        else if (line.startsWith('BREAKING')) {
          commit.breaking = line.replace('BREAKING: ', '').trim()
          breaking = true
        }
        else if (line.startsWith('Related issues')) {
          commit.body += 'Related issues: '
        }
        else if (line.startsWith('-')) {
          const elements = line.split('/')
          const repoAccount = elements[3]
          const repoName = elements[4]
          if (repoAccount && repoName && !line.includes('undefined')) {
            const repo = repoAccount + '/' + repoName
            commit.body += '[' + repo + '#' + elements[elements.length - 1] + '](' + line.replace('-', '').trim() + ') '
          }
        }
        else {
          commit.body += line + '  \n'
        }
      }
    }
    commit.body = (commit.body || '').trim()
    commits.push(commit)

    // remove commits without title and merge commits
    commits = commits.filter(c => c.title && !('merge' in c))
  }

  // Step 3: determine release type and build changelog
  {
    // order by type
    commits = commits.sort((a, b) => {
      const orderA = config.types.find(t => t.value === a.type)?.order ?? 999
      const orderB = config.types.find(t => t.value === b.type)?.order ?? 999
      return orderA - orderB
    })

    const breakingChanges = commits.filter(c => c.breaking)

    // groupBy type
    const groupedCommits = commits.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = []
      acc[c.type].push(c)
      return acc
    }, {})

    let releaseType
    if (breaking) {
      currentSemver.major += 1
      currentSemver.minor = 0
      currentSemver.patch = 0
      releaseType = 'Minor' // only for font size!
    }
    else if (groupedCommits.feat) {
      currentSemver.minor += 1
      currentSemver.patch = 0
      releaseType = 'Minor'
    }
    else if (groupedCommits.fix || config.types.some(t => t.releaseAs === 'fix' && groupedCommits[t.value])) {
      currentSemver.patch += 1
      releaseType = 'Patch'
    }

    if (!releaseType) {
      console.log('No release necessary')
      process.exit(0)
    }

    newTag = `v${currentSemver.major}.${currentSemver.minor}.${currentSemver.patch}`
    if (fixedVersion && /\d{1,}\.\d{1,}\.\d{1,}/.test(fixedVersion)) newTag = 'v' + fixedVersion

    const version = newTag.replace('v', '')
    pjson.version = version

    if (!debugMode) {
      console.log('%s: %s', 'Release type'.padEnd(padLength), releaseType)
      console.log('%s: %s', 'Current tag'.padEnd(padLength), tag)
      console.log('%s: %s', 'New tag'.padEnd(padLength), newTag)
      console.log('')
    }

    let changelog = ''
    const dateTime = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
    changelog += renderEntry({ release: releaseType, version, repositoryUrl, tag, newTag, dateTime })
    releaseNotes = releaseType + '\n\n'

    for (const [type, messages] of Object.entries(groupedCommits)) {
      const prettyType = config.types.find(t => t.value === type)?.changelog
      changelog += renderSection({ prettyType })
      releaseNotes += (prettyType || '').toUpperCase() + '\n'

      for (const commit of messages) {
        changelog += renderCommit(commit)
        releaseNotes += commit.title + '\n'
      }
    }

    if (breakingChanges.length) {
      changelog += '## BREAKING CHANGES\n'
      releaseNotes += '\nBREAKING CHANGES\n'
      for (const commit of breakingChanges) {
        changelog += renderBreaking(commit)
        releaseNotes += commit.breaking
      }
    }

    if (debugMode) {
      console.log(pad('  DEBUGMODE: Changelog  ', 80, '*'))
      console.log(changelog)
      console.log(pad('  DEBUGMODE: Release Notes  ', 80, '*'))
      console.log(releaseNotes)
      console.log(pad('  DEBUGMODE: Release Info  ', 80, '*'))
      console.log('%s: %s', 'Release type'.padEnd(padLength), releaseType)
      console.log('%s: %s', 'Current tag'.padEnd(padLength), tag)
      console.log('%s: %s', 'New tag'.padEnd(padLength), newTag)
      console.log('')
      process.exit(0)
    }

    // Prepend to changelog file
    let existingLog = ''
    try {
      existingLog = await fs.readFile(changelogFile, 'utf8')
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err
    }
    console.log('%s: %s', 'Write changelog'.padEnd(padLength), changelogFile)
    await fs.writeFile(changelogFile, changelog + existingLog)
  }

  // Step 4: update package.json
  console.log('%s: %s', 'Update package file'.padEnd(padLength), pjson.version)
  await fs.writeFile(process.env.PWD + '/package.json', JSON.stringify(pjson, null, 2))

  // Step 5: commit, tag and push
  await exec('git add package.json CHANGELOG.md')
  const releaseMessage = `chore(release): ${newTag} [ci skip]`
  console.log('%s: %s', 'Release'.padEnd(padLength), releaseMessage)
  await exec(`git commit -m "${escapeDoubleQuotes(releaseMessage)}"`)
  await exec(`git tag ${newTag} -m "${escapeDoubleQuotes(releaseNotes)}"`)
  await exec('git push')
  await exec('git push --tags')
}

release().then(() => process.exit(0)).catch(err => { throw new Error(err) })
