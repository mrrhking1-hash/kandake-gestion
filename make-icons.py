#!/usr/bin/env python3
"""Generate the Kandake PWA icon set (Didot 'K' monogram, black + gold)."""
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "icons"
OUT.mkdir(exist_ok=True)

SS = 4  # supersampling factor

BLACK = (10, 10, 10, 255)
GOLD = (253, 195, 64, 255)
GOLD_DIM = (122, 89, 0, 255)
IVORY = (252, 249, 248, 255)


def didot(size):
    """Didot.ttc -> regular face, the closest system face to Playfair Display."""
    for idx in range(6):
        try:
            return ImageFont.truetype("/System/Library/Fonts/Supplemental/Didot.ttc", size, index=idx)
        except Exception:
            continue
    return ImageFont.load_default()


def rounded_mask(size, radius_ratio):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
    )
    return m


def diamond(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def make_icon(px, maskable=False):
    S = px * SS
    img = Image.new("RGBA", (S, S), BLACK)
    d = ImageDraw.Draw(img)

    # On maskable icons the OS may crop up to 20%, so the glyph stays small and
    # no frame is drawn (it would land in the bleed zone).
    glyph_ratio = 0.50 if maskable else 0.60
    if not maskable:
        inset = int(S * 0.045)
        d.rounded_rectangle(
            [inset, inset, S - 1 - inset, S - 1 - inset],
            radius=int(S * 0.20),
            outline=GOLD_DIM,
            width=int(S * 0.012),
        )

    font = didot(int(S * glyph_ratio))
    box = d.textbbox((0, 0), "K", font=font)
    d.text(
        ((S - (box[2] - box[0])) / 2 - box[0], (S - (box[3] - box[1])) / 2 - box[1]),
        "K", font=font, fill=GOLD,
    )

    diamond(d, S / 2, S * (0.855 if maskable else 0.845), S * 0.032, IVORY)

    out = img.resize((px, px), Image.LANCZOS)
    if not maskable:
        out.putalpha(rounded_mask(px, 0.22))
    return out


jobs = [
    ("icon-512.png", 512, False),
    ("icon-192.png", 192, False),
    ("icon-maskable-512.png", 512, True),
    ("icon-maskable-192.png", 192, True),
    ("apple-touch-icon.png", 180, False),
    ("favicon-64.png", 64, False),
]

for name, px, maskable in jobs:
    out = make_icon(px, maskable)
    if name.startswith("apple-touch"):
        flat = Image.new("RGB", (px, px), BLACK)
        flat.paste(out, (0, 0), out)
        out = flat
    out.save(OUT / name, "PNG", optimize=True)
    print(f"  {name:24} {px}x{px}")

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Kandake">
<rect width="64" height="64" rx="14" fill="#0a0a0a"/>
<rect x="3" y="3" width="58" height="58" rx="12" fill="none" stroke="#7a5900" stroke-width="1"/>
<text x="32" y="43" font-family="Didot,Playfair Display,Georgia,serif" font-size="34"
      fill="#fdc340" text-anchor="middle">K</text>
<path d="M32 49.5 34.4 52 32 54.5 29.6 52Z" fill="#fcf9f8"/>
</svg>
'''
(OUT / "favicon.svg").write_text(svg, encoding="utf-8")
print("  favicon.svg")