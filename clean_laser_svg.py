#!/usr/bin/env python3
"""Clean SVG path data for laser/CAD import.

Some exporters place several independent subpaths in one SVG <path> by using
multiple M commands. That is valid SVG, but a few CAD/laser importers connect
those moves with unwanted diagonal lines. This tool splits those subpaths into
separate <path> elements and, by default, flattens simple transforms into the
path coordinates for better importer compatibility.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path
from dataclasses import dataclass
from typing import Iterable


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

TOKEN_RE = re.compile(
    r"[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
)
COMMAND_RE = re.compile(r"^[AaCcHhLlMmQqSsTtVvZz]$")
NUMBER_RE = re.compile(r"^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?$")
TRANSFORM_RE = re.compile(r"([A-Za-z]+)\s*\(([^)]*)\)")

IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
ARITY = {
    "M": 2,
    "L": 2,
    "H": 1,
    "V": 1,
    "C": 6,
    "S": 4,
    "Q": 4,
    "T": 2,
    "A": 7,
}


class SvgCleanError(RuntimeError):
    pass


@dataclass
class BBox:
    min_x: float
    min_y: float
    max_x: float
    max_y: float

    @property
    def width(self) -> float:
        return self.max_x - self.min_x

    @property
    def height(self) -> float:
        return self.max_y - self.min_y

    @property
    def area(self) -> float:
        return self.width * self.height


@dataclass
class PathBox:
    path: ET.Element
    bbox: BBox
    index: int
    parent: int | None = None


@dataclass
class PartGroup:
    paths: list[ET.Element]
    bbox: BBox
    sort_y: float
    sort_x: float


def is_command(token: str) -> bool:
    return bool(COMMAND_RE.match(token))


def is_number(token: str) -> bool:
    return bool(NUMBER_RE.match(token))


def fmt_num(value: float) -> str:
    if abs(value) < 1e-10:
        value = 0.0
    text = f"{value:.6f}".rstrip("0").rstrip(".")
    return text or "0"


def parse_numbers(text: str) -> list[float]:
    return [float(item) for item in re.findall(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?", text)]


def matrix_multiply(left: tuple[float, float, float, float, float, float],
                    right: tuple[float, float, float, float, float, float]
                    ) -> tuple[float, float, float, float, float, float]:
    a1, b1, c1, d1, e1, f1 = left
    a2, b2, c2, d2, e2, f2 = right
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def transform_point(matrix: tuple[float, float, float, float, float, float],
                    x: float,
                    y: float) -> tuple[float, float]:
    a, b, c, d, e, f = matrix
    return (a * x + c * y + e, b * x + d * y + f)


def transform_vector(matrix: tuple[float, float, float, float, float, float],
                     x: float,
                     y: float) -> tuple[float, float]:
    a, b, c, d, _, _ = matrix
    return (a * x + c * y, b * x + d * y)


def parse_transform(text: str | None) -> tuple[float, float, float, float, float, float]:
    matrix = IDENTITY
    if not text:
        return matrix

    for name, args_text in TRANSFORM_RE.findall(text):
        args = parse_numbers(args_text)
        name = name.lower()
        if name == "matrix" and len(args) == 6:
            local = tuple(args)  # type: ignore[assignment]
        elif name == "translate" and args:
            tx = args[0]
            ty = args[1] if len(args) > 1 else 0.0
            local = (1.0, 0.0, 0.0, 1.0, tx, ty)
        elif name == "scale" and args:
            sx = args[0]
            sy = args[1] if len(args) > 1 else sx
            local = (sx, 0.0, 0.0, sy, 0.0, 0.0)
        elif name == "rotate" and args:
            radians = math.radians(args[0])
            cos_v = math.cos(radians)
            sin_v = math.sin(radians)
            rot = (cos_v, sin_v, -sin_v, cos_v, 0.0, 0.0)
            if len(args) >= 3:
                cx, cy = args[1], args[2]
                local = matrix_multiply(
                    matrix_multiply((1.0, 0.0, 0.0, 1.0, cx, cy), rot),
                    (1.0, 0.0, 0.0, 1.0, -cx, -cy),
                )
            else:
                local = rot
        else:
            raise SvgCleanError(f"Unsupported transform: {name}({args_text})")
        matrix = matrix_multiply(matrix, local)
    return matrix


def split_path_data(path_data: str) -> list[str]:
    """Split a valid multi-subpath d string into independent path strings."""
    tokens = TOKEN_RE.findall(path_data)
    subpaths: list[list[str]] = []
    current: list[str] = []
    current_command: str | None = None
    has_draw = False
    move_number_count = 0

    for token in tokens:
        if is_command(token):
            if token in ("M", "m"):
                if current and has_draw:
                    subpaths.append(current)
                current = [token]
                current_command = token
                has_draw = False
                move_number_count = 0
            else:
                if not current:
                    current = []
                current.append(token)
                current_command = token
                has_draw = True
                if token in ("Z", "z"):
                    current_command = None
            continue

        if not is_number(token):
            continue
        current.append(token)
        if current_command in ("M", "m"):
            move_number_count += 1
            if move_number_count > 2:
                has_draw = True

    if current and has_draw:
        subpaths.append(current)
    return [" ".join(subpath) for subpath in subpaths]


def parent_map(root: ET.Element) -> dict[ET.Element, ET.Element]:
    return {child: parent for parent in root.iter() for child in list(parent)}


def split_svg_paths(root: ET.Element) -> dict[str, int]:
    parents = parent_map(root)
    original_path_count = 0
    new_path_count = 0
    split_count = 0
    removed_move_only = 0

    for path in list(root.iter(f"{{{SVG_NS}}}path")):
        path_data = path.get("d")
        if not path_data:
            continue

        original_path_count += 1
        before_moves = sum(1 for token in TOKEN_RE.findall(path_data) if token in ("M", "m"))
        subpaths = split_path_data(path_data)
        after_moves = sum(
            1
            for subpath in subpaths
            for token in TOKEN_RE.findall(subpath)
            if token in ("M", "m")
        )
        removed_move_only += max(0, before_moves - after_moves)

        parent = parents[path]
        index = list(parent).index(path)
        if not subpaths:
            parent.remove(path)
            continue
        if len(subpaths) == 1:
            path.set("d", subpaths[0])
            new_path_count += 1
            continue

        parent.remove(path)
        split_count += 1
        for offset, subpath in enumerate(subpaths):
            new_path = deepcopy(path)
            new_path.set("d", subpath)
            parent.insert(index + offset, new_path)
            new_path_count += 1

    return {
        "original_path_count": original_path_count,
        "new_path_count": new_path_count,
        "split_path_count": split_count,
        "removed_move_count": removed_move_only,
    }


def tag_name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1] if "}" in element.tag else element.tag


def float_attr(element: ET.Element, name: str, default: float = 0.0) -> float:
    value = element.get(name)
    if value is None:
        return default
    numbers = parse_numbers(value)
    return numbers[0] if numbers else default


def points_attr(element: ET.Element) -> list[tuple[float, float]]:
    numbers = parse_numbers(element.get("points", ""))
    return [(numbers[index], numbers[index + 1]) for index in range(0, len(numbers) - 1, 2)]


def cubic_ellipse_path(cx: float, cy: float, rx: float, ry: float) -> str | None:
    if rx <= 0 or ry <= 0:
        return None
    k = 0.5522847498307936
    return " ".join(
        [
            "M", fmt_num(cx + rx), fmt_num(cy),
            "C", fmt_num(cx + rx), fmt_num(cy + k * ry), fmt_num(cx + k * rx), fmt_num(cy + ry), fmt_num(cx), fmt_num(cy + ry),
            "C", fmt_num(cx - k * rx), fmt_num(cy + ry), fmt_num(cx - rx), fmt_num(cy + k * ry), fmt_num(cx - rx), fmt_num(cy),
            "C", fmt_num(cx - rx), fmt_num(cy - k * ry), fmt_num(cx - k * rx), fmt_num(cy - ry), fmt_num(cx), fmt_num(cy - ry),
            "C", fmt_num(cx + k * rx), fmt_num(cy - ry), fmt_num(cx + rx), fmt_num(cy - k * ry), fmt_num(cx + rx), fmt_num(cy),
            "Z",
        ]
    )


def rounded_rect_path(x: float, y: float, width: float, height: float, rx: float, ry: float) -> str | None:
    if width <= 0 or height <= 0:
        return None
    rx = min(max(rx, 0.0), width / 2.0)
    ry = min(max(ry, 0.0), height / 2.0)
    if rx <= 0 or ry <= 0:
        return " ".join(
            [
                "M", fmt_num(x), fmt_num(y),
                "L", fmt_num(x + width), fmt_num(y),
                "L", fmt_num(x + width), fmt_num(y + height),
                "L", fmt_num(x), fmt_num(y + height),
                "Z",
            ]
        )
    k = 0.5522847498307936
    return " ".join(
        [
            "M", fmt_num(x + rx), fmt_num(y),
            "L", fmt_num(x + width - rx), fmt_num(y),
            "C", fmt_num(x + width - rx + k * rx), fmt_num(y), fmt_num(x + width), fmt_num(y + ry - k * ry), fmt_num(x + width), fmt_num(y + ry),
            "L", fmt_num(x + width), fmt_num(y + height - ry),
            "C", fmt_num(x + width), fmt_num(y + height - ry + k * ry), fmt_num(x + width - rx + k * rx), fmt_num(y + height), fmt_num(x + width - rx), fmt_num(y + height),
            "L", fmt_num(x + rx), fmt_num(y + height),
            "C", fmt_num(x + rx - k * rx), fmt_num(y + height), fmt_num(x), fmt_num(y + height - ry + k * ry), fmt_num(x), fmt_num(y + height - ry),
            "L", fmt_num(x), fmt_num(y + ry),
            "C", fmt_num(x), fmt_num(y + ry - k * ry), fmt_num(x + rx - k * rx), fmt_num(y), fmt_num(x + rx), fmt_num(y),
            "Z",
        ]
    )


def shape_to_path_data(element: ET.Element) -> str | None:
    name = tag_name(element)
    if name == "line":
        x1 = float_attr(element, "x1")
        y1 = float_attr(element, "y1")
        x2 = float_attr(element, "x2")
        y2 = float_attr(element, "y2")
        if abs(x1 - x2) < 1e-12 and abs(y1 - y2) < 1e-12:
            return None
        return f"M {fmt_num(x1)} {fmt_num(y1)} L {fmt_num(x2)} {fmt_num(y2)}"
    if name == "polyline":
        points = points_attr(element)
        if len(points) < 2:
            return None
        commands = ["M", fmt_num(points[0][0]), fmt_num(points[0][1])]
        for x, y in points[1:]:
            commands.extend(["L", fmt_num(x), fmt_num(y)])
        return " ".join(commands)
    if name == "polygon":
        points = points_attr(element)
        if len(points) < 2:
            return None
        commands = ["M", fmt_num(points[0][0]), fmt_num(points[0][1])]
        for x, y in points[1:]:
            commands.extend(["L", fmt_num(x), fmt_num(y)])
        commands.append("Z")
        return " ".join(commands)
    if name == "rect":
        x = float_attr(element, "x")
        y = float_attr(element, "y")
        width = float_attr(element, "width")
        height = float_attr(element, "height")
        rx = float_attr(element, "rx", float_attr(element, "ry", 0.0))
        ry = float_attr(element, "ry", rx)
        return rounded_rect_path(x, y, width, height, rx, ry)
    if name == "circle":
        cx = float_attr(element, "cx")
        cy = float_attr(element, "cy")
        radius = float_attr(element, "r")
        return cubic_ellipse_path(cx, cy, radius, radius)
    if name == "ellipse":
        cx = float_attr(element, "cx")
        cy = float_attr(element, "cy")
        rx = float_attr(element, "rx")
        ry = float_attr(element, "ry")
        return cubic_ellipse_path(cx, cy, rx, ry)
    return None


def convert_shapes_to_paths(root: ET.Element) -> dict[str, int]:
    convertible = {"line", "polyline", "polygon", "rect", "circle", "ellipse"}
    parents = parent_map(root)
    converted = 0
    skipped = 0
    for element in list(root.iter()):
        if tag_name(element) not in convertible:
            continue
        parent = parents.get(element)
        if parent is None:
            skipped += 1
            continue
        path_data = shape_to_path_data(element)
        if not path_data:
            parent.remove(element)
            skipped += 1
            continue
        new_path = ET.Element(f"{{{SVG_NS}}}path")
        for key, value in element.attrib.items():
            if key not in {
                "x", "y", "x1", "y1", "x2", "y2", "width", "height", "rx", "ry",
                "cx", "cy", "r", "points",
            }:
                new_path.set(key, value)
        new_path.set("d", path_data)
        index = list(parent).index(element)
        parent.remove(element)
        parent.insert(index, new_path)
        converted += 1
    return {"converted_shape_count": converted, "skipped_shape_count": skipped}


def read_params(tokens: list[str], index: int, count: int) -> tuple[list[float], int]:
    if index + count > len(tokens):
        raise SvgCleanError("Path data ended unexpectedly")
    values = tokens[index:index + count]
    if any(is_command(value) for value in values):
        raise SvgCleanError("Path command is missing numeric parameters")
    return [float(value) for value in values], index + count


def is_pure_translation(matrix: tuple[float, float, float, float, float, float]) -> bool:
    a, b, c, d, _, _ = matrix
    return (
        abs(a - 1.0) < 1e-9
        and abs(b) < 1e-9
        and abs(c) < 1e-9
        and abs(d - 1.0) < 1e-9
    )


def point_tokens(matrix: tuple[float, float, float, float, float, float],
                 x: float,
                 y: float) -> list[str]:
    tx, ty = transform_point(matrix, x, y)
    return [fmt_num(tx), fmt_num(ty)]


def transformed_path_data(path_data: str,
                          matrix: tuple[float, float, float, float, float, float]
                          ) -> str:
    tokens = TOKEN_RE.findall(path_data)
    output: list[str] = []
    index = 0
    command: str | None = None
    current = (0.0, 0.0)
    subpath_start = (0.0, 0.0)

    while index < len(tokens):
        token = tokens[index]
        if is_command(token):
            command = token
            index += 1
        elif command is None:
            raise SvgCleanError("Path data starts with numbers before a command")

        if command is None:
            continue
        absolute_command = command.upper()
        relative = command.islower()

        if absolute_command == "Z":
            output.append("Z")
            current = subpath_start
            command = None
            continue

        if absolute_command not in ARITY:
            raise SvgCleanError(f"Unsupported path command: {command}")

        first_move_pair = True
        while index < len(tokens) and not is_command(tokens[index]):
            params, index = read_params(tokens, index, ARITY[absolute_command])

            if absolute_command == "M":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                command_to_write = "M" if first_move_pair else "L"
                output.extend([command_to_write, *point_tokens(matrix, x, y)])
                current = (x, y)
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
                output.extend(["L", *point_tokens(matrix, x, y)])
                current = (x, y)
            elif absolute_command == "H":
                x = params[0] + current[0] if relative else params[0]
                y = current[1]
                output.extend(["L", *point_tokens(matrix, x, y)])
                current = (x, y)
            elif absolute_command == "V":
                x = current[0]
                y = params[0] + current[1] if relative else params[0]
                output.extend(["L", *point_tokens(matrix, x, y)])
                current = (x, y)
            elif absolute_command == "C":
                points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    points.extend(point_tokens(matrix, x, y))
                output.extend(["C", *points])
                end_x = params[4] + current[0] if relative else params[4]
                end_y = params[5] + current[1] if relative else params[5]
                current = (end_x, end_y)
            elif absolute_command == "S":
                points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    points.extend(point_tokens(matrix, x, y))
                output.extend(["S", *points])
                end_x = params[2] + current[0] if relative else params[2]
                end_y = params[3] + current[1] if relative else params[3]
                current = (end_x, end_y)
            elif absolute_command == "Q":
                points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    points.extend(point_tokens(matrix, x, y))
                output.extend(["Q", *points])
                end_x = params[2] + current[0] if relative else params[2]
                end_y = params[3] + current[1] if relative else params[3]
                current = (end_x, end_y)
            elif absolute_command == "T":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                output.extend(["T", *point_tokens(matrix, x, y)])
                current = (x, y)
            elif absolute_command == "A":
                if not is_pure_translation(matrix):
                    raise SvgCleanError("Arc paths can only be flattened with pure translation transforms")
                rx, ry, axis_rotation, large_arc, sweep, x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                end_x, end_y = transform_point(matrix, x, y)
                output.extend(
                    [
                        "A",
                        fmt_num(rx),
                        fmt_num(ry),
                        fmt_num(axis_rotation),
                        fmt_num(large_arc),
                        fmt_num(sweep),
                        fmt_num(end_x),
                        fmt_num(end_y),
                    ]
                )
                current = (x, y)

    return " ".join(output)


def translate_path_data(path_data: str, dx: float, dy: float) -> str:
    return transformed_path_data(path_data, (1.0, 0.0, 0.0, 1.0, dx, dy))


def cubic_point(p0: tuple[float, float],
                p1: tuple[float, float],
                p2: tuple[float, float],
                p3: tuple[float, float],
                t: float) -> tuple[float, float]:
    u = 1.0 - t
    return (
        u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
    )


def quadratic_point(p0: tuple[float, float],
                    p1: tuple[float, float],
                    p2: tuple[float, float],
                    t: float) -> tuple[float, float]:
    u = 1.0 - t
    return (
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    )


def path_bbox(path_data: str) -> BBox:
    tokens = TOKEN_RE.findall(path_data)
    points: list[tuple[float, float]] = []
    index = 0
    command: str | None = None
    current = (0.0, 0.0)
    subpath_start = (0.0, 0.0)

    while index < len(tokens):
        token = tokens[index]
        if is_command(token):
            command = token
            index += 1
        elif command is None:
            raise SvgCleanError("Path data starts with numbers before a command")

        if command is None:
            continue
        absolute_command = command.upper()
        relative = command.islower()

        if absolute_command == "Z":
            points.append(subpath_start)
            current = subpath_start
            command = None
            continue

        if absolute_command not in ARITY:
            raise SvgCleanError(f"Unsupported path command: {command}")

        first_move_pair = True
        while index < len(tokens) and not is_command(tokens[index]):
            params, index = read_params(tokens, index, ARITY[absolute_command])

            if absolute_command == "M":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                points.append(current)
                if first_move_pair:
                    subpath_start = current
                first_move_pair = False
                command = "l" if relative else "L"
                absolute_command = "L"
            elif absolute_command == "L":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                points.append(current)
            elif absolute_command == "H":
                x = params[0] + current[0] if relative else params[0]
                current = (x, current[1])
                points.append(current)
            elif absolute_command == "V":
                y = params[0] + current[1] if relative else params[0]
                current = (current[0], y)
                points.append(current)
            elif absolute_command == "C":
                curve_points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1, p2, p3 = curve_points
                points.extend(cubic_point(current, p1, p2, p3, step / 24.0) for step in range(1, 25))
                current = p3
            elif absolute_command == "S":
                curve_points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1, p2 = curve_points
                points.extend(quadratic_point(current, p1, p2, step / 24.0) for step in range(1, 25))
                current = p2
            elif absolute_command == "Q":
                curve_points = []
                for x, y in zip(params[0::2], params[1::2]):
                    if relative:
                        x += current[0]
                        y += current[1]
                    curve_points.append((x, y))
                p1, p2 = curve_points
                points.extend(quadratic_point(current, p1, p2, step / 24.0) for step in range(1, 25))
                current = p2
            elif absolute_command == "T":
                x, y = params
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                points.append(current)
            elif absolute_command == "A":
                # This endpoint-only approximation is enough for grouping; most
                # laser-box exports use cubic curves for circles after flattening.
                x, y = params[5], params[6]
                if relative:
                    x += current[0]
                    y += current[1]
                current = (x, y)
                points.append(current)

    if not points:
        raise SvgCleanError("Cannot calculate bounding box for empty path")

    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return BBox(min(xs), min(ys), max(xs), max(ys))


def union_bbox(boxes: Iterable[BBox]) -> BBox:
    boxes = list(boxes)
    if not boxes:
        raise SvgCleanError("Cannot union an empty bounding-box list")
    return BBox(
        min(box.min_x for box in boxes),
        min(box.min_y for box in boxes),
        max(box.max_x for box in boxes),
        max(box.max_y for box in boxes),
    )


def contains_bbox(outer: BBox, inner: BBox, eps: float = 1e-6) -> bool:
    if outer.area <= inner.area + eps:
        return False
    return (
        outer.min_x <= inner.min_x + eps
        and outer.min_y <= inner.min_y + eps
        and outer.max_x >= inner.max_x - eps
        and outer.max_y >= inner.max_y - eps
    )


def group_paths_by_containment(root: ET.Element) -> list[PartGroup]:
    paths = list(root.findall(f".//{{{SVG_NS}}}path"))
    path_boxes = [
        PathBox(path=path, bbox=path_bbox(path.get("d", "")), index=index)
        for index, path in enumerate(paths)
    ]

    for item in path_boxes:
        containers = [
            possible_parent
            for possible_parent in path_boxes
            if possible_parent is not item and contains_bbox(possible_parent.bbox, item.bbox)
        ]
        if containers:
            item.parent = min(containers, key=lambda candidate: candidate.bbox.area).index

    by_index = {item.index: item for item in path_boxes}

    def root_index(item: PathBox) -> int:
        while item.parent is not None:
            item = by_index[item.parent]
        return item.index

    grouped: dict[int, list[PathBox]] = {}
    for item in path_boxes:
        grouped.setdefault(root_index(item), []).append(item)

    groups = []
    for members in grouped.values():
        bbox = union_bbox(member.bbox for member in members)
        groups.append(
            PartGroup(
                paths=[member.path for member in members],
                bbox=bbox,
                sort_y=bbox.min_y,
                sort_x=bbox.min_x,
            )
        )
    return sorted(groups, key=lambda group: (group.sort_y, group.sort_x))


def pack_svg_to_width(root: ET.Element,
                      bed_width: float,
                      gap: float,
                      margin: float) -> dict[str, float | int]:
    groups = group_paths_by_containment(root)
    if not groups:
        return {"part_count": 0, "packed_width": 0.0, "packed_height": 0.0}

    usable_width = bed_width - (margin * 2.0)
    if usable_width <= 0:
        raise SvgCleanError("Bed width must be larger than twice the margin")
    too_wide = [group for group in groups if group.bbox.width > usable_width + 1e-6]
    if too_wide:
        widest = max(too_wide, key=lambda group: group.bbox.width)
        raise SvgCleanError(
            f"A part is {fmt_num(widest.bbox.width)} mm wide, larger than usable bed width "
            f"{fmt_num(usable_width)} mm"
        )

    cursor_x = margin
    cursor_y = margin
    shelf_height = 0.0
    max_x = margin

    for group in groups:
        width = group.bbox.width
        height = group.bbox.height
        if cursor_x > margin and cursor_x + width > bed_width - margin + 1e-6:
            cursor_x = margin
            cursor_y += shelf_height + gap
            shelf_height = 0.0

        dx = cursor_x - group.bbox.min_x
        dy = cursor_y - group.bbox.min_y
        for path in group.paths:
            path.set("d", translate_path_data(path.get("d", ""), dx, dy))

        max_x = max(max_x, cursor_x + width)
        cursor_x += width + gap
        shelf_height = max(shelf_height, height)

    packed_width = max_x + margin
    packed_height = cursor_y + shelf_height + margin
    root.set("viewBox", f"0 0 {fmt_num(packed_width)} {fmt_num(packed_height)}")
    root.set("width", f"{fmt_num(packed_width)}mm")
    root.set("height", f"{fmt_num(packed_height)}mm")
    return {
        "part_count": len(groups),
        "packed_width": packed_width,
        "packed_height": packed_height,
    }


def reorder_paths_inner_first(root: ET.Element) -> dict[str, int]:
    groups = group_paths_by_containment(root)
    paths = list(root.findall(f".//{{{SVG_NS}}}path"))
    if not paths:
        return {"ordered_path_count": 0, "ordered_part_count": 0}

    parents = parent_map(root)
    path_parents = {parents[path] for path in paths}
    if len(path_parents) != 1:
        raise SvgCleanError("Inner-first cut ordering needs a flat SVG")
    parent = next(iter(path_parents))

    ordered_paths: list[ET.Element] = []
    for group in groups:
        path_boxes = [(path, path_bbox(path.get("d", ""))) for path in group.paths]
        ordered_paths.extend(
            path
            for path, _ in sorted(
                path_boxes,
                key=lambda item: (
                    item[1].area,
                    item[1].min_y,
                    item[1].min_x,
                ),
            )
        )

    non_path_children = [child for child in list(parent) if child.tag != f"{{{SVG_NS}}}path"]
    for child in list(parent):
        parent.remove(child)
    for child in non_path_children:
        parent.append(child)
    for path in ordered_paths:
        parent.append(path)

    return {
        "ordered_path_count": len(ordered_paths),
        "ordered_part_count": len(groups),
    }


def iter_paths_with_matrix(root: ET.Element,
                           matrix: tuple[float, float, float, float, float, float]
                           ) -> Iterable[tuple[ET.Element, tuple[float, float, float, float, float, float]]]:
    matrix = matrix_multiply(matrix, parse_transform(root.get("transform")))
    if root.tag == f"{{{SVG_NS}}}path":
        yield root, matrix
    for child in list(root):
        yield from iter_paths_with_matrix(child, matrix)


def flattened_svg(root: ET.Element) -> ET.Element:
    new_root = ET.Element(
        f"{{{SVG_NS}}}svg",
        {
            key: value
            for key, value in {
                "width": root.get("width"),
                "height": root.get("height"),
                "viewBox": root.get("viewBox"),
            }.items()
            if value is not None
        },
    )
    group = ET.SubElement(
        new_root,
        f"{{{SVG_NS}}}g",
        {"id": "cut-lines", "vector-effect": "non-scaling-stroke"},
    )

    copy_attrs = (
        "style",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-miterlimit",
        "stroke-dasharray",
        "fill",
        "fill-opacity",
        "fill-rule",
        "opacity",
    )

    for path, matrix in iter_paths_with_matrix(root, IDENTITY):
        path_data = path.get("d")
        if not path_data:
            continue
        new_path = ET.SubElement(group, f"{{{SVG_NS}}}path")
        for attr in copy_attrs:
            value = path.get(attr)
            if value is not None:
                new_path.set(attr, value)
        new_path.set("d", transformed_path_data(path_data, matrix))
    return new_root


def default_output_path(input_path: Path, flat: bool, bed_width: float | None) -> Path:
    if bed_width is not None:
        suffix = f"-clean-flat-{fmt_num(bed_width)}mm"
    else:
        suffix = "-clean-flat" if flat else "-clean"
    return input_path.with_name(f"{input_path.stem}{suffix}{input_path.suffix}")


def clean_file(input_path: Path,
               output_path: Path | None,
               flat: bool,
               bed_width: float | None,
               gap: float,
               margin: float,
               inner_first: bool) -> dict[str, int | float | Path]:
    root = ET.parse(input_path).getroot()
    stats = convert_shapes_to_paths(root)
    stats.update(split_svg_paths(root))
    final_root = flattened_svg(root) if flat or bed_width is not None else root
    if bed_width is not None:
        stats.update(pack_svg_to_width(final_root, bed_width, gap, margin))
    if inner_first:
        stats.update(reorder_paths_inner_first(final_root))
    final_output = output_path or default_output_path(input_path, flat or bed_width is not None, bed_width)
    ET.ElementTree(final_root).write(final_output, encoding="utf-8", xml_declaration=False)
    stats["output_path"] = final_output
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fix unwanted diagonal laser/CAD import lines in SVG files."
    )
    parser.add_argument("input", type=Path, help="Input SVG file")
    parser.add_argument("-o", "--output", type=Path, help="Output SVG file")
    parser.add_argument(
        "--keep-transforms",
        action="store_true",
        help="Only split path subpaths; do not flatten transforms",
    )
    parser.add_argument(
        "--bed-width",
        type=float,
        help="Pack detected parts into rows that fit this bed width in millimeters",
    )
    parser.add_argument(
        "--gap",
        type=float,
        default=3.0,
        help="Gap between packed parts in millimeters; used with --bed-width",
    )
    parser.add_argument(
        "--margin",
        type=float,
        default=0.0,
        help="Outer margin in millimeters; used with --bed-width",
    )
    parser.add_argument(
        "--no-inner-first",
        action="store_true",
        help="Keep original cut order instead of writing inside cuts before outside contours",
    )
    args = parser.parse_args()

    try:
        stats = clean_file(
            args.input,
            args.output,
            flat=not args.keep_transforms,
            bed_width=args.bed_width,
            gap=args.gap,
            margin=args.margin,
            inner_first=(not args.keep_transforms and not args.no_inner_first),
        )
    except (ET.ParseError, OSError, SvgCleanError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Output: {stats['output_path']}")
    print(f"Original path elements: {stats['original_path_count']}")
    print(f"Clean path elements: {stats['new_path_count']}")
    print(f"Paths split: {stats['split_path_count']}")
    print(f"Redundant move commands removed: {stats['removed_move_count']}")
    if args.bed_width is not None:
        print(f"Packed parts: {stats['part_count']}")
        print(f"Packed size: {fmt_num(float(stats['packed_width']))} x {fmt_num(float(stats['packed_height']))} mm")
    if not args.keep_transforms and not args.no_inner_first:
        print(f"Inner-first ordered parts: {stats['ordered_part_count']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
