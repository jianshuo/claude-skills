#!/usr/bin/env python3
"""Lint a Claude Code SKILL.md file.

Validates frontmatter so the auto-publish hook never ships a skill with a
broken `name:` or `description:` that breaks Claude's auto-invocation matching.

Checks:
  - file begins with `---` YAML frontmatter, closed by `---`
  - `name:` present, kebab-case, equals parent directory name
  - `description:` present, non-empty, <= 1024 chars (Claude Code's cap)
  - description heuristically contains trigger phrasing
    ("Use when" / "当用户" / "Triggers" / "触发" / quoted phrases)

Exit codes:
  0  pass (silent or with soft warnings on stderr)
  2  hard failure (stderr is surfaced back to Claude as feedback)

Usage:
  lint_skill.py path/to/SKILL.md
  echo '{"tool_input":{"file_path":"..."}}' | lint_skill.py --hook
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

DESCRIPTION_CAP = 1024
TRIGGER_HINTS = ("use when", "当用户", "triggers", "触发", "用于", "when the user")


def parse_frontmatter(text: str) -> tuple[dict[str, str], list[str]]:
    """Return (fields, errors). Handles inline values and `|` block scalars."""
    errors: list[str] = []
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        errors.append("file does not start with '---' frontmatter fence")
        return {}, errors

    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        errors.append("frontmatter is not closed by a second '---'")
        return {}, errors

    body = lines[1:end]
    fields: dict[str, str] = {}
    i = 0
    key_re = re.compile(r"^([a-zA-Z_][\w-]*)\s*:\s*(.*)$")
    while i < len(body):
        line = body[i]
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        m = key_re.match(line)
        if not m:
            i += 1
            continue
        key, value = m.group(1), m.group(2).rstrip()
        if value == "|" or value == ">":
            buf: list[str] = []
            i += 1
            while i < len(body):
                nxt = body[i]
                if nxt and not nxt.startswith((" ", "\t")) and key_re.match(nxt):
                    break
                buf.append(nxt.lstrip())
                i += 1
            joiner = "\n" if value == "|" else " "
            fields[key] = joiner.join(buf).strip()
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        fields[key] = value
        i += 1
    return fields, errors


def lint(path: Path) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for the file at *path*."""
    errors: list[str] = []
    warnings: list[str] = []

    if not path.exists():
        return [f"{path}: file does not exist"], []
    if path.name != "SKILL.md":
        return [], []

    text = path.read_text(encoding="utf-8", errors="replace")
    fields, fm_errors = parse_frontmatter(text)
    errors.extend(fm_errors)
    if fm_errors:
        return errors, warnings

    name = fields.get("name", "").strip()
    description = fields.get("description", "").strip()
    dir_name = path.parent.name

    if not name:
        errors.append("missing required field: name")
    else:
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name):
            errors.append(
                f"name='{name}' must be lowercase kebab-case (a-z, 0-9, hyphen)"
            )
        if name != dir_name:
            errors.append(
                f"name='{name}' does not match parent directory '{dir_name}'"
            )

    if not description:
        errors.append("missing required field: description")
    else:
        if len(description) > DESCRIPTION_CAP:
            errors.append(
                f"description is {len(description)} chars, exceeds cap of "
                f"{DESCRIPTION_CAP} — Claude Code will truncate it"
            )
        lower = description.lower()
        if not any(hint in lower for hint in TRIGGER_HINTS):
            warnings.append(
                "description lacks trigger phrasing — consider adding "
                "'Use when …', '当用户 …', 'Triggers — …' so the matcher "
                "knows when to fire"
            )

    return errors, warnings


def resolve_path_from_hook_payload() -> Path | None:
    raw = sys.stdin.read()
    if not raw.strip():
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("path")
    return Path(file_path) if file_path else None


def main(argv: list[str]) -> int:
    if "--hook" in argv:
        path = resolve_path_from_hook_payload()
        if path is None:
            return 0
    else:
        if len(argv) < 2:
            print("usage: lint_skill.py <path/to/SKILL.md> | --hook", file=sys.stderr)
            return 2
        path = Path(argv[1])

    if path.name != "SKILL.md":
        return 0

    errors, warnings = lint(path)
    rel = path
    try:
        rel = path.relative_to(Path.cwd())
    except ValueError:
        pass

    for w in warnings:
        print(f"warning: {rel}: {w}", file=sys.stderr)
    for e in errors:
        print(f"error: {rel}: {e}", file=sys.stderr)

    return 2 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
