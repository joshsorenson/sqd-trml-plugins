#!/usr/bin/env python3
"""
Regenerates the copy-paste sections of public/linear/index.html from src/.

Run after changing anything in src/:
    python3 scripts/sync-guide.py

Everything between a pair of <!-- sync:NAME --> ... <!-- /sync:NAME --> markers
is replaced. The rest of the page is left alone.
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GUIDE = ROOT / "public" / "linear" / "index.html"
SRC = ROOT / "src"

# TRMNL's markup editor tab names, in the order they appear there
TEMPLATES = [
    ("full", "Full"),
    ("half_horizontal", "Half Horizontal"),
    ("half_vertical", "Half Vertical"),
    ("quadrant", "Quadrant"),
    ("shared", "Shared"),
]


def read_setting(settings: str, key: str) -> str:
    match = re.search(rf"^{key}: (.*)$", settings, re.MULTILINE)
    if not match:
        raise SystemExit(f"settings.yml is missing {key}")
    return match.group(1).strip()


def copy_block(block_id: str, label: str, body: str) -> str:
    return (
        f'<div class="config-item">\n'
        f'  <div class="config-label">{label}</div>\n'
        f'  <div class="config-value">\n'
        f'    <button class="copy-btn" onclick="copyBlock(\'{block_id}\', this)">Copy</button>\n'
        f'    <pre class="copy-source" id="{block_id}">{html.escape(body)}</pre>\n'
        f'  </div>\n'
        f'</div>'
    )


def main() -> None:
    settings = (SRC / "settings.yml").read_text()
    custom_fields = settings.split("custom_fields:\n", 1)[1].rstrip() + "\n"

    sections = {
        "polling": "\n".join(
            [
                copy_block("polling-url", "Polling URL", read_setting(settings, "polling_url")),
                copy_block("polling-headers", "Polling Headers", read_setting(settings, "polling_headers")),
                '<p class="note">TRMNL fills in {{ linear_api_key }} from the form field. '
                "The key travels in a header, so it never shows up in a URL or a log.</p>",
            ]
        ),
        "form-fields": copy_block("form-fields", "Form Fields", custom_fields),
        "markup": "\n".join(
            copy_block(f"markup-{name}", label, (SRC / f"{name}.liquid").read_text())
            for name, label in TEMPLATES
        ),
    }

    page = GUIDE.read_text()
    for name, body in sections.items():
        pattern = re.compile(rf"(<!-- sync:{name} -->).*?(<!-- /sync:{name} -->)", re.DOTALL)
        if not pattern.search(page):
            raise SystemExit(f"guide is missing the sync:{name} markers")
        page = pattern.sub(lambda m: m.group(1) + "\n" + body + "\n" + m.group(2), page)

    GUIDE.write_text(page)
    print(f"Synced {GUIDE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
