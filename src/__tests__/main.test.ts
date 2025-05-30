import { execSync } from 'node:child_process';

import { getInput, setOutput, setFailed, ExitCode } from '@actions/core';
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('node:child_process');
jest.mock('@actions/core');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockGetInput = getInput as jest.MockedFunction<typeof getInput>;
const mockSetOutput = setOutput as jest.MockedFunction<typeof setOutput>;
const mockSetFailed = setFailed as jest.MockedFunction<typeof setFailed>;

// Mock response data for successful scan
const mockSuccessResponse = {
  scan: {
    algorithmVersion: 2,
    grade: 'A+',
    error: null,
    score: 100,
    statusCode: 200,
    testsFailed: 0,
    testsPassed: 10,
    testsQuantity: 10,
    responseHeaders: {
      'content-type': 'text/html',
    },
  },
  tests: {
    'content-security-policy': {
      expectation: 'csp-implemented-with-no-unsafe',
      pass: true,
      result: 'csp-implemented-with-no-unsafe',
      scoreModifier: 0,
    },
    'strict-transport-security': {
      expectation: 'hsts-implemented-max-age-at-least-six-months',
      pass: true,
      result: 'hsts-implemented-max-age-at-least-six-months',
      scoreModifier: 0,
    },
  },
};

// Mock response data for failed scan
const mockFailureResponse = {
  scan: {
    algorithmVersion: 2,
    grade: 'F',
    error: null,
    score: 25,
    statusCode: 200,
    testsFailed: 5,
    testsPassed: 5,
    testsQuantity: 10,
    responseHeaders: {
      'content-type': 'text/html',
    },
  },
  tests: {
    'content-security-policy': {
      expectation: 'csp-implemented-with-no-unsafe',
      pass: false,
      result: 'csp-not-implemented',
      scoreModifier: -25,
    },
    'strict-transport-security': {
      expectation: 'hsts-implemented-max-age-at-least-six-months',
      pass: true,
      result: 'hsts-implemented-max-age-at-least-six-months',
      scoreModifier: 0,
    },
  },
};

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.exitCode
    delete process.exitCode;
    // Mock process.exit to prevent actual exit during tests
    jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit() was called');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful scan scenarios', () => {
    test('should run scan successfully with default passing score', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockSuccessResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify mocks were called correctly
      expect(mockGetInput).toHaveBeenCalledWith('host', { required: true });
      expect(mockGetInput).toHaveBeenCalledWith('passing-score', {
        required: false,
      });
      expect(mockExecSync).toHaveBeenCalledWith(
        'npx @mdn/mdn-http-observatory example.com',
      );
      expect(mockSetOutput).toHaveBeenCalledWith(
        'results',
        expect.stringContaining('# HTTP Observatory Results'),
      );
      expect(mockSetOutput).toHaveBeenCalledWith(
        'results',
        expect.stringContaining('Grade: A+'),
      );
      expect(mockSetOutput).toHaveBeenCalledWith(
        'results',
        expect.stringContaining('Score: 100'),
      );
      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    test('should run scan successfully with custom passing score', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '80';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockSuccessResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify the scan passed with score 100 >= 80
      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    test('should format results table correctly', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockSuccessResponse)),
      );

      // Act
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Assert
      const resultsCall = mockSetOutput.mock.calls.find(
        (call) => call[0] === 'results',
      );
      expect(resultsCall).toBeDefined();
      const resultsOutput = resultsCall![1];

      // Check that test names are properly formatted
      expect(resultsOutput).toContain('Content Security Policy');
      expect(resultsOutput).toContain('Strict Transport Security');
      expect(resultsOutput).toContain('Pass');
      expect(resultsOutput).toContain(
        'https://developer.mozilla.org/en-US/observatory/analyze?host=example.com',
      );
    });
  });

  describe('failed scan scenarios', () => {
    test('should fail when score is below default passing score', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockFailureResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify failure was handled correctly
      expect(mockSetFailed).toHaveBeenCalledWith(
        'Scan failed: Actual score is lower than the passing score',
      );
      expect(process.exitCode).toBe(ExitCode.Failure);
    });

    test('should fail when score is below custom passing score', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '50';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockFailureResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify failure was handled correctly (score 25 < 50)
      expect(mockSetFailed).toHaveBeenCalledWith(
        'Scan failed: Actual score is lower than the passing score',
      );
      expect(process.exitCode).toBe(ExitCode.Failure);
    });

    test('should pass when score meets custom passing score', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '20';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockFailureResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify it passed (score 25 >= 20)
      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('should handle execSync errors', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify error was handled correctly
      expect(mockSetFailed).toHaveBeenCalledWith('Scan failed: Command failed');
      expect(process.exitCode).toBe(ExitCode.Failure);
    });

    test('should handle JSON parsing errors', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockReturnValue(Buffer.from('invalid json'));

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify error was handled correctly
      expect(mockSetFailed).toHaveBeenCalledWith(
        expect.stringMatching(/^Scan failed:/),
      );
      expect(process.exitCode).toBe(ExitCode.Failure);
    });

    test('should handle non-Error exceptions', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return '';
        return '';
      });
      mockExecSync.mockImplementation(() => {
        throw 'String error';
      });

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // Verify error was handled correctly
      expect(mockSetFailed).toHaveBeenCalledWith('Scan failed: Unknown error');
      expect(process.exitCode).toBe(ExitCode.Failure);
    });
  });

  describe('input validation', () => {
    test('should handle missing host input', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return '';
        if (name === 'passing-score') return '';
        return '';
      });

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // The @actions/core library should handle required input validation
      expect(mockGetInput).toHaveBeenCalledWith('host', { required: true });
    });

    test('should handle invalid passing-score input', async () => {
      // Arrange
      mockGetInput.mockImplementation((name) => {
        if (name === 'host') return 'example.com';
        if (name === 'passing-score') return 'invalid';
        return '';
      });
      mockExecSync.mockReturnValue(
        Buffer.from(JSON.stringify(mockSuccessResponse)),
      );

      // Act & Assert
      expect(() => {
        require('../main.js');
      }).toThrow('process.exit() was called');

      // parseInt('invalid', 10) returns NaN, which should be handled gracefully
      // The test should still run, but with NaN as passing score (which will likely cause failure)
      expect(mockExecSync).toHaveBeenCalled();
    });
  });
});
