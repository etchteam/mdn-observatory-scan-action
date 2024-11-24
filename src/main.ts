import { execSync } from 'child_process';

import * as core from '@actions/core';

import { Response } from './Response.type.js';

try {
  const host = core.getInput('host', { required: true });
  const scoreInput = core.getInput('passing-score', {
    required: false,
  });
  const passingScore = scoreInput.length > 0 ? parseInt(scoreInput, 10) : 100;

  const scan = execSync(`npx @mdn/mdn-http-observatory ${host}`);

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

  core.setOutput('results', results);

  if (output.scan.score < passingScore) {
    core.setFailed('Scan failed: Actual score is lower than the passing score');
    process.exitCode = core.ExitCode.Failure;
  }
} catch (err) {
  core.setFailed(
    `Scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
  );
  process.exitCode = core.ExitCode.Failure;
}

process.exit();
