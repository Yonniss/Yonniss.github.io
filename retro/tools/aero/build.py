"""Genera los recursos raster del tema Frutiger Aero (img/aero/):
fondo, burbuja, textura de cristal, orbe de inicio y reloj.

Uso, desde la raíz del repo:  python3 tools/aero/build.py
Necesita Pillow y numpy. La primera vez descarga las fotos originales en
tools/aero/src/ (ignorada por git).

Fotos (Wikimedia Commons):
  sky.jpg   "Blue sky with white clouds over Egyptian landscape 2026", Serfezi, CC BY 4.0
  grass.jpg "The Lawn After A Shower (9161661782)", James Mann, CC BY 2.0
Los iconos de img/aero/icons/ son de Oxygen (KDE, LGPL-3.0) y no salen de aquí.
"""
import math
import urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = Path(__file__).resolve().parent
SRC, OUT = HERE / 'src', HERE.parent.parent / 'img' / 'aero'
PHOTOS = {
    'sky.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Blue_sky_with_white_clouds_over_Egyptian_landscape_2026.jpg/3840px-Blue_sky_with_white_clouds_over_Egyptian_landscape_2026.jpg',
    'grass.jpg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/The_Lawn_After_A_Shower_%289161661782%29.jpg/3840px-The_Lawn_After_A_Shower_%289161661782%29.jpg',
}
SRC.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
for name, url in PHOTOS.items():
    if not (SRC / name).exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'yannis-os-aero-build/1.0'})
        with urllib.request.urlopen(req, timeout=120) as r:
            (SRC / name).write_bytes(r.read())
rng = np.random.default_rng(7)

W, H = 1920, 1200


def arr(im):
    return np.asarray(im.convert('RGB'), dtype=np.float32) / 255


def img(a, mode='RGB'):
    return Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8), mode)


