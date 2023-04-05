const _ = require('lodash')

const util = require('util');
const exec = util.promisify(require('child_process').exec)

const chalk = require('chalk')
const inquirer = require('inquirer');

const pjson = require(process.env.PWD + '/package.json')

let config = require('../config')
try {
  const customConfig = require(process.env.PWD + '/.acsemver')
  _.merge(config, customConfig)
}
catch(e) {
  // no custom config
}

const repositoryUrl = _.get(config, 'repository.url') || (_.isObject(pjson.repository) ? _.get(pjson, 'repository.url', '').replace('.git', '') : _.get(pjson, 'repository'))
const jiraInstanceUrl = _.get(config, 'jira.url')

const padLength = _.get(config, 'padLength', 20)

// ENVIRONEMT OPTIONS
const debugMode = process.env.DEBUGMODE || false
const commit = async() => {
  console.log('')
  console.log(_.pad('  Commit Management  ', 80, '*'))
  console.log('')
  console.log('Affected files in this commit')

  const retrieveList = async() => {
    const parseRegExp = /^(.)(.)\s+?(.*)$/
    const { stdout, stderr } = await exec('git status -s')
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
  
  const selectFiles = async({ list }) => {
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
    if (stderr) { throw new Error(stderr) }
  }

  const checkBranch = async() => {
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

  const collectInfo = async() => {
    await inquirer.prompt(_.get(config, 'questions')).then(answers => {    
      let title = _.get(answers, 'type') + '(' + _.get(answers, 'section') + ')' + ': ' +_.get(answers, 'title') + ' | ' + _.get(answers, 'credentials')
      
      let body = _.get(answers, 'description')
      body = body.replace('|', '\n')
      if (_.get(answers, 'links')) {
        body += '\nRelated issues:\n'
        let links = _.split(_.get(answers, 'links'), ',')
        _.forEach(links, link => {
          if (_.startsWith(link, '[')) {
            // JIRA link
            body += _.padStart('- ' + jiraInstanceUrl + '/browse/' + link.replace('[', '').replace(']', '') + '\n', 8)
            // put JIRA Issue at start of title
            title = link + ' ' + title
          }
          else if (_.startsWith(link, '#')) {
            // add repo url
            body += _.padStart('- ' + repositoryUrl + '/issues/' + link.replace('#', '') + '\n', 8)
          }
          else {
            let issue = _.split(link, '#')
            body += _.padStart('- https://github.com/' + _.trim(_.get(issue, '[0]')) + '/issues/' + _.get(issue, '[1]') + '\n', 8)
          }
        })
      }
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


      const confirmation = [{
        type: 'confirm',
        name: 'confirm',
        message: 'Do you want to confirm this commit?',
        default: false
      }]
      inquirer.prompt(confirmation).then(answers => {
        console.log('')
        if (_.get(answers, 'confirm')) {
          if (debugMode) {
            console.log('%s | Nothing committed. Good-bye.',  _.padEnd('DEBUGMODE', padLength))
            process.exit(0)
          }
          
          const command = 'git commit -m "' + title + '" -m "' + body + '"'
          exec(command, (err) => {
            if (err) throw new Error(err)
            console.log('%s | Thank you and good-bye.',  _.padEnd('COMMITED', padLength))
            process.exit(0)
          })
        }
        else {
          console.log('%s | Nothing committed. Good-bye.',  _.padEnd('ABORTED', padLength))
          process.exit(0)
        }
        /*
        if (debugMode) {
        console.log(_.pad('  DEBUGMODE: Commit  ', 80, '*'))
        console.log('%s | %s', _.padEnd('Title', padLength), title)
        console.log('%s | %s', _.padEnd('Body', padLength), body)
        return done()
      }
      
      const command = 'git commit -m "' + title + '" -m "' + body + '"'
      exec(command, (err) => {
        if (err) done(err)
        console.log('')
        console.log(_.pad('  Commit receipt  ', 80, '*'))
        console.log('%s | %s', _.padEnd('Title', padLength), title)
        console.log('%s | %s', _.padEnd('Body', padLength), body)
        process.exit()
      })
      */

      })
    })
  }

  const list = await retrieveList()
  await selectFiles({ list })
  await checkBranch()
  await collectInfo()
}

commit()