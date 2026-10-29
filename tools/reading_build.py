"""Builds app/exercises/reading.json from the hand-written passages in tools/reading/*.txt.

Source format (one file per group of lessons, read in name order):
  @ 2.1                         starts a lesson
  # dialogue | 中文标题 | English title    starts a passage (kind: dialogue or story)
  王小明: 你好！ | Hello!        a dialogue line (speaker before the colon)
  我叫王小明。 | My name is ... a story line
  ? 他叫什么？ | What is he called? | Right answer; wrong; wrong
A character followed by {pinyin} overrides its pinyin, e.g. 只{zhī}; _ between characters forces a word break.
Pinyin comes from words.json for course vocab and from pypinyin otherwise; words are split preferring course vocab
over pypinyin's phrase list. Every Chinese character must come from that lesson's vocab or
an earlier lesson's, or from EXTRA below, and no vocab word may appear before its lesson; the build fails otherwise.
Run from the repo root: python3 tools/reading_build.py
"""
import glob, json, os, re, sys
from pypinyin import pinyin, Style
from pypinyin.phrases_dict import phrases_dict

# Numbers, the cast's names and a few function words the course uses before teaching them as cards.
EXTRA = set("一二三四五六七八九十") | set("王小明李文马克安娜") | set("你中")
NAMES = {"王小明": "Wáng Xiǎomíng", "李文": "Lǐ Wén", "马克": "Mǎkè", "安娜": "Ānnà",
         "小明": "Xiǎomíng", "老王": "Lǎo Wáng", "老李": "Lǎo Lǐ", "小李": "Xiǎo Lǐ", "小王": "Xiǎo Wáng",
         "王": "Wáng", "李": "Lǐ", "马龙": "Mǎ Lóng", "王老师": "Wáng lǎoshī", "李老师": "Lǐ lǎoshī", "王先生": "Wáng xiānsheng", "龙山": "Lóngshān"}
PROPER = {"中国", "美国", "英国", "法国", "北京", "上海", "广东", "澳大利亚", "加拿大", "汉语", "英语",
          "法语", "中文", "英文", "普通话", "林肯大学", "东方学院", "东亚学系", "龙山", "长城"}
PUNCT = "，。？！：；、“”‘’（）…—"

words = json.load(open("app/words.json"))
order = []
for w in words:
    if w["l"] not in order:
        order.append(w["l"])
known, upto = set(), {}
vocab, vpy = set(), {}
for l in order:
    for w in words:
        if w["l"] == l:
            known |= set(re.sub(r"[^\u4e00-\u9fff]", "", w["d"]))
            for part in re.split(r"[……/、]+", w["d"]):
                if part:
                    vocab.add(part)
    upto[l] = set(known)
for w in words:
    if re.fullmatch(r"[\u4e00-\u9fff]+", w["d"]):
        vpy.setdefault(w["d"], set()).add(w["p"])
first = {}
for w in words:
    for part in re.split(r"[……/、]+", w["d"]):
        if len(part) >= 2 and part not in first:
            first[part] = w["l"]
# words whose reading depends on meaning: default reading, override with 字{py} where needed
AMBIG = {"只": "zhǐ", "过": "guò", "得": "de"}
VPY = {k: (AMBIG.get(k) or next(iter(v))) for k, v in vpy.items() if len(v) == 1 or k in AMBIG}
PHRASES = {k for k in phrases_dict if 2 <= len(k) <= 4}
FIXED = {"一": "yī", "不": "bù"}  # dictionary tones throughout, like words.json


def han(c):
    return "\u4e00" <= c <= "\u9fff"


def split(text):
    """Segments a run of Han characters, preferring course vocab over pypinyin phrases."""
    n = len(text)
    best = [(0, [])] + [(1e9, None)] * n
    for i in range(n):
        if best[i][1] is None:
            continue
        for k in range(1, min(6, n - i) + 1):
            seg = text[i:i + k]
            if seg in NAMES or seg in vocab or seg in PROPER or seg in WORDING:
                cost = 1
            elif k == 1:
                cost = 2
            elif seg in PHRASES:
                cost = 1 + 0.6 * k
            else:
                continue
            c = best[i][0] + cost
            if c < best[i + k][0]:
                best[i + k] = (c, best[i][1] + [seg])
    return best[n][1]


