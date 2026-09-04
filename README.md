# Mozilla Observatory Scan

Scans the provided host using the [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory) and fails the job if the score is below a threshold.

## Usage

```yaml
---
name: 🕵‍♀️ Scan Preview App
on:
  pull_request:
    branches: [main]
permissions:
  contents: read
  pull-requests: write
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: etchteam/mdn-observatory-scan-action@v1
        id: observatory
        with:
          host: https://etch.co # Required
          passing-score: 125 # Optional, defaults to 90, the bottom of the “A” rating

      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          recreate: true
          message: ${{ steps.observatory.outputs.report }}
```

## Inputs

| Name            | Required | Default | Description                                                                                                                                        |
| --------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host`          | Yes      | –       | Host to scan. A full URL (`https://etch.co`) or a bare hostname (`etch.co`); anything but the host is ignored.                                        |
| `passing-score` | No       | `90`    | Minimum score to pass, clamped to 0–145. See the [scoring methodology](https://developer.mozilla.org/en-US/observatory/docs/tests_and_scoring#scoring_methodology). |

## Outputs

| Name     | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `report` | Markdown summary of the scan results, suitable for posting as a PR comment.      |

The action also writes the results to the [job summary](https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary).

## Development

`dist/` is committed because GitHub Actions runs it directly. Rebuild it with
`npm run build` and commit the result in the same change as any `src/` edit — CI
fails if the two are out of sync.

`dist/vendor/` holds the vendored scan CLI, `@mdn/mdn-http-observatory`, with
its `node_modules` committed alongside the bundle. The action runs it as a
subprocess rather than importing it, because the CLI sets `NODE_EXTRA_CA_CERTS`
and node only reads that at startup. `npm run build` leaves it untouched.

Vendoring means a scan installs nothing at run time. Previously the action ran
`npx --yes`, which resolved 273 transitive packages against the registry on
every run, executed their install scripts in the consuming workflow, and let one
of them download its CA bundle over the network. Now
`dist/vendor/package-lock.json` pins the tree, so it is reviewable and shows up
in the dependency graph.

To update the CLI, change the version in `dist/vendor/package.json`, run
`npm install --prefix dist/vendor --omit=dev`, and commit `dist/vendor/` along
with the updated lockfile. Let the install scripts run: one of them generates
the CA bundle, and committing the result is what keeps it out of consumers' CI.
