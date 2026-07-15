#!/usr/bin/env python3
"""Convert simple 2D DXF files to laser G-code.

This is meant for laser-cut outlines exported from CAD programs such as
SolidWorks. It reads ASCII DXF entities, keeps everything in millimeters, and
emits GRBL-style G-code. Supported geometry: LINE, LWPOLYLINE, POLYLINE/VERTEX,
CIRCLE, and ARC. Arcs are approximated with short G1 moves to avoid controller
arc-dialect problems.
"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from pathlib import Path


Point = tuple[float, float]
POWER_MIN = 0
POWER_MAX = 1000


@dataclass
class DxfEntity:
    kind: str
    values: dict[int, list[str]]


@dataclass
class ConversionStats:
    entity_count: int
    raw_path_count: int
    cut_path_count: int
    unsupported: dict[str, int]
    min_x: float
    min_y: float
    max_x: float
    max_y: float


class DxfToGcodeError(RuntimeError):
    pass


def validate_power(power: int) -> int:
    if power < POWER_MIN or power > POWER_MAX:
        raise DxfToGcodeError(f"Laser power S must be between {POWER_MIN} and {POWER_MAX}")
    return power


def fmt(value: float) -> str:
    if abs(value) < 1e-9:
        value = 0.0
    return f"{value:.4f}".rstrip("0").rstrip(".")


def axis_words(point: Point, previous: Point | None = None) -> str:
    x, y = point
    if previous is None:
        return f"X{fmt(x)} Y{fmt(y)}"

    parts: list[str] = []
    if abs(x - previous[0]) > 1e-9:
        parts.append(f"X{fmt(x)}")
    if abs(y - previous[1]) > 1e-9:
        parts.append(f"Y{fmt(y)}")
    return " ".join(parts) or f"X{fmt(x)} Y{fmt(y)}"


def dist(a: Point, b: Point) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def signed_area(path: list[Point]) -> float:
    if len(path) < 3:
        return 0.0
    area = 0.0
    pts = path
    if dist(pts[0], pts[-1]) > 1e-7:
        pts = [*pts, pts[0]]
    for p1, p2 in zip(pts, pts[1:]):
        area += p1[0] * p2[1] - p2[0] * p1[1]
    return area / 2.0


def bbox(path: list[Point]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in path]
    ys = [point[1] for point in path]
    return min(xs), min(ys), max(xs), max(ys)


def is_closed(path: list[Point], tolerance: float) -> bool:
    return len(path) > 2 and dist(path[0], path[-1]) <= tolerance


def close_path(path: list[Point], tolerance: float) -> list[Point]:
    if is_closed(path, tolerance):
        path[-1] = path[0]
        return path
    return path


def path_with_overcut(path: list[Point], overcut: float, tolerance: float = 0.05) -> list[Point]:
    if overcut <= 0 or not is_closed(path, tolerance) or len(path) < 4:
        return path

    extended = path[:]
    remaining = overcut
    previous = path[0]
    for point in path[1:]:
        segment_length = dist(previous, point)
        if segment_length <= 1e-9:
            previous = point
            continue
        if remaining <= segment_length:
            ratio = remaining / segment_length
            extended.append(
                (
                    previous[0] + (point[0] - previous[0]) * ratio,
                    previous[1] + (point[1] - previous[1]) * ratio,
                )
            )
            break
        extended.append(point)
        remaining -= segment_length
        previous = point
    return extended


def normalize_air_assist_command(command: str | None) -> str | None:
    command = (command or "").strip().upper()
    if not command:
        return None
    if command not in {"M7", "M8"}:
        raise DxfToGcodeError("Air assist command must be M7 or M8")
    return command


def read_pairs(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    if len(text) % 2:
        text.append("")

    pairs: list[tuple[int, str]] = []
    for index in range(0, len(text), 2):
        code_text = text[index].strip()
        value = text[index + 1].strip()
        try:
            code = int(code_text)
        except ValueError:
            continue
        pairs.append((code, value))
    return pairs


def add_value(values: dict[int, list[str]], code: int, value: str) -> None:
    values.setdefault(code, []).append(value)


def parse_entities(path: Path) -> list[DxfEntity]:
    pairs = read_pairs(path)
    entities: list[DxfEntity] = []
    in_entities = False
    index = 0

    while index < len(pairs):
        code, value = pairs[index]
        if code == 0 and value == "SECTION":
            section_name = pairs[index + 1][1] if index + 1 < len(pairs) else ""
            in_entities = section_name == "ENTITIES"
            index += 2
            continue
        if code == 0 and value == "ENDSEC":
            in_entities = False
            index += 1
            continue
        if not in_entities:
            index += 1
            continue

        if code == 0 and value == "POLYLINE":
            poly_values: dict[int, list[str]] = {}
            index += 1
            while index < len(pairs) and not (pairs[index][0] == 0 and pairs[index][1] == "VERTEX"):
                if pairs[index][0] == 0:
                    break
                add_value(poly_values, pairs[index][0], pairs[index][1])
                index += 1

            vertices: list[dict[int, list[str]]] = []
            while index < len(pairs) and pairs[index] == (0, "VERTEX"):
                vertex_values: dict[int, list[str]] = {}
                index += 1
                while index < len(pairs) and pairs[index][0] != 0:
                    add_value(vertex_values, pairs[index][0], pairs[index][1])
                    index += 1
                vertices.append(vertex_values)

            entities.append(DxfEntity("POLYLINE", {**poly_values, 9999: [repr(vertices)]}))
            if index < len(pairs) and pairs[index] == (0, "SEQEND"):
                index += 1
            continue

        if code == 0 and value not in ("EOF", "SEQEND"):
            kind = value
            values: dict[int, list[str]] = {}
            index += 1
            while index < len(pairs) and pairs[index][0] != 0:
                add_value(values, pairs[index][0], pairs[index][1])
                index += 1
            entities.append(DxfEntity(kind, values))
            continue

        index += 1

    return entities


def first_float(values: dict[int, list[str]], code: int, default: float = 0.0) -> float:
    try:
        return float(values.get(code, [str(default)])[0])
    except ValueError:
        return default


def first_int(values: dict[int, list[str]], code: int, default: int = 0) -> int:
    try:
        return int(float(values.get(code, [str(default)])[0]))
    except ValueError:
        return default


def vertex_float(vertex: dict[int, list[str]], code: int, default: float = 0.0) -> float:
    try:
        return float(vertex.get(code, [str(default)])[0])
    except ValueError:
        return default


def arc_points(center: Point,
               radius: float,
               start_deg: float,
               end_deg: float,
               tolerance: float) -> list[Point]:
    start = math.radians(start_deg)
    end = math.radians(end_deg)
    while end <= start:
        end += math.tau
    sweep = end - start
    steps = max(4, int(math.ceil((abs(sweep) * radius) / max(tolerance, 0.01))))
    return [
        (
            center[0] + radius * math.cos(start + sweep * step / steps),
            center[1] + radius * math.sin(start + sweep * step / steps),
        )
        for step in range(steps + 1)
    ]


def circle_points(center: Point, radius: float, tolerance: float) -> list[Point]:
    points = arc_points(center, radius, 0.0, 360.0, tolerance)
    points[-1] = points[0]
    return points


def bulge_segment_points(p1: Point, p2: Point, bulge: float, tolerance: float) -> list[Point]:
    if abs(bulge) < 1e-12:
        return [p1, p2]

    chord = dist(p1, p2)
    if chord < 1e-12:
        return [p1]

    theta = 4.0 * math.atan(bulge)
    radius = chord * (1.0 + bulge * bulge) / (4.0 * abs(bulge))
    mid = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0)
    perp = (-(p2[1] - p1[1]) / chord, (p2[0] - p1[0]) / chord)
    offset = chord * (1.0 - bulge * bulge) / (4.0 * bulge)
    center = (mid[0] + perp[0] * offset, mid[1] + perp[1] * offset)

    start = math.atan2(p1[1] - center[1], p1[0] - center[0])
    end = math.atan2(p2[1] - center[1], p2[0] - center[0])
    if bulge > 0 and end <= start:
        end += math.tau
    elif bulge < 0 and end >= start:
        end -= math.tau

    sweep = end - start
    steps = max(2, int(math.ceil((abs(sweep) * radius) / max(tolerance, 0.01))))
    return [
        (
            center[0] + radius * math.cos(start + sweep * step / steps),
            center[1] + radius * math.sin(start + sweep * step / steps),
        )
        for step in range(steps + 1)
    ]


def lwpolyline_paths(entity: DxfEntity, tolerance: float) -> list[list[Point]]:
    xs = [float(value) for value in entity.values.get(10, [])]
    ys = [float(value) for value in entity.values.get(20, [])]
    bulges = [float(value) for value in entity.values.get(42, [])]
    vertices = [
        (xs[index], ys[index], bulges[index] if index < len(bulges) else 0.0)
        for index in range(min(len(xs), len(ys)))
    ]
    if len(vertices) < 2:
        return []

    closed = bool(first_int(entity.values, 70, 0) & 1)
    path: list[Point] = []
    segment_count = len(vertices) if closed else len(vertices) - 1
    for index in range(segment_count):
        x1, y1, bulge = vertices[index]
        x2, y2, _ = vertices[(index + 1) % len(vertices)]
        segment = bulge_segment_points((x1, y1), (x2, y2), bulge, tolerance)
        path.extend(segment if not path else segment[1:])
    if closed:
        path = close_path(path, tolerance)
    return [path]


def polyline_paths(entity: DxfEntity, tolerance: float) -> list[list[Point]]:
    import ast

    vertices_raw = entity.values.get(9999, ["[]"])[0]
    vertices = ast.literal_eval(vertices_raw)
    if len(vertices) < 2:
        return []
    closed = bool(first_int(entity.values, 70, 0) & 1)
    points = [
        (
            vertex_float(vertex, 10),
            vertex_float(vertex, 20),
            vertex_float(vertex, 42),
        )
        for vertex in vertices
    ]

    path: list[Point] = []
    segment_count = len(points) if closed else len(points) - 1
    for index in range(segment_count):
        x1, y1, bulge = points[index]
        x2, y2, _ = points[(index + 1) % len(points)]
        segment = bulge_segment_points((x1, y1), (x2, y2), bulge, tolerance)
        path.extend(segment if not path else segment[1:])
    if closed:
        path = close_path(path, tolerance)
    return [path]


def entity_to_paths(entity: DxfEntity, tolerance: float) -> list[list[Point]]:
    values = entity.values
    if entity.kind == "LINE":
        return [[(first_float(values, 10), first_float(values, 20)), (first_float(values, 11), first_float(values, 21))]]
    if entity.kind == "CIRCLE":
        center = (first_float(values, 10), first_float(values, 20))
        return [circle_points(center, first_float(values, 40), tolerance)]
    if entity.kind == "ARC":
        center = (first_float(values, 10), first_float(values, 20))
        return [arc_points(center, first_float(values, 40), first_float(values, 50), first_float(values, 51), tolerance)]
    if entity.kind == "LWPOLYLINE":
        return lwpolyline_paths(entity, tolerance)
    if entity.kind == "POLYLINE":
        return polyline_paths(entity, tolerance)
    return []


def join_paths(paths: list[list[Point]], tolerance: float) -> list[list[Point]]:
    open_paths = [path[:] for path in paths if len(path) >= 2]
    changed = True
    while changed:
        changed = False
        for index, path in enumerate(open_paths):
            if is_closed(path, tolerance):
                path[-1] = path[0]
                continue
            for other_index in range(index + 1, len(open_paths)):
                other = open_paths[other_index]
                if is_closed(other, tolerance):
                    continue
                if dist(path[-1], other[0]) <= tolerance:
                    path.extend(other[1:])
                elif dist(path[-1], other[-1]) <= tolerance:
                    path.extend(reversed(other[:-1]))
                elif dist(path[0], other[-1]) <= tolerance:
                    path[:0] = other[:-1]
                elif dist(path[0], other[0]) <= tolerance:
                    path[:0] = list(reversed(other[1:]))
                else:
                    continue
                open_paths.pop(other_index)
                changed = True
                break
            if changed:
                break
    return [close_path(path, tolerance) for path in open_paths]


def nearest_neighbor_order(paths: list[list[Point]],
                           start: Point = (0.0, 0.0)) -> list[list[Point]]:
    """Boş hareketi kısaltmak için yolları başlangıç noktasına en yakından sırala.

    Sadece sıra değişir; hiçbir koordinata dokunulmaz. Böylece kafa tablanın bir
    ucundan öbürüne zikzak atlamaz, adım kaybı azalır.
    """
    remaining = list(paths)
    ordered: list[list[Point]] = []
    current = start
    while remaining:
        best = min(range(len(remaining)), key=lambda i: dist(current, remaining[i][0]))
        chosen = remaining.pop(best)
        ordered.append(chosen)
        current = chosen[-1]
    return ordered


def ordered_paths(paths: list[list[Point]], tolerance: float) -> list[list[Point]]:
    closed = [path for path in paths if is_closed(path, tolerance)]
    open_ = [path for path in paths if not is_closed(path, tolerance)]

    # En büyük alanlı kapalı yol = dış kontur -> her zaman EN SON kesilir
    # (parça malzemeye takılı kalsın). Geri kalan iç kesimler yakınlık sırasına.
    outer: list[Point] | None = None
    if closed:
        closed.sort(key=lambda path: abs(signed_area(path)))
        outer = closed.pop()

    inner = open_ + closed
    # Başlangıç köşesi = tüm geometrinin sol-alt (min) köşesi. Sıralama shift'ten
    # önce çalıştığı için sabit (0,0) yanlış olur; gerçek köşeden başlat.
    all_points = [pt for path in (inner + ([outer] if outer else [])) for pt in path]
    if all_points:
        start = (min(x for x, _ in all_points), min(y for _, y in all_points))
    else:
        start = (0.0, 0.0)
    inner = nearest_neighbor_order(inner, start=start)
    return [*inner, outer] if outer is not None else inner


def convert_dxf_paths(input_path: Path,
                      tolerance: float,
                      join_tolerance: float) -> tuple[list[list[Point]], dict[str, int], int]:
    entities = parse_entities(input_path)
    raw_paths: list[list[Point]] = []
    unsupported: dict[str, int] = {}
    supported_count = 0

    for entity in entities:
        paths = entity_to_paths(entity, tolerance)
        if paths:
            supported_count += 1
            raw_paths.extend(paths)
        else:
            unsupported[entity.kind] = unsupported.get(entity.kind, 0) + 1

    joined = join_paths(raw_paths, join_tolerance)
    return joined, unsupported, supported_count


def shift_paths_to_origin(paths: list[list[Point]], margin: float) -> tuple[list[list[Point]], tuple[float, float, float, float]]:
    min_x = min(point[0] for path in paths for point in path)
    min_y = min(point[1] for path in paths for point in path)
    max_x = max(point[0] for path in paths for point in path)
    max_y = max(point[1] for path in paths for point in path)
    dx = margin - min_x
    dy = margin - min_y
    shifted = [[(point[0] + dx, point[1] + dy) for point in path] for path in paths]
    return shifted, (min_x, min_y, max_x, max_y)


def write_gcode(output_path: Path,
                paths: list[list[Point]],
                feed: float,
                power: int,
                rapid_feed: float | None,
                laser_cmd: str,
                pierce_delay: float,
                comments: bool,
                overcut: float = 0.0,
                return_to_origin: bool = False,
                travel_feed: float | None = None,
                passes: int = 1,
                pre_cut_lines: list[str] | None = None,
                air_assist_command: str | None = None) -> None:
    power = validate_power(power)
    laser_cmd = str(laser_cmd or "").strip().upper()
    if laser_cmd not in {"M3", "M4"}:
        raise DxfToGcodeError("Laser command must be M3 or M4")
    air_assist_command = normalize_air_assist_command(air_assist_command)
    if passes < 1:
        raise DxfToGcodeError("Pass count must be at least 1")
    lines: list[str] = []
    if comments:
        lines.append("G90 (use absolute coordinates)")
    lines.extend(["G21", "G90", "G94", f"{laser_cmd} S0", "S0"])
    if rapid_feed is not None:
        lines.append(f"G0 F{fmt(rapid_feed)}")
    if air_assist_command:
        lines.append(f"{air_assist_command} (air assist on)")
    if pre_cut_lines:
        lines.extend(pre_cut_lines)

    if comments and paths:
        lines.append("(cut paths begin)")
    for number, path in enumerate(paths, 1):
        if len(path) < 2:
            continue
        path = path_with_overcut(path, overcut)
        start = path[0]
        for pass_number in range(passes):
            if comments:
                lines.append(f"(cut path {number} pass {pass_number + 1})")
            # Boş hareket: travel_feed verilmişse G1 (kontrollü hız, lazer kapali S0),
            # yoksa G0 (makinenin $110 tepe hizi). G1 yontemi $110'u degistirmeden
            # konumlanmayi yavaslatir -> hizli sicramada adim kaybi/kayma azalir.
            if travel_feed is not None and travel_feed > 0:
                lines.append(f"G1 {axis_words(start)} F{fmt(travel_feed)}")
            else:
                lines.append(f"G0 {axis_words(start)}")
            lines.append(f"S{power}")
            if pierce_delay > 0:
                lines.append(f"G4 P{fmt(pierce_delay)}")
            first_cut = path[1]
            lines.append(f"G1 {axis_words(first_cut)} F{fmt(feed)}")
            previous = first_cut
            for point in path[2:]:
                words = axis_words(point)
                if words:
                    lines.append(f"G1 {words}")
                previous = point
            lines.append("S0")
    if comments and paths:
        lines.append("(cut paths end)")

    lines.append("M5 S0")
    if air_assist_command:
        lines.append("M9 (air assist off)")
    if return_to_origin:
        lines.append("G0 X0 Y0")
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def convert_file(input_path: Path,
                 output_path: Path,
                 feed: float,
                 power: int,
                 rapid_feed: float | None,
                 laser_cmd: str,
                 tolerance: float,
                 join_tolerance: float,
                 pierce_delay: float,
                 shift_origin: bool,
                 margin: float,
                 inner_first: bool,
                 comments: bool,
                 overcut: float = 0.0,
                 return_to_origin: bool = False,
                 travel_feed: float | None = None,
                 passes: int = 1) -> ConversionStats:
    paths, unsupported, supported_count = convert_dxf_paths(input_path, tolerance, join_tolerance)
    if not paths:
        raise DxfToGcodeError("No supported cut geometry found in the DXF")

    if inner_first:
        paths = ordered_paths(paths, join_tolerance)

    min_x = min(point[0] for path in paths for point in path)
    min_y = min(point[1] for path in paths for point in path)
    max_x = max(point[0] for path in paths for point in path)
    max_y = max(point[1] for path in paths for point in path)

    if shift_origin:
        paths, original_bounds = shift_paths_to_origin(paths, margin)
        min_x, min_y, max_x, max_y = original_bounds

    write_gcode(
        output_path,
        paths,
        feed,
        power,
        rapid_feed,
        laser_cmd,
        pierce_delay,
        comments,
        overcut,
        return_to_origin,
        travel_feed,
        passes,
    )
    return ConversionStats(
        entity_count=supported_count + sum(unsupported.values()),
        raw_path_count=supported_count,
        cut_path_count=len(paths),
        unsupported=unsupported,
        min_x=min_x,
        min_y=min_y,
        max_x=max_x,
        max_y=max_y,
    )


def default_output(input_path: Path) -> Path:
    return input_path.with_suffix(".nc")


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert 2D DXF geometry directly to laser G-code.")
    parser.add_argument("input", type=Path, help="Input ASCII DXF file")
    parser.add_argument("-o", "--output", type=Path, help="Output .nc/.gcode file")
    parser.add_argument("--feed", type=float, default=600.0, help="Cut feed rate in mm/min")
    parser.add_argument("--power", type=int, default=800, help="Laser S value from 0 to 1000")
    parser.add_argument("--rapid-feed", type=float, help="Optional G0 feed rate in mm/min")
    parser.add_argument("--laser-cmd", choices=("M3", "M4"), default="M3", help="Laser on command")
    parser.add_argument("--tolerance", type=float, default=0.25, help="Arc approximation segment length in mm")
    parser.add_argument("--join-tolerance", type=float, default=0.05, help="Endpoint join tolerance in mm")
    parser.add_argument("--pierce-delay", type=float, default=0.0, help="Delay after laser-on in seconds")
    parser.add_argument("--overcut", type=float, default=0.0, help="Extra distance in mm past the start of closed paths")
    parser.add_argument("--no-shift-origin", action="store_true", help="Keep original DXF coordinates")
    parser.add_argument("--margin", type=float, default=0.0, help="Margin when shifting minimum X/Y to origin")
    parser.add_argument("--no-inner-first", action="store_true", help="Keep geometry order instead of inner/small paths first")
    parser.add_argument("--no-comments", action="store_true", help="Do not write semicolon comments")
    parser.add_argument("--return-to-origin", action="store_true", help="Move back to X0 Y0 after the job")
    parser.add_argument("--travel-feed", type=float, help="Use controlled G1 travel at this mm/min instead of G0 rapids")
    parser.add_argument("--passes", type=int, default=1, help="Repeat each contour this many times")
    args = parser.parse_args()

    output = args.output or default_output(args.input)
    try:
        stats = convert_file(
            input_path=args.input,
            output_path=output,
            feed=args.feed,
            power=args.power,
            rapid_feed=args.rapid_feed,
            laser_cmd=args.laser_cmd,
            tolerance=args.tolerance,
            join_tolerance=args.join_tolerance,
            pierce_delay=args.pierce_delay,
            shift_origin=not args.no_shift_origin,
            margin=args.margin,
            inner_first=not args.no_inner_first,
            comments=not args.no_comments,
            overcut=args.overcut,
            return_to_origin=args.return_to_origin,
            travel_feed=args.travel_feed,
            passes=args.passes,
        )
    except (OSError, DxfToGcodeError, ValueError, SyntaxError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Output: {output}")
    print(f"DXF entities read: {stats.entity_count}")
    print(f"Cut paths written: {stats.cut_path_count}")
    print(f"Original bounds: {fmt(stats.max_x - stats.min_x)} x {fmt(stats.max_y - stats.min_y)} mm")
    if stats.unsupported:
        unsupported = ", ".join(f"{name}={count}" for name, count in sorted(stats.unsupported.items()))
        print(f"Warning: unsupported/skipped entities: {unsupported}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
