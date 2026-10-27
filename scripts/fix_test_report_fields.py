"""Rebuild the lower field rows of the Tideora COA sample test report so that
every row follows the same grid as the rows above it.

The shipped JPEG had been retouched by hand.  The Manufacturer / Official Website
row and the Sample / Batch row are both drawn off the column grid: their boxes are
shifted, of a different height and grey, their ">" markers are swallowed by the
box or sit on top of the label, and their values are set in another typeface at
another size.

Both rows are rebuilt from the "Task Number" / "Received Date" template row:

  * the box and its drop shadow are copied straight out of the template row, so
    geometry, grey and shadow are identical,
  * label, ">" marker and value are drawn on the template grid
    (label baseline = box top + 38, value baseline = box top + 53,
     value ink starts at box left + 16),
  * the ">" marker is the template row's own glyph, pasted, so it is
    pixel-identical instead of re-typeset,
  * labels and values use the faces and sizes calibrated against the template
    row's own ink extents.

Rows are addressed by their distance from the template row (two grid rows down,
three grid rows down).

Run:  python scripts/fix_test_report_fields.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "frontend" / "public" / "images" / "tideora-test-report-sample.jpg"

# The report's own faces are not recoverable from the JPEG; these are the closest
# available ones.  Calibration against the template row:
#   labels  Segoe UI 32.5 px          -> "Task Number" 191 px wide (measured 192)
#   values  Lucida Sans Unicode 29.5  -> "#42414592" 167 px wide (measured 173),
#                                        digit ink height 22 px (measured 22)
LABEL_FONTS = [
    r"C:\Windows\Fonts\segoeui.ttf",
    r"C:\Windows\Fonts\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
VALUE_FONTS = [
    r"C:\Windows\Fonts\l_10646.ttf",
    r"C:\Windows\Fonts\verdana.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
LABEL_SIZE = 32.5
VALUE_SIZE = 29.5

# Row-1 ("Task Number" / "Received Date") measurements, in source pixels.
TEMPLATE = {
    "left": {
        "box": (352, 265, 718, 351),     # x0, y0, x1, y1 (exclusive)
        "shadow_y": 258,
        "label_ink_x": 112,
        "label_baseline": 303,
        "value_ink_x": 368,
        "value_baseline": 319,
        "arrow_patch": (316, 276, 346, 306),
        "arrow_ink": (323, 285, 338, 301),
    },
    "right": {
        "box": (1144, 267, 1511, 353),
        "shadow_y": 260,
        "label_ink_x": 863,
        "label_baseline": 305,
        "value_ink_x": 1156,
        "value_baseline": 321,
        "arrow_patch": (1076, 278, 1106, 308),
        "arrow_ink": (1083, 287, 1098, 303),
    },
}

GRID_STEP = 112          # vertical distance between two field rows
LABEL_TO_MARKER = 19     # row 1: label ink ends 303, marker ink starts 323
MARKER_TO_BOX = 29       # row 1: marker ink starts 352 - 29 = 323
ERASE_TOP = 468          # row 2 ends at y=465
ERASE_BOTTOM = 700       # the "Sample description" label starts at y=722

# (rows below the template, left field, right field) - this is what the lower
# rows must read once they are on the grid.
ROWS = [
    (2, ("Manufacturer", "Official Website"), ("Tideora", "www.tideoralab.com")),
    (3, ("Sample", "Batch"), ("SLU-PP-332 5mg", "14592")),
]


def resolve_font(candidates) -> str:
    for path in candidates:
        if Path(path).exists():
            return path
    raise SystemExit("no usable TrueType font found")


def ink_metrics(path, text, size, pad=60):
    """(width, height, left_bearing, ink_top) of `text` relative to the origin."""
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
    """Draw `text` with its ink left edge at ink_x and its baseline at `baseline`."""
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
    # the rest of the document is JPEG-softened, so soften the new type to match
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.4))
    _, cap_h, _, cap_top = ink_metrics(path, "T", size)
    y = int(round(baseline - ((cap_top + cap_h) - ink_top)))
    x = int(round(ink_x - ink_left))
    mask = Image.new("L", img.size, 0)
    mask.paste(alpha, (x, y))
    img.paste(Image.new("RGB", img.size, colour), (0, 0), mask)
    return x, y, alpha.width, alpha.height


def main():
    label_font = resolve_font(LABEL_FONTS)
    value_font = resolve_font(VALUE_FONTS)
    src = Image.open(TARGET).convert("RGB")

    def ink_colour(x0, y0, x1, y1):
        """Median of the darkest pixels in a region: the glyph colour, not the paper."""
        patch = np.asarray(src.crop((x0, y0, x1, y1))).reshape(-1, 3).astype(int)
        lum = patch.sum(axis=1)
        return tuple(int(v) for v in np.median(patch[lum <= np.percentile(lum, 4)], axis=0))

    def flat_colour(x0, y0, x1, y1):
        patch = np.asarray(src.crop((x0, y0, x1, y1))).reshape(-1, 3)
        return tuple(int(v) for v in np.median(patch, axis=0))

    box_fill = flat_colour(600, 330, 700, 346)
    background = flat_colour(60, 470, 100, 560)
    label_ink = ink_colour(112, 277, 303, 303)
    value_ink = ink_colour(368, 297, 540, 318)

    print(f"label font   : {label_font} @ {LABEL_SIZE:g}")
    print(f"value font   : {value_font} @ {VALUE_SIZE:g}")
    print(f"colours      : box {box_fill}  background {background}  "
          f"label {label_ink}  value {value_ink}")
    for name, font, size, text, ref in (
        ("label", label_font, LABEL_SIZE, "Task Number", (192, 27)),
        ("value", value_font, VALUE_SIZE, "#42414592", (173, 22)),
    ):
        w, h, _, _ = ink_metrics(font, text, size)
        print(f"calibration  : {name} {text!r} -> {w}x{h} px (template {ref[0]}x{ref[1]})")

    out = src.copy()
    draw = ImageDraw.Draw(out)

    # 1. wipe every row that is off the grid
    draw.rectangle([0, ERASE_TOP, src.width, ERASE_BOTTOM], fill=background)

    # 2. re-stamp box + shadow strip from the template row, once per row
    for rows_down, _, _ in ROWS:
        offset = rows_down * GRID_STEP
        for tpl in TEMPLATE.values():
            x0, y0, x1, y1 = tpl["box"]
            patch = src.crop((x0 - 6, tpl["shadow_y"] - 2, x1 + 6, y1 + 2))
            out.paste(patch, (x0 - 6, tpl["shadow_y"] - 2 + offset))
            draw.rectangle([x0 + 1, y0 + offset + 2, x1 - 2, y1 + offset - 2], fill=box_fill)

    # 3. labels, ">" markers and values on the template grid
    for rows_down, labels, values in ROWS:
        offset = rows_down * GRID_STEP
        for col, tpl in TEMPLATE.items():
            box_left = tpl["box"][0]
            label = labels[0] if col == "left" else labels[1]
            value = values[0] if col == "left" else values[1]

            x, y, w, h = draw_ink(out, label_font, LABEL_SIZE, label, tpl["label_ink_x"],
                                  tpl["label_baseline"] + offset, label_ink)
            label_right = tpl["label_ink_x"] + w - 1

            ax0, ay0, ax1, ay1 = tpl["arrow_patch"]
            marker_ink_x = min(label_right + LABEL_TO_MARKER, box_left - MARKER_TO_BOX)
            marker_ink_x = max(marker_ink_x, label_right + 5)
            out.paste(src.crop((ax0, ay0, ax1, ay1)),
                      (marker_ink_x - (tpl["arrow_ink"][0] - ax0),
                       y + 8 - (tpl["arrow_ink"][1] - ay0)))
            print(f"row {rows_down} {col:5s} {label!r}: ink {tpl['label_ink_x']}..{label_right}, "
                  f"y {y}..{y + h}; box x {box_left}; marker {marker_ink_x}..{marker_ink_x + 14}")

            x, y, w, h = draw_ink(out, value_font, VALUE_SIZE, value, tpl["value_ink_x"],
                                  tpl["value_baseline"] + offset, value_ink)
            print(f"row {rows_down} {col:5s} {value!r}: ink {tpl['value_ink_x']}"
                  f"..{tpl['value_ink_x'] + w - 1}, y {y}..{y + h}")

    # 4. drop the leftover sliver at the right edge, soften the patch seams
    draw.rectangle([1514, ERASE_TOP, src.width, ERASE_BOTTOM], fill=background)
    band = out.crop((0, ERASE_TOP - 2, out.width, ERASE_BOTTOM + 2))
    out.paste(band.filter(ImageFilter.GaussianBlur(0.4)), (0, ERASE_TOP - 2))

    out.save(TARGET, quality=95, subsampling=0, optimize=True)
    print("wrote", TARGET, out.size)


if __name__ == "__main__":
    main()
