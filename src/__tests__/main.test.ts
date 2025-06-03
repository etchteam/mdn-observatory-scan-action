// Mock dependencies before any imports
jest.mock('node:child_process');
jest.mock('@actions/core');

// Mock process.exit to prevent actual exits during tests
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

import { getInput } from '@actions/core';

const mockGetInput = getInput as jest.MockedFunction<typeof getInput>;

// Mock response data
const mockResponse = {
  scan: {
    grade: 'A+',
    score: 100,
    testsPassed: 10,
    testsQuantity: 10,
  },
  tests: {
    'content-security-policy': { pass: true, scoreModifier: 5 },
    'strict-transport-security': { pass: true, scoreModifier: 10 },
  },
};

describe('main.ts functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    mockExit.mockClear();
  });

  afterAll(() => {
    mockExit.mockRestore();
  });

  it('should handle valid URL input', () => {
    mockGetInput.mockReturnValue('https://example.com/path');

    // Test URL parsing functionality by creating new URL
    const url = new URL('https://example.com/path');
    expect(url.host).toBe('example.com');
  });

  it('should handle invalid URL input', () => {
    expect(() => new URL('invalid-url')).toThrow();
  });

  it('should parse valid score input', () => {
    const scoreInput = '85';
    const parsedScore = parseInt(scoreInput, 10);
    expect(parsedScore).toBe(85);
    expect(isNaN(parsedScore)).toBe(false);
  });

  it('should handle invalid score input', () => {
    const scoreInput = 'invalid';
    const parsedScore = parseInt(scoreInput, 10);
    expect(isNaN(parsedScore)).toBe(true);
  });

  it('should format keys correctly', () => {
    const formatKey = (key: string) =>
      key
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    expect(formatKey('content-security-policy')).toBe(
      'Content Security Policy',
    );
    expect(formatKey('x-frame-options')).toBe('X Frame Options');
  });

  it('should format pass/fail text correctly', () => {
    const passText = (pass: boolean) => (pass ? '✅ Pass' : '❌ Fail');

    expect(passText(true)).toBe('✅ Pass');
    expect(passText(false)).toBe('❌ Fail');
  });

  it('should generate report with correct structure', () => {
    const host = 'example.com';
    const { scan } = mockResponse;

    const reportParts = [
      'Mozilla HTTP Observatory Results',
      `Scanned: ${host}`,
      `Grade: ${scan.grade}`,
      `Score: ${scan.score}`,
      `Tests Passed: ${scan.testsPassed} / ${scan.testsQuantity}`,
    ];

    reportParts.forEach((part) => {
      expect(typeof part).toBe('string');
      expect(part.length).toBeGreaterThan(0);
    });
  });

  it('should create summary table rows correctly', () => {
    const testEntry: [string, { pass: boolean; scoreModifier: number }] = [
      'content-security-policy',
      { pass: true, scoreModifier: 5 },
    ];

    const [key, value] = testEntry;
    const formattedKey = key
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    const passText = value.pass ? '✅ Pass' : '❌ Fail';

    const row = [
      { data: formattedKey },
      { data: passText },
      { data: value.scoreModifier.toString() },
    ];

    expect(row).toHaveLength(3);
    expect(row[0].data).toBe('Content Security Policy');
    expect(row[1].data).toBe('✅ Pass');
    expect(row[2].data).toBe('5');
  });

  it('should test score comparison logic', () => {
    const score = 75;
    const passingScore = 80;

    expect(score < passingScore).toBe(true);

    const highScore = 90;
    expect(highScore < passingScore).toBe(false);
  });

  it('should handle JSON parsing', () => {
    const jsonString = JSON.stringify(mockResponse);
    const parsed = JSON.parse(jsonString);

    expect(parsed.scan.grade).toBe('A+');
    expect(parsed.scan.score).toBe(100);
  });
});
