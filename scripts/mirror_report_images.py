"""Mirror every COA report image into the repo and rebuild its two lower field
rows, so that all six fields of a report follow one grid.

Why this exists
---------------
The COA page links 97 report JPEGs that live on a third-party image host.  They
were all produced by the same generator (1588 x 2245 px, identical field grid),
and in that layout two rows are drawn off-grid:

  * Manufacturer / Official Website - lighter grey, 92 px tall instead of 65,
    a wider box, smaller value text, and the old brand inside the fields,
  * Sample / Batch - the box is pushed left (x=274 instead of 367) to make room
    for long sample names, so it no longer lines up with the rows above.

This script downloads each report, rebuilds both rows on the template of the
"Task Number" / "Received Date" row (same box outline, grey and height, same label
size, label baseline = box top + 43, ">" marker, value baseline = box top + 38,
value ink at box left + 19), and writes the result to `frontend/public/reports/`.
It then rewrites the reportUrl entries in `frontend/src/data/catalog.json` and
`coaExtra.json` to the mirrored copies, so the site serves its own reports.

Per-report data is preserved: the Sample value (sample name) and the Batch value
are lifted out of the original image and re-placed inside the rebuilt box, so every
report keeps its own sample name and batch number.  A few reports carry a sample
name too long for the standard box; their value is scaled down just enough to fit
rather than allowed to overflow.

Usage:
    python scripts/mirror_report_images.py            # mirror everything pending
    python scripts/mirror_report_images.py --limit 3  # try three first

Source URLs are recorded in `scripts/report_image_sources.json`.
"""
import argparse
import hashlib
import io
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "frontend" / "src" / "data"
OUT_DIR = ROOT / "frontend" / "public" / "reports"
SOURCES = ROOT / "scripts" / "report_image_sources.json"

# Row-1 ("Task Number" / "Received Date") of the report template.
BOX_LEFT = (367, 260, 716, 325)     # x0, y0, x1, y1 (exclusive)
BOX_RIGHT = (1154, 260, 1484, 325)
LABEL_BASELINE_OFFSET = 43          # row 1: label baseline 303 - box top 260
VALUE_BASELINE_OFFSET = 38          # row 1: value baseline 298 - box top 260
VALUE_PAD = 19                      # row 1: value ink x 386 - box left 367
LABEL_INK_X = {"left": 112, "right": 863}
MARKER = {
    "left": {"patch": (316, 276, 346, 306), "ink": (323, 285, 338, 301)},
    "right": {"patch": (1076, 278, 1106, 308), "ink": (1083, 287, 1098, 303)},
}
MARKER_LABEL_GAP = 19               # row 1: marker ink 323 - label ink end 303
MARKER_BOX_GAP = 29                 # row 1: box left 367 - marker ink 323
LETTER_GAP = 6                      # never let the marker touch the label

ROW3_TOP = 489                      # Manufacturer / Official Website
ROW4_TOP = 588                      # Sample / Batch
BAND = (100, 470, 1532, 660)        # area rebuilt on every report

FONTS = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\tahoma.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
LABEL_SIZE = 32.5
VALUE_SIZE = 24.5
QUALITY = 88


def resolve_font() -> str:
    for path in FONTS:
        if Path(path).exists():
            return path
    raise SystemExit("no usable TrueType font found")


def ink_metrics(path, text, size, pad=60):
    font = ImageFont.truetype(path, size)
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    box = probe.textbbox((0, 0), text, font=font)
    img = Image.new("L", (int(box[2] - box[0]) + pad * 2, int(box[3] - box[1]) + pad * 2), 255)
    ImageDraw.Draw(img).text((pad - box[0], pad - box[1]), text, font=font, fill=0)
    a = np.asarray(img)
    ys, xs = np.where(a < 128)
    return (int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1),
            int(xs.min()) - pad, int(ys.min()) - pad)


