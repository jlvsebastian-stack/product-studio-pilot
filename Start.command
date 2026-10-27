#!/bin/bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'; then
  echo 'Product Studio needs Node.js 22 or newer. Install the LTS version from https://nodejs.org, then start again.'
  read -r -p 'Press Return to close.'
  exit 1
fi
if [ ! -f node_modules/.studio-ready ]; then
  echo 'First launch: setting up Product Studio and the official AI connection tools.'
  if ! npm ci --no-audit --no-fund; then
    echo 'Setup did not finish. Check your internet connection and start again.'
    read -r -p 'Press Return to close.'
    exit 1
  fi
  printf 'ready\n' > node_modules/.studio-ready
fi
export STUDIO_OPEN_BROWSER="${STUDIO_OPEN_BROWSER:-1}"
echo 'Keep this window open while using Product Studio. Close it to stop the local app.'
node src/local-server.js
