"""Cut the vial photos out of their studio backdrop for the landing poster.

The backdrop is a cool light grey-blue (B noticeably higher than R) while every
part of the vial is either neutral or warm, so instead of tracing an outline we
recover a straight alpha channel from the colour difference and then unmix the
backdrop out of the remaining pixels:

    observed = a * colour + (1 - a) * backdrop      =>   colour = (observed - (1-a)*backdrop) / a

That gives a clean, halo-free edge, keeps the glass transparent where the
backdrop shows through, and turns the cast shadow into a soft semi-transparent
shadow that composites onto any background. Pure Pillow: numpy is not installed.
"""

import sys
from pathlib import Path

from PIL import Image, ImageFilter

SRC = Path("frontend/public/images")
OUT = Path("frontend/public/images/lp")
OUT.mkdir(parents=True, exist_ok=True)

FILES = {
    "semaglutide": "tideora-2004-1.jpg",
    "tirzepatide": "tideora-2007-1.jpg",
    "retatrutide": "tideora-2008-1.jpg",
    "ipamorelin": "tideora-2002-1.jpg",
    "slu-pp-332": "tideora-slu-pp-332.jpg",
}

BACKDROP = (236, 245, 250)  # measured from the frame edges of every photo


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else (hi if v > hi else v)


def trim_floor_shadow(alpha: Image.Image) -> Image.Image:
    """Drop the wide soft shadow the vial casts on the studio floor.

    It spans the whole frame and would show up as a grey smear on the poster.
    The poster draws its own contact shadow and reflection in CSS instead, so
    everything below the last solid row of the vial is removed.
    """
    w, h = alpha.size
    px = alpha.load()
    base = 0
    for y in range(h - 1, -1, -1):
        solid = sum(1 for x in range(0, w, 4) if px[x, y] > 225)
        if solid > 8:
            base = y
            break
    for y in range(base + 1, h):
        for x in range(w):
            px[x, y] = 0

    # The shadow also creeps up the left and right edges, far outside the vial.
    # Anything faint and far from the vial's own column is backdrop, not glass.
    cx = w / 2
    solid_x = [x for x in range(0, w, 2) if px[x, base - 40] > 225]
    if solid_x:
        cx = (solid_x[0] + solid_x[-1]) / 2
    reach = w * 0.26
    for y in range(h):
        for x in range(w):
            if px[x, y] < 30 or (abs(x - cx) > reach and px[x, y] < 235):
                px[x, y] = 0

    # The shadow band that hugs the base runs wider than the vial itself and
    # would show up as a grey rectangle once the poster mirrors it. Keep only
    # what sits inside the vial's own outline on those bottom rows.
    for y in range(max(0, base - 120), h):
        solid = [x for x in range(w) if px[x, y] > 240]
        if not solid:
            continue
        lo, hi = solid[0] - 3, solid[-1] + 3
        for x in range(w):
            if x < lo or x > hi:
                px[x, y] = 0

    # Faint leftovers everywhere else are backdrop noise, not glass.
    for y in range(h):
        for x in range(w):
            if px[x, y] < 120:
                px[x, y] = 0
    return alpha


def drop_offcentre_blobs(alpha: Image.Image) -> Image.Image:
    """Keep only the opaque blobs that sit where the vial is.

    The photos have a warm, slightly darker vignette in the bottom-left corner;
    the alpha rule cannot tell it apart from the vial's own shadow. Labelling is
    done at half resolution (numpy is unavailable, so it is a plain BFS) and the
    surviving mask is scaled back up.
    """
    from collections import deque

    w, h = alpha.size
    small = alpha.resize((w // 2, h // 2), Image.BILINEAR)
    sw, sh = small.size
    px = small.load()
    seen = bytearray(sw * sh)
    keep = bytearray(sw * sh)

    # The vial always crosses the middle of the frame; the vignette never does.
    cx0, cx1 = int(sw * 0.28), int(sw * 0.72)
    cy0, cy1 = int(sh * 0.10), int(sh * 0.92)
    floor = sw * sh * 0.002

    for y0 in range(sh):
        for x0 in range(sw):
            i0 = y0 * sw + x0
            if seen[i0] or px[x0, y0] < 40:
                continue
            seen[i0] = 1
            q = deque([(x0, y0)])
            blob = []
            centred = False
            while q:
                x, y = q.popleft()
                blob.append(y * sw + x)
                if cx0 <= x <= cx1 and cy0 <= y <= cy1:
                    centred = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh:
                        j = ny * sw + nx
                        if not seen[j] and px[nx, ny] >= 40:
                            seen[j] = 1
                            q.append((nx, ny))
            if centred and len(blob) >= floor:
                for j in blob:
                    keep[j] = 255

    mask = Image.new("L", (sw, sh), 0)
    mask.putdata(list(keep))
    mask = mask.resize((w, h), Image.NEAREST).filter(ImageFilter.GaussianBlur(1.2))
    out = alpha.copy()
    out.paste(Image.composite(alpha, Image.new("L", (w, h), 0), mask))
    return out


def cut(src: Path, dst: Path) -> None:
    rgb = Image.open(src).convert("RGB")
    w, h = rgb.size
    sp = rgb.load()

    out = Image.new("RGBA", (w, h))
    op = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b = sp[x, y]
            luma = 0.299 * r + 0.587 * g + 0.114 * b
            # Cool => backdrop. Anything clearly darker than the backdrop is
            # object (dark ink, cap shadow, glass edge) even if it is cool.
            a_cool = clamp((8.0 - (b - r)) / 6.0)
            a_dark = clamp((215.0 - luma) / 40.0)
            a = a_cool if a_cool > a_dark else a_dark
            if a <= 0.004:
                op[x, y] = (0, 0, 0, 0)
                continue
            safe = a if a > 0.06 else 0.06
            ch = []
            for i, v in enumerate((r, g, b)):
                v2 = (v - (1 - safe) * BACKDROP[i]) / safe
                ch.append(int(clamp(v2, 0, 255)))
            op[x, y] = (ch[0], ch[1], ch[2], int(a * 255 + 0.5))

    alpha = out.getchannel("A")
    alpha = drop_offcentre_blobs(alpha)
    alpha = trim_floor_shadow(alpha)
    out.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 10 else 0).getbbox()
    if bbox:
        pad = 10
        out = out.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(w, bbox[2] + pad),
                min(h, bbox[3] + pad),
            )
        )
    # The poster renders these at <=118 CSS px, so 460 px covers a 3x screen.
    # No PNG master is written: at 770x1366 RGBA it is ~740 kB per vial and
    # would ship in the build. Re-run this script to regenerate.
    # A 770x1366 RGBA PNG is ~740 kB; the same vial as WebP is ~40 kB.
    TARGET_W = 460
    web = dst.with_suffix(".webp")
    scale = TARGET_W / out.size[0]
    small = out.resize(
        (TARGET_W, max(1, round(out.size[1] * scale))), Image.LANCZOS
    )
    small.save(web, format="WEBP", quality=82, method=6, alpha_quality=70)
    print(
        f"{src.name:28s} -> {web.name:18s} {small.size[0]}x{small.size[1]}"
        f"  {web.stat().st_size // 1024} kB"
    )


if __name__ == "__main__":
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for name, f in FILES.items():
        if only and only != name:
            continue
        cut(SRC / f, OUT / f"{name}.png")
