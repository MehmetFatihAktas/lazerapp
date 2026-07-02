#!/usr/bin/env python3
"""Core geometry and G-code helpers for the visual laser editor."""

from __future__ import annotations

import base64
import io
import math
import mimetypes
import re
import tempfile
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Any

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


@dataclass
class ClipRegion:
    polygons: list[list[Point]]
    margin: float = 0.0


def fmt(value: float) -> str:
    return converter.fmt(value)


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
            x_intersect = x1 + (y - y1) * (x2 - x1) / max(1e-12, y2 - y1)
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
    current_end: Point | None = None

    for index in range(divisions):
        t0 = index / divisions
        t1 = (index + 1) / divisions
        p0 = (start[0] + (end[0] - start[0]) * t0, start[1] + (end[1] - start[1]) * t0)
        p1 = (start[0] + (end[0] - start[0]) * t1, start[1] + (end[1] - start[1]) * t1)
        midpoint = ((p0[0] + p1[0]) / 2.0, (p0[1] + p1[1]) / 2.0)
        if clip_region_contains(midpoint, clip_region):
            if current_start is None:
                current_start = p0
            current_end = p1
        elif current_start is not None and current_end is not None:
            if converter.dist(current_start, current_end) >= 0.03:
                result.append((current_start, current_end))
            current_start = None
            current_end = None

    if current_start is not None and current_end is not None and converter.dist(current_start, current_end) >= 0.03:
        result.append((current_start, current_end))
    return result


