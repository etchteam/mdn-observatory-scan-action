import { execSync } from 'node:child_process';

import { getInput, setOutput, setFailed, ExitCode } from '@actions/core';

import { Response } from './Response.type.js';

try {
  const host = getInput('host', { required: true });
  const scoreInput = getInput('passing-score', {
    required: false,
  });
  const passingScore = scoreInput.length > 0 ? parseInt(scoreInput, 10) : 100;

  const cleanedHost = host.replace(/https?:\/\//, '');

  const scan = execSync(`npx @mdn/mdn-http-observatory ${cleanedHost}`);

  const output: Response = JSON.parse(scan.toString());

  const results = `
  # HTTP Observatory Results

  ## Summary

  - Grade: ${output.scan.grade}
  - Score: ${output.scan.score}
  - Tests Passed: ${output.scan.testsPassed} / ${output.scan.testsQuantity}
  - Full Results: https://developer.mozilla.org/en-US/observatory/analyze?host=${host}

  ## Result

  <table>
    <thead>
      <tr>
        <th>Test</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>${Object.entries(output.tests)
      .map(
        ([key, value]) => `
      <tr>
        <td>${key
          .split('-')
          .map(
            (p) => `${String(p).charAt(0).toUpperCase()}${String(p).slice(1)}`,
          )
          .join(' ')}</td>
        <td>${value.pass === true ? 'Pass' : 'Fail'}</td>
        <td>${value.scoreModifier}</td>
      </tr>
  `,
      )
      .join('')}  </tbody>
  </table>
  `;

  setOutput('results', results);

  if (output.scan.score < passingScore) {
    setFailed('Scan failed: Actual score is lower than the passing score');
    process.exitCode = ExitCode.Failure;
  }
} catch (err) {
  setFailed(
    `Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
  );
  process.exitCode = ExitCode.Failure;
}

process.exit();