# how some segments are written as words (spacing and capitals)
WORDING = {"您贵姓": "nín guìxìng", "哪国人": "nǎ guó rén", "我的": "wǒ de", "我们的": "wǒmen de",
           "电子邮件": "diànzǐ yóujiàn", "打电话": "dǎ diànhuà", "电话号码": "diànhuà hàomǎ",
           "林肯大学": "Línkěn Dàxué", "东方学院": "Dōngfāng Xuéyuàn", "东亚学系": "Dōngyà Xuéxì",
           "汉英词典": "Hàn-Yīng cídiǎn", "酸辣汤": "suānlà tāng", "糖醋鱼": "tángcù yú",
           "公共汽车": "gōnggòng qìchē", "这个": "zhège", "中午": "zhōngwǔ", "外面": "wàimiàn", "左边": "zuǒbian", "以后": "yǐhòu", "后天": "hòutiān", "后来": "hòulái", "时候": "shíhou", "小时候": "xiǎoshíhou", "电话": "diànhuà", "不错": "bùcuò", "明年": "míngnián", "里面": "lǐmiàn", "怎么回事": "zěnme huí shì", "那个": "nàge", "哪个": "nǎge", "什么时候": "shénme shíhou", "糊里糊涂": "húlihútu"}


def join(syls):
    """Joins syllables into one word, with an apostrophe before a, e, o."""
    out = ""
    for s in syls:
        if out and s[:1].lower() in "aāáǎàeēéěèoōóǒò":
            out += "'"
        out += s
    return out


def seg_py(seg, over):
    """over: {index in seg: pinyin}."""
    if seg in NAMES:
        return NAMES[seg]
    if seg in WORDING and not over:
        return WORDING[seg]
    if seg in VPY and not over:
        syls = VPY[seg].split()
    else:
        syls = [over.get(k) or (FIXED.get(seg[k]) if len(seg) > 1 or seg[k] in FIXED else None) or p[0]
                for k, p in enumerate(pinyin(seg, style=Style.TONE))]
    syl = join(syls)
    if seg.endswith("儿") and len(seg) > 1 and syl.endswith("ér"):
        syl = syl[:-2].rstrip("'") + "r"
    if seg in PROPER:
        syl = syl[0].upper() + syl[1:]
    return syl


PMAP = {"，": ",", "。": ".", "？": "?", "！": "!", "：": ":", "；": ";", "、": ",", "“": "\u201c",
        "”": "\u201d", "（": "(", "）": ")", "…": "…", "—": "—"}


def to_py(raw):
    """raw may contain 字{py} overrides. Returns (zh, pinyin string)."""
    over, zh = {}, ""
    raw = raw.replace("……", "…")
    for m in re.finditer(r"(.)(\{[^}]*\})?", raw):
        if m.group(2):
            over[len(zh)] = m.group(2)[1:-1]
        zh += m.group(1)
    out, i = "", 0
    for run in re.findall(r"[\u4e00-\u9fff]+|[^\u4e00-\u9fff]", zh):
        if run == "_":  # word-boundary hint in the source, e.g. 很多_大公司
            i += 1
            continue
        if han(run[0]):
            for seg in split(run):
                o = {k: over[i + k] for k in range(len(seg)) if i + k in over}
                if out and not out.endswith(("\u201c", "(", " ")) and seg != "们":
                    out += " "
                out += seg_py(seg, o)
                i += len(seg)
        else:
            p = PMAP.get(run, run)
            if p in ("\u201c", "("):
                out += " " if out and not out.endswith(" ") else ""
            out += p
            if p in ",.?!:;\u201d)" or p == "…":
                out += " "
            i += 1
    out = re.sub(r" +", " ", out).strip()
    out = re.sub(r" ([,.?!:;\u201d)])", r"\1", out)
    out = re.sub(r'(^|[.?!]\u201d? |[.?!:] \u201c|^\u201c)([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü])',
                 lambda m: m.group(1) + m.group(2).upper(), out)
    return zh.replace("_", ""), out


