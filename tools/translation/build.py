import json, re, sys, glob, os
from pypinyin import pinyin, Style, load_phrases_dict
# usage: python3 tools/translation/build.py tools/translation app/words.json app/exercises/translation.json
# Reads the hand-written *.txt sources (one item per line: English | Chinese | alternatives separated by / | note),
# checks each answer only uses characters from its lesson or earlier, adds pinyin (pypinyin + fixes below) and writes the JSON.
SRC = sys.argv[1]; WORDS = sys.argv[2]; OUT = sys.argv[3]
words = json.load(open(WORDS))
order = []
for w in words:
    if w['l'] not in order: order.append(w['l'])
PUNCT = set('，。？！、：；“”…—（）')
WHITE = set('你王李明英一二三四五六七八九十')  # names + numbers
EXTRA = {'7.1': set('后')}  # 以后 is taught alongside 以前
# pinyin: seed phrase dict with the course's own pinyin
ph = {}
for w in words:
    d = w['d']
    if '…' in d or len(d) < 2: continue
    sy = w.get('sy') or w['p'].split()
    if len(sy) == len(d): ph[d] = [[s] for s in sy]
fix = {'得去':'děi qù','得买':'děi mǎi','得付':'děi fù','得看':'děi kàn','得赶':'děi gǎn','得保护':'děi bǎo hù',
 '得努力':'děi nǔ lì','得登':'děi dēng','得取':'děi qǔ','得办':'děi bàn','长得':'zhǎng de','一只':'yì zhī','两只':'liǎng zhī',
 '银行':'yín háng','头发':'tóu fa','很长':'hěn cháng','不长':'bù cháng','空儿':'kòng er','摔倒':'shuāi dǎo','倒很':'dào hěn','地上':'dì shang','慢慢地':'màn màn de',
 '努力地':'nǔ lì de','教我':'jiāo wǒ','教你':'jiāo nǐ','睡觉':'shuì jiào','觉得':'jué de','记得':'jì de','还是':'hái shi','还要':'hái yào',
 '还想':'hái xiǎng','还没':'hái méi','还在':'hái zài','还疼':'hái téng','打得':'dǎ de','说得':'shuō de','唱得':'chàng de','跳得':'tiào de',
 '起得':'qǐ de','吃得':'chī de','来得':'lái de','睡得':'shuì de','走得':'zǒu de','说明天':'shuō míng tiān','转给':'zhuǎn gěi','一场':'yì chǎng',
 '要是':'yào shi','只好':'zhǐ hǎo','差点儿':'chà diǎn er','差不多':'chà bu duō','干什么':'gàn shén me','干杯':'gān bēi','干净':'gān jìng',
 '为什么':'wèi shén me','好看':'hǎo kàn','好吃':'hǎo chī','好喝':'hǎo hē','便宜':'pián yi','随便':'suí biàn','几种':'jǐ zhǒng',
 '哪种':'nǎ zhǒng','哪一种':'nǎ yì zhǒng','很多种':'hěn duō zhǒng','这种':'zhè zhǒng','种食品':'zhǒng shí pǐn','空调':'kōng tiáo','放假':'fàng jià',
 '熟悉':'shú xī','发生':'fā shēng','发现':'fā xiàn','发票':'fā piào','传真':'chuán zhēn','一顿':'yí dùn','一遍':'yí biàn','三遍':'sān biàn',
 '长城':'Cháng chéng','的话':'de huà','行人':'xíng rén','都行':'dōu xíng','了吗':'le ma','极了':'jí le','死了':'sǐ le','透了':'tòu le',
 '一下':'yí xià','一会儿':'yí huì er','一点儿':'yì diǎn er','一样':'yí yàng','一定':'yí dìng','一起':'yì qǐ','一次':'yí cì','第一次':'dì yī cì',
 '一共':'yí gòng','不错':'bú cuò','不客气':'bú kè qi','不太':'bú tài','不像话':'bú xiàng huà','不过':'bú guò','对不起':'duì bu qǐ','没关系':'méi guān xi',
 '朋友':'péng you','女朋友':'nǚ péng you','男朋友':'nán péng you','休息':'xiū xi','家里':'jiā li','名字':'míng zi','什么':'shén me','意思':'yì si','东西':'dōng xi','衣服':'yī fu','先生':'xiān sheng','客气':'kè qi',
 '麻烦':'má fan','舒服':'shū fu','暖和':'nuǎn huo','凉快':'liáng kuai','热闹':'rè nao','清楚':'qīng chu','漂亮':'piào liang','咱们':'zán men',
 '明白':'míng bai','师傅':'shī fu','太太':'tài tai','爸爸':'bà ba','妈妈':'mā ma','孩子':'hái zi','本子':'běn zi','裤子':'kù zi','房子':'fáng zi',
 '院子':'yuàn zi','句子':'jù zi','肚子':'dù zi','眼睛':'yǎn jing','地方':'dì fang','告诉':'gào su','认识':'rèn shi','喜欢':'xǐ huan','谢谢':'xiè xie',
 '休息':'xiū xi','打算':'dǎ suan','事儿':'shì er','哪儿':'nǎ er','这儿':'zhè er','那儿':'nà er','玩儿':'wán er','花儿':'huā er','有点儿':'yǒu diǎn er',
 '点儿':'diǎn er','糊里糊涂':'hú li hú tú','怎么样':'zěn me yàng','怎么回事':'zěn me huí shì','我们':'wǒ men','你们':'nǐ men','他们':'tā men',
 '同学们':'tóng xué men','这么':'zhè me','那么':'nà me','怎么':'zěn me','多么':'duō me','那里':'nà li','这里':'zhè li','家里':'jiā li','山里':'shān li',
 '包里':'bāo li','宿舍里':'sù shè li','院子里':'yuàn zi li','口袋里':'kǒu dai li','箱里':'xiāng li','钱包里':'qián bāo li','口袋':'kǒu dai','马上':'mǎ shàng',
 '车上':'chē shang','纸上':'zhǐ shang','树上':'shù shang','草地上':'cǎo dì shang','活动上':'huó dòng shang','马路上':'mǎ lù shang','早上':'zǎo shang',
 '晚上':'wǎn shang','看见':'kàn jiàn','不见':'bú jiàn','摔伤':'shuāi shāng','撞到':'zhuàng dào','只说':'zhǐ shuō','只有':'zhǐ yǒu','学生':'xué sheng',
 '大夫':'dài fu','父母亲':'fù mǔ qīn','差点儿没':'chà diǎn er méi','赶上':'gǎn shàng',
 '王英':'Wáng Yīng','李明':'Lǐ Míng','王老师':'Wáng lǎo shī','李老师':'Lǐ lǎo shī','王先生':'Wáng xiān sheng','王经理':'Wáng jīng lǐ','李经理':'Lǐ jīng lǐ',
 '姓王':'xìng Wáng','姓李':'xìng Lǐ','这个':'zhè ge','那个':'nà ge','哪个':'nǎ ge','一个':'yí gè','两个':'liǎng gè','几个':'jǐ gè','个':'gè',
 '不去':'bú qù','不是':'bú shì','不叫':'bú jiào','不对':'bú duì','不会':'bú huì','不要':'bú yào','不卖':'bú mài','不认识':'bú rèn shi','不在':'bú zài',
 '不见了':'bú jiàn le','不太清楚':'bù tài qīng chu','不太贵':'bú tài guì','不太辣':'bú tài là','不错！':'bú cuò!','不熟悉':'bù shú xī','不感兴趣':'bù gǎn xìng qù',
 '不像':'bú xiàng','不累':'bú lèi','不舒服':'bù shū fu','不用':'bú yòng','不动':'bú dòng','不干净':'bù gān jìng','不新鲜':'bù xīn xiān','不热闹':'bú rè nao',
 '不一样':'bù yí yàng','不客气。':'bú kè qi.','一年':'yì nián','一百':'yì bǎi','一千':'yì qiān','一万':'yí wàn','一张':'yì zhāng','一支':'yì zhī',
 '一本':'yì běn','一条':'yì tiáo','一件':'yí jiàn','一副':'yí fù','一杯':'yì bēi','一套':'yí tào','一台':'yì tái','一家':'yì jiā','一些':'yì xiē',
 '一刻':'yí kè','一刻钟':'yí kè zhōng','一句':'yí jù','一到':'yí dào','一回':'yì huí','一听':'yì tīng','一通':'yí tòng','两通':'liǎng tòng','听说':'tīng shuō',
 '睡觉睡得':'shuì jiào shuì de','起床起得':'qǐ chuáng qǐ de','唱歌唱得':'chàng gē chàng de','跳舞跳得':'tiào wǔ tiào de','说汉语说得':'shuō Hàn yǔ shuō de',
 '谈话谈':'tán huà tán','学汉语学':'xué Hàn yǔ xué','打球打得':'dǎ qiú dǎ de','球打得':'qiú dǎ de','歌唱得':'gē chàng de','舞跳得':'wǔ tiào de',
 '汉语说得':'Hàn yǔ shuō de','着急':'zháo jí','坐着':'zuò zhe','开着':'kāi zhe','戴着':'dài zhe','穿着':'chuān zhe','好极了':'hǎo jí le','中国通':'Zhōng guó tōng',
 '一定要':'yí dìng yào','一定会':'yí dìng huì','爬山':'pá shān','车站':'chē zhàn','三路':'sān lù','教室':'jiào shì','阅读课':'yuè dú kè','房租':'fáng zū',
 '赶到':'gǎn dào','赶去':'gǎn qù','发传真':'fā chuán zhēn','发了':'fā le','有毒':'yǒu dú','好像':'hǎo xiàng','掉在':'diào zài','拿走':'ná zǒu','骑走':'qí zǒu',
 '会儿':'huì er','运气':'yùn qi','味道':'wèi dao','可是':'kě shì','只养':'zhǐ yǎng','汉语怎么说':'Hàn yǔ zěn me shuō','号码':'hào mǎ','一顿饭':'yí dùn fàn',
 '一副眼镜':'yí fù yǎn jìng','过马路':'guò mǎ lù','见过':'jiàn guo','去过':'qù guo','吃过':'chī guo','养过':'yǎng guo','看过':'kàn guo','看不懂':'kàn bu dǒng','记住':'jì zhù',
 '一封':'yì fēng','有时候':'yǒu shí hou','有的时候':'yǒu de shí hou','时候':'shí hou','有的':'yǒu de','别的':'bié de','红的':'hóng de','高的':'gāo de','新的':'xīn de',
 '我的':'wǒ de','零下':'líng xià','地下室':'dì xià shì','开车':'kāi chē','开门':'kāi mén','开灯':'kāi dēng','开始':'kāi shǐ','一辆':'yí liàng',
 '快乐':'kuài lè','高兴':'gāo xìng','感兴趣':'gǎn xìng qù','上课':'shàng kè','下车':'xià chē','下雨':'xià yǔ','下雪':'xià xuě','下旬':'xià xún','下午':'xià wǔ',
 '王':'Wáng','李':'Lǐ'}
