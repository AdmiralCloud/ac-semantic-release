const exec = require('child_process').exec
const async = require('async')
const _ = require('lodash')

const fs = require('fs')

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
const changelogFile = _.get(config, 'changelogFile')

const templateEntry = fs.readFileSync(_.get(config, 'templates.templateEntry'))
const templateSection = fs.readFileSync(_.get(config, 'templates.templateSection'))
const templateCommit = fs.readFileSync(_.get(config, 'templates.templateCommit'))
const templateBreaking = fs.readFileSync(_.get(config, 'templates.templateBreaking'))

const padLength = _.get(config, 'padLength', 20)

// ENVIRONEMT OPTIONS
const debugMode = process.env.DEBUGMODE || false

// RELEASE
const release = () => {
  console.log('')
  console.log(_.pad('  Release Management  ', 80, '*'))
  console.log('')

  let tag
  let newTag
  let currentSemver = {
    major: 0,
    minor: 0,
    patch: 0
  }
  let breaking
  let commits = []
  let releaseNotes = ''

  async.series({
    fetchLatesteTag: (done) => {
      exec('git tag | sort -V | tail -1', (err, stdout) => { // v5.14.4..HEAD
        if (err) {
          if (_.get(err, 'code') === 128) return done() // no tags yet
          return done(err)
        }
        if (!stdout) return done()

        //  v5.14.4-5-g6fa7aa445
        const regex = /^v\d{1,}\.\d{1,}\.\d{1,}/i
        tag = _.first(stdout.match(regex))
        const elements = _.split(tag.replace('v', ''), '.')
        currentSemver = {
          major: parseInt(_.get(elements, [0])),
          minor: parseInt(_.get(elements, [1])),
          patch: parseInt(_.get(elements, [2]))
        }
        return done()
      });      
    },
    fetchCommits: (done) => {
      let command = tag ? 'git log ' + tag + '..HEAD' : 'git log'
      exec(command, (err, stdout) => {
        if (err) return done(err)

        const lines = _.split(stdout, '\n')
        const titleRegex = /(\w*)\((\w.*)\):\s(.*)/i
     
        let commit = {}
        _.forEach(lines, line => {
          line = _.trim(line)
          if (_.startsWith(line, 'commit')) {
            if (!_.isEmpty(commit)) {
              commit.body = _.trim(commit.body)
              commits.push(commit)
            }
            // a new commit has started
            commit = {
              commit: line.replace('commit ', ''),
              repositoryUrl
            }
          }
          else if (_.startsWith(line, 'Author:')) {
            _.set(commit, 'author', line.replace('Author: ', ''))
          }
          else if (_.startsWith(line, 'Date:')) {
            let date = _.trim(line.replace('Date: ', ''))
            _.set(commit, 'date', date)
          }
          else if (titleRegex.test(line)) {
            const elements = line.match(titleRegex)
            _.set(commit, 'type', _.get(elements, '[1]'))
            _.set(commit, 'section', _.get(elements, '[2]'))
            _.set(commit, 'title', _.get(elements, '[3]'))
          }
          else if (_.startsWith(line, 'Merge:')) {
            // merge commit should be removed, therefore mark them
            _.set(commit, 'merge', true)
          }
          else if (line ==='') {
            // do nothing
          }
          else {
            // body
            if (!commit.body) {
              commit.body = line + '  \n'
            }
            else if (_.startsWith(line, 'BREAKING')) {
              commit.breaking = _.trim(line.replace('BREAKING: ', ''))
              breaking = true
            }
            else if (_.startsWith(line, 'Related issues')) {
              commit.body += 'Related issues: '
            }
            else if (_.startsWith(line, '-')) {
              // these are links to issues: https://github.com/ACCOUNT/REPO/issues/340
              let elements = _.split(line, '/')
              const repo = _.get(elements, '[3]') + '/' + _.get(elements, '[4]')
              commit.body += '[' + repo + '#' + _.last(elements) + '](' + _.trim(line.replace('-', '')) + ') '
            }
            else {
              commit.body += line + '  \n'
            }
          }
        })
        commit.body = _.trim(commit.body)
        commits.push(commit)
 
        // remove commits without title (e.g. merge)
        commits = _.filter(commits, 'title')
        // remove merge commits
        commits = _.filter(commits, item => {
          if (!_.has(item, 'merge')) return item
        })
        return done()
      })
    },
    checkRelease: (done) => {
      // order by type
      commits = _.orderBy(commits, c => _.get(_.find(_.get(config, 'types'), { value: c.type }), 'order'))
      
      const breakingChanges = _.filter(commits, 'breaking')
      commits = _.groupBy(commits, 'type')

      // check release type
      let release
      if (breaking) {
        currentSemver.major += 1
        currentSemver.minor = 0
        currentSemver.patch = 0
        release = 'Minor' // only for font size!
      }
      else if (_.get(commits, 'feat')) {
        currentSemver.minor += 1
        currentSemver.patch = 0
        release = 'Minor'
      }
      else if (_.get(commits, 'fix')) {
        currentSemver.patch += 1
        release = 'Patch'
      }

      if (!release) {
        console.log('No release necessary')
        return done(900)
      }
     
      newTag = 'v' + _.get(currentSemver, 'major') + '.' + _.get(currentSemver, 'minor') + '.' + _.get(currentSemver, 'patch')
      let version = newTag.replace('v', '')
      _.set(pjson, 'version', version)

      if (!debugMode) {
        console.log('%s: %s', _.padEnd('Release type', padLength), release)
        console.log('%s: %s', _.padEnd('Current tag', padLength), tag)
        console.log('%s: %s', _.padEnd('New tag', padLength), newTag)
        console.log('')
      }

      let changelog = ''
      let compiled = _.template(templateEntry)
      let placeholder = {
        release,
        version,
        repositoryUrl,
        tag,
        newTag,
        dateTime: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
      }
      changelog += compiled(placeholder)  
      releaseNotes = release + '\n\n'

      // section/types (e.g. fix, feature)
      _.forEach(commits, (messages, type)  => {
        let compiled = _.template(templateSection)
        let prettyType = _.get(_.find(_.get(config, 'types'), { value: type }), 'changelog')
        changelog += compiled({ prettyType })
        releaseNotes += _.toUpper(prettyType) + '\n'
        
        // Commits 
        _.forEach(messages, commit => {
          let compiled = _.template(templateCommit)
          changelog += compiled(commit)
          releaseNotes += commit.title + '\n'
        })
      })

      // breaking chagens
      if (_.size(breakingChanges)) {
        changelog += '## BREAKING CHANGES\n'
        releaseNotes += '\nBREAKING CHANGES\n'
        _.forEach(breakingChanges, commit => {
          let compiled = _.template(templateBreaking)
          changelog += compiled(commit)  
          releaseNotes += commit.breaking
        })
      }

      if (debugMode) {
        console.log(_.pad('  DEBUGMODE: Changelog  ', 80, '*'))
        console.log(changelog)
        console.log(_.pad('  DEBUGMODE: Release Notes  ', 80, '*'))
        console.log(releaseNotes)
        console.log(_.pad('  DEBUGMODE: Release Info  ', 80, '*'))
        console.log('%s: %s', _.padEnd('Release type', padLength), release)
        console.log('%s: %s', _.padEnd('Current tag', padLength), tag)
        console.log('%s: %s', _.padEnd('New tag', padLength), newTag)
        console.log('')
        return done()
      }

      // Prepend to changelog file
      fs.readFile(changelogFile, (err, result) => {
        if (err) {
          if (_.get(err, 'code') !== 'ENOENT') return done(err)
        }
        let log = changelog + (result && result.toString())
        console.log('%s: %s', _.padEnd('Write changelog', padLength), changelogFile)
        fs.writeFile(changelogFile, log, done)
      })
    },
    updatePackageFile: (done) => {
      if (debugMode) return done()
      // update package json
      console.log('%s: %s', _.padEnd('Update package file', padLength), pjson.version)
      fs.writeFile(process.env.PWD + '/package.json', JSON.stringify(pjson, null, 2), done)
    },
    mergeAndPush: (done) => {
      if (debugMode) return done()
      exec('git add package.json CHANGELOG.md', (err) => {
        if (err) return done(err)
        const releaseMessage = 'chore(release): ' + newTag + ' [ci skip]'
        console.log('%s: %s', _.padEnd('Release', padLength),releaseMessage)
        exec('git commit -m "' + releaseMessage + '"', (err) => {
          if (err) return done(err)
          exec('git tag ' + newTag + ' -m "' + releaseNotes + '"', (err) => {
            if (err) return done(err)
            exec('git push', err => {
              if (err) return done(err)
              exec('git push --tags', done)
            })
          })
        })
      })
    }
  }, err => {
    if (err && err !== 900) {
      throw new Error(err)
    }
    process.exit(0)
  })
}

release()