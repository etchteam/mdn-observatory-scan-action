import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { Response } from '../Response.type.js';
import {
  SCAN_CLI_PATH,
  generateReport,
  getHost,
  getPassingScore,
  parseScanOutput,
  passText,
  reportUrl,
  scanErrorMessage,
} from '../main.js';

function setInput(name: string, value: string) {
  process.env[`INPUT_${name.toUpperCase()}`] = value;
}

function scanResponse(overrides: Partial<Response['scan']> = {}): Response {
  return {
    scan: {
      grade: 'A+',
      score: 100,
      error: null,
      testsPassed: 9,
      testsQuantity: 10,
      ...overrides,
    },
    tests: {
      'content-security-policy': { pass: true, scoreModifier: 5 },
      'x-frame-options': { pass: false, scoreModifier: -20 },
    },
  } as unknown as Response;
}

describe('getHost', () => {
  beforeEach(() => {
    delete process.env.INPUT_HOST;
  });

  // The input arrives in the variable GitHub sets for the `host` action input
  it.each([
    ['https://etch.co', 'etch.co'],
    ['https://etch.co/some/path?a=b', 'etch.co'],
    ['etch.co', 'etch.co'],
    ['https://etch.co:8443', 'etch.co:8443'],
  ])('reduces %s to the host %s', (input, expected) => {
    setInput('host', input);
    expect(getHost()).toBe(expected);
  });

  it('throws when the input is not a usable host', () => {
    setInput('host', 'https://');
    expect(() => getHost()).toThrow('Invalid host: https://');
  });

  it('throws when the input is missing', () => {
    expect(() => getHost()).toThrow(/Input required/);
  });
});

describe('getPassingScore', () => {
  beforeEach(() => {
    // GitHub maps the `passing-score` input to this exact variable name
    delete process.env['INPUT_PASSING-SCORE'];
  });

  it('reads the variable GitHub sets for the `passing-score` input', () => {
    process.env['INPUT_PASSING-SCORE'] = '125';
    expect(getPassingScore()).toBe(125);
  });

  it('defaults to 90 when the input is empty', () => {
    process.env['INPUT_PASSING-SCORE'] = '   ';
    expect(getPassingScore()).toBe(90);
  });

  it('defaults to 90 when the input is not a number', () => {
    process.env['INPUT_PASSING-SCORE'] = 'invalid';
    expect(getPassingScore()).toBe(90);
  });

  it('clamps negative scores to 0', () => {
    process.env['INPUT_PASSING-SCORE'] = '-10';
    expect(getPassingScore()).toBe(0);
  });

  it('clamps scores above the 145 maximum', () => {
    process.env['INPUT_PASSING-SCORE'] = '200';
    expect(getPassingScore()).toBe(145);
  });

  it.each([
    ['0', 0],
    ['145', 145],
    ['85.7', 85],
  ])('parses %s as %i', (input, expected) => {
    process.env['INPUT_PASSING-SCORE'] = input;
    expect(getPassingScore()).toBe(expected);
  });
});

describe('SCAN_CLI_PATH', () => {
  // The vendored CLI is committed next to the bundle, so a missing file here
  // means the action would fail at scan time in every consuming workflow.
  // Checked against dist rather than SCAN_CLI because under ts-jest the bundle
  // directory is src.
  it('points at the vendored scan CLI committed in dist', () => {
    expect(existsSync(join(process.cwd(), 'dist', SCAN_CLI_PATH))).toBe(true);
  });
});

describe('scanErrorMessage', () => {
  it('surfaces the error the scan CLI printed to stdout', () => {
    const err = Object.assign(new Error('Command failed: node …'), {
      stdout: '{"error":"The site seems to be down."}',
    });

    expect(scanErrorMessage(err)).toBe('The site seems to be down.');
  });

  it('falls back to the error message when stdout is not JSON', () => {
    const err = Object.assign(new Error('Command failed: node …'), {
      stdout: 'npm ERR! could not resolve',
    });

    expect(scanErrorMessage(err)).toBe('Command failed: node …');
  });

  it('falls back to the error message when stdout has no error field', () => {
    const err = Object.assign(new Error('Command failed: node …'), {
      stdout: '{"scan":{}}',
    });

    expect(scanErrorMessage(err)).toBe('Command failed: node …');
  });

  it('falls back to the error message when there is no stdout', () => {
    expect(scanErrorMessage(new Error('spawn node ENOENT'))).toBe(
      'spawn node ENOENT',
    );
  });

  it('handles a thrown non-error', () => {
    expect(scanErrorMessage('nope')).toBe('Unknown error');
  });
});

describe('parseScanOutput', () => {
  it('parses a successful scan', () => {
    expect(parseScanOutput(JSON.stringify(scanResponse())).scan.grade).toBe(
      'A+',
    );
  });

  it('throws when the scan reported an error', () => {
    const output = JSON.stringify(scanResponse({ error: 'Site is down' }));
    expect(() => parseScanOutput(output)).toThrow('Site is down');
  });

  it('throws when the scan produced no output', () => {
    expect(() => parseScanOutput('  ')).toThrow('The scan produced no output');
  });
});

describe('reportUrl', () => {
  it('encodes the host', () => {
    expect(reportUrl('etch.co:8443')).toBe(
      'https://developer.mozilla.org/en-US/observatory/analyze?host=etch.co%3A8443',
    );
  });
});

describe('passText', () => {
  it.each([
    [true, '✅ Pass'],
    [false, '❌ Fail'],
  ])('renders %s as %s', (pass, expected) => {
    expect(passText(pass)).toBe(expected);
  });
});

describe('generateReport', () => {
  const report = generateReport(scanResponse(), 'etch.co');

  it('includes the scan summary', () => {
    expect(report).toContain('Scanned: etch.co');
    expect(report).toContain('- Grade: A+');
    expect(report).toContain('- Score: 100');
    expect(report).toContain('- Tests Passed: 9 / 10');
  });

  it('renders one tidied row per test', () => {
    expect(report).toContain('- Content Security Policy: ✅ Pass (Score: 5)');
    expect(report).toContain('- X Frame Options: ❌ Fail (Score: -20)');
  });

  it('links to the full MDN report', () => {
    expect(report).toContain(`(${reportUrl('etch.co')})`);
  });
});

describe('run', () => {
  it('reports a scan failure without exiting the process', async () => {
    const exit = jest.spyOn(process, 'exit');
    delete process.env.INPUT_HOST;
    process.exitCode = 0;

    const { run } = await import('../main.js');
    await run();

    expect(exit).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    exit.mockRestore();
    process.exitCode = 0;
  });
});
