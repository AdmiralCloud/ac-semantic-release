<a name="0.2.3"></a>

## [0.2.3](https://github.com/mmpro/ac-semantic-release/compare/v0.2.2..v0.2.3) (2020-09-22 13:12:32)


### Bug Fix

* **App:** Allow strings before fix/feature keyword | MP | [aa012639b8e4186def4569fef1aea447825ae0c8](https://github.com/mmpro/ac-semantic-release/commit/aa012639b8e4186def4569fef1aea447825ae0c8)    
In order to connect with JIRA, the title must start with the appropriate identifier [JRA-123] followed by the keyword (fix or feature).
### Chores

* **App:** Updated packages | MP | [14146a1ee644f16e6d16427bbd010d4ac9e4db45](https://github.com/mmpro/ac-semantic-release/commit/14146a1ee644f16e6d16427bbd010d4ac9e4db45)    
Updated packages
<a name="0.2.2"></a>

## [0.2.2](https://github.com/mmpro/ac-semantic-release/compare/v0.2.1..v0.2.2) (2020-07-19 07:25:10)


### Bug Fix

* **App:** Improved handling for Jira issues | MP | [5d6079d0d7f660ba3e9d2ee16cac8afd7d65c83d](https://github.com/mmpro/ac-semantic-release/commit/5d6079d0d7f660ba3e9d2ee16cac8afd7d65c83d)    
Put Jira issue ID at start of commit message
### Chores

* **App:** Updated packages | MP | [ae85d9f83197a0205b14df8a1a7e1067275c3efc](https://github.com/mmpro/ac-semantic-release/commit/ae85d9f83197a0205b14df8a1a7e1067275c3efc)    
Updated packages
<a name="0.2.1"></a>

## [0.2.1](https://github.com/mmpro/ac-semantic-release/compare/v0.2.0..v0.2.1) (2020-06-14 07:37:19)


### Bug Fix

* **App:** regex include whitespace | MD | [bdcd7139f169941569d2391eb2b1f79519b209e8](https://github.com/mmpro/ac-semantic-release/commit/bdcd7139f169941569d2391eb2b1f79519b209e8)    
Merge: 236c922 8ed531f  
Merge pull request #1 from mmpro/develop_md
* **App:** regex include whitespace | MD | [8ed531f199c225e8bd5eb8663161d6ddc4b9f719](https://github.com/mmpro/ac-semantic-release/commit/8ed531f199c225e8bd5eb8663161d6ddc4b9f719)    
allow any character in commit section title regex
<a name="0.2.0"></a>
 
# [0.2.0](https://github.com/mmpro/ac-semantic-release/compare/v0.1.4..v0.2.0) (2020-06-14 07:36:47)


### Feature

* **App:** Add support for JIRA issues | MP | [eed5a8a25d5fd5fa9e8a0dc35173d52808a51b20](https://github.com/mmpro/ac-semantic-release/commit/eed5a8a25d5fd5fa9e8a0dc35173d52808a51b20)    
You can now link to Jira issues using square brackets (e.g. [JRA-123])
### Chores

* **App:** Updated packages | MP | [276767973d04d42b086e989a3a959d9e7b9ecac4](https://github.com/mmpro/ac-semantic-release/commit/276767973d04d42b086e989a3a959d9e7b9ecac4)    
Updated packages
<a name="0.1.4"></a>

## [0.1.4](https://github.com/mmpro/ac-semantic-release/compare/v0.1.3..v0.1.4) (2020-05-12 08:49:31)


### Bug Fix

* **App:** Make sure to add section to questions | MP | [abce13380c939d324c709743f7e3f5affb4161ce](https://github.com/mmpro/ac-semantic-release/commit/abce13380c939d324c709743f7e3f5affb4161ce)    
Make sure to add section to questions
<a name="0.1.3"></a>

## [0.1.3](https://github.com/mmpro/ac-semantic-release/compare/v0.1.2..v0.1.3) (2020-05-12 08:45:51)


### Bug Fix

* **undefined:** New selection for package update | MP | [dc2b82ebcde9bbc8b28a3516745c628606024524](https://github.com/mmpro/ac-semantic-release/commit/dc2b82ebcde9bbc8b28a3516745c628606024524)    
If you update packages, no need to write long messages, just select type package and choose the default message for title and description.
<a name="0.1.2"></a>

## [0.1.2](https://github.com/mmpro/ac-semantic-release/compare/v0.1.1..v0.1.2) (2020-04-11 09:30:51)


### Bug Fix

* **App:** If no tags present, use version 0.0.0 | MP | [a4dee92afe36e5119bda5417c6abb05b0a4babf1](https://github.com/mmpro/ac-semantic-release/commit/a4dee92afe36e5119bda5417c6abb05b0a4babf1)    
If no tags present, use version 0.0.0
<a name="0.1.1"></a>

## [0.1.1](https://github.com/mmpro/ac-semantic-release/compare/v0.1.0..v0.1.1) (2020-03-29 12:51:49)


### Bug Fix

* **App:** Use git tag instead of git describe to get latest tag | MP | [bda1ff48504d62b3b08b3381c06de04a678525a5](https://github.com/mmpro/ac-semantic-release/commit/bda1ff48504d62b3b08b3381c06de04a678525a5)    
Use git tag instead of git describe to get latest tag  
Related issues: [mmpro/ac-semantic-release#1](https://github.com/mmpro/ac-semantic-release/issues/1) [mmpro/ac-api-server#340](https://github.com/mmpro/ac-api-server/issues/340)
<a name="0.1.0"></a>
 
# [0.1.0](https://github.com/mmpro/ac-semantic-release/compare/..v0.1.0) (2020-03-28 21:56:31)


### Feature

* **App:** Initial version | MP | [1dd68cb7dd143b0e3ccd5a3f7237ebd99f2aca33](https://github.com/mmpro/ac-semantic-release/commit/1dd68cb7dd143b0e3ccd5a3f7237ebd99f2aca33)    
Initial version of AdmiralCloud Semantic Release Manager
### Chores

* **App:** Add release to Makefile | MP | [4b7f74e03c234c24eab33f2275562b9bd972e20f](https://github.com/mmpro/ac-semantic-release/commit/4b7f74e03c234c24eab33f2275562b9bd972e20f)    
Add release function to Makefile
undefined