# AC Semantic Release
AdmiralCloud Semantic Release Manager makes sure your commits and release follow semantic versioning guidelines.

[![Node.js CI](https://github.com/AdmiralCloud/ac-semantic-release/actions/workflows/node.js.yml/badge.svg)](https://github.com/AdmiralCloud/ac-semantic-release/actions/workflows/node.js.yml) [![CodeQL](https://github.com/AdmiralCloud/ac-semantic-release/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/AdmiralCloud/ac-semantic-release/actions/workflows/github-code-scanning/codeql)

## BREAKING CHANGE version 2
Version 2 requires Node 22+.

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

test-release:
	DEBUGMODE=true node ./node_modules/ac-semantic-release/lib/release.js  
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

***PRO TIP No 1***   
You can check what the release would look like using environment variable DEBUGMODE:
```
export DEBUGMODE=true
@node ./node_modules/ac-semantic-release/lib/release.js
```

***PRO TIP No 2***
In case commit messags turn out to be incorrect, you might want to use a fixed version (instead of auto semantic versioning). Now this module supports that function by exporting a fixed version, e.g. export FIXEDVERSION=1.0.0.

## Dependabot audit
Checks the open Dependabot alerts of your repository (GitHub reports them for the default branch) against the lockfile of your current checkout. Run it before opening a PR to see whether your branch actually fixes them.

```
Example Makefile

audit:
	@node ./node_modules/ac-semantic-release/lib/audit.js
```

+ supports yarn.lock (v1 and berry), package-lock.json and npm-shrinkwrap.json
+ in monorepos each alert is checked against the lockfile next to its manifest
+ the GitHub token is taken from GITHUB_TOKEN, GH_TOKEN or `gh auth token` - it needs read access to Dependabot alerts
+ exit code 0 = ok, 1 = vulnerable packages at or above the threshold, 2 = error (no token, no access)

Options: `--fail-on low|medium|high|critical` (or env AUDIT_FAIL_ON), `--ignore GHSA-...,CVE-...,package`, `--lockfile path`, `--repo owner/name`, `--json`

Defaults can be set in the `audit` block of your .acsemver.js (see Customizing below). You only need the keys you want to change. With `beforeRelease: true`, "make release" runs the audit first and aborts if it fails (DEBUGMODE only reports).
```
audit: {
  failOn: 'high', // only high and critical fail, low and medium are still listed
  ignore: [{ id: 'GHSA-xxxx-xxxx-xxxx', reason: 'dev only, not reachable' }], // GHSA id, CVE id or package name
  beforeRelease: true
}
```

Command line options and env variables override .acsemver.js for a single run. `--ignore` adds to the ignore list from .acsemver.js instead of replacing it.
```
node ./node_modules/ac-semantic-release/lib/audit.js --fail-on critical
AUDIT_FAIL_ON=critical make audit
node ./node_modules/ac-semantic-release/lib/audit.js --ignore GHSA-aaaa-bbbb-cccc,lodash
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
  },
  changelogFile: __dirname + '/CHANGELOG.md',
  sections: [
    {name: 'Misc' },
    ... // optional more
  ]
}
```

Please take a look at the config file in this repo to see all config options. You can change types, templates (EJS), section and questions (during commit).

### How the configuration is merged
Do not edit config.js in node_modules. The commit, release and audit commands load `.acsemver.js` from the directory they are started in and deep merge it (lodash.merge) over the defaults from config.js. Keys you leave out keep their default values.

+ run the commands from your repository root - the Makefile targets above do that
+ arrays are merged by position, not replaced: if a default array has two entries and you set only one, the second default entry stays

## Thanks
We have been using semantic-release package for a long time but created our own release management because we needed more control over dependencies and did not need all the functionalities. Still, this package is highly inspired by the great work of the semantic-release team.

## Links
- [Website](https://www.admiralcloud.com/)
- [Twitter (@admiralcloud)](https://twitter.com/admiralcloud)
- [Facebook](https://www.facebook.com/MediaAssetManagement/)

## License

[MIT License](https://opensource.org/licenses/MIT) Copyright © 2009-present, AdmiralCloud AG, Mark Poepping