"""Subsets the app's fonts to the characters it uses and writes them to app/fonts/ as woff2.

Self-hosted fonts (instead of Google Fonts) keep the app working where Google is blocked, such as mainland China.
Rerun after adding lessons or UI text. Needs `pip install fonttools brotli` and the full fonts in pkgs/fonts/
(Noto Serif SC 500 and 700, Source Sans 3 400, 600 and 700, as TTF from Google Fonts; both are under the SIL OFL 1.1).
"""
import glob, os
from fontTools import subset

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
text = "".join(open(f, encoding="utf-8").read() for f in [os.path.join(ROOT, "app", "index.html")] + glob.glob(os.path.join(ROOT, "app", "**", "*.json"), recursive=True))
ascii_ = "".join(chr(c) for c in range(0x20, 0x7f))
latin = ascii_ + "".join(chr(c) for c in range(0xa0, 0x250)) + "".join(chr(c) for c in range(0x2000, 0x2070)) + "·–—‘’“”…•→←↑↓★☆−×"
han = ascii_ + "".join(sorted({c for c in text if ord(c) >= 0x2e80}))
FONTS = [("NotoSerifSC-500", han), ("NotoSerifSC-700", han), ("SourceSans3-400", latin), ("SourceSans3-600", latin), ("SourceSans3-700", latin)]
for name, chars in FONTS:
    opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]
    font = subset.load_font(os.path.join(ROOT, "pkgs", "fonts", name + ".ttf"), opts)
    s = subset.Subsetter(opts); s.populate(text=chars); s.subset(font)
    out = os.path.join(ROOT, "app", "fonts", name + ".woff2")
    subset.save_font(font, out, opts)
    print(out, os.path.getsize(out), "bytes")