def clip_polyline_to_region(points: list[Point],
                            clip_region: ClipRegion | None,
                            step: float = 0.25) -> list[list[Point]]:
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
                             light_fill_threshold: float = 235.0) -> tuple[list[dict[str, Any]], dict[str, Any]]:
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
                    "sourceEngine": "vtracer",
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
                           skeleton: Any | None = None) -> tuple[list[dict[str, Any]], dict[str, Any]]:
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
    processed: list[tuple[float, list[list[float]], bool, int]] = []
    for raw_index, raw_path in enumerate(raw_paths):
        points = [[float(x), float(y)] for x, y in raw_path]
        closed = len(points) > 3 and math.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]) <= 1.5
        trim_length = max(4.0, min(18.0, max(float(stitch_gap) * 3.0, float(min_length) * 1.25)))
        points = _simplify_points(points, float(simplify), closed)
        if not closed:
            points = trim_open_polyline_spurs(points, trim_length)
        points = smooth_open_points(points, int(smooth)) if not closed else [[float(x), float(y)] for x, y in smooth_closed_points(np.array(points), int(smooth))]
        if simplify > 0:
            points = _simplify_points(points, max(0.15, float(simplify) * 0.65), closed)
        if not closed:
            points = trim_open_polyline_spurs(points, trim_length)
        points = _dedupe_points(points, closed=closed, min_distance=max(0.45, float(simplify) * 0.45))
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
        background_normalize=background_normalize,
        denoise=denoise,
    )
    threshold_binary = binary.copy()
    timings["threshold"] = time.perf_counter() - stage_start
    stage_start = time.perf_counter()
    binary, removed_border_components = clean_border_components(binary, remove_border, margin=3)
    timings["borderCleanup"] = time.perf_counter() - stage_start

    requested_mode = (mode or "auto").lower()
    mode = "auto" if requested_mode == "auto" else requested_mode
    pre_trace_stroke_estimate = estimate_stroke_width(binary)
    foreground_ratio = float(np.count_nonzero(binary)) / float(max(1, binary.shape[0] * binary.shape[1]))
    if mode == "auto":
        mode = "potrace" if 0 < pre_trace_stroke_estimate <= 10.0 and foreground_ratio <= 0.35 else "vtracer"
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
                background_normalize=background_normalize,
                denoise=denoise,
            )
            line_scale = max(1, int(line_stats.get("lineArtUpscale", 1)))
            vector_paths, stats = trace_line_art_fill_vectors(
                line_binary,
                min_length=max(0.0, float(min_length) * line_scale),
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
                    min_length=max(0.0, float(min_length)),
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
                    min_length=max(0.0, float(min_length)),
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
            min_length=max(0.0, float(min_length)),
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
            min_length=max(0.0, float(min_length)),
            simplify=max(0.02, float(simplify)),
            max_contours=max(1, int(max_contours)),
            color_mode="binary",
            smooth=int(smooth),
        )
        stats.update(polish_stats)
        stats["vtracerSvgBytes"] = len(vtracer_svg_text.encode("utf-8"))
        timings["trace"] = time.perf_counter() - stage_start
    elif mode == "centerline":
        centerline_solidify_radius = int(max(0.0, min(5.0, round(float(stitch_gap)))))
        if centerline_solidify_radius > 0:
            binary = solidify_centerline_mask(binary, centerline_solidify_radius)
        stage_start = time.perf_counter()
        raw_skeleton_preview = thin_binary(binary)
        spur_length = adaptive_spur_length(binary, raw_skeleton_preview, float(stitch_gap), float(min_length))
        skeleton_preview, pruned_spur_pixels = prune_skeleton_spurs(
            raw_skeleton_preview,
            max_length=spur_length,
            max_rounds=6,
        )
        timings["skeletonPreview"] = time.perf_counter() - stage_start
        stage_start = time.perf_counter()
        vector_paths, stats = trace_skeleton_vectors(
            binary,
            min_length=max(0.0, float(min_length)),
            simplify=max(0.0, float(simplify)),
            smooth=int(smooth),
            max_contours=max(1, int(max_contours)),
            stitch_gap=float(stitch_gap),
            skeleton=skeleton_preview,
        )
        stats["prunedSpurPixels"] = pruned_spur_pixels
        stats["centerlineSolidifyRadius"] = centerline_solidify_radius
        vector_paths, stitched_count = stitch_open_vector_paths(vector_paths, min(2.0, float(stitch_gap)))
        stats["stitchedGap"] = int(stats.get("stitchedRaw", 0)) + stitched_count
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
        min_length=max(0.0, float(min_length)),
            mode=mode,
    )
    timings["postFilter"] = time.perf_counter() - stage_start
    stats.update(post_stats)
    stats["removedBorderComponents"] = removed_border_components
    # Otomatik mod: ince tarama/cizgi sanati icin Potrace, dolu/kalin sekiller
    # icin VTracer daha iyi sonuc verir. Manuel secimler korunur.
    stroke_estimate = pre_trace_stroke_estimate
    stats["estimatedStrokeWidth"] = round(stroke_estimate, 1)
    stats["requestedMode"] = requested_mode
    stats["traceEngine"] = mode
    stats["foregroundRatio"] = round(foreground_ratio, 4)
    if mode == "potrace":
        fill_ratio = compound_fill_ratio(vector_paths, float(width), float(height))
        stats["filledTraceRatio"] = round(fill_ratio, 4)
        stats["filledTraceInvert"] = bool(fill_ratio > 0.5)
    stats["suggestedMode"] = "auto"
    stats["modeMismatch"] = bool(requested_mode != "auto" and stroke_estimate > 0 and mode not in {"potrace", "vtracer"})
    stats["pathsTotal"] = len(vector_paths)
    stats["pathsKept"] = sum(
        1
        for item in vector_paths
        if not item.get("removed") and len(item.get("points", [])) >= 2
    )
    stage_start = time.perf_counter()
    debug_previews = [numpy_image_preview("Gri", image)]
    if background_normalize:
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
    return {
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
            "minLength": min_length,
            "simplify": simplify,
            "smooth": smooth,
            "invert": invert,
            "maxContours": max_contours,
            "contrast": contrast,
            "morphOpen": morph_open,
            "morphClose": morph_close,
            "adaptiveBlock": adaptive_block,
            "adaptiveC": adaptive_c,
            "maxDimension": max_dimension,
            "removeBorder": remove_border,
            "stitchGap": stitch_gap,
            "backgroundNormalize": background_normalize,
            "denoise": denoise,
            "usedThreshold": used_threshold,
            "processingScale": image_stats["processingScale"],
        },
        "stats": stats,
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
    clean_name = pattern.path.name.encode("ascii", errors="ignore").decode("ascii") or "image"
    clean_name = clean_name.replace("(", "_").replace(")", "_")
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
                                   clip_region: ClipRegion | None = None) -> list[str]:
    if not pattern.path.exists():
        raise ValueError(f"SVG dosyasi bulunamadi: {pattern.path}")
    converter.validate_power(pattern.power)
    view_box, _width, _height = svg_viewbox_and_size(pattern.path)
    if view_box[2] <= 0 or view_box[3] <= 0:
        raise ValueError("SVG viewBox olcusu gecersiz.")

    root = ET.parse(pattern.path).getroot()
    clean_name = pattern.path.name.encode("ascii", errors="ignore").decode("ascii") or "svg"
    clean_name = clean_name.replace("(", "_").replace(")", "_")
    op_label = "cut" if operation == "cut" else "engrave"
    lines = [f"({op_label} svg {clean_name} R{fmt(pattern.rotation)})", "S0"]
    path_count = 0

    for element in root.iter(f"{{{SVG_NS}}}path"):
        path_data = element.get("d")
        if not path_data:
            continue
        for polyline in svg_path_to_polylines(path_data):
            transformed = [svg_local_point(pattern, point, view_box) for point in polyline]
            if len(transformed) < 2:
                continue
            for clipped in clip_polyline_to_region(transformed, clip_region):
                append_powered_polyline(lines, clipped, pattern.power, pattern.feed, travel_feed)
                path_count += 1

    if path_count == 0:
        if clip_region is not None:
            lines.append(f"({op_label} svg clipped empty)")
            lines.append("S0")
            return lines
        raise ValueError("SVG icinde G-code'a cevrilecek path bulunamadi.")
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


