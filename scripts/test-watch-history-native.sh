#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_BINARY="$(mktemp "${TMPDIR:-/tmp}/silverbank-watch-history.XXXXXX")"
trap 'rm -f "$TEST_BINARY"' EXIT
xcrun swiftc "$ROOT/vendor/WatchHistoryStore.swift" "$ROOT/tests/watch-history-native.swift" -o "$TEST_BINARY"
"$TEST_BINARY"
