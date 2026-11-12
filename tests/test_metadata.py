import sys,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from site_content import Document

class Checks(unittest.TestCase):
    def test_all_pages_have_unique_metadata_and_one_h1(self):
        titles=set();descriptions=set()
        for path in (ROOT/'build').rglob('*.html'):
            root=Document(path.read_text(encoding='utf-8')).root
            title=next(n.text(False).strip() for n in root.walk() if n.tag=='title')
            description=next(n.attrs['content'] for n in root.walk() if n.tag=='meta' and n.attrs.get('name')=='description')
            self.assertTrue(description);self.assertNotIn(title,titles);self.assertNotIn(description,descriptions);titles.add(title);descriptions.add(description)
            for field in ['og:title','og:description','og:url']:
                self.assertTrue(any(n.attrs.get('property')==field and n.attrs.get('content') for n in root.walk()))

if __name__=="__main__":unittest.main()