def draw_ink(img, path, size, text, ink_x, baseline, colour):
    font = ImageFont.truetype(path, size)
    probe = ImageDraw.Draw(Image.new("L", (4, 4)))
    box = probe.textbbox((0, 0), text, font=font)
    pad = 60
    layer = Image.new("L", (int(box[2] - box[0]) + pad * 2, int(box[3] - box[1]) + pad * 2), 255)
    ImageDraw.Draw(layer).text((pad - box[0], pad - box[1]), text, font=font, fill=0)
    a = np.asarray(layer)
    ys, xs = np.where(a < 128)
    ink_left, ink_top = int(xs.min()) - pad, int(ys.min()) - pad
    alpha = Image.fromarray(255 - a).crop((int(xs.min()), int(ys.min()),
                                           int(xs.max()) + 1, int(ys.max()) + 1))
    _, cap_h, _, cap_top = ink_metrics(path, "T", size)
    y = int(round(baseline - ((cap_top + cap_h) - ink_top)))
    x = int(round(ink_x - ink_left))
    mask = Image.new("L", img.size, 0)
    mask.paste(alpha, (x, y))
    img.paste(Image.new("RGB", img.size, colour), (0, 0), mask)
    return x, y, alpha.width, alpha.height


def ink_bbox(ink, x0, x1, y0, y1, thr=0.3):
    sub = ink[y0:y1, x0:x1]
    ys, xs = np.where(sub > thr)
    if len(ys) == 0:
        return None
    return (int(x0 + xs.min()), int(y0 + ys.min()), int(x0 + xs.max()), int(y0 + ys.max()))


def rebuild(image: Image.Image, font: str) -> Image.Image:
    """Rebuild rows 3 and 4 of one report, keeping the report's own values."""
    doc = image.convert("RGB")
    gray = np.asarray(doc.convert("L")).astype(np.float32) / 255.0
    ink = np.clip((0.93 - gray) / 0.6, 0, 1)

    def flat(x0, y0, x1, y1):
        patch = np.asarray(doc.crop((x0, y0, x1, y1))).reshape(-1, 3)
        return tuple(int(v) for v in np.median(patch, axis=0))

    def glyph(x0, y0, x1, y1):
        patch = np.asarray(doc.crop((x0, y0, x1, y1))).reshape(-1, 3).astype(int)
        lum = patch.sum(axis=1)
        return tuple(int(v) for v in np.median(patch[lum <= np.percentile(lum, 4)], axis=0))

    box_fill = flat(600, 300, 700, 318)
    background = flat(60, 470, 100, 560)
    label_ink = glyph(112, 278, 303, 303)
    value_ink = glyph(386, 281, 499, 298)

    # 1. lift the per-report values out before wiping the band
    lifted = {}
    for side, (x0, x1) in (("left", (280, 760)), ("right", (1045, 1520))):
        bbox = ink_bbox(ink, x0, x1, 596, 660)
        if bbox is None:
            raise SystemExit("could not locate the Sample / Batch value")
        crop = doc.crop((bbox[0] - 2, bbox[1] - 2, bbox[2] + 3, bbox[3] + 3))
        mask = Image.fromarray(((ink[bbox[1] - 2:bbox[3] + 3, bbox[0] - 2:bbox[2] + 3] > 0.12)
                                * 255).astype(np.uint8))
        lifted[side] = (crop, mask, bbox)

    out = doc.copy()
    draw = ImageDraw.Draw(out)
    draw.rectangle([BAND[0] - 40, BAND[1], BAND[2] + 40, BAND[3] - 1], fill=background)

    # 2. stamp the template box for both rows
    for top in (ROW3_TOP, ROW4_TOP):
        for x0, y0, x1, y1 in (BOX_LEFT, BOX_RIGHT):
            out.paste(doc.crop((x0 - 3, y0 - 2, x1 + 3, y1 + 2)), (x0 - 3, top - 2))
            draw.rectangle([x0 + 1, top + 2, x1 - 2, top + (y1 - y0) - 3], fill=box_fill)

    def marker(side, box, label_ink_x, label_y, label_w):
        info = MARKER[side]
        ax0, ay0, ax1, ay1 = info["patch"]
        ink_x = min(label_ink_x + label_w - 1 + MARKER_LABEL_GAP, box[0] - MARKER_BOX_GAP)
        ink_x = max(ink_x, label_ink_x + label_w - 1 + LETTER_GAP)
        out.paste(doc.crop((ax0, ay0, ax1, ay1)),
                  (ink_x - (info["ink"][0] - ax0), label_y + 8 - (info["ink"][1] - ay0)))
        return ink_x

    for side, box, row_top, label, value in (
        ("left", BOX_LEFT, ROW3_TOP, "Manufacturer", "Tideora"),
        ("right", BOX_RIGHT, ROW3_TOP, "Official Website", "www.tideoralab.com"),
        ("left", BOX_LEFT, ROW4_TOP, "Sample", None),
        ("right", BOX_RIGHT, ROW4_TOP, "Batch", None),
    ):
        x, y, w, h = draw_ink(out, font, LABEL_SIZE, label, LABEL_INK_X[side],
                              row_top + LABEL_BASELINE_OFFSET, label_ink)
        marker(side, box, x, y, w)

        target_x = box[0] + VALUE_PAD
        if value is not None:                      # row 3 is static
            draw_ink(out, font, VALUE_SIZE, value, target_x,
                     row_top + VALUE_BASELINE_OFFSET, value_ink)
        else:                                      # row 4 keeps the report's own value
            crop, mask, bbox = lifted[side]
            room = box[2] - 10 - target_x
            if crop.width > room:                  # long sample name: scale to fit
                scale = room / crop.width
                crop = crop.resize((room, max(1, round(crop.height * scale))), Image.LANCZOS)
                mask = mask.resize(crop.size, Image.LANCZOS)
            out.paste(crop, (target_x, bbox[1] - 2), mask)

    return out


