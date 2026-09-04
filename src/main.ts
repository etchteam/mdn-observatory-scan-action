import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getInput,
  setFailed,
  summary,
  setOutput,
  warning,
} from '@actions/core';
import { SummaryTableRow } from '@actions/core/lib/summary.js';

import { Response, TestResult } from './Response.type.js';

// The scan CLI ships alongside the bundle in dist/vendor, so a scan installs
// nothing: no registry fetch, no lifecycle scripts and no CA bundle download in
// the consuming workflow. dist/vendor/package-lock.json pins the whole tree.
// The CLI stays a subprocess because it sets NODE_EXTRA_CA_CERTS, which node
// only reads at startup.
export const SCAN_CLI_PATH =
  'vendor/node_modules/@mdn/mdn-http-observatory/bin/wrapper.js';

export const SCAN_CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  SCAN_CLI_PATH,
);

// 90 equates to an “A” rating
const DEFAULT_PASSING_SCORE = 90;

// See https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring#scoring_methodology
const MAX_PASSING_SCORE = 145;

// The default 1MB is not enough for sites with many cookies or scripts
const MAX_BUFFER = 32 * 1024 * 1024;

export function getHost(): string {
  const input = getInput('host', { required: true, trimWhitespace: true });
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `https://${input}`;

  try {
    return new URL(candidate).host;
  } catch {
    throw new Error(`Invalid host: ${input}`);
  }
}

export function getPassingScore(): number {
  const scoreInput = getInput('passing-score', { trimWhitespace: true });

  if (scoreInput.length === 0) {
    return DEFAULT_PASSING_SCORE;
  }

  const passingScore = Number.parseInt(scoreInput, 10);

  if (Number.isNaN(passingScore)) {
    warning(
      `Passing score “${scoreInput}” is not a number. Using ${DEFAULT_PASSING_SCORE} instead.`,
    );
    return DEFAULT_PASSING_SCORE;
  }

  if (passingScore < 0) {
    warning('Passing score cannot be negative. Setting to 0 instead.');
    return 0;
  }

  if (passingScore > MAX_PASSING_SCORE) {
    warning(
      `Passing score cannot exceed ${MAX_PASSING_SCORE}. Setting to ${MAX_PASSING_SCORE} instead.`,
    );
    return MAX_PASSING_SCORE;
  }

  return passingScore;
}

/**
 * The scan CLI reports failures as `{"error": "..."}` on stdout alongside a
 * non-zero exit code, so the useful message is on the thrown error, not in it.
 */
export function scanErrorMessage(err: unknown): string {
  const stdout = (err as { stdout?: Buffer | string } | null)?.stdout
    ?.toString()
    .trim();

  if (stdout) {
    try {
      const parsed = JSON.parse(stdout);

      if (typeof parsed?.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Not JSON — fall back to the error's own message.
    }
  }

  return err instanceof Error ? err.message : 'Unknown error';
}

export function parseScanOutput(stdout: string): Response {
  if (stdout.trim().length === 0) {
    throw new Error('The scan produced no output');
  }

  const output: Response = JSON.parse(stdout);

  if (output.scan.error) {
    throw new Error(output.scan.error);
  }

  return output;
}

function runScan(host: string): Response {
  let stdout: string;

  try {
    stdout = execFileSync(process.execPath, [SCAN_CLI, host], {
      encoding: 'utf8',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (err) {
    throw new Error(scanErrorMessage(err));
  }

  return parseScanOutput(stdout);
}

export function reportUrl(host: string): string {
  return `https://developer.mozilla.org/en-US/observatory/analyze?host=${encodeURIComponent(host)}`;
}

export function tidyKey(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function passText(pass: boolean): string {
  return pass ? '✅ Pass' : '❌ Fail';
}

function generateReportRow([key, value]: [string, TestResult]): string {
  return `- ${tidyKey(key)}: ${passText(value.pass)} (Score: ${value.scoreModifier})`;
}

export function generateReport(output: Response, host: string): string {
  const {
    scan: { grade, score, testsPassed, testsQuantity },
    tests,
  } = output;

  return `Mozilla HTTP Observatory Results
Scanned: ${host}
Summary:
- Grade: ${grade}
- Score: ${score}
- Tests Passed: ${testsPassed} / ${testsQuantity}

Tests:

${Object.entries(tests).map(generateReportRow).join('\n')}

[View the full report on MDN](${reportUrl(host)})
`;
}

function generateSummaryRow([key, value]: [
  string,
  TestResult,
]): SummaryTableRow {
  return [
    { data: tidyKey(key) },
    { data: passText(value.pass) },
    { data: value.scoreModifier.toString() },
  ];
}

async function generateSummary(output: Response, host: string) {
  const {
    scan: { grade, score, testsPassed, testsQuantity },
    tests,
  } = output;

  await summary
    .addHeading('Mozilla HTTP Observatory Results')
    .addLink(`Scanned: ${host}`, `https://${host}`)
    .addDetails(
      'Summary',
      // The leading blank line lets GitHub render the list inside the <details>
      `\n\n- Grade: ${grade}\n- Score: ${score}\n- Tests Passed: ${testsPassed} / ${testsQuantity}\n`,
    )
    .addTable([
      [
        { data: 'Test', header: true },
        { data: 'Passed', header: true },
        { data: 'Score', header: true },
      ],
      ...Object.entries(tests).map(generateSummaryRow),
    ])
    .addLink('View the full report on MDN', reportUrl(host))
    .write();
}

export async function run(): Promise<void> {
  try {
    const host = getHost();
    const passingScore = getPassingScore();
    const output = runScan(host);

    await generateSummary(output, host);

    setOutput('report', generateReport(output, host));

    if (output.scan.score < passingScore) {
      // setFailed sets the exit code; calling process.exit() here would
      // truncate the ::error:: command still buffered on stdout.
      setFailed(
        `Scan failed: score ${output.scan.score} is lower than ${passingScore}`,
      );
    }
  } catch (err) {
    setFailed(`Scan failed: ${scanErrorMessage(err)}`);
  }
}
