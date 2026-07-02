#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_laser_svg.py  -  Lazer kesim icin SVG temizleyici / duzeltici.

Bambu / Laser Box Maker exportlarindaki "capraz cizgi" hatasini kalici cozer.

  Sebep : Tek bir <path> icinde, her ic-kesim oncesinde tekrar eden
          dejenere "M x y" (cizmeden git) komutlari var. SVG goruntuleyici
          bunlari yok sayar; ama bircok CAD/lazer importu (LightBurn, DXF
          cevirici vb.) bu atlamalari L (cizgi) gibi yorumlayinca, panelin
          kosesinden her yuvaya birer capraz cizgi cikar.

  Cozum : 1) Tum transform'lari (matrix/translate/scale/rotate) duz
             koordinata isler -> ciktida HIC transform kalmaz.
          2) Her alt-yolu (subpath) ayri <path> elemanina boler.
          3) Cizim icermeyen dejenere "M" alt-yollarini atar.
          4) Her parcada ic-kesimleri ONCE, dis konturu EN SON yazar
             (bbox alanina gore otomatik) -> kayma riski biter.
          5) Istege bagli: parcalari tabla genisligine gore yeniden dizer
             (--bed-width). Offset koordinata islenir, transform uretmez.

Harici kutuphane gerektirmez. Sadece standart Python.

Kullanim:
    python fix_laser_svg.py <giris.svg> [cikis.svg]
    python fix_laser_svg.py <giris.svg> --bed-width 400 --gap 3
