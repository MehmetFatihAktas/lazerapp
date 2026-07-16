#!/usr/bin/env python3
"""Core geometry and G-code helpers for the visual laser editor."""

from __future__ import annotations

import base64
import copy
import io
import math
import mimetypes
import re
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from itertools import chain
from pathlib import Path
from typing import Any, Iterable, Iterator

import clean_laser_svg
import dxf_to_laser_gcode as converter

try:
    from PIL import Image, ImageEnhance, ImageOps
except ImportError:  # pragma: no cover
    Image = None
    ImageEnhance = None
    ImageOps = None

try:
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover
    cv2 = None
    np = None


Point = tuple[float, float]
MAX_RASTER_CELLS = 320_000
SVG_NS = "http://www.w3.org/2000/svg"
SVG_CLEAN_SUFFIX = "-editor-clean"
GCODE_WORD_RE = re.compile(r"([A-Za-z])([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)")
ET.register_namespace("", SVG_NS)


@dataclass
class LoadedPart:
    id: str
    path: Path
    name: str
    paths: list[list[Point]]
    width: float
    height: float
    unsupported: dict[str, int]


@dataclass
class RasterPattern:
    path: Path
    x: float
    y: float
    width: float
    height: float
    rotation: float
    power: int
    feed: float
    line_step: float
    threshold: int
    mirror_x: bool = False
    mirror_y: bool = False
    raster_mode: str = "threshold"
    power_min: int = 0
    gamma: float = 1.0
    bidirectional: bool = True


@dataclass
class ClipRegion:
    polygons: list[list[Point]]
    margin: float = 0.0


def fmt(value: float) -> str:
    return converter.fmt(value)


def gcode_comment_text(value: Any, fallback: str) -> str:
    text = str(value or fallback).encode("ascii", errors="ignore").decode("ascii") or fallback
    text = re.sub(r"[\x00-\x1f\x7f()]+", "_", text)
    return text.strip() or fallback


def all_points(paths: list[list[Point]]) -> list[Point]:
    return [point for path in paths for point in path]


def paths_bounds(paths: list[list[Point]]) -> tuple[float, float, float, float]:
    points = all_points(paths)
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    )


def normalize_paths(paths: list[list[Point]]) -> tuple[list[list[Point]], float, float]:
    min_x, min_y, max_x, max_y = paths_bounds(paths)
    normalized = [[(point[0] - min_x, point[1] - min_y) for point in path] for path in paths]
    return normalized, max_x - min_x, max_y - min_y


def load_part(path: Path, part_id: str, tolerance: float, join_tolerance: float, inner_first: bool) -> LoadedPart:
    if not path.exists():
        raise ValueError(f"DXF bulunamadi: {path}")
    paths, unsupported, _supported_count = converter.convert_dxf_paths(path, tolerance, join_tolerance)
    if not paths:
        raise ValueError(f"DXF icinde desteklenen cizgi yok: {path.name}")
    if inner_first:
        paths = converter.ordered_paths(paths, join_tolerance)
    normalized, width, height = normalize_paths(paths)
    return LoadedPart(
        id=part_id,
        path=path,
        name=path.name,
        paths=normalized,
        width=width,
        height=height,
        unsupported=unsupported,
    )


def part_to_payload(part: LoadedPart) -> dict[str, Any]:
    return {
        "id": part.id,
        "path": str(part.path),
        "name": part.name,
        "width": part.width,
        "height": part.height,
        "paths": part.paths,
        "unsupported": part.unsupported,
    }


def part_from_payload(part_data: dict[str, Any], part_id: str) -> LoadedPart:
    """Rebuild a part from geometry embedded in a saved project payload."""
    paths: list[list[Point]] = []
    for raw_path in part_data.get("paths") or []:
        path: list[Point] = []
        for raw_point in raw_path or []:
            if not isinstance(raw_point, (list, tuple)) or len(raw_point) < 2:
                continue
            try:
                x = float(raw_point[0])
                y = float(raw_point[1])
            except (TypeError, ValueError):
                continue
            if math.isfinite(x) and math.isfinite(y):
                path.append((x, y))
        if len(path) >= 2:
            paths.append(path)
    if not paths:
        raise ValueError(f"Proje icinde gomulu DXF geometrisi yok: {part_data.get('name') or part_id}")
    path_text = str(part_data.get("path") or part_data.get("name") or f"{part_id}.dxf")
    width = _float(part_data.get("width"), 0.0)
    height = _float(part_data.get("height"), 0.0)
    if width <= 0 or height <= 0:
        min_x, min_y, max_x, max_y = paths_bounds(paths)
        width = max_x - min_x
        height = max_y - min_y
    unsupported = part_data.get("unsupported") if isinstance(part_data.get("unsupported"), dict) else {}
    return LoadedPart(
        id=part_id,
        path=Path(path_text),
        name=str(part_data.get("name") or Path(path_text).name or part_id),
        paths=paths,
        width=width,
        height=height,
        unsupported=unsupported,
    )


def transform_point(point: Point, part_width: float, part_height: float, placement: dict[str, Any]) -> Point:
    x, y = point
    rotation = int(round(float(placement.get("rotation", 0)))) % 360
    px = float(placement["x"])
    py = float(placement["y"])
    if rotation == 90:
        return px + y, py + part_width - x
    if rotation == 180:
        return px + part_width - x, py + part_height - y
    if rotation == 270:
        return px + part_height - y, py + x
    return px + x, py + y


def transform_paths(part: LoadedPart, placement: dict[str, Any]) -> list[list[Point]]:
    return [[transform_point(point, part.width, part.height, placement) for point in path] for path in part.paths]


def point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    if len(polygon) < 3:
        return False
    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            dy = y2 - y1
            if abs(dy) <= 1e-12:
                previous = current
                continue
            x_intersect = x1 + (y - y1) * (x2 - x1) / dy
            if x < x_intersect:
                inside = not inside
        previous = current
    return inside


def point_segment_distance(point: Point, start: Point, end: Point) -> float:
    px, py = point
    x1, y1 = start
    x2, y2 = end
    dx = x2 - x1
    dy = y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq <= 1e-12:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    closest = (x1 + t * dx, y1 + t * dy)
    return math.hypot(px - closest[0], py - closest[1])


def point_to_polygons_distance(point: Point, polygons: list[list[Point]]) -> float:
    best = float("inf")
    for polygon in polygons:
        if len(polygon) < 2:
            continue
        for index, start in enumerate(polygon):
            end = polygon[(index + 1) % len(polygon)]
            best = min(best, point_segment_distance(point, start, end))
    return best


def polygon_signed_area(points: list[Point]) -> float:
    if len(points) < 3:
        return 0.0
    total = 0.0
    for index, current in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        total += current[0] * next_point[1] - next_point[0] * current[1]
    return total / 2.0


def clip_region_contains(point: Point, clip_region: ClipRegion | None) -> bool:
    if clip_region is None or not clip_region.polygons:
        return True
    inside = False
    for polygon in clip_region.polygons:
        if point_in_polygon(point, polygon):
            inside = not inside
    if not inside:
        return False
    margin = max(0.0, float(clip_region.margin))
    if margin <= 1e-9:
        return True
    return point_to_polygons_distance(point, clip_region.polygons) >= margin


def clip_segment_to_region(start: Point,
                           end: Point,
                           clip_region: ClipRegion | None,
                           step: float = 0.25) -> list[tuple[Point, Point]]:
    if clip_region is None or not clip_region.polygons:
        return [(start, end)]
    length = converter.dist(start, end)
    if length <= 1e-9:
        return []
    divisions = max(1, int(math.ceil(length / max(0.05, float(step)))))
    result: list[tuple[Point, Point]] = []
    current_start: Point | None = None

    def point_at(t: float) -> Point:
        return (start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t)

    def boundary_between(t_inside: float, t_outside: float) -> Point:
        low = t_inside
        high = t_outside
        for _ in range(18):
            mid = (low + high) / 2.0
            if clip_region_contains(point_at(mid), clip_region):
                low = mid
            else:
                high = mid
        return point_at(low)

    previous_t = 0.0
    previous_point = point_at(previous_t)
    previous_inside = clip_region_contains(previous_point, clip_region)
    if previous_inside:
        current_start = previous_point

    for index in range(1, divisions + 1):
        current_t = index / divisions
        current_point = point_at(current_t)
        current_inside = clip_region_contains(current_point, clip_region)

        if previous_inside and current_inside:
            pass
        elif previous_inside and not current_inside:
            boundary = boundary_between(previous_t, current_t)
            if current_start is not None and converter.dist(current_start, boundary) >= 0.03:
                result.append((current_start, boundary))
            current_start = None
        elif not previous_inside and current_inside:
            current_start = boundary_between(current_t, previous_t)

        previous_t = current_t
        previous_point = current_point
        previous_inside = current_inside

    if current_start is not None and previous_inside and converter.dist(current_start, previous_point) >= 0.03:
        result.append((current_start, previous_point))
    return result


def boundary_projection(point: Point, polygon: list[Point]) -> tuple[float, int, float, Point]:
    best_distance = float("inf")
    best_index = 0
    best_t = 0.0
    best_point = polygon[0]
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length_sq = dx * dx + dy * dy
        if length_sq <= 1e-12:
            t = 0.0
            projected = start
        else:
            t = max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / length_sq))
            projected = (start[0] + dx * t, start[1] + dy * t)
        distance = converter.dist(point, projected)
        if distance < best_distance:
            best_distance = distance
            best_index = index
            best_t = t
            best_point = projected
    return best_distance, best_index, best_t, best_point


def polygon_boundary_route(start: Point, end: Point, polygon: list[Point], forward: bool) -> list[Point]:
    _start_distance, start_index, _start_t, _start_projected = boundary_projection(start, polygon)
    _end_distance, end_index, _end_t, _end_projected = boundary_projection(end, polygon)
    if start_index == end_index:
        return [start, end]
    route = [start]
    count = len(polygon)
    index = (start_index + 1) % count if forward else start_index
    guard = 0
    while guard <= count:
        vertex = polygon[index]
        if converter.dist(route[-1], vertex) > 0.03:
            route.append(vertex)
        if (forward and index == end_index) or (not forward and index == (end_index + 1) % count):
            break
        index = (index + 1) % count if forward else (index - 1) % count
        guard += 1
    if converter.dist(route[-1], end) > 0.03:
        route.append(end)
    return route


def _line_intersection(a1: Point, a2: Point, b1: Point, b2: Point) -> Point | None:
    ax = a2[0] - a1[0]
    ay = a2[1] - a1[1]
    bx = b2[0] - b1[0]
    by = b2[1] - b1[1]
    denom = ax * by - ay * bx
    if abs(denom) <= 1e-9:
        return None
    cx = b1[0] - a1[0]
    cy = b1[1] - a1[1]
    t = (cx * by - cy * bx) / denom
    return (a1[0] + ax * t, a1[1] + ay * t)


def inset_polygon_for_margin(polygon: list[Point], margin: float) -> list[Point]:
    if margin <= 1e-9 or len(polygon) < 3:
        return polygon
    area = polygon_signed_area(polygon)
    if abs(area) <= 1e-9:
        return polygon
    sign = 1.0 if area > 0 else -1.0
    shifted_edges: list[tuple[Point, Point, Point]] = []
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = math.hypot(dx, dy)
        if length <= 1e-9:
            shifted_edges.append((start, end, (0.0, 0.0)))
            continue
        # For CCW polygons the interior is on the left side of each edge.
        normal = (-dy / length * sign, dx / length * sign)
        shifted_edges.append(
            (
                (start[0] + normal[0] * margin, start[1] + normal[1] * margin),
                (end[0] + normal[0] * margin, end[1] + normal[1] * margin),
                normal,
            )
        )
    inset: list[Point] = []
    count = len(shifted_edges)
    for index in range(count):
        prev_start, prev_end, prev_normal = shifted_edges[(index - 1) % count]
        current_start, current_end, current_normal = shifted_edges[index]
        point = _line_intersection(prev_start, prev_end, current_start, current_end)
        if point is None:
            vertex = polygon[index]
            normal = (prev_normal[0] + current_normal[0], prev_normal[1] + current_normal[1])
            normal_length = math.hypot(normal[0], normal[1])
            if normal_length > 1e-9:
                point = (vertex[0] + normal[0] / normal_length * margin, vertex[1] + normal[1] / normal_length * margin)
            else:
                point = current_start
        if not inset or converter.dist(inset[-1], point) > 0.03:
            inset.append(point)
    if len(inset) >= 3 and abs(polygon_signed_area(inset)) >= 0.05:
        return inset
    return polygon


def offset_closed_polygon(polygon: list[Point], outward: float) -> list[Point]:
    """Kapali poligonu isaretli mesafeyle otele: outward>0 disari, <0 iceri.

    inset_polygon_for_margin ile ayni kenar-kaydirma + kesisme (miter)
    yontemi; tek fark yonun isaretli olmasi. Ofset sonucu dejenere olursa
    (kendini yok edecek kadar kucuk) orijinal poligon dondurulur.
    """
    if abs(outward) <= 1e-9 or len(polygon) < 3:
        return polygon
    area = polygon_signed_area(polygon)
    if abs(area) <= 1e-9:
        return polygon
    interior_sign = 1.0 if area > 0 else -1.0
    move = -outward  # pozitif outward = ic normalin tersi yonde kaydir
    shifted_edges: list[tuple[Point, Point, Point]] = []
    for index, start in enumerate(polygon):
        end = polygon[(index + 1) % len(polygon)]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = math.hypot(dx, dy)
        if length <= 1e-9:
            shifted_edges.append((start, end, (0.0, 0.0)))
            continue
        normal = (-dy / length * interior_sign, dx / length * interior_sign)
        shifted_edges.append(
            (
                (start[0] + normal[0] * move, start[1] + normal[1] * move),
                (end[0] + normal[0] * move, end[1] + normal[1] * move),
                normal,
            )
        )
    result: list[Point] = []
    count = len(shifted_edges)
    for index in range(count):
        prev_start, prev_end, prev_normal = shifted_edges[(index - 1) % count]
        current_start, current_end, current_normal = shifted_edges[index]
        point = _line_intersection(prev_start, prev_end, current_start, current_end)
        if point is None:
            vertex = polygon[index]
            normal = (prev_normal[0] + current_normal[0], prev_normal[1] + current_normal[1])
            normal_length = math.hypot(normal[0], normal[1])
            if normal_length > 1e-9:
                point = (vertex[0] + normal[0] / normal_length * move, vertex[1] + normal[1] / normal_length * move)
            else:
                point = current_start
        if not result or converter.dist(result[-1], point) > 0.03:
            result.append(point)
    if len(result) >= 3 and abs(polygon_signed_area(result)) >= 0.05:
        return result
    return polygon


def apply_kerf_to_paths(paths: list[list[Point]], kerf: float) -> list[list[Point]]:
    """Kesim yollarina kerf (isin kalinligi) telafisi uygula.

    Isin, yolun her iki yanindan kerf/2 malzeme yer. Parca olculerinin
    tasarimdaki gibi cikmasi icin: DIS kontur kerf/2 DISARI, delik/yuva
    (baska kapali yolun icinde kalan kontur) kerf/2 ICERI otelenir.
    Boylece gecme tirnaklar buyur, yuvalar daralir -> siki gecme.
    Ic ice derinlik pariteyle belirlenir (delik icindeki ada yine dis
    sayilir). Acik yollar degistirilmez (telafi yonu belirsiz).
    """
    kerf = max(0.0, float(kerf or 0.0))
    if kerf <= 1e-6 or not paths:
        return paths
    half = kerf / 2.0
    polygons: dict[int, list[Point]] = {}
    for index, path in enumerate(paths):
        if len(path) >= 4 and converter.dist(path[0], path[-1]) <= 0.05:
            polygons[index] = path[:-1]
    result: list[list[Point]] = []
    for index, path in enumerate(paths):
        polygon = polygons.get(index)
        if polygon is None:
            result.append(path)
            continue
        probe = polygon[0]
        depth = sum(
            1
            for other_index, other in polygons.items()
            if other_index != index and point_in_polygon(probe, other)
        )
        outward = half if depth % 2 == 0 else -half
        offset = offset_closed_polygon(polygon, outward)
        result.append([*offset, offset[0]])
    return result


def polyline_length(points: list[Point]) -> float:
    return sum(converter.dist(points[index - 1], points[index]) for index in range(1, len(points)))


def clip_boundary_connector(start: Point, end: Point, clip_region: ClipRegion) -> list[Point]:
    best_route: list[Point] | None = None
    best_score = float("inf")
    margin = max(0.0, float(clip_region.margin))
    projection_limit = max(1.0, margin * 0.35 + 0.5)
    for polygon in clip_region.polygons:
        if len(polygon) < 3:
            continue
        route_polygon = inset_polygon_for_margin(polygon, margin)
        start_distance = boundary_projection(start, route_polygon)[0]
        end_distance = boundary_projection(end, route_polygon)[0]
        if start_distance > projection_limit or end_distance > projection_limit:
            continue
        for forward in (True, False):
            route = polygon_boundary_route(start, end, route_polygon, forward)
            score = polyline_length(route) + start_distance + end_distance
            if score < best_score:
                best_score = score
                best_route = route
    return best_route or [start, end]


def close_clipped_polyline(points: list[Point], clip_region: ClipRegion) -> list[Point]:
    if len(points) < 2 or converter.dist(points[0], points[-1]) <= 0.03:
        return points
    connector = clip_boundary_connector(points[-1], points[0], clip_region)
    return points + connector[1:]


def clip_polyline_to_region(points: list[Point],
                            clip_region: ClipRegion | None,
                            step: float = 0.25,
                            close_boundary: bool = False,
                            closed_source: bool = False) -> list[list[Point]]:
    if clip_region is None or not clip_region.polygons:
        return [points] if len(points) >= 2 else []
    clipped_paths: list[list[Point]] = []
    current: list[Point] = []
    for index in range(1, len(points)):
        for start, end in clip_segment_to_region(points[index - 1], points[index], clip_region, step=step):
            if current and converter.dist(current[-1], start) <= max(0.05, step * 1.25):
                current.append(end)
            else:
                if len(current) >= 2:
                    clipped_paths.append(current)
                current = [start, end]
    if len(current) >= 2:
        clipped_paths.append(current)
    if closed_source and len(clipped_paths) > 1 and converter.dist(clipped_paths[-1][-1], clipped_paths[0][0]) <= max(0.05, step * 1.25):
        first = clipped_paths.pop(0)
        clipped_paths[-1].extend(first[1:])
    if close_boundary:
        clipped_paths = [close_clipped_polyline(path, clip_region) for path in clipped_paths]
    return clipped_paths


def closed_clip_polygons(paths: list[list[Point]]) -> list[list[Point]]:
    polygons: list[list[Point]] = []
    for path in paths:
        if len(path) < 3:
            continue
        polygon = [(float(x), float(y)) for x, y in path]
        if converter.dist(polygon[0], polygon[-1]) <= 0.05:
            polygon = polygon[:-1]
        if len(polygon) >= 3 and abs(polygon_signed_area(polygon)) >= 0.5:
            polygons.append(polygon)
    polygons.sort(key=lambda polygon: abs(polygon_signed_area(polygon)), reverse=True)
    return polygons