names = {'中文':'Zhōng wén','英文':'Yīng wén','汉字':'Hàn zì','长城':'Cháng chéng','王英':'Wáng Yīng','李明':'Lǐ Míng','中国':'Zhōng guó','美国':'Měi guó','英国':'Yīng guó','汉语':'Hàn yǔ','英语':'Yīng yǔ','法语':'Fǎ yǔ','北京':'Běi jīng','上海':'Shàng hǎi',
 '广东':'Guǎng dōng','澳大利亚':'Ào dà lì yà','加拿大':'Jiā ná dà','林肯大学':'Lín kěn Dà xué','东亚学系':'Dōng yà xué xì','东方学院':'Dōng fāng Xué yuàn',
 '普通话':'Pǔ tōng huà','京剧':'Jīng jù','太极拳':'tài jí quán','汉英词典':'Hàn Yīng cí diǎn'}
fix.update(names)
for k,v in fix.items():
    if len(v.split()) == len(k) and all(ch not in PUNCT for ch in k): ph[k] = [[s] for s in v.split()]
load_phrases_dict(ph)
FIX = {k: v.split() for k, v in fix.items() if len(v.split()) == len(k) and len(k) > 1}
TRANS = str.maketrans({'，':',','。':'.','？':'?','！':'!','、':',','：':':','；':';'})
T4 = set('àèìòùǜ'); MARKS = set('āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ')
def tone(syl):
    for c in syl:
        if c in T4: return 4
        if c in MARKS: return 0
    return 5
