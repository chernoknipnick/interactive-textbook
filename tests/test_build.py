"""Regression checks for source isolation and deterministic preparation."""
import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "scripts"))
from site_icons import add_site_icons

def digest_tree(directory):
    return {str(p.relative_to(directory)):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob("*") if p.is_file()}

class BuildTests(unittest.TestCase):
    def test_source_unchanged_and_repeatable(self):
        before=digest_tree(ROOT / "dist")
        status=subprocess.check_output(["git","status","--porcelain"],cwd=ROOT)
        subprocess.run([sys.executable,"scripts/build.py"],cwd=ROOT,check=True)
        first=digest_tree(ROOT / "build")
        subprocess.run([sys.executable,"scripts/site_icons.py"],cwd=ROOT,check=True)
        self.assertEqual(first,digest_tree(ROOT / "build"))
        self.assertEqual(before,digest_tree(ROOT / "dist"))
        self.assertEqual(status,subprocess.check_output(["git","status","--porcelain"],cwd=ROOT))
        self.assertIn(".nojekyll",first)
        for page in (ROOT / "build").rglob("*.html"):
            self.assertNotIn(b"\r\n", page.read_bytes(), str(page))
            source=page.read_text(encoding="utf-8")
            self.assertEqual(1,source.count("<!-- textbook-icons -->"),str(page))
            self.assertIn("light.css?v=25",source)
        add_site_icons(ROOT / "build")
        self.assertEqual(first,digest_tree(ROOT / "build"))

if __name__=="__main__":
    unittest.main()
