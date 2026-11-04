"""Builds the background library for the AI photo studio: site/bg/<id>.webp (1600x1067) + thumbnails.
Run from the repo root:  python3 tools/make_backgrounds.py   (needs Pillow + numpy)
The floor line of each background (where the tyres stand) is listed in site/admin/backgrounds.js.
"""
import os, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1600, 1067
OUT = "site/bg"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def grad(top, bot, h, w=W):
    t = np.linspace(0, 1, h)[:, None, None]
    return (np.array(top, float) + (np.array(bot, float) - np.array(top, float)) * t) * np.ones((h, w, 1))


def glow(a, cx, cy, rx, ry, color, s):
    y, x = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    d = np.clip(1 - np.hypot((x - cx) / rx, (y - cy) / ry), 0, 1) ** 2 * s
    a += (np.array(color, float) - a) * d[..., None]
    return a


def grain(a, amt=2.0):
    return a + rng.normal(0, amt, a.shape)


def img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


def perspective_tiles(im, y0, color, every=110, lines=14, vx=W / 2, alpha=60, width=2):
    """floor grid that converges to a vanishing point, like showroom tiles"""
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for i in range(-lines * 3, lines * 3 + 1):
        x_bottom = vx + i * every * 2.2
        d.line([(vx + i * every * .35, y0), (x_bottom, H)], fill=color + (alpha,), width=width)
    y, step = y0 + 6, 8
    while y < H:
        d.line([(0, y), (W, y)], fill=color + (alpha,), width=width); step *= 1.32; y += step
    return Image.alpha_composite(im.convert("RGBA"), ov.filter(ImageFilter.GaussianBlur(1))).convert("RGB")


def windows(im, y_top, y_bot, n, frame, glass, glow_col=None):
    d = ImageDraw.Draw(im); gap = W / n
    for i in range(n):
        x0 = i * gap + 14; x1 = (i + 1) * gap - 14
        d.rectangle([x0, y_top, x1, y_bot], fill=glass)
        d.rectangle([x0, y_top, x1, y_bot], outline=frame, width=10)
    if glow_col: im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(30)), .25)
    return im


def lux_showroom():
    a = grad((24, 22, 20), (10, 9, 8), 690); f = grad((30, 27, 24), (8, 7, 6), H - 690); a = np.concatenate([a, f])
    for x in (300, 800, 1300): a = glow(a, x, 0, 260, 520, (110, 92, 60), .55)
    a = glow(a, W / 2, 760, 900, 220, (70, 60, 44), .55)
    im = img(grain(a, 1.6)); d = ImageDraw.Draw(im)
    for x in (300, 800, 1300): d.ellipse([x - 70, -18, x + 70, 18], fill=(255, 236, 200))
    d.rectangle([0, 684, W, 690], fill=(60, 52, 40))
    im = perspective_tiles(im, 690, (120, 100, 70), alpha=38)
    return im


def classic_dealer():
    a = grad((236, 238, 240), (214, 218, 222), 640)
    im = img(grain(a, 1.2)); im = windows(im, 90, 520, 5, (58, 64, 72), (176, 205, 228))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, W, 60], fill=(200, 30, 36)); d.rectangle([0, 600, W, 640], fill=(196, 200, 206))
    f = img(grain(grad((222, 224, 226), (180, 184, 188), H - 640), 1.5)); im.paste(f, (0, 640))
    im = perspective_tiles(im, 640, (150, 154, 160), every=150, alpha=70)
    return im.filter(ImageFilter.GaussianBlur(1.6))


def white_studio():
    a = grad((255, 255, 255), (240, 240, 239), H); a = glow(a, W / 2, 800, 1000, 260, (228, 226, 224), .6)
    return img(grain(a, .8))


def grey_studio():
    a = grad((150, 156, 162), (70, 74, 78), H); a = glow(a, W / 2, 420, 900, 520, (196, 200, 205), .7); a = glow(a, W / 2, 900, 900, 200, (60, 62, 66), .5)
    return img(grain(a, 1.4))


def sunny_lot():
    sky = grad((84, 146, 214), (196, 224, 244), 520); sky = glow(sky, 1300, 80, 500, 300, (255, 250, 230), .5)
    ground = grad((118, 120, 122), (78, 80, 82), H - 520)
    a = np.concatenate([sky, ground]); im = img(grain(a, 3)); d = ImageDraw.Draw(im)
    for i in range(6):  # distant trees
        x = 60 + i * 290; d.ellipse([x, 400, x + 260, 560], fill=(70, 110, 66))
    d.rectangle([0, 500, W, 528], fill=(150, 150, 146))  # kerb
    for i in range(-6, 8):  # parking lines in perspective
        d.line([(W / 2 + i * 120, 540), (W / 2 + i * 420, H)], fill=(236, 234, 220), width=6)
    return im.filter(ImageFilter.GaussianBlur(1.2))