DIG = set('零一二三四五六七八九十百千万两')
def to_py(zh):
    chars = list(zh)
    sy = [seg[0] for seg in pinyin(zh, style=Style.TONE, errors=lambda x: list(x))]
    assert len(sy) == len(chars), zh
    i = 0
    while i < len(chars):
        for n in range(min(6, len(chars) - i), 1, -1):
            k = zh[i:i+n]
            if k in FIX:
                sy[i:i+n] = FIX[k]; i += n - 1; break
        i += 1
    for i, c in enumerate(chars):
        nxt = sy[i+1] if i+1 < len(sy) else ''
        nc = chars[i+1] if i+1 < len(chars) else ''
        pc = chars[i-1] if i else ''
        if c == '不' and sy[i] != 'bu':
            sy[i] = 'bú' if tone(nxt) == 4 else 'bù'
        if c == '一':
            if pc and pc in '第十零' or pc and pc in DIG and pc not in '百千万' or nc and nc in DIG and nc not in '百千万' or nc in '月号' or not nc or nc in PUNCT:
                sy[i] = 'yī'
            elif tone(nxt) == 4 or (nc == '个'):
                sy[i] = 'yí'
            else:
                sy[i] = 'yì'
        if c == '个' and sy[i] == 'gè' and pc not in DIG and pc != '几': sy[i] = 'ge'
        if c == '谁': sy[i] = 'shéi'
        if c == '王': sy[i] = 'Wáng'
        if c == '李': sy[i] = 'Lǐ'
        if c == '得' and sy[i] == 'dé': sy[i] = 'de'
        if c == '边' and pc in '右左东西南北旁': sy[i] = 'biān'
    toks = []
    for i, c in enumerate(chars):
        if c == '儿' and i and chars[i-1] != '女' and toks and toks[-1][0] == 'py':
            toks[-1] = ('py', toks[-1][1] + 'r'); continue
        toks.append(('p', c) if c in PUNCT else ('py', sy[i]))
    s = ''
    for k, t in toks:
        if k == 'p': s = s.rstrip() + t.translate(TRANS) + ' '
        else: s += t + ' '
    s = s.strip()
    for name, p in names.items():
        if name in zh:
            low = p.lower()
            s = re.sub(r'(?i)(?<![a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])' + re.escape(low), p, s)
    for name in ('王英','李明','王','李','长城','中国通','汉字','中文','英文'):
        pass
    s = re.sub(r'(^|[.?!] )(\S)', lambda m: m.group(1) + m.group(2).upper(), s)
    return s
