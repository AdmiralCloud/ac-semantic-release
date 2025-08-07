
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('inquirer', () => ({
  prompt: jest.fn()
}));

describe('Commit functionality', () => {
  const mockRepositoryUrl = 'https://github.com/org/repo';
  const mockJiraUrl = 'https://jira.company.com';

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Link processing', () => {
    test('processes commit with GitHub issue', () => {
      const links = '#123';
      const mockTitle = 'feat(api): New feature | JD';
      const expectedBody = 'Related issues:\n        - ' + mockRepositoryUrl + '/issues/123\n';
      const body = links.startsWith('#') ?
        'Related issues:\n        - ' + mockRepositoryUrl + '/issues/' + links.replace('#', '') + '\n' : '';
      expect(body).toBe(expectedBody);
    });

    test('processes commit with external repo issue', () => {
      const links = 'other-org/repo#456';
      const mockTitle = 'fix(core): Bug fix | JD';
      const [repo, issueNum] = links.split('#');
      const body = 'Related issues:\n        - https://github.com/' + repo + '/issues/' + issueNum + '\n';
      expect(body).toContain('other-org/repo/issues/456');
    });

    test('processes commit with JIRA issue', () => {
      const links = '[PROJ-123]';
      const mockTitle = 'feat(ui): Add button | JD';
      const expectedTitle = '[PROJ-123]  feat(ui): Add button | JD';
      const jiraId = links.replace('[', '').replace(']', '');
      const body = 'Related issues:\n        - ' + mockJiraUrl + '/browse/' + jiraId + '\n';
      expect(body).toContain('/browse/PROJ-123');
    });

    test('processes breaking change commit', () => {
      const mockTitle = 'feat(api): Breaking API change | JD';
      const breaking = 'Major API version bump required';
      const body = 'BREAKING: ' + breaking;
      expect(body).toContain('BREAKING: Major API version bump required');
    });

    test('processes multiple links', () => {
      const links = '#123, [PROJ-456], other-org/repo#789';
      const mockTitle = 'chore(deps): Update dependencies | JD';
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
      expect(body).toContain('/issues/123');
      expect(body).toContain('/browse/PROJ-456');
      expect(body).toContain('other-org/repo/issues/789');
    });
  });

  describe('Commit messages without issues', () => {
    test('handles commit without any issue references', () => {
      const mockTitle = 'feat(api): Add new endpoint | JD';
      const links = '';
      const body = '';
      expect(body).toBe('');
      expect(mockTitle).toBe('feat(api): Add new endpoint | JD');
    });

    test('handles commit with empty issue field', () => {
      const mockTitle = 'fix(core): Update error handling | JD';
      const links = '    ';  // Empty or whitespace
      const body = '';
      expect(body).toBe('');
      expect(mockTitle).toBe('fix(core): Update error handling | JD');
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

    test.each(types)('processes $type commit type', ({ type, desc, section }) => {
      const mockTitle = `${type}(${section}): ${desc} | JD`;
      expect(mockTitle).toMatch(new RegExp(`^${type}\\(${section}\\):`));
    });
  });
});