import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { Response } from '../Response.type.js';

const execFileSync = jest.fn<() => string>();

jest.unstable_mockModule('node:child_process', () => ({ execFileSync }));

// Imported in beforeAll so the mock above is registered first
let SCAN_CLI: string;
let run: () => Promise<void>;

beforeAll(async () => {
  ({ SCAN_CLI, run } = await import('../main.js'));
});

const scanOutput = (score: number) =>
  JSON.stringify({
    scan: {
      grade: 'A+',
      score,
      error: null,
      testsPassed: 1,
      testsQuantity: 2,
    },
    tests: {
      'content-security-policy': { pass: true, scoreModifier: 5 },
      'x-frame-options': { pass: false, scoreModifier: -20 },
    },
  } as unknown as Response);

// @actions/core caches the summary path on first write, so it must be stable
const dir = mkdtempSync(join(tmpdir(), 'observatory-'));
const summaryPath = join(dir, 'summary.md');
const outputPath = join(dir, 'output.txt');

beforeEach(async () => {
  process.env.GITHUB_STEP_SUMMARY = summaryPath;
  process.env.GITHUB_OUTPUT = outputPath;
  writeFileSync(summaryPath, '');
  writeFileSync(outputPath, '');
  process.env.INPUT_HOST = 'https://etch.co';
  process.env['INPUT_PASSING-SCORE'] = '90';
  process.exitCode = 0;
  execFileSync.mockReset();

  const { summary } = await import('@actions/core');
  summary.emptyBuffer();
});

afterEach(() => {
  delete process.env.INPUT_HOST;
  delete process.env['INPUT_PASSING-SCORE'];
  process.exitCode = 0;
});

const summaryText = () => readFileSync(summaryPath, 'utf8');
const outputText = () => readFileSync(outputPath, 'utf8');

describe('run', () => {
  it('runs the vendored scan CLI without a shell', async () => {
    execFileSync.mockReturnValue(scanOutput(100));

    await run();

    expect(execFileSync).toHaveBeenCalledWith(
      process.execPath,
      [SCAN_CLI, 'etch.co'],
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });

  it('writes a job summary with a usable “Scanned” link', async () => {
    execFileSync.mockReturnValue(scanOutput(100));

    await run();

    expect(summaryText()).toContain(
      '<a href="https://etch.co">Scanned: etch.co</a>',
    );
  });

  it('writes summary details that render as a list', async () => {
    execFileSync.mockReturnValue(scanOutput(100));

    await run();

    // Indented list items would render as a code block instead
    expect(summaryText()).toContain('\n\n- Grade: A+\n- Score: 100\n');
  });

  it('writes a table row per test', async () => {
    execFileSync.mockReturnValue(scanOutput(100));

    await run();

    expect(summaryText()).toContain('<td>Content Security Policy</td>');
    expect(summaryText()).toContain('<td>-20</td>');
  });

  it('sets the report output', async () => {
    execFileSync.mockReturnValue(scanOutput(100));

    await run();

    expect(outputText()).toContain('report');
    expect(outputText()).toContain('- Grade: A+');
  });

  it('passes when the score meets the threshold', async () => {
    execFileSync.mockReturnValue(scanOutput(90));

    await run();

    expect(process.exitCode).toBe(0);
  });

  it('fails when the score is below the threshold', async () => {
    execFileSync.mockReturnValue(scanOutput(89));

    await run();

    expect(process.exitCode).toBe(1);
  });

  it('surfaces the scan CLI error rather than the node command line', async () => {
    execFileSync.mockImplementation(() => {
      throw Object.assign(new Error('Command failed: node …'), {
        stdout: '{"error":"The site seems to be down."}',
      });
    });

    await run();

    expect(process.exitCode).toBe(1);
  });
});