# cumulative vocab
lessons = {}
for f in sorted(glob.glob(os.path.join(SRC, '*.txt'))):
    cur = None
    for line in open(f):
        line = line.rstrip('\n')
        if not line.strip(): continue
        if line.startswith('## '):
            cur = line[3:].strip(); lessons.setdefault(cur, []); continue
        parts = [p.strip() for p in line.split('|')]
        while len(parts) < 4: parts.append('')
        en, zh, alt, note = parts[:4]
        lessons[cur].append(dict(en=en, zh=zh, alt=[a.strip() for a in alt.split('/') if a.strip()], note=note))
allowed = set(WHITE); bad = 0
cum_words = []
data = {'lessons': []}
n = 0
for L in order:
    lw = [w for w in words if w['l'] == L]
    for w in lw:
        allowed |= set(c for c in w['d'] if c not in '…'); cum_words.append(w['d'])
    allowed |= EXTRA.get(L, set())
    items = lessons.get(L, [])
    out = []
    lw_forms = sorted({p for w in lw for p in w['d'].split('…') if len(p) >= 1 and p not in ('','了')}, key=len, reverse=True)
    for i, it in enumerate(items, 1):
        for s in [it['zh']] + it['alt']:
            miss = [c for c in s if c not in allowed and c not in PUNCT and c not in '，。？！、 ']
            if miss:
                bad += 1; print('VOCAB', L, s, ''.join(miss))
        focus = []
        rest = it['zh']
        for f in lw_forms:
            if len(f) > 1 or f in it['zh']:
                if f in rest:
                    focus.append(f); rest = rest.replace(f, '\0')
        rec = {'id': f'{L}-{i:02d}', 'en': it['en'], 'zh': it['zh'], 'py': to_py(it['zh'])}
        if it['alt']: rec['alt'] = it['alt']
        if it['note']: rec['note'] = it['note']
        rec['words'] = [f for f in focus if len(f) > 1 or f not in '的了吗呢吧也很不是有']
        out.append(rec); n += 1
    data['lessons'].append({'lesson': L, 'count': len(out), 'items': out})
