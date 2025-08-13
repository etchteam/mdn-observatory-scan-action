# Mozilla Observatory Scan

Scans the provided host using the [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory)


## Usage

```
---
name: 🕵‍♀️ Scan Preview App
on:
  pull_request:
    - main
permissions:
  contents: read
  pull-requests: write
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: etchteam/mdn-observatory-scan-action@v1
        id: observatory
        with:
          host: https://etch.co # Required
          passingScore: 125 # Optional, defaults to 90, the bottom of the “A” rating

      - uses: marocchino/sticky-pull-request-comment@v2
        recreate: true
        with:
          message: ${{ steps.observatory.outputs.observatory-report }}
```
