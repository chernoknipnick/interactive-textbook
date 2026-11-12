"""Attach shared textbook icons, typography and navigation to HTML pages."""

from pathlib import Path
import os
import re


def add_site_icons(dist):
    dist = Path(dist).resolve()
    for page in dist.rglob("*.html"):
        source = page.read_text(encoding="utf-8")
        if "</head>" not in source:
            continue
        prefix = os.path.relpath(dist, page.parent).replace(os.sep, "/")
        prefix = "" if prefix == "." else prefix + "/"
        links = (
            '<!-- textbook-icons -->\n'
            f'<link rel="icon" href="{prefix}favicon.ico?v=1" sizes="16x16 32x32 48x48">\n'
            f'<link rel="icon" href="{prefix}favicon.svg?v=1" type="image/svg+xml" sizes="any">\n'
            f'<link rel="apple-touch-icon" href="{prefix}apple-touch-icon.png?v=1" sizes="180x180">\n'
            f'<link rel="stylesheet" href="{prefix}theme.css?v=26">\n'
            f'<script src="{prefix}java/motion.js?v=26" defer></script>\n'
            f'<script src="{prefix}reading-presentation.js?v=26" defer></script>\n'
            f'<script src="{prefix}site-shell.js?v=26" defer></script>\n'
            f'<link rel="stylesheet" href="{prefix}light.css?v=26">\n'
            '<!-- /textbook-icons -->'
        )
        if page != dist / "index.html":
            links = links.replace('<!-- /textbook-icons -->', f'<script src="{prefix}reader-position.js?v=26" defer></script>\n<!-- /textbook-icons -->')
        if "<!-- textbook-icons -->" in source:
            updated = re.sub(r"<!-- textbook-icons -->.*?<!-- /textbook-icons -->",
                             lambda _: links, source, flags=re.DOTALL)
        else:
            updated = source.replace("</head>", links + "\n</head>", 1)
        def version_stylesheet(match):
            href = match.group(2)
            if href.startswith(("http:", "https:", "//", "data:")):
                return match.group(0)
            return match.group(1) + href.split("?")[0] + "?v=26" + match.group(3)
        updated = re.sub(r'(<link\b[^>]*rel="stylesheet"[^>]*href=")([^"]+)(")',
                         version_stylesheet, updated)
        updated = re.sub(r'(<script\b[^>]*src=")([^"]+)(")', version_stylesheet, updated)
        # Typography is bundled locally; avoid blocking lesson rendering on external font services.
        updated = re.sub(r'<link\b[^>]*(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>', '', updated)
        # Identical UTF-8/LF output on Windows preview and Linux Pages.
        encoded = updated.encode("utf-8")
        if page.read_bytes() != encoded:
            page.write_bytes(encoded)


if __name__ == "__main__":
    # Keep the historical command safe: preparation only writes the ignored artifact.
    from build import build_site
    build_site()