missing = [L for L in order if not lessons.get(L)]
print('items', n, 'vocab problems', bad, 'missing lessons', missing, 'extra', set(lessons) - set(order))
meta = {
 'title': 'English to Chinese translation exercises',
 'course': 'Contemporary Chinese for Beginners',
 'script': 'simplified',
 'version': 1,
 'item_count': n,
 'format': {
   'id': 'lesson-number, e.g. "2.1-07"',
   'en': 'English prompt shown to the learner',
   'zh': 'model answer in simplified characters',
   'alt': 'optional list of other accepted answers',
   'py': 'pinyin of the model answer, syllables separated by spaces, with the spoken 一/不 tone changes and erhua (nǎr); show it after checking, or as a hint',
   'note': 'optional hint to show with the prompt (grammar point or which word to use)',
   'words': 'vocab from this lesson that the model answer practises (matches "d" in app/words.json)'
 },
 'vocab_rule': 'Each lesson uses only characters taught in that lesson or earlier (app/words.json), plus numbers 一 to 十 and the names 王英, 李明, 王, 李. Lesson 7.1 also allows 后 (以后).',
 'use': 'Writing practice: show en (and note), the learner writes the Chinese by hand, then reveal zh, alt and py.',
 'marking': 'Compare after removing punctuation and spaces. Accept zh or any alt. Treat 你/您 as interchangeable unless the note says polite.'
}
# one item per line so the file is easy to read and diff
J = lambda o: json.dumps(o, ensure_ascii=False)
lines = ['{']
for k, v in meta.items(): lines.append(f' {J(k)}: {J(v)},')
lines.append(' "lessons": [')
for li, L in enumerate(data['lessons']):
    lines.append(f'  {{"lesson": {J(L["lesson"])}, "count": {L["count"]}, "items": [')
    lines += ['   ' + J(it) + (',' if j < len(L['items']) - 1 else '') for j, it in enumerate(L['items'])]
    lines.append('  ]}' + (',' if li < len(data['lessons']) - 1 else ''))
lines += [' ]', '}']
open(OUT, 'w').write('\n'.join(lines) + '\n')
json.load(open(OUT))
