/*
 * Lazer editoru — metin (tek-cizgi kazima fontu) ve temel sekil ureteci.
 * Ciktilar image-space vectorPaths: Y asagi, [0..sourceWidth] x [0..sourceHeight].
 * Font tanimi Y-YUKARI (baseline 0, cap 7); build sirasinda cevrilir.
 */
(function (root) {
  "use strict";

  // --- yardimcilar --------------------------------------------------------
  function arc(cx, cy, rx, ry, a0, a1, segMax) {
    // a0/a1 derece. Isaret yonu belirler. ~22 derece adim.
    const out = [];
    const span = a1 - a0;
    const steps = Math.max(2, segMax || Math.ceil(Math.abs(span) / 22));
    for (let i = 0; i <= steps; i += 1) {
      const a = ((a0 + (span * i) / steps) * Math.PI) / 180;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }

  function poly(...xy) {
    const out = [];
    for (let i = 0; i < xy.length; i += 2) out.push([xy[i], xy[i + 1]]);
    return out;
  }

  // --- tek-cizgi font (cap=7, baseline=0) ---------------------------------
  // Her glyph: { w: ilerleme, s: [stroke, ...] }; stroke = [[x,y],...]
  const F = {};
  const O = (cx, cy, rx, ry) => arc(cx, cy, rx, ry, 0, 360);

  F[" "] = { w: 3.4, s: [] };
  F["A"] = { w: 6, s: [poly(0, 0, 3, 7, 6, 0), poly(1.05, 2.4, 4.95, 2.4)] };
  F["B"] = { w: 5.6, s: [
    poly(0, 0, 0, 7),
    [[0, 7], ...arc(0, 5.25, 4.4, 1.75, 90, -90), [0, 3.5]],
    [[0, 3.5], ...arc(0, 1.75, 4.7, 1.75, 90, -90), [0, 0]],
  ] };
  F["C"] = { w: 6, s: [arc(3, 3.5, 3, 3.5, 58, 302)] };
  F["D"] = { w: 6, s: [poly(0, 0, 0, 7), [[0, 7], ...arc(0, 3.5, 5.5, 3.5, 90, -90), [0, 0]]] };
  F["E"] = { w: 5, s: [poly(0, 0, 0, 7), poly(0, 7, 4.6, 7), poly(0, 3.5, 3.6, 3.5), poly(0, 0, 4.6, 0)] };
  F["F"] = { w: 5, s: [poly(0, 0, 0, 7), poly(0, 7, 4.6, 7), poly(0, 3.5, 3.6, 3.5)] };
  F["G"] = { w: 6.2, s: [arc(3, 3.5, 3, 3.5, 58, 340), poly(6, 3.2, 3.3, 3.2), poly(6, 3.2, 6, 0.6)] };
  F["H"] = { w: 5.6, s: [poly(0, 0, 0, 7), poly(5.6, 0, 5.6, 7), poly(0, 3.5, 5.6, 3.5)] };
  F["I"] = { w: 3, s: [poly(0, 0, 3, 0), poly(1.5, 0, 1.5, 7), poly(0, 7, 3, 7)] };
  F["J"] = { w: 5, s: [poly(4, 7, 4, 2), arc(2, 2, 2, 2, 0, -180)] };
  F["K"] = { w: 5.5, s: [poly(0, 0, 0, 7), poly(5, 7, 0, 3.2), poly(1.7, 4.3, 5.3, 0)] };
  F["L"] = { w: 4.8, s: [poly(0, 7, 0, 0, 4.6, 0)] };
  F["M"] = { w: 6.6, s: [poly(0, 0, 0, 7, 3.3, 3, 6.6, 7, 6.6, 0)] };
  F["N"] = { w: 6, s: [poly(0, 0, 0, 7, 6, 0, 6, 7)] };
  F["O"] = { w: 6.4, s: [O(3.2, 3.5, 3.2, 3.5)] };
  F["P"] = { w: 5.4, s: [poly(0, 0, 0, 7), [[0, 7], ...arc(0, 5.15, 4.6, 1.85, 90, -90), [0, 3.3]]] };
  F["Q"] = { w: 6.4, s: [O(3.2, 3.5, 3.2, 3.5), poly(3.6, 2, 6, -0.4)] };
  F["R"] = { w: 5.6, s: [poly(0, 0, 0, 7), [[0, 7], ...arc(0, 5.15, 4.6, 1.85, 90, -90), [0, 3.3]], poly(2.4, 3.3, 5.4, 0)] };
  F["S"] = { w: 5.4, s: [[
    ...arc(2.7, 5.2, 2.5, 1.8, 60, 300),
    ...arc(2.7, 1.9, 2.5, 1.9, 120, -120),
  ]] };
  F["T"] = { w: 5.4, s: [poly(0, 7, 5.4, 7), poly(2.7, 7, 2.7, 0)] };
  F["U"] = { w: 5.6, s: [poly(0, 7, 0, 2), arc(2.8, 2, 2.8, 2, 180, 360), poly(5.6, 2, 5.6, 7)] };
  F["V"] = { w: 6, s: [poly(0, 7, 3, 0, 6, 7)] };
  F["W"] = { w: 7.4, s: [poly(0, 7, 1.6, 0, 3.7, 5, 5.8, 0, 7.4, 7)] };
  F["X"] = { w: 5.6, s: [poly(0, 0, 5.6, 7), poly(0, 7, 5.6, 0)] };
  F["Y"] = { w: 5.6, s: [poly(0, 7, 2.8, 3.4, 5.6, 7), poly(2.8, 3.4, 2.8, 0)] };
  F["Z"] = { w: 5.4, s: [poly(0, 7, 5.4, 7, 0, 0, 5.4, 0)] };

  F["0"] = { w: 5.6, s: [O(2.8, 3.5, 2.8, 3.5), poly(0.9, 1, 4.7, 6)] };
  F["1"] = { w: 4, s: [poly(0.8, 5.4, 2.4, 7, 2.4, 0), poly(0.6, 0, 4, 0)] };
  F["2"] = { w: 5.2, s: [[...arc(2.6, 5, 2.5, 2, 170, -35), [0.3, 0], [5, 0]]] };
  F["3"] = { w: 5.2, s: [[...arc(2.4, 5.3, 2.4, 1.7, 160, -90), ...arc(2.2, 1.8, 2.7, 1.8, 90, -140)]] };
  F["4"] = { w: 5.6, s: [poly(3.9, 0, 3.9, 7, 0, 2.2, 5.4, 2.2)] };
  F["5"] = { w: 5.2, s: [poly(4.6, 7, 1, 7, 0.7, 3.7), [[0.7, 3.7], ...arc(2.3, 2.2, 2.6, 2.2, 100, -150)]] };
  F["6"] = { w: 5.4, s: [O(2.5, 2.1, 2.4, 2.1), poly(4.4, 6.9, 3, 6.9, 1.4, 6, 0.3, 3.8, 0.1, 2.1)] };
  F["7"] = { w: 5.2, s: [poly(0, 7, 5.2, 7, 1.8, 0)] };
  F["8"] = { w: 5.4, s: [O(2.7, 5.2, 2.3, 1.8), O(2.7, 1.9, 2.7, 1.9)] };
  F["9"] = { w: 5.4, s: [O(2.9, 4.9, 2.4, 2.1), poly(0.9, 0.1, 2.3, 0.1, 3.9, 1, 5.1, 3.2, 5.3, 4.9)] };

  F["."] = { w: 2.2, s: [poly(0.7, 0, 1.3, 0, 1.3, 0.6, 0.7, 0.6, 0.7, 0)] };
  F[","] = { w: 2.4, s: [poly(1.4, 0.6, 1.4, 0, 0.6, -1.2)] };
  F["-"] = { w: 4.4, s: [poly(0.6, 3.3, 3.8, 3.3)] };
  F["_"] = { w: 5.4, s: [poly(0, -1, 5.4, -1)] };
  F[":"] = { w: 2.2, s: [poly(0.7, 4.6, 1.3, 4.6, 1.3, 4, 0.7, 4, 0.7, 4.6), poly(0.7, 1.4, 1.3, 1.4, 1.3, 0.8, 0.7, 0.8, 0.7, 1.4)] };
  F[";"] = { w: 2.4, s: [poly(1, 4.6, 1.6, 4.6, 1.6, 4, 1, 4, 1, 4.6), poly(1.5, 1.2, 1.5, 0.6, 0.7, -0.8)] };
  F["!"] = { w: 2.2, s: [poly(1, 7, 1, 1.8), poly(0.7, 0, 1.3, 0, 1.3, 0.6, 0.7, 0.6, 0.7, 0)] };
  F["?"] = { w: 5, s: [[...arc(2.5, 5.2, 2.3, 1.8, 180, -35), [2.5, 3.2], [2.5, 1.8]], poly(2.2, 0, 2.8, 0, 2.8, 0.6, 2.2, 0.6, 2.2, 0)] };
  F["/"] = { w: 4.4, s: [poly(0, -1, 4.4, 8)] };
  F["\\"] = { w: 4.4, s: [poly(0, 8, 4.4, -1)] };
  F["("] = { w: 3, s: [arc(3, 3, 2.6, 4, 135, 225)] };
  F[")"] = { w: 3, s: [arc(0, 3, 2.6, 4, 45, -45)] };
  F["+"] = { w: 5, s: [poly(2.5, 1, 2.5, 6), poly(0, 3.5, 5, 3.5)] };
  F["="] = { w: 5, s: [poly(0.4, 4.4, 4.6, 4.4), poly(0.4, 2.4, 4.6, 2.4)] };
  F["*"] = { w: 5, s: [poly(2.5, 3, 2.5, 7), poly(0.8, 3.9, 4.2, 6.1), poly(0.8, 6.1, 4.2, 3.9)] };
  F["#"] = { w: 6, s: [poly(1.8, 0, 2.6, 7), poly(3.4, 0, 4.2, 7), poly(0.6, 2.3, 5.4, 2.3), poly(0.6, 4.7, 5.4, 4.7)] };
  F["%"] = { w: 6.4, s: [poly(0, 0, 6.4, 7), O(1.4, 5.6, 1.2, 1.2), O(5, 1.4, 1.2, 1.2)] };
  F["&"] = { w: 6.2, s: [[...arc(2, 5.6, 1.6, 1.4, -40, 220), ...arc(2.4, 2.3, 2.4, 2.3, 150, -80), [6.2, 0]]] };
  F["@"] = { w: 7, s: [arc(3.3, 3.3, 3.3, 3.3, -20, 250), O(3.3, 3.3, 1.4, 1.4)] };
  F["'"] = { w: 2, s: [poly(1, 7, 1, 5.4)] };
  F['"'] = { w: 3.2, s: [poly(1, 7, 1, 5.4), poly(2.4, 7, 2.4, 5.4)] };

  // Turkce buyuk harfler (temel harf + diakritik)
  const cedilla = (x) => poly(x, 0, x, -1, x - 0.9, -1.6);
  F["Ç"] = { w: 6, s: [...F["C"].s, cedilla(3)] };
  F["Ş"] = { w: 5.4, s: [...F["S"].s, cedilla(2.5)] };
  F["Ğ"] = { w: 6.2, s: [...F["G"].s, arc(2, 8.6, 1.4, 0.9, 200, 340)] };
  F["Ü"] = { w: 5.6, s: [...F["U"].s, poly(1.4, 8.4, 1.4, 9), poly(4.2, 8.4, 4.2, 9)] };
  F["Ö"] = { w: 6.4, s: [...F["O"].s, poly(2.1, 8.4, 2.1, 9), poly(4.3, 8.4, 4.3, 9)] };
  F["İ"] = { w: 3, s: [...F["I"].s, poly(1.2, 8.4, 1.8, 8.4, 1.8, 9, 1.2, 9, 1.2, 8.4)] };

  const UPPER_MAP = {
    "a": "A", "b": "B", "c": "C", "d": "D", "e": "E", "f": "F", "g": "G",
    "h": "H", "i": "İ", "j": "J", "k": "K", "l": "L", "m": "M", "n": "N",
    "o": "O", "p": "P", "q": "Q", "r": "R", "s": "S", "t": "T", "u": "U",
    "v": "V", "w": "W", "x": "X", "y": "Y", "z": "Z",
    "ç": "Ç", "ğ": "Ğ", "ı": "I", "ö": "Ö", "ş": "Ş", "ü": "Ü",
  };

  const CAP = 7;
  const GAP = 1.6;
  const SMALLCAP = 0.72; // kucuk harf yerine kucuk-buyuk harf

  function glyphFor(ch) {
    if (F[ch]) return { g: F[ch], scale: 1 };
    const upper = UPPER_MAP[ch];
    if (upper && F[upper]) return { g: F[upper], scale: SMALLCAP };
    const asUpper = ch.toUpperCase();
    if (F[asUpper]) return { g: F[asUpper], scale: asUpper === ch ? 1 : SMALLCAP };
    return null; // desteklenmeyen -> bosluk gibi atla
  }

  function buildText(text, opts) {
    opts = opts || {};
    const height = Math.max(2, Number(opts.height) || 20); // mm, cap yuksekligi
    const tracking = Number(opts.tracking) || 0; // ekstra harf araligi (mm)
    const unit = height / CAP; // font biriminden mm'ye
    const lines = String(text == null ? "" : text).split("\n");
    const lineGap = CAP * 1.55;
    const strokesMM = []; // [[x_mm, y_mm(up)], ...]
    let maxW = 0;

    lines.forEach((line, lineIndex) => {
      let penX = 0;
      const baseY = -lineIndex * lineGap;
      for (const ch of line) {
        const found = glyphFor(ch);
        if (!found) {
          penX += 3.4;
          continue;
        }
        const { g, scale } = found;
        for (const stroke of g.s) {
          const pts = stroke.map(([x, y]) => [
            (penX + x * scale) * unit,
            (baseY + y * scale) * unit,
          ]);
          if (pts.length >= 2) strokesMM.push(pts);
        }
        penX += g.w * scale + GAP + tracking;
      }
      maxW = Math.max(maxW, penX - GAP - tracking);
    });

    if (!strokesMM.length) return null;
    // Sinirlari bul, sol-alt (0,0) yap, image-space'e cevir (Y asagi)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxYv = -Infinity;
    for (const s of strokesMM) for (const [x, y] of s) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxYv) maxYv = y;
    }
    const w = Math.max(0.5, maxX - minX);
    const h = Math.max(0.5, maxYv - minY);
    const vectorPaths = strokesMM.map((s, i) => ({
      id: `t${i + 1}`,
      points: s.map(([x, y]) => [x - minX, maxYv - y]), // Y flip -> image space
      closed: false,
      removed: false,
      operation: "engrave_line",
    }));
    return { vectorPaths, sourceWidth: w, sourceHeight: h, kind: "text" };
  }

  // --- temel sekiller (image-space, closed=cut varsayilan) ----------------
  function closedPath(id, pts, operation) {
    const closed = pts.slice();
    const a = closed[0];
    const b = closed[closed.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) closed.push([a[0], a[1]]);
    return { id, points: closed, closed: true, removed: false, operation: operation || "cut" };
  }

  function pack(vectorPaths, w, h, kind) {
    return { vectorPaths, sourceWidth: Math.max(0.5, w), sourceHeight: Math.max(0.5, h), kind: kind || "shape" };
  }

  function ellipsePoints(cx, cy, rx, ry, seg) {
    seg = Math.max(12, seg || Math.ceil((Math.max(rx, ry) * Math.PI * 2) / 1.2));
    const pts = [];
    for (let i = 0; i < seg; i += 1) {
      const a = (i / seg) * Math.PI * 2;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return pts;
  }

  function buildShape(kind, params) {
    params = params || {};
    const op = params.operation || "cut";
    if (kind === "rect" || kind === "square") {
      const w = Math.max(1, Number(params.width) || 30);
      const h = Math.max(1, Number(kind === "square" ? params.width : params.height) || w);
      const r = Math.max(0, Math.min(Number(params.radius) || 0, Math.min(w, h) / 2));
      let pts;
      if (r > 0.01) {
        const a = (cx, cy, a0, a1) => arc(cx, cy, r, r, a0, a1, 6);
        pts = [
          ...a(w - r, r, 90, 0), ...a(w - r, h - r, 0, -90),
          ...a(r, h - r, -90, -180), ...a(r, r, 180, 90),
        ];
      } else {
        pts = [[0, 0], [w, 0], [w, h], [0, h]];
      }
      return pack([closedPath("s1", pts, op)], w, h, "shape");
    }
    if (kind === "circle" || kind === "ellipse") {
      const rx = Math.max(0.5, (Number(params.width) || Number(params.diameter) || 30) / 2);
      const ry = kind === "circle" ? rx : Math.max(0.5, (Number(params.height) || rx * 2) / 2);
      const pts = ellipsePoints(rx, ry, rx, ry, params.segments);
      return pack([closedPath("s1", pts, op)], rx * 2, ry * 2, "shape");
    }
    if (kind === "polygon") {
      const n = Math.max(3, Math.round(Number(params.sides) || 6));
      const r = Math.max(1, (Number(params.width) || 30) / 2);
      const rot = ((Number(params.rotation) || 0) - 90) * Math.PI / 180;
      const pts = [];
      for (let i = 0; i < n; i += 1) {
        const a = rot + (i / n) * Math.PI * 2;
        pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]);
      }
      return pack([closedPath("s1", pts, op)], r * 2, r * 2, "shape");
    }
    if (kind === "test-square") {
      // Kalibrasyon karesi: bilinen olcude kare (kesim) + ic olcu etiketi (kazima)
      const size = Math.max(5, Number(params.size) || 20);
      const paths = [closedPath("sq", [[0, 0], [size, 0], [size, size], [0, size]], "cut")];
      const label = buildText(`${size}mm`, { height: Math.max(3, size * 0.22) });
      if (label) {
        const lw = label.sourceWidth;
        const lh = label.sourceHeight;
        const ox = (size - lw) / 2;
        const oy = (size - lh) / 2;
        for (const vp of label.vectorPaths) {
          paths.push({
            id: `lbl-${vp.id}`,
            points: vp.points.map(([x, y]) => [x + ox, y + oy]),
            closed: false,
            removed: false,
            operation: "engrave_line",
          });
        }
      }
      return pack(paths, size, size, "shape");
    }
    return null;
  }

  root.LaserGeometry = { buildText, buildShape, _font: F };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) module.exports = (typeof window !== "undefined" ? window : globalThis).LaserGeometry;
