module.exports = {
  repository: {
    url: 'https://github.com/admiralcloud/ac-semantic-release'
  },
  jira: {
    url: 'https://admiralcloud.atlassian.net'
  },
  changelogFile: __dirname + '/CHANGELOG.md',
  scopes: [
    { name: 'App' },
  ]
}
