"""Builds the example "lots" for the template gallery: each template gets the same cut-out cars
placed on its own backdrop, so the examples don't all look like the A & S lot.
Run from the repo root:  python3 tools/make_demo_photos.py   (needs Pillow + numpy)
Output: site/demo/<template>/<car>.webp
"""
import os, glob, math, random, zlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

W, H = 1080, 720
CUTS = sorted(glob.glob("site/cut/*.webp"))


def vgrad(top, bottom, h=H, w=W):
    t = np.linspace(0, 1, h)[:, None, None]
    a, b = np.array(top, float), np.array(bottom, float)
    return np.broadcast_to(a + (b - a) * t, (h, w, 3)).copy()


def radial(img, cx, cy, r, color, strength):
    y, x = np.mgrid[0:H, 0:W]
    d = np.clip(1 - np.hypot(x - cx, y - cy) / r, 0, 1) ** 2 * strength
    img += (np.array(color, float) - img) * d[..., None]
    return img


def noise(img, amt, seed):
    rng = np.random.default_rng(seed)
    return img + rng.normal(0, amt, img.shape)


def floor(img, y0, top, bottom):
    img[y0:] = vgrad(top, bottom, H - y0)
    return img


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))


# ---------- backdrops: (image, floor line y, mirror cars?) ----------
def classic(seed):  # light studio, soft grey floor
    a = vgrad((236, 240, 246), (214, 221, 232)); a = floor(a, 500, (205, 211, 222), (238, 241, 246)); a = radial(a, W / 2, 330, 520, (255, 255, 255), .7)
    return to_img(noise(a, 1.5, seed)), 560


def bold(seed):  # yellow wall, black floor, stripe
    a = vgrad((255, 214, 0), (240, 190, 0)); a = floor(a, 480, (32, 32, 32), (12, 12, 12)); a[470:480] = (17, 17, 17)
    im = to_img(noise(a, 2, seed)); d = ImageDraw.Draw(im)
    for x in range(-200, W, 90): d.polygon([(x, 480), (x + 40, 480), (x - 60, H), (x - 100, H)], fill=(24, 24, 24))
    return im, 600


def minimal(seed):  # white infinity cove
    a = vgrad((252, 252, 251), (238, 237, 235)); a = radial(a, W / 2, 600, 700, (229, 227, 224), .5)
    return to_img(noise(a, 1, seed)), 590


def sport(seed):  # dark garage, red neon
    a = vgrad((22, 22, 26), (10, 10, 12)); a = floor(a, 470, (38, 38, 42), (16, 16, 18)); a = radial(a, W / 2, 470, 600, (120, 14, 22), .55)
    im = to_img(noise(a, 2.5, seed)); d = ImageDraw.Draw(im)
    for y in (120, 135): d.rectangle([80, y, W - 80, y + 4], fill=(225, 29, 42))
    glow = im.filter(ImageFilter.GaussianBlur(14)); im = Image.blend(im, glow, .35); d = ImageDraw.Draw(im)
    for y in (120, 135): d.rectangle([80, y, W - 80, y + 3], fill=(255, 90, 100))
    return im, 610


def country(seed):  # sky, hills, gravel
    a = vgrad((120, 170, 220), (210, 228, 240), 460); g = vgrad((150, 140, 120), (110, 100, 85), H - 460)
    im = to_img(noise(np.concatenate([a, g]), 2, seed)); d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    pts = [(x, 430 - 40 * math.sin(x / 170 + rnd.random()) - 25 * math.sin(x / 60)) for x in range(0, W + 20, 20)]
    d.polygon(pts + [(W, 470), (0, 470)], fill=(78, 112, 70)); d.rectangle([0, 455, W, 470], fill=(96, 132, 80))
    for _ in range(900):
        x, y = rnd.randrange(W), rnd.randrange(472, H); c = rnd.randrange(90, 170); d.point((x, y), fill=(c, c - 8, c - 22))
    return im.filter(ImageFilter.GaussianBlur(.6)), 640


def luxury(seed):  # black room, gold spotlight
    a = vgrad((14, 13, 12), (6, 6, 6)); a = floor(a, 480, (26, 24, 21), (8, 8, 8)); a = radial(a, W / 2, 200, 560, (120, 96, 52), .45); a = radial(a, W / 2, 600, 500, (60, 50, 32), .5)
    return to_img(noise(a, 2, seed)), 610