def build():
    lessons, errors = {}, []
    cur_l = cur_p = None
    for f in sorted(glob.glob("tools/reading/*.txt")):
        for n, line in enumerate(open(f, encoding="utf-8"), 1):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            where = f"{f}:{n}"
            if line.startswith("@"):
                cur_l = line[1:].strip()
                if cur_l not in upto:
                    errors.append(f"{where}: unknown lesson {cur_l}")
                lessons[cur_l] = []
                continue
            if line.startswith("#"):
                kind, tzh, ten = [x.strip() for x in line[1:].split("|")]
                zh, py = to_py(tzh)
                cur_p = {"id": f"{cur_l}-{len(lessons[cur_l]) + 1}", "kind": kind,
                         "title": {"zh": zh, "py": py, "en": ten}, "lines": [], "questions": []}
                lessons[cur_l].append(cur_p)
                check(zh, cur_l, where, errors)
                continue
            if line.startswith("?"):
                q, en, opts = [x.strip() for x in line[1:].split("|")]
                zh, py = to_py(q)
                check(zh, cur_l, where, errors)
                opts = [o.strip() for o in opts.split(";")]
                if len(opts) < 3 or len(set(opts)) != len(opts):
                    errors.append(f"{where}: need 3+ distinct options")
                cur_p["questions"].append({"zh": zh, "py": py, "en": en, "options": opts})
                continue
            zh_raw, en = [x.strip() for x in line.split("|")]
            speaker = None
            m = re.match(r"^([一-鿿]{1,4})[:：]\s*(.*)$", zh_raw)
            if m and cur_p["kind"] == "dialogue":
                speaker, zh_raw = m.group(1), m.group(2)
            zh, py = to_py(zh_raw)
            check(zh, cur_l, where, errors)
            ln = {"zh": zh, "py": py, "en": en}
            if speaker:
                ln = {"speaker": speaker, "speaker_py": NAMES.get(speaker) or to_py(speaker)[1], **ln}
                check(speaker, cur_l, where, errors)
            cur_p["lines"].append(ln)
    missing = [l for l in order if l not in lessons]
    if missing:
        print("lessons not written yet:", " ".join(missing))
    if errors:
        print("\n".join(errors)); sys.exit(1)
    own = {}
    for w in words:
        if re.fullmatch(r"[\u4e00-\u9fff]+", w["d"]):
            own.setdefault(w["l"], []).append(w["d"])
    for l, ps in lessons.items():
        for p in ps:
            p["text"] = "".join(x["zh"] for x in p["lines"])
            body = p["title"]["zh"] + p["text"] + "".join(q["zh"] for q in p["questions"])
            p["words"] = sorted({d for d in own.get(l, []) if d in body}, key=body.index)
    np = sum(len(v) for v in lessons.values())
    nq = sum(len(p["questions"]) for v in lessons.values() for p in v)
    out = {
        "title": "Reading practice",
        "course": "Contemporary Chinese for Beginners",
        "script": "simplified",
        "version": 1,
        "passage_count": np,
        "question_count": nq,
        "format": FORMAT,
        "vocab_rule": VOCAB_RULE,
        "lessons": [{"lesson": l, "count": len(lessons[l]), "passages": lessons[l]} for l in order if l in lessons],
    }
    os.makedirs("app/exercises", exist_ok=True)
    with open("app/exercises/reading.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f"app/exercises/reading.json: {len(lessons)} lessons, {np} passages, {nq} questions")


# later-lesson vocab that is fine early: its characters are known and the meaning is plain from them
EARLY_OK = {"中国", "英国", "分钟", "哪国人"}


def check(zh, lesson, where, errors):
    li = order.index(lesson) if lesson in order else 0
    for word, fl in first.items():
        if word in zh and order.index(fl) > li and word not in EARLY_OK:
            # ignore a match inside a longer word that is already taught (怎么 in 怎么样)
            if not any(word in k and k in zh and order.index(first[k]) <= li for k in first if len(k) > len(word)):
                errors.append(f"{where}: {lesson} uses {word}, taught in {fl}: {zh}")
    bad = sorted({c for c in zh if "一" <= c <= "鿿" and c not in upto.get(lesson, set()) and c not in EXTRA})
    if bad:
        errors.append(f"{where}: {lesson} has not taught {''.join(bad)} in: {zh}")


FORMAT = {
    "lessons": "one entry per lesson, in course order; lesson matches 'l' in app/words.json (1.1 to 20.2, no 11.2)",
    "passages": "two per lesson: a dialogue and a short story (kind: 'dialogue' or 'story')",
    "id": "lesson-number, e.g. '2.1-1'",
    "title": "{zh, py, en}",
    "lines": "one per sentence or speaking turn: {speaker?, speaker_py?, zh, py, en}; speaker is only on dialogue lines",
    "text": "all line zh joined, for listening mode (read it aloud with zh-CN speech, text hidden)",
    "words": "this lesson's own vocab (words.json 'd') that the passage uses, in order of first use",
    "questions": "{zh, py, en, options}: asked in Chinese, with pinyin and English available; options are in English and "
                 "the FIRST option is always the right answer, so shuffle before showing (same convention as lessons.json)",
    "py": "pinyin with dictionary tones, like words.json (no 一/不 tone-change marks), erhua written as -r, words separated by spaces",
}
VOCAB_RULE = ("Every Chinese character in a lesson's passages, titles and questions comes from that lesson's vocab or an "
              "earlier lesson's, plus 你, 中, the numbers 一 to 十 and the cast's names (王小明, 李文, 马克, 安娜). No "
              "multi-character vocab item is used before the lesson that teaches it (except 中国, 英国, 哪国人 and 分钟, "
              "whose characters are already known). tools/reading_build.py checks this on every build.")

if __name__ == "__main__":
    build()