def blur(a, r):
    """Desenfoque gaussiano de un array HxW o HxWxC (0..1)."""
    if a.ndim == 2:
        return np.asarray(img(a, 'L').filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    chans = [blur(a[..., i], r) for i in range(a.shape[2])]
    return np.stack(chans, -1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def screen(base, layer, alpha):
    a = alpha[..., None] if np.ndim(alpha) == 2 else alpha
    return 1 - (1 - base) * (1 - layer * a)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# ─── Cielo ───
sky = Image.open(SRC / 'sky.jpg')
sky = sky.crop((0, 0, 3840, 2400)).resize((W, H), Image.LANCZOS)
sky = ImageEnhance.Color(sky).enhance(1.25)
sky = ImageEnhance.Brightness(sky).enhance(1.08)
S = arr(sky)
# Desplaza el azul profundo hacia el cian brillante de Aero, más claro abajo
lift = smoothstep(0, H * .75, yy)[..., None]
S = S * np.array([.82, 1.0, 1.04]) + np.array([0, .05, .08]) * (1 - lift) + np.array([.08, .16, .14]) * lift
S = np.clip(S, 0, 1)

# Sol arriba a la derecha
sx, sy = W * .78, H * .1
d = np.hypot(xx - sx, yy - sy)
glow = np.exp(-(d / 380) ** 2) * .55 + np.exp(-(d / 70) ** 2) * .95
S = screen(S, np.ones(3), glow)

# Rayos de sol
ang = np.arctan2(yy - sy, xx - sx)
rays = np.zeros_like(ang)
for k, ph, w in [(7, .3, .5), (13, 1.7, .35), (23, 2.9, .25), (41, .8, .15)]:
    rays += w * (.5 + .5 * np.cos(ang * k + ph))
rays = (rays / 1.25) ** 3 * np.exp(-d / 900) * smoothstep(40, 260, d)
S = screen(S, np.array([1, 1, .96]), blur(rays, 3) * .55)

# Cintas de luz tipo aurora (verde/cian), muy difuminadas
ribbon = np.zeros((H, W, 3), np.float32)
for y0, amp, f, ph, col, th in [
    (520, 90, 1.4, .2, (.45, 1, .75), 60),
    (600, 70, 1.9, 2.1, (.35, .95, 1), 38),
    (470, 110, 1.1, 4.0, (.8, 1, .55), 26),
]:
    yc = y0 + amp * np.sin(xx / W * math.pi * f + ph) - 120 * (xx / W)
    prof = np.exp(-((yy - yc) / th) ** 2)
    ribbon += prof[..., None] * np.array(col)
ribbon = blur(ribbon, 10)
fade = smoothstep(0, W * .35, xx) * (1 - smoothstep(W * .75, W, xx) * .5)
S = screen(S, np.clip(ribbon, 0, 1), fade * .55)

# ─── Colina de césped ───
grass = Image.open(SRC / 'grass.jpg')
gw, gh = grass.size
grass = grass.crop((0, int(gh * .22), gw, gh)).resize((W, int(W * (gh * .78) / gw)), Image.LANCZOS)
grass = ImageEnhance.Color(grass).enhance(2.4)
grass = ImageEnhance.Contrast(grass).enhance(1.15)
G = arr(grass)
# Lleva el verde grisáceo al lima saturado de Aero
lum = G.mean(-1, keepdims=True)
G = np.clip(lum * np.array([.95, 1.75, .55]) + np.array([.02, .1, 0]), 0, 1)
G = G ** np.array([1.05, .82, 1.2])
gH = G.shape[0]
canvasG = np.zeros((H, W, 3), np.float32)
top = 560
canvasG[top:top + min(gH, H - top)] = G[:H - top]
# Profundidad de campo: lejos (arriba) más difuminado
far = blur(canvasG, 5)
hill = (840 + 55 * np.sin(xx / W * math.pi * 1.6 + .6) + 35 * np.sin(xx / W * math.pi * 3.3 + 2) - 70 * (xx / W))
mask = smoothstep(hill - 2, hill + 3, yy)
dof = 1 - smoothstep(hill, hill + 240, yy)
canvasG = canvasG * (1 - dof[..., None]) + far * dof[..., None]
# Más oscuro y profundo abajo
canvasG = canvasG * (1 - .28 * smoothstep(hill + 150, H, yy))[..., None]
# Bruma en el horizonte y brillo de borde
haze = np.exp(-((yy - hill) / 60) ** 2) * (yy > hill)
canvasG = screen(canvasG, np.array([.85, 1, .8]), haze * .55)
S = S * (1 - mask[..., None]) + canvasG * mask[..., None]
rim = np.exp(-((yy - hill) / 4) ** 2)
S = screen(S, np.array([.95, 1, .85]), blur(rim, 2) * .8)
S = screen(S, np.array([.7, 1, .7]), blur(np.exp(-((yy - hill + 10) / 30) ** 2), 6) * .25)

# Rayos de luz sobre la hierba en primer plano
S = screen(S, np.array([1, 1, .8]), np.exp(-(np.hypot(xx - sx, (yy - H) * .5) / 700) ** 2) * mask * .25)

# ─── Bokeh ───
bok = np.zeros((H, W), np.float32)
for _ in range(38):
    cx, cy = rng.uniform(0, W), rng.uniform(80, H * .85)
    r = rng.uniform(5, 28)
    ring = smoothstep(r, r - 2.5, np.hypot(xx - cx, yy - cy))
    bok += ring * rng.uniform(.05, .22)
S = screen(S, np.array([.9, 1, 1]), blur(np.clip(bok, 0, 1), 1.5))


# ─── Burbuja (también se exporta sola) ───
def bubble(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    nx, ny = (x - c) / c, (y - c) / c
    r = np.hypot(nx, ny)
    inside = smoothstep(1.0, .985, r)
    # Película fina: color iridiscente en función del grosor (varía con la altura y un poco de ruido)
    t = .55 * ny + .35 * nx * ny + .9 * r ** 2 + .15 * np.sin(6 * nx + 3 * ny)
    film = .5 + .5 * np.cos(2 * math.pi * (t[..., None] * 1.6 + np.array([0, .33, .67])))
    film = .55 + .45 * film
    edge = smoothstep(.55, 1.0, r) ** 2.2
    col = film * .75 + .25
    # Reflejo del cielo arriba y de la hierba abajo
    col = col * (1 - .25 * smoothstep(.2, .9, ny)[..., None]) + np.array([0, .12, 0]) * smoothstep(.3, 1, ny)[..., None]
    alpha = (.06 + .8 * edge) * inside
    # Brillo especular principal (ventana arriba-izquierda) y secundario
    hx, hy = nx + .38, ny + .45
    hl = smoothstep(.32, .12, np.hypot(hx * 1.0, hy * 1.7)) * .95
    hl2 = smoothstep(.12, .03, np.hypot(nx - .45, ny - .52)) * .7
    rimlight = smoothstep(.9, .99, r) * smoothstep(.0, .6, -ny + .3) * .6
    white = np.clip(hl + hl2 + rimlight, 0, 1)
    col = col * (1 - white[..., None]) + white[..., None]
    alpha = np.clip(alpha + white * inside, 0, 1)
    rgba = np.dstack([col, alpha])
    return Image.fromarray((np.clip(rgba, 0, 1) * 255 + .5).astype(np.uint8), 'RGBA')


bub = bubble(512)
bub.resize((256, 256), Image.LANCZOS).save(OUT / 'bubble.png', optimize=True)

base = img(S).convert('RGBA')
for cx, cy, size, rad in [(330, 300, 150, 7), (1500, 640, 90, 5), (900, 180, 60, 3), (1700, 300, 200, 10)]:
    pad = rad * 3
    b = Image.new('RGBA', (size + 2 * pad, size + 2 * pad))
    b.alpha_composite(bub.resize((size, size), Image.LANCZOS), (pad, pad))
    b = b.filter(ImageFilter.GaussianBlur(rad))
    base.alpha_composite(b, (int(cx - size / 2 - pad), int(cy - size / 2 - pad)))

# Destello de lente sobre la diagonal sol → centro
F = arr(base)
for t, r, a, col in [(.35, 26, .18, (.6, 1, .8)), (.55, 60, .1, (.5, .8, 1)), (.75, 14, .25, (1, .9, .6)), (1.15, 90, .07, (.6, .9, 1))]:
    fx, fy = sx + (W / 2 - sx) * t * 2, sy + (H / 2 - sy) * t * 2
    disc = smoothstep(r, r * .8, np.hypot(xx - fx, yy - fy))
    F = screen(F, np.array(col), blur(disc, 2) * a)

# Viñeta suave y grano
vig = 1 - .22 * smoothstep(.55, 1.25, np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)))
F = F * vig[..., None]
F = F + rng.normal(0, .012, F.shape).astype(np.float32)
img(F).save(OUT / 'wallpaper.jpg', quality=84, optimize=True, progressive=True)

# ─── Textura de cristal con vetas (en mosaico 512×512) ───
N = 512
y, x = np.mgrid[0:N, 0:N].astype(np.float32)
u = (x + y) / N * 2 * math.pi  # diagonal, periódica en N
v = (x - y) / N * 2 * math.pi
streak = np.zeros((N, N), np.float32)
for k, ph, w in [(1, .4, 1), (2, 1.9, .6), (3, 3.1, .5), (5, .7, .35), (8, 2.2, .25), (13, 4.4, .15)]:
    streak += w * np.cos(k * u + ph + .25 * np.sin(v + k))
streak = smoothstep(.4, 2.4, streak)
glass = np.dstack([np.ones((N, N, 3), np.float32), streak * .28])
Image.fromarray((glass * 255 + .5).astype(np.uint8), 'RGBA').save(OUT / 'glass.png', optimize=True)


# ─── Orbe de inicio (96 px, se muestra a 48) ───
def orb(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    nx, ny = (x - c) / c, (y - c) / c
    r = np.hypot(nx, ny)
    inside = smoothstep(1, .97, r)
    core = np.hypot(nx, ny - .55)
    deep = np.array([.03, .14, .38])
    glow = np.array([.35, .85, 1.0])
    k = smoothstep(1.15, .1, core)[..., None]
    col = deep * (1 - k) + glow * k
    col = col * (1 - .35 * smoothstep(.7, 1, r)[..., None])
    ring = smoothstep(.86, .9, r) * smoothstep(1, .95, r)
    col = col * (1 - ring[..., None]) + np.array([.05, .08, .12]) * ring[..., None]
    hl = smoothstep(.62, .5, np.hypot(nx / .78, (ny + .42) / .5)) * smoothstep(.15, -.5, ny)
    col = col * (1 - hl[..., None] * .8) + hl[..., None] * .8
    rimhi = smoothstep(.8, .86, r) * smoothstep(.86, .82, r) * smoothstep(-.2, .9, ny) * .6
    col = np.clip(col + rimhi[..., None] * glow, 0, 1)
    return Image.fromarray((np.dstack([col, inside]) * 255 + .5).astype(np.uint8), 'RGBA')


orb(96).save(OUT / 'orb.png', optimize=True)


# ─── Reloj: esfera y cúpula de cristal (200 px, viewBox 0 0 100 100) ───
def clock(size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2
    nx, ny = (x - c) / c, (y - c) / c
    r = np.hypot(nx, ny)
    a = smoothstep(.95, .935, r)
    # Bisel cromado con reflejo cónico
    th = np.arctan2(ny, nx)
    metal = .62 + .3 * np.cos(2 * th + .8) + .08 * np.cos(6 * th)
    bezel = smoothstep(.8, .82, r)
    face = np.array([1, 1, 1]) * (1 - .14 * smoothstep(.2, .8, r))[..., None] - np.array([.06, .03, 0]) * smoothstep(.0, .8, ny)[..., None]
    col = face * (1 - bezel[..., None]) + (metal[..., None] * np.array([.88, .93, 1])) * bezel[..., None]
    shade = smoothstep(.8, .78, r) * smoothstep(.6, .8, r) * .25 * smoothstep(-1, .2, -ny)
    col = col - shade[..., None]
    im = Image.fromarray((np.clip(np.dstack([col, a]), 0, 1) * 255 + .5).astype(np.uint8), 'RGBA')
    # Marcas horarias
    from PIL import ImageDraw
    dr = ImageDraw.Draw(im)
    for i in range(60):
        t = i / 60 * 2 * math.pi
        big = i % 5 == 0
        r0, r1 = (.62, .74) if big else (.7, .74)
        p0 = (c + math.sin(t) * r0 * c, c - math.cos(t) * r0 * c)
        p1 = (c + math.sin(t) * r1 * c, c - math.cos(t) * r1 * c)
        dr.line([p0, p1], fill=(40, 58, 78, 255), width=5 if big else 2)
    glassd = np.zeros((size, size, 4), np.float32)
    hl = smoothstep(.55, .35, np.hypot(nx / .95, (ny + .38) / .55)) * smoothstep(.2, -.7, ny)
    glassd[..., :3] = 1
    glassd[..., 3] = hl * .55 * smoothstep(.8, .78, r) + smoothstep(.76, .8, r) * smoothstep(.82, .8, r) * .3
    return im, Image.fromarray((glassd * 255 + .5).astype(np.uint8), 'RGBA')


face, dome = clock(400)
face.resize((200, 200), Image.LANCZOS).save(OUT / 'clock-face.png', optimize=True)
dome.resize((200, 200), Image.LANCZOS).save(OUT / 'clock-glass.png', optimize=True)
print('Recursos generados en', OUT)
