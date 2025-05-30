import { execSync } from 'node:child_process';

import {
  getInput,
  setFailed,
  ExitCode,
  summary,
  setOutput,
} from '@actions/core';
import { SummaryTableRow } from '@actions/core/lib/summary.js';

import { Response } from './Response.type.js';

function getHost(): string {
  const host = getInput('host', { required: true, trimWhitespace: true });

  try {
    return new URL(host).host;
  } catch (error) {
    throw new Error('Invalid host URL');
  }
}

function getScore(): number {
  const scoreInput = getInput('passing-score', {
    trimWhitespace: true,
  });

  if (scoreInput.length > 0) {
    const parsedScore = parseInt(scoreInput, 10);

    if (!isNaN(parsedScore)) {
      return parsedScore;
    }
  }

  return 100;
}

function tidyKey(key: string): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function passText(pass: boolean): string {
  return pass ? '✅ Pass' : '❌ Fail';
}

function generateReportRow([key, value]: [
  string,
  { pass: boolean; scoreModifier: number },
]): string {
  return `- ${tidyKey(key)}: ${passText(value.pass)} (Score: ${value.scoreModifier})`;
}

function generateReport(output: Response, host: string): string {
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

[View the full report on MDN](https://developer.mozilla.org/en-US/observatory/analyze?host=${host})
`;
}

function generateSummaryRow([key, value]: [
  string,
  { pass: boolean; scoreModifier: number },
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
    .addLink(`Scanned: ${host}`, host)
    .addDetails(
      'Summary',
      `- Grade: ${grade}
      - Score: ${score}
      - Tests Passed: ${testsPassed} / ${testsQuantity}`,
    )
    .addTable([
      [
        { data: 'Test', header: true },
        { data: 'Passed', header: true },
        { data: 'Score', header: true },
      ],
      ...Object.entries(tests).map(generateSummaryRow),
    ])
    .addLink(
      'View the full report on MDN',
      `https://developer.mozilla.org/en-US/observatory/analyze?host=${host}`,
    )
    .write();
}

async function main() {
  try {
    const host = getHost();
    const passingScore = getScore();
    const scan = execSync(`npx @mdn/mdn-http-observatory ${host}`);
    const output: Response = JSON.parse(scan.toString());

    await generateSummary(output, host);

    setOutput('report', generateReport(output, host));

    if (output.scan.score < passingScore) {
      setFailed(`Scan failed: Score is lower than ${passingScore}`);
      process.exitCode = ExitCode.Failure;
    }
  } catch (err) {
    setFailed(
      `Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    process.exitCode = ExitCode.Failure;
  }

  process.exit();
}

main();
