# Mozilla Observatory Scan

Scans the provided host using the [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory)


## Usage

```
---
name: 🕵‍♀️ Scan Preview App
on:
  pull_request:
    - main

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: etchteam/mozilla-observatory-scan@main
        id: observatory
        with:
          host: https://etch.co # Required
          score: 125 # Optional, defaults to 100

      - uses: marocchino/sticky-pull-request-comment@v2
        recreate: true
        with:
          message: ${{ steps.observatory.outputs.observatory-report }}"
```