def ocean(seed):  # sky, sea, sand
    sky = vgrad((70, 150, 210), (190, 225, 245), 380); sea = vgrad((30, 120, 160), (70, 165, 190), 70); sand = vgrad((226, 210, 178), (205, 186, 150), H - 450)
    a = noise(np.concatenate([sky, sea, sand]), 2, seed); im = to_img(a); d = ImageDraw.Draw(im)
    for i in range(6): d.line([(0, 395 + i * 9), (W, 395 + i * 9)], fill=(150, 205, 225), width=1)
    return im, 650


def urban(seed):  # concrete wall, orange line, asphalt
    a = vgrad((128, 132, 136), (98, 102, 106)); a = floor(a, 470, (58, 60, 63), (40, 42, 45)); a = noise(a, 6, seed)
    im = to_img(a); d = ImageDraw.Draw(im)
    for x in range(0, W, 180): d.line([(x, 0), (x, 470)], fill=(110, 114, 118), width=2)
    d.rectangle([0, 300, W, 318], fill=(255, 107, 26)); d.line([(0, 600), (W, 600)], fill=(235, 220, 160), width=4)
    return im.filter(ImageFilter.GaussianBlur(.7)), 600


def family(seed):  # lavender to park green
    a = vgrad((236, 228, 252), (224, 236, 255), 470); g = vgrad((150, 196, 120), (118, 168, 96), H - 470)
    im = to_img(noise(np.concatenate([a, g]), 1.5, seed)); d = ImageDraw.Draw(im); rnd = random.Random(seed)
    for _ in range(7):
        x = rnd.randrange(40, W - 40); r = rnd.randrange(40, 80); d.rectangle([x - 5, 470 - 70, x + 5, 470], fill=(120, 90, 70)); d.ellipse([x - r, 470 - 70 - r * 1.6, x + r, 470 - 70 + r * .3], fill=(110, 170, 100))
    return im.filter(ImageFilter.GaussianBlur(1.2)), 640


def budget(seed):  # white wall with red banner, light floor
    a = vgrad((250, 250, 250), (238, 238, 238)); a = floor(a, 480, (214, 214, 214), (240, 240, 240))
    im = to_img(noise(a, 1.5, seed)); d = ImageDraw.Draw(im)
    d.rectangle([0, 70, W, 150], fill=(220, 38, 38))
    for x in range(0, W, 60): d.polygon([(x, 150), (x + 30, 150), (x + 15, 175)], fill=(200, 30, 30))
    return im, 610


STYLES = dict(classic=classic, bold=bold, minimal=minimal, sport=sport, country=country, luxury=luxury, ocean=ocean, urban=urban, family=family, budget=budget)
MIRROR = {"bold", "country", "urban", "budget"}  # flip the cars on some lots so they don't look the same


def place(bg, cut, ground, mirror):
    car = Image.open(cut).convert("RGBA")
    if mirror: car = ImageOps.mirror(car)
    bb = car.getbbox(); car = car.crop(bb)
    s = min(W * .8 / car.width, H * .5 / car.height); car = car.resize((round(car.width * s), round(car.height * s)), Image.LANCZOS)
    x = (W - car.width) // 2; y = ground - car.height
    sh = Image.new("L", (W, H), 0); ImageDraw.Draw(sh).ellipse([x + car.width * .04, ground - 22, x + car.width * .96, ground + 16], fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(14)); out = bg.convert("RGB").copy()
    out.paste((0, 0, 0), (0, 0), sh.point(lambda v: int(v * .75)))
    out.paste(car, (x, y), car)
    return out


for name, fn in STYLES.items():
    os.makedirs(f"site/demo/{name}", exist_ok=True)
    for i, cut in enumerate(CUTS):
        bg, ground = fn(zlib.crc32(f"{name}{i}".encode()) & 0xFFFF)
        img = place(bg, cut, ground, name in MIRROR)
        cid = os.path.splitext(os.path.basename(cut))[0]
        img.save(f"site/demo/{name}/{cid}.webp", "WEBP", quality=78, method=6)
    print(name, "done")
