"""Prepare the exact static artifact used by preview and GitHub Pages."""
from pathlib import Path
import shutil
from site_icons import add_site_icons
from site_content import prepare_metadata

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist"
OUTPUT = ROOT / "build"

def build_site():
    # Delete only our named artifact directory, never the source or an external link.
    if OUTPUT.is_symlink() or getattr(OUTPUT, "is_junction", lambda: False)() or OUTPUT.resolve() != ROOT / "build":
        raise RuntimeError("Refusing to replace a linked or unexpected build directory")
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(SOURCE, OUTPUT)
    add_site_icons(OUTPUT)
    prepare_metadata(OUTPUT)
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Prepared {sum(1 for _ in OUTPUT.rglob('*.html'))} HTML pages in {OUTPUT}")
    return OUTPUT

if __name__ == "__main__":
    build_site()
