#!/usr/bin/env sh
set -eu

if [ ! -d release ]; then
  echo "release/ does not exist. Run pnpm dist first." >&2
  exit 1
fi

app_count="$(find release -maxdepth 2 -type d -name '*.app' | wc -l | tr -d ' ')"
dmg_count="$(find release -maxdepth 1 -type f -name '*.dmg' | wc -l | tr -d ' ')"

if [ "$app_count" -eq 0 ]; then
  echo "No .app bundle found under release/. Run pnpm dist first." >&2
  exit 1
fi

if [ "$dmg_count" -eq 0 ]; then
  echo "No .dmg artifact found under release/. Run pnpm dist first." >&2
  exit 1
fi

find release -maxdepth 2 -type d -name '*.app' -exec codesign --verify --deep --strict --verbose=2 {} \;
find release -maxdepth 1 -type f -name '*.dmg' -exec hdiutil verify {} \;
