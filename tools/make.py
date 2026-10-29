import csv,json,re,os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from gloss import gloss, pinyin
from overrides import O
rows=[x for x in csv.DictReader((l for l in open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','vocab.tsv'),encoding='utf-8') if not l.startswith('#')),delimiter='\t')]
words=[]
for x in rows:
    i=int(x['id']); o=O.get(i,{})
    d=o.get('d',x['word'])
    t=o.get('t',''.join(c for c in d if '一'<=c<='鿿'))
    p=o.get('p') or pinyin(t)
    p=re.sub(r'\s+',' ',p).strip()
    h=o.get('h') or gloss(t)
    if not h: print('NO HINT',i,d)
    words.append(dict(id=i,l=x['lesson'],d=d,t=t,p=p,h=h,pos=x['pos']))
for w in words:
    if len(w['h'])>45: print('LONG',w['id'],w['h'])
json.dump(words,open('words.json','w'),ensure_ascii=False,separators=(',',':'))
chars=set(c for w in words for c in w['t'])
# characters used in the translation answers (numbers, names) also need stroke data
if os.path.exists('exercises/translation.json'):
    X=json.load(open('exercises/translation.json'))
    chars|=set(c for L in X['lessons'] for it in L['items'] for t in [it['zh']]+it.get('alt',[]) for c in t if '一'<=c<='鿿')
chars=sorted(chars)
S={}
for c in chars:
    j=json.load(open(f'../pkgs/hwd/package/{c}.json'))
    S[c]=j
json.dump(S,open('strokes.json','w'),ensure_ascii=False,separators=(',',':'))
print(len(words),len(chars),os.path.getsize('strokes.json'))

# tones per character (1-4, 5 = neutral) where the pinyin splits cleanly into one syllable per character
TM = {}
for base, marks in {'a':'āáǎà','e':'ēéěè','i':'īíǐì','o':'ōóǒò','u':'ūúǔù','ü':'ǖǘǚǜ'}.items():
    for n,ch in enumerate(marks): TM[ch]=n+1
SYL = re.compile(r"(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(?:ng(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔù])|n(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùg])|r(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔù]))?", re.I)
ok=0
for w in words:
    p = w['p'].replace('……',' ').replace('…',' ')
    syls = [m.group(0) for tok in p.split() for m in SYL.finditer(tok)]
    if len(syls) == len(w['t']):
        w['tn'] = [next((TM[c] for c in s if c in TM), 5) for s in syls]
        w['sy'] = syls
        ok += 1
print('tones for', ok, 'of', len(words))
json.dump(words,open('words.json','w'),ensure_ascii=False,separators=(',',':'))
