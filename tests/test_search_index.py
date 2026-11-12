import sys,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from site_content import Document,normalize_headings

class Checks(unittest.TestCase):
    def test_search_index_size_and_body_terms(self):
        path=ROOT/'build/search-index.json';self.assertLessEqual(path.stat().st_size,150000)
        index=json.loads(path.read_text(encoding='utf-8'));terms={};previous=''
        for line in index['lexicon'].splitlines():
            prefix,suffix,posting=line.split('|');word=previous[:int(prefix,16)]+suffix;previous=word
            ids=[i for i in range(len(index['documents'])) if int(posting[1:],16)&(1<<i)] if posting.startswith('#') else [int(i,36) for i in posting.split('.')]
            terms[word]=ids
        fixtures=[('dex','#java-languages'),('транзакци','#05'),('инкапсуляци','#java-constructors'),('инкапсуляци','#java-oop-summary')]
        for token,url in fixtures:
            found={index['documents'][i]['u'] for word,ids in terms.items() if token in word for i in ids}
            self.assertIn(url,found)

if __name__=="__main__":unittest.main()
