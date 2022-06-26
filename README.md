# AC Semantic Release
AdmiralCloud Semantic Release Manager makes sure your commits and release follow semantic versioning guidelines.

## Why use this package
First of all, it is always a good idea to use semantic versioning for your repositories and make the process as easy as possible for all your developers and contributors.

It has few dependencies and is actively maintained as we use it in our AdmiralCloud release management.

# Usage
Install using yarn add ac-semantic-release

You can then add the commands for committing and releasing into your package.json or into a Makefile.

```
Example Makefile

commit:
	@node ./node_modules/ac-semantic-release/lib/commit.js

release:
	@node ./node_modules/ac-semantic-release/lib/release.js
```

## Committing
Add the files you want to commit using CLI command or any GUI (e.g. Source Tree). Then instead of "git commit -m SOME MESSAGE" you simply type "make commit".

You will then be guided through some questings regarding the type of your commit, sections etc. After answering those, you will see a preview of your commit message and can then confirm that message.

That's it.

## Releasing a new version/new tag
In order to create a new release use "make release" (if you have created the Makefile like mentioned above).

This process will
+ fetch all commits since the latest tag/release
+ create a meaningfuk changelog from the commit messages
+ check if a release is necessary
+ update the package.json with the new version number/tag
+ commit the changelog and the package.json
+ create the new tag
+ push the commit and the tag

***PRO TIP***   
You can check what the release would look like using environment variable DEBUGMODE:
```
export DEBUGMODE=true
@node ./node_modules/ac-semantic-release/lib/release.js
```


## Customizing
It is highly recommended that you create a configuration file in your actual repository. Please name it ".acsemver.js" and make sure it is also part of your source control (in other words: commit it!)

The local configuration file should at least contain the following properties

```
module.exports = {
  repository: {
    url: 'https://github.com/ACCOUNT/REPO'
  },
  jira: {
    url: 'https://MY-INSTANCE.atlassian.net' // This is optional
  }
  changelogFile: __dirname + '/CHANGELOG.md',
  scopes: [
    {name: 'Misc' },
    ... // optional more
  ]
}
```

Please take a look at the config file in this repo to see all config options. You can change types, templates (EJS), section and questions (during commit).

## Thanks
We have been using semantic-release package for a long time but created our own release management because we needed more control over dependencies and did not need all the functionalities. Still, this package is highly inspired by the great work of the semantic-release team.

## Links
- [Website](https://www.admiralcloud.com/)
- [Twitter (@admiralcloud)](https://twitter.com/admiralcloud)
- [Facebook](https://www.facebook.com/MediaAssetManagement/)

## License

[MIT License](https://opensource.org/licenses/MIT) Copyright © 2009-present, AdmiralCloud AG, Mark Poepping