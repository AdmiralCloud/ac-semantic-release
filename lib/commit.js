const util = require('util');
const exec = util.promisify(require('child_process').exec)

const { default: inquirer } = require('inquirer')

const pjson = require(process.env.PWD + '/package.json')

const config = require('../config')

const deepMerge = (target, source) => {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

try {
  const customConfig = require(process.env.PWD + '/.acsemver')
  deepMerge(config, customConfig)
}
catch {
  // no custom config
}

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const pad = (str, len, char = ' ') => {
  const total = len - str.length
  if (total <= 0) return str
  const left = Math.floor(total / 2)
  const right = total - left
  return char.repeat(left) + str + char.repeat(right)
}

const escapeDoubleQuotes = (notes) => `${notes}`.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")

const repositoryUrl = config?.repository?.url ||
  (pjson.repository && typeof pjson.repository === 'object'
    ? (pjson.repository.url || '').replace('.git', '')
    : pjson.repository)
const jiraInstanceUrl = config?.jira?.url

const padLength = config.padLength ?? 20

// ENVIRONEMT OPTIONS
const debugMode = process.env.DEBUGMODE || false
const commit = async () => {
  console.log('')
  console.log(pad('  Commit Management  ', 80, '*'))
  console.log('')
  console.log('Affected files in this commit')

  const retrieveList = async () => {
    const parseRegExp = /^(.)(.)\s+?(.*)$/
    const { stdout, stderr } = await exec('git status -s')
    if (stdout === '' && stderr === '') {
      console.log('Nothing to commit. Good-bye.')
      process.exit(0)
    }
    if (stderr) { throw new Error(stderr) }

    if (!stdout) { return }
    const list = stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [, codeX, codeY, fileName] = parseRegExp.exec(line)
        const hasAdded = !/[!?]/.test(codeX)
        const styledCodeX = hasAdded ? green(codeX) : red(codeX)
        const styledCodeY = red(codeY)
        const checked = hasAdded && !codeY.trim()
        // For renamed files ("old -> new"), use only the new filename for git add
        const addFileName = fileName.includes(' -> ') ? fileName.split(' -> ')[1] : fileName
        return {
          checked,
          value: addFileName,
          name: `${styledCodeX}${styledCodeY} ${fileName}`,
        }
      })
    return list
  }

  const selectFiles = async ({ list }) => {
    const { files } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'files',
        message: 'git add',
        choices: list,
      }
    ])

    const addCommand = `git add -A -- ${files.join(' ')}`
    const { stderr } = await exec(addCommand)
    if (stderr && stderr.startsWith('Nothing specified, nothing added.')) {
      console.log('Nothing to commit. Good-bye.')
      process.exit(0)
    }
    if (stderr) { throw new Error(stderr) }
  }

  const checkBranch = async () => {
    const { stdout, stderr } = await exec('git diff --name-only --cached')
    if (stderr) { throw new Error(stderr) }
    if (!stdout) {
      console.log('You have not selected anything to commit. Please seleect files')
      console.log('')
      process.exit(0)
    }
    console.log(stdout)
    console.log('')
  }

  const collectInfo = async () => {
    const answers = await inquirer.prompt(config.questions)
    let title = `${answers?.type}(${answers?.section}): ${answers?.title} | ${answers?.credentials}`

    let body = answers.description
    body = body.replace(/\|/, '\n')
    if (answers.links) {
      const links = answers.links.split(',')
      const validLinks = links.filter(link => link && link.trim())

      if (validLinks.length) {
        body += '\nRelated issues:\n'
        for (const link of validLinks) {
          const trimmedLink = link.trim()
          if (trimmedLink.startsWith('[')) {
            // JIRA link
            const jiraId = trimmedLink.replace('[', '').replace(']', '')
            if (jiraId) {
              body += ('- ' + jiraInstanceUrl + '/browse/' + jiraId + '\n').padStart(8)
              // put JIRA Issue at start of title
              title = `${trimmedLink}  ${title}`
            }
          }
          else if (trimmedLink.startsWith('#')) {
            // add repo url
            const issueNumber = trimmedLink.replace('#', '')
            if (issueNumber) {
              body += ('- ' + repositoryUrl + '/issues/' + issueNumber + '\n').padStart(8)
            }
          }
          else {
            const issue = trimmedLink.split('#')
            if (issue.length === 2 && issue[0] && issue[1]) {
              body += ('- https://github.com/' + issue[0].trim() + '/issues/' + issue[1] + '\n').padStart(8)
            }
          }
        }
      }
    }
    if (answers.breaking) {
      body += '\nBREAKING: ' + answers.breaking
    }


    console.log('')
    console.log(pad('  Preview of your commit  ', 80, '*'))
    console.log('Title')
    console.log(title)
    console.log('')
    console.log('Body')
    console.log(body)
    console.log('*'.repeat(80))
    console.log('')


    const confirmation = [{
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to confirm this commit?',
      default: false
    }]
    const confirmAnswers = await inquirer.prompt(confirmation)
    console.log('')
    if (confirmAnswers.confirm) {
      if (debugMode) {
        console.log('%s | Nothing committed. Good-bye.', 'DEBUGMODE'.padEnd(padLength))
        process.exit(0)
      }

      const command = `git commit -m "${escapeDoubleQuotes(title)}" -m "${escapeDoubleQuotes(body)}"`
      try {
        await exec(command)
        console.log('%s | Thank you and good-bye.', 'COMMITED'.padEnd(padLength))
        process.exit(0)
      } catch (err) {
        throw new Error(err)
      }
    }
    else {
      console.log('%s | Nothing committed. Good-bye.', 'ABORTED'.padEnd(padLength))
      process.exit(0)
    }
  }

  const list = await retrieveList()
  await selectFiles({ list })
  await checkBranch()
  await collectInfo()
}

commit()
