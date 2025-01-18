const { processLinks, escapeDoubleQuotes } = require('../lib/release');

describe('Release utility functions', () => {
  describe('processLinks', () => {
    const mockTitle = 'feat(API): New feature | JD';
    
    test('should handle empty links', () => {
      const result = processLinks('', mockTitle);
      expect(result.body).toBe('');
      expect(result.title).toBe(mockTitle);
    });

    test('should process JIRA link', () => {
      const result = processLinks('[PROJ-123]', mockTitle);
      expect(result.body).toContain('Related issues:');
      expect(result.body).toContain('/browse/PROJ-123');
      expect(result.title).toBe('[PROJ-123]  ' + mockTitle);
    });

    test('should process GitHub issue', () => {
      const result = processLinks('#456', mockTitle);
      expect(result.body).toContain('Related issues:');
      expect(result.body).toContain('/issues/456');
    });

    test('should process external GitHub issue', () => {
      const result = processLinks('other-org/repo#789', mockTitle);
      expect(result.body).toContain('Related issues:');
      expect(result.body).toContain('https://github.com/other-org/repo/issues/789');
    });

    test('should handle multiple links', () => {
      const result = processLinks('[PROJ-123], #456, other-org/repo#789', mockTitle);
      expect(result.body).toContain('/browse/PROJ-123');
      expect(result.body).toContain('/issues/456');
      expect(result.body).toContain('other-org/repo/issues/789');
    });

    test('should ignore invalid links', () => {
      const result = processLinks('invalid-link, [PROJ-123]', mockTitle);
      expect(result.body).toContain('/browse/PROJ-123');
      expect(result.body).not.toContain('invalid-link');
    });
  });

  describe('escapeDoubleQuotes', () => {
    test('should escape double quotes and backslashes', () => {
      expect(escapeDoubleQuotes('test "quote" \\')).toBe('test \\"quote\\" \\\\');
    });
  });
});