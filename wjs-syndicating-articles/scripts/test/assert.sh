#!/usr/bin/env bash
# Tiny assert helpers. Source this in test scripts.
ASSERT_FAILS=0
assert_eq() { # actual expected msg
  if [[ "$1" == "$2" ]]; then echo "  ok: $3"
  else echo "  FAIL: $3"; echo "    expected: [$2]"; echo "    actual:   [$1]"; ASSERT_FAILS=$((ASSERT_FAILS+1)); fi
}
assert_contains() { # haystack needle msg
  if [[ "$1" == *"$2"* ]]; then echo "  ok: $3"
  else echo "  FAIL: $3"; echo "    [$1] does not contain [$2]"; ASSERT_FAILS=$((ASSERT_FAILS+1)); fi
}
assert_exit() { # actual_code expected_code msg
  if [[ "$1" == "$2" ]]; then echo "  ok: $3"
  else echo "  FAIL: $3 (exit $1, wanted $2)"; ASSERT_FAILS=$((ASSERT_FAILS+1)); fi
}
assert_file() { # path msg
  if [[ -f "$1" ]]; then echo "  ok: $2"
  else echo "  FAIL: $2 (no file $1)"; ASSERT_FAILS=$((ASSERT_FAILS+1)); fi
}
finish() { # name
  if [[ "$ASSERT_FAILS" -eq 0 ]]; then echo "PASS: $1"; exit 0
  else echo "FAILED: $1 ($ASSERT_FAILS assertions)"; exit 1; fi
}
