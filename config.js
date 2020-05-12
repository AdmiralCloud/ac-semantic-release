const _ = require('lodash')

const util = require('util');
const exec = util.promisify(require('child_process').exec);


const config = {
  selectedType: undefined,
  templates: {
    templateEntry: __dirname + '/templates/templateEntry.ejs',
    templateSection: __dirname + '/templates/templateSection.ejs',
    templateCommit: __dirname + '/templates/templateCommit.ejs',
    templateBreaking: __dirname + '/templates/templateBreaking.ejs'
  },
  changelogFile: 'path-to-changelog',
  types: [
    {value: 'fix',      name: 'fix:      A bug fix', changelog: 'Bug Fix', order: 10 },
    {value: 'feat',     name: 'feat:     A new feature', changelog: 'Feature', order: 1 },
    {value: 'chore',    name: 'chore:    Changes to the build process or auxiliary tools\n            and libraries such as documentation generation', changelog: 'Chores', order: 92},
    {value: 'package',  name: 'package:  Package update', changelog: 'Chores', order: 92},
    {value: 'test',     name: 'test:     Adding missing tests', changelog: 'Tests', order: 80 },
    {value: 'docs',     name: 'docs:     Documentation only changes', changelog: 'Documentation', order: 90},
    {value: 'style',    name: 'style:    Changes that do not affect the meaning of the code\n            (white-space, formatting, missing semi-colons, etc)', changelog: 'Style', order: 91},
    {value: 'refactor', name: 'refactor: A code change that neither fixes a bug nor adds a feature', changelog: 'Refactor', order: 60 },
    {value: 'perf',     name: 'perf:     A code change that improves performance', changelog: 'Performance', order: 51},
    {value: 'revert',   name: 'revert:   Revert to a commit', changelog: 'Revert', order: 20},
    {value: 'WIP',      name: 'WIP:      Work in progress'}
  ],
  sections: [
    { name: 'App' },
    { name: 'Misc' },
  ],
  questions: [
    {
      type: 'list',
      name: 'type',
      message: 'Select type of your comnit',
      choices: () => {
        return _.map(config.types, (item) => {
          return {
            name: _.get(item, 'name'),
            value: _.get(item, 'value')
          }
        })
      }
    },
    {
      type: 'rawlist',
      name: 'section',
      message: 'Select section',
      choices: () => {
        return _.map(config.sections, (item) => {
          return {
            name: _.get(item, 'name'),
            value: _.get(item, 'name')
          }
        })
      },
      when: (val) => {
        config.selectedType = val.type
      }
    },
    {
      type: 'input',
      name: 'title',
      message: 'Write a SHORT, IMPERATIVE tense description of the change',
      validate: (value) => {
        if (value.length > 5) return true
        return 'Please add a title with more than 5 characters'
      },
      default: () => {
        if (config.selectedType === 'package') return 'Updated packages'
        else if (process.env.NODE_ENV === 'test') return 'My commit title'
      }
    },
    {
      type: 'input',
      name: 'description',
      message: 'Provide a good LONGER description of the change. Use "|" to break new line',
      validate: (value) => {
        if (value.length > 5) return true
        return 'Please add a significant description'
      },
      default: () => {
        if (config.selectedType === 'package') return 'Updated packages'
        else if (process.env.NODE_ENV === 'test') return 'My commit description'
      }
    },
    {
      type: 'input',
      name: 'links',
      message: 'List any ISSUES RELATED to this change (optional). E.g.: #31, admiralcloud/otherpackage#34 - will be added to body',
      default: () => {
        if (process.env.NODE_ENV === 'test') return '#1, mmpro/ac-api-server#340'
      }
    },
    {
      type: 'input',
      name: 'breaking',
      message: 'List any BREAKING CHANGES (optional)',
    },
    {
      type: 'input',
      name: 'credentials',
      message: 'Your initials please - they will become part of the changelog',
      validate: (value) => {
        if (value.length === 2) return true
        return 'Please add your credentials (2 chars)'
      },
      default: async() => {
        const { stdout } = await exec('git config user.name')
        let parts = _.split(stdout, ' ')
        let initials = _.first(parts).substr(0, 1) + _.last(parts).substr(0, 1)
        return initials
      }
    }
  ]
}

module.exports = config