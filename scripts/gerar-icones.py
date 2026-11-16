#!/usr/bin/env python3
"""Gera os ícones PNG do STOP! a partir da fonte Baloo 2 já incluída no projeto.

Uso:  python3 scripts/gerar-icones.py
Requer Pillow + fonttools/brotli (só para converter o woff2 em ttf).
Os PNGs finais ficam versionados em www/assets/ — não precisa rodar isto para jogar.
"""
import os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RAIZ, "www", "assets")
WOFF = os.path.join(ASSETS, "baloo-2-latin-800-normal.woff2")
TTF = "/tmp/Baloo2-800-icone.ttf"
if not os.path.exists(TTF):
    f = TTFont(WOFF)
    f.flavor = None
    f.save(TTF)

VERDE_TOPO = (47, 157, 111)
VERDE_BASE = (13, 72, 48)
CREME = (249, 242, 223)
TINTA = (36, 31, 24)
CARMIM = (184, 35, 74)
AMARELO = (223, 164, 31)
LINHA = (217, 203, 169)


def gradiente(tam):
    img = Image.new("RGB", (1, tam))
    for y in range(tam):
        t = y / max(1, tam - 1)
        img.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(VERDE_TOPO, VERDE_BASE)))
    return img.resize((tam, tam), Image.BILINEAR)


def desenhar(tam, escala=1.0):
    base = gradiente(tam).convert("RGBA")

    # trama diagonal do feltro
    trama = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(trama)
    for i in range(-tam, tam * 2, max(6, tam // 64)):
        d.line([(i, 0), (i + tam, tam)], fill=(255, 255, 255, 12), width=max(1, tam // 256))
    base = Image.alpha_composite(base, trama)

    # máscara de cantos arredondados
    raio = round(tam * 0.22)
    mascara = Image.new("L", (tam, tam), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, tam - 1, tam - 1], radius=raio, fill=255)

    conteudo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    d = ImageDraw.Draw(conteudo)

    c = tam / 2
    r = tam * 0.344 * escala
    d.ellipse([c - r, c - r, c + r, c + r], fill=CREME + (255,))
    d.ellipse([c - r, c - r, c + r, c + r], outline=TINTA + (255,), width=max(2, round(tam * 0.0196)))
    r2 = r * 0.897
    d.ellipse([c - r2, c - r2, c + r2, c + r2], outline=LINHA + (255,), width=max(1, round(tam * 0.0098)))

    fonte_s = ImageFont.truetype(TTF, round(tam * 0.44 * escala))
    fonte_ex = ImageFont.truetype(TTF, round(tam * 0.30 * escala))
    d.text((c - tam * 0.095 * escala, c + tam * 0.02 * escala), "S", font=fonte_s, fill=CARMIM + (255,), anchor="mm")
    excl = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    de = ImageDraw.Draw(excl)
    de.text((c + tam * 0.165 * escala, c - tam * 0.03 * escala), "!", font=fonte_ex, fill=AMARELO + (255,), anchor="mm")
    excl = excl.rotate(-9, resample=Image.BICUBIC, center=(c + tam * 0.165 * escala, c - tam * 0.03 * escala))
    conteudo = Image.alpha_composite(conteudo, excl)

    arte = Image.alpha_composite(base, conteudo)
    final = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    final.paste(arte, (0, 0), mascara)
    return final


def salvar(img, nome):
    caminho = os.path.join(ASSETS, nome)
    img.save(caminho, optimize=True)
    print("gerado:", os.path.relpath(caminho, RAIZ), img.size)


salvar(desenhar(192), "icone-192.png")
salvar(desenhar(512), "icone-512.png")
# maskable: conteúdo dentro da zona segura (~80%)
salvar(desenhar(512, escala=0.78), "icone-mask-512.png")
salvar(desenhar(180), "apple-touch-icon.png")