def sunset():
    sky = grad((52, 46, 96), (250, 152, 92), 560); sky = glow(sky, 1100, 560, 600, 260, (255, 210, 140), .8)
    ground = grad((70, 56, 54), (36, 30, 30), H - 560); im = img(grain(np.concatenate([sky, ground]), 2.5)); d = ImageDraw.Draw(im)
    pts = [(x, 560 - 60 * math.sin(x / 260) - 30 * math.sin(x / 90) - 20) for x in range(0, W + 20, 20)]
    d.polygon(pts + [(W, 580), (0, 580)], fill=(46, 36, 52))
    return im.filter(ImageFilter.GaussianBlur(1))


def mountains():
    sky = grad((120, 172, 222), (222, 236, 246), 560); im = img(grain(sky, 1.5)); d = ImageDraw.Draw(im); r = random.Random(3)
    for layer, (col, base, amp) in enumerate([((150, 168, 190), 420, 170), ((104, 126, 150), 470, 130), ((70, 96, 84), 520, 70)]):
        pts = [(0, 560)]; x = 0
        while x <= W: pts.append((x, base - amp * abs(math.sin(x / (230 - layer * 40) + layer)) - r.random() * 25)); x += 30
        pts.append((W, 560)); d.polygon(pts, fill=col)
    road = img(grain(grad((92, 94, 96), (58, 60, 62), H - 560), 3)); im.paste(road, (0, 560)); d = ImageDraw.Draw(im)
    d.polygon([(0, 560), (W, 560), (W, 600), (0, 600)], fill=(150, 138, 108))
    return im.filter(ImageFilter.GaussianBlur(1.1))


def city_night():
    a = grad((10, 14, 30), (24, 24, 40), 560); im = img(grain(a, 2)); d = ImageDraw.Draw(im); r = random.Random(5)
    x = 0
    while x < W:  # skyline with lit windows
        w = r.randint(90, 180); h = r.randint(180, 420); d.rectangle([x, 560 - h, x + w, 560], fill=(18, 20, 32))
        for wy in range(560 - h + 14, 548, 22):
            for wx in range(x + 10, x + w - 10, 18):
                if r.random() < .35: d.rectangle([wx, wy, wx + 8, wy + 10], fill=(255, 214, 140))
        x += w + r.randint(4, 20)
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(10)), .35)
    st = np.array(img(grad((40, 40, 48), (14, 14, 18), H - 560)), float); st = glow(st, W / 2, 0, 900, 260, (90, 70, 60), .5)
    im.paste(img(grain(st, 2.5)), (0, 560)); d = ImageDraw.Draw(im)
    for i in range(0, W, 140): d.rectangle([i, 860, i + 70, 868], fill=(220, 200, 120))
    return im


def garage():
    a = grad((120, 122, 124), (96, 98, 100), 640); a = grain(a, 7); im = img(a); d = ImageDraw.Draw(im)
    for x in range(0, W, 200): d.line([(x, 0), (x, 640)], fill=(108, 110, 112), width=3)
    for y in (90, 104): d.rectangle([60, y, W - 60, y + 6], fill=(230, 244, 255))
    im = Image.blend(im, im.filter(ImageFilter.GaussianBlur(18)), .3)
    f = np.array(img(grad((86, 88, 90), (52, 54, 56), H - 640)), float); f = glow(f, W / 2, 140, 900, 260, (130, 134, 140), .5)
    im.paste(img(grain(f, 4)), (0, 640)); d = ImageDraw.Draw(im); d.rectangle([0, 636, W, 644], fill=(60, 62, 64))
    return im


def brand_night():
    a = grad((16, 12, 12), (8, 6, 6), H); a = glow(a, W / 2, 470, 900, 420, (150, 18, 26), .55); a = glow(a, W / 2, 860, 800, 160, (40, 28, 28), .6)
    im = img(grain(a, 2)); d = ImageDraw.Draw(im); d.rectangle([0, 700, W, 704], fill=(70, 20, 24))
    return perspective_tiles(im, 704, (110, 30, 36), alpha=45)


# the scenic backgrounds are real photos now (see site/admin/backgrounds.js); only the plain studios are drawn
BGS = [("white-studio", white_studio), ("grey-studio", grey_studio), ("brand-night", brand_night)]
# soft focus behind the car, like a camera with the car in focus
BLUR = {"classic-dealer": 5, "sunny-lot": 4, "sunset": 3, "mountain-road": 4, "city-night": 3, "garage": 2, "lux-showroom": 1.5}
for name, fn in BGS:
    im = fn()
    if name in BLUR: im = im.filter(ImageFilter.GaussianBlur(BLUR[name]))
    im.save(f"{OUT}/{name}.webp", "WEBP", quality=84, method=6)
    im.resize((320, 213), Image.LANCZOS).save(f"{OUT}/{name}-thumb.webp", "WEBP", quality=78)
    print(name)
