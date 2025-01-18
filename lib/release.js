const _ = require('lodash')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const chalk = require('chalk')
const inquirer = require('inquirer')

const pjson = require(process.env.PWD + '/package.json')
const config = require('../config')

try {
  const customConfig = require(process.env.PWD + '/.acsemver')
  _.merge(config, customConfig)
}
catch {
  // no custom config
}

const escapeDoubleQuotes = (notes) => `${notes}`.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
const repositoryUrl = _.get(config, 'repository.url') || (_.isObject(pjson.repository) ? _.get(pjson, 'repository.url', '').replace('.git', '') : _.get(pjson, 'repository'))
const jiraInstanceUrl = _.get(config, 'jira.url')
const padLength = _.get(config, 'padLength', 20)
const debugMode = process.env.DEBUGMODE || false

// Hilfsfunktion zum Verarbeiten der Links
const processLinks = (text, title) => {
  if (!text || !text.trim()) return { body: '', title }
  
  const links = _.split(text, ',')
  const validLinks = _.filter(links, link => link && link.trim())
  let body = ''
  
  if (validLinks.length) {
    body += '\nRelated issues:\n'
    _.forEach(validLinks, link => {
      const trimmedLink = link.trim()
      if (_.startsWith(trimmedLink, '[')) {
        // JIRA link
        const jiraId = trimmedLink.replace('[', '').replace(']', '')
        if (jiraId) {
          body += _.padStart('- ' + jiraInstanceUrl + '/browse/' + jiraId + '\n', 8)
          title = `${trimmedLink}  ${title}`
        }
      }
      else if (_.startsWith(trimmedLink, '#')) {
        // Repository issue
        const issueNumber = trimmedLink.replace('#', '')
        if (issueNumber) {
          body += _.padStart('- ' + repositoryUrl + '/issues/' + issueNumber + '\n', 8)
        }
      }
      else {
        // External GitHub issue
        const issue = _.split(trimmedLink, '#')
        if (issue.length === 2 && issue[0] && issue[1]) {
          body += _.padStart('- https://github.com/' + _.trim(issue[0]) + '/issues/' + issue[1] + '\n', 8)
        }
      }
    })
  }
  
  return { body, title }
}

const commit = async () => {
  console.log('')
  console.log(_.pad('  Commit Management  ', 80, '*'))
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
        const styledCodeX = chalk[hasAdded ? 'green' : 'red'](codeX)
        const styledCodeY = chalk.red(codeY)
        const checked = hasAdded && !codeY.trim()
        return {
          checked,
          value: fileName,
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

    const addCommand = `git add ${files.join(' ')}`
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
      console.log('You have not selected anything to commit. Please select files')
      console.log('')
      process.exit(0)
    }
    console.log(stdout)
    console.log('')
  }

  const collectInfo = async () => {
    const answers = await inquirer.prompt(_.get(config, 'questions'))
    let title = `${answers?.type}(${answers?.section}): ${answers?.title} | ${answers?.credentials}`
    let body = _.get(answers, 'description', '')
    body = body.replace('|', '\n')

    // Links verarbeiten
    const linkResult = processLinks(_.get(answers, 'links'), title)
    title = linkResult.title
    body += linkResult.body

    // Breaking Changes
    if (_.get(answers, 'breaking')) {
      body += '\nBREAKING: ' + _.get(answers, 'breaking')
    }

    console.log('')
    console.log(_.pad('  Preview of your commit  ', 80, '*'))
    console.log('Title')
    console.log(title)
    console.log('')
    console.log('Body')
    console.log(body)
    console.log(_.repeat('*', 80))
    console.log('')

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to confirm this commit?',
      default: false
    }])

    console.log('')
    if (confirm) {
      if (debugMode) {
        console.log('%s | Nothing committed. Good-bye.', _.padEnd('DEBUGMODE', padLength))
        process.exit(0)
      }

      const command = `git commit -m "${escapeDoubleQuotes(title)}" -m "${escapeDoubleQuotes(body)}"`
      try {
        await exec(command)
        console.log('%s | Thank you and good-bye.', _.padEnd('COMMITED', padLength))
        process.exit(0)
      }
 catch (err) {
        throw new Error(err)
      }
    }
    else {
      console.log('%s | Nothing committed. Good-bye.', _.padEnd('ABORTED', padLength))
      process.exit(0)
    }
  }

  const list = await retrieveList()
  await selectFiles({ list })
  await checkBranch()
  await collectInfo()
}

module.exports = {
  commit,
  processLinks, // Export für Tests
  escapeDoubleQuotes
}