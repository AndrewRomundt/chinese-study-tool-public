# Looks up pinyin and short English hints in CC-CEDICT (CC BY-SA 4.0, https://cc-cedict.org/).
# Expects the dictionary at pkgs/cedict_1_0_ts_utf-8_mdbg.txt (see README: Rebuild the data).
import os,re
from pypinyin import lazy_pinyin, Style
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
D={}
for line in open(os.path.join(ROOT,'pkgs','cedict_1_0_ts_utf-8_mdbg.txt'),encoding='utf-8'):
    if line.startswith('#'): continue
    m=re.match(r'(\S+) (\S+) \[([^\]]*)\] /(.*)/$',line.strip())
    if m: D.setdefault(m.group(2),[]).append((m.group(3),m.group(4).split('/')))
BAD=re.compile(r'surname|variant of|abbr|archaic|\(old\)|classical|literary|dialect|brand|\(Tw\)|^see |erhua|loanword|^CL:|\[|\(slang\)|\(coll',re.I)
MARKS={'a':'āáǎà','e':'ēéěè','i':'īíǐì','o':'ōóǒò','u':'ūúǔù','ü':'ǖǘǚǜ'}
def mark(syl):
    s=syl.lower().replace('u:','ü').replace('v','ü')
    if s[-1:].isdigit():
        t=int(s[-1]); s=s[:-1]
        v=next((c for c in 'ae' if c in s),None) or ('o' if 'ou' in s else next((c for c in reversed(s) if c in 'iouü'),None))
        if v and t<5: s=s.replace(v,MARKS[v][t-1],1)
    return s[:1].upper()+s[1:] if syl[:1].isupper() else s  # keep proper nouns capitalised
def numbered(p): return ' '.join(mark(x) for x in p.split())
def guess(t): return ' '.join(lazy_pinyin(t,style=Style.TONE))
def entry(t):
    """Best CC-CEDICT entry for t: a common-noun reading over a proper noun, then the reading pypinyin expects."""
    es=D.get(t)
    if not es: return None
    g=guess(t)
    return min(es,key=lambda e:(e[0][:1].isupper(),all(BAD.search(x) for x in e[1]),numbered(e[0])!=g))
def pinyin(t):
    e=entry(t)
    return numbered(e[0]) if e else guess(t)
def gloss(t):
    e=entry(t)
    if not e: return ''
    parts=[re.sub(r'\s*\(CL:[^)]*\)','',p).strip() for p in e[1] if p.strip()]
    good=[p for p in parts if not BAD.search(p)] or parts
    out=[]
    for p in good:
        if len('; '.join(out+[p]))>38 and out: break
        out.append(p)
    return '; '.join(out)