def vector_fill_scan_segments(vector_paths: list[dict[str, Any]],
                              source_width: float,
                              source_height: float,
                              source_step: float,
                              fill_invert: bool = False) -> list[tuple[Point, Point]]:
    source_width = max(0.001, float(source_width))
    source_height = max(0.001, float(source_height))
    source_step = max(0.05, float(source_step))
    polygons = [
        [[float(point[0]), float(point[1])] for point in item.get("points", [])]
        for item in vector_paths
        if not item.get("removed") and item.get("closed", True) and len(item.get("points", [])) >= 3
    ]
    segments: list[tuple[Point, Point]] = []
    y = 0.0
    while y <= source_height + 1e-6:
        intersections: list[float] = []
        if fill_invert:
            intersections.extend([0.0, source_width])
        for points in polygons:
            count = len(points)
            for index in range(count):
                x1, y1 = points[index]
                x2, y2 = points[(index + 1) % count]
                if abs(y2 - y1) < 1e-9:
                    continue
                low_y = min(y1, y2)
                high_y = max(y1, y2)
                if y < low_y or y >= high_y:
                    continue
                x = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                if -1e-6 <= x <= source_width + 1e-6:
                    intersections.append(max(0.0, min(source_width, x)))
        intersections.sort()
        for index in range(0, len(intersections) - 1, 2):
            x_start = intersections[index]
            x_end = intersections[index + 1]
            if x_end - x_start >= 0.05:
                segments.append(((x_start, y), (x_end, y)))
        y += source_step
    return segments


def build_embedded_vector_engrave_lines(item: dict[str, Any],
                                        travel_feed: float | None = None,
                                        operation: str = "engrave",
                                        clip_region: ClipRegion | None = None) -> list[str]:
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
    active_paths = [
        vector_path
        for vector_path in item.get("vectorPaths", [])
        if not vector_path.get("removed") and len(vector_path.get("points", [])) >= 2
    ]
    if not active_paths:
        raise ValueError("Vektorlestirilmis desende aktif cizgi kalmadi.")

    clean_name = str(item.get("name") or "vector").encode("ascii", errors="ignore").decode("ascii") or "vector"
    clean_name = clean_name.replace("(", "_").replace(")", "_")
    op_label = "cut" if operation == "cut" else "engrave"
    lines = [f"({op_label} vector {clean_name} R{fmt(pattern.rotation)})", "S0"]
    vector_stats = item.get("vectorStats") or {}
    vector_engrave_mode = str(item.get("vectorEngraveMode") or "contour").lower()
    fill_engrave = operation != "cut" and vector_engrave_mode == "fill" and vector_stats.get("traceEngine") == "potrace"
    if fill_engrave:
        source_step = max(0.05, pattern.line_step * source_height / max(0.001, pattern.height))
        segments = vector_fill_scan_segments(
            active_paths,
            source_width=source_width,
            source_height=source_height,
            source_step=source_step,
            fill_invert=bool(vector_stats.get("filledTraceInvert")),
        )
        if not segments:
            raise ValueError("Dolgulu vektor desen icin kazima satiri olusmadi.")
        reverse = False
        emitted = 0
        for start_source, end_source in segments:
            start_point = [end_source[0], end_source[1]] if reverse else [start_source[0], start_source[1]]
            end_point = [start_source[0], start_source[1]] if reverse else [end_source[0], end_source[1]]
            start = embedded_vector_point(pattern, start_point, source_width, source_height)
            end = embedded_vector_point(pattern, end_point, source_width, source_height)
            for clipped_start, clipped_end in clip_segment_to_region(start, end, clip_region):
                append_powered_polyline(
                    lines,
                    [clipped_start, clipped_end],
                    pattern.power,
                    pattern.feed,
                    travel_feed,
                )
                emitted += 1
            reverse = not reverse
        if emitted == 0 and clip_region is not None:
            lines.append(f"({op_label} vector fill clipped empty)")
            lines.append("S0")
            return lines
        lines.append(f"({op_label} vector fill end)")
        lines.append("S0")
        return lines

    emitted = 0
    for vector_path in active_paths:
        points = vector_path.get("points", [])
        transformed = [embedded_vector_point(pattern, point, source_width, source_height) for point in points]
        if vector_path.get("closed", True) and transformed and converter.dist(transformed[0], transformed[-1]) > 1e-6:
            transformed.append(transformed[0])
        for clipped in clip_polyline_to_region(transformed, clip_region):
            append_powered_polyline(lines, clipped, pattern.power, pattern.feed, travel_feed)
            emitted += 1
    if emitted == 0 and clip_region is not None:
        lines.append(f"({op_label} vector clipped empty)")
        lines.append("S0")
        return lines
    lines.append(f"({op_label} vector end)")
    lines.append("S0")
    return lines