"""

import re
import sys
import math
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"

# ---------------------------------------------------------------- transform

def mat_mul(a, b):
    a0, a1, a2, a3, a4, a5 = a
    b0, b1, b2, b3, b4, b5 = b
    return (
        a0 * b0 + a2 * b1,
        a1 * b0 + a3 * b1,
        a0 * b2 + a2 * b3,
        a1 * b2 + a3 * b3,
        a0 * b4 + a2 * b5 + a4,
        a1 * b4 + a3 * b5 + a5,
    )

IDENTITY = (1, 0, 0, 1, 0, 0)

def parse_transform(s):
    if not s:
        return IDENTITY
    m = IDENTITY
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", s):
        nums = [float(x) for x in re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", args)]
        if name == "matrix" and len(nums) == 6:
            t = tuple(nums)
        elif name == "translate":
            tx = nums[0]
            ty = nums[1] if len(nums) > 1 else 0.0
            t = (1, 0, 0, 1, tx, ty)
        elif name == "scale":
            sx = nums[0]
            sy = nums[1] if len(nums) > 1 else sx
            t = (sx, 0, 0, sy, 0, 0)
        elif name == "rotate":
            a = math.radians(nums[0])
            c, s2 = math.cos(a), math.sin(a)
            if len(nums) == 3:
                cx, cy = nums[1], nums[2]
                t = mat_mul((1, 0, 0, 1, cx, cy),
                            mat_mul((c, s2, -s2, c, 0, 0),
                                    (1, 0, 0, 1, -cx, -cy)))
            else:
                t = (c, s2, -s2, c, 0, 0)
        else:
            t = IDENTITY
        m = mat_mul(m, t)
    return m

def apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])

# ---------------------------------------------------------------- path parse

TOKEN_RE = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)")

def tokenize(d):
    out = []
    for cmd, num in TOKEN_RE.findall(d):
        out.append(cmd if cmd else float(num))
    return out

def split_subpaths(d):
    toks = tokenize(d)
    subpaths, current = [], []
    i, n = 0, len(toks)
    cmd = None
    counts = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4,
              "Q": 4, "T": 2, "A": 7, "Z": 0}
    while i < n:
        t = toks[i]
        if isinstance(t, str):
            cmd = t
            i += 1
        up = cmd.upper()
        if up == "Z":
            current.append((cmd, []))
            cmd = None
            continue
        cnt = counts[up]
        args = toks[i:i + cnt]
        i += cnt
        if up == "M":
            if current:
                subpaths.append(current)
            current = [(cmd, args)]
            cmd = "l" if cmd.islower() else "L"
        else:
            current.append((cmd, args))
    if current:
        subpaths.append(current)
    return subpaths

def subpath_has_geometry(sp):
    return any(c.upper() in ("L", "H", "V", "C", "S", "Q", "T", "A") for c, _ in sp)

def transform_subpath(sp, m):
    """Mutlak koordinata cevir + affine uygula. Donus: (geom, bbox)."""
    geom = []                  # [(cmd, [(x,y), ...]), ...] transformed absolute
    cx = cy = sx = sy = 0.0
    xs, ys = [], []

    def T(x, y):
        tx, ty = apply(m, x, y)
        xs.append(tx); ys.append(ty)
        return (tx, ty)

    for cmd, args in sp:
        up = cmd.upper()
        rel = cmd.islower()
        if up == "Z":
            geom.append(("Z", []))
            cx, cy = sx, sy
        elif up == "M":
            x, y = args
            if rel: x += cx; y += cy
            cx, cy = x, y; sx, sy = x, y
            geom.append(("M", [T(x, y)]))
        elif up == "L":
            x, y = args
            if rel: x += cx; y += cy
            cx, cy = x, y
            geom.append(("L", [T(x, y)]))
        elif up == "H":
            x = args[0] + (cx if rel else 0); cx = x
            geom.append(("L", [T(cx, cy)]))
        elif up == "V":
            y = args[0] + (cy if rel else 0); cy = y
            geom.append(("L", [T(cx, cy)]))
        elif up == "C":
            x1, y1, x2, y2, x, y = args
            if rel: x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
            geom.append(("C", [T(x1, y1), T(x2, y2), T(x, y)]))
            cx, cy = x, y
        elif up == "Q":
            x1, y1, x, y = args
            if rel: x1 += cx; y1 += cy; x += cx; y += cy
            geom.append(("Q", [T(x1, y1), T(x, y)]))
            cx, cy = x, y
        else:
            raise ValueError(f"Desteklenmeyen komut: {cmd}")
    bbox = (min(xs), min(ys), max(xs), max(ys)) if xs else None
    return geom, bbox

def geom_to_d(geom, dx=0.0, dy=0.0):
    parts = []
    for cmd, pts in geom:
        if cmd == "Z":
            parts.append("Z")
        else:
            coords = " ".join(f"{x + dx:.4f} {y + dy:.4f}" for x, y in pts)
            parts.append(f"{cmd} {coords}")
    return " ".join(parts)

# ---------------------------------------------------------------- walk tree

def walk(elem, m, faces, order, current_face):
    tag = elem.tag.split("}")[-1]
    m = mat_mul(m, parse_transform(elem.get("transform", "")))

    if tag == "g" and elem.get("name"):
        current_face = elem.get("name")
        if current_face not in faces:
            faces[current_face] = []
            order.append(current_face)

    if tag == "path":
        for sp in split_subpaths(elem.get("d", "")):
            if not subpath_has_geometry(sp):
                continue
            geom, bbox = transform_subpath(sp, m)
            if bbox is None:
                continue
            key = current_face or "_"
            if key not in faces:
                faces[key] = []
                order.append(key)
            faces[key].append((geom, bbox))

    for child in list(elem):
        walk(child, m, faces, order, current_face)

# ---------------------------------------------------------------- layout

def face_bbox(paths):
    xs0 = min(b[0] for _, b in paths); ys0 = min(b[1] for _, b in paths)
    xs1 = max(b[2] for _, b in paths); ys1 = max(b[3] for _, b in paths)
    return xs0, ys0, xs1, ys1

def shelf_pack(face_list, bed_w, gap):
    """face_list: [(name, paths)]. Donus: {name: (dx, dy)} ve toplam (w,h)."""
    items = []
    for name, paths in face_list:
        x0, y0, x1, y1 = face_bbox(paths)
        items.append([name, x0, y0, x1 - x0, y1 - y0])
    # yuksege gore azalan -> daha sik raf
    items.sort(key=lambda it: -it[4])

    offsets = {}
    cur_x = 0.0
    cur_y = 0.0
    shelf_h = 0.0
    max_w = 0.0
    for name, x0, y0, w, h in items:
        if cur_x > 0 and cur_x + w > bed_w:
            cur_y += shelf_h + gap
            cur_x = 0.0
            shelf_h = 0.0
        # parcayi (cur_x, cur_y) noktasina tasi
        offsets[name] = (cur_x - x0, cur_y - y0)
        cur_x += w + gap
        shelf_h = max(shelf_h, h)
        max_w = max(max_w, cur_x - gap)
    total_h = cur_y + shelf_h
    return offsets, max_w, total_h

# ---------------------------------------------------------------- main

def fix(path_in, path_out, bed_width=None, gap=3.0,
        stroke="rgb(255,0,0)", stroke_w=0.1):
    ET.register_namespace("", SVG_NS)
    root = ET.parse(path_in).getroot()
    width = root.get("width")
    height = root.get("height")
    viewbox = root.get("viewBox")

    faces, order = {}, []
    walk(root, IDENTITY, faces, order, None)
    face_list = [(n, faces[n]) for n in order if faces[n]]

    # yerlesim
    if bed_width:
        offsets, total_w, total_h = shelf_pack(face_list, bed_width, gap)
        unit = "mm"
        width = f"{total_w:.4f}{unit}"
        height = f"{total_h:.4f}{unit}"
        viewbox = f"0 0 {total_w:.4f} {total_h:.4f}"
    else:
        offsets = {n: (0.0, 0.0) for n, _ in face_list}

    lines = [
        f'<svg xmlns="{SVG_NS}" width="{width}" height="{height}" '
        f'viewBox="{viewbox}">'
    ]
    total = 0
    for name, paths in face_list:
        dx, dy = offsets[name]
        # ic-kesim once, dis kontur (en buyuk alan) en son
        paths_sorted = sorted(
            paths, key=lambda p: (p[1][2] - p[1][0]) * (p[1][3] - p[1][1]))
        lines.append(f'  <!-- {name} -->')
        for geom, _ in paths_sorted:
            d = geom_to_d(geom, dx, dy)
            lines.append(
                f'  <path d="{d}" fill="none" stroke="{stroke}" '
                f'stroke-width="{stroke_w}" stroke-linecap="round" '
                f'stroke-linejoin="round" vector-effect="non-scaling-stroke"/>')
            total += 1
    lines.append('</svg>')

    with open(path_out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return total, len(face_list)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    bed_width = None
    gap = 3.0
    positional = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--bed-width":
            bed_width = float(args[i + 1]); i += 2
        elif a == "--gap":
            gap = float(args[i + 1]); i += 2
        else:
            positional.append(a); i += 1

    inp = positional[0]
    if len(positional) >= 2:
        outp = positional[1]
    else:
        base = inp[:-4] if inp.lower().endswith(".svg") else inp
        suffix = f"-fixed-{int(bed_width)}mm" if bed_width else "-fixed"
        outp = base + suffix + ".svg"

    n, faces = fix(inp, outp, bed_width=bed_width, gap=gap)
    print(f"OK -> {outp}")
    print(f"   parca (face): {faces}")
    print(f"   temiz path  : {n}")
    if bed_width:
        print(f"   tabla       : {bed_width:.0f} mm icine dizildi (gap {gap} mm)")


if __name__ == "__main__":
    main()