def collect_urls():
    urls = set()
    for name in ("coaExtra.json", "catalog.json"):
        data = json.loads((DATA / name).read_text(encoding="utf-8"))
        for item in data:
            if not isinstance(item, dict):
                continue
            if str(item.get("reportUrl", "")).startswith("http"):
                urls.add(item["reportUrl"])
            for variant in item.get("variants") or []:
                if str(variant.get("reportUrl", "")).startswith("http"):
                    urls.add(variant["reportUrl"])
    return sorted(urls)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    font = resolve_font()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}

    urls = collect_urls()
    if not urls:
        print("no remote report URLs left - nothing to do")
        return
    if args.limit:
        urls = urls[: args.limit]
    print(f"mirroring {len(urls)} reports into {OUT_DIR.relative_to(ROOT)}")

    total = 0
    replacements = {}
    for i, url in enumerate(urls, 1):
        key = hashlib.sha1(url.encode()).hexdigest()[:16]
        target = OUT_DIR / f"{key}.jpg"
        if not target.exists():
            raw = urllib.request.urlopen(
                urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
            rebuilt = rebuild(Image.open(io.BytesIO(raw)), font)
            rebuilt.save(target, quality=QUALITY, subsampling=2, optimize=True)
        total += target.stat().st_size
        sources[f"reports/{key}.jpg"] = url
        replacements[url] = f"/reports/{key}.jpg"
        if i % 10 == 0 or i == len(urls):
            print(f"  {i}/{len(urls)}  {key}.jpg {target.stat().st_size // 1024} KB")

    SOURCES.write_text(json.dumps(sources, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    for name in ("coaExtra.json", "catalog.json"):
        path = DATA / name
        text = path.read_text(encoding="utf-8")
        changed = 0
        for url, local in replacements.items():
            if url in text:
                text = text.replace(url, local)
                changed += 1
        path.write_text(text, encoding="utf-8")
        print(f"rewrote {path.relative_to(ROOT)} ({changed} urls)")

    print(f"total {total / 1024 / 1024:.1f} MB in {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
