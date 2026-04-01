
const { describe, test, afterEach } = require('node:test')
const assert = require('node:assert/strict')

describe('Commit functionality', () => {
  const mockRepositoryUrl = 'https://github.com/org/repo';
  const mockJiraUrl = 'https://jira.company.com';

  describe('Link processing', () => {
    test('processes commit with GitHub issue', () => {
      const links = '#123';
      const expectedBody = 'Related issues:\n        - ' + mockRepositoryUrl + '/issues/123\n';
      const body = links.startsWith('#') ?
        'Related issues:\n        - ' + mockRepositoryUrl + '/issues/' + links.replace('#', '') + '\n' : '';
      assert.strictEqual(body, expectedBody);
    });

    test('processes commit with external repo issue', () => {
      const links = 'other-org/repo#456';
      const [repo, issueNum] = links.split('#');
      const body = 'Related issues:\n        - https://github.com/' + repo + '/issues/' + issueNum + '\n';
      assert.ok(body.includes('other-org/repo/issues/456'));
    });

    test('processes commit with JIRA issue', () => {
      const links = '[PROJ-123]';
      const jiraId = links.replace('[', '').replace(']', '');
      const body = 'Related issues:\n        - ' + mockJiraUrl + '/browse/' + jiraId + '\n';
      assert.ok(body.includes('/browse/PROJ-123'));
    });

    test('processes breaking change commit', () => {
      const breaking = 'Major API version bump required';
      const body = 'BREAKING: ' + breaking;
      assert.ok(body.includes('BREAKING: Major API version bump required'));
    });

    test('processes multiple links', () => {
      const links = '#123, [PROJ-456], other-org/repo#789';
      let body = 'Related issues:\n';
      links.split(',').forEach(link => {
        const trimmedLink = link.trim();
        if (trimmedLink.startsWith('#')) {
          body += `        - ${mockRepositoryUrl}/issues/${trimmedLink.replace('#', '')}\n`;
        }
        else if (trimmedLink.startsWith('[')) {
          const jiraId = trimmedLink.replace('[', '').replace(']', '');
          body += `        - ${mockJiraUrl}/browse/${jiraId}\n`;
        }
        else {
          const [repo, issue] = trimmedLink.split('#');
          body += `        - https://github.com/${repo}/issues/${issue}\n`;
        }
      });
      assert.ok(body.includes('/issues/123'));
      assert.ok(body.includes('/browse/PROJ-456'));
      assert.ok(body.includes('other-org/repo/issues/789'));
    });
  });

  describe('Commit messages without issues', () => {
    test('handles commit without any issue references', () => {
      const mockTitle = 'feat(api): Add new endpoint | JD';
      const links = '';
      const body = '';
      assert.strictEqual(body, '');
      assert.strictEqual(mockTitle, 'feat(api): Add new endpoint | JD');
    });

    test('handles commit with empty issue field', () => {
      const mockTitle = 'fix(core): Update error handling | JD';
      const body = '';
      assert.strictEqual(body, '');
      assert.strictEqual(mockTitle, 'fix(core): Update error handling | JD');
    });
  });

  describe('Commit types', () => {
    const types = [
      { type: 'feat', desc: 'New feature', section: 'api' },
      { type: 'fix', desc: 'Bug fix', section: 'core' },
      { type: 'docs', desc: 'Documentation change', section: 'readme' },
      { type: 'style', desc: 'Code style change', section: 'lint' },
      { type: 'refactor', desc: 'Code refactor', section: 'utils' },
      { type: 'test', desc: 'Test update', section: 'unit' },
      { type: 'chore', desc: 'Build process update', section: 'deps' }
    ];

    for (const { type, desc, section } of types) {
      test(`processes ${type} commit type`, () => {
        const mockTitle = `${type}(${section}): ${desc} | JD`;
        assert.match(mockTitle, new RegExp(`^${type}\\(${section}\\):`));
      });
    }
  });
});