def _float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(value)


def _int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(value))


def generate_from_state(state: dict[str, Any]) -> dict[str, Any]:
    settings = state.get("settings", {})
    output_path = Path(state.get("outputPath") or "")
    if not output_path:
        raise ValueError("Cikti yolu secilmedi.")

    tolerance = _float(settings.get("tolerance"), 0.25)
    join_tolerance = _float(settings.get("joinTolerance"), 0.05)
    inner_first = bool(settings.get("innerFirst", True))
    parts_by_id: dict[str, LoadedPart] = {}
    for part_data in state.get("parts", []):
        part_id = str(part_data["id"])
        parts_by_id[part_id] = load_part(
            Path(part_data["path"]),
            part_id,
            tolerance,
            join_tolerance,
            inner_first,
        )

    cut_paths: list[list[Point]] = []
    clip_polygons_by_placement: dict[str, list[list[Point]]] = {}
    all_clip_polygons: list[list[Point]] = []
    for placement in state.get("placements", []):
        part_id = str(placement["partId"])
        part = parts_by_id.get(part_id)
        if part is None:
            raise ValueError(f"Parca bulunamadi: {part_id}")
        transformed = transform_paths(part, placement)
        cut_paths.extend(transformed)
        placement_clip_polygons = closed_clip_polygons(transformed)
        clip_polygons_by_placement[str(placement.get("id") or "")] = placement_clip_polygons
        all_clip_polygons.extend(placement_clip_polygons)

    travel_feed = _float(settings.get("travelFeed"), 3000.0)
    feed = _float(settings.get("feed"), 500.0)
    power = _int(settings.get("power"), 1000)
    pattern_lines: list[str] = []
    for item in state.get("patterns", []):
        if not item.get("path"):
            continue
        kind = str(item.get("kind") or "").lower()
        operation = str(item.get("operation") or "engrave").lower()
        if kind not in {"svg", "vector"}:
            operation = "engrave"
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
        )
        parent_id = str(item.get("parentId") or "")
        clip_polygons = clip_polygons_by_placement.get(parent_id) or all_clip_polygons
        clip_margin = max(0.0, _float(item.get("clipMargin"), 0.0))
        clip_region = ClipRegion(clip_polygons, clip_margin) if clip_polygons else None
        if kind == "vector":
            vector_item = {**item, "power": item.get("power", default_pattern_power), "feed": item.get("feed", default_pattern_feed)}
            pattern_lines.extend(build_embedded_vector_engrave_lines(vector_item, travel_feed, operation, clip_region))
        elif kind == "svg" or pattern.path.suffix.lower() == ".svg":
            pattern_lines.extend(build_svg_vector_engrave_lines(pattern, travel_feed, operation, clip_region))
        else:
            pattern_lines.extend(build_raster_engrave_lines(pattern, travel_feed, clip_region))

    rapid_feed_value = settings.get("rapidFeed")
    rapid_feed = None if rapid_feed_value in (None, "") else _float(rapid_feed_value)
    pierce_delay = _float(settings.get("pierceDelay"), 0.0)
    overcut = _float(settings.get("overcut"), 0.8)
    passes = max(1, _int(settings.get("passes"), 1))
    laser_cmd = str(settings.get("laserCmd") or "M4").upper()

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
    )

    min_x, min_y, max_x, max_y = paths_bounds(cut_paths) if cut_paths else (0.0, 0.0, 0.0, 0.0)
    return {
        "outputPath": str(output_path),
        "cutPathCount": len(cut_paths),
        "patternCount": len(state.get("patterns", [])),
        "cutWidth": max_x - min_x,
        "cutHeight": max_y - min_y,
        "lineCount": len(output_path.read_text(encoding="utf-8").splitlines()),
    }