def polyline_length(points: list[Point]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(converter.dist(points[index - 1], points[index]) for index in range(1, len(points)))


def point_at_polyline_distance(points: list[Point], target: float) -> Point:
    if not points:
        return (0.0, 0.0)
    if target <= 0:
        return points[0]
    travelled = 0.0
    for index in range(1, len(points)):
        start = points[index - 1]
        end = points[index]
        segment = converter.dist(start, end)
        if segment <= 1e-9:
            continue
        if travelled + segment >= target:
            ratio = (target - travelled) / segment
            return (start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio)
        travelled += segment
    return points[-1]


def sub_polyline(points: list[Point], start_distance: float, end_distance: float) -> list[Point]:
    if len(points) < 2 or end_distance <= start_distance:
        return []
    output = [point_at_polyline_distance(points, start_distance)]
    travelled = 0.0
    for index in range(1, len(points)):
        segment_start = travelled
        segment_end = travelled + converter.dist(points[index - 1], points[index])
        if segment_start > start_distance + 1e-9 and segment_start < end_distance - 1e-9:
            output.append(points[index - 1])
        travelled = segment_end
    output.append(point_at_polyline_distance(points, end_distance))
    return [point for index, point in enumerate(output) if index == 0 or converter.dist(output[index - 1], point) > 0.01]


def apply_micro_tabs_to_polyline(points: list[Point], tab_count: int, tab_width: float) -> list[list[Point]]:
    """Split a closed cut path into powered segments, leaving S0 gaps as micro tabs."""
    if len(points) < 4 or tab_count <= 0 or tab_width <= 0:
        return [points]
    if converter.dist(points[0], points[-1]) > 0.05:
        return [points]
    total = polyline_length(points)
    tab_count = max(0, int(tab_count))
    tab_width = max(0.0, float(tab_width))
    if total <= 0 or tab_count <= 0 or tab_width <= 0 or tab_count * tab_width >= total * 0.35:
        return [points]
    gap_intervals: list[tuple[float, float]] = []
    spacing = total / tab_count
    half = tab_width / 2.0
    for index in range(tab_count):
        center = (index + 0.5) * spacing
        start = center - half
        end = center + half
        if start < 0:
            gap_intervals.append((start + total, total))
            gap_intervals.append((0.0, end))
        elif end > total:
            gap_intervals.append((start, total))
            gap_intervals.append((0.0, end - total))
        else:
            gap_intervals.append((start, end))
    gap_intervals.sort()
    merged: list[list[float]] = []
    for start, end in gap_intervals:
        if not merged or start > merged[-1][1] + 0.01:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    powered: list[list[Point]] = []
    cursor = 0.0
    for start, end in merged:
        if start - cursor > 0.05:
            segment = sub_polyline(points, cursor, start)
            if len(segment) >= 2:
                powered.append(segment)
        cursor = max(cursor, end)
    if total - cursor > 0.05:
        segment = sub_polyline(points, cursor, total)
        if len(segment) >= 2:
            powered.append(segment)
    return powered or [points]


def append_powered_polyline(lines: list[str],
                            points: list[Point],
                            power: int,
                            feed: float,
                            travel_feed: float | None) -> None:
    if len(points) < 2:
        return
    start = points[0]
    if travel_feed is not None and travel_feed > 0:
        lines.append(f"G1 X{fmt(start[0])} Y{fmt(start[1])} F{fmt(travel_feed)}")
    else:
        lines.append(f"G0 X{fmt(start[0])} Y{fmt(start[1])}")
    lines.append(f"S{power}")
    first = points[1]
    lines.append(f"G1 X{fmt(first[0])} Y{fmt(first[1])} F{fmt(feed)}")
    for point in points[2:]:
        lines.append(f"G1 X{fmt(point[0])} Y{fmt(point[1])}")
    lines.append("S0")


def toolpath_travel_distance(paths: Iterable[list[Point]],
                             start: Point = (0.0, 0.0)) -> float:
    current = (float(start[0]), float(start[1]))
    total = 0.0
    for path in paths:
        if len(path) < 2:
            continue
        total += converter.dist(current, path[0])
        current = path[-1]
    return total


def _toolpath_is_closed(path: list[Point], tolerance: float = 0.05) -> bool:
    return len(path) >= 4 and converter.dist(path[0], path[-1]) <= tolerance


def _orient_toolpath_near(path: list[Point],
                          current: Point,
                          preserve_start: bool = False) -> list[Point]:
    points = [(float(point[0]), float(point[1])) for point in path]
    if len(points) < 2:
        return points
    if preserve_start:
        return points
    if _toolpath_is_closed(points):
        ring = points[:-1]
        if not ring:
            return points
        start_index = min(range(len(ring)), key=lambda index: converter.dist(current, ring[index]))
        rotated = ring[start_index:] + ring[:start_index]
        return [*rotated, rotated[0]]
    if converter.dist(current, points[-1]) < converter.dist(current, points[0]):
        points.reverse()
    return points


def _nearest_toolpath_records(records: list[dict[str, Any]],
                              start: Point) -> tuple[list[dict[str, Any]], Point]:
    if not records:
        return [], start
    current = (float(start[0]), float(start[1]))
    remaining = [{**record, "path": list(record["path"])} for record in records]
    ordered: list[dict[str, Any]] = []

    if len(remaining) > 1200:
        centers = []
        for record in remaining:
            path = record["path"]
            centers.append((sum(point[0] for point in path) / len(path), sum(point[1] for point in path) / len(path)))
        row_count = max(1, int(math.sqrt(len(remaining))))
        min_y = min(center[1] for center in centers)
        max_y = max(center[1] for center in centers)
        row_height = max(0.5, (max_y - min_y) / row_count)
        indexed = list(zip(remaining, centers))
        indexed.sort(key=lambda item: (
            int((item[1][1] - min_y) / row_height),
            item[1][0] if int((item[1][1] - min_y) / row_height) % 2 == 0 else -item[1][0],
        ))
        remaining = [item[0] for item in indexed]
        for record in remaining:
            oriented = _orient_toolpath_near(record["path"], current, bool(record.get("preserveStart")))
            ordered.append({**record, "path": oriented})
            current = oriented[-1]
        return ordered, current

    while remaining:
        best_index = 0
        best_path = _orient_toolpath_near(
            remaining[0]["path"],
            current,
            bool(remaining[0].get("preserveStart")),
        )
        best_distance = converter.dist(current, best_path[0])
        for index in range(1, len(remaining)):
            oriented = _orient_toolpath_near(
                remaining[index]["path"],
                current,
                bool(remaining[index].get("preserveStart")),
            )
            distance = converter.dist(current, oriented[0])
            if distance < best_distance - 1e-9:
                best_index = index
                best_path = oriented
                best_distance = distance
        record = remaining.pop(best_index)
        ordered.append({**record, "path": best_path})
        current = best_path[-1]
    return ordered, current


def optimize_toolpath_records(records: list[dict[str, Any]],
                              start: Point = (0.0, 0.0),
                              inner_first: bool = False) -> list[dict[str, Any]]:
    valid = [record for record in records if len(record.get("path") or []) >= 2]
    if not valid:
        return []
    if not inner_first:
        return _nearest_toolpath_records(valid, start)[0]

    open_records = [record for record in valid if not _toolpath_is_closed(record["path"])]
    closed_records = [record for record in valid if _toolpath_is_closed(record["path"])]
    depth_groups: dict[int, list[dict[str, Any]]] = {}
    for record in closed_records:
        polygon = list(record["path"][:-1])
        probe = polygon[0]
        depth = sum(
            1
            for other in closed_records
            if other is not record and point_in_polygon(probe, list(other["path"][:-1]))
        )
        depth_groups.setdefault(depth, []).append(record)

    ordered: list[dict[str, Any]] = []
    current = start
    if open_records:
        group, current = _nearest_toolpath_records(open_records, current)
        ordered.extend(group)
    for depth in sorted(depth_groups, reverse=True):
        group, current = _nearest_toolpath_records(depth_groups[depth], current)
        ordered.extend(group)
    return ordered


def optimize_toolpaths(paths: list[list[Point]],
                       start: Point = (0.0, 0.0),
                       inner_first: bool = False) -> list[list[Point]]:
    records = [{"path": path, "sourceIndex": index} for index, path in enumerate(paths)]
    return [record["path"] for record in optimize_toolpath_records(records, start, inner_first)]


def open_pattern_image(path: Path):
    if Image is None or ImageOps is None:
        raise ValueError("PNG/JPG isleme icin Pillow kutuphanesi bulunamadi.")
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            return background.convert("L")
        return image.convert("L")


def parse_svg_length(value: str | None) -> float | None:
    if not value:
        return None
    match = re.match(r"\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)", value)
    if not match:
        return None
    return float(match.group(1))


def svg_viewbox_and_size(path: Path) -> tuple[tuple[float, float, float, float], float, float]:
    root = ET.parse(path).getroot()
    view_box = root.get("viewBox")
    if view_box:
        values = [float(item) for item in re.findall(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", view_box)]
        if len(values) == 4 and values[2] > 0 and values[3] > 0:
            return (values[0], values[1], values[2], values[3]), values[2], values[3]

    width = parse_svg_length(root.get("width")) or 100.0
    height = parse_svg_length(root.get("height")) or 100.0
    if width <= 0 or height <= 0:
        width, height = 100.0, 100.0
    return (0.0, 0.0, width, height), width, height


def clean_svg_for_editor(path: Path) -> tuple[Path, dict[str, Any]]:
    output = path.with_name(f"{path.stem}{SVG_CLEAN_SUFFIX}{path.suffix}")
    stats = clean_laser_svg.clean_file(
        path,
        output,
        flat=True,
        bed_width=None,
        gap=3.0,
        margin=0.0,
        inner_first=True,
    )
    stats.update(normalize_clean_svg_to_content(output))
    return output, stats


def svg_style_value(element: ET.Element, key: str) -> str | None:
    value = element.get(key)
    if value is not None:
        return value.strip()
    style = element.get("style") or ""
    for item in style.split(";"):
        if ":" not in item:
            continue
        style_key, style_value = item.split(":", 1)
        if style_key.strip().lower() == key:
            return style_value.strip()
    return None


def svg_color_luminance(value: str | None) -> float | None:
    if not value:
        return None
    text = value.strip().lower()
    if text in {"none", "transparent"}:
        return None
    named = {
        "white": (255, 255, 255),
        "black": (0, 0, 0),
    }
    if text in named:
        r, g, b = named[text]
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    if text.startswith("#"):
        raw = text[1:]
        if len(raw) == 3:
            raw = "".join(ch * 2 for ch in raw)
        if len(raw) == 6:
            try:
                r = int(raw[0:2], 16)
                g = int(raw[2:4], 16)
                b = int(raw[4:6], 16)
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
            except ValueError:
                return None
    match = re.match(r"rgba?\(([^)]+)\)", text)
    if match:
        parts = [part.strip() for part in match.group(1).split(",")[:3]]
        try:
            channels = []
            for part in parts:
                if part.endswith("%"):
                    channels.append(float(part[:-1]) * 2.55)
                else:
                    channels.append(float(part))
            if len(channels) == 3:
                r, g, b = channels
                return 0.2126 * r + 0.7152 * g + 0.0722 * b
        except ValueError:
            return None
    return None


def remove_light_fill_paths(root: ET.Element, paths: list[ET.Element]) -> dict[str, int]:
    removable: list[ET.Element] = []
    dark_or_stroked = 0
    for element in paths:
        fill = svg_style_value(element, "fill")
        stroke = svg_style_value(element, "stroke")
        luminance = svg_color_luminance(fill)
        has_stroke = bool(stroke and stroke.strip().lower() not in {"none", "transparent"})
        if luminance is not None and luminance >= 235 and not has_stroke:
            removable.append(element)
        else:
            dark_or_stroked += 1
    if not removable or dark_or_stroked <= 0:
        return {"removed_light_fill_path_count": 0}
    for element in removable:
        parent = clean_laser_svg.parent_map(root).get(element)
        if parent is not None:
            parent.remove(element)
    return {"removed_light_fill_path_count": len(removable)}


def remove_svg_style_keys(element: ET.Element, keys: set[str]) -> None:
    style = element.get("style")
    if not style:
        return
    kept: list[str] = []
    for item in style.split(";"):
        if ":" not in item:
            continue
        key, value = item.split(":", 1)
        if key.strip().lower() not in keys:
            kept.append(f"{key.strip()}:{value.strip()}")
    if kept:
        element.set("style", ";".join(kept))
    else:
        element.attrib.pop("style", None)


def svg_preview_data_url(path: Path, stroke: str = "#22c55e") -> str:
    tree = ET.parse(path)
    root = tree.getroot()
    for element in root.findall(f".//{{{SVG_NS}}}path"):
        remove_svg_style_keys(element, {"fill", "stroke", "stroke-width"})
        element.set("fill", "none")
        element.set("stroke", stroke)
        element.set("stroke-width", "1.6")
        element.set("vector-effect", "non-scaling-stroke")
    data = ET.tostring(root, encoding="utf-8")
    return f"data:image/svg+xml;base64,{base64.b64encode(data).decode('ascii')}"


def normalize_clean_svg_to_content(path: Path, margin: float = 0.0) -> dict[str, Any]:
    tree = ET.parse(path)
    root = tree.getroot()
    paths = list(root.findall(f".//{{{SVG_NS}}}path"))
    if not paths:
        raise ValueError("SVG temizlendi ama kullanilabilir path bulunamadi. Text/image tabanli SVG ise once path'e cevirin.")
    stats = remove_light_fill_paths(root, paths)
    paths = list(root.findall(f".//{{{SVG_NS}}}path"))
    boxes = [clean_laser_svg.path_bbox(element.get("d", "")) for element in paths if element.get("d")]
    if not boxes:
        raise ValueError("SVG temizlendi ama path olcusu okunamadi.")
    bbox = clean_laser_svg.union_bbox(boxes)
    width = max(0.001, bbox.width + 2 * margin)
    height = max(0.001, bbox.height + 2 * margin)
    dx = -bbox.min_x + margin
    dy = -bbox.min_y + margin
    for element in paths:
        element.set("d", clean_laser_svg.translate_path_data(element.get("d", ""), dx, dy))
        remove_svg_style_keys(element, {"fill", "stroke", "stroke-width"})
        element.set("fill", "none")
        element.set("stroke", "black")
        if element.get("stroke-width") is None and "stroke-width:" not in (element.get("style") or ""):
            element.set("stroke-width", "0.1")
        element.set("vector-effect", "non-scaling-stroke")
    root.set("viewBox", f"0 0 {fmt(width)} {fmt(height)}")
    root.set("width", f"{fmt(width)}mm")
    root.set("height", f"{fmt(height)}mm")
    tree.write(path, encoding="utf-8", xml_declaration=False)
    return {
        "normalized_width": width,
        "normalized_height": height,
        "normalized_min_x": bbox.min_x,
        "normalized_min_y": bbox.min_y,
        **stats,
    }


def image_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError(f"Gorsel bulunamadi: {path}")
    if path.suffix.lower() == ".svg":
        cleaned_path, stats = clean_svg_for_editor(path)
        view_box, width, height = svg_viewbox_and_size(cleaned_path)
        vector_paths, vector_stats = svg_file_to_vector_paths(
            cleaned_path,
            min_length=1.0,
            simplify=0.1,
            max_contours=2000,
            curve_steps=18,
            skip_light_fills=True,
            source_engine="svg",
        )
        if not vector_paths and int(vector_stats.get("skippedLightFill") or 0) > 0:
            retry_paths, retry_stats = svg_file_to_vector_paths(
                cleaned_path,
                min_length=1.0,
                simplify=0.1,
                max_contours=2000,
                curve_steps=18,
                skip_light_fills=False,
                source_engine="svg",
            )
            if retry_paths:
                vector_paths = retry_paths
                vector_stats = {
                    **retry_stats,
                    "lightFillFallback": True,
                    "skippedLightFillFirstPass": int(vector_stats.get("skippedLightFill") or 0),
                }
        mime = "image/svg+xml"
        data = base64.b64encode(cleaned_path.read_bytes()).decode("ascii")
        return {
            "kind": "svg",
            "path": str(cleaned_path),
            "originalPath": str(path),
            "name": cleaned_path.name,
            "mime": mime,
            "width": width,
            "height": height,
            "viewBox": view_box,
            "cleanStats": {key: str(value) if isinstance(value, Path) else value for key, value in stats.items()},
            "sourceWidth": width,
            "sourceHeight": height,
            "vectorPaths": vector_paths,
            "vectorStats": {"traceEngine": "svg", **vector_stats},
            "dataUrl": svg_preview_data_url(cleaned_path),
            "exportDataUrl": f"data:{mime};base64,{data}",
        }

    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    width = 0
    height = 0
    if Image is not None:
        with Image.open(path) as image:
            width, height = image.size
    return {
        "kind": "raster",
        "path": str(path),
        "name": path.name,
        "mime": mime,
        "width": width,
        "height": height,
        "dataUrl": f"data:{mime};base64,{data}",
    }


def raster_preview_payload(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise ValueError(f"Gorsel bulunamadi: {path}")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    width = 0
    height = 0
    if Image is not None:
        with Image.open(path) as image:
            width, height = image.size
    return {
        "path": str(path),
        "name": path.name,
        "mime": mime,
        "width": width,
        "height": height,
        "dataUrl": f"data:{mime};base64,{data}",
    }


def numpy_image_preview(name: str, image: Any, max_size: int = 420) -> dict[str, Any]:
    if Image is None:
        return {"name": name, "width": 0, "height": 0, "dataUrl": ""}
    array = np.asarray(image)
    if array.dtype != np.uint8:
        array = np.clip(array, 0, 255).astype(np.uint8)
    if array.ndim == 2:
        preview = Image.fromarray(array, mode="L")
    else:
        preview = Image.fromarray(array)
    source_width, source_height = preview.size
    scale = min(1.0, float(max_size) / max(1, max(source_width, source_height)))
    if scale < 1.0:
        resample = Image.Resampling.NEAREST if hasattr(Image, "Resampling") else Image.NEAREST
        preview = preview.resize((max(1, round(source_width * scale)), max(1, round(source_height * scale))), resample)
    buffer = io.BytesIO()
    preview.convert("RGB").save(buffer, format="PNG", optimize=True)
    return {
        "name": name,
        "width": source_width,
        "height": source_height,
        "dataUrl": f"data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode('ascii')}",
    }


def _odd_kernel(value: int, minimum: int = 1) -> int:
    value = max(minimum, int(value))
    return value if value % 2 == 1 else value + 1


def _polyline_length(points: list[list[float]] | list[Point]) -> float:
    if len(points) < 2:
        return 0.0
    total = 0.0
    for index in range(1, len(points)):
        ax, ay = points[index - 1]
        bx, by = points[index]
        total += math.hypot(float(bx) - float(ax), float(by) - float(ay))
    return total


def _polygon_area(points: list[list[float]] | list[Point]) -> float:
    if len(points) < 3:
        return 0.0
    total = 0.0
    for index, current in enumerate(points):
        next_point = points[(index + 1) % len(points)]
        total += float(current[0]) * float(next_point[1]) - float(next_point[0]) * float(current[1])
    return total / 2.0


def _points_bbox(points: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [float(point[0]) for point in points]
    ys = [float(point[1]) for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def _touch_count(min_x: float,
                 min_y: float,
                 max_x: float,
                 max_y: float,
                 width: float,
                 height: float,
                 margin: float) -> int:
    return sum(
        [
            min_x <= margin,
            min_y <= margin,
            max_x >= width - margin,
            max_y >= height - margin,
        ]
    )


def _dedupe_points(points: list[list[float]], closed: bool, min_distance: float = 0.35) -> list[list[float]]:
    if not points:
        return []
    cleaned = [points[0]]
    for point in points[1:]:
        if math.hypot(point[0] - cleaned[-1][0], point[1] - cleaned[-1][1]) >= min_distance:
            cleaned.append(point)
    if closed and len(cleaned) > 2 and math.hypot(cleaned[0][0] - cleaned[-1][0], cleaned[0][1] - cleaned[-1][1]) < min_distance:
        cleaned.pop()
    return cleaned


def _point_xy(point: Any) -> tuple[float, float]:
    return float(point[0]), float(point[1])


def _point_distance(a: Any, b: Any) -> float:
    ax, ay = _point_xy(a)
    bx, by = _point_xy(b)
    return math.hypot(ax - bx, ay - by)


def _angle_between_vectors(a: tuple[float, float], b: tuple[float, float]) -> float:
    an = math.hypot(a[0], a[1])
    bn = math.hypot(b[0], b[1])
    if an <= 1e-9 or bn <= 1e-9:
        return 180.0
    dot = (a[0] * b[0] + a[1] * b[1]) / (an * bn)
    dot = max(-1.0, min(1.0, dot))
    return math.degrees(math.acos(dot))


def _candidate_join(points_a: list[Any],
                    points_b: list[Any],
                    kind: str) -> tuple[list[Any], float, float]:
    if len(points_a) < 2 or len(points_b) < 2:
        return [], float("inf"), 180.0
    if kind == "end-start":
        gap = _point_distance(points_a[-1], points_b[0])
        ax0, ay0 = _point_xy(points_a[-2])
        ax1, ay1 = _point_xy(points_a[-1])
        bx0, by0 = _point_xy(points_b[0])
        bx1, by1 = _point_xy(points_b[1])
        angle = _angle_between_vectors((ax1 - ax0, ay1 - ay0), (bx1 - bx0, by1 - by0))
        return points_a + points_b[1:], gap, angle
    if kind == "end-end":
        gap = _point_distance(points_a[-1], points_b[-1])
        ax0, ay0 = _point_xy(points_a[-2])
        ax1, ay1 = _point_xy(points_a[-1])
        bx0, by0 = _point_xy(points_b[-1])
        bx1, by1 = _point_xy(points_b[-2])
        angle = _angle_between_vectors((ax1 - ax0, ay1 - ay0), (bx1 - bx0, by1 - by0))
        return points_a + list(reversed(points_b[:-1])), gap, angle
    if kind == "start-end":
        joined, gap, angle = _candidate_join(points_b, points_a, "end-start")
        return joined, gap, angle
    if kind == "start-start":
        gap = _point_distance(points_a[0], points_b[0])
        ax0, ay0 = _point_xy(points_a[1])
        ax1, ay1 = _point_xy(points_a[0])
        bx0, by0 = _point_xy(points_b[0])
        bx1, by1 = _point_xy(points_b[1])
        angle = _angle_between_vectors((ax1 - ax0, ay1 - ay0), (bx1 - bx0, by1 - by0))
        return list(reversed(points_a)) + points_b[1:], gap, angle
    return [], float("inf"), 180.0


def _join_kind_for_ends(end_a: str, end_b: str) -> str:
    if end_a == "end" and end_b == "start":
        return "end-start"
    if end_a == "end" and end_b == "end":
        return "end-end"
    if end_a == "start" and end_b == "end":
        return "start-end"
    return "start-start"


def stitch_point_paths_by_endpoint(paths: list[list[Any]],
                                   max_gap: float,
                                   max_angle: float = 65.0,
                                   max_passes: int = 48,
                                   per_endpoint_limit: int = 12) -> tuple[list[list[Any]], int]:
    max_gap = float(max_gap or 0)
    if max_gap <= 0:
        return paths, 0

    active = [list(path) for path in paths if len(path) >= 2]
    if len(active) < 2:
        return active, 0

    merged_count = 0
    gap_sq = max_gap * max_gap
    cell_size = max(1.0, max_gap)
    max_passes = max(1, int(max_passes))

    for _pass_index in range(max_passes):
        records: list[tuple[int, str, float, float, int]] = []
        grid: dict[tuple[int, int], list[int]] = {}
        for path_index, path in enumerate(active):
            for end_name, point in (("start", path[0]), ("end", path[-1])):
                x, y = _point_xy(point)
                record_index = len(records)
                records.append((path_index, end_name, x, y, record_index))
                cell = (int(math.floor(x / cell_size)), int(math.floor(y / cell_size)))
                grid.setdefault(cell, []).append(record_index)

        candidates: list[tuple[float, int, int, list[Any]]] = []
        for path_index, end_name, x, y, record_index in records:
            cell_x = int(math.floor(x / cell_size))
            cell_y = int(math.floor(y / cell_size))
            local_candidates: list[tuple[float, int, int, list[Any]]] = []
            for gy in range(cell_y - 1, cell_y + 2):
                for gx in range(cell_x - 1, cell_x + 2):
                    for other_record_index in grid.get((gx, gy), []):
                        if other_record_index <= record_index:
                            continue
                        other_path_index, other_end_name, ox, oy, _ = records[other_record_index]
                        if other_path_index == path_index:
                            continue
                        dx = x - ox
                        dy = y - oy
                        if dx * dx + dy * dy > gap_sq:
                            continue
                        kind = _join_kind_for_ends(end_name, other_end_name)
                        joined, gap, angle = _candidate_join(active[path_index], active[other_path_index], kind)
                        if gap > max_gap or angle > max_angle:
                            continue
                        score = gap + (angle / max(1.0, max_angle)) * max(1.0, max_gap)
                        local_candidates.append((score, path_index, other_path_index, joined))
            if local_candidates:
                local_candidates.sort(key=lambda item: item[0])
                candidates.extend(local_candidates[:max(1, int(per_endpoint_limit))])

        if not candidates:
            break

        candidates.sort(key=lambda item: item[0])
        used: set[int] = set()
        next_paths: list[list[Any]] = []
        pass_merges = 0
        for _score, path_a, path_b, joined in candidates:
            if path_a in used or path_b in used:
                continue
            next_paths.append(joined)
            used.add(path_a)
            used.add(path_b)
            pass_merges += 1

        if pass_merges == 0:
            break

        for index, path in enumerate(active):
            if index not in used:
                next_paths.append(path)
        active = next_paths
        merged_count += pass_merges

    return active, merged_count


def _simplify_points(points: list[list[float]], epsilon: float, closed: bool) -> list[list[float]]:
    if cv2 is None or np is None or len(points) < 3 or epsilon <= 0:
        return points
    contour = np.array(points, dtype=np.float32).reshape((-1, 1, 2))
    approx = cv2.approxPolyDP(contour, float(epsilon), closed)
    return [[float(x), float(y)] for x, y in approx.reshape(-1, 2)]


def scaled_vector_paths(vector_paths: list[dict[str, Any]], factor: float) -> list[dict[str, Any]]:
    factor = float(factor)
    if abs(factor - 1.0) <= 1e-9:
        return vector_paths
    scaled: list[dict[str, Any]] = []
    for item in vector_paths:
        points = [[float(point[0]) * factor, float(point[1]) * factor] for point in item.get("points", [])]
        closed = bool(item.get("closed", True))
        updated = {**item, "points": points}
        updated["length"] = _polyline_length(points + ([points[0]] if closed and points else []))
        updated["area"] = abs(_polygon_area(points)) if closed and len(points) >= 3 else 0.0
        scaled.append(updated)
    return scaled


def clean_border_components(binary: Any, enabled: bool, margin: int = 3) -> tuple[Any, int]:
    if not enabled:
        return binary, 0
    height, width = binary.shape[:2]
    margin = max(1, int(margin))
    cleaned = binary.copy()
    cleaned[:margin, :] = 0
    cleaned[-margin:, :] = 0
    cleaned[:, :margin] = 0
    cleaned[:, -margin:] = 0

    count, labels, stats, _centroids = cv2.connectedComponentsWithStats((cleaned > 0).astype(np.uint8), 8)
    removed = 0
    total_area = max(1, width * height)
    for label in range(1, count):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        min_x, min_y, max_x, max_y = x, y, x + w, y + h
        touches = _touch_count(min_x, min_y, max_x, max_y, width, height, margin + 2)
        local = labels[y:y + h, x:x + w] == label
        edge_band = min(max(2, margin + 1), max(2, min(w, h) // 3))
        local_edge = np.zeros_like(local, dtype=bool)
        local_edge[:edge_band, :] = True
        local_edge[-edge_band:, :] = True
        local_edge[:, :edge_band] = True
        local_edge[:, -edge_band:] = True
        edge_ratio = float(np.count_nonzero(local & local_edge)) / max(1, area)
        bbox_area = max(1, w * h)
        fill_ratio = float(area) / float(bbox_area)
        frame_like = (
            w >= width * 0.78
            and h >= height * 0.78
            and edge_ratio >= 0.55
            and area <= total_area * 0.18
        )
        full_frame = w >= width * 0.94 and h >= height * 0.94 and area >= total_area * 0.015
        border_strip = touches >= 3 and (w >= width * 0.80 or h >= height * 0.80) and area >= total_area * 0.015
        huge_border = (
            touches >= 3
            and edge_ratio >= 0.45
            and fill_ratio <= 0.22
            and area >= total_area * 0.04
        )
        if frame_like or full_frame or border_strip or huge_border:
            cleaned[labels == label] = 0
            removed += 1
    return cleaned, removed


def filter_vector_paths(vector_paths: list[dict[str, Any]],
                        source_width: float,
                        source_height: float,
                        remove_border: bool,
                        min_length: float,
                        mode: str) -> tuple[list[dict[str, Any]], dict[str, int]]:
    result: list[dict[str, Any]] = []
    removed_border = 0
    removed_short = 0
    margin = max(2.0, min(source_width, source_height) * 0.012)
    for item in vector_paths:
        points = item.get("points", [])
        warnings: list[str] = list(item.get("warnings") or [])
        if len(points) < 2:
            removed_short += 1
            item["removed"] = True
            item["removedReason"] = "too-short"
            item["length"] = 0.0
            item["bbox"] = None
            item["touchesBorder"] = False
            item["mode"] = mode
            item["operation"] = "engrave" if mode in ("centerline", "vtracer", "potrace") else "cut"
            warnings.append("too-short")
            item["warnings"] = list(dict.fromkeys(warnings))
            item["confidence"] = 0.25
            result.append(item)
            continue
        min_x, min_y, max_x, max_y = _points_bbox(points)
        width = max_x - min_x
        height = max_y - min_y
        touches = _touch_count(min_x, min_y, max_x, max_y, source_width, source_height, margin)
        full_frame = width >= source_width * 0.88 and height >= source_height * 0.88
        border_strip = touches >= 2 and (width >= source_width * 0.70 or height >= source_height * 0.70)
        near_edge_x = source_width * 0.075
        near_edge_y = source_height * 0.075
        horizontal_frame_side = (
            width >= source_width * 0.72
            and height <= max(4.0, source_height * 0.045)
            and (min_y <= near_edge_y or max_y >= source_height - near_edge_y)
        )
        vertical_frame_side = (
            height >= source_height * 0.72
            and width <= max(4.0, source_width * 0.045)
            and (min_x <= near_edge_x or max_x >= source_width - near_edge_x)
        )
        auto_removed = bool(item.get("removed"))
        if remove_border and (full_frame or border_strip or horizontal_frame_side or vertical_frame_side):
            removed_border += 1
            auto_removed = True
            item["removedReason"] = "border-frame"
            warnings.append("border-frame")
        closed_length = _polyline_length(points + ([points[0]] if item.get("closed", True) else []))
        length = float(item.get("length") or closed_length)
        if mode in ("centerline", "potrace") and length < min_length:
            removed_short += 1
            auto_removed = True
            item["removedReason"] = "too-short"
            warnings.append("too-short")
        if touches > 0:
            warnings.append("touches-border")
        if item.get("closed", True) is False and mode == "outline":
            warnings.append("open-outline")
        item["removed"] = auto_removed
        item["length"] = length
        item["bbox"] = [float(min_x), float(min_y), float(max_x), float(max_y)]
        item["touchesBorder"] = touches > 0
        item["mode"] = mode
        item["operation"] = "engrave" if mode in ("centerline", "vtracer", "potrace") else "cut"
        item["warnings"] = list(dict.fromkeys(warnings))
        item["confidence"] = max(0.25, 1.0 - 0.18 * len(warnings))
        result.append(item)
    for index, item in enumerate(result, 1):
        item["id"] = f"v{index}"
    return result, {"removedBorder": removed_border, "removedShortPost": removed_short}


def stitch_open_vector_paths(vector_paths: list[dict[str, Any]],
                             max_gap: float,
                             max_angle: float = 65.0) -> tuple[list[dict[str, Any]], int]:
    max_gap = float(max_gap or 0)
    if max_gap <= 0:
        return vector_paths, 0
    paths = [
        {**item, "points": [[float(point[0]), float(point[1])] for point in item.get("points", [])]}
        for item in vector_paths
        if len(item.get("points", [])) >= 2
    ]
    open_paths = [item for item in paths if not item.get("closed")]
    closed_paths = [item for item in paths if item.get("closed")]
    stitched_points, merged_count = stitch_point_paths_by_endpoint(
        [item["points"] for item in open_paths],
        max_gap=max_gap,
        max_angle=max_angle,
        max_passes=32,
        per_endpoint_limit=10,
    )
    paths = closed_paths + [
        {**(open_paths[min(index, len(open_paths) - 1)] if open_paths else {}), "points": _dedupe_points(points, closed=False, min_distance=0.25)}
        for index, points in enumerate(stitched_points)
    ]
    for item in paths:
        item["length"] = _polyline_length(item.get("points", []))

    for item in paths:
        if not item.get("closed") and _point_distance(item["points"][0], item["points"][-1]) <= max_gap:
            item["closed"] = True
            merged_count += 1
    for index, item in enumerate(paths, 1):
        item["id"] = f"v{index}"
    return paths, merged_count


def weld_open_endpoints(vector_paths: list[dict[str, Any]],
                        tolerance: float) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Birbirine cok yakin ACIK yol uclarini ortak noktaya kaynat.

    Iskelet izleyici her kavsakta ayri acik yollar uretir; son islemler uclari
    birkac piksel oynatinca gorunur bosluk kalir. Bu adim tolerans icindeki
    uclari kumeleyip ortak merkeze SNAP eder: bosluk kapanir, kavsak AutoCAD
    gibi tam ust uste gelir. Yol BIRLESTIRMEZ; yalnizca mevcut uclari kaydirir,
    bu yuzden asla yeni/hayalet cizgi segmenti uretemez (lazer cikti guvenligi).
    """
    tolerance = max(0.0, float(tolerance))
    if tolerance <= 0:
        return vector_paths, {"weldedEndpoints": 0}
    points = [[list(map(float, pt)) for pt in item.get("points", [])] for item in vector_paths]
    closed = [bool(item.get("closed")) for item in vector_paths]

    ends = []
    for index, pts in enumerate(points):
        if closed[index] or len(pts) < 2:
            continue
        ends.append((index, 0))
        ends.append((index, 1))
    if len(ends) < 2:
        return vector_paths, {"weldedEndpoints": 0}

    def coord(entry):
        index, which = entry
        return points[index][0] if which == 0 else points[index][-1]

    parent = list(range(len(ends)))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    tol2 = tolerance * tolerance
    for a in range(len(ends)):
        ax, ay = coord(ends[a])
        for b in range(a + 1, len(ends)):
            bx, by = coord(ends[b])
            if (ax - bx) ** 2 + (ay - by) ** 2 <= tol2:
                ra, rb = find(a), find(b)
                if ra != rb:
                    parent[ra] = rb

    clusters: dict[int, list[int]] = {}
    for a in range(len(ends)):
        clusters.setdefault(find(a), []).append(a)

    welded = 0
    for members in clusters.values():
        if len(members) < 2:
            continue
        cx = sum(coord(ends[m])[0] for m in members) / len(members)
        cy = sum(coord(ends[m])[1] for m in members) / len(members)
        for m in members:
            index, which = ends[m]
            if which == 0:
                points[index][0] = [cx, cy]
            else:
                points[index][-1] = [cx, cy]
            welded += 1

    if not welded:
        return vector_paths, {"weldedEndpoints": 0}
    result_paths = []
    for index, item in enumerate(vector_paths):
        new_item = dict(item)
        new_item["points"] = points[index]
        result_paths.append(new_item)
    return result_paths, {"weldedEndpoints": welded}


def merge_coincident_open_paths(vector_paths: list[dict[str, Any]],
                                tolerance: float,
                                max_angle: float = 55.0) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Kavsakta CAKISAN acik yol parcalarini tek surekli cizgiye birlestir.

    Iskelet izleyici bir dogrusal cizgiyi her derece-2 gecis noktasinda ayri
    parcalara boluyor; weld/snap uclari ust uste getirse de parcalar ayri yol
    olarak kaliyor (editorde "kirik" gorunum, gereksiz kalem-kaldir/indir).

    Bu adim SADECE su cok dar kosulu saglayan uc ciftlerini birlestirir:
      * iki uc birbirine `tolerance` icinde CAKISIR (weld sonrasi ~0 px),
      * her iki ucun da o noktada TEK ortagi vardir (derece-2 gecis; gercek
        Y/T dallanmalari 3+ uc oldugu icin haric tutulur -> korunur),
      * disari bakan tegetler yaklasik zit yonludur (dogrusal devam;
        keskin geri-donen mahmuzlar `max_angle` ile elenir).

    Cakisan uclar ayni noktada oldugundan birlestirme YENI segment URETMEZ:
    `a + b[1:]` yinelenen ortak noktayi atar. Cikti geometrisi -> toolpath
    birebir ayni; yalnizca parca sayisi azalir. Bu yuzden hatali/hayalet
    kesim uretmesi yapisal olarak imkansizdir.
    """
    tolerance = max(0.0, float(tolerance))
    if tolerance <= 0:
        return vector_paths, {"mergedOpenPaths": 0}
    tol2 = tolerance * tolerance

    open_slot: list[int] = []
    pts_list: list[list[list[float]]] = []
    for slot, item in enumerate(vector_paths):
        pts = [[float(pt[0]), float(pt[1])] for pt in item.get("points", [])]
        if item.get("removed") or item.get("closed") or len(pts) < 2:
            continue
        open_slot.append(slot)
        pts_list.append(pts)
    m = len(pts_list)
    if m < 2:
        return vector_paths, {"mergedOpenPaths": 0}

    def endpoint(k: int, which: int) -> list[float]:
        return pts_list[k][0] if which == 0 else pts_list[k][-1]

    cell = max(2.0, tolerance * 2.0)
    grid: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for k in range(m):
        for which in (0, 1):
            x, y = endpoint(k, which)
            grid.setdefault((int(math.floor(x / cell)), int(math.floor(y / cell))), []).append((k, which))

    def neighbors(k: int, which: int) -> list[tuple[int, int]]:
        x, y = endpoint(k, which)
        cx = int(math.floor(x / cell))
        cy = int(math.floor(y / cell))
        found: list[tuple[int, int]] = []
        for gy in range(cy - 1, cy + 2):
            for gx in range(cx - 1, cx + 2):
                for (kk, ww) in grid.get((gx, gy), ()):  # type: ignore[union-attr]
                    if kk == k:
                        continue
                    ox, oy = endpoint(kk, ww)
                    if (x - ox) ** 2 + (y - oy) ** 2 <= tol2:
                        found.append((kk, ww))
        return found

    def outward_tangent(points: list[list[float]], which: int) -> tuple[float, float]:
        if which == 0:
            base = points[0]
            seq = points[1:]
        else:
            base = points[-1]
            seq = list(reversed(points[:-1]))
        for cand in seq:
            dx = base[0] - cand[0]
            dy = base[1] - cand[1]
            if dx * dx + dy * dy >= 1.0:
                length = math.hypot(dx, dy)
                return dx / length, dy / length
        cand = seq[0]
        dx = base[0] - cand[0]
        dy = base[1] - cand[1]
        length = math.hypot(dx, dy) or 1.0
        return dx / length, dy / length

    cos_limit = math.cos(math.radians(max_angle))
    match: dict[tuple[int, int], tuple[int, int]] = {}
    for k in range(m):
        for which in (0, 1):
            nb = neighbors(k, which)
            if len(nb) != 1:
                continue  # not a clean degree-2 meeting
            k2, w2 = nb[0]
            nb2 = neighbors(k2, w2)
            if len(nb2) != 1 or nb2[0] != (k, which):
                continue  # partner must be mutual and unique
            t1 = outward_tangent(pts_list[k], which)
            t2 = outward_tangent(pts_list[k2], w2)
            # outward tangents point AWAY from the shared point; a straight
            # continuation makes them nearly opposite (dot ~ -1).
            if -(t1[0] * t2[0] + t1[1] * t2[1]) >= cos_limit:
                match[(k, which)] = (k2, w2)

    if not match:
        return vector_paths, {"mergedOpenPaths": 0}

    visited = [False] * m

    def walk(enter_k: int, enter_w: int) -> list[tuple[int, bool]]:
        chain: list[tuple[int, bool]] = []
        k, w = enter_k, enter_w
        while not visited[k]:
            visited[k] = True
            chain.append((k, w == 1))  # flip when we enter at the tail
            nxt = match.get((k, 1 - w))
            if nxt is None:
                break
            k2, w2 = nxt
            if visited[k2]:
                break
            k, w = k2, w2
        return chain

    groups: list[list[tuple[int, bool]]] = []
    for k in range(m):
        for w in (0, 1):
            if (k, w) not in match and not visited[k]:
                groups.append(walk(k, w))
    for k in range(m):  # any remaining pure cycles
        if not visited[k]:
            groups.append(walk(k, 0))

    combined_by_slot: dict[int, list[list[float]]] = {}
    removed_slots: set[int] = set()
    merged = 0
    for group in groups:
        if len(group) < 2:
            continue
        combined: list[list[float]] = []
        for (k, flip) in group:
            seq = list(reversed(pts_list[k])) if flip else list(pts_list[k])
            if combined:
                lx, ly = combined[-1]
                if (lx - seq[0][0]) ** 2 + (ly - seq[0][1]) ** 2 <= tol2:
                    seq = seq[1:]
            combined.extend(seq)
        head_slot = open_slot[group[0][0]]
        combined_by_slot[head_slot] = combined
        for (k, _flip) in group[1:]:
            removed_slots.add(open_slot[k])
        merged += len(group) - 1

    if merged == 0:
        return vector_paths, {"mergedOpenPaths": 0}

    result_paths: list[dict[str, Any]] = []
    for slot, item in enumerate(vector_paths):
        if slot in removed_slots:
            continue
        new_item = dict(item)
        if slot in combined_by_slot:
            new_item["points"] = combined_by_slot[slot]
        result_paths.append(new_item)
    return result_paths, {"mergedOpenPaths": merged}


def snap_open_vector_endpoints_to_paths(vector_paths: list[dict[str, Any]],
                                        max_gap: float,
                                        max_angle: float = 70.0,
                                        min_path_length: float = 0.0) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Close tiny endpoint-to-path gaps while preserving separate nearby art.

    Skeleton junctions are represented as separate open paths. Smoothing and
    coordinate rescaling can leave their shared endpoint a fraction of a pixel
    away from the adjoining path. Only endpoints whose outward tangent points
    naturally toward a nearby segment are snapped.
    """
    max_gap = max(0.0, float(max_gap or 0.0))
    min_path_length = max(0.0, float(min_path_length or 0.0))
    if max_gap <= 0:
        return vector_paths, {
            "snappedCenterlineEndpoints": 0,
            "maxSnappedEndpointGap": 0.0,
            "skippedMicroDetailSnaps": 0,
        }

    paths = [
        {
            **item,
            "points": [[float(point[0]), float(point[1])] for point in item.get("points", [])],
        }
        for item in vector_paths
    ]
    cell_size = max(4.0, max_gap * 3.0)
    segment_records: list[tuple[int, list[float], list[float]]] = []
    segment_grid: dict[tuple[int, int], set[int]] = {}

    for path_index, item in enumerate(paths):
        points = item.get("points", [])
        if item.get("removed") or len(points) < 2:
            continue
        segment_pairs = list(zip(points, points[1:]))
        if item.get("closed") and len(points) >= 3:
            segment_pairs.append((points[-1], points[0]))
        for start, end in segment_pairs:
            record_index = len(segment_records)
            segment_records.append((path_index, start, end))
            length = _point_distance(start, end)
            sample_count = max(1, int(math.ceil(length / max(1.0, cell_size * 0.70))))
            for sample_index in range(sample_count + 1):
                ratio = sample_index / sample_count
                x = float(start[0]) + (float(end[0]) - float(start[0])) * ratio
                y = float(start[1]) + (float(end[1]) - float(start[1])) * ratio
                cell = (int(math.floor(x / cell_size)), int(math.floor(y / cell_size)))
                segment_grid.setdefault(cell, set()).add(record_index)

    def closest_point(point: list[float], start: list[float], end: list[float]) -> tuple[list[float], float]:
        px, py = _point_xy(point)
        ax, ay = _point_xy(start)
        bx, by = _point_xy(end)
        dx = bx - ax
        dy = by - ay
        denominator = dx * dx + dy * dy
        if denominator <= 1e-12:
            target = [ax, ay]
        else:
            ratio = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denominator))
            target = [ax + dx * ratio, ay + dy * ratio]
        return target, _point_distance(point, target)

    def outward_tangent(points: list[list[float]], at_start: bool) -> tuple[float, float]:
        endpoint = points[0] if at_start else points[-1]
        candidates = points[1:] if at_start else list(reversed(points[:-1]))
        for candidate in candidates:
            if _point_distance(endpoint, candidate) >= 1.0:
                return float(endpoint[0]) - float(candidate[0]), float(endpoint[1]) - float(candidate[1])
        candidate = candidates[0]
        return float(endpoint[0]) - float(candidate[0]), float(endpoint[1]) - float(candidate[1])

    updates: dict[tuple[int, int], tuple[list[float], float]] = {}
    skipped_micro_details = 0
    for path_index, item in enumerate(paths):
        points = item.get("points", [])
        if item.get("removed") or item.get("closed") or len(points) < 2:
            continue
        path_length = float(item.get("length") or _polyline_length(points))
        if min_path_length > 0 and path_length < min_path_length:
            skipped_micro_details += 1
            continue
        for at_start, endpoint_index in ((True, 0), (False, len(points) - 1)):
            endpoint = points[endpoint_index]
            tangent = outward_tangent(points, at_start)
            cell_x = int(math.floor(float(endpoint[0]) / cell_size))
            cell_y = int(math.floor(float(endpoint[1]) / cell_size))
            candidate_records: set[int] = set()
            for grid_y in range(cell_y - 1, cell_y + 2):
                for grid_x in range(cell_x - 1, cell_x + 2):
                    candidate_records.update(segment_grid.get((grid_x, grid_y), set()))

            nearest: tuple[float, list[float]] | None = None
            for record_index in candidate_records:
                target_path_index, start, end = segment_records[record_index]
                if target_path_index == path_index:
                    continue
                target, gap = closest_point(endpoint, start, end)
                if nearest is None or gap < nearest[0]:
                    nearest = (gap, target)
            if nearest is None or nearest[0] <= 0.30 or nearest[0] > max_gap:
                continue
            gap_vector = (
                nearest[1][0] - float(endpoint[0]),
                nearest[1][1] - float(endpoint[1]),
            )
            if _angle_between_vectors(tangent, gap_vector) <= float(max_angle):
                updates[(path_index, endpoint_index)] = (nearest[1], nearest[0])

    snapped = 0
    max_snapped_gap = 0.0
    changed_paths: set[int] = set()
    for (path_index, endpoint_index), (target, gap) in updates.items():
        paths[path_index]["points"][endpoint_index] = [round(float(target[0]), 4), round(float(target[1]), 4)]
        snapped += 1
        max_snapped_gap = max(max_snapped_gap, float(gap))
        changed_paths.add(path_index)
    for path_index in changed_paths:
        item = paths[path_index]
        points = item.get("points", [])
        item["length"] = _polyline_length(points + ([points[0]] if item.get("closed") and points else []))
        warnings = list(item.get("warnings") or [])
        warnings.append("endpoint-snapped")
        item["warnings"] = list(dict.fromkeys(warnings))

    return paths, {
        "snappedCenterlineEndpoints": snapped,
        "maxSnappedEndpointGap": round(max_snapped_gap, 4),
        "endpointSnapTolerance": round(max_gap, 4),
        "skippedMicroDetailSnaps": skipped_micro_details,
    }


def _shared_open_endpoint_anchor_indices(vector_paths: list[dict[str, Any]],
                                         tolerance: float = 1e-6) -> set[tuple[int, int]]:
    """Find endpoints that already represent the same traced graph node.

    Only endpoint equality is considered. Proximity alone never creates a new
    connection between otherwise separate details.
    """
    tolerance = max(1e-9, float(tolerance))
    cell_size = tolerance * 2.0
    endpoint_grid: dict[tuple[int, int], list[tuple[int, int, list[float]]]] = {}
    anchors: set[tuple[int, int]] = set()

    for path_index, item in enumerate(vector_paths):
        points = item.get("points") or []
        if item.get("removed") or item.get("closed") or len(points) < 2:
            continue
        for endpoint_side, point in ((0, points[0]), (1, points[-1])):
            current = [float(point[0]), float(point[1])]
            cell_x = math.floor(current[0] / cell_size)
            cell_y = math.floor(current[1] / cell_size)
            matches: list[tuple[int, int]] = []
            for offset_x in (-1, 0, 1):
                for offset_y in (-1, 0, 1):
                    for other_index, other_side, other_point in endpoint_grid.get(
                        (cell_x + offset_x, cell_y + offset_y), []
                    ):
                        if math.dist(current, other_point) <= tolerance:
                            matches.append((other_index, other_side))
            if matches:
                anchors.add((path_index, endpoint_side))
                anchors.update(matches)
            endpoint_grid.setdefault((cell_x, cell_y), []).append(
                (path_index, endpoint_side, current)
            )

    return anchors


def straighten_centerline_paths(vector_paths: list[dict[str, Any]],
                                stroke_width: float,
                                source_width: float,
                                source_height: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Collapse long nearly-straight centerline traces into clean line segments.

    Photos of technical drawings often carry sub-pixel paper/shadow wobble into
    the skeleton. This keeps curves intact and only snaps paths whose fitted line
    error is small compared with their span.
    """
    if np is None:
        return vector_paths, {
            "straightenedCenterlinePaths": 0,
            "straightenedCenterlinePointsRemoved": 0,
            "preservedStraightenedJunctionAnchors": 0,
        }
    straightened = 0
    points_removed = 0
    preserved_junction_anchors = 0
    min_span = max(28.0, min(float(source_width), float(source_height)) * 0.045)
    base_deviation = max(1.6, min(4.0, float(stroke_width or 0.0) * 1.6))
    shared_anchors = _shared_open_endpoint_anchor_indices(vector_paths)

    result: list[dict[str, Any]] = []
    for path_index, item in enumerate(vector_paths):
        points = [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        if item.get("closed") or len(points) < 5:
            result.append(item)
            continue
        length = _polyline_length(points)
        if length < min_span:
            result.append(item)
            continue

        coords = np.array(points, dtype=float)
        centroid = coords.mean(axis=0)
        centered = coords - centroid
        try:
            values, vectors = np.linalg.eigh(centered.T @ centered)
        except Exception:
            result.append(item)
            continue
        direction = vectors[:, int(np.argmax(values))]
        norm = float(np.linalg.norm(direction))
        if norm <= 1e-9:
            result.append(item)
            continue
        direction = direction / norm
        projections = centered @ direction
        span = float(projections.max() - projections.min())
        if span < min_span or span / max(length, 1e-9) < 0.90:
            result.append(item)
            continue
        perpendicular = centered - projections[:, None] * direction
        distances = np.linalg.norm(perpendicular, axis=1)
        max_allowed_deviation = max(base_deviation, min(5.0, span * 0.014))
        if float(np.percentile(distances, 95)) > max_allowed_deviation or float(distances.max()) > max_allowed_deviation * 1.75:
            result.append(item)
            continue

        start_projection = float(projections.min())
        end_projection = float(projections.max())
        start = centroid + direction * start_projection
        end = centroid + direction * end_projection
        if projections[0] > projections[-1]:
            start, end = end, start

        min_x, min_y, max_x, max_y = _points_bbox(points)
        if abs(float(direction[1])) <= math.sin(math.radians(5.0)):
            y = float(np.median(coords[:, 1]))
            start = np.array([min_x, y], dtype=float)
            end = np.array([max_x, y], dtype=float)
            if points[0][0] > points[-1][0]:
                start, end = end, start
        elif abs(float(direction[0])) <= math.sin(math.radians(5.0)):
            x = float(np.median(coords[:, 0]))
            start = np.array([x, min_y], dtype=float)
            end = np.array([x, max_y], dtype=float)
            if points[0][1] > points[-1][1]:
                start, end = end, start

        new_points = [
            [round(float(start[0]), 3), round(float(start[1]), 3)],
            [round(float(end[0]), 3), round(float(end[1]), 3)],
        ]
        if (path_index, 0) in shared_anchors:
            new_points[0] = [float(points[0][0]), float(points[0][1])]
            preserved_junction_anchors += 1
        if (path_index, 1) in shared_anchors:
            new_points[-1] = [float(points[-1][0]), float(points[-1][1])]
            preserved_junction_anchors += 1
        updated = {**item, "points": new_points, "closed": False}
        updated["length"] = _polyline_length(new_points)
        warnings = list(updated.get("warnings") or [])
        warnings.append("straightened")
        updated["warnings"] = list(dict.fromkeys(warnings))
        result.append(updated)
        straightened += 1
        points_removed += max(0, len(points) - len(new_points))

    return result, {
        "straightenedCenterlinePaths": straightened,
        "straightenedCenterlinePointsRemoved": points_removed,
        "preservedStraightenedJunctionAnchors": preserved_junction_anchors,
    }


def flatten_axis_aligned_centerline_runs(vector_paths: list[dict[str, Any]],
                                         stroke_width: float,
                                         source_width: float,
                                         source_height: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    min_span = max(28.0, min(float(source_width), float(source_height)) * 0.045)
    band_limit = max(2.0, min(5.0, float(stroke_width or 0.0) * 2.0))
    runs_flattened = 0
    points_adjusted = 0
    preserved_junction_anchors = 0
    shared_anchors = _shared_open_endpoint_anchor_indices(vector_paths)
    result: list[dict[str, Any]] = []

    for path_index, item in enumerate(vector_paths):
        points = [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        if len(points) < 4:
            result.append(item)
            continue

        segment_kinds: list[str | None] = []
        for start, end in zip(points, points[1:]):
            dx = float(end[0]) - float(start[0])
            dy = float(end[1]) - float(start[1])
            length = math.hypot(dx, dy)
            if length <= 1e-9:
                segment_kinds.append(None)
            elif abs(dy) <= max(band_limit, abs(dx) * 0.12) and abs(dx) >= abs(dy):
                segment_kinds.append("h")
            elif abs(dx) <= max(band_limit, abs(dy) * 0.12) and abs(dy) >= abs(dx):
                segment_kinds.append("v")
            else:
                segment_kinds.append(None)

        updated_points = [point[:] for point in points]
        index = 0
        changed = False
        while index < len(segment_kinds):
            kind = segment_kinds[index]
            if kind is None:
                index += 1
                continue
            start_index = index
            while index + 1 < len(segment_kinds) and segment_kinds[index + 1] == kind:
                index += 1
            end_index = index + 1
            run_points = points[start_index : end_index + 1]
            min_x, min_y, max_x, max_y = _points_bbox(run_points)
            width = max_x - min_x
            height = max_y - min_y
            if kind == "h" and width >= min_span and height <= band_limit:
                y = sorted(point[1] for point in run_points)[len(run_points) // 2]
                for point_index in range(start_index, end_index + 1):
                    endpoint_side = 0 if point_index == 0 else 1 if point_index == len(points) - 1 else None
                    if endpoint_side is not None and (path_index, endpoint_side) in shared_anchors:
                        preserved_junction_anchors += 1
                        continue
                    if abs(updated_points[point_index][1] - y) > 0.05:
                        points_adjusted += 1
                    updated_points[point_index][1] = y
                runs_flattened += 1
                changed = True
            elif kind == "v" and height >= min_span and width <= band_limit:
                x = sorted(point[0] for point in run_points)[len(run_points) // 2]
                for point_index in range(start_index, end_index + 1):
                    endpoint_side = 0 if point_index == 0 else 1 if point_index == len(points) - 1 else None
                    if endpoint_side is not None and (path_index, endpoint_side) in shared_anchors:
                        preserved_junction_anchors += 1
                        continue
                    if abs(updated_points[point_index][0] - x) > 0.05:
                        points_adjusted += 1
                    updated_points[point_index][0] = x
                runs_flattened += 1
                changed = True
            index += 1

        if changed:
            updated = {**item, "points": [[round(point[0], 3), round(point[1], 3)] for point in updated_points]}
            updated["length"] = _polyline_length(updated["points"] + ([updated["points"][0]] if updated.get("closed") else []))
            warnings = list(updated.get("warnings") or [])
            warnings.append("axis-straightened")
            updated["warnings"] = list(dict.fromkeys(warnings))
            result.append(updated)
        else:
            result.append(item)

    return result, {
        "axisStraightenedCenterlineRuns": runs_flattened,
        "axisStraightenedCenterlinePoints": points_adjusted,
        "preservedAxisJunctionAnchors": preserved_junction_anchors,
    }


def _laplacian_smooth_points(points: list[list[float]],
                             closed: bool,
                             rounds: int,
                             weight: float) -> list[list[float]]:
    if len(points) < 4 or rounds <= 0:
        return [[float(point[0]), float(point[1])] for point in points]
    smoothed = [[float(point[0]), float(point[1])] for point in points]
    weight = max(0.0, min(0.85, float(weight)))
    for _ in range(max(0, int(rounds))):
        current = [point[:] for point in smoothed]
        indices = range(len(current)) if closed else range(1, len(current) - 1)
        for index in indices:
            prev_point = current[(index - 1) % len(current)]
            point = current[index]
            next_point = current[(index + 1) % len(current)]
            smoothed[index] = [
                point[0] * (1.0 - weight) + (prev_point[0] + next_point[0]) * 0.5 * weight,
                point[1] * (1.0 - weight) + (prev_point[1] + next_point[1]) * 0.5 * weight,
            ]
    return smoothed


def polish_centerline_curves(vector_paths: list[dict[str, Any]],
                             stroke_width: float,
                             source_width: float,
                             source_height: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    min_length = max(22.0, min(float(source_width), float(source_height)) * 0.035)
    epsilon = max(0.75, min(1.15, float(stroke_width or 0.0) * 0.55))
    polished = 0
    points_removed = 0
    result: list[dict[str, Any]] = []

    for item in vector_paths:
        warnings = list(item.get("warnings") or [])
        points = [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        if (
            item.get("removed")
            or "axis-straightened" in warnings
            or "straightened" in warnings
            or len(points) < 5
            or float(item.get("length") or _polyline_length(points)) < min_length
        ):
            result.append(item)
            continue
        closed = bool(item.get("closed"))
        smoothed = _laplacian_smooth_points(points, closed=closed, rounds=3, weight=0.55)
        smoothed = _simplify_points(smoothed, epsilon, closed)
        smoothed = _dedupe_points(smoothed, closed=closed, min_distance=0.35)
        if len(smoothed) < 2:
            result.append(item)
            continue
        updated = {
            **item,
            "points": [[round(float(point[0]), 3), round(float(point[1]), 3)] for point in smoothed],
        }
        updated["length"] = _polyline_length(updated["points"] + ([updated["points"][0]] if closed else []))
        warnings.append("curve-polished")
        updated["warnings"] = list(dict.fromkeys(warnings))
        result.append(updated)
        polished += 1
        points_removed += max(0, len(points) - len(smoothed))

    return result, {
        "polishedCenterlineCurves": polished,
        "polishedCenterlinePointsRemoved": points_removed,
    }


def smooth_closed_points(points: Any, iterations: int) -> Any:
    if np is None or iterations <= 0 or len(points) < 4:
        return points
    smoothed = points.astype(float)
    for _ in range(max(0, min(3, int(iterations)))):
        next_points = np.roll(smoothed, -1, axis=0)
        left = smoothed * 0.75 + next_points * 0.25
        right = smoothed * 0.25 + next_points * 0.75
        combined = np.empty((len(smoothed) * 2, 2), dtype=float)
        combined[0::2] = left
        combined[1::2] = right
        smoothed = combined
    return smoothed


def smooth_open_points(points: list[list[float]], iterations: int) -> list[list[float]]:
    if iterations <= 0 or len(points) < 4:
        return points
    current = [[float(x), float(y)] for x, y in points]
    for _ in range(max(0, min(3, int(iterations)))):
        output = [current[0]]
        for index in range(len(current) - 1):
            ax, ay = current[index]
            bx, by = current[index + 1]
            output.append([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25])
            output.append([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75])
        output.append(current[-1])
        current = output
    return current


def remove_closed_path_spikes(points: list[list[float]], simplify: float, max_passes: int = 4) -> tuple[list[list[float]], int]:
    if len(points) < 5:
        return points, 0

    current = [[float(point[0]), float(point[1])] for point in points]
    removed = 0
    for _ in range(max(1, int(max_passes))):
        if len(current) < 5:
            break
        segment_lengths = [
            _point_distance(current[index], current[(index + 1) % len(current)])
            for index in range(len(current))
        ]
        ordered = sorted(length for length in segment_lengths if length > 1e-6)
        median_length = ordered[len(ordered) // 2] if ordered else 0.0
        short_limit = max(1.2, float(simplify) * 4.0, median_length * 2.8)
        long_limit = max(short_limit * 1.8, float(simplify) * 8.0)
        remove_indices: set[int] = set()

        for index, point in enumerate(current):
            prev_point = current[(index - 1) % len(current)]
            next_point = current[(index + 1) % len(current)]
            prev_len = _point_distance(prev_point, point)
            next_len = _point_distance(point, next_point)
            if prev_len <= 1e-6 or next_len <= 1e-6:
                remove_indices.add(index)
                continue
            turn = _angle_between_vectors(
                (point[0] - prev_point[0], point[1] - prev_point[1]),
                (next_point[0] - point[0], next_point[1] - point[1]),
            )
            short_cusp = turn >= 118.0 and prev_len <= short_limit and next_len <= short_limit
            hooked_tip = turn >= 138.0 and min(prev_len, next_len) <= short_limit and max(prev_len, next_len) <= long_limit
            if short_cusp or hooked_tip:
                remove_indices.add(index)

        if not remove_indices:
            break
        current = [point for index, point in enumerate(current) if index not in remove_indices]
        removed += len(remove_indices)

    return current, removed


def smooth_non_corner_closed_points(points: list[list[float]], iterations: int, corner_angle: float = 72.0) -> list[list[float]]:
    if iterations <= 0 or len(points) < 5:
        return points

    current = [[float(point[0]), float(point[1])] for point in points]
    for _ in range(max(0, min(4, int(iterations)))):
        output: list[list[float]] = []
        for index, point in enumerate(current):
            prev_point = current[(index - 1) % len(current)]
            next_point = current[(index + 1) % len(current)]
            turn = _angle_between_vectors(
                (point[0] - prev_point[0], point[1] - prev_point[1]),
                (next_point[0] - point[0], next_point[1] - point[1]),
            )
            if turn >= corner_angle:
                output.append(point)
                continue
            output.append([
                point[0] * 0.58 + (prev_point[0] + next_point[0]) * 0.21,
                point[1] * 0.58 + (prev_point[1] + next_point[1]) * 0.21,
            ])
        current = output
    return current


def polish_potrace_paths(vector_paths: list[dict[str, Any]], smooth: int, simplify: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    if not vector_paths:
        return vector_paths, {"potraceSpikePointsRemoved": 0, "potracePolishedPaths": 0}

    polished: list[dict[str, Any]] = []
    removed_points = 0
    polished_paths = 0
    smooth_iterations = max(1, min(3, int(smooth or 0) + 1))
    simplify_value = max(0.02, float(simplify))

    for item in vector_paths:
        points = [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        closed = bool(item.get("closed", True))
        if closed and len(points) >= 5:
            before = len(points)
            points, removed = remove_closed_path_spikes(points, simplify_value)
            removed_points += removed
            points = smooth_non_corner_closed_points(points, smooth_iterations, corner_angle=74.0)
            points = _simplify_points(points, max(0.015, simplify_value * 0.42), True)
            points, removed_after = remove_closed_path_spikes(points, simplify_value * 0.7, max_passes=2)
            removed_points += removed_after
            points = _dedupe_points(points, closed=True, min_distance=max(0.18, simplify_value * 0.22))
            if len(points) >= 3 and (removed > 0 or removed_after > 0 or len(points) != before):
                polished_paths += 1
        updated = {**item, "points": points}
        updated["length"] = _polyline_length(points + ([points[0]] if closed and points else []))
        updated["area"] = abs(_polygon_area(points)) if closed and len(points) >= 3 else 0.0
        polished.append(updated)

    return polished, {
        "potraceSpikePointsRemoved": removed_points,
        "potracePolishedPaths": polished_paths,
    }


def boosted_line_art_binary(threshold_source: Any,
                            initial_binary: Any,
                            used_threshold: float,
                            invert: bool,
                            blur: int) -> tuple[Any, dict[str, Any]]:
    if cv2 is None or np is None or used_threshold <= 0:
        return initial_binary, {"lineArtThreshold": float(used_threshold), "lineArtThresholdBoost": 0}

    initial_ratio = float(np.count_nonzero(initial_binary)) / float(max(1, initial_binary.shape[0] * initial_binary.shape[1]))
    if initial_ratio >= 0.18:
        return initial_binary, {
            "lineArtThreshold": float(used_threshold),
            "lineArtThresholdBoost": 0,
            "lineArtMaskRatio": round(initial_ratio, 4),
        }

    gray = threshold_source.copy()
    if blur > 0:
        k = _odd_kernel(int(blur))
        gray = cv2.GaussianBlur(gray, (k, k), 0)
    threshold_type = cv2.THRESH_BINARY_INV if invert else cv2.THRESH_BINARY
    target_ratio = min(0.166, max(initial_ratio + 0.045, initial_ratio * 1.40))
    max_threshold = min(250, int(round(float(used_threshold) + 24)))
    best_binary = initial_binary
    best_threshold = float(used_threshold)
    best_score = abs(initial_ratio - target_ratio)
    best_ratio = initial_ratio

    for candidate in range(int(round(float(used_threshold))) + 2, max_threshold + 1, 2):
        _unused, candidate_binary = cv2.threshold(gray, candidate, 255, threshold_type)
        ratio = float(np.count_nonzero(candidate_binary)) / float(max(1, candidate_binary.shape[0] * candidate_binary.shape[1]))
        if ratio > 0.24:
            break
        score = abs(ratio - target_ratio)
        if score <= best_score:
            best_binary = candidate_binary
            best_threshold = float(candidate)
            best_score = score
            best_ratio = ratio

    return best_binary, {
        "lineArtThreshold": best_threshold,
        "lineArtThresholdBoost": int(round(best_threshold - float(used_threshold))),
        "lineArtMaskRatio": round(best_ratio, 4),
    }


def remove_small_foreground_components(binary: Any, min_area: int) -> tuple[Any, int]:
    if cv2 is None or np is None or min_area <= 1:
        return binary, 0
    count, labels, stats, _centroids = cv2.connectedComponentsWithStats((binary > 0).astype(np.uint8), 8)
    cleaned = binary.copy()
    removed = 0
    for label in range(1, count):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < min_area:
            cleaned[labels == label] = 0
            removed += 1
    return cleaned, removed


def line_art_upscale_factor(width: int, height: int, max_dimension: int = 2800) -> int:
    min_side = max(1, min(int(width), int(height)))
    max_side = max(1, max(int(width), int(height)))
    desired = 1
    if min_side < 1000:
        desired = int(math.ceil(1000.0 / float(min_side)))
    desired = max(1, min(3, desired))
    while desired > 1 and max_side * desired > max(1600, int(max_dimension)):
        desired -= 1
    return max(1, desired)


def resize_binary_preview(binary: Any, width: int, height: int) -> Any:
    if binary.shape[1] == width and binary.shape[0] == height:
        return binary
    return cv2.resize(binary, (int(width), int(height)), interpolation=cv2.INTER_AREA)


def build_line_art_ink_mask(image: Any,
                            threshold: int,
                            threshold_mode: str,
                            blur: int,
                            invert: bool,
                            adaptive_block: int,
                            adaptive_c: float,
                            background_normalize: bool,
                            denoise: int) -> tuple[Any, Any, dict[str, Any]]:
    height, width = image.shape[:2]
    scale = line_art_upscale_factor(width, height)
    work_image = image
    if scale > 1:
        work_image = cv2.resize(
            image,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_LANCZOS4,
        )

    binary, used_threshold, threshold_source = build_vector_binary(
        work_image,
        threshold=threshold,
        threshold_mode=threshold_mode,
        blur=blur,
        invert=invert,
        adaptive_block=adaptive_block,
        adaptive_c=adaptive_c,
        morph_open=0,
        morph_close=0,
        background_normalize=background_normalize,
        denoise=denoise,
    )
    line_binary, line_stats = boosted_line_art_binary(
        threshold_source,
        binary,
        used_threshold=used_threshold,
        invert=invert,
        blur=int(blur),
    )

    foreground_ratio = float(np.count_nonzero(line_binary)) / float(max(1, line_binary.size))
    if foreground_ratio > 0.52:
        inverted = cv2.bitwise_not(line_binary)
        inverted_ratio = float(np.count_nonzero(inverted)) / float(max(1, inverted.size))
        if inverted_ratio < foreground_ratio and inverted_ratio <= 0.35:
            line_binary = inverted
            line_stats["lineArtAutoInvert"] = True
            foreground_ratio = inverted_ratio

    stroke_width = estimate_stroke_width(line_binary)
    close_radius = int(round(max(0.0, min(2.0 * scale, stroke_width * 0.15))))
    if close_radius > 0:
        kernel_size = _odd_kernel(close_radius * 2 + 1, 3)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        line_binary = cv2.morphologyEx(line_binary, cv2.MORPH_CLOSE, kernel)

    min_speckle_area = max(4, int(round(4 * scale * scale)))
    line_binary, removed_speckles = remove_small_foreground_components(line_binary, min_area=min_speckle_area)
    line_stats.update(
        {
            "lineArtTrace": True,
            "lineArtUpscale": scale,
            "lineArtClose": close_radius,
            "lineArtSpecklesRemoved": removed_speckles,
            "lineArtStrokeWidth": round(float(stroke_width), 2),
            "lineArtForegroundRatio": round(foreground_ratio, 4),
        }
    )
    preview = resize_binary_preview(line_binary, width, height)
    return line_binary, preview, line_stats


def trace_line_art_fill_vectors(binary: Any,
                                min_length: float,
                                simplify: float,
                                smooth: int,
                                max_contours: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    processed: list[tuple[float, float, list[list[float]], int]] = []
    skipped_short = 0
    skipped_tiny = 0
    simplify_value = max(0.02, float(simplify))
    smooth_iterations = max(0, min(1, int(smooth or 0)))

    for contour_index, contour in enumerate(contours):
        length = float(cv2.arcLength(contour, True))
        if length < max(1.0, float(min_length)):
            skipped_short += 1
            continue
        area = abs(float(cv2.contourArea(contour)))
        if area < 1.0:
            skipped_tiny += 1
            continue
        approx = cv2.approxPolyDP(contour, max(0.08, simplify_value), True)
        points = [[float(x), float(y)] for [[x, y]] in approx]
        if len(points) < 3:
            skipped_tiny += 1
            continue
        points, removed = remove_closed_path_spikes(points, max(0.02, simplify_value * 0.35), max_passes=1)
        if smooth_iterations > 0:
            points = smooth_non_corner_closed_points(points, smooth_iterations, corner_angle=82.0)
        points = _simplify_points(points, max(0.02, simplify_value * 0.28), True)
        points, removed_after = remove_closed_path_spikes(points, max(0.02, simplify_value * 0.25), max_passes=1)
        points = _dedupe_points(points, closed=True, min_distance=max(0.08, simplify_value * 0.12))
        if len(points) < 3:
            skipped_tiny += 1
            continue
        length = _polyline_length(points + [points[0]])
        if length < max(1.0, float(min_length)):
            skipped_short += 1
            continue
        processed.append((abs(_polygon_area(points)), length, points, removed + removed_after))

    processed.sort(key=lambda item: item[0], reverse=True)
    limit = max(1, int(max_contours))
    vector_paths: list[dict[str, Any]] = []
    spike_removed = 0
    for area, length, points, removed in processed[:limit]:
        spike_removed += int(removed)
        vector_paths.append(
            {
                "id": f"v{len(vector_paths) + 1}",
                "points": points,
                "closed": True,
                "removed": False,
                "area": area,
                "length": length,
                "sourceComponentId": len(vector_paths),
                "sourceEngine": "potrace",
            }
        )

    return vector_paths, {
        "contoursFound": len(contours),
        "pathsKept": len(vector_paths),
        "skippedSmall": skipped_tiny,
        "skippedShort": skipped_short + max(0, len(processed) - limit),
        "lineArtTrace": True,
        "potraceCurves": len(contours),
        "hierarchyCount": 0 if hierarchy is None else int(hierarchy.shape[1]),
        "potraceSpikePointsRemoved": spike_removed,
        "potracePolishedPaths": sum(1 for _area, _length, _points, removed in processed[:limit] if removed > 0),
    }


def polish_trace_binary(binary: Any, smooth: int, stitch_gap: float) -> tuple[Any, dict[str, int]]:
    """VTracer'a giden maskeyi kucuk kiriklar ve piksel pütürlerinden arindir."""
    if cv2 is None or np is None:
        return binary, {"tracePolishClose": 0, "tracePolishSmooth": 0}

    result = binary.copy()
    smooth_level = max(0, min(3, int(smooth or 0)))
    close_radius = int(round(max(float(stitch_gap or 0) * 0.5, smooth_level * 1.5)))
    close_radius = max(0, min(10, close_radius))

    if close_radius > 0:
        size = _odd_kernel(close_radius * 2 + 1, 3)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
        result = cv2.morphologyEx(result, cv2.MORPH_CLOSE, kernel)

    if smooth_level > 0:
        size = _odd_kernel(3 + smooth_level * 2, 3)
        blurred = cv2.GaussianBlur(result, (size, size), 0)
        _unused, result = cv2.threshold(blurred, 127, 255, cv2.THRESH_BINARY)
        if smooth_level >= 2:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            result = cv2.morphologyEx(result, cv2.MORPH_OPEN, kernel)
            result = cv2.morphologyEx(result, cv2.MORPH_CLOSE, kernel)

    return result, {"tracePolishClose": close_radius, "tracePolishSmooth": smooth_level}


def smooth_vector_paths(vector_paths: list[dict[str, Any]], smooth: int, simplify: float) -> list[dict[str, Any]]:
    iterations = max(0, min(3, int(smooth or 0)))
    if iterations <= 0:
        return vector_paths

    result: list[dict[str, Any]] = []
    for item in vector_paths:
        points = [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        if len(points) < 4:
            result.append(item)
            continue
        closed = bool(item.get("closed", True))
        if closed:
            points = [[float(x), float(y)] for x, y in smooth_closed_points(np.array(points), iterations)]
        else:
            points = smooth_open_points(points, iterations)
        points = _simplify_points(points, max(0.02, float(simplify) * 0.45), closed)
        points = _dedupe_points(points, closed=closed, min_distance=max(0.2, float(simplify) * 0.25))
        updated = {**item, "points": points}
        updated["length"] = _polyline_length(points + ([points[0]] if closed and points else []))
        updated["area"] = abs(_polygon_area(points)) if closed and len(points) >= 3 else 0.0
        result.append(updated)
    return result


def compound_fill_ratio(vector_paths: list[dict[str, Any]], width: float, height: float, max_size: int = 900) -> float:
    if cv2 is None or np is None or width <= 0 or height <= 0:
        return 0.0
    scale = min(1.0, float(max_size) / max(float(width), float(height)))
    out_w = max(1, int(round(float(width) * scale)))
    out_h = max(1, int(round(float(height) * scale)))
    mask = np.zeros((out_h, out_w), dtype=np.uint8)
    for item in vector_paths:
        points = item.get("points", [])
        if item.get("removed") or not item.get("closed", True) or len(points) < 3:
            continue
        contour = np.array(
            [[round(float(point[0]) * scale), round(float(point[1]) * scale)] for point in points],
            dtype=np.int32,
        ).reshape((-1, 1, 2))
        temp = np.zeros_like(mask)
        cv2.fillPoly(temp, [contour], 255)
        mask = cv2.bitwise_xor(mask, temp)
    return float(np.count_nonzero(mask)) / float(max(1, mask.size))


def trim_open_polyline_spurs(points: list[list[float]],
                             max_length: float,
                             min_turn_angle: float = 42.0) -> list[list[float]]:
    if len(points) < 3 or max_length <= 0:
        return points
    trimmed = [[float(x), float(y)] for x, y in points]
    max_length = float(max_length)

    changed = True
    while changed and len(trimmed) >= 3:
        changed = False
        a, b, c = trimmed[0], trimmed[1], trimmed[2]
        first_len = _point_distance(a, b)
        first_angle = _angle_between_vectors((b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1]))
        if first_len <= max_length and first_angle >= min_turn_angle:
            trimmed.pop(0)
            changed = True
            continue

        a, b, c = trimmed[-3], trimmed[-2], trimmed[-1]
        last_len = _point_distance(b, c)
        last_angle = _angle_between_vectors((b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1]))
        if last_len <= max_length and last_angle >= min_turn_angle:
            trimmed.pop()
            changed = True

    return trimmed


def open_vector_source_image(path: Path, max_dimension: int = 1800, contrast: float = 1.0) -> tuple[Any, dict[str, Any]]:
    if Image is None or ImageOps is None:
        raise ValueError("Gorsel isleme icin Pillow kutuphanesi bulunamadi.")
    if not path.exists():
        raise ValueError(f"Gorsel bulunamadi: {path}")
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        original_width, original_height = image.size
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            image = background.convert("L")
        else:
            image = image.convert("L")

        max_dimension = max(128, int(max_dimension or 1800))
        scale = min(1.0, max_dimension / max(1, max(original_width, original_height)))
        if scale < 1.0:
            resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
            image = image.resize((max(1, round(original_width * scale)), max(1, round(original_height * scale))), resample)

        if ImageEnhance is not None and abs(float(contrast) - 1.0) > 0.01:
            image = ImageEnhance.Contrast(image).enhance(max(0.05, float(contrast)))

        return np.array(image, dtype=np.uint8), {
            "originalWidth": original_width,
            "originalHeight": original_height,
            "processingScale": scale,
            "width": image.size[0],
            "height": image.size[1],
        }


def clean_line_art_source_profile(image: Any) -> dict[str, Any]:
    """Detect clean black line art on a uniform white background.

    These sources should not pass through illumination normalization or strong
    denoising: both operations can erase anti-aliased flower, bird and text
    details that are valid laser paths.
    """
    if np is None or image is None or getattr(image, "size", 0) == 0:
        return {"cleanLineArt": False}
    height, width = image.shape[:2]
    border_size = max(2, min(32, min(height, width) // 24))
    border = np.concatenate(
        (
            image[:border_size, :].reshape(-1),
            image[-border_size:, :].reshape(-1),
            image[:, :border_size].reshape(-1),
            image[:, -border_size:].reshape(-1),
        )
    )
    white_ratio = float(np.mean(image >= 250))
    ink_ratio = float(np.mean(image <= 200))
    border_white_ratio = float(np.mean(border >= 248))
    border_mean = float(np.mean(border))
    border_std = float(np.std(border))
    clean = bool(
        white_ratio >= 0.72
        and 0.002 <= ink_ratio <= 0.30
        and border_white_ratio >= 0.96
        and border_mean >= 246.0
        and border_std <= 5.0
    )
    return {
        "cleanLineArt": clean,
        "sourceWhiteRatio": round(white_ratio, 4),
        "sourceInkRatio": round(ink_ratio, 4),
        "sourceBorderWhiteRatio": round(border_white_ratio, 4),
        "sourceBorderMean": round(border_mean, 2),
        "sourceBorderStd": round(border_std, 2),
    }


def normalize_vector_background(image: Any, enabled: bool) -> Any:
    if not enabled:
        return image
    height, width = image.shape[:2]
    min_side = max(1, min(height, width))
    if min_side < 48:
        return image

    kernel_size = _odd_kernel(max(31, int(min_side * 0.12)), 31)
    if kernel_size >= min_side:
        kernel_size = _odd_kernel(max(3, min_side - 1), 3)
    background = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
    background = np.maximum(background, 8).astype(np.uint8)
    flattened = cv2.divide(image, background, scale=255)
    flattened = np.clip(flattened, 0, 255).astype(np.uint8)

    if hasattr(cv2, "createCLAHE"):
        clip_limit = 1.6
        tile = max(8, min(64, int(min_side / 8)))
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile, tile))
        flattened = clahe.apply(flattened)
    return flattened


def restore_hollowed_fills(binary: Any, base_gray: Any, invert: bool) -> Any:
    """Arka plan duzlestirmenin ici bosalttigi dolu bolgeleri geri doldur.

    Kenara degmeyen her arka plan boslugunda HAM goruntude hala dolu tonunda
    kalan pikseller doldurulur; acik/kagit rengindeki piksellere dokunulmaz.
    Boylece dolu logo/sekil kurtarilir, line-art'in ic bosluklari yanlislikla
    dolmaz.
    """
    background = (binary == 0).astype(np.uint8)
    count, labels, stats, _centroids = cv2.connectedComponentsWithStats(background, 8)
    height, width = binary.shape[:2]
    otsu_value, _unused = cv2.threshold(base_gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    low_tone = float(np.percentile(base_gray, 10))
    high_tone = float(np.percentile(base_gray, 90))
    if high_tone - low_tone >= 12:
        solid_threshold = (low_tone + high_tone) / 2.0
    else:
        solid_threshold = float(otsu_value)
    filled = binary.copy()
    for label in range(1, count):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])
        if x == 0 or y == 0 or x + w >= width or y + h >= height:
            continue  # kenara degen arka plan gercek zemindir
        region = labels == label
        solid_pixels = region & (base_gray <= solid_threshold if invert else base_gray >= solid_threshold)
        if np.count_nonzero(solid_pixels) > 0:
            filled[solid_pixels] = 255
    return filled


def build_vector_binary(image: Any,
                        threshold: int,
                        threshold_mode: str,
                        blur: int,
                        invert: bool,
                        adaptive_block: int,
                        adaptive_c: float,
                        morph_open: int,
                        morph_close: int,
                        background_normalize: bool = True,
                        denoise: int = 3) -> tuple[Any, float, Any]:
    threshold_mode = (threshold_mode or "manual").lower()
    # Medyan filtre: darbe (tuz-biber) gurultusunu Gaussian'in aksine yok eder.
    # Gurultu cizgiyi koparip yuzlerce kisa parcaya bolen ana etkendi.
    denoise = max(0, int(denoise or 0))
    if denoise:
        image = cv2.medianBlur(image, _odd_kernel(denoise, 3))
    base_image = image
    image = normalize_vector_background(image, background_normalize)
    threshold_source = image.copy()

    threshold_type = cv2.THRESH_BINARY_INV if invert else cv2.THRESH_BINARY

    def run_threshold(gray: Any) -> tuple[float, Any]:
        if blur > 0:
            k = _odd_kernel(int(blur))
            gray = cv2.GaussianBlur(gray, (k, k), 0)
        if threshold_mode == "otsu":
            used, result = cv2.threshold(gray, 0, 255, threshold_type | cv2.THRESH_OTSU)
            return float(used), result
        if threshold_mode == "adaptive":
            block = _odd_kernel(int(adaptive_block or 35), 3)
            result = cv2.adaptiveThreshold(
                gray,
                255,
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                threshold_type,
                block,
                float(adaptive_c),
            )
            return -1.0, result
        used, result = cv2.threshold(gray, int(threshold), 255, threshold_type)
        return float(used), result

    used_threshold, binary = run_threshold(image)

    # Arka plan duzlestirme (bolme) yuksek-gecirgen filtredir: cekirdekten buyuk
    # DOLU koyu bolgelerin icini de "arka plan" sayip beyazlatir; geriye ici bos
    # kenar bandi kalir (cift kenar / karalama gorunumunun kok nedeni). Ici
    # bosalan bolgeleri ham goruntudeki koyuluklariyla dogrulayip geri doldur.
    if background_normalize and base_image is not image:
        binary = restore_hollowed_fills(binary, base_image, invert)

    if morph_open > 0:
        kernel_size = max(1, int(morph_open))
        kernel = np.ones((kernel_size, kernel_size), dtype=np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    if morph_close > 0:
        kernel_size = max(1, int(morph_close))
        kernel = np.ones((kernel_size, kernel_size), dtype=np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    return binary, used_threshold, threshold_source


def bright_stencil_threshold(image: Any) -> float | None:
    """Find a high threshold for photos of white cut panels on gray backgrounds."""
    p70 = float(np.percentile(image, 70))
    p80 = float(np.percentile(image, 80))
    p90 = float(np.percentile(image, 90))
    p95 = float(np.percentile(image, 95))
    if p95 < 210 or p90 - p70 < 12:
        return None
    threshold = (p80 + p90) / 2.0
    return max(185.0, min(248.0, threshold))


def build_bright_stencil_candidate(image: Any,
                                   blur: int,
                                   adaptive_block: int,
                                   adaptive_c: float,
                                   morph_open: int,
                                   morph_close: int,
                                   denoise: int,
                                   remove_border: bool) -> dict[str, Any] | None:
    threshold = bright_stencil_threshold(image)
    if threshold is None:
        return None
    binary, used_threshold, threshold_source = build_vector_binary(
        image.copy(),
        threshold=int(round(threshold)),
        threshold_mode="manual",
        blur=max(1, int(blur)),
        invert=False,
        adaptive_block=adaptive_block,
        adaptive_c=adaptive_c,
        morph_open=morph_open,
        morph_close=max(2, int(morph_close or 0)),
        background_normalize=False,
        denoise=denoise,
    )
    threshold_binary = binary.copy()
    binary, removed_border_components = clean_border_components(binary, remove_border, margin=3)
    foreground_ratio = float(np.count_nonzero(binary)) / float(max(1, binary.shape[0] * binary.shape[1]))
    stroke_width = estimate_stroke_width(binary)
    if foreground_ratio < 0.035 or foreground_ratio > 0.58 or stroke_width < 6.0:
        return None
    return {
        "binary": binary,
        "thresholdBinary": threshold_binary,
        "thresholdSource": threshold_source,
        "usedThreshold": used_threshold,
        "removedBorderComponents": removed_border_components,
        "foregroundRatio": foreground_ratio,
        "strokeWidth": stroke_width,
    }


def is_wide_technical_line_drawing(width: float,
                                   height: float,
                                   stroke_width: float,
                                   foreground_ratio: float,
                                   invert: bool) -> bool:
    if not invert or width <= 0 or height <= 0:
        return False
    aspect_ratio = float(width) / max(1.0, float(height))
    return (
        width >= 320.0
        and height >= 160.0
        and aspect_ratio >= 1.25
        and 0.0 < stroke_width <= 2.8
        and 0.06 <= foreground_ratio <= 0.18
    )


def trace_outline_vectors(binary: Any,
                          min_area: float,
                          simplify: float,
                          smooth: int,
                          max_contours: int) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    vector_paths: list[dict[str, Any]] = []
    skipped_small = 0
    skipped_short = 0
    for contour_index, contour in enumerate(contours):
        area = abs(float(cv2.contourArea(contour)))
        if area < min_area:
            skipped_small += 1
            continue
        approx = cv2.approxPolyDP(contour, max(0.02, float(simplify)), True)
        points = approx.reshape(-1, 2).astype(float)
        points = smooth_closed_points(points, int(smooth))
        point_list = _dedupe_points([[float(x), float(y)] for x, y in points], closed=True)
        if len(point_list) < 3:
            skipped_short += 1
            continue
        vector_paths.append(
            {
                "id": f"v{len(vector_paths) + 1}",
                "points": point_list,
                "closed": True,
                "removed": False,
                "area": area,
                "length": _polyline_length(point_list + [point_list[0]]),
                "sourceComponentId": contour_index,
            }
        )
        if len(vector_paths) >= max_contours:
            break
    return vector_paths, {
        "contoursFound": len(contours),
        "pathsKept": len(vector_paths),
        "skippedSmall": skipped_small,
        "skippedShort": skipped_short,
        "hierarchyCount": 0 if hierarchy is None else int(hierarchy.shape[1]),
    }


def binary_to_vtracer_image(binary: Any, path: Path) -> None:
    foreground = binary > 0
    image = np.full((*binary.shape[:2], 3), 255, dtype=np.uint8)
    image[foreground] = (0, 0, 0)
    Image.fromarray(image, mode="RGB").save(path)


def grayscale_to_vtracer_image(image: Any, path: Path) -> None:
    rgb = np.stack([image, image, image], axis=-1).astype(np.uint8)
    Image.fromarray(rgb, mode="RGB").save(path)


def svg_file_to_vector_paths(svg_path: Path,
                             min_length: float,
                             simplify: float,
                             max_contours: int,
                             curve_steps: int = 18,
                             skip_light_fills: bool = False,
                             light_fill_threshold: float = 235.0,
                             source_engine: str = "vtracer") -> tuple[list[dict[str, Any]], dict[str, Any]]:
    root = ET.parse(svg_path).getroot()
    vector_paths: list[dict[str, Any]] = []
    skipped_short = 0
    skipped_light = 0
    path_elements = list(clean_laser_svg.iter_paths_with_matrix(root, clean_laser_svg.IDENTITY))
    for source_index, (element, matrix) in enumerate(path_elements):
        # VTracer binary ciktisinda beyaz arka plan elemani, siyah seklin her
        # sinirini ikinci kez cizer -> lazerde ayni hattin cift yakimi.
        if skip_light_fills:
            fill = element.get("fill") or svg_style_value(element, "fill")
            luminance = svg_color_luminance(fill)
            if luminance is not None and luminance >= float(light_fill_threshold):
                skipped_light += 1
                continue
        path_data = element.get("d", "")
        if not path_data:
            skipped_short += 1
            continue
        try:
            flat_data = clean_laser_svg.transformed_path_data(path_data, matrix)
            polylines = svg_path_to_polylines(flat_data, curve_steps=curve_steps)
        except Exception:
            skipped_short += 1
            continue
        for polyline in polylines:
            points = [[float(x), float(y)] for x, y in polyline]
            if len(points) < 2:
                skipped_short += 1
                continue
            closed = len(points) > 3 and _point_distance(points[0], points[-1]) <= 1.5
            if closed:
                points = points[:-1] if _point_distance(points[0], points[-1]) <= 1.5 else points
            points = _simplify_points(points, max(0.02, float(simplify)), closed)
            points = _dedupe_points(points, closed=closed, min_distance=max(0.25, float(simplify) * 0.35))
            length = _polyline_length(points + ([points[0]] if closed and points else []))
            if length < min_length or len(points) < 2:
                skipped_short += 1
                continue
            area = abs(_polygon_area(points)) if closed and len(points) >= 3 else 0.0
            vector_paths.append(
                {
                    "id": f"v{len(vector_paths) + 1}",
                    "points": points,
                    "closed": closed,
                    "removed": False,
                    "area": area,
                    "length": length,
                    "sourceComponentId": source_index,
                    "sourceEngine": source_engine,
                }
            )
            if len(vector_paths) >= max_contours:
                break
        if len(vector_paths) >= max_contours:
            break
    return vector_paths, {
        "contoursFound": len(path_elements),
        "pathsKept": len(vector_paths),
        "skippedSmall": 0,
        "skippedShort": skipped_short,
        "skippedLightFill": skipped_light,
        "vtracerPathElements": len(path_elements),
    }


def trace_vtracer_vectors(binary: Any,
                          min_length: float,
                          simplify: float,
                          max_contours: int,
                          color_mode: str = "binary",
                          smooth: int = 0) -> tuple[list[dict[str, Any]], dict[str, Any], str]:
    try:
        import vtracer  # type: ignore
    except ImportError as exc:
        raise ValueError("VTracer kurulu degil. Python ortaminda `pip install vtracer` gerekli.") from exc

    color_mode = "color" if color_mode == "color" else "binary"
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / "vtracer-input.png"
        output_path = temp_path / "vtracer-output.svg"
        binary_to_vtracer_image(binary, input_path)
        vtracer.convert_image_to_svg_py(
            str(input_path),
            str(output_path),
            colormode=color_mode,
            hierarchical="stacked",
            mode="spline",
            filter_speckle=8,
            color_precision=6,
            layer_difference=16,
            corner_threshold=60,
            length_threshold=max(3.0, float(simplify) * 5.0),
            max_iterations=10,
            splice_threshold=45,
            path_precision=3,
        )
        svg_text = output_path.read_text(encoding="utf-8")
        vector_paths, stats = svg_file_to_vector_paths(
            output_path,
            min_length=max(0.0, float(min_length)),
            simplify=max(0.02, float(simplify)),
            max_contours=max(1, int(max_contours)),
            curve_steps=18,
            skip_light_fills=(color_mode == "binary"),
        )
        vector_paths = smooth_vector_paths(vector_paths, int(smooth), float(simplify))
    stats["vtracerColorMode"] = color_mode
    stats["vtracerPostSmooth"] = max(0, min(3, int(smooth or 0)))
    return vector_paths, stats, svg_text


def trace_vtracer_photo_vectors(image: Any,
                                min_length: float,
                                simplify: float,
                                max_contours: int,
                                smooth: int = 0,
                                light_fill_threshold: float = 180.0) -> tuple[list[dict[str, Any]], dict[str, Any], str]:
    try:
        import vtracer  # type: ignore
    except ImportError as exc:
        raise ValueError("VTracer kurulu degil. Python ortaminda `pip install vtracer` gerekli.") from exc

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        input_path = temp_path / "vtracer-photo-input.png"
        output_path = temp_path / "vtracer-photo-output.svg"
        grayscale_to_vtracer_image(image, input_path)
        vtracer.convert_image_to_svg_py(
            str(input_path),
            str(output_path),
            colormode="color",
            hierarchical="stacked",
            mode="spline",
            filter_speckle=8,
            color_precision=4,
            layer_difference=24,
            corner_threshold=75,
            length_threshold=max(3.0, float(simplify) * 7.0),
            max_iterations=12,
            splice_threshold=60,
            path_precision=3,
        )
        svg_text = output_path.read_text(encoding="utf-8")
        vector_paths, stats = svg_file_to_vector_paths(
            output_path,
            min_length=max(0.0, float(min_length)),
            simplify=max(0.02, float(simplify)),
            max_contours=max(1, int(max_contours)),
            curve_steps=18,
            skip_light_fills=True,
            light_fill_threshold=light_fill_threshold,
        )
        vector_paths = smooth_vector_paths(vector_paths, int(smooth), float(simplify))
    stats["vtracerColorMode"] = "color"
    stats["vtracerPostSmooth"] = max(0, min(3, int(smooth or 0)))
    stats["lightFillThreshold"] = float(light_fill_threshold)
    return vector_paths, stats, svg_text


def _potrace_xy(point: Any) -> tuple[float, float]:
    return float(point.x), float(point.y)


def trace_potrace_vectors(image: Any,
                          min_length: float,
                          simplify: float,
                          max_contours: int,
                          blacklevel: float = 0.55,
                          alphamax: float = 0.8,
                          opttolerance: float = 0.4,
                          turdsize: int = 2,
                          smooth: int = 1) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    try:
        import potrace  # type: ignore
    except ImportError as exc:
        raise ValueError("Potrace kurulu degil. Python ortaminda `pip install potracer` gerekli.") from exc

    pil_image = Image.fromarray(image.astype(np.uint8), mode="L")
    bitmap = potrace.Bitmap(pil_image, blacklevel=max(0.05, min(0.95, float(blacklevel))))
    traced = bitmap.trace(
        turdsize=max(0, int(turdsize)),
        alphamax=float(alphamax),
        opticurve=True,
        opttolerance=float(opttolerance),
    )
    vector_paths: list[dict[str, Any]] = []
    skipped_short = 0
    curve_steps = 12
    for source_index, curve in enumerate(traced):
        if curve.start_point is None:
            skipped_short += 1
            continue
        points: list[list[float]] = [[*_potrace_xy(curve.start_point)]]
        current = (points[0][0], points[0][1])
        for segment in curve:
            if segment.is_corner:
                corner = _potrace_xy(segment.c)
                end = _potrace_xy(segment.end_point)
                points.append([corner[0], corner[1]])
                points.append([end[0], end[1]])
                current = end
            else:
                c1 = _potrace_xy(segment.c1)
                c2 = _potrace_xy(segment.c2)
                end = _potrace_xy(segment.end_point)
                for step in range(1, curve_steps + 1):
                    x, y = clean_laser_svg.cubic_point(current, c1, c2, end, step / curve_steps)
                    points.append([float(x), float(y)])
                current = end
        points = _simplify_points(points, max(0.02, float(simplify)), True)
        points = _dedupe_points(points, closed=True, min_distance=max(0.25, float(simplify) * 0.35))
        length = _polyline_length(points + ([points[0]] if points else []))
        if length < min_length or len(points) < 3:
            skipped_short += 1
            continue
        vector_paths.append(
            {
                "id": f"v{len(vector_paths) + 1}",
                "points": points,
                "closed": True,
                "removed": False,
                "area": abs(_polygon_area(points)),
                "length": length,
                "sourceComponentId": source_index,
                "sourceEngine": "potrace",
            }
        )
        if len(vector_paths) >= max_contours:
            break

    vector_paths, polish_stats = polish_potrace_paths(vector_paths, smooth=int(smooth), simplify=float(simplify))
    stats = {
        "contoursFound": len(traced),
        "pathsKept": len(vector_paths),
        "skippedSmall": 0,
        "skippedShort": skipped_short + max(0, len(traced) - max_contours),
        "potraceCurves": len(traced),
        "potraceBlacklevel": round(float(blacklevel), 3),
        "potraceAlphamax": float(alphamax),
        "potraceOptTolerance": float(opttolerance),
    }
    stats.update(polish_stats)
    return vector_paths, stats


def thin_binary(binary: Any) -> Any:
    if hasattr(cv2, "ximgproc") and hasattr(cv2.ximgproc, "thinning"):
        return cv2.ximgproc.thinning(binary)
    # Fallback Zhang-Suen thinning for environments without opencv-contrib.
    image = (binary > 0).astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            to_remove: list[tuple[int, int]] = []
            rows, cols = image.shape
            for y in range(1, rows - 1):
                for x in range(1, cols - 1):
                    if image[y, x] == 0:
                        continue
                    p2 = image[y - 1, x]
                    p3 = image[y - 1, x + 1]
                    p4 = image[y, x + 1]
                    p5 = image[y + 1, x + 1]
                    p6 = image[y + 1, x]
                    p7 = image[y + 1, x - 1]
                    p8 = image[y, x - 1]
                    p9 = image[y - 1, x - 1]
                    neighbors = [p2, p3, p4, p5, p6, p7, p8, p9]
                    count = int(sum(neighbors))
                    transitions = sum(1 for index in range(8) if neighbors[index] == 0 and neighbors[(index + 1) % 8] == 1)
                    if not (2 <= count <= 6 and transitions == 1):
                        continue
                    if step == 0:
                        condition = p2 * p4 * p6 == 0 and p4 * p6 * p8 == 0
                    else:
                        condition = p2 * p4 * p8 == 0 and p2 * p6 * p8 == 0
                    if condition:
                        to_remove.append((y, x))
            if to_remove:
                changed = True
                for y, x in to_remove:
                    image[y, x] = 0
    return (image * 255).astype(np.uint8)


def _skeleton_neighbors(pixels: set[tuple[int, int]],
                        pixel: tuple[int, int],
                        neighbor_offsets: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """8-komsuluk, gereksiz capraz baglantilar elenmis halde.

    Egri cizgilerin merdiven koselerinde dik + capraz komsu ayni anda bulunur;
    capraz sayilirsa kose sahte kavsak (degree>2) olur ve iz surucu yolu her
    kosede parcalar (3 cizgilik eskiz -> ~1900 parca). Dik komsu uzerinden
    zaten baglanti varsa capraz atlanir; baglantililik korunur.
    """
    x, y = pixel
    result = []
    for dx, dy in neighbor_offsets:
        q = (x + dx, y + dy)
        if q not in pixels:
            continue
        if dx and dy and ((x + dx, y) in pixels or (x, y + dy) in pixels):
            continue
        result.append(q)
    return result


def prune_skeleton_spurs(skeleton: Any,
                         max_length: int = 8,
                         max_rounds: int = 6,
                         continuation_angle: float = 32.0) -> tuple[Any, int]:
    """Remove short terminal branches from a 1-pixel skeleton."""
    image = (skeleton > 0).astype(np.uint8)
    max_length = max(1, int(max_length))
    max_rounds = max(1, int(max_rounds))
    neighbor_offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    total_removed = 0

    for _round in range(max_rounds):
        ys, xs = np.where(image > 0)
        pixels = {(int(x), int(y)) for x, y in zip(xs, ys)}
        if not pixels:
            break

        def neighbors(pixel: tuple[int, int]) -> list[tuple[int, int]]:
            return _skeleton_neighbors(pixels, pixel, neighbor_offsets)

        degree = {pixel: len(neighbors(pixel)) for pixel in pixels}
        endpoints = [pixel for pixel, deg in degree.items() if deg == 1]
        remove: set[tuple[int, int]] = set()

        for endpoint in endpoints:
            if endpoint in remove:
                continue
            path = [endpoint]
            previous: tuple[int, int] | None = None
            current = endpoint
            while len(path) <= max_length + 1:
                candidates = [item for item in neighbors(current) if item != previous]
                if not candidates:
                    break
                next_pixel = candidates[0]
                previous, current = current, next_pixel
                path.append(current)
                if degree.get(current, 0) != 2:
                    break

            branch_length = len(path) - 1
            stop_degree = degree.get(path[-1], 0)
            has_straight_continuation = False
            if len(path) >= 2 and stop_degree >= 3:
                junction = path[-1]
                previous_pixel = path[-2]
                jx, jy = junction
                px, py = previous_pixel
                incoming = (jx - px, jy - py)
                for candidate in neighbors(junction):
                    if candidate == previous_pixel:
                        continue
                    cx, cy = candidate
                    outgoing = (cx - jx, cy - jy)
                    if _angle_between_vectors(incoming, outgoing) <= continuation_angle:
                        has_straight_continuation = True
                        break

            if 0 < branch_length <= max_length and stop_degree >= 3 and not has_straight_continuation:
                remove.update(path[:-1])

        if not remove:
            break
        for x, y in remove:
            image[y, x] = 0
        total_removed += len(remove)

    return (image * 255).astype(np.uint8), total_removed


def estimate_stroke_width(binary: Any, skeleton: Any | None = None) -> float:
    """Cizgi kalinligini distance transform ile tahmin et (px)."""
    mask = (binary > 0).astype(np.uint8)
    if not mask.any():
        return 0.0
    dt = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
    if skeleton is not None and (skeleton > 0).any():
        values = dt[skeleton > 0]
    else:
        values = dt[dt > 0]
    if values.size == 0:
        return 0.0
    return float(np.median(values)) * 2.0


def adaptive_spur_length(binary: Any,
                         skeleton: Any,
                         stitch_gap: float,
                         min_length: float) -> int:
    """Spur budama esigini cizgi kalinligina gore olcekle.

    Sabit 6-18 px esik, kalin bolgelerde siniri kacan kil/diken dallarini
    (boundary noise -> medial axis spur) budayamiyordu. Kalinlik arttikca
    diken de uzar; esik kalinlikla buyumeli.
    """
    base = max(6.0, float(stitch_gap) * 2.0, float(min_length) * 0.75)
    stroke = estimate_stroke_width(binary, skeleton)
    if stroke > 0:
        base = max(base, stroke * 1.25)
    return int(max(6, min(30, round(base))))


def solidify_centerline_mask(binary: Any, radius: int) -> Any:
    radius = max(0, int(radius))
    if radius <= 0:
        return binary
    kernel_size = radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    solid = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    return solid


def fill_centerline_micro_holes(binary: Any,
                                stroke_width: float) -> tuple[Any, dict[str, Any]]:
    """Fill only sub-stroke enclosed holes before CAD skeletonization.

    Anti-aliased line intersections can leave one or two background pixels
    fully enclosed by ink. Thinning interprets those pixels as a real loop and
    produces triangular artifacts at feet and other dense junctions. The area
    and span limits scale with stroke width, so meaningful enclosed regions are
    preserved.
    """
    if cv2 is None or np is None or binary is None:
        return binary, {
            "filledCenterlineMicroHoles": 0,
            "filledCenterlineMicroHolePixels": 0,
        }
    stroke = max(1.0, float(stroke_width or 1.0))
    max_area = max(2, min(64, int(round(stroke * stroke * 1.5))))
    max_span = max(2, min(12, int(round(stroke * 1.5))))
    background = (binary == 0).astype(np.uint8)
    count, labels, stats, _centroids = cv2.connectedComponentsWithStats(background, 8)
    height, width = binary.shape[:2]
    result = binary.copy()
    filled_holes = 0
    filled_pixels = 0
    for label in range(1, int(count)):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        component_width = int(stats[label, cv2.CC_STAT_WIDTH])
        component_height = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        if x == 0 or y == 0 or x + component_width >= width or y + component_height >= height:
            continue
        if area > max_area or component_width > max_span or component_height > max_span:
            continue
        result[labels == label] = 255
        filled_holes += 1
        filled_pixels += area
    return result, {
        "filledCenterlineMicroHoles": filled_holes,
        "filledCenterlineMicroHolePixels": filled_pixels,
        "centerlineMicroHoleAreaLimit": max_area,
        "centerlineMicroHoleSpanLimit": max_span,
    }


def centerline_dense_junction_holes(binary: Any,
                                    skeleton: Any,
                                    stroke_width: float) -> tuple[Any, dict[str, Any]]:
    """Replace small outlined junction details with their medial centerline.

    Line art can mix true strokes with narrow outlined forms such as fingers,
    feet, roots or wire junctions. Tracing both sides of those forms creates
    loops; filling the holes destroys their branches. This pass detects only
    enclosed, narrow regions with at least three real graph junctions, removes
    their boundary loop, inserts the region's medial axis and reconnects it at
    the original junctions. It is orientation-independent and leaves simple
    petals, text counters and other isolated closed motifs unchanged.
    """
    empty_stats = {
        "centerlinedDenseJunctionHoles": 0,
        "centerlinedDenseJunctionBridges": 0,
        "centerlinedDenseJunctionPixels": 0,
    }
    if cv2 is None or np is None or binary is None or skeleton is None:
        return skeleton, empty_stats

    height, width = binary.shape[:2]
    stroke = max(1.0, float(stroke_width or 1.0))
    # CAD tracing normally runs near 2400 px. Normalizing thresholds by the
    # actual trace size keeps the same geometry behavior for low/high-res input.
    detail_scale = max(0.25, float(max(width, height)) / 1200.0)
    min_area = max(4, int(round(max(32.0 * detail_scale ** 2, stroke ** 2 * 8.0))))
    max_area = max(min_area, int(round(max(280.0 * detail_scale ** 2, stroke ** 2 * 80.0))))
    max_span = max(int(round(48.0 * detail_scale)), int(round(stroke * 28.0)))
    max_medial_radius = max(8.0 * detail_scale, stroke * 5.0)

    background = (binary == 0).astype(np.uint8)
    count, labels, component_stats, _centroids = cv2.connectedComponentsWithStats(background, 8)

    ys, xs = np.where(skeleton > 0)
    pixels = {(int(x), int(y)) for x, y in zip(xs, ys)}
    neighbor_offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    junction_mask = np.zeros_like(skeleton, dtype=np.uint8)
    for pixel in pixels:
        if len(_skeleton_neighbors(pixels, pixel, neighbor_offsets)) >= 3:
            junction_mask[pixel[1], pixel[0]] = 1

    ring_radius = max(2, int(round(stroke * 1.5)))
    ring_kernel = np.ones((ring_radius * 2 + 1, ring_radius * 2 + 1), dtype=np.uint8)
    candidates: list[dict[str, Any]] = []
    for label in range(1, int(count)):
        x = int(component_stats[label, cv2.CC_STAT_LEFT])
        y = int(component_stats[label, cv2.CC_STAT_TOP])
        component_width = int(component_stats[label, cv2.CC_STAT_WIDTH])
        component_height = int(component_stats[label, cv2.CC_STAT_HEIGHT])
        area = int(component_stats[label, cv2.CC_STAT_AREA])
        if x == 0 or y == 0 or x + component_width >= width or y + component_height >= height:
            continue
        if not min_area <= area <= max_area or max(component_width, component_height) > max_span:
            continue

        hole = (labels == label).astype(np.uint8)
        medial_radius = float(cv2.distanceTransform(hole, cv2.DIST_L2, 3).max())
        if medial_radius > max_medial_radius:
            continue

        pad = ring_radius * 2
        min_y = max(0, y - pad)
        max_y = min(height, y + component_height + pad)
        min_x = max(0, x - pad)
        max_x = min(width, x + component_width + pad)
        local_hole = hole[min_y:max_y, min_x:max_x]
        ring = cv2.dilate(local_hole, ring_kernel) - local_hole
        local_junctions = (junction_mask[min_y:max_y, min_x:max_x] & (ring > 0)).astype(np.uint8)
        junction_count, _junction_labels, _junction_stats, _junction_centroids = cv2.connectedComponentsWithStats(
            local_junctions,
            8,
        )
        junction_clusters = int(junction_count) - 1
        if junction_clusters < 3:
            continue
        candidates.append(
            {
                "label": label,
                "bbox": (x, y, component_width, component_height),
                "area": area,
                "junctionClusters": junction_clusters,
                "hole": hole,
            }
        )

    if not candidates:
        return skeleton, {
            **empty_stats,
            "denseJunctionHoleAreaMin": min_area,
            "denseJunctionHoleAreaMax": max_area,
        }

    candidate_mask = np.zeros_like(binary, dtype=np.uint8)
    medial_masks: list[tuple[dict[str, Any], Any]] = []
    for candidate in candidates:
        hole = candidate["hole"]
        candidate_mask[hole > 0] = 1
        medial_masks.append((candidate, thin_binary(hole * 255)))

    removal_radius = max(2, int(round(stroke * 1.1)))
    removal_kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (removal_radius * 2 + 1, removal_radius * 2 + 1),
    )
    removal_mask = cv2.dilate(candidate_mask, removal_kernel) > 0
    base = skeleton.copy()
    removed_pixels = int(np.count_nonzero((base > 0) & removal_mask))
    base[removal_mask] = 0
    result = base.copy()

    def nearest_mask_pixel(mask: Any,
                           center_x: float,
                           center_y: float,
                           radius: int) -> tuple[tuple[int, int] | None, float]:
        radius = max(1, int(radius))
        min_x = max(0, int(math.floor(center_x)) - radius)
        max_x = min(width, int(math.ceil(center_x)) + radius + 1)
        min_y = max(0, int(math.floor(center_y)) - radius)
        max_y = min(height, int(math.ceil(center_y)) + radius + 1)
        local_y, local_x = np.where(mask[min_y:max_y, min_x:max_x] > 0)
        if local_x.size == 0:
            return None, float("inf")
        global_x = local_x + min_x
        global_y = local_y + min_y
        distances = (global_x - center_x) ** 2 + (global_y - center_y) ** 2
        nearest_index = int(np.argmin(distances))
        return (int(global_x[nearest_index]), int(global_y[nearest_index])), float(math.sqrt(distances[nearest_index]))

    bridge_count = 0
    for candidate, medial in medial_masks:
        result[medial > 0] = 255
        medial_y, medial_x = np.where(medial > 0)
        medial_pixels = {(int(x), int(y)) for x, y in zip(medial_x, medial_y)}
        endpoints = [
            pixel
            for pixel in medial_pixels
            if len(_skeleton_neighbors(medial_pixels, pixel, neighbor_offsets)) == 1
        ]
        if not endpoints:
            continue

        x, y, component_width, component_height = candidate["bbox"]
        bridge_radius = max(removal_radius + 2, int(round(stroke * 2.6)))
        bridge_kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (bridge_radius * 2 + 1, bridge_radius * 2 + 1),
        )
        near_hole = cv2.dilate(candidate["hole"], bridge_kernel) > 0
        local_junctions = ((junction_mask > 0) & near_hole).astype(np.uint8)
        junction_count, _junction_labels, _junction_stats, junction_centroids = cv2.connectedComponentsWithStats(
            local_junctions,
            8,
        )
        clusters: list[tuple[tuple[float, float], tuple[int, int], float]] = []
        for junction_label in range(1, int(junction_count)):
            center_x, center_y = (float(value) for value in junction_centroids[junction_label])
            target, target_distance = nearest_mask_pixel(base, center_x, center_y, bridge_radius * 2)
            if target is not None and target_distance <= bridge_radius * 1.7:
                clusters.append(((center_x, center_y), target, target_distance))

        max_endpoint_distance = max(component_width, component_height) * 0.72
        matches: list[tuple[float, int, int]] = []
        for endpoint_index, endpoint in enumerate(endpoints):
            for cluster_index, (centroid, _target, target_distance) in enumerate(clusters):
                endpoint_distance = math.dist(endpoint, centroid)
                if endpoint_distance <= max_endpoint_distance:
                    matches.append((endpoint_distance + target_distance * 0.4, endpoint_index, cluster_index))

        used_endpoints: set[int] = set()
        used_clusters: set[int] = set()
        for _score, endpoint_index, cluster_index in sorted(matches):
            if endpoint_index in used_endpoints or cluster_index in used_clusters:
                continue
            endpoint = endpoints[endpoint_index]
            centroid, target, _target_distance = clusters[cluster_index]
            center = (int(round(centroid[0])), int(round(centroid[1])))
            cv2.line(result, endpoint, center, 255, 1)
            cv2.line(result, center, target, 255, 1)
            used_endpoints.add(endpoint_index)
            used_clusters.add(cluster_index)
            bridge_count += 1

    return thin_binary(result), {
        "centerlinedDenseJunctionHoles": len(candidates),
        "centerlinedDenseJunctionBridges": bridge_count,
        "centerlinedDenseJunctionPixels": removed_pixels,
        "denseJunctionHoleAreaMin": min_area,
        "denseJunctionHoleAreaMax": max_area,
        "denseJunctionHoleMaxSpan": max_span,
    }


def stitch_raw_point_paths(raw_paths: list[list[Any]],
                           max_gap: float,
                           max_angle: float = 65.0) -> tuple[list[list[Any]], int]:
    max_gap = float(max_gap or 0)
    if max_gap <= 0:
        return raw_paths, 0
    return stitch_point_paths_by_endpoint(
        [list(path) for path in raw_paths if len(path) >= 2],
        max_gap=max_gap,
        max_angle=max_angle,
        max_passes=36,
        per_endpoint_limit=10,
    )


def trace_skeleton_vectors(binary: Any,
                           min_length: float,
                           simplify: float,
                           smooth: int,
                           max_contours: int,
                           stitch_gap: float = 0.0,
                           skeleton: Any | None = None,
                           trim_open_ends: bool = True,
                           post_simplify_epsilon: float | None = None,
                           preserve_junctions: bool = False) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if skeleton is None:
        skeleton = thin_binary(binary)
    ys, xs = np.where(skeleton > 0)
    pixels = {(int(x), int(y)) for x, y in zip(xs, ys)}
    if not pixels:
        return [], {"contoursFound": 0, "pathsKept": 0, "skippedShort": 0, "skeletonPixels": 0}

    neighbor_offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]

    def neighbors(pixel: tuple[int, int]) -> list[tuple[int, int]]:
        return _skeleton_neighbors(pixels, pixel, neighbor_offsets)

    degree = {pixel: len(neighbors(pixel)) for pixel in pixels}
    nodes = {pixel for pixel, deg in degree.items() if deg != 2}
    visited_edges: set[frozenset[tuple[int, int]]] = set()
    raw_paths: list[list[tuple[int, int]]] = []

    def edge_key(a: tuple[int, int], b: tuple[int, int]) -> frozenset[tuple[int, int]]:
        return frozenset((a, b))

    def trace_from(start: tuple[int, int], nxt: tuple[int, int]) -> list[tuple[int, int]]:
        path = [start, nxt]
        visited_edges.add(edge_key(start, nxt))
        previous = start
        current = nxt
        while current not in nodes:
            candidates = [item for item in neighbors(current) if item != previous]
            if not candidates:
                break
            next_pixel = candidates[0]
            key = edge_key(current, next_pixel)
            if key in visited_edges:
                break
            visited_edges.add(key)
            path.append(next_pixel)
            previous, current = current, next_pixel
        return path

    for node in sorted(nodes, key=lambda item: (item[1], item[0])):
        for neighbor in neighbors(node):
            if edge_key(node, neighbor) not in visited_edges:
                raw_paths.append(trace_from(node, neighbor))

    # Closed loops have no endpoints/junctions. Trace any remaining unvisited cycle.
    for pixel in sorted(pixels, key=lambda item: (item[1], item[0])):
        for neighbor in neighbors(pixel):
            if edge_key(pixel, neighbor) in visited_edges:
                continue
            path = [pixel, neighbor]
            visited_edges.add(edge_key(pixel, neighbor))
            previous = pixel
            current = neighbor
            while True:
                candidates = [item for item in neighbors(current) if item != previous]
                if not candidates:
                    break
                next_pixel = candidates[0]
                key = edge_key(current, next_pixel)
                if key in visited_edges:
                    break
                visited_edges.add(key)
                path.append(next_pixel)
                previous, current = current, next_pixel
                if current == pixel:
                    break
            raw_paths.append(path)

    raw_path_count = len(raw_paths)
    effective_stitch_gap = max(0.0, float(stitch_gap))
    if raw_path_count > 90000:
        effective_stitch_gap = min(effective_stitch_gap, 2.0)
    elif raw_path_count > 50000:
        effective_stitch_gap = min(effective_stitch_gap, 3.0)
    raw_paths, stitched_raw = stitch_raw_point_paths(raw_paths, effective_stitch_gap, max_angle=68.0)

    vector_paths: list[dict[str, Any]] = []
    skipped_short = 0
    preserved_junction_anchors = 0
    junction_sensitive_paths = 0
    processed: list[tuple[float, list[list[float]], bool, int]] = []

    def polish_points(source_points: list[list[float]], closed_path: bool, allow_trim: bool) -> list[list[float]]:
        result = _simplify_points(source_points, float(simplify), closed_path)
        if allow_trim:
            result = trim_open_polyline_spurs(result, trim_length)
        result = (
            smooth_open_points(result, int(smooth))
            if not closed_path
            else [[float(x), float(y)] for x, y in smooth_closed_points(np.array(result), int(smooth))]
        )
        post_epsilon = (
            max(0.15, float(simplify) * 0.65)
            if post_simplify_epsilon is None
            else max(0.02, float(post_simplify_epsilon))
        )
        if simplify > 0 or post_simplify_epsilon is not None:
            result = _simplify_points(result, post_epsilon, closed_path)
        if allow_trim:
            result = trim_open_polyline_spurs(result, trim_length)
        return _dedupe_points(result, closed=closed_path, min_distance=max(0.45, float(simplify) * 0.45))

    for raw_index, raw_path in enumerate(raw_paths):
        points = [[float(x), float(y)] for x, y in raw_path]
        closed = len(points) > 3 and math.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]) <= 1.5
        trim_length = max(4.0, min(18.0, max(float(stitch_gap) * 3.0, float(min_length) * 1.25)))
        junction_indices = [
            index
            for index, pixel in enumerate(raw_path)
            if degree.get((int(pixel[0]), int(pixel[1])), 0) >= 3
        ]
        if preserve_junctions and not closed and junction_indices:
            anchor_indices = sorted({0, len(points) - 1, *junction_indices})
            anchored_points: list[list[float]] = []
            for anchor_index in range(len(anchor_indices) - 1):
                start_index = anchor_indices[anchor_index]
                end_index = anchor_indices[anchor_index + 1]
                if end_index <= start_index:
                    continue
                segment = polish_points(points[start_index:end_index + 1], False, False)
                if not segment:
                    continue
                segment[0] = [float(points[start_index][0]), float(points[start_index][1])]
                segment[-1] = [float(points[end_index][0]), float(points[end_index][1])]
                anchored_points.extend(segment if not anchored_points else segment[1:])
            if len(anchored_points) >= 2:
                points = anchored_points
                preserved_junction_anchors += len(set(junction_indices))
                junction_sensitive_paths += 1
            else:
                points = polish_points(points, closed, not closed and trim_open_ends)
        else:
            points = polish_points(points, closed, not closed and trim_open_ends)
        length = _polyline_length(points + ([points[0]] if closed and points else []))
        if not closed and len(points) <= 2 and length <= trim_length:
            skipped_short += 1
            continue
        if length < min_length or len(points) < 2:
            skipped_short += 1
            continue
        processed.append((length, points, closed, raw_index))

    processed.sort(key=lambda item: item[0], reverse=True)
    for length, points, closed, raw_index in processed[:max_contours]:
        vector_paths.append(
            {
                "id": f"v{len(vector_paths) + 1}",
                "points": points,
                "closed": closed,
                "removed": False,
                "area": 0.0,
                "length": length,
                "sourceComponentId": raw_index,
            }
        )

    return vector_paths, {
        "contoursFound": raw_path_count,
        "pathsKept": len(vector_paths),
        "skippedSmall": 0,
        "skippedShort": skipped_short + max(0, len(processed) - max_contours),
        "skeletonPixels": len(pixels),
        "stitchedRaw": stitched_raw,
        "effectiveStitchGap": effective_stitch_gap,
        "preservedJunctionAnchors": preserved_junction_anchors,
        "junctionSensitivePaths": junction_sensitive_paths,
    }


def preserve_centerline_dot_components(binary: Any,
                                       skeleton: Any,
                                       vector_paths: list[dict[str, Any]],
                                       stroke_width: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Keep clean isolated dots that thinning collapses below a drawable path.

    Eyes, punctuation and similar filled details can become one skeleton pixel.
    A tiny closed centerline gives them a real laser motion without tracing both
    edges of the original filled dot.
    """
    if cv2 is None or np is None or binary is None or skeleton is None:
        return vector_paths, {"preservedDotDetails": 0}
    count, labels, stats, centroids = cv2.connectedComponentsWithStats((binary > 0).astype(np.uint8), 8)
    stroke = max(1.0, float(stroke_width or 1.0))
    min_area = max(4.0, stroke * stroke * 1.1)
    max_area = max(32.0, stroke * stroke * 16.0)
    max_span = max(7.0, min(48.0, stroke * 6.0))
    result = list(vector_paths)
    preserved = 0
    for label in range(1, int(count)):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        width = int(stats[label, cv2.CC_STAT_WIDTH])
        height = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < min_area or area > max_area or width < 2 or height < 2:
            continue
        if width > max_span or height > max_span or max(width, height) / max(1.0, min(width, height)) > 1.8:
            continue
        component_skeleton_pixels = int(np.count_nonzero((skeleton > 0) & (labels == label)))
        if component_skeleton_pixels > 2:
            continue
        center_x, center_y = (float(value) for value in centroids[label])
        radius = max(0.75, min(stroke * 0.9, min(width, height) * 0.24))
        point_count = 12
        points = [
            [
                center_x + math.cos((math.tau * index) / point_count) * radius,
                center_y + math.sin((math.tau * index) / point_count) * radius,
            ]
            for index in range(point_count)
        ]
        result.append(
            {
                "id": f"dot-{label}",
                "points": points,
                "closed": True,
                "removed": False,
                "area": math.pi * radius * radius,
                "length": math.tau * radius,
                "sourceComponentId": f"dot-{label}",
                "warnings": ["preserved-dot"],
            }
        )
        preserved += 1
    return result, {"preservedDotDetails": preserved}


def _graph_projection(point: list[float], start: list[float], end: list[float]) -> tuple[list[float], float, float]:
    dx = float(end[0]) - float(start[0])
    dy = float(end[1]) - float(start[1])
    length_squared = dx * dx + dy * dy
    if length_squared <= 1e-12:
        projected = [float(start[0]), float(start[1])]
        return projected, 0.0, math.dist(point, projected)
    t = max(0.0, min(1.0, ((float(point[0]) - float(start[0])) * dx + (float(point[1]) - float(start[1])) * dy) / length_squared))
    projected = [float(start[0]) + dx * t, float(start[1]) + dy * t]
    return projected, t, math.dist(point, projected)


def _graph_path_arc_data(points: list[list[float]], closed: bool) -> tuple[list[float], list[tuple[int, int, float, float]], float]:
    cumulative = [0.0]
    segments: list[tuple[int, int, float, float]] = []
    segment_count = len(points) if closed else max(0, len(points) - 1)
    total = 0.0
    for index in range(segment_count):
        next_index = (index + 1) % len(points)
        length = math.dist(points[index], points[next_index])
        if length <= 1e-9:
            continue
        segments.append((index, next_index, total, length))
        total += length
        if next_index != 0:
            while len(cumulative) <= next_index:
                cumulative.append(total)
    return cumulative, segments, total


def _graph_point_at_arc(points: list[list[float]], segments: list[tuple[int, int, float, float]], total: float, arc: float) -> list[float]:
    if not points:
        return [0.0, 0.0]
    if total <= 1e-9:
        return [float(points[0][0]), float(points[0][1])]
    value = max(0.0, min(total, float(arc)))
    if value >= total - 1e-9:
        last = segments[-1]
        return [float(points[last[1]][0]), float(points[last[1]][1])]
    for start_index, end_index, start_arc, length in segments:
        if value <= start_arc + length + 1e-9:
            t = max(0.0, min(1.0, (value - start_arc) / length))
            return [
                float(points[start_index][0]) + (float(points[end_index][0]) - float(points[start_index][0])) * t,
                float(points[start_index][1]) + (float(points[end_index][1]) - float(points[start_index][1])) * t,
            ]
    return [float(points[-1][0]), float(points[-1][1])]


def _graph_slice_arc(points: list[list[float]], segments: list[tuple[int, int, float, float]], total: float,
                     start_arc: float, end_arc: float, wrap: bool = False) -> list[list[float]]:
    if end_arc < start_arc:
        return []

    def slice_linear(start: float, end: float) -> list[list[float]]:
        result = [_graph_point_at_arc(points, segments, total, start)]
        for _start_index, end_index, segment_start, length in segments:
            vertex_arc = segment_start + length
            if start + 1e-7 < vertex_arc < end - 1e-7:
                result.append([float(points[end_index][0]), float(points[end_index][1])])
        result.append(_graph_point_at_arc(points, segments, total, end))
        return _dedupe_points(result, closed=False, min_distance=1e-7)

    if not wrap or end_arc <= total + 1e-9:
        return slice_linear(start_arc, min(total, end_arc))
    first = slice_linear(start_arc, total)
    second = slice_linear(0.0, end_arc - total)
    return _dedupe_points(first + second[1:], closed=False, min_distance=1e-7)


def _graph_curvature_stats(points: list[list[float]], closed: bool) -> dict[str, float]:
    if len(points) < 3:
        return {"mean": 0.0, "max": 0.0}
    angles: list[float] = []
    indexes = range(len(points)) if closed else range(1, len(points) - 1)
    for index in indexes:
        previous = points[(index - 1) % len(points)]
        current = points[index]
        following = points[(index + 1) % len(points)]
        first = (float(current[0]) - float(previous[0]), float(current[1]) - float(previous[1]))
        second = (float(following[0]) - float(current[0]), float(following[1]) - float(current[1]))
        first_length = math.hypot(*first)
        second_length = math.hypot(*second)
        if first_length <= 1e-9 or second_length <= 1e-9:
            continue
        cosine = max(-1.0, min(1.0, (first[0] * second[0] + first[1] * second[1]) / (first_length * second_length)))
        angles.append(abs(math.acos(cosine)))
    return {
        "mean": round(sum(angles) / max(1, len(angles)), 6),
        "max": round(max(angles, default=0.0), 6),
    }


def _graph_tangent(points: list[list[float]], at_start: bool) -> list[float]:
    if len(points) < 2:
        return [0.0, 0.0]
    first, second = (points[0], points[1]) if at_start else (points[-2], points[-1])
    dx = float(second[0]) - float(first[0])
    dy = float(second[1]) - float(first[1])
    length = math.hypot(dx, dy)
    return [round(dx / length, 6), round(dy / length, 6)] if length > 1e-9 else [0.0, 0.0]


def _analyze_graph_blocks(graph: dict[str, Any]) -> None:
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    edge_by_id = {str(edge["id"]): edge for edge in edges}
    adjacency: dict[str, list[str]] = {str(node["id"]): [] for node in nodes}
    for edge in edges:
        edge_id = str(edge["id"])
        start = str(edge["startNodeId"])
        end = str(edge["endNodeId"])
        adjacency.setdefault(start, []).append(edge_id)
        adjacency.setdefault(end, []).append(edge_id)

    visited_nodes: set[str] = set()
    components: list[dict[str, Any]] = []
    for node_id in sorted(adjacency):
        if node_id in visited_nodes or not adjacency[node_id]:
            continue
        queue = [node_id]
        component_nodes: set[str] = set()
        component_edges: set[str] = set()
        visited_nodes.add(node_id)
        while queue:
            current = queue.pop()
            component_nodes.add(current)
            for edge_id in adjacency.get(current, []):
                component_edges.add(edge_id)
                edge = edge_by_id[edge_id]
                other = str(edge["endNodeId"] if str(edge["startNodeId"]) == current else edge["startNodeId"])
                if other not in visited_nodes:
                    visited_nodes.add(other)
                    queue.append(other)
        component_id = f"component-{len(components) + 1}"
        cycle_rank = max(0, len(component_edges) - len(component_nodes) + 1)
        components.append({"id": component_id, "nodeIds": sorted(component_nodes), "edgeIds": sorted(component_edges), "cycleRank": cycle_rank})
        for current in component_nodes:
            next(node for node in nodes if str(node["id"]) == current)["componentId"] = component_id
        for edge_id in component_edges:
            edge_by_id[edge_id]["componentId"] = component_id

    discovery: dict[str, int] = {}
    low: dict[str, int] = {}
    edge_stack: list[str] = []
    blocks: list[list[str]] = []
    bridges: set[str] = set()
    articulation: set[str] = set()
    processed_loops: set[str] = set()
    tick = 0

    def pop_block(stop_edge: str) -> None:
        block: list[str] = []
        while edge_stack:
            current = edge_stack.pop()
            block.append(current)
            if current == stop_edge:
                break
        if block:
            blocks.append(block)

    def visit(node_id: str, parent_edge: str | None = None) -> None:
        nonlocal tick
        tick += 1
        discovery[node_id] = tick
        low[node_id] = tick
        child_count = 0
        for edge_id in adjacency.get(node_id, []):
            edge = edge_by_id[edge_id]
            start = str(edge["startNodeId"])
            end = str(edge["endNodeId"])
            if start == end:
                if edge_id not in processed_loops:
                    processed_loops.add(edge_id)
                    blocks.append([edge_id])
                continue
            other = end if start == node_id else start
            if edge_id == parent_edge:
                continue
            if other not in discovery:
                child_count += 1
                edge_stack.append(edge_id)
                visit(other, edge_id)
                low[node_id] = min(low[node_id], low[other])
                if low[other] >= discovery[node_id]:
                    if parent_edge is not None or child_count > 1:
                        articulation.add(node_id)
                    pop_block(edge_id)
                if low[other] > discovery[node_id]:
                    bridges.add(edge_id)
            elif discovery[other] < discovery[node_id]:
                edge_stack.append(edge_id)
                low[node_id] = min(low[node_id], discovery[other])

    for node_id in sorted(adjacency):
        if node_id not in discovery and adjacency[node_id]:
            visit(node_id)
            if edge_stack:
                blocks.append(list(reversed(edge_stack)))
                edge_stack.clear()

    graph_blocks: list[dict[str, Any]] = []
    for index, block_edge_ids in enumerate(blocks, 1):
        unique_edges = sorted(set(block_edge_ids))
        block_nodes = {
            str(edge_by_id[edge_id][key])
            for edge_id in unique_edges
            for key in ("startNodeId", "endNodeId")
        }
        block_id = f"block-{index}"
        cyclic = len(unique_edges) >= len(block_nodes)
        cycle_ids = [f"cycle-{index}"] if cyclic else []
        graph_blocks.append({"id": block_id, "edgeIds": unique_edges, "nodeIds": sorted(block_nodes), "cyclic": cyclic})
        for edge_id in unique_edges:
            edge_by_id[edge_id]["blockId"] = block_id
            edge_by_id[edge_id]["cycleIds"] = list(cycle_ids)
            edge_by_id[edge_id]["bridge"] = edge_id in bridges

    node_by_id = {str(node["id"]): node for node in nodes}
    junction_regions: list[dict[str, Any]] = []
    for node_id, node in node_by_id.items():
        incident = sorted(set(adjacency.get(node_id, [])))
        degree = sum(2 if str(edge_by_id[edge_id]["startNodeId"]) == str(edge_by_id[edge_id]["endNodeId"]) == node_id else 1 for edge_id in incident)
        node["degree"] = degree
        node["type"] = "junction" if degree > 2 else "pass-through" if degree == 2 else "endpoint"
        node["articulation"] = node_id in articulation
        node["blockIds"] = sorted({str(edge_by_id[edge_id].get("blockId") or "") for edge_id in incident if edge_by_id[edge_id].get("blockId")})
        if degree > 2:
            region_id = f"junction-{len(junction_regions) + 1}"
            node["junctionRegionId"] = region_id
            junction_regions.append({
                "id": region_id,
                "nodeIds": [node_id],
                "position": copy.deepcopy(node.get("position") or [0, 0]),
                "gateEdgeIds": incident,
                "localStrokeWidth": float(node.get("localStrokeWidth") or 1.0),
                "confidence": float(node.get("confidence") or 1.0),
            })
    graph["components"] = components
    graph["blocks"] = graph_blocks
    graph["junctionRegions"] = junction_regions
    graph["articulationNodeIds"] = sorted(articulation)
    graph["bridgeEdgeIds"] = sorted(bridges)


def _graph_bbox_for_edges(edges: list[dict[str, Any]]) -> tuple[float, float, float, float]:
    points = [point for edge in edges for point in edge.get("points") or []]
    return _points_bbox(points) if points else (0.0, 0.0, 0.0, 0.0)


def _propose_graph_objects(graph: dict[str, Any], stroke_width: float) -> list[dict[str, Any]]:
    edge_by_id = {str(edge["id"]): edge for edge in graph.get("edges") or []}
    adjacency: dict[str, list[str]] = {str(node["id"]): [] for node in graph.get("nodes") or []}
    for edge_id, edge in edge_by_id.items():
        adjacency.setdefault(str(edge["startNodeId"]), []).append(edge_id)
        adjacency.setdefault(str(edge["endNodeId"]), []).append(edge_id)
    component_by_id = {str(component["id"]): component for component in graph.get("components") or []}
    candidates: list[dict[str, Any]] = []

    for gate_id in graph.get("articulationNodeIds") or []:
        gate_id = str(gate_id)
        component_id = str(next((edge_by_id[edge_id].get("componentId") for edge_id in adjacency.get(gate_id, [])), ""))
        component = component_by_id.get(component_id)
        if not component:
            continue
        component_edge_ids = set(str(value) for value in component.get("edgeIds") or [])
        component_length = sum(float(edge_by_id[edge_id].get("lengthSource") or 0.0) for edge_id in component_edge_ids)
        seen_sets: set[tuple[str, ...]] = set()
        for seed_edge_id in sorted(set(adjacency.get(gate_id, []))):
            branch_edges: set[str] = set()
            queue_edges = [seed_edge_id]
            while queue_edges:
                edge_id = queue_edges.pop()
                if edge_id in branch_edges or edge_id not in component_edge_ids:
                    continue
                branch_edges.add(edge_id)
                edge = edge_by_id[edge_id]
                for node_id in (str(edge["startNodeId"]), str(edge["endNodeId"])):
                    if node_id == gate_id:
                        continue
                    queue_edges.extend(adjacency.get(node_id, []))
            key = tuple(sorted(branch_edges))
            if not key or key in seen_sets or len(branch_edges) >= len(component_edge_ids):
                continue
            seen_sets.add(key)
            branch = [edge_by_id[edge_id] for edge_id in key]
            remainder = [edge_by_id[edge_id] for edge_id in component_edge_ids - branch_edges]
            branch_length = sum(float(edge.get("lengthSource") or 0.0) for edge in branch)
            remainder_length = max(0.0, component_length - branch_length)
            if branch_length < max(3.0, float(stroke_width) * 3.0) or remainder_length <= 1e-6:
                continue
            ratio = branch_length / max(1e-9, component_length)
            if ratio < 0.015 or ratio > 0.68:
                continue
            min_x, min_y, max_x, max_y = _graph_bbox_for_edges(branch)
            width = max_x - min_x
            height = max_y - min_y
            minor = max(min(width, height), max(0.2, float(stroke_width) * 0.25))
            aspect = max(width, height) / minor
            if aspect > 7.0:
                continue
            candidate_nodes = {str(edge[key_name]) for edge in branch for key_name in ("startNodeId", "endNodeId")}
            cycle_rank = max(0, len(branch) - len(candidate_nodes) + 1)
            cyclic_edges = sum(1 for edge in branch if edge.get("cycleIds") or edge.get("closed"))
            internal_junctions = sum(1 for node in graph.get("nodes") or [] if str(node["id"]) in candidate_nodes - {gate_id} and int(node.get("degree") or 0) > 2)
            if cycle_rank <= 0 and cyclic_edges <= 0 and internal_junctions < 2:
                continue
            diagonal = max(1e-6, math.hypot(width, height))
            compactness = max(0.0, min(1.0, 3.5 / max(1.0, aspect)))
            density = max(0.0, min(1.0, branch_length / (diagonal * 5.0)))
            closure = max(0.0, min(1.0, (cycle_rank + cyclic_edges * 0.5) / 2.0))
            branching = max(0.0, min(1.0, internal_junctions / 3.0))
            size_score = max(0.0, 1.0 - abs(ratio - 0.28) / 0.38)
            rmin_x, rmin_y, rmax_x, rmax_y = _graph_bbox_for_edges(remainder)
            remainder_minor = max(min(rmax_x - rmin_x, rmax_y - rmin_y), max(0.2, float(stroke_width) * 0.25))
            remainder_aspect = max(rmax_x - rmin_x, rmax_y - rmin_y) / remainder_minor
            trunk_contrast = max(0.0, min(1.0, (remainder_aspect / max(1.0, aspect) - 1.0) / 4.0))
            score = 0.30 * closure + 0.22 * compactness + 0.15 * density + 0.13 * branching + 0.10 * size_score + 0.10 * trunk_contrast
            confidence = max(0.50, min(0.98, 0.46 + score * 0.54))
            candidates.append({
                "edgeIds": list(key),
                "gateNodeIds": [gate_id],
                "componentId": component_id,
                "confidence": round(confidence, 4),
                "autoApplicable": confidence >= 0.92,
                "features": {
                    "cycleRank": cycle_rank,
                    "cyclicEdges": cyclic_edges,
                    "internalJunctions": internal_junctions,
                    "compactness": round(compactness, 4),
                    "density": round(density, 4),
                    "trunkContrast": round(trunk_contrast, 4),
                    "lengthRatio": round(ratio, 4),
                },
            })

    ranked = sorted(candidates, key=lambda item: (-float(item["confidence"]), len(item["edgeIds"]), item["edgeIds"]))
    selected: list[dict[str, Any]] = []
    for candidate in ranked:
        edge_set = set(candidate["edgeIds"])
        if any(len(edge_set & set(existing["edgeIds"])) / max(1, len(edge_set | set(existing["edgeIds"]))) >= 0.82 for existing in selected):
            continue
        candidate = copy.deepcopy(candidate)
        candidate["id"] = f"proposal-{len(selected) + 1}"
        candidate["name"] = f"Kompakt motif {len(selected) + 1}"
        candidate["graphRevision"] = int(graph.get("revision") or 1)
        candidate["createdBy"] = "structural-analysis"
        candidate["warnings"] = [] if candidate["autoApplicable"] else ["Onaylanmadan geometri veya sahiplik değişmez."]
        selected.append(candidate)
        if len(selected) >= 12:
            break
    return selected


def build_vector_topology(vector_paths: list[dict[str, Any]], source_width: float, source_height: float,
                          stroke_width: float = 1.0, evidence_mask: Any | None = None,
                          evidence_scale: float = 1.0) -> dict[str, Any]:
    """Build a conservative attributed graph without proximity-only repairs."""
    clean_paths: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for index, vector_path in enumerate(vector_paths or []):
        points = _dedupe_points(
            [[float(point[0]), float(point[1])] for point in vector_path.get("points") or [] if len(point) >= 2 and math.isfinite(float(point[0])) and math.isfinite(float(point[1]))],
            closed=bool(vector_path.get("closed")),
            min_distance=1e-7,
        )
        if len(points) < 2:
            continue
        path_id = str(vector_path.get("id") or f"path-{index + 1}")
        while path_id in used_ids:
            path_id = f"{path_id}-{index + 1}"
        used_ids.add(path_id)
        _cumulative, segments, total = _graph_path_arc_data(points, bool(vector_path.get("closed")))
        if total <= 1e-8:
            continue
        clean_paths.append({"id": path_id, "points": points, "closed": bool(vector_path.get("closed")), "data": vector_path, "segments": segments, "total": total})

    global_stroke = max(0.2, float(stroke_width or 1.0))
    strict_tolerance = max(0.12, min(0.45, global_stroke * 0.12))
    split_arcs: dict[int, list[float]] = {index: [] for index in range(len(clean_paths))}
    endpoint_targets: dict[tuple[int, int], tuple[list[float], float]] = {}
    cell_size = max(1.0, strict_tolerance * 4.0)
    segment_grid: dict[tuple[int, int], list[tuple[int, int, list[float], list[float], float, float]]] = {}
    for path_index, path_record in enumerate(clean_paths):
        for segment_index, (start_index, end_index, start_arc, length) in enumerate(path_record["segments"]):
            start = path_record["points"][start_index]
            end = path_record["points"][end_index]
            min_cell_x = math.floor((min(start[0], end[0]) - strict_tolerance) / cell_size)
            max_cell_x = math.floor((max(start[0], end[0]) + strict_tolerance) / cell_size)
            min_cell_y = math.floor((min(start[1], end[1]) - strict_tolerance) / cell_size)
            max_cell_y = math.floor((max(start[1], end[1]) + strict_tolerance) / cell_size)
            entry = (path_index, segment_index, start, end, start_arc, length)
            for cell_x in range(min_cell_x, max_cell_x + 1):
                for cell_y in range(min_cell_y, max_cell_y + 1):
                    segment_grid.setdefault((cell_x, cell_y), []).append(entry)

    for path_index, path_record in enumerate(clean_paths):
        if path_record["closed"]:
            continue
        for endpoint_side, point in ((0, path_record["points"][0]), (1, path_record["points"][-1])):
            cell_x = math.floor(point[0] / cell_size)
            cell_y = math.floor(point[1] / cell_size)
            best: tuple[float, int, float, list[float]] | None = None
            checked: set[tuple[int, int]] = set()
            for offset_x in (-1, 0, 1):
                for offset_y in (-1, 0, 1):
                    for target_index, segment_index, start, end, start_arc, length in segment_grid.get((cell_x + offset_x, cell_y + offset_y), []):
                        if target_index == path_index or (target_index, segment_index) in checked:
                            continue
                        checked.add((target_index, segment_index))
                        projected, t, distance = _graph_projection(point, start, end)
                        if distance > strict_tolerance or t <= 1e-4 or t >= 1.0 - 1e-4:
                            continue
                        arc = start_arc + length * t
                        candidate = (distance, target_index, arc, projected)
                        if best is None or candidate[:3] < best[:3]:
                            best = candidate
            if best is not None:
                distance, target_index, arc, projected = best
                split_arcs[target_index].append(arc)
                endpoint_targets[(path_index, endpoint_side)] = (projected, distance)

    distance_field = None
    if cv2 is not None and np is not None and evidence_mask is not None:
        try:
            distance_field = cv2.distanceTransform((evidence_mask > 0).astype(np.uint8), cv2.DIST_L2, 3)
        except (ValueError, TypeError, cv2.error):
            distance_field = None

    def width_at(point: list[float]) -> float:
        if distance_field is None:
            return global_stroke
        scale = max(1e-6, float(evidence_scale or 1.0))
        x = max(0, min(distance_field.shape[1] - 1, int(round(float(point[0]) * scale))))
        y = max(0, min(distance_field.shape[0] - 1, int(round(float(point[1]) * scale))))
        return max(0.2, float(distance_field[y, x]) * 2.0 / scale)

    fragments: list[dict[str, Any]] = []
    for path_index, path_record in enumerate(clean_paths):
        points = copy.deepcopy(path_record["points"])
        if (path_index, 0) in endpoint_targets:
            points[0] = copy.deepcopy(endpoint_targets[(path_index, 0)][0])
        if (path_index, 1) in endpoint_targets:
            points[-1] = copy.deepcopy(endpoint_targets[(path_index, 1)][0])
        _cumulative, segments, total = _graph_path_arc_data(points, path_record["closed"])
        arcs = sorted(float(value) for value in split_arcs[path_index] if 1e-7 < float(value) < total - 1e-7)
        unique_arcs: list[float] = []
        for arc in arcs:
            if not unique_arcs or abs(arc - unique_arcs[-1]) > max(1e-5, strict_tolerance * 0.2):
                unique_arcs.append(arc)
        intervals: list[tuple[float, float, bool]] = []
        if path_record["closed"]:
            if not unique_arcs:
                intervals = [(0.0, total, True)]
            elif len(unique_arcs) == 1:
                intervals = [(unique_arcs[0], unique_arcs[0] + total, True)]
            else:
                intervals = [(unique_arcs[index], unique_arcs[(index + 1) % len(unique_arcs)] + (total if index == len(unique_arcs) - 1 else 0.0), False) for index in range(len(unique_arcs))]
        else:
            boundaries = [0.0, *unique_arcs, total]
            intervals = [(boundaries[index], boundaries[index + 1], False) for index in range(len(boundaries) - 1)]
        for fragment_index, (start_arc, end_arc, closed_fragment) in enumerate(intervals):
            fragment_points = _graph_slice_arc(points, segments, total, start_arc, end_arc, wrap=path_record["closed"])
            if closed_fragment and len(fragment_points) > 2 and math.dist(fragment_points[0], fragment_points[-1]) <= 1e-7:
                fragment_points.pop()
            if len(fragment_points) < 2 or _polyline_length(fragment_points + ([fragment_points[0]] if closed_fragment else [])) <= 1e-8:
                continue
            fragments.append({
                "pathIndex": path_index,
                "pathId": path_record["id"],
                "points": fragment_points,
                "closed": closed_fragment,
                "sourceInterval": [round(start_arc / total, 9), round(end_arc / total, 9)],
                "fragmentIndex": fragment_index,
                "data": path_record["data"],
            })

    nodes: list[dict[str, Any]] = []
    node_grid: dict[tuple[int, int], list[int]] = {}

    def node_for(point: list[float]) -> str:
        cell_x = math.floor(point[0] / cell_size)
        cell_y = math.floor(point[1] / cell_size)
        for offset_x in (-1, 0, 1):
            for offset_y in (-1, 0, 1):
                for node_index in node_grid.get((cell_x + offset_x, cell_y + offset_y), []):
                    if math.dist(nodes[node_index]["position"], point) <= strict_tolerance:
                        return str(nodes[node_index]["id"])
        node_id = f"node-{len(nodes) + 1}"
        nodes.append({
            "id": node_id,
            "position": [round(float(point[0]), 6), round(float(point[1]), 6)],
            "localStrokeWidth": round(width_at(point), 4),
            "confidence": 1.0,
            "lineage": {"createdBy": "trace-endpoint"},
        })
        node_grid.setdefault((cell_x, cell_y), []).append(len(nodes) - 1)
        return node_id

    edges: list[dict[str, Any]] = []
    path_fragment_counts: dict[str, int] = {}
    for fragment in fragments:
        path_id = str(fragment["pathId"])
        path_fragment_counts[path_id] = path_fragment_counts.get(path_id, 0) + 1
    for fragment in fragments:
        points = copy.deepcopy(fragment["points"])
        start_node_id = node_for(points[0])
        end_node_id = start_node_id if fragment["closed"] else node_for(points[-1])
        node_by_id = {str(node["id"]): node for node in nodes}
        points[0] = copy.deepcopy(node_by_id[start_node_id]["position"])
        if not fragment["closed"]:
            points[-1] = copy.deepcopy(node_by_id[end_node_id]["position"])
        path_data = copy.deepcopy(fragment["data"])
        for key in ("id", "points", "closed", "operation", "removed", "length", "area"):
            path_data.pop(key, None)
        path_id = str(fragment["pathId"])
        edge_id = f"edge:{path_id}" if path_fragment_counts[path_id] == 1 else f"edge:{path_id}:s{int(fragment['fragmentIndex']) + 1}"
        widths = [width_at(points[0]), width_at(points[len(points) // 2]), width_at(points[-1])]
        edges.append({
            "id": edge_id,
            "startNodeId": start_node_id,
            "endNodeId": end_node_id,
            "points": points,
            "closed": bool(fragment["closed"]),
            "lengthSource": round(_polyline_length(points + ([points[0]] if fragment["closed"] else [])), 6),
            "widthProfile": [round(value, 4) for value in widths],
            "tangentStart": _graph_tangent(points, True),
            "tangentEnd": _graph_tangent(points, False),
            "curvatureStats": _graph_curvature_stats(points, bool(fragment["closed"])),
            "contourRole": "closed-region" if fragment["closed"] else "stroke",
            "operation": normalize_operation(fragment["data"].get("operation"), "engrave_line"),
            "removed": bool(fragment["data"].get("removed")),
            "pathData": path_data,
            "lineage": {
                "canonicalEdgeLineageId": f"trace:{path_id}",
                "parentEdgeId": None,
                "sourcePathIds": [path_id],
                "legacyPathId": path_id,
                "sourceInterval": copy.deepcopy(fragment["sourceInterval"]),
                "sourceComponentId": fragment["data"].get("sourceComponentId"),
            },
            "warnings": copy.deepcopy(fragment["data"].get("warnings") or []),
        })

    graph = {"revision": 1, "nodes": nodes, "edges": edges, "analysisVersion": "attributed-graph-p1"}
    _analyze_graph_blocks(graph)
    objects: list[dict[str, Any]] = []
    edge_by_id = {str(edge["id"]): edge for edge in edges}
    for component_index, component in enumerate(graph.get("components") or [], 1):
        component_edges = [edge_by_id[str(edge_id)] for edge_id in component.get("edgeIds") or []]
        min_x, min_y, max_x, max_y = _graph_bbox_for_edges(component_edges)
        operations: dict[str, int] = {}
        for edge in component_edges:
            operation = normalize_operation(edge.get("operation"), "engrave_line")
            operations[operation] = operations.get(operation, 0) + 1
        operation = max(operations, key=operations.get) if operations else "engrave_line"
        objects.append({
            "id": f"object:component-{component_index}",
            "name": f"Ana yol {component_index}",
            "edgeRefs": [{"edgeId": str(edge_id), "ownership": "exclusive", "role": "stroke", "emit": True} for edge_id in component.get("edgeIds") or []],
            "attachments": [],
            "localFrame": {"originSource": [(min_x + max_x) / 2.0, (min_y + max_y) / 2.0], "originDesign": [(min_x + max_x) / 2.0, (min_y + max_y) / 2.0]},
            "transform": [1, 0, 0, 1, 0, 0],
            "transformComponents": {"translateX": 0, "translateY": 0, "scaleX": 1, "scaleY": 1, "rotation": 0},
            "transformRevision": 0,
            "resizePolicy": "scale",
            "locked": False,
            "removed": False,
            "deformable": True,
            "operation": operation,
            "confidence": 1.0,
            "createdBy": "structural-analysis-base",
        })
    proposals = _propose_graph_objects(graph, global_stroke)
    return {
        "vectorModelVersion": 2,
        "source": {"width": float(source_width), "height": float(source_height), "traceScale": float(evidence_scale or 1.0), "analysisVersion": "attributed-graph-p1"},
        "sourceToDesign": {"matrix": [1, 0, 0, 1, 0, 0], "unit": "source", "designWidth": float(source_width), "designHeight": float(source_height)},
        "vectorGraph": graph,
        "vectorObjects": objects,
        "connections": [],
        "occlusionMasks": [],
        "objectProposals": proposals,
        "repairProposals": [],
        "objectTransformRevision": 0,
        "vectorPathsDerivedFromRevision": 0,
        "topologyStats": {
            "graphNodes": len(nodes),
            "graphEdges": len(edges),
            "junctionRegions": len(graph.get("junctionRegions") or []),
            "articulationNodes": len(graph.get("articulationNodeIds") or []),
            "biconnectedBlocks": len(graph.get("blocks") or []),
            "cycleBlocks": sum(1 for block in graph.get("blocks") or [] if block.get("cyclic")),
            "exactJunctionProjections": len(endpoint_targets),
            "autoRepairsApplied": 0,
            "ambiguousRepairs": 0,
            "objectProposalCount": len(proposals),
        },
    }


def attach_vector_topology_payload(vector: dict[str, Any], evidence_mask: Any | None = None,
                                   evidence_scale: float = 1.0) -> dict[str, Any]:
    topology = build_vector_topology(
        vector.get("vectorPaths") or [],
        float(vector.get("sourceWidth") or 1.0),
        float(vector.get("sourceHeight") or 1.0),
        stroke_width=float((vector.get("stats") or {}).get("estimatedStrokeWidth") or 1.0),
        evidence_mask=evidence_mask,
        evidence_scale=evidence_scale,
    )
    vector.update(topology)
    vector.setdefault("stats", {}).update(topology.get("topologyStats") or {})
    return vector


def refresh_vector_topology_operations(vector: dict[str, Any]) -> dict[str, Any]:
    operations = {
        str(vector_path.get("id") or ""): normalize_operation(vector_path.get("operation"), "engrave_line")
        for vector_path in vector.get("vectorPaths") or []
    }
    graph = vector.get("vectorGraph") or {}
    edge_by_id = {str(edge.get("id") or ""): edge for edge in graph.get("edges") or []}
    for edge in edge_by_id.values():
        legacy_id = str((edge.get("lineage") or {}).get("legacyPathId") or "")
        if legacy_id in operations:
            edge["operation"] = operations[legacy_id]
    for vector_object in vector.get("vectorObjects") or []:
        counts: dict[str, int] = {}
        for edge_ref in vector_object.get("edgeRefs") or []:
            edge = edge_by_id.get(str(edge_ref.get("edgeId") or ""))
            if edge:
                operation = normalize_operation(edge.get("operation"), "engrave_line")
                counts[operation] = counts.get(operation, 0) + 1
        if counts:
            vector_object["operation"] = max(counts, key=counts.get)
    return vector


def _graph_edge_outward_tangent(edge: dict[str, Any], node_id: str) -> tuple[float, float]:
    if str(edge.get("startNodeId") or "") == node_id:
        tangent = edge.get("tangentStart") or [0.0, 0.0]
        return float(tangent[0]), float(tangent[1])
    tangent = edge.get("tangentEnd") or [0.0, 0.0]
    return -float(tangent[0]), -float(tangent[1])


def _graph_edge_pair_affinity(first: dict[str, Any], second: dict[str, Any], node_id: str) -> float:
    first_tangent = _graph_edge_outward_tangent(first, node_id)
    second_tangent = _graph_edge_outward_tangent(second, node_id)
    first_length = math.hypot(*first_tangent)
    second_length = math.hypot(*second_tangent)
    dot = 0.0
    if first_length > 1e-9 and second_length > 1e-9:
        dot = max(-1.0, min(1.0, (
            first_tangent[0] * second_tangent[0] + first_tangent[1] * second_tangent[1]
        ) / (first_length * second_length)))
    straight_continuity = (1.0 - dot) / 2.0
    first_widths = [float(value) for value in first.get("widthProfile") or [1.0]]
    second_widths = [float(value) for value in second.get("widthProfile") or [1.0]]
    first_width = sum(first_widths) / max(1, len(first_widths))
    second_width = sum(second_widths) / max(1, len(second_widths))
    width_similarity = 1.0 - min(1.0, abs(first_width - second_width) / max(0.2, first_width, second_width))
    first_curvature = float((first.get("curvatureStats") or {}).get("mean") or 0.0)
    second_curvature = float((second.get("curvatureStats") or {}).get("mean") or 0.0)
    curvature_similarity = 1.0 - min(1.0, abs(first_curvature - second_curvature) / math.pi)
    shared_cycle = bool(set(first.get("cycleIds") or []) & set(second.get("cycleIds") or []))
    same_block = bool(first.get("blockId") and first.get("blockId") == second.get("blockId"))
    return max(0.01, (
        0.08
        + 2.8 * straight_continuity * straight_continuity
        + 0.65 * width_similarity
        + 0.55 * curvature_similarity
        + (2.4 if shared_cycle else 0.35 if same_block else 0.0)
    ))


def _graph_cut_reachable(vertices: list[str], pair_weights: dict[tuple[str, str], float],
                         source_weights: dict[str, float], sink_weights: dict[str, float]) -> set[str]:
    source = "\x00source"
    sink = "\x00sink"
    adjacency: dict[str, list[list[Any]]] = {vertex: [] for vertex in [*vertices, source, sink]}

    def add_directed(start: str, end: str, capacity: float) -> None:
        forward: list[Any] = [end, float(max(0.0, capacity)), None]
        reverse: list[Any] = [start, 0.0, forward]
        forward[2] = reverse
        adjacency[start].append(forward)
        adjacency[end].append(reverse)

    for (first, second), capacity in pair_weights.items():
        add_directed(first, second, capacity)
        add_directed(second, first, capacity)
    for vertex in vertices:
        if source_weights.get(vertex, 0.0) > 0:
            add_directed(source, vertex, source_weights[vertex])
        if sink_weights.get(vertex, 0.0) > 0:
            add_directed(vertex, sink, sink_weights[vertex])

    while True:
        level = {source: 0}
        queue = [source]
        for current in queue:
            for edge in adjacency[current]:
                if edge[1] > 1e-9 and edge[0] not in level:
                    level[edge[0]] = level[current] + 1
                    queue.append(edge[0])
        if sink not in level:
            break
        cursor = {vertex: 0 for vertex in adjacency}

        def push(current: str, available: float) -> float:
            if current == sink:
                return available
            while cursor[current] < len(adjacency[current]):
                edge = adjacency[current][cursor[current]]
                if edge[1] > 1e-9 and level.get(edge[0]) == level[current] + 1:
                    sent = push(edge[0], min(available, edge[1]))
                    if sent > 1e-9:
                        edge[1] -= sent
                        edge[2][1] += sent
                        return sent
                cursor[current] += 1
            return 0.0

        while push(source, float("inf")) > 1e-9:
            pass

    reachable = {source}
    queue = [source]
    for current in queue:
        for edge in adjacency[current]:
            if edge[1] > 1e-9 and edge[0] not in reachable:
                reachable.add(edge[0])
                queue.append(edge[0])
    return reachable - {source, sink}


def _graph_cut_auto_background(graph: dict[str, Any], foreground: set[str], keep_gate_ids: set[str],
                               protected_edge_ids: set[str] | None = None) -> set[str]:
    edge_by_id = {str(edge.get("id") or ""): edge for edge in graph.get("edges") or []}
    foreground_components = {
        str(edge_by_id[edge_id].get("componentId") or "")
        for edge_id in foreground
        if edge_id in edge_by_id
    }
    blocked_by_keep = {
        edge_id
        for edge_id, edge in edge_by_id.items()
        if str(edge.get("startNodeId") or "") in keep_gate_ids or str(edge.get("endNodeId") or "") in keep_gate_ids
    }
    protected = set(protected_edge_ids or set())
    candidates = [
        edge for edge_id, edge in edge_by_id.items()
        if edge_id not in foreground
        and edge_id not in protected
        and edge_id not in blocked_by_keep
        and (not foreground_components or str(edge.get("componentId") or "") in foreground_components)
    ]
    if not candidates:
        return set()

    def background_score(edge: dict[str, Any]) -> tuple[float, float, str]:
        length = float(edge.get("lengthSource") or 0.0)
        curvature = float((edge.get("curvatureStats") or {}).get("mean") or 0.0)
        straightness = 1.0 / (1.0 + curvature * 4.0)
        bridge_bonus = 1.4 if edge.get("bridge") else 1.0
        return length * (1.0 + straightness) * bridge_bonus, length, str(edge.get("id") or "")

    ranked = sorted(candidates, key=background_score, reverse=True)
    best_score = max(1e-9, background_score(ranked[0])[0])
    return {
        str(edge.get("id") or "")
        for edge in ranked[:4]
        if background_score(edge)[0] >= best_score * 0.42
    }


def analyze_vector_separation(payload: dict[str, Any]) -> dict[str, Any]:
    model = payload.get("vectorModel") or payload.get("model") or payload
    graph = model.get("vectorGraph") or {}
    revision = int(graph.get("revision") or 0)
    requested_revision = int(payload.get("graphRevision") or revision)
    if revision <= 0 or requested_revision != revision:
        raise ValueError("Vektor graph revizyonu degisti; ayrim onerisi yeniden hesaplanmali.")
    edge_ids = {str(edge.get("id") or "") for edge in graph.get("edges") or []}
    foreground = {str(value) for value in payload.get("foregroundEdgeIds") or []}
    background = {str(value) for value in payload.get("backgroundEdgeIds") or []}
    if not foreground:
        raise ValueError("Ayrim analizi icin en az bir on plan edge secilmeli.")
    if foreground & background:
        raise ValueError("Ayni edge hem on plan hem arka plan tohumu olamaz.")
    missing = (foreground | background) - edge_ids
    if missing:
        raise ValueError(f"Ayrim analizi bulunmayan edge iceriyor: {sorted(missing)[0]}")
    ranked: list[tuple[float, dict[str, Any]]] = []
    for proposal in model.get("objectProposals") or []:
        if int(proposal.get("graphRevision") or 0) != revision:
            continue
        proposal_edges = {str(value) for value in proposal.get("edgeIds") or []}
        overlap = foreground & proposal_edges
        if not overlap or proposal_edges & background:
            continue
        seed_coverage = len(overlap) / max(1, len(foreground))
        proposal_coverage = len(overlap) / max(1, len(proposal_edges))
        score = 0.68 * seed_coverage + 0.32 * proposal_coverage
        ranked.append((score, proposal))
    warnings: list[str] = []
    proposal: dict[str, Any] | None = None
    if ranked:
        match_score, proposal = max(ranked, key=lambda item: (item[0], float(item[1].get("confidence") or 0.0)))
        confidence = min(float(proposal.get("confidence") or 0.0), 0.55 + match_score * 0.45)
        proposal_id = str(proposal.get("id") or "")
        if match_score < 0.58:
            warnings.append("Tohum secimi yapisal oneriyi zayif eslestirdi; onizlemeyi kontrol edin.")
    else:
        confidence = 0.35
        proposal_id = "seed-only"
        warnings.append("Hazir yapisal oneriden eslesme bulunamadi; edge graph-cut yalniz kullanici tohumlariyla calisti.")
    proposal_edge_ids = {str(value) for value in (proposal or {}).get("edgeIds") or []}
    overrides = payload.get("gateOverrides") or {}
    normalized_overrides = {
        str(node_id): str(value or "cut").lower()
        for node_id, value in overrides.items()
        if str(value or "cut").lower() in {"cut", "keep"}
    }
    keep_gate_ids = {node_id for node_id, value in normalized_overrides.items() if value == "keep"}
    explicit_background = bool(background)
    if not background:
        background = _graph_cut_auto_background(graph, foreground, keep_gate_ids, proposal_edge_ids)
        if background:
            warnings.append("Arka plan tohumu otomatik olarak uzun ana yollardan secildi.")

    edge_by_id = {str(edge.get("id") or ""): edge for edge in graph.get("edges") or []}
    incident: dict[str, list[str]] = {}
    for edge_id, edge in edge_by_id.items():
        incident.setdefault(str(edge.get("startNodeId") or ""), []).append(edge_id)
        incident.setdefault(str(edge.get("endNodeId") or ""), []).append(edge_id)
    pair_weights: dict[tuple[str, str], float] = {}
    for node_id, raw_edge_ids in incident.items():
        node_edge_ids = sorted(set(raw_edge_ids))
        override = normalized_overrides.get(node_id)
        for first_index, first_id in enumerate(node_edge_ids):
            for second_id in node_edge_ids[first_index + 1:]:
                key = (first_id, second_id)
                if override == "cut":
                    weight = 0.001
                elif override == "keep":
                    weight = 1_000_000.0
                else:
                    weight = _graph_edge_pair_affinity(edge_by_id[first_id], edge_by_id[second_id], node_id)
                pair_weights[key] = pair_weights.get(key, 0.0) + weight

    hard_capacity = 10_000_000.0
    source_weights = {edge_id: hard_capacity for edge_id in foreground}
    sink_weights = {edge_id: hard_capacity for edge_id in background}
    for edge_id in edge_ids - foreground - background:
        if edge_id in proposal_edge_ids:
            source_weights[edge_id] = max(source_weights.get(edge_id, 0.0), 3.5 * max(0.5, confidence))
        else:
            sink_weights[edge_id] = max(sink_weights.get(edge_id, 0.0), 0.04)
    proposal_edges = _graph_cut_reachable(sorted(edge_ids), pair_weights, source_weights, sink_weights)
    proposal_edges |= foreground
    proposal_edges -= background

    cut_gate_ids: set[str] = set()
    candidate_gate_ids = set(str(value) for value in (proposal or {}).get("gateNodeIds") or [])
    for node_id, node_edge_ids in incident.items():
        inside = sum(1 for edge_id in set(node_edge_ids) if edge_id in proposal_edges)
        outside = sum(1 for edge_id in set(node_edge_ids) if edge_id not in proposal_edges)
        if inside and outside:
            candidate_gate_ids.add(node_id)
            if normalized_overrides.get(node_id) != "keep":
                cut_gate_ids.add(node_id)
    if proposal_id == "seed-only" and len(proposal_edges) > len(foreground):
        confidence = min(0.72, confidence + 0.08)
    if explicit_background:
        confidence = min(0.98, confidence + 0.03)
    return {
        "graphRevision": revision,
        "proposalId": proposal_id,
        "foregroundEdgeIds": sorted(proposal_edges),
        "backgroundEdgeIds": sorted(edge_ids - proposal_edges),
        "seedForegroundEdgeIds": sorted(foreground),
        "seedBackgroundEdgeIds": sorted(background),
        "cutGates": sorted(cut_gate_ids),
        "candidateGateNodeIds": sorted(candidate_gate_ids),
        "gateOverrides": normalized_overrides,
        "confidence": round(max(0.0, min(1.0, confidence)), 4),
        "warnings": warnings,
    }


def vectorize_image(path: Path,
                    threshold: int = 140,
                    threshold_mode: str = "manual",
                    mode: str = "outline",
                    blur: int = 3,
                    min_area: float = 40.0,
                    min_length: float = 8.0,
                    simplify: float = 0.8,
                    smooth: int = 1,
                    invert: bool = True,
                    max_contours: int = 1200,
                    contrast: float = 1.0,
                    morph_open: int = 0,
                    morph_close: int = 0,
                    adaptive_block: int = 35,
                    adaptive_c: float = 5.0,
                    max_dimension: int = 1800,
                    remove_border: bool = True,
                    stitch_gap: float = 0.0,
                    background_normalize: bool = True,
                    denoise: int = 3) -> dict[str, Any]:
    if cv2 is None or np is None:
        raise ValueError("Foto vektorlestirme icin OpenCV bulunamadi.")
    if not path.exists():
        raise ValueError(f"Gorsel bulunamadi: {path}")

    timings: dict[str, float] = {}
    total_start = time.perf_counter()
    stage_start = total_start
    image, image_stats = open_vector_source_image(path, max_dimension=max_dimension, contrast=contrast)
    timings["load"] = time.perf_counter() - stage_start
    source_profile = clean_line_art_source_profile(image)
    clean_line_art = bool(source_profile.get("cleanLineArt"))
    effective_background_normalize = bool(background_normalize) and not clean_line_art
    effective_denoise = 0 if clean_line_art else int(denoise)
    stage_start = time.perf_counter()
    binary, used_threshold, threshold_source = build_vector_binary(
        image,
        threshold=threshold,
        threshold_mode=threshold_mode,
        blur=blur,
        invert=invert,
        adaptive_block=adaptive_block,
        adaptive_c=adaptive_c,
        morph_open=morph_open,
        morph_close=morph_close,
        background_normalize=effective_background_normalize,
        denoise=effective_denoise,
    )
    threshold_binary = binary.copy()
    timings["threshold"] = time.perf_counter() - stage_start
    stage_start = time.perf_counter()
    binary, removed_border_components = clean_border_components(binary, remove_border, margin=3)
    timings["borderCleanup"] = time.perf_counter() - stage_start

    requested_mode = (mode or "auto").lower()
    cad_centerline = requested_mode in {"cad_centerline", "centerline_cad"}
    mode = "centerline" if cad_centerline else "auto" if requested_mode == "auto" else requested_mode
    cad_trace_scale = 1.0
    if cad_centerline:
        source_height, source_width = image.shape[:2]
        available_scale = float(max_dimension) / max(1.0, float(max(source_width, source_height)))
        # Trace small CAD details at up to 4x and scale the vectors back.
        cad_trace_scale = max(1.0, min(4.0, available_scale))
        if cad_trace_scale >= 1.20:
            stage_start = time.perf_counter()
            trace_width = max(1, int(round(source_width * cad_trace_scale)))
            trace_height = max(1, int(round(source_height * cad_trace_scale)))
            trace_image = cv2.resize(image, (trace_width, trace_height), interpolation=cv2.INTER_CUBIC)
            binary, used_threshold, threshold_source = build_vector_binary(
                trace_image,
                threshold=threshold,
                threshold_mode=threshold_mode,
                blur=blur,
                invert=invert,
                adaptive_block=adaptive_block,
                adaptive_c=adaptive_c,
                morph_open=morph_open,
                morph_close=morph_close,
                background_normalize=effective_background_normalize,
                denoise=effective_denoise,
            )
            threshold_binary = binary.copy()
            binary, removed_border_components = clean_border_components(binary, remove_border, margin=3)
            timings["cadHighResolutionTrace"] = time.perf_counter() - stage_start
        else:
            cad_trace_scale = 1.0
    pre_trace_stroke_estimate = estimate_stroke_width(binary)
    foreground_ratio = float(np.count_nonzero(binary)) / float(max(1, binary.shape[0] * binary.shape[1]))
    effective_invert = bool(invert)
    effective_min_length = float(min_length)
    effective_stitch_gap = float(stitch_gap)
    if clean_line_art:
        effective_min_length = min(effective_min_length, 5.0)
    auto_stencil_stats: dict[str, Any] = {}
    auto_centerline_stats: dict[str, Any] = {}
    if mode == "auto":
        stencil_candidate = None
        if not clean_line_art and bool(invert) and 0 < pre_trace_stroke_estimate <= 6.0 and foreground_ratio <= 0.18:
            stage_start = time.perf_counter()
            stencil_candidate = build_bright_stencil_candidate(
                image,
                blur=blur,
                adaptive_block=adaptive_block,
                adaptive_c=adaptive_c,
                morph_open=morph_open,
                morph_close=morph_close,
                denoise=denoise,
                remove_border=remove_border,
            )
            timings["autoStencil"] = time.perf_counter() - stage_start
        if (
            stencil_candidate
            and float(stencil_candidate["strokeWidth"]) >= max(7.0, pre_trace_stroke_estimate * 1.7)
            and float(stencil_candidate["foregroundRatio"]) >= max(0.08, foreground_ratio * 1.8)
        ):
            binary = stencil_candidate["binary"]
            threshold_binary = stencil_candidate["thresholdBinary"]
            threshold_source = stencil_candidate["thresholdSource"]
            used_threshold = float(stencil_candidate["usedThreshold"])
            removed_border_components = int(stencil_candidate["removedBorderComponents"])
            pre_trace_stroke_estimate = float(stencil_candidate["strokeWidth"])
            foreground_ratio = float(stencil_candidate["foregroundRatio"])
            effective_invert = False
            effective_background_normalize = False
            mode = "vtracer"
            auto_stencil_stats = {
                "autoStencilTrace": True,
                "autoStencilThreshold": round(used_threshold, 2),
                "autoStencilForegroundRatio": round(foreground_ratio, 4),
                "autoStencilStrokeWidth": round(pre_trace_stroke_estimate, 1),
            }
        else:
            # Potrace works best for genuinely thin line art. Filled ornamental
            # ribbons with soft tips can have a low foreground ratio while still
            # needing a smooth filled contour; route those to VTracer.
            source_height, source_width = binary.shape[:2]
            if is_wide_technical_line_drawing(
                width=float(source_width),
                height=float(source_height),
                stroke_width=float(pre_trace_stroke_estimate),
                foreground_ratio=float(foreground_ratio),
                invert=bool(invert),
            ):
                mode = "centerline"
                stage_start = time.perf_counter()
                centerline_binary, centerline_threshold, centerline_threshold_source = build_vector_binary(
                    image.copy(),
                    threshold=threshold,
                    threshold_mode=threshold_mode,
                    blur=blur,
                    invert=invert,
                    adaptive_block=adaptive_block,
                    adaptive_c=adaptive_c,
                    morph_open=morph_open,
                    morph_close=morph_close,
                    background_normalize=False,
                    denoise=0,
                )
                centerline_threshold_binary = centerline_binary.copy()
                centerline_binary, centerline_removed_border = clean_border_components(
                    centerline_binary,
                    remove_border,
                    margin=3,
                )
                centerline_foreground_ratio = float(np.count_nonzero(centerline_binary)) / float(max(1, centerline_binary.shape[0] * centerline_binary.shape[1]))
                centerline_stroke_width = estimate_stroke_width(centerline_binary)
                if 0.025 <= centerline_foreground_ratio <= 0.22 and 0 < centerline_stroke_width <= 4.0:
                    binary = centerline_binary
                    threshold_binary = centerline_threshold_binary
                    threshold_source = centerline_threshold_source
                    used_threshold = float(centerline_threshold)
                    removed_border_components = int(centerline_removed_border)
                    foreground_ratio = centerline_foreground_ratio
                    pre_trace_stroke_estimate = centerline_stroke_width
                    effective_background_normalize = False
                    effective_denoise = 0
                    effective_min_length = min(float(min_length), 4.0)
                    effective_stitch_gap = max(float(stitch_gap), 3.0)
                timings["autoCenterline"] = time.perf_counter() - stage_start
                auto_centerline_stats = {
                    "autoCenterlineTrace": True,
                    "autoCenterlineReason": "wide-technical-line-art",
                    "autoCenterlineAspectRatio": round(float(source_width) / max(1.0, float(source_height)), 3),
                    "autoCenterlineForegroundRatio": round(float(foreground_ratio), 4),
                    "autoCenterlineStrokeWidth": round(float(pre_trace_stroke_estimate), 1),
                    "autoCenterlineBackgroundNormalize": effective_background_normalize,
                    "autoCenterlineDenoise": 0,
                    "autoCenterlineMinLength": round(float(effective_min_length), 2),
                    "autoCenterlineStitchGap": round(float(effective_stitch_gap), 2),
                }
            else:
                mode = "potrace" if 0 < pre_trace_stroke_estimate <= 5.5 and foreground_ratio <= 0.30 else "vtracer"
    if clean_line_art and mode == "centerline":
        effective_min_length = min(effective_min_length, 2.5)
        effective_stitch_gap = min(effective_stitch_gap, 0.5)
    if cad_centerline:
        effective_min_length = min(effective_min_length, 3.0)
        effective_stitch_gap = min(max(0.25, effective_stitch_gap), 1.0)
    skeleton_preview = None
    raw_skeleton_preview = None
    trace_binary_preview = None
    pruned_spur_pixels = 0
    centerline_solidify_radius = 0
    if mode == "potrace":
        stage_start = time.perf_counter()
        use_line_art_trace = bool(0 < pre_trace_stroke_estimate <= 3.5 and foreground_ratio <= 0.24 and used_threshold > 0)
        if use_line_art_trace:
            line_binary, trace_binary_preview, line_stats = build_line_art_ink_mask(
                image,
                threshold=threshold,
                threshold_mode=threshold_mode,
                blur=int(blur),
                invert=invert,
                adaptive_block=adaptive_block,
                adaptive_c=adaptive_c,
                background_normalize=effective_background_normalize,
                denoise=effective_denoise,
            )
            line_scale = max(1, int(line_stats.get("lineArtUpscale", 1)))
            vector_paths, stats = trace_line_art_fill_vectors(
                line_binary,
                min_length=max(0.0, float(effective_min_length) * line_scale),
                simplify=max(0.06, float(simplify) * 0.12 * line_scale),
                smooth=0,
                max_contours=max(1, int(max_contours)),
            )
            if line_scale != 1:
                vector_paths = scaled_vector_paths(vector_paths, 1.0 / float(line_scale))
            stats.update(line_stats)
        else:
            vector_paths = []
            stats = {}
        if not vector_paths:
            blacklevel = (used_threshold if used_threshold > 0 else float(threshold)) / 255.0
            blacklevel = max(0.45, min(0.70, blacklevel))
            try:
                vector_paths, stats = trace_potrace_vectors(
                    image,
                    min_length=max(0.0, float(effective_min_length)),
                    simplify=max(0.02, float(simplify)),
                    max_contours=max(1, int(max_contours)),
                    blacklevel=blacklevel,
                    alphamax=0.8,
                    opttolerance=0.4,
                    turdsize=max(2, int(round(float(min_area) / 20.0))),
                    smooth=int(smooth),
                )
            except ValueError:
                vector_paths, stats, vtracer_svg_text = trace_vtracer_photo_vectors(
                    image,
                    min_length=max(0.0, float(effective_min_length)),
                    simplify=max(0.02, float(simplify)),
                    max_contours=max(1, int(max_contours)),
                    smooth=int(smooth),
                    light_fill_threshold=180.0,
                )
                stats["vtracerSvgBytes"] = len(vtracer_svg_text.encode("utf-8"))
                stats["autoFallback"] = "vtracer-photo"
        timings["trace"] = time.perf_counter() - stage_start
    elif mode == "photo":
        stage_start = time.perf_counter()
        vector_paths, stats, vtracer_svg_text = trace_vtracer_photo_vectors(
            image,
            min_length=max(0.0, float(effective_min_length)),
            simplify=max(0.02, float(simplify)),
            max_contours=max(1, int(max_contours)),
            smooth=int(smooth),
            light_fill_threshold=180.0,
        )
        stats["vtracerSvgBytes"] = len(vtracer_svg_text.encode("utf-8"))
        timings["trace"] = time.perf_counter() - stage_start
    elif mode == "vtracer":
        trace_binary, polish_stats = polish_trace_binary(binary, int(smooth), float(stitch_gap))
        if not np.array_equal(trace_binary, binary):
            trace_binary_preview = trace_binary
        stage_start = time.perf_counter()
        vector_paths, stats, vtracer_svg_text = trace_vtracer_vectors(
            trace_binary,
            min_length=max(0.0, float(effective_min_length)),
            simplify=max(0.02, float(simplify)),
            max_contours=max(1, int(max_contours)),
            color_mode="binary",
            smooth=int(smooth),
        )
        stats.update(polish_stats)
        stats["vtracerSvgBytes"] = len(vtracer_svg_text.encode("utf-8"))
        timings["trace"] = time.perf_counter() - stage_start
    elif mode == "centerline":
        centerline_solidify_radius = int(max(0.0, min(5.0, round(float(effective_stitch_gap)))))
        if centerline_solidify_radius > 0:
            binary = solidify_centerline_mask(binary, centerline_solidify_radius)
        micro_hole_stats: dict[str, Any] = {}
        if cad_centerline:
            binary, micro_hole_stats = fill_centerline_micro_holes(
                binary,
                stroke_width=float(pre_trace_stroke_estimate),
            )
        stage_start = time.perf_counter()
        raw_skeleton_preview = thin_binary(binary)
        if cad_centerline:
            skeleton_preview = raw_skeleton_preview.copy()
            pruned_spur_pixels = 0
        else:
            spur_length = adaptive_spur_length(binary, raw_skeleton_preview, float(effective_stitch_gap), float(effective_min_length))
            skeleton_preview, pruned_spur_pixels = prune_skeleton_spurs(
                raw_skeleton_preview,
                max_length=spur_length,
                max_rounds=6,
            )
        timings["skeletonPreview"] = time.perf_counter() - stage_start
        stage_start = time.perf_counter()
        vector_paths, stats = trace_skeleton_vectors(
            binary,
            min_length=max(0.0, float(effective_min_length)),
            simplify=max(0.0, float(simplify)),
            smooth=int(smooth),
            max_contours=max(1, int(max_contours)),
            # CAD topology is canonical evidence. Gap joins are proposals in
            # the attributed graph, never proximity-only path mutations.
            stitch_gap=0.0 if cad_centerline else float(effective_stitch_gap),
            skeleton=skeleton_preview,
            trim_open_ends=not cad_centerline,
            post_simplify_epsilon=0.25 if cad_centerline else None,
            preserve_junctions=cad_centerline,
        )
        stats["prunedSpurPixels"] = pruned_spur_pixels
        stats["centerlineSolidifyRadius"] = centerline_solidify_radius
        stats.update(micro_hole_stats)
        if cad_centerline:
            stitched_count = 0
            stats["deferredOpenPathRepairs"] = True
        else:
            vector_paths, stitched_count = stitch_open_vector_paths(vector_paths, min(2.0, float(effective_stitch_gap)))
        stats["stitchedGap"] = int(stats.get("stitchedRaw", 0)) + stitched_count
        vector_paths, straight_stats = straighten_centerline_paths(
            vector_paths,
            stroke_width=float(pre_trace_stroke_estimate),
            source_width=float(image.shape[1]),
            source_height=float(image.shape[0]),
        )
        stats.update(straight_stats)
        vector_paths, axis_stats = flatten_axis_aligned_centerline_runs(
            vector_paths,
            stroke_width=float(pre_trace_stroke_estimate),
            source_width=float(image.shape[1]),
            source_height=float(image.shape[0]),
        )
        stats.update(axis_stats)
        if auto_centerline_stats.get("autoCenterlineTrace"):
            vector_paths, curve_stats = polish_centerline_curves(
                vector_paths,
                stroke_width=float(pre_trace_stroke_estimate),
                source_width=float(image.shape[1]),
                source_height=float(image.shape[0]),
            )
            stats.update(curve_stats)
        if cad_centerline:
            vector_paths, dot_stats = preserve_centerline_dot_components(
                binary,
                skeleton_preview,
                vector_paths,
                stroke_width=float(pre_trace_stroke_estimate),
            )
            stats.update(dot_stats)
            if cad_trace_scale > 1.0:
                vector_paths = scaled_vector_paths(vector_paths, 1.0 / cad_trace_scale)
            original_stroke_width = float(pre_trace_stroke_estimate) / cad_trace_scale
            # Endpoint-to-path snap caused false joins in toes, lettering and
            # other dense details. P1 keeps these candidates reversible; only
            # sub-pixel, already-supported junctions are collapsed by the graph
            # builder below.
            stats["snappedOpenEndpoints"] = 0
            stats["endpointSnapDeferred"] = True
            stats["endpointSnapCandidateGap"] = round(max(1.5, min(4.0, original_stroke_width * 1.6)), 3)
            stats["weldedEndpoints"] = 0
            stats["mergedOpenPaths"] = 0
            stats["cadProximityWeldDisabled"] = True
            stats["cadTopologyPreserved"] = True
        timings["trace"] = time.perf_counter() - stage_start
    else:
        mode = "outline"
        stage_start = time.perf_counter()
        vector_paths, stats = trace_outline_vectors(
            binary,
            min_area=max(0.0, float(min_area)),
            simplify=max(0.0, float(simplify)),
            smooth=int(smooth),
            max_contours=max(1, int(max_contours)),
        )
        timings["trace"] = time.perf_counter() - stage_start

    height, width = image.shape[:2]
    stage_start = time.perf_counter()
    vector_paths, post_stats = filter_vector_paths(
        vector_paths,
        source_width=float(width),
        source_height=float(height),
        remove_border=remove_border and not bool(stats.get("lineArtTrace")),
        min_length=max(0.0, float(effective_min_length)),
            mode=mode,
    )
    timings["postFilter"] = time.perf_counter() - stage_start
    stats.update(post_stats)
    stats.update(auto_stencil_stats)
    stats.update(auto_centerline_stats)
    stats.update(source_profile)
    stats["detailPreservation"] = clean_line_art
    stats["removedBorderComponents"] = removed_border_components
    # Otomatik mod: ince tarama/cizgi sanati icin Potrace, dolu/kalin sekiller
    # icin VTracer daha iyi sonuc verir. Manuel secimler korunur.
    stroke_estimate = pre_trace_stroke_estimate / cad_trace_scale if cad_centerline else pre_trace_stroke_estimate
    stats["estimatedStrokeWidth"] = round(stroke_estimate, 1)
    stats["requestedMode"] = requested_mode
    stats["traceEngine"] = mode
    stats["cadCenterline"] = cad_centerline
    stats["cadTraceScale"] = round(cad_trace_scale, 4)
    stats["foregroundRatio"] = round(foreground_ratio, 4)
    if mode == "potrace":
        fill_ratio = compound_fill_ratio(vector_paths, float(width), float(height))
        stats["filledTraceRatio"] = round(fill_ratio, 4)
        stats["filledTraceInvert"] = bool(fill_ratio > 0.5)
    stats["suggestedMode"] = "auto"
    stats["modeMismatch"] = bool(not cad_centerline and requested_mode != "auto" and stroke_estimate > 0 and mode not in {"potrace", "vtracer"})
    stats["pathsTotal"] = len(vector_paths)
    stats["pathsKept"] = sum(
        1
        for item in vector_paths
        if not item.get("removed") and len(item.get("points", [])) >= 2
    )
    stats["pointsKept"] = sum(
        len(item.get("points", []))
        for item in vector_paths
        if not item.get("removed") and len(item.get("points", [])) >= 2
    )
    stage_start = time.perf_counter()
    debug_previews = [numpy_image_preview("Gri", image)]
    if effective_background_normalize:
        debug_previews.append(numpy_image_preview("Isik Duzeltme", threshold_source))
    debug_previews.extend([
        numpy_image_preview("Eşik/Maske", threshold_binary),
        numpy_image_preview("Temiz Maske", binary),
    ])
    if trace_binary_preview is not None:
        debug_previews.append(numpy_image_preview("Trace Maske", trace_binary_preview))
    if raw_skeleton_preview is not None and pruned_spur_pixels > 0:
        debug_previews.append(numpy_image_preview("Ham Merkez", raw_skeleton_preview))
    if skeleton_preview is not None:
        debug_previews.append(numpy_image_preview("Merkez Çizgi", skeleton_preview))
    timings["debugPreview"] = time.perf_counter() - stage_start
    timings["total"] = time.perf_counter() - total_start
    stats["timings"] = {key: round(value, 4) for key, value in timings.items()}
    result = {
        "kind": "vector",
        "sourcePath": str(path),
        "name": f"{path.stem}-vector.svg",
        "sourceWidth": float(width),
        "sourceHeight": float(height),
        "originalWidth": float(image_stats["originalWidth"]),
        "originalHeight": float(image_stats["originalHeight"]),
        "vectorPaths": vector_paths,
        "preview": raster_preview_payload(path),
        "debugPreviews": debug_previews,
        "settings": {
            "threshold": threshold,
            "thresholdMode": threshold_mode,
            "mode": mode,
            "blur": blur,
            "minArea": min_area,
            "minLength": effective_min_length,
            "simplify": simplify,
            "smooth": smooth,
            "invert": effective_invert,
            "maxContours": max_contours,
            "contrast": contrast,
            "morphOpen": morph_open,
            "morphClose": morph_close,
            "adaptiveBlock": adaptive_block,
            "adaptiveC": adaptive_c,
            "maxDimension": max_dimension,
            "removeBorder": remove_border,
            "stitchGap": effective_stitch_gap,
            "backgroundNormalize": effective_background_normalize,
            "requestedInvert": invert,
            "requestedBackgroundNormalize": background_normalize,
            "requestedMinLength": min_length,
            "requestedStitchGap": stitch_gap,
            "requestedDenoise": denoise,
            "denoise": effective_denoise,
            "cleanLineArt": clean_line_art,
            "cadCenterline": cad_centerline,
            "cadTraceScale": round(cad_trace_scale, 4),
            "usedThreshold": used_threshold,
            "processingScale": image_stats["processingScale"],
        },
        "stats": stats,
    }
    attach_vector_topology_payload(
        result,
        evidence_mask=binary,
        evidence_scale=cad_trace_scale if cad_centerline else 1.0,
    )
    return result


def _nearest_vector_region_label(labels: Any, x: int, y: int, max_radius: int = 18) -> int:
    height, width = labels.shape[:2]
    x = max(0, min(width - 1, int(x)))
    y = max(0, min(height - 1, int(y)))
    direct = int(labels[y, x])
    if direct > 0:
        return direct
    for radius in range(1, max(1, int(max_radius)) + 1):
        min_x = max(0, x - radius)
        max_x = min(width - 1, x + radius)
        min_y = max(0, y - radius)
        max_y = min(height - 1, y + radius)
        candidates: list[tuple[int, int, int]] = []
        for current_x in range(min_x, max_x + 1):
            for current_y in (min_y, max_y):
                label = int(labels[current_y, current_x])
                if label > 0:
                    candidates.append(((current_x - x) ** 2 + (current_y - y) ** 2, current_x, current_y))
        for current_y in range(min_y + 1, max_y):
            for current_x in (min_x, max_x):
                label = int(labels[current_y, current_x])
                if label > 0:
                    candidates.append(((current_x - x) ** 2 + (current_y - y) ** 2, current_x, current_y))
        if candidates:
            _distance, nearest_x, nearest_y = min(candidates)
            return int(labels[nearest_y, nearest_x])
    return 0


def _vector_paths_adjacent_to_regions(vector_paths: list[dict[str, Any]],
                                      labels: Any,
                                      selected_labels: set[int],
                                      scale: float,
                                      sample_offset: float) -> list[str]:
    if not selected_labels:
        return []
    height, width = labels.shape[:2]
    result: list[str] = []
    for vector_path in vector_paths:
        points = vector_path.get("points", [])
        if vector_path.get("removed") or len(points) < 2:
            continue
        scaled = [[float(point[0]) * scale, float(point[1]) * scale] for point in points]
        pairs = list(zip(scaled, scaled[1:]))
        if vector_path.get("closed"):
            pairs.append((scaled[-1], scaled[0]))
        hits = 0
        tests = 0
        for start, end in pairs:
            dx = float(end[0]) - float(start[0])
            dy = float(end[1]) - float(start[1])
            length = math.hypot(dx, dy)
            if length <= 1e-9:
                continue
            normal_x = -dy / length
            normal_y = dx / length
            steps = max(1, int(math.ceil(length / 3.0)))
            for index in range(steps):
                ratio = (index + 0.5) / steps
                x = float(start[0]) + dx * ratio
                y = float(start[1]) + dy * ratio
                first_x = max(0, min(width - 1, int(round(x + normal_x * sample_offset))))
                first_y = max(0, min(height - 1, int(round(y + normal_y * sample_offset))))
                second_x = max(0, min(width - 1, int(round(x - normal_x * sample_offset))))
                second_y = max(0, min(height - 1, int(round(y - normal_y * sample_offset))))
                first_label = int(labels[first_y, first_x])
                second_label = int(labels[second_y, second_x])
                if first_label <= 0 or second_label <= 0:
                    continue
                tests += 1
                if first_label != second_label and ((first_label in selected_labels) != (second_label in selected_labels)):
                    hits += 1
        required_hits = 1 if tests < 8 else 2
        if hits >= required_hits and hits / max(1, tests) >= 0.015:
            result.append(str(vector_path.get("id") or ""))
    return [path_id for path_id in result if path_id]


def _dominant_enclosing_vector_path_id(vector_paths: list[dict[str, Any]]) -> str | None:
    """Return the one closed contour that actually surrounds the whole design.

    Merely touching the exterior white region is not enough: after a frame is
    removed, hearts, birds and branches also touch that region. A dominant frame
    must be closed and cover almost the complete original geometry envelope.
    Removed paths remain in this calculation so deleting a frame cannot promote
    all newly exposed interior motifs to cutting paths.
    """
    usable = [item for item in vector_paths or [] if len(item.get("points", [])) >= 2]
    if not usable:
        return None
    all_points = [point for item in usable for point in item.get("points", [])]
    if len(all_points) < 2:
        return None
    design_min_x, design_min_y, design_max_x, design_max_y = _points_bbox(all_points)
    design_width = max(1e-6, design_max_x - design_min_x)
    design_height = max(1e-6, design_max_y - design_min_y)
    design_area = design_width * design_height
    candidates: list[tuple[float, float, str]] = []
    for item in usable:
        path_id = str(item.get("id") or "")
        points = item.get("points", [])
        if not path_id or not item.get("closed") or len(points) < 3:
            continue
        min_x, min_y, max_x, max_y = _points_bbox(points)
        width = max(0.0, max_x - min_x)
        height = max(0.0, max_y - min_y)
        width_coverage = width / design_width
        height_coverage = height / design_height
        area_coverage = (width * height) / max(1e-6, design_area)
        if width_coverage < 0.80 or height_coverage < 0.80 or area_coverage < 0.68:
            continue
        length = float(item.get("length") or _polyline_length(points + [points[0]]))
        candidates.append((area_coverage, length, path_id))
    if not candidates:
        return None
    return max(candidates)[2]


def _structural_exterior_vector_path_ids(vector_paths: list[dict[str, Any]],
                                         adjacent_path_ids: list[str],
                                         dominant_path: dict[str, Any] | None) -> list[str]:
    """Promote the outer silhouette after a surrounding frame is removed.

    Model (kullanicinin tarifi): kalan konturlarin etrafina bir "lastik bant"
    (konveks zarf) gerilir; bu zarfa DEGEN cizgiler dis kenardir -> kesim,
    degmeyen her sey icerde kalir -> kazima. Cizgi cizimlerinde beyaz arka
    plan her yere degdigi icin "dis beyaz bolgeye komsu" testi tum ic motifleri
    de yakaliyordu; konveks zarfa yakinlik testi yalnizca gercekten en distaki
    cevre konturlarini (cerceve kalpleri, dis dallar, taban) secer, ortadaki
    kalp / kuslar / cicekler / yazi kazima kalir.
    """
    if not dominant_path or not dominant_path.get("removed"):
        return []
    active = [
        item
        for item in vector_paths or []
        if not item.get("removed") and len(item.get("points", [])) >= 2
    ]
    if len(active) < 2:
        return []
    all_points = [point for item in active for point in item.get("points", [])]
    if len(all_points) < 3:
        return []
    min_x, min_y, max_x, max_y = _points_bbox(all_points)
    design_diagonal = math.hypot(max_x - min_x, max_y - min_y)
    if design_diagonal <= 0:
        return []

    # Konveks zarf ("sarmal") ve ona degme testi OpenCV ile. cv2 yoksa
    # eski goreli-uzunluk davranisina guvenli sekilde geri don.
    if cv2 is None or np is None:
        dominant_points = dominant_path.get("points", [])
        dominant_length = float(
            dominant_path.get("length")
            or _polyline_length(
                dominant_points
                + ([dominant_points[0]] if dominant_path.get("closed") and dominant_points else [])
            )
        )
        min_length = max(24.0, design_diagonal * 0.18, dominant_length * 0.075)
        min_diagonal = max(12.0, design_diagonal * 0.10)
        adjacent = {str(path_id) for path_id in adjacent_path_ids}
        fallback: list[str] = []
        for item in active:
            path_id = str(item.get("id") or "")
            points = item.get("points", [])
            if not path_id or path_id not in adjacent:
                continue
            p_min_x, p_min_y, p_max_x, p_max_y = _points_bbox(points)
            path_diagonal = math.hypot(p_max_x - p_min_x, p_max_y - p_min_y)
            path_length = float(
                item.get("length")
                or _polyline_length(points + ([points[0]] if item.get("closed") and points else []))
            )
            if path_length >= min_length and path_diagonal >= min_diagonal:
                fallback.append(path_id)
        return sorted(set(fallback))

    hull = cv2.convexHull(np.array(all_points, dtype=np.float32))
    # "Degme" toleransi dar: cizgi zarfin uzerinde olmali, yakininda degil.
    touch_tolerance = max(5.0, design_diagonal * 0.006)
    # Cok kucuk parcalar (tek yaprak/cicek ucu zarfa denk gelse bile) kesime
    # gitmesin diye mutevazi bir asgari uzunluk.
    min_length = max(24.0, design_diagonal * 0.04)
    structural: list[str] = []
    for item in active:
        path_id = str(item.get("id") or "")
        points = item.get("points", [])
        if not path_id:
            continue
        touching = 0
        for point in points:
            distance = cv2.pointPolygonTest(hull, (float(point[0]), float(point[1])), True)
            if abs(distance) <= touch_tolerance:
                touching += 1
                if touching >= 2:
                    break
        if touching < 2:
            continue
        path_length = float(
            item.get("length")
            or _polyline_length(points + ([points[0]] if item.get("closed") and points else []))
        )
        if path_length < min_length:
            continue
        structural.append(path_id)
    return sorted(set(structural))


def classify_vector_region_boundaries(vector_paths: list[dict[str, Any]],
                                      source_width: float,
                                      source_height: float,
                                      seeds: list[Any] | None = None,
                                      include_exterior: bool = True,
                                      max_dimension: int = 1600) -> dict[str, Any]:
    """Classify centerlines by the white regions on their two sides.

    A dominant surrounding frame defines the initial cut boundary. Once that
    frame is removed, only large newly exposed structural paths are promoted;
    small motifs remain engraving. Optional seed points select additional
    enclosed regions.
    """
    if cv2 is None or np is None:
        raise ValueError("Bolge sinifi icin OpenCV bulunamadi.")
    all_paths = [
        item
        for item in vector_paths or []
        if len(item.get("points", [])) >= 2
    ]
    active_paths = [
        item
        for item in all_paths
        if not item.get("removed") and len(item.get("points", [])) >= 2
    ]
    width = max(1.0, float(source_width or 1.0))
    height = max(1.0, float(source_height or 1.0))
    if not active_paths:
        return {
            "cutPathIds": [],
            "exteriorPathIds": [],
            "adjacentExteriorPathIds": [],
            "dominantExteriorPathId": None,
            "markedPathIds": [],
            "regions": [],
            "stats": {
                "activePaths": 0,
                "regionCount": 0,
                "resolvedSeeds": 0,
                "structuralExteriorPaths": 0,
                "dominantExteriorRemoved": False,
                "exteriorPromotionSuppressed": False,
            },
        }

    scale = min(1.0, max(64.0, float(max_dimension)) / max(width, height))
    raster_width = max(32, int(round(width * scale)))
    raster_height = max(32, int(round(height * scale)))
    line_thickness = 3
    line_mask = np.zeros((raster_height, raster_width), dtype=np.uint8)
    for vector_path in active_paths:
        points = np.rint(np.array(vector_path.get("points", []), dtype=float) * scale).astype(np.int32).reshape((-1, 1, 2))
        cv2.polylines(line_mask, [points], bool(vector_path.get("closed")), 255, line_thickness, cv2.LINE_8)
    line_mask = cv2.morphologyEx(line_mask, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8))
    region_count, labels = cv2.connectedComponents((line_mask == 0).astype(np.uint8), connectivity=8)
    sample_offset = float(line_thickness + 2)

    exterior_labels: set[int] = set()
    if include_exterior:
        border_labels = np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]))
        exterior_labels = {int(label) for label in np.unique(border_labels) if int(label) > 0}
    adjacent_exterior_path_ids = _vector_paths_adjacent_to_regions(
        active_paths,
        labels,
        exterior_labels,
        scale,
        sample_offset,
    )
    dominant_exterior_path_id = _dominant_enclosing_vector_path_id(all_paths)
    dominant_path = next(
        (item for item in all_paths if str(item.get("id") or "") == dominant_exterior_path_id),
        None,
    )
    dominant_exterior_removed = bool(dominant_path and dominant_path.get("removed"))
    exterior_promotion_suppressed = dominant_exterior_removed
    exterior_path_ids = []
    if (
        dominant_exterior_path_id
        and not dominant_exterior_removed
        and dominant_exterior_path_id in set(adjacent_exterior_path_ids)
    ):
        exterior_path_ids = [dominant_exterior_path_id]
    elif dominant_exterior_removed:
        exterior_path_ids = _structural_exterior_vector_path_ids(
            all_paths,
            adjacent_exterior_path_ids,
            dominant_path,
        )

    marked_path_ids: set[str] = set()
    region_results: list[dict[str, Any]] = []
    for raw_seed in seeds or []:
        if isinstance(raw_seed, dict):
            source_x = float(raw_seed.get("x", 0.0))
            source_y = float(raw_seed.get("y", 0.0))
        elif isinstance(raw_seed, (list, tuple)) and len(raw_seed) >= 2:
            source_x = float(raw_seed[0])
            source_y = float(raw_seed[1])
        else:
            continue
        raster_x = int(round(source_x * scale))
        raster_y = int(round(source_y * scale))
        label = _nearest_vector_region_label(labels, raster_x, raster_y)
        if label <= 0:
            region_results.append({"seed": {"x": source_x, "y": source_y}, "resolved": False, "pathIds": []})
            continue
        path_ids = _vector_paths_adjacent_to_regions(
            active_paths,
            labels,
            {label},
            scale,
            sample_offset,
        )
        marked_path_ids.update(path_ids)
        region_results.append(
            {
                "seed": {"x": source_x, "y": source_y},
                "resolved": True,
                "label": label,
                "areaPixels": int(np.count_nonzero(labels == label)),
                "pathIds": path_ids,
            }
        )

    cut_path_ids = set(exterior_path_ids) | marked_path_ids
    return {
        "cutPathIds": sorted(cut_path_ids),
        "exteriorPathIds": sorted(set(exterior_path_ids)),
        "adjacentExteriorPathIds": sorted(set(adjacent_exterior_path_ids)),
        "dominantExteriorPathId": dominant_exterior_path_id,
        "markedPathIds": sorted(marked_path_ids),
        "regions": region_results,
        "stats": {
            "activePaths": len(active_paths),
            "regionCount": max(0, int(region_count) - 1),
            "resolvedSeeds": sum(1 for item in region_results if item.get("resolved")),
            "adjacentExteriorPaths": len(set(adjacent_exterior_path_ids)),
            "dominantExteriorPaths": len(set(exterior_path_ids)),
            "structuralExteriorPaths": len(set(exterior_path_ids)) if dominant_exterior_removed else 0,
            "dominantExteriorRemoved": dominant_exterior_removed,
            "exteriorPromotionSuppressed": exterior_promotion_suppressed,
            "rasterWidth": raster_width,
            "rasterHeight": raster_height,
            "scale": round(scale, 6),
        },
    }


def vector_path_d(points: list[list[float]], closed: bool = True) -> str:
    if not points:
        return ""
    parts = ["M", fmt(float(points[0][0])), fmt(float(points[0][1]))]
    for point in points[1:]:
        parts.extend(["L", fmt(float(point[0])), fmt(float(point[1]))])
    if closed:
        parts.append("Z")
    return " ".join(parts)


def write_vector_svg(output_path: Path,
                     vector_paths: list[dict[str, Any]],
                     width: float,
                     height: float,
                     stroke_width: float = 0.1,
                     fill_mode: bool = False,
                     fill_invert: bool = False) -> dict[str, Any]:
    active_paths = [path for path in vector_paths if not path.get("removed") and len(path.get("points", [])) >= 2]
    if not active_paths:
        raise ValueError("Kaydedilecek vektor kalmadi.")
    root = ET.Element(
        f"{{{SVG_NS}}}svg",
        {
            "width": f"{fmt(width)}mm",
            "height": f"{fmt(height)}mm",
            "viewBox": f"0 0 {fmt(width)} {fmt(height)}",
        },
    )
    group = ET.SubElement(root, f"{{{SVG_NS}}}g", {"id": "vectorized-photo", "vector-effect": "non-scaling-stroke"})
    if fill_mode:
        closed_paths = [item for item in active_paths if item.get("closed", True) and len(item.get("points", [])) >= 3]
        open_paths = [item for item in active_paths if item not in closed_paths]
        if closed_paths:
            invert_prefix = f"M 0 0 L {fmt(width)} 0 L {fmt(width)} {fmt(height)} L 0 {fmt(height)} Z " if fill_invert else ""
            ET.SubElement(
                group,
                f"{{{SVG_NS}}}path",
                {
                    "d": invert_prefix + " ".join(vector_path_d(item["points"], True) for item in closed_paths),
                    "fill": "black",
                    "fill-rule": "evenodd",
                    "stroke": "none",
                },
            )
        for item in open_paths:
            ET.SubElement(
                group,
                f"{{{SVG_NS}}}path",
                {
                    "d": vector_path_d(item["points"], False),
                    "fill": "none",
                    "stroke": "black",
                    "stroke-width": fmt(stroke_width),
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                    "vector-effect": "non-scaling-stroke",
                },
            )
    else:
        for item in active_paths:
            ET.SubElement(
                group,
                f"{{{SVG_NS}}}path",
                {
                    "d": vector_path_d(item["points"], bool(item.get("closed", True))),
                    "fill": "none",
                    "stroke": "black",
                    "stroke-width": fmt(stroke_width),
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round",
                    "vector-effect": "non-scaling-stroke",
                },
            )
    ET.ElementTree(root).write(output_path, encoding="utf-8", xml_declaration=False)
    return {
        "outputPath": str(output_path),
        "pathCount": len(active_paths),
        "width": width,
        "height": height,
        "fillMode": bool(fill_mode),
        "fillInvert": bool(fill_invert),
    }


def pattern_point(pattern: RasterPattern, local_x: float, local_y: float) -> Point:
    center_x = pattern.x + pattern.width / 2
    center_y = pattern.y + pattern.height / 2
    if pattern.mirror_x:
        local_x = pattern.width - local_x
    if pattern.mirror_y:
        local_y = pattern.height - local_y
    dx = local_x - pattern.width / 2
    dy = local_y - pattern.height / 2
    angle = math.radians(pattern.rotation)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    return center_x + dx * cos_a - dy * sin_a, center_y + dx * sin_a + dy * cos_a


def build_raster_engrave_lines(pattern: RasterPattern,
                               travel_feed: float | None = None,
                               clip_region: ClipRegion | None = None) -> list[str]:
    if not pattern.path.exists():
        raise ValueError(f"Desen dosyasi bulunamadi: {pattern.path}")
    if pattern.width <= 0 or pattern.height <= 0:
        raise ValueError("Desen genislik/yukseklik 0'dan buyuk olmali.")
    if pattern.feed <= 0:
        raise ValueError("Desen hizi 0'dan buyuk olmali.")
    if pattern.line_step <= 0:
        raise ValueError("Desen cizgi araligi 0'dan buyuk olmali.")
    if pattern.threshold < 0 or pattern.threshold > 255:
        raise ValueError("Desen koyuluk esigi 0 ile 255 arasinda olmali.")
    converter.validate_power(pattern.power)
    converter.validate_power(pattern.power_min)

    raster_mode = str(pattern.raster_mode or "threshold").lower().replace("-", "_")

    columns = max(2, int(math.ceil(pattern.width / pattern.line_step)))
    rows = max(2, int(math.ceil(pattern.height / pattern.line_step)))
    if columns * rows > MAX_RASTER_CELLS:
        raise ValueError(
            "Desen cok detayli. Boyutu kucultun veya cizgi araligini buyutun "
            f"({columns * rows} piksel, sinir {MAX_RASTER_CELLS})."
        )

    image = open_pattern_image(pattern.path)
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    image = image.resize((columns, rows), resample)
    pixels = image.load()
    col_width = pattern.width / columns
    row_height = pattern.height / rows
    clean_name = gcode_comment_text(pattern.path.name, "image")

    if raster_mode in {"grayscale", "gray", "photo", "photo_engrave", "pwm"}:
        gamma = max(0.2, min(4.0, float(pattern.gamma or 1.0)))
        power_min = max(0, min(int(pattern.power_min), int(pattern.power)))
        power_step = 5

        def pixel_power(column_index: int, row_index: int) -> int:
            gray = max(0, min(255, int(pixels[column_index, row_index])))
            darkness = max(0.0, min(1.0, (255.0 - float(gray)) / 255.0))
            if darkness <= 0.01:
                return 0
            scaled = math.pow(darkness, gamma)
            value = power_min + int(round((float(pattern.power) - float(power_min)) * scaled))
            value = int(round(value / power_step) * power_step)
            return max(power_min if value > 0 else 0, min(int(pattern.power), value))

        lines = [f"(engrave photo {clean_name} R{fmt(pattern.rotation)} gamma {fmt(gamma)})", "S0"]
        for row in range(rows):
            local_y = pattern.height - (row + 0.5) * row_height
            reverse = bool(pattern.bidirectional) and row % 2 == 1
            column = columns - 1 if reverse else 0

            def in_bounds(value: int) -> bool:
                return 0 <= value < columns

            def step(value: int) -> int:
                return value - 1 if reverse else value + 1

            while in_bounds(column):
                while in_bounds(column) and pixel_power(column, row) <= 0:
                    column = step(column)
                if not in_bounds(column):
                    break
                power = pixel_power(column, row)
                start = column
                column = step(column)
                while in_bounds(column) and pixel_power(column, row) == power:
                    column = step(column)
                end = column + 1 if reverse else column - 1

                if reverse:
                    start_x = (start + 1) * col_width
                    end_x = end * col_width
                else:
                    start_x = start * col_width
                    end_x = (end + 1) * col_width
                start_point = pattern_point(pattern, start_x, local_y)
                end_point = pattern_point(pattern, end_x, local_y)
                for clipped_start, clipped_end in clip_segment_to_region(start_point, end_point, clip_region):
                    append_powered_polyline(
                        lines,
                        [clipped_start, clipped_end],
                        power,
                        pattern.feed,
                        travel_feed,
                    )
        lines.append("(engrave photo end)")
        lines.append("S0")
        return lines

    lines = [f"(engrave image {clean_name} R{fmt(pattern.rotation)})", "S0"]

    for row in range(rows):
        local_y = pattern.height - (row + 0.5) * row_height
        column = 0
        while column < columns:
            while column < columns and pixels[column, row] >= pattern.threshold:
                column += 1
            if column >= columns:
                break
            start = column
            while column < columns and pixels[column, row] < pattern.threshold:
                column += 1
            end = column - 1

            start_point = pattern_point(pattern, start * col_width, local_y)
            end_point = pattern_point(pattern, (end + 1) * col_width, local_y)
            for clipped_start, clipped_end in clip_segment_to_region(start_point, end_point, clip_region):
                append_powered_polyline(
                    lines,
                    [clipped_start, clipped_end],
                    pattern.power,
                    pattern.feed,
                    travel_feed,
                )

    lines.append("(engrave image end)")
    lines.append("S0")
    return lines


def svg_path_to_polylines(path_data: str, curve_steps: int = 28) -> list[list[Point]]:
    tokens = clean_laser_svg.TOKEN_RE.findall(path_data)
    paths: list[list[Point]] = []
    current_path: list[Point] = []
    index = 0
    command: str | None = None
    current = (0.0, 0.0)
    subpath_start = (0.0, 0.0)

    def add_point(point: Point) -> None:
        current_path.append(point)

    while index < len(tokens):
        token = tokens[index]
        if clean_laser_svg.is_command(token):
            command = token
            index += 1
        elif command is None:
            raise ValueError("SVG path sayisal veriyle basliyor.")

        if command is None:
            continue
        absolute_command = command.upper()
        relative = command.islower()

        if absolute_command == "Z":
            add_point(subpath_start)
            if len(current_path) > 1:
                paths.append(current_path)
            current_path = []
            current = subpath_start
            command = None
            continue

        if absolute_command not in clean_laser_svg.ARITY:
            raise ValueError(f"Desteklenmeyen SVG path komutu: {command}")

        first_move_pair = True
        while index < len(tokens) and not clean_laser_svg.is_command(tokens[index]):
            params, index = clean_laser_svg.read_params(tokens, index, clean_laser_svg.ARITY[absolute_command])

            if absolute_command == "M":
                if len(current_path) > 1:
                    paths.append(current_path)
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                current_path = [current]
                if first_move_pair:
                    subpath_start = current
                first_move_pair = False
                command = "l" if relative else "L"
                absolute_command = "L"
                continue

            if absolute_command == "L":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                add_point(current)
            elif absolute_command == "H":
                x = params[0] + current[0] if relative else params[0]
                current = (x, current[1])
                add_point(current)
            elif absolute_command == "V":
                y = params[0] + current[1] if relative else params[0]
                current = (current[0], y)
                add_point(current)
            elif absolute_command == "C":
                curve_points: list[Point] = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1, p2, p3 = curve_points
                for step in range(1, curve_steps + 1):
                    add_point(clean_laser_svg.cubic_point(current, p1, p2, p3, step / curve_steps))
                current = p3
            elif absolute_command == "S":
                # Cleaned exporter files rarely keep S commands. Use endpoint-preserving
                # cubic approximation with the current point as the reflected handle.
                curve_points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1 = current
                p2, p3 = curve_points
                for step in range(1, curve_steps + 1):
                    add_point(clean_laser_svg.cubic_point(current, p1, p2, p3, step / curve_steps))
                current = p3
            elif absolute_command == "Q":
                curve_points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1, p2 = curve_points
                for step in range(1, curve_steps + 1):
                    add_point(clean_laser_svg.quadratic_point(current, p1, p2, step / curve_steps))
                current = p2
            elif absolute_command == "T":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                add_point(current)
            elif absolute_command == "A":
                # Endpoint approximation is kept conservative. Most cleaned laser
                # artwork reaches this stage as lines/cubics after export.
                x, y = params[5], params[6]
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                add_point(current)

    if len(current_path) > 1:
        paths.append(current_path)
    return paths


def svg_local_point(pattern: RasterPattern,
                    point: Point,
                    view_box: tuple[float, float, float, float]) -> Point:
    min_x, min_y, width, height = view_box
    local_x = ((point[0] - min_x) / width) * pattern.width
    local_y = pattern.height - ((point[1] - min_y) / height) * pattern.height
    return pattern_point(pattern, local_x, local_y)


def build_svg_vector_engrave_lines(pattern: RasterPattern,
                                   travel_feed: float | None = None,
                                   operation: str = "engrave",
                                   clip_region: ClipRegion | None = None,
                                   clip_close_boundary: bool = False,
                                   kerf: float = 0.0) -> list[str]:
    if not pattern.path.exists():
        raise ValueError(f"SVG dosyasi bulunamadi: {pattern.path}")
    converter.validate_power(pattern.power)
    view_box, _width, _height = svg_viewbox_and_size(pattern.path)
    if view_box[2] <= 0 or view_box[3] <= 0:
        raise ValueError("SVG viewBox olcusu gecersiz.")

    root = ET.parse(pattern.path).getroot()
    clean_name = gcode_comment_text(pattern.path.name, "svg")
    op_label = "cut" if operation == "cut" else "engrave"
    lines = [f"({op_label} svg {clean_name} R{fmt(pattern.rotation)})", "S0"]
    output_paths: list[list[Point]] = []

    for element in root.iter(f"{{{SVG_NS}}}path"):
        path_data = element.get("d")
        if not path_data:
            continue
        for polyline in svg_path_to_polylines(path_data):
            transformed = [svg_local_point(pattern, point, view_box) for point in polyline]
            if len(transformed) < 2:
                continue
            closed_source = len(transformed) > 2 and converter.dist(transformed[0], transformed[-1]) <= 0.05
            for clipped in clip_polyline_to_region(
                transformed,
                clip_region,
                close_boundary=clip_close_boundary and closed_source,
                closed_source=closed_source,
            ):
                output_paths.append(clipped)

    if not output_paths:
        if clip_region is not None:
            lines.append(f"({op_label} svg clipped empty)")
            lines.append("S0")
            return lines
        raise ValueError("SVG icinde G-code'a cevrilecek path bulunamadi.")
    if operation == "cut":
        output_paths = apply_kerf_to_paths(output_paths, kerf)
    output_paths = optimize_toolpaths(
        output_paths,
        start=pattern_point(pattern, 0.0, 0.0),
        inner_first=operation == "cut",
    )
    for output_path in output_paths:
        append_powered_polyline(lines, output_path, pattern.power, pattern.feed, travel_feed)
    lines.append(f"({op_label} svg end)")
    lines.append("S0")
    return lines


def embedded_vector_point(pattern: RasterPattern,
                          point: list[float],
                          source_width: float,
                          source_height: float) -> Point:
    local_x = (float(point[0]) / max(0.001, source_width)) * pattern.width
    local_y = pattern.height - (float(point[1]) / max(0.001, source_height)) * pattern.height
    return pattern_point(pattern, local_x, local_y)


def _fill_polygon_points(item: dict[str, Any]) -> list[Point]:
    points = [
        (float(point[0]), float(point[1]))
        for point in item.get("points", [])
        if isinstance(point, (list, tuple)) and len(point) >= 2
    ]
    if len(points) > 3 and math.dist(points[0], points[-1]) <= 1e-8:
        points.pop()
    return points


def _fill_polygon_signed_area(points: list[Point]) -> float:
    return sum(
        points[index][0] * points[(index + 1) % len(points)][1]
        - points[(index + 1) % len(points)][0] * points[index][1]
        for index in range(len(points))
    ) / 2.0


def _fill_polygon_bounds(points: list[Point]) -> tuple[float, float, float, float]:
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def _fill_polygon_contains(parent: dict[str, Any], candidate: dict[str, Any]) -> bool:
    if candidate["area"] <= 1e-10 or parent["area"] <= candidate["area"] + 1e-10:
        return False
    outer = parent["bounds"]
    inner = candidate["bounds"]
    epsilon = 1e-7
    if (
        inner[0] < outer[0] - epsilon
        or inner[1] < outer[1] - epsilon
        or inner[2] > outer[2] + epsilon
        or inner[3] > outer[3] + epsilon
    ):
        return False
    sample_step = max(1, len(candidate["points"]) // 32)
    return all(
        point_in_polygon(candidate["points"][index], parent["points"])
        for index in range(0, len(candidate["points"]), sample_step)
    )


def _classify_fill_polygons(vector_paths: list[dict[str, Any]]) -> list[dict[str, Any]]:
    polygons: list[dict[str, Any]] = []
    for item in vector_paths:
        if item.get("removed") or not item.get("closed", True):
            continue
        points = _fill_polygon_points(item)
        if len(points) < 3:
            continue
        signed_area = _fill_polygon_signed_area(points)
        polygons.append(
            {
                "points": points,
                "signedArea": signed_area,
                "area": abs(signed_area),
                "bounds": _fill_polygon_bounds(points),
                "depth": 0,
            }
        )
    for candidate in polygons:
        candidate["depth"] = sum(
            1
            for parent in polygons
            if parent is not candidate and _fill_polygon_contains(parent, candidate)
        )
    return polygons


def _polygon_scan_intervals(points: list[Point], y: float, source_width: float) -> list[tuple[float, float]]:
    intersections: list[float] = []
    for index, (x1, y1) in enumerate(points):
        x2, y2 = points[(index + 1) % len(points)]
        if abs(y2 - y1) < 1e-9:
            continue
        if y < min(y1, y2) or y >= max(y1, y2):
            continue
        x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
        if -1e-6 <= x <= source_width + 1e-6:
            intersections.append(max(0.0, min(source_width, x)))
    intersections.sort()
    return [
        (intersections[index], intersections[index + 1])
        for index in range(0, len(intersections) - 1, 2)
        if intersections[index + 1] - intersections[index] >= 1e-8
    ]


def _filled_scan_intervals(polygons: list[dict[str, Any]],
                           y: float,
                           source_width: float) -> list[tuple[float, float]]:
    events: list[tuple[float, int]] = []
    for polygon in polygons:
        sign = 1 if int(polygon["depth"]) % 2 == 0 else -1
        for start, end in _polygon_scan_intervals(polygon["points"], y, source_width):
            events.append((start, sign))
            events.append((end, -sign))
    if not events:
        return []
    events.sort(key=lambda event: event[0])
    intervals: list[tuple[float, float]] = []
    score = 0
    previous_x = events[0][0]
    index = 0
    while index < len(events):
        x = events[index][0]
        if score > 0 and x - previous_x >= 0.05:
            if intervals and abs(intervals[-1][1] - previous_x) <= 1e-9:
                intervals[-1] = (intervals[-1][0], x)
            else:
                intervals.append((previous_x, x))
        delta = 0
        while index < len(events) and abs(events[index][0] - x) <= 1e-9:
            delta += events[index][1]
            index += 1
        score += delta
        previous_x = x
    return intervals


def _invert_scan_intervals(intervals: list[tuple[float, float]],
                           source_width: float) -> list[tuple[float, float]]:
    inverted: list[tuple[float, float]] = []
    cursor = 0.0
    for start, end in intervals:
        if start - cursor >= 0.05:
            inverted.append((cursor, start))
        cursor = max(cursor, end)
    if source_width - cursor >= 0.05:
        inverted.append((cursor, source_width))
    return inverted


def vector_fill_scan_segments(vector_paths: list[dict[str, Any]],
                              source_width: float,
                              source_height: float,
                              source_step: float,
                              fill_invert: bool = False) -> list[tuple[Point, Point]]:
    source_width = max(0.001, float(source_width))
    source_height = max(0.001, float(source_height))
    source_step = max(0.05, float(source_step))
    polygons = _classify_fill_polygons(vector_paths)
    segments: list[tuple[Point, Point]] = []
    y = 0.0
    while y <= source_height + 1e-6:
        intervals = _filled_scan_intervals(polygons, y, source_width)
        if fill_invert:
            intervals = _invert_scan_intervals(intervals, source_width)
        segments.extend(((start, y), (end, y)) for start, end in intervals)
        y += source_step
    return segments


def _source_points(points: list[Any]) -> list[Point]:
    result: list[Point] = []
    for point in points or []:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        result.append((float(point[0]), float(point[1])))
    if len(result) > 3 and converter.dist(result[0], result[-1]) <= 0.001:
        result.pop()
    return result


def _bbox_size(bounds: tuple[float, float, float, float]) -> tuple[float, float]:
    min_x, min_y, max_x, max_y = bounds
    return max(0.0, max_x - min_x), max(0.0, max_y - min_y)


def _median(values: list[float]) -> float:
    if not values:
        return float("inf")
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def _source_distance_to_polyline(point: Point, polygon: list[Point]) -> float:
    if len(polygon) < 2:
        return float("inf")
    best = float("inf")
    for index, start in enumerate(polygon):
        best = min(best, point_segment_distance(point, start, polygon[(index + 1) % len(polygon)]))
    return best


def _auto_ignore_inner_cut_path(candidate: dict[str, Any], parent: dict[str, Any]) -> bool:
    if candidate["area"] <= 0 or parent["area"] <= candidate["area"]:
        return False
    parent_w, parent_h = _bbox_size(parent["bounds"])
    candidate_w, candidate_h = _bbox_size(candidate["bounds"])
    if parent_w <= 0 or parent_h <= 0 or candidate_w <= 0 or candidate_h <= 0:
        return False
    width_ratio = candidate_w / parent_w
    height_ratio = candidate_h / parent_h
    area_ratio = candidate["area"] / parent["area"]
    if width_ratio < 0.52 or height_ratio < 0.52 or area_ratio < 0.28 or area_ratio > 0.97:
        return False
    if not point_in_polygon(candidate["points"][0], parent["points"]):
        return False
    sample_step = max(1, len(candidate["points"]) // 24)
    distances = [
        _source_distance_to_polyline(candidate["points"][index], parent["points"])
        for index in range(0, len(candidate["points"]), sample_step)
    ]
    close_offset = _median(distances)
    close_limit = max(0.75, min(6.0, min(candidate_w, candidate_h) * 0.12))
    return close_offset <= close_limit


def auto_ignored_inner_cut_path_indexes(vector_paths: list[dict[str, Any]], fallback_operation: str) -> set[int]:
    if fallback_operation != "cut":
        return set()
    entries: list[dict[str, Any]] = []
    for index, vector_path in enumerate(vector_paths or []):
        if vector_path.get("removed") or not bool(vector_path.get("closed", True)):
            continue
        raw_operation = str(vector_path.get("operation") or "").lower().replace("-", "_")
        operation = "cut" if fallback_operation == "cut" and raw_operation == "engrave" else normalize_operation(vector_path.get("operation"), fallback_operation)
        if operation != "cut":
            continue
        points = _source_points(vector_path.get("points", []))
        if len(points) < 3:
            continue
        area = abs(polygon_signed_area(points))
        if area <= 0.5:
            continue
        entries.append(
            {
                "index": index,
                "points": points,
                "bounds": _points_bbox([[point[0], point[1]] for point in points]),
                "area": area,
            }
        )
    ignored: set[int] = set()
    for candidate in entries:
        for parent in entries:
            if candidate["index"] == parent["index"] or candidate["index"] in ignored:
                continue
            if _auto_ignore_inner_cut_path(candidate, parent):
                ignored.add(int(candidate["index"]))
    return ignored


def _affine_point(matrix: list[float], point: list[float] | tuple[float, float]) -> list[float]:
    a, b, c, d, e, f = matrix
    x = float(point[0])
    y = float(point[1])
    return [a * x + c * y + e, b * x + d * y + f]


def _affine_inverse(value: Any) -> list[float] | None:
    if not isinstance(value, list) or len(value) != 6:
        return None
    try:
        a, b, c, d, e, f = [float(item) for item in value]
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(item) for item in (a, b, c, d, e, f)):
        return None
    determinant = a * d - b * c
    if abs(determinant) <= 1e-12:
        return None
    return [
        d / determinant,
        -b / determinant,
        -c / determinant,
        a / determinant,
        (c * f - d * e) / determinant,
        (b * e - a * f) / determinant,
    ]


def _segment_intersection_parameter(start: Point, end: Point, first: Point, second: Point) -> float | None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    ex = second[0] - first[0]
    ey = second[1] - first[1]
    denominator = dx * ey - dy * ex
    if abs(denominator) <= 1e-12:
        return None
    rx = first[0] - start[0]
    ry = first[1] - start[1]
    t = (rx * ey - ry * ex) / denominator
    u = (rx * dy - ry * dx) / denominator
    if -1e-9 <= t <= 1.0 + 1e-9 and -1e-9 <= u <= 1.0 + 1e-9:
        return max(0.0, min(1.0, t))
    return None


def _clip_polyline_outside_polygons(points: list[list[float]], closed: bool,
                                    polygons: list[list[Point]]) -> list[dict[str, Any]]:
    source = [(float(point[0]), float(point[1])) for point in points]
    masks = [polygon for polygon in polygons if len(polygon) >= 3]
    if len(source) < 2:
        return []
    if not masks:
        return [{"points": [[x, y] for x, y in source], "closed": bool(closed), "masked": False}]
    fragments: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    removed_any = False
    segment_count = len(source) if closed else len(source) - 1

    def point_at(start: Point, end: Point, t: float) -> Point:
        return start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t

    def append_piece(start: Point, end: Point) -> None:
        nonlocal current
        if converter.dist(start, end) <= 1e-9:
            return
        if current is not None and converter.dist(tuple(current["points"][-1]), start) <= 1e-7:
            current["points"].append([end[0], end[1]])
        else:
            current = {"points": [[start[0], start[1]], [end[0], end[1]]], "closed": False, "masked": True}
            fragments.append(current)

    for segment_index in range(segment_count):
        start = source[segment_index]
        end = source[(segment_index + 1) % len(source)]
        breaks = [0.0, 1.0]
        for polygon in masks:
            for index, first in enumerate(polygon):
                value = _segment_intersection_parameter(start, end, first, polygon[(index + 1) % len(polygon)])
                if value is not None:
                    breaks.append(value)
        ordered = sorted(set(round(value, 10) for value in breaks))
        for index in range(1, len(ordered)):
            t0 = ordered[index - 1]
            t1 = ordered[index]
            if t1 - t0 <= 1e-10:
                continue
            midpoint = point_at(start, end, (t0 + t1) / 2.0)
            masked = any(point_in_polygon(midpoint, polygon) for polygon in masks)
            if masked:
                removed_any = True
                current = None
            else:
                append_piece(point_at(start, end, t0), point_at(start, end, t1))
    if not removed_any:
        return [{"points": [[x, y] for x, y in source], "closed": bool(closed), "masked": False}]
    if closed and len(fragments) > 1:
        first = fragments[0]
        last = fragments[-1]
        if converter.dist(tuple(last["points"][-1]), tuple(first["points"][0])) <= 1e-7:
            fragments[0] = {
                "points": [*last["points"], *first["points"][1:]],
                "closed": False,
                "masked": True,
            }
            fragments.pop()
    return [fragment for fragment in fragments if len(fragment["points"]) >= 2 and polyline_length(fragment["points"]) > 1e-8]


def _compiled_occlusion_masks(item: dict[str, Any], objects: dict[str, dict[str, Any]],
                              source_to_design: list[float], design_to_source: list[float],
                              fallback_operation: str) -> dict[str, list[list[Point]]]:
    masks_by_target: dict[str, list[list[Point]]] = {}
    for mask in item.get("occlusionMasks") or []:
        if mask.get("removed") or str(mask.get("mode") or "") != "mask-underlay":
            continue
        owner_id = str(mask.get("ownerObjectId") or "")
        owner = objects.get(owner_id)
        if owner is None or owner.get("removed") or normalize_operation(owner.get("operation"), fallback_operation) == "ignore":
            continue
        transform = owner.get("transform") or [1, 0, 0, 1, 0, 0]
        if _affine_inverse(transform) is None:
            raise ValueError(f"Maske sahibi vektor nesnesinin donusumu gecersiz: {owner_id or '?'}")
        transform = [float(value) for value in transform]
        polygon: list[Point] = []
        for point in mask.get("polygonSource") or []:
            design_point = _affine_point(source_to_design, point)
            transformed_design = _affine_point(transform, design_point)
            transformed_source = _affine_point(design_to_source, transformed_design)
            polygon.append((float(transformed_source[0]), float(transformed_source[1])))
        if len(polygon) < 3 or abs(polygon_signed_area(polygon)) <= 1e-9:
            raise ValueError(f"Vektor alt-cizgi maskesi gecersiz: {mask.get('id') or '?'}")
        for target_id in {str(value) for value in mask.get("targetObjectIds") or []}:
            if target_id and target_id != owner_id and target_id in objects:
                masks_by_target.setdefault(target_id, []).append(polygon)
    return masks_by_target


def compile_vector_objects(item: dict[str, Any]) -> list[dict[str, Any]]:
    """Compile V2 canonical graph/object ownership into legacy-compatible paths.

    The returned list is disposable toolpath IR. Canonical edge coordinates and
    object transforms remain unchanged in the project payload.
    """
    if _int(item.get("vectorModelVersion"), 0) != 2:
        return copy.deepcopy(item.get("vectorPaths") or [])

    graph = item.get("vectorGraph") or {}
    revision = max(0, _int(graph.get("revision"), 0))
    source_to_design = (item.get("sourceToDesign") or {}).get("matrix") or [1, 0, 0, 1, 0, 0]
    design_to_source = _affine_inverse(source_to_design)
    if design_to_source is None:
        raise ValueError("Vektor modelindeki sourceToDesign donusumu gecersiz.")
    source_to_design = [float(value) for value in source_to_design]
    edges = {str(edge.get("id") or ""): edge for edge in graph.get("edges") or [] if edge.get("id")}
    nodes = {str(node.get("id") or ""): node for node in graph.get("nodes") or [] if node.get("id")}
    fallback_operation = normalize_operation(item.get("operation"), "engrave_line")
    objects = {str(vector_object.get("id") or ""): vector_object for vector_object in item.get("vectorObjects") or []}
    masks_by_target = _compiled_occlusion_masks(item, objects, source_to_design, design_to_source, fallback_operation)
    exclusive_owners: dict[str, str] = {}
    emitted_keys: set[str] = set()
    canonical_operations: dict[str, str] = {}
    compiled: list[dict[str, Any]] = []

    for vector_object in item.get("vectorObjects") or []:
        object_id = str(vector_object.get("id") or "")
        object_operation = normalize_operation(vector_object.get("operation"), fallback_operation)
        if vector_object.get("removed") or object_operation == "ignore":
            continue
        transform = vector_object.get("transform") or [1, 0, 0, 1, 0, 0]
        if _affine_inverse(transform) is None:
            raise ValueError(f"Vektor nesnesinin donusumu gecersiz: {object_id or '?'}")
        transform = [float(value) for value in transform]
        attachment_policy = str(vector_object.get("attachmentPolicy") or ((vector_object.get("attachments") or [{}])[0].get("policy") or "detached"))
        if attachment_policy in {"pinned", "shared-joint"}:
            attachments = list(vector_object.get("attachments") or [])
            constrained_attachments = attachments[:1] if attachment_policy == "pinned" else attachments
            for attachment in constrained_attachments:
                node = nodes.get(str(attachment.get("graphNodeId") or ""))
                if node is None:
                    raise ValueError(f"Vektor nesnesi bulunmayan anchor dugumune bagli: {object_id or '?'}")
                anchor = _affine_point(source_to_design, node.get("position") or [0, 0])
                transformed_anchor = _affine_point(transform, anchor)
                if math.dist(anchor, transformed_anchor) > 1e-6:
                    raise ValueError(f"Vektor nesnesi {attachment_policy} anchor kisitini ihlal ediyor: {object_id or '?'}")
        transform_key = ",".join(f"{value:.9f}" for value in transform)

        for edge_ref in vector_object.get("edgeRefs") or []:
            edge_id = str(edge_ref.get("edgeId") or "")
            edge = edges.get(edge_id)
            if edge is None:
                raise ValueError(f"Vektor nesnesi bulunmayan edge'e bagli: {edge_id or '?'}")
            if str(edge_ref.get("ownership") or "exclusive") == "exclusive":
                previous_owner = exclusive_owners.get(edge_id)
                if previous_owner and previous_owner != object_id:
                    raise ValueError(f"Vektor edge birden fazla bagimsiz nesneye ait: {edge_id}")
                exclusive_owners[edge_id] = object_id
            if edge_ref.get("emit") is False or edge.get("removed"):
                continue

            operation = normalize_operation(edge.get("operation"), object_operation)
            if operation == "ignore":
                continue
            lineage = edge.get("lineage") or {}
            canonical_id = str(lineage.get("canonicalEdgeLineageId") or edge_id)
            source_interval = lineage.get("sourceInterval") or [0, 1]
            interval_key = ":".join(f"{float(value):.9f}" for value in source_interval)
            canonical_instance_key = f"{canonical_id}|{interval_key}|{transform_key}"
            previous_operation = canonical_operations.get(canonical_instance_key)
            if previous_operation and previous_operation != operation:
                raise ValueError(f"Ayni vektor edge icin celisen islemler var: {edge_id}")
            canonical_operations[canonical_instance_key] = operation
            emission_key = f"{canonical_instance_key}|{operation}"
            if emission_key in emitted_keys:
                continue
            emitted_keys.add(emission_key)

            points: list[list[float]] = []
            for point in edge.get("points") or []:
                design_point = _affine_point(source_to_design, point)
                transformed_design = _affine_point(transform, design_point)
                points.append(_affine_point(design_to_source, transformed_design))
            if len(points) < 2:
                continue
            legacy_path_id = str(lineage.get("legacyPathId") or "")
            identity_transform = all(abs(value - expected) <= 1e-9 for value, expected in zip(transform, [1, 0, 0, 1, 0, 0]))
            fragments = _clip_polyline_outside_polygons(points, bool(edge.get("closed")), masks_by_target.get(object_id, []))
            for fragment_index, fragment in enumerate(fragments, 1):
                path_data = copy.deepcopy(edge.get("pathData") or {})
                for key in ("points", "id", "edgeId", "objectId", "provenance"):
                    path_data.pop(key, None)
                fragment_emission_key = f"{emission_key}|mask:{fragment_index}" if fragment.get("masked") else emission_key
                identity_id = (
                    legacy_path_id
                    and identity_transform
                    and vector_object.get("createdBy") == "v1-migration"
                    and not fragment.get("masked")
                    and len(fragments) == 1
                )
                path_data.update(
                    {
                        "id": legacy_path_id if identity_id else f"{edge_id}@{object_id}{f':mask{fragment_index}' if fragment.get('masked') else ''}",
                        "points": fragment["points"],
                        "closed": bool(fragment.get("closed")),
                        "operation": operation,
                        "removed": False,
                        "locked": bool(vector_object.get("locked") or path_data.get("locked")),
                        "deformable": bool(vector_object.get("deformable", True) and path_data.get("deformable", True)),
                        "edgeId": edge_id,
                        "objectId": object_id,
                        "provenance": {
                            "objectId": object_id,
                            "edgeId": edge_id,
                            "graphRevision": revision,
                            "canonicalEdgeLineageId": canonical_id,
                            "sourceInterval": copy.deepcopy(source_interval),
                            "emissionKey": fragment_emission_key,
                            "occlusionMaskApplied": bool(fragment.get("masked")),
                        },
                    }
                )
                compiled.append(path_data)
    return compiled


def build_embedded_vector_engrave_lines(item: dict[str, Any],
                                        travel_feed: float | None = None,
                                        operation: str = "engrave",
                                        clip_region: ClipRegion | None = None,
                                        clip_close_boundary: bool = False,
                                        kerf: float = 0.0) -> list[str]:
    pattern = RasterPattern(
        path=Path(item.get("path") or item.get("sourcePath") or "vector"),
        x=_float(item.get("x")),
        y=_float(item.get("y")),
        width=_float(item.get("width")),
        height=_float(item.get("height")),
        rotation=_float(item.get("rotation")),
        power=_int(item.get("power"), 250),
        feed=_float(item.get("feed"), 1800.0),
        line_step=_float(item.get("lineStep"), 0.35),
        threshold=_int(item.get("threshold"), 140),
        mirror_x=bool(item.get("mirrorX")),
        mirror_y=bool(item.get("mirrorY")),
    )
    converter.validate_power(pattern.power)
    source_width = _float(item.get("sourceWidth"), pattern.width)
    source_height = _float(item.get("sourceHeight"), pattern.height)
    vector_engrave_mode = str(item.get("vectorEngraveMode") or "contour").lower()
    fallback_operation = "cut" if operation == "cut" else "engrave_fill" if vector_engrave_mode == "fill" else "engrave_line"

    def path_operation(vector_path: dict[str, Any]) -> str:
        raw_operation = str(vector_path.get("operation") or "").lower().replace("-", "_")
        current_operation = "cut" if fallback_operation == "cut" and raw_operation == "engrave" else normalize_operation(vector_path.get("operation"), fallback_operation)
        if current_operation == "engrave_fill" and (not bool(vector_path.get("closed", True)) or len(vector_path.get("points", [])) < 3):
            return "engrave_line"
        return current_operation

    vector_paths = compile_vector_objects(item)
    auto_ignored_indexes = auto_ignored_inner_cut_path_indexes(vector_paths, fallback_operation)
    active_paths = [
        vector_path
        for index, vector_path in enumerate(vector_paths)
        if not vector_path.get("removed")
        and len(vector_path.get("points", [])) >= 2
        and index not in auto_ignored_indexes
        and path_operation(vector_path) != "ignore"
    ]
    if not active_paths:
        raise ValueError("Vektorlestirilmis desende aktif cizgi kalmadi.")

    clean_name = gcode_comment_text(item.get("name"), "vector")
    op_label = "cut" if fallback_operation == "cut" else "engrave"
    lines = [f"({op_label} vector {clean_name} R{fmt(pattern.rotation)})", "S0"]
    vector_stats = item.get("vectorStats") or {}
    engrave_power = _int(item.get("engravePower", item.get("power", pattern.power)), pattern.power)
    engrave_feed = _float(item.get("engraveFeed", item.get("feed", pattern.feed)), pattern.feed)
    cut_power = _int(item.get("cutPower", item.get("power", pattern.power)), pattern.power)
    cut_feed = _float(item.get("cutFeed", item.get("feed", pattern.feed)), pattern.feed)
    emitted = 0
    current_point = pattern_point(pattern, 0.0, 0.0)

    fill_paths = [vector_path for vector_path in active_paths if path_operation(vector_path) == "engrave_fill"]
    if fill_paths:
        lines.append("(engrave fill begin)")
        source_step = max(0.05, pattern.line_step * source_height / max(0.001, pattern.height))
        text_settings = item.get("textSettings") if isinstance(item.get("textSettings"), dict) else {}
        generated_text = str(item.get("generatedKind") or "").lower() == "text" or bool(text_settings.get("mode"))
        segments = vector_fill_scan_segments(
            fill_paths,
            source_width=source_width,
            source_height=source_height,
            source_step=source_step,
            fill_invert=bool(vector_stats.get("filledTraceInvert")) and not generated_text,
        )
        if not segments:
            raise ValueError("Dolgulu vektor desen icin kazima satiri olusmadi.")
        reverse = False
        for start_source, end_source in segments:
            start_point = [end_source[0], end_source[1]] if reverse else [start_source[0], start_source[1]]
            end_point = [start_source[0], start_source[1]] if reverse else [end_source[0], end_source[1]]
            start = embedded_vector_point(pattern, start_point, source_width, source_height)
            end = embedded_vector_point(pattern, end_point, source_width, source_height)
            for clipped_start, clipped_end in clip_segment_to_region(start, end, clip_region):
                append_powered_polyline(
                    lines,
                    [clipped_start, clipped_end],
                    engrave_power,
                    engrave_feed,
                    travel_feed,
                )
                emitted += 1
                current_point = clipped_end
            reverse = not reverse
        lines.append(f"({op_label} vector fill end)")
        lines.append("S0")

    path_entries: list[dict[str, Any]] = []
    cut_entry_indexes: list[int] = []
    raw_cut_paths: list[list[Point]] = []
    for vector_path in active_paths:
        current_operation = path_operation(vector_path)
        if current_operation == "engrave_fill":
            continue
        points = vector_path.get("points", [])
        transformed = [embedded_vector_point(pattern, point, source_width, source_height) for point in points]
        closed_source = bool(vector_path.get("closed", True))
        if closed_source and transformed and converter.dist(transformed[0], transformed[-1]) > 1e-6:
            transformed.append(transformed[0])
        for clipped in clip_polyline_to_region(
            transformed,
            clip_region,
            close_boundary=clip_close_boundary and closed_source,
            closed_source=closed_source,
        ):
            entry_index = len(path_entries)
            path_entries.append(
                {
                    "operation": current_operation,
                    "vectorPath": vector_path,
                    "path": clipped,
                    "closedSource": closed_source,
                    "preserveStart": current_operation == "cut"
                    and _int(vector_path.get("tabCount", vector_path.get("microTabCount", 0)), 0) > 0,
                }
            )
            if current_operation == "cut":
                cut_entry_indexes.append(entry_index)
                raw_cut_paths.append(clipped)

    for entry_index, kerfed_path in zip(cut_entry_indexes, apply_kerf_to_paths(raw_cut_paths, kerf)):
        path_entries[entry_index]["path"] = kerfed_path

    engrave_entries = optimize_toolpath_records(
        [entry for entry in path_entries if entry["operation"] != "cut"],
        start=current_point,
    )
    if engrave_entries:
        current_point = engrave_entries[-1]["path"][-1]
    cut_entries = optimize_toolpath_records(
        [entry for entry in path_entries if entry["operation"] == "cut"],
        start=current_point,
        inner_first=True,
    )

    active_path_group = ""
    for entry in [*engrave_entries, *cut_entries]:
        current_operation = entry["operation"]
        next_group = "cut" if current_operation == "cut" else "engrave line"
        if next_group != active_path_group:
            if active_path_group:
                lines.append(f"({active_path_group} vector paths end)")
            lines.append(f"({next_group} begin)")
            active_path_group = next_group
        vector_path = entry["vectorPath"]
        clipped = entry["path"]
        closed_source = bool(entry["closedSource"])
        if current_operation == "cut":
            tab_count = _int(vector_path.get("tabCount", vector_path.get("microTabCount", 0)), 0)
            tab_width = _float(vector_path.get("tabWidth", vector_path.get("microTabWidth", 0.0)), 0.0)
            if closed_source and tab_count > 0 and tab_width > 0 and clipped and converter.dist(clipped[0], clipped[-1]) <= 0.05:
                lines.append(f"(micro tabs {tab_count} x {fmt(tab_width)}mm)")
                for tabbed in apply_micro_tabs_to_polyline(clipped, tab_count, tab_width):
                    append_powered_polyline(lines, tabbed, cut_power, cut_feed, travel_feed)
            else:
                append_powered_polyline(lines, clipped, cut_power, cut_feed, travel_feed)
        else:
            append_powered_polyline(lines, clipped, engrave_power, engrave_feed, travel_feed)
        current_point = clipped[-1]
        emitted += 1
    if active_path_group:
        lines.append(f"({active_path_group} vector paths end)")
    if emitted == 0 and clip_region is not None:
        lines.append(f"({op_label} vector clipped empty)")
        lines.append("S0")
        return lines
    lines.append(f"({op_label} vector end)")
    lines.append("S0")
    return lines


def embedded_vector_has_active_paths(item: dict[str, Any], fallback_operation: str) -> bool:
    vector_paths = compile_vector_objects(item)
    auto_ignored_indexes = auto_ignored_inner_cut_path_indexes(vector_paths, fallback_operation)
    for index, vector_path in enumerate(vector_paths):
        if index in auto_ignored_indexes:
            continue
        if vector_path.get("removed") or len(vector_path.get("points", [])) < 2:
            continue
        raw_operation = str(vector_path.get("operation") or "").lower().replace("-", "_")
        operation = "cut" if fallback_operation == "cut" and raw_operation == "engrave" else normalize_operation(vector_path.get("operation"), fallback_operation)
        if operation != "ignore":
            return True
    return False


def _float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(value)


def _int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(value))


def normalize_operation(value: Any, default: str = "engrave_line") -> str:
    operation = str(value or default).lower().replace("-", "_")
    if operation == "engrave":
        return "engrave_line"
    if operation in {"cut", "engrave_line", "engrave_fill", "ignore"}:
        return operation
    return default


def placement_boundary_margin(placement: dict[str, Any]) -> float:
    return max(0.0, _float(placement.get("boundaryMargin", placement.get("clipMargin", 0.0)), 0.0))


def placement_closes_boundary(placement: dict[str, Any]) -> bool:
    return bool(placement.get("clipCloseBoundary") or placement.get("boundaryClose"))


def part_fits_bed(part: LoadedPart, bed_width: float, bed_height: float, margin: float, allow_rotate: bool) -> bool:
    usable_width = max(0.0, bed_width - margin * 2.0)
    usable_height = max(0.0, bed_height - margin * 2.0)
    return (
        part.width <= usable_width + 0.001 and part.height <= usable_height + 0.001
    ) or (
        allow_rotate and part.height <= usable_width + 0.001 and part.width <= usable_height + 0.001
    )


def bounds_fit_bed(bounds: tuple[float, float, float, float], bed_width: float, bed_height: float, margin: float) -> bool:
    min_x, min_y, max_x, max_y = bounds
    return (
        min_x >= margin - 0.001
        and min_y >= margin - 0.001
        and max_x <= bed_width - margin + 0.001
        and max_y <= bed_height - margin + 0.001
    )


def normalize_available_area(settings: dict[str, Any], margin: float) -> ClipRegion | None:
    area = settings.get("availableArea") or settings.get("materialArea")
    if not isinstance(area, dict) or str(area.get("type") or "polygon").lower() != "polygon":
        return None
    points: list[Point] = []
    for point in area.get("points") or []:
        if not isinstance(point, dict):
            continue
        try:
            x = float(point.get("x"))
            y = float(point.get("y"))
        except (TypeError, ValueError):
            continue
        if math.isfinite(x) and math.isfinite(y):
            points.append((x, y))
    if len(points) < 3 or abs(polygon_signed_area(points)) < 0.01:
        return None
    return ClipRegion([points], margin)


def bounds_sample_points(bounds: tuple[float, float, float, float], step: float = 6.0) -> list[Point]:
    min_x, min_y, max_x, max_y = bounds
    points: list[Point] = [
        (min_x, min_y),
        (max_x, min_y),
        (max_x, max_y),
        (min_x, max_y),
        ((min_x + max_x) / 2.0, (min_y + max_y) / 2.0),
    ]
    width = max(0.0, max_x - min_x)
    height = max(0.0, max_y - min_y)
    x_steps = max(1, int(math.ceil(width / max(1.0, step))))
    y_steps = max(1, int(math.ceil(height / max(1.0, step))))
    for index in range(1, x_steps):
        x = min_x + width * index / x_steps
        points.extend([(x, min_y), (x, max_y)])
    for index in range(1, y_steps):
        y = min_y + height * index / y_steps
        points.extend([(min_x, y), (max_x, y)])
    return points


def bounds_fit_active_area(bounds: tuple[float, float, float, float],
                           bed_width: float,
                           bed_height: float,
                           margin: float,
                           available_area: ClipRegion | None) -> bool:
    if available_area is None:
        return bounds_fit_bed(bounds, bed_width, bed_height, margin)
    if not bounds_fit_bed(bounds, bed_width, bed_height, 0.0):
        return False
    min_x, min_y, max_x, max_y = bounds
    sample_step = max(2.0, min(8.0, min(max_x - min_x, max_y - min_y) / 3.0 if max_x > min_x and max_y > min_y else 4.0))
    return all(clip_region_contains(point, available_area) for point in bounds_sample_points(bounds, sample_step))


def transformed_bounds(paths: list[list[Point]]) -> tuple[float, float, float, float]:
    return paths_bounds(paths) if paths else (0.0, 0.0, 0.0, 0.0)


def raster_pattern_bounds(pattern: RasterPattern) -> tuple[float, float, float, float]:
    corners = [
        pattern_point(pattern, 0.0, 0.0),
        pattern_point(pattern, pattern.width, 0.0),
        pattern_point(pattern, pattern.width, pattern.height),
        pattern_point(pattern, 0.0, pattern.height),
    ]
    xs = [point[0] for point in corners]
    ys = [point[1] for point in corners]
    return min(xs), min(ys), max(xs), max(ys)


def raster_pattern_corners(pattern: RasterPattern) -> list[Point]:
    return [
        pattern_point(pattern, 0.0, 0.0),
        pattern_point(pattern, pattern.width, 0.0),
        pattern_point(pattern, pattern.width, pattern.height),
        pattern_point(pattern, 0.0, pattern.height),
    ]


def bounds_overlap(first: tuple[float, float, float, float],
                   second: tuple[float, float, float, float],
                   tolerance: float = 0.001) -> bool:
    return not (
        first[2] <= second[0] + tolerance
        or first[0] >= second[2] - tolerance
        or first[3] <= second[1] + tolerance
        or first[1] >= second[3] - tolerance
    )


def clip_region_bounds(polygons: list[list[Point]]) -> tuple[float, float, float, float] | None:
    points = [point for polygon in polygons for point in polygon]
    if not points:
        return None
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def pattern_bounds_inside_clip_region(pattern: RasterPattern, clip_region: ClipRegion) -> bool:
    return all(clip_region_contains(point, clip_region) for point in raster_pattern_corners(pattern))


def pattern_bounds_crosses_clip_region(pattern: RasterPattern, clip_region: ClipRegion) -> bool:
    region_bounds = clip_region_bounds(clip_region.polygons)
    if region_bounds is None or not bounds_overlap(raster_pattern_bounds(pattern), region_bounds):
        return False
    return not pattern_bounds_inside_clip_region(pattern, clip_region)


def iter_powered_toolpaths_from_gcode(lines: Iterable[str]) -> Iterator[list[Point]]:
    active_path: list[Point] = []
    current: Point = (0.0, 0.0)
    motion_mode = 0
    power = 0.0

    def take_active_path() -> list[Point] | None:
        nonlocal active_path
        result = active_path if len(active_path) >= 2 else None
        active_path = []
        return result

    for raw_item in lines:
        for raw_line in str(raw_item).splitlines():
            code = re.sub(r"\([^)]*\)", "", raw_line).split(";", 1)[0].strip()
            words = [(letter.upper(), float(value)) for letter, value in GCODE_WORD_RE.findall(code)]
            if not words:
                continue

            line_motion = motion_mode
            line_power = power
            x = current[0]
            y = current[1]
            has_axis = False
            for letter, value in words:
                if letter == "G":
                    rounded = int(round(value))
                    if rounded in {0, 1}:
                        line_motion = rounded
                    elif rounded in {2, 3}:
                        line_motion = rounded
                elif letter == "M" and int(round(value)) == 5:
                    line_power = 0.0
                elif letter == "S":
                    line_power = value
                elif letter == "X":
                    x = value
                    has_axis = True
                elif letter == "Y":
                    y = value
                    has_axis = True

            target = (x, y)
            if has_axis:
                if line_motion in {2, 3} and line_power > 0:
                    raise ValueError("Nihai takim yolu dogrulanamayan yay hareketi iceriyor.")
                if line_motion == 1 and line_power > 0 and converter.dist(current, target) > 1e-9:
                    if not active_path or converter.dist(active_path[-1], current) > 1e-6:
                        completed = take_active_path()
                        if completed is not None:
                            yield completed
                        active_path = [current]
                    active_path.append(target)
                else:
                    completed = take_active_path()
                    if completed is not None:
                        yield completed
                current = target
            elif line_power <= 0:
                completed = take_active_path()
                if completed is not None:
                    yield completed

            motion_mode = line_motion
            power = line_power

    completed = take_active_path()
    if completed is not None:
        yield completed


def powered_toolpaths_from_gcode(lines: Iterable[str]) -> list[list[Point]]:
    return list(iter_powered_toolpaths_from_gcode(lines))


def validate_final_toolpaths(paths: Iterable[list[Point]],
                             bed_width: float,
                             bed_height: float,
                             margin: float,
                             available_area: ClipRegion | None) -> None:
    def validate_point(point: Point) -> None:
        x, y = point
        if not math.isfinite(x) or not math.isfinite(y):
            raise ValueError("Nihai takim yolu gecersiz koordinat iceriyor.")
        if not bounds_fit_bed((x, y, x, y), bed_width, bed_height, margin):
            raise ValueError(
                f"Nihai takim yolu tabla veya kenar payi disina cikiyor: X{fmt(x)} Y{fmt(y)}."
            )
        if available_area is not None and not clip_region_contains(point, available_area):
            raise ValueError(
                f"Nihai takim yolu cizilen kullanilabilir alanin disina cikiyor: X{fmt(x)} Y{fmt(y)}."
            )

    has_usable_path = False
    for path in paths:
        if len(path) < 2:
            continue
        has_usable_path = True
        validate_point(path[0])
        for start, end in zip(path, path[1:]):
            validate_point(end)
            if available_area is None:
                continue
            length = converter.dist(start, end)
            divisions = max(1, int(math.ceil(length / 0.25)))
            for index in range(1, divisions):
                ratio = index / divisions
                validate_point(
                    (
                        start[0] + (end[0] - start[0]) * ratio,
                        start[1] + (end[1] - start[1]) * ratio,
                    )
                )
    if not has_usable_path:
        raise ValueError("G-code icin aktif kesim veya kazima yolu yok.")


def toolpaths_fit_generation_area(paths: Iterable[list[Point]],
                                  bed_width: float,
                                  bed_height: float,
                                  margin: float,
                                  available_area: ClipRegion | None) -> bool:
    try:
        validate_final_toolpaths(paths, bed_width, bed_height, margin, available_area)
    except ValueError:
        return False
    return True


def generate_from_state(state: dict[str, Any]) -> dict[str, Any]:
    settings = state.get("settings", {})
    if not isinstance(settings, dict):
        raise ValueError("G-code ayarlari gecersiz.")
    missing_bed_settings = [
        key
        for key in ("bedWidth", "bedHeight")
        if key not in settings or settings.get(key) in (None, "")
    ]
    if missing_bed_settings:
        raise ValueError("G-code uretimi icin tabla genisligi ve yuksekligi zorunludur.")
    output_path = Path(state.get("outputPath") or "")
    if not output_path:
        raise ValueError("Cikti yolu secilmedi.")

    tolerance = _float(settings.get("tolerance"), 0.25)
    join_tolerance = _float(settings.get("joinTolerance"), 0.05)
    inner_first = bool(settings.get("innerFirst", True))
    parts_by_id: dict[str, LoadedPart] = {}
    for part_data in state.get("parts", []):
        part_id = str(part_data["id"])
        path_text = str(part_data.get("path") or "")
        source_path = Path(path_text) if path_text else None
        if source_path and source_path.is_file():
            parts_by_id[part_id] = load_part(
                source_path,
                part_id,
                tolerance,
                join_tolerance,
                inner_first,
            )
        elif part_data.get("paths"):
            parts_by_id[part_id] = part_from_payload(part_data, part_id)
        else:
            missing = source_path if source_path else part_data.get("name") or part_id
            raise ValueError(f"DXF bulunamadi ve projede gomulu geometri yok: {missing}")

    bed_width = _float(settings.get("bedWidth"), 0.0)
    bed_height = _float(settings.get("bedHeight"), 0.0)
    margin = max(0.0, _float(settings.get("margin"), 0.0))
    allow_rotate = bool(settings.get("allowRotate", True))
    available_area = normalize_available_area(settings, margin)
    if bed_width <= 0 or bed_height <= 0 or bed_width - margin * 2 <= 0 or bed_height - margin * 2 <= 0:
        raise ValueError("Tabla olcusu veya kenar payi gecersiz.")

    travel_feed = _float(settings.get("travelFeed"), 3000.0)
    feed = _float(settings.get("feed"), 500.0)
    power = _int(settings.get("power"), 1000)
    engrave_power = _int(settings.get("engravePower"), 250)
    engrave_feed = _float(settings.get("engraveFeed"), 1800.0)
    converter.validate_power(engrave_power)
    laser_cmd = str(settings.get("laserCmd") or "M4").strip().upper()
    if laser_cmd not in {"M3", "M4"}:
        raise ValueError("Lazer komutu yalniz M3 veya M4 olabilir.")
    # Kerf: isin kalinligi telafisi (0 = kapali). Guvenli ust sinir 1 mm.
    kerf = min(1.0, max(0.0, _float(settings.get("kerf"), 0.0)))

    cut_paths: list[list[Point]] = []
    clip_data_by_placement: dict[str, dict[str, Any]] = {}
    pattern_lines: list[str] = []
    active_output_count = 0
    excluded_object_count = 0
    generated_pattern_count = 0
    placements_data = state.get("placements", [])
    known_placement_ids = {str(placement.get("id") or "") for placement in placements_data}
    non_production_placement_ids: set[str] = set()
    excluded_placement_ids: set[str] = set()
    for placement in placements_data:
        placement_id = str(placement.get("id") or "")
        operation = normalize_operation(placement.get("operation"), "cut")
        if operation == "ignore":
            non_production_placement_ids.add(placement_id)
            continue
        part_id = str(placement["partId"])
        part = parts_by_id.get(part_id)
        if part is None:
            raise ValueError(f"Parca bulunamadi: {part_id}")
        transformed = transform_paths(part, placement)
        if (
            not part_fits_bed(part, bed_width, bed_height, margin, allow_rotate)
            or not bounds_fit_active_area(transformed_bounds(transformed), bed_width, bed_height, margin, available_area)
        ):
            non_production_placement_ids.add(placement_id)
            excluded_placement_ids.add(placement_id)
            excluded_object_count += 1
            continue
        if operation == "cut":
            # Kerf telafisi yalniz KESIMDE ve yerlesim (parca) bazinda:
            # delik tespiti ayni parcanin yollari arasinda yapilmali.
            placement_paths = apply_kerf_to_paths(transformed, kerf)
            if not toolpaths_fit_generation_area(placement_paths, bed_width, bed_height, margin, available_area):
                non_production_placement_ids.add(placement_id)
                excluded_placement_ids.add(placement_id)
                excluded_object_count += 1
                continue
            cut_paths.extend(placement_paths)
        else:
            if not toolpaths_fit_generation_area(transformed, bed_width, bed_height, margin, available_area):
                non_production_placement_ids.add(placement_id)
                excluded_placement_ids.add(placement_id)
                excluded_object_count += 1
                continue
            for path in optimize_toolpaths(
                transformed,
                start=(_float(placement.get("x")), _float(placement.get("y"))),
            ):
                append_powered_polyline(pattern_lines, path, engrave_power, engrave_feed, travel_feed)
        active_output_count += len(transformed)
        # Kirpma sinirlari TASARIM sinirinda kalir (kerf'ten etkilenmez):
        # desen, parcanin tasarlanan kenarina gore kirpilir.
        placement_clip_polygons = closed_clip_polygons(transformed)
        clip_data_by_placement[placement_id] = {
            "polygons": placement_clip_polygons,
            "margin": placement_boundary_margin(placement),
            "close": placement_closes_boundary(placement),
        }

    for item in state.get("patterns", []):
        if not item.get("path"):
            continue
        kind = str(item.get("kind") or "").lower()
        operation = normalize_operation(item.get("operation"), "engrave_line")
        if operation == "ignore":
            continue
        parent_id = str(item.get("parentId") or "")
        if parent_id and parent_id not in known_placement_ids:
            raise ValueError(f"Desenin bagli oldugu DXF parcasi bulunamadi: {item.get('name') or item.get('path')}")
        if parent_id in non_production_placement_ids:
            if parent_id in excluded_placement_ids:
                excluded_object_count += 1
            continue
        if kind not in {"svg", "vector"} and operation == "cut":
            operation = "engrave_fill"
        gcode_operation = "cut" if operation == "cut" else "engrave"
        vector_fallback_operation = "cut" if operation == "cut" else "engrave_fill" if operation == "engrave_fill" else "engrave_line"
        has_embedded_vectors = kind == "vector" or (
            kind == "svg" and (item.get("vectorPaths") or _int(item.get("vectorModelVersion"), 0) == 2)
        )
        if has_embedded_vectors and not embedded_vector_has_active_paths(item, vector_fallback_operation):
            continue
        default_pattern_power = power if operation == "cut" else 250
        default_pattern_feed = feed if operation == "cut" else 1800.0
        pattern = RasterPattern(
            path=Path(item["path"]),
            x=_float(item.get("x")),
            y=_float(item.get("y")),
            width=_float(item.get("width")),
            height=_float(item.get("height")),
            rotation=_float(item.get("rotation")),
            power=_int(item.get("power"), default_pattern_power),
            feed=_float(item.get("feed"), default_pattern_feed),
            line_step=_float(item.get("lineStep"), 0.35),
            threshold=_int(item.get("threshold"), 140),
            mirror_x=bool(item.get("mirrorX")),
            mirror_y=bool(item.get("mirrorY")),
            raster_mode=str(item.get("rasterMode") or "threshold"),
            power_min=_int(item.get("powerMin"), 0),
            gamma=_float(item.get("gamma"), 1.0),
            bidirectional=bool(item.get("bidirectional", True)),
        )
        pattern_bounds = raster_pattern_bounds(pattern)
        extra_clip_margin = max(0.0, _float(item.get("clipMargin"), 0.0))
        clip_close_boundary = bool(item.get("clipCloseBoundary"))
        if parent_id:
            if parent_id not in clip_data_by_placement:
                raise ValueError(f"Desenin bagli oldugu DXF parcasi bulunamadi: {item.get('name') or pattern.path.name}")
            parent_clip_data = clip_data_by_placement[parent_id]
            clip_polygons = parent_clip_data["polygons"]
            if not clip_polygons:
                raise ValueError(f"Bagli DXF parcasinda kapali kirpma siniri yok: {item.get('name') or pattern.path.name}")
            clip_margin = float(parent_clip_data.get("margin", 0.0)) + extra_clip_margin
            clip_close_boundary = clip_close_boundary or bool(parent_clip_data.get("close"))
        else:
            clip_polygons = []
            placement_margins: list[float] = []
            for placement_clip_data in clip_data_by_placement.values():
                placement_clip_polygons = placement_clip_data["polygons"]
                region_bounds = clip_region_bounds(placement_clip_polygons)
                if region_bounds and bounds_overlap(pattern_bounds, region_bounds):
                    clip_polygons.extend(placement_clip_polygons)
                    placement_margins.append(float(placement_clip_data.get("margin", 0.0)))
                    clip_close_boundary = clip_close_boundary or bool(placement_clip_data.get("close"))
            clip_margin = (max(placement_margins) if placement_margins else 0.0) + extra_clip_margin
        clip_region = ClipRegion(clip_polygons, clip_margin) if clip_polygons else None
        item_lines: list[str]
        if has_embedded_vectors:
            vector_item = {
                **item,
                "power": item.get("power", default_pattern_power),
                "feed": item.get("feed", default_pattern_feed),
                "cutPower": item.get("cutPower", power),
                "cutFeed": item.get("cutFeed", feed),
                "engravePower": item.get("engravePower", item.get("power", engrave_power)),
                "engraveFeed": item.get("engraveFeed", item.get("feed", engrave_feed)),
                "vectorEngraveMode": "fill" if operation == "engrave_fill" else "contour",
            }
            item_lines = build_embedded_vector_engrave_lines(
                vector_item,
                travel_feed,
                gcode_operation,
                clip_region,
                clip_close_boundary,
                kerf,
            )
        elif kind == "svg" or pattern.path.suffix.lower() == ".svg":
            item_lines = build_svg_vector_engrave_lines(
                pattern,
                travel_feed,
                gcode_operation,
                clip_region,
                clip_close_boundary,
                kerf,
            )
        else:
            item_lines = build_raster_engrave_lines(pattern, travel_feed, clip_region)
        if not toolpaths_fit_generation_area(
            iter_powered_toolpaths_from_gcode(item_lines),
            bed_width,
            bed_height,
            margin,
            available_area,
        ):
            excluded_object_count += 1
            continue
        pattern_lines.extend(item_lines)
        active_output_count += 1
        generated_pattern_count += 1

    cut_paths = optimize_toolpaths(cut_paths, start=(margin, margin), inner_first=True)

    if active_output_count == 0:
        raise ValueError("G-code icin aktif kesim veya kazima yolu yok.")

    final_toolpaths = chain(cut_paths, iter_powered_toolpaths_from_gcode(pattern_lines))
    validate_final_toolpaths(final_toolpaths, bed_width, bed_height, margin, available_area)

    rapid_feed_value = settings.get("rapidFeed")
    rapid_feed = None if rapid_feed_value in (None, "") else _float(rapid_feed_value)
    pierce_delay = _float(settings.get("pierceDelay"), 0.0)
    overcut = _float(settings.get("overcut"), 0.8)
    passes = max(1, _int(settings.get("passes"), 1))
    air_assist_command = str(settings.get("airAssistCommand") or "M8").upper() if bool(settings.get("airAssist", False)) else None

    converter.write_gcode(
        output_path=output_path,
        paths=cut_paths,
        feed=feed,
        power=power,
        rapid_feed=rapid_feed,
        laser_cmd=laser_cmd,
        pierce_delay=pierce_delay,
        comments=True,
        overcut=overcut,
        return_to_origin=bool(settings.get("returnToOrigin", False)),
        travel_feed=travel_feed,
        passes=passes,
        pre_cut_lines=pattern_lines,
        air_assist_command=air_assist_command,
    )

    min_x, min_y, max_x, max_y = paths_bounds(cut_paths) if cut_paths else (0.0, 0.0, 0.0, 0.0)
    return {
        "outputPath": str(output_path),
        "cutPathCount": len(cut_paths),
        "patternCount": generated_pattern_count,
        "excludedObjectCount": excluded_object_count,
        "cutWidth": max_x - min_x,
        "cutHeight": max_y - min_y,
        "lineCount": len(output_path.read_text(encoding="utf-8").splitlines()),
    }


def _unique_gcode_output_path(path: Path) -> Path:
    if not path.exists():
        return path
    for index in range(2, 1000):
        candidate = path.with_name(f"{path.stem}_{index}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise ValueError(f"Benzersiz cikti adi bulunamadi: {path}")


def _replace_gcode_param(line: str, letter: str, value: float) -> tuple[str, bool]:
    pattern = re.compile(rf"\b{letter}[-+]?\d+(?:\.\d+)?\b", re.IGNORECASE)
    replacement = f"{letter}{fmt(float(value))}"
    changed = False

    def repl(_match: re.Match[str]) -> str:
        nonlocal changed
        changed = True
        return replacement

    return pattern.sub(repl, line, count=1), changed


def _positive_s_command(line: str) -> bool:
    match = re.search(r"\bS([-+]?\d+(?:\.\d+)?)\b", line, flags=re.IGNORECASE)
    return bool(match and float(match.group(1)) > 0)


def convert_gcode_engrave_vectors_to_cut(input_path: Path,
                                         cut_power: int = 1000,
                                         cut_feed: float = 500.0,
                                         output_path: Path | None = None) -> dict[str, Any]:
    input_path = Path(input_path)
    if not input_path.exists() or not input_path.is_file():
        raise ValueError(f"G-code bulunamadi: {input_path}")
    cut_power = max(0, min(1000, int(round(float(cut_power)))))
    cut_feed = max(1.0, float(cut_feed))
    if output_path is None:
        output_path = input_path.with_name(f"{input_path.stem}_cut{input_path.suffix or '.nc'}")
    output_path = _unique_gcode_output_path(Path(output_path))

    text = input_path.read_text(encoding="utf-8", errors="replace")
    lowered = text.lower()
    if "(engrave raster" in lowered or "(raster" in lowered or "vector fill end" in lowered:
        raise ValueError("Raster veya dolgulu kazima G-code'u otomatik kesime cevrilmez. Kaynak desende islemi Kesim yapip yeniden G-code olusturun.")

    converted: list[str] = []
    in_convert_block = False
    laser_on = False
    powered_feed_set = False
    converted_blocks = 0
    power_changes = 0
    feed_changes = 0
    block_start_re = re.compile(r"\(engrave\s+(vector|svg)\b(?!\s+end\))", re.IGNORECASE)
    block_end_re = re.compile(r"\((?:engrave|cut)\s+(vector|svg)\s+end\)", re.IGNORECASE)
    motion_re = re.compile(r"^\s*G0?1\b", re.IGNORECASE)

    for raw_line in text.splitlines():
        line = raw_line
        if block_start_re.search(line):
            in_convert_block = True
            laser_on = False
            powered_feed_set = False
            converted_blocks += 1
            line = re.sub(r"\(engrave", "(cut", line, count=1, flags=re.IGNORECASE)
        elif in_convert_block and block_end_re.search(line):
            line = re.sub(r"\(engrave", "(cut", line, count=1, flags=re.IGNORECASE)

        if in_convert_block and not line.lstrip().startswith("("):
            if re.search(r"\bS[-+]?\d+(?:\.\d+)?\b", line, flags=re.IGNORECASE):
                if _positive_s_command(line):
                    line, changed = _replace_gcode_param(line, "S", cut_power)
                    if changed:
                        power_changes += 1
                    laser_on = True
                    powered_feed_set = False
                else:
                    laser_on = False
                    powered_feed_set = False
            if laser_on and motion_re.search(line) and not powered_feed_set:
                if re.search(r"\bF[-+]?\d+(?:\.\d+)?\b", line, flags=re.IGNORECASE):
                    line, changed = _replace_gcode_param(line, "F", cut_feed)
                    if changed:
                        feed_changes += 1
                else:
                    line = f"{line} F{fmt(cut_feed)}"
                    feed_changes += 1
                powered_feed_set = True

        converted.append(line)
        if in_convert_block and block_end_re.search(line):
            in_convert_block = False
            laser_on = False
            powered_feed_set = False

    if converted_blocks <= 0:
        raise ValueError("Bu dosyada cevrilecek vektor/SVG kazima blogu bulunamadi.")

    output_path.write_text("\n".join(converted) + "\n", encoding="utf-8")
    return {
        "inputPath": str(input_path),
        "outputPath": str(output_path),
        "convertedBlocks": converted_blocks,
        "powerChanges": power_changes,
        "feedChanges": feed_changes,
        "cutPower": cut_power,
        "cutFeed": cut_feed,
    }
