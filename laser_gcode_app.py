#!/usr/bin/env python3
"""Desktop DXF to laser G-code application."""

from __future__ import annotations

import math
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

import dxf_to_laser_gcode as converter

try:
    from PIL import Image, ImageOps, ImageTk
except ImportError:  # pragma: no cover - GUI will report this if engraving is used.
    Image = None
    ImageOps = None
    ImageTk = None


Point = tuple[float, float]
MAX_RASTER_CELLS = 260_000


@dataclass
class Placement:
    x: float
    y: float
    rotation: int
    row: int
    column: int
    part_index: int = 0


@dataclass
class Layout:
    placements: list[Placement]
    used_width: float
    used_height: float
    rotation: int
    columns: int
    rows: int
    score: float


@dataclass
class LoadedPart:
    path: Path
    name: str
    paths: list[list[Point]]
    width: float
    height: float
    unsupported: dict[str, int]


@dataclass
class PatternSettings:
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


def all_points(paths: list[list[Point]]) -> list[Point]:
    return [point for path in paths for point in path]


def paths_bounds(paths: list[list[Point]]) -> tuple[float, float, float, float]:
    points = all_points(paths)
    min_x = min(point[0] for point in points)
    min_y = min(point[1] for point in points)
    max_x = max(point[0] for point in points)
    max_y = max(point[1] for point in points)
    return min_x, min_y, max_x, max_y


def normalize_paths(paths: list[list[Point]]) -> tuple[list[list[Point]], float, float]:
    min_x, min_y, max_x, max_y = paths_bounds(paths)
    normalized = [[(point[0] - min_x, point[1] - min_y) for point in path] for path in paths]
    return normalized, max_x - min_x, max_y - min_y


def open_pattern_image(path: Path):
    if Image is None or ImageOps is None:
        raise ValueError("PNG/JPG desen icin Pillow kutuphanesi bulunamadi.")
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        if image.mode in ("RGBA", "LA") or "transparency" in image.info:
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            return background.convert("L")
        return image.convert("L")


def pattern_point(settings: PatternSettings, local_x: float, local_y: float) -> Point:
    center_x = settings.x + settings.width / 2
    center_y = settings.y + settings.height / 2
    dx = local_x - settings.width / 2
    dy = local_y - settings.height / 2
    angle = math.radians(settings.rotation)
    cos_a = math.cos(angle)
    sin_a = math.sin(angle)
    return center_x + dx * cos_a - dy * sin_a, center_y + dx * sin_a + dy * cos_a


def pattern_corners(settings: PatternSettings) -> list[Point]:
    return [
        pattern_point(settings, 0, 0),
        pattern_point(settings, settings.width, 0),
        pattern_point(settings, settings.width, settings.height),
        pattern_point(settings, 0, settings.height),
    ]


def point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    x, y = point
    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        if ((current_y > y) != (previous_y > y)) and (
            x < (previous_x - current_x) * (y - current_y) / (previous_y - current_y + 1e-12) + current_x
        ):
            inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def build_raster_engrave_lines(settings: PatternSettings, travel_feed: float | None = None) -> list[str]:
    if not settings.path.exists():
        raise ValueError(f"Desen dosyasi bulunamadi: {settings.path}")
    if settings.width <= 0 or settings.height <= 0:
        raise ValueError("Desen genislik/yukseklik 0'dan buyuk olmali.")
    if settings.feed <= 0:
        raise ValueError("Desen hizi 0'dan buyuk olmali.")
    if settings.line_step <= 0:
        raise ValueError("Desen satir araligi 0'dan buyuk olmali.")
    if settings.threshold < 0 or settings.threshold > 255:
        raise ValueError("Desen esigi 0 ile 255 arasinda olmali.")
    converter.validate_power(settings.power)

    columns = max(2, int(math.ceil(settings.width / settings.line_step)))
    rows = max(2, int(math.ceil(settings.height / settings.line_step)))
    if columns * rows > MAX_RASTER_CELLS:
        raise ValueError(
            "Desen cok detayli. Boyutu kucultun veya satir araligini buyutun "
            f"(su an {columns * rows} piksel, sinir {MAX_RASTER_CELLS})."
        )

    image = open_pattern_image(settings.path)
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    image = image.resize((columns, rows), resample)
    pixels = image.load()
    col_width = settings.width / columns
    row_height = settings.height / rows
    clean_name = settings.path.name.encode("ascii", errors="ignore").decode("ascii") or "image"
    clean_name = clean_name.replace("(", "_").replace(")", "_")
    lines = [f"(engrave image {clean_name} R{converter.fmt(settings.rotation)})", "S0"]

    for row in range(rows):
        local_y = (row + 0.5) * row_height
        column = 0
        while column < columns:
            while column < columns and pixels[column, row] >= settings.threshold:
                column += 1
            if column >= columns:
                break
            start = column
            while column < columns and pixels[column, row] < settings.threshold:
                column += 1
            end = column - 1

            start_point = pattern_point(settings, start * col_width, local_y)
            end_point = pattern_point(settings, (end + 1) * col_width, local_y)
            if travel_feed is not None and travel_feed > 0:
                lines.append(
                    f"G1 X{converter.fmt(start_point[0])} Y{converter.fmt(start_point[1])} "
                    f"F{converter.fmt(travel_feed)}"
                )
            else:
                lines.append(f"G0 X{converter.fmt(start_point[0])} Y{converter.fmt(start_point[1])}")
            lines.append(f"S{settings.power}")
            lines.append(
                f"G1 X{converter.fmt(end_point[0])} Y{converter.fmt(end_point[1])} "
                f"F{converter.fmt(settings.feed)}"
            )
            lines.append("S0")

    lines.append("(engrave image end)")
    lines.append("S0")
    return lines


def transform_path(path: list[Point],
                   part_width: float,
                   part_height: float,
                   placement: Placement) -> list[Point]:
    if placement.rotation == 90:
        return [(placement.x + y, placement.y + part_width - x) for x, y in path]
    return [(placement.x + x, placement.y + y) for x, y in path]


def transform_paths(paths: list[list[Point]],
                    part_width: float,
                    part_height: float,
                    placement: Placement) -> list[list[Point]]:
    return [transform_path(path, part_width, part_height, placement) for path in paths]


def build_layout(quantity: int,
                 part_width: float,
                 part_height: float,
                 bed_width: float,
                 bed_height: float,
                 gap: float,
                 margin: float,
                 allow_rotate: bool) -> Layout:
    if quantity < 1:
        raise ValueError("Adet en az 1 olmalı.")
    usable_width = bed_width - 2 * margin
    usable_height = bed_height - 2 * margin
    if usable_width <= 0 or usable_height <= 0:
        raise ValueError("Tabla ölçüsü, kenar payından büyük olmalı.")

    layout = find_best_layout(quantity, part_width, part_height, bed_width, bed_height, gap, margin, allow_rotate)
    if layout is None:
        max_count = max_fit_count(part_width, part_height, bed_width, bed_height, gap, margin, allow_rotate)
        raise ValueError(f"Bu adet tabla içine sığmıyor. Bu ayarlarla en fazla {max_count} adet sığar.")
    return layout


def find_best_layout(quantity: int,
                     part_width: float,
                     part_height: float,
                     bed_width: float,
                     bed_height: float,
                     gap: float,
                     margin: float,
                     allow_rotate: bool) -> Layout | None:
    usable_width = bed_width - 2 * margin
    usable_height = bed_height - 2 * margin
    candidates: list[Layout] = []

    def dimensions(rotation: int) -> tuple[float, float]:
        return (part_height, part_width) if rotation == 90 else (part_width, part_height)

    def row_options(count: int, rotation: int) -> list[list[tuple[int, int]]]:
        if count == 0:
            return [[]]
        item_width = part_height if rotation == 90 else part_width
        item_height = part_width if rotation == 90 else part_height
        if item_width > usable_width + 1e-9 or item_height > usable_height + 1e-9:
            return []

        max_columns = int((usable_width + gap) // (item_width + gap))
        if max_columns < 1:
            return []

        options: list[list[tuple[int, int]]] = []
        for columns in range(1, max_columns + 1):
            rows = math.ceil(count / columns)
            used_height = rows * item_height + max(0, rows - 1) * gap
            if used_height > usable_height + 1e-9:
                continue
            counts = [columns] * rows
            counts[-1] = count - columns * (rows - 1)
            options.append([(rotation, row_count) for row_count in counts])
        return options

    split_counts = [(quantity, 0)]
    if allow_rotate:
        split_counts = [(normal_count, quantity - normal_count) for normal_count in range(quantity + 1)]

    for normal_count, rotated_count in split_counts:
        normal_options = row_options(normal_count, 0)
        rotated_options = row_options(rotated_count, 90) if allow_rotate else [[]]
        if not normal_options or not rotated_options:
            continue
        for normal_rows in normal_options:
            for rotated_rows in rotated_options:
                row_specs = [*normal_rows, *rotated_rows]
                if not row_specs:
                    continue
                row_specs.sort(key=lambda spec: dimensions(spec[0])[1], reverse=True)

                row_widths = []
                total_height = 0.0
                for row_index, (rotation, row_count) in enumerate(row_specs):
                    item_width, item_height = dimensions(rotation)
                    row_widths.append(row_count * item_width + max(0, row_count - 1) * gap)
                    total_height += item_height
                    if row_index:
                        total_height += gap

                used_width = max(row_widths)
                used_height = total_height
                if used_width > usable_width + 1e-9 or used_height > usable_height + 1e-9:
                    continue

                placements = []
                y = margin
                max_columns = 0
                for row_index, (rotation, row_count) in enumerate(row_specs):
                    item_width, item_height = dimensions(rotation)
                    max_columns = max(max_columns, row_count)
                    for column in range(row_count):
                        placements.append(
                            Placement(
                                x=margin + column * (item_width + gap),
                                y=y,
                                rotation=rotation,
                                row=row_index,
                                column=column,
                            )
                        )
                    y += item_height + gap

                rotations_used = {placement.rotation for placement in placements}
                rotation_label = -1 if len(rotations_used) > 1 else next(iter(rotations_used))
                waste = used_width * used_height - quantity * part_width * part_height
                score = waste + used_height * 0.01 + used_width * 0.001
                candidates.append(
                    Layout(
                        placements=placements,
                        used_width=used_width,
                        used_height=used_height,
                        rotation=rotation_label,
                        columns=max_columns,
                        rows=len(row_specs),
                        score=score,
                    )
                )

    if not candidates:
        return None

    return min(candidates, key=lambda candidate: candidate.score)


def _uniform_max_fit(part_width: float,
                     part_height: float,
                     bed_width: float,
                     bed_height: float,
                     gap: float,
                     margin: float,
                     allow_rotate: bool) -> int:
    usable_width = bed_width - 2 * margin
    usable_height = bed_height - 2 * margin
    best = 0
    rotations = [0, 90] if allow_rotate else [0]
    for rotation in rotations:
        item_width = part_height if rotation == 90 else part_width
        item_height = part_width if rotation == 90 else part_height
        if item_width <= 0 or item_height <= 0:
            continue
        columns = int((usable_width + gap) // (item_width + gap))
        rows = int((usable_height + gap) // (item_height + gap))
        best = max(best, max(0, columns) * max(0, rows))
    return best


def max_fit_count(part_width: float,
                  part_height: float,
                  bed_width: float,
                  bed_height: float,
                  gap: float,
                  margin: float,
                  allow_rotate: bool) -> int:
    usable_width = bed_width - 2 * margin
    usable_height = bed_height - 2 * margin
    if usable_width <= 0 or usable_height <= 0 or part_width <= 0 or part_height <= 0:
        return 0

    area_upper = int((usable_width * usable_height) // (part_width * part_height)) + 1
    best = _uniform_max_fit(part_width, part_height, bed_width, bed_height, gap, margin, allow_rotate)
    for count in range(best + 1, area_upper + 1):
        if find_best_layout(count, part_width, part_height, bed_width, bed_height, gap, margin, allow_rotate) is None:
            break
        best = count
    return best


def make_cut_paths(source_paths: list[list[Point]],
                   layout: Layout,
                   part_width: float,
                   part_height: float) -> list[list[Point]]:
    output: list[list[Point]] = []
    for placement in layout.placements:
        output.extend(transform_paths(source_paths, part_width, part_height, placement))
    return output


def build_mixed_layout(parts: list[LoadedPart],
                       set_count: int,
                       bed_width: float,
                       bed_height: float,
                       gap: float,
                       margin: float,
                       allow_rotate: bool) -> Layout:
    if set_count < 1:
        raise ValueError("Adet en az 1 olmalı.")
    usable_width = bed_width - 2 * margin
    usable_height = bed_height - 2 * margin
    if usable_width <= 0 or usable_height <= 0:
        raise ValueError("Tabla ölçüsü, kenar payından büyük olmalı.")

    items: list[tuple[int, float, float]] = []
    for _set_index in range(set_count):
        for part_index, part in enumerate(parts):
            items.append((part_index, part.width, part.height))

    items.sort(key=lambda item: (max(item[1], item[2]), item[1] * item[2]), reverse=True)
    shelves: list[dict[str, float | int]] = []
    placements: list[Placement] = []

    def rotations(width: float, height: float) -> list[tuple[int, float, float]]:
        options = [(0, width, height)]
        if allow_rotate and abs(width - height) > 1e-9:
            options.append((90, height, width))
        return options

    for part_index, width, height in items:
        best: tuple[tuple[float, float, float, int], int | None, int, float, float, float, float] | None = None

        for shelf_index, shelf in enumerate(shelves):
            shelf_x = float(shelf["x"])
            shelf_y = float(shelf["y"])
            shelf_height = float(shelf["height"])
            for rotation, item_width, item_height in rotations(width, height):
                if item_height > shelf_height + 1e-9:
                    continue
                if shelf_x + item_width > margin + usable_width + 1e-9:
                    continue
                score = (shelf_y + shelf_height, shelf_y, shelf_x, shelf_index)
                candidate = (score, shelf_index, rotation, shelf_x, shelf_y, item_width, item_height)
                if best is None or candidate[0] < best[0]:
                    best = candidate

        next_y = margin
        if shelves:
            next_y = max(float(shelf["y"]) + float(shelf["height"]) for shelf in shelves) + gap
        for rotation, item_width, item_height in rotations(width, height):
            if item_width > usable_width + 1e-9 or item_height > usable_height + 1e-9:
                continue
            if next_y + item_height > margin + usable_height + 1e-9:
                continue
            score = (next_y + item_height, next_y, margin, len(shelves))
            candidate = (score, None, rotation, margin, next_y, item_width, item_height)
            if best is None or candidate[0] < best[0]:
                best = candidate

        if best is None:
            raise ValueError("Seçilen parçalar bu tabla ölçüsüne sığmıyor.")

        _score, shelf_index, rotation, x, y, item_width, item_height = best
        if shelf_index is None:
            shelf_index = len(shelves)
            shelves.append({"x": x + item_width + gap, "y": y, "height": item_height, "count": 1})
            column = 0
        else:
            shelf = shelves[shelf_index]
            column = int(shelf["count"])
            shelf["x"] = float(shelf["x"]) + item_width + gap
            shelf["count"] = int(shelf["count"]) + 1

        placements.append(
            Placement(
                x=x,
                y=y,
                rotation=rotation,
                row=shelf_index,
                column=column,
                part_index=part_index,
            )
        )

    used_width = max((placement.x + ((parts[placement.part_index].height if placement.rotation == 90 else parts[placement.part_index].width)) - margin for placement in placements), default=0.0)
    used_height = max((placement.y + ((parts[placement.part_index].width if placement.rotation == 90 else parts[placement.part_index].height)) - margin for placement in placements), default=0.0)
    rotation_values = {placement.rotation for placement in placements}
    rotation_label = -1 if len(rotation_values) > 1 else (next(iter(rotation_values)) if rotation_values else 0)
    return Layout(
        placements=placements,
        used_width=used_width,
        used_height=used_height,
        rotation=rotation_label,
        columns=max((int(shelf["count"]) for shelf in shelves), default=0),
        rows=len(shelves),
        score=used_width * used_height,
    )


def make_mixed_cut_paths(parts: list[LoadedPart], layout: Layout) -> list[list[Point]]:
    output: list[list[Point]] = []
    for placement in layout.placements:
        part = parts[placement.part_index]
        output.extend(transform_paths(part.paths, part.width, part.height, placement))
    return output


class LaserGcodeApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("DXF -> Lazer G-code")
        self.geometry("1280x840")
        self.minsize(1080, 680)

        self.dxf_path = tk.StringVar()
        self.output_path = tk.StringVar()
        self.bed_width = tk.StringVar(value="400")
        self.bed_height = tk.StringVar(value="400")
        self.quantity = tk.StringVar(value="1")
        self.gap = tk.StringVar(value="3")
        self.margin = tk.StringVar(value="0")
        self.allow_rotate = tk.BooleanVar(value=True)
        self.inner_first = tk.BooleanVar(value=True)
        self.feed = tk.StringVar(value="500")
        self.power = tk.StringVar(value="1000")
        self.rapid_feed = tk.StringVar(value="")
        self.laser_cmd = tk.StringVar(value="M4")
        self.tolerance = tk.StringVar(value="0.25")
        self.join_tolerance = tk.StringVar(value="0.05")
        self.pierce_delay = tk.StringVar(value="0")
        self.overcut = tk.StringVar(value="0.8")
        self.travel_feed = tk.StringVar(value="3000")
        self.passes = tk.StringVar(value="1")
        self.return_to_origin = tk.BooleanVar(value=False)
        self.pattern_enabled = tk.BooleanVar(value=False)
        self.pattern_path = tk.StringVar()
        self.pattern_x = tk.StringVar(value="10")
        self.pattern_y = tk.StringVar(value="10")
        self.pattern_width = tk.StringVar(value="60")
        self.pattern_height = tk.StringVar(value="30")
        self.pattern_rotation = tk.StringVar(value="0")
        self.pattern_power = tk.StringVar(value="250")
        self.pattern_feed = tk.StringVar(value="1800")
        self.pattern_step = tk.StringVar(value="0.35")
        self.pattern_threshold = tk.StringVar(value="140")
        self.status_text = tk.StringVar(value="DXF dosyası seçin.")

        self.dxf_paths: list[Path] = []
        self.parts: list[LoadedPart] = []
        self.parts_listbox: tk.Listbox | None = None
        self.source_paths: list[list[Point]] | None = None
        self.normalized_paths: list[list[Point]] | None = None
        self.part_width = 0.0
        self.part_height = 0.0
        self.current_layout: Layout | None = None
        self.current_cut_paths: list[list[Point]] | None = None
        self.unsupported: dict[str, int] = {}
        self._preview_job: str | None = None
        self.pattern_preview_image = None
        self.preview_scale = 1.0
        self.preview_offset_x = 0.0
        self.preview_offset_y = 0.0
        self._pattern_drag: tuple[float, float, float, float] | None = None

        self._configure_style()
        self._build_ui()
        self._install_auto_preview()

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Title.TLabel", font=("Segoe UI", 14, "bold"))
        style.configure("Section.TLabelframe.Label", font=("Segoe UI", 10, "bold"))
        style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"))
        style.configure("Status.TLabel", foreground="#1f2937")

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=12)
        root.pack(fill=tk.BOTH, expand=True)
        root.columnconfigure(0, weight=0)
        root.columnconfigure(1, weight=1)
        root.rowconfigure(0, weight=1)

        left_outer = ttk.Frame(root, width=400)
        left_outer.grid(row=0, column=0, sticky="nsw", padx=(0, 12))
        left_outer.grid_propagate(False)
        left_canvas = tk.Canvas(left_outer, highlightthickness=0)
        left_scrollbar = ttk.Scrollbar(left_outer, orient=tk.VERTICAL, command=left_canvas.yview)
        left_canvas.configure(yscrollcommand=left_scrollbar.set)
        left_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        left_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        left = ttk.Frame(left_canvas)
        left_window = left_canvas.create_window((0, 0), window=left, anchor="nw")
        left.bind("<Configure>", lambda _event: left_canvas.configure(scrollregion=left_canvas.bbox("all")))
        left_canvas.bind("<Configure>", lambda event: left_canvas.itemconfigure(left_window, width=event.width))
        left_canvas.bind("<MouseWheel>", lambda event: left_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units"))

        right = ttk.Frame(root)
        right.grid(row=0, column=1, sticky="nsew")
        right.rowconfigure(1, weight=1)
        right.columnconfigure(0, weight=1)

        self._build_left_panel(left)
        self._build_right_panel(right)

    def _build_left_panel(self, parent: ttk.Frame) -> None:
        ttk.Label(parent, text="DXF -> Lazer G-code", style="Title.TLabel").pack(anchor="w", pady=(0, 10))

        file_frame = ttk.Labelframe(parent, text="Dosya", style="Section.TLabelframe", padding=10)
        file_frame.pack(fill=tk.X, pady=(0, 10))
        file_buttons = ttk.Frame(file_frame)
        file_buttons.pack(fill=tk.X, pady=(0, 7))
        ttk.Button(file_buttons, text="DXF Seç", command=self.select_dxf).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(file_buttons, text="DXF Ekle", command=self.add_dxf).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(file_buttons, text="Temizle", command=self.clear_dxfs).pack(side=tk.LEFT, fill=tk.X, expand=True)
        self.parts_listbox = tk.Listbox(file_frame, height=4, activestyle="none")
        self.parts_listbox.pack(fill=tk.X, pady=(0, 7))
        self._file_row(file_frame, "Çıktı", self.output_path, self.select_output)

        bed_frame = ttk.Labelframe(parent, text="Tabla ve Yerleşim", style="Section.TLabelframe", padding=10)
        bed_frame.pack(fill=tk.X, pady=(0, 10))
        self._entry_grid(
            bed_frame,
            [
                ("Tabla X", self.bed_width, "mm"),
                ("Tabla Y", self.bed_height, "mm"),
                ("Adet", self.quantity, ""),
                ("Parça arası", self.gap, "mm"),
                ("Kenar payı", self.margin, "mm"),
            ],
        )
        ttk.Checkbutton(bed_frame, text="90 derece döndürmeye izin ver", variable=self.allow_rotate, command=self.preview).pack(anchor="w", pady=(8, 0))
        ttk.Checkbutton(bed_frame, text="İç kesimleri dış konturdan önce yaz", variable=self.inner_first, command=self.preview).pack(anchor="w")

        cut_frame = ttk.Labelframe(parent, text="Kesim Ayarları", style="Section.TLabelframe", padding=10)
        cut_frame.pack(fill=tk.X, pady=(0, 10))
        self._entry_grid(
            cut_frame,
            [
                ("Kesim hızı", self.feed, "mm/dk"),
                ("Güç S", self.power, "0-1000"),
                ("Boş hız", self.rapid_feed, "ops."),
                ("Pierce bekleme", self.pierce_delay, "sn"),
                ("Bindirme", self.overcut, "mm"),
                ("Pas sayısı", self.passes, ""),
                ("Boş hareket G1", self.travel_feed, "mm/dk"),
            ],
        )
        cmd_row = ttk.Frame(cut_frame)
        cmd_row.pack(fill=tk.X, pady=(5, 0))
        ttk.Label(cmd_row, text="Lazer komutu", width=14).pack(side=tk.LEFT)
        ttk.Combobox(cmd_row, textvariable=self.laser_cmd, values=("M3", "M4"), width=8, state="readonly").pack(side=tk.LEFT)
        ttk.Checkbutton(cut_frame, text="İş sonunda X0 Y0'a dön", variable=self.return_to_origin).pack(anchor="w", pady=(8, 0))

        engrave_frame = ttk.Labelframe(parent, text="Desen / Kazıma", style="Section.TLabelframe", padding=10)
        engrave_frame.pack(fill=tk.X, pady=(0, 10))
        ttk.Checkbutton(engrave_frame, text="Görsel deseni işle", variable=self.pattern_enabled, command=self.preview).pack(anchor="w", pady=(0, 7))
        pattern_row = ttk.Frame(engrave_frame)
        pattern_row.pack(fill=tk.X, pady=(0, 7))
        ttk.Label(pattern_row, text="Görsel", width=14).pack(side=tk.LEFT)
        ttk.Entry(pattern_row, textvariable=self.pattern_path).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(pattern_row, text="Seç", command=self.select_pattern, width=6).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(pattern_row, text="Sil", command=self.clear_pattern, width=5).pack(side=tk.LEFT)
        placement_tools = ttk.Frame(engrave_frame)
        placement_tools.pack(fill=tk.X, pady=(0, 7))
        ttk.Button(placement_tools, text="Parçaya Ortala", command=self.center_pattern_on_part).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(placement_tools, text="Parçaya Sığdır", command=self.fit_pattern_to_part).pack(side=tk.LEFT, fill=tk.X, expand=True)
        rotate_tools = ttk.Frame(engrave_frame)
        rotate_tools.pack(fill=tk.X, pady=(0, 7))
        ttk.Button(rotate_tools, text="-15°", command=lambda: self.rotate_pattern(-15)).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(rotate_tools, text="+15°", command=lambda: self.rotate_pattern(15)).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(rotate_tools, text="90°", command=lambda: self.rotate_pattern(90)).pack(side=tk.LEFT, fill=tk.X, expand=True)
        self._entry_grid(
            engrave_frame,
            [
                ("Sol", self.pattern_x, "mm"),
                ("Üst", self.pattern_y, "mm"),
                ("Genişlik", self.pattern_width, "mm"),
                ("Yükseklik", self.pattern_height, "mm"),
                ("Açı", self.pattern_rotation, "derece"),
                ("Kazıma gücü", self.pattern_power, "0-1000"),
                ("Kazıma hızı", self.pattern_feed, "mm/dk"),
                ("Çizgi aralığı", self.pattern_step, "mm"),
                ("Koyuluk eşiği", self.pattern_threshold, "0-255"),
            ],
        )

        advanced = ttk.Labelframe(parent, text="DXF Hassasiyet", style="Section.TLabelframe", padding=10)
        advanced.pack(fill=tk.X, pady=(0, 10))
        self._entry_grid(
            advanced,
            [
                ("Yay toleransı", self.tolerance, "mm"),
                ("Birleştirme", self.join_tolerance, "mm"),
            ],
        )

        actions = ttk.Frame(parent)
        actions.pack(fill=tk.X, pady=(4, 0))
        ttk.Button(actions, text="Önizle", command=self.preview).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(actions, text="G-code Oluştur", style="Primary.TButton", command=self.generate).pack(side=tk.LEFT, fill=tk.X, expand=True)

        ttk.Label(parent, textvariable=self.status_text, style="Status.TLabel", wraplength=330, justify="left").pack(anchor="w", pady=(12, 0))

    def _build_right_panel(self, parent: ttk.Frame) -> None:
        header = ttk.Frame(parent)
        header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="Yerleşim Önizlemesi", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Button(header, text="Önizlemeyi Yenile", command=self.preview).grid(row=0, column=1, sticky="e")

        canvas_frame = ttk.Frame(parent, relief=tk.SOLID, borderwidth=1)
        canvas_frame.grid(row=1, column=0, sticky="nsew")
        canvas_frame.rowconfigure(0, weight=1)
        canvas_frame.columnconfigure(0, weight=1)

        self.canvas = tk.Canvas(canvas_frame, background="#111827", highlightthickness=0)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        self.canvas.bind("<Configure>", lambda _event: self.draw_preview())
        self.canvas.bind("<ButtonPress-1>", self.on_canvas_press)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)
        self.canvas.bind("<MouseWheel>", self.on_canvas_wheel)

        summary = ttk.Labelframe(parent, text="Özet", style="Section.TLabelframe", padding=10)
        summary.grid(row=2, column=0, sticky="ew", pady=(10, 0))
        summary.columnconfigure(0, weight=1)
        self.summary_text = tk.Text(summary, height=6, wrap="word", relief=tk.FLAT, background="#f8fafc")
        self.summary_text.grid(row=0, column=0, sticky="ew")
        self.summary_text.configure(state="disabled")

    def _file_row(self, parent: ttk.Frame, label: str, variable: tk.StringVar, command) -> None:
        row = ttk.Frame(parent)
        row.pack(fill=tk.X, pady=(0, 7))
        ttk.Label(row, text=label, width=7).pack(side=tk.LEFT)
        ttk.Entry(row, textvariable=variable).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
        ttk.Button(row, text="Seç", command=command, width=8).pack(side=tk.LEFT)

    def _entry_grid(self, parent: ttk.Frame, rows: list[tuple[str, tk.StringVar, str]]) -> None:
        for index, (label, variable, suffix) in enumerate(rows):
            row = ttk.Frame(parent)
            row.pack(fill=tk.X, pady=(0 if index == 0 else 5, 0))
            ttk.Label(row, text=label, width=14).pack(side=tk.LEFT)
            entry = ttk.Entry(row, textvariable=variable, width=10)
            entry.pack(side=tk.LEFT)
            entry.bind("<Return>", lambda _event: self.preview())
            entry.bind("<FocusOut>", lambda _event: self.schedule_preview())
            if suffix:
                ttk.Label(row, text=suffix).pack(side=tk.LEFT, padx=(6, 0))

    def _install_auto_preview(self) -> None:
        variables = (
            self.bed_width,
            self.bed_height,
            self.quantity,
            self.gap,
            self.margin,
            self.tolerance,
            self.join_tolerance,
            self.pattern_path,
            self.pattern_x,
            self.pattern_y,
            self.pattern_width,
            self.pattern_height,
            self.pattern_rotation,
            self.pattern_power,
            self.pattern_feed,
            self.pattern_step,
            self.pattern_threshold,
        )
        for variable in variables:
            variable.trace_add("write", lambda *_args: self.schedule_preview())
        self.allow_rotate.trace_add("write", lambda *_args: self.schedule_preview())
        self.inner_first.trace_add("write", lambda *_args: self.schedule_preview())
        self.pattern_enabled.trace_add("write", lambda *_args: self.schedule_preview())

    def schedule_preview(self) -> None:
        if not self.dxf_path.get().strip():
            return
        if self._preview_job is not None:
            self.after_cancel(self._preview_job)
        self._preview_job = self.after(350, self._run_scheduled_preview)

    def _run_scheduled_preview(self) -> None:
        self._preview_job = None
        self.preview()

    def _initial_dxf_dir(self) -> str:
        if self.dxf_paths:
            return str(self.dxf_paths[-1].parent)
        documents_dir = Path.home() / "Documents"
        return str(documents_dir) if documents_dir.exists() else str(Path.home())

    def _set_dxf_paths(self, filenames: list[str], append: bool = False) -> None:
        paths = [Path(filename) for filename in filenames]
        if append:
            existing = {str(path).lower() for path in self.dxf_paths}
            self.dxf_paths.extend(path for path in paths if str(path).lower() not in existing)
        else:
            self.dxf_paths = paths

        if not self.dxf_paths:
            self.dxf_path.set("")
            self._refresh_parts_listbox()
            return

        if len(self.dxf_paths) == 1:
            self.dxf_path.set(str(self.dxf_paths[0]))
            output = self.dxf_paths[0].with_name(f"{self.dxf_paths[0].stem}_laser.nc")
        else:
            self.dxf_path.set(f"{len(self.dxf_paths)} DXF seçildi")
            output = self.dxf_paths[0].with_name("kutu_parcalari_laser.nc")
        self.output_path.set(str(output))
        self._refresh_parts_listbox()

    def _refresh_parts_listbox(self) -> None:
        if self.parts_listbox is None:
            return
        self.parts_listbox.delete(0, tk.END)
        for index, path in enumerate(self.dxf_paths, 1):
            self.parts_listbox.insert(tk.END, f"{index}. {path.name}")

    def select_dxf(self) -> None:
        filenames = filedialog.askopenfilenames(
            title="DXF seç",
            initialdir=self._initial_dxf_dir(),
            filetypes=[("DXF files", "*.dxf *.DXF"), ("All files", "*.*")],
        )
        if not filenames:
            return
        self._set_dxf_paths(list(filenames), append=False)
        self.load_dxf()
        self.preview()

    def add_dxf(self) -> None:
        filenames = filedialog.askopenfilenames(
            title="DXF ekle",
            initialdir=self._initial_dxf_dir(),
            filetypes=[("DXF files", "*.dxf *.DXF"), ("All files", "*.*")],
        )
        if not filenames:
            return
        self._set_dxf_paths(list(filenames), append=True)
        self.load_dxf()
        self.preview()

    def clear_dxfs(self) -> None:
        self.dxf_paths = []
        self.parts = []
        self.dxf_path.set("")
        if self.parts_listbox is not None:
            self.parts_listbox.delete(0, tk.END)
        self.source_paths = None
        self.normalized_paths = None
        self.current_layout = None
        self.current_cut_paths = None
        self.update_summary()
        self.draw_empty()
        self.status_text.set("DXF dosyası seçin.")

    def select_output(self) -> None:
        initial_file = Path(self.output_path.get()).name if self.output_path.get() else "laser_output.nc"
        initial_dir = str(self.dxf_paths[0].parent) if self.dxf_paths else str(Path.home())
        filename = filedialog.asksaveasfilename(
            title="G-code çıktısı",
            initialdir=initial_dir,
            initialfile=initial_file,
            defaultextension=".nc",
            filetypes=[("G-code / NC", "*.nc *.gcode"), ("All files", "*.*")],
        )
        if filename:
            self.output_path.set(filename)

    def select_pattern(self) -> None:
        initial_dir = Path(self.pattern_path.get()).parent if self.pattern_path.get() else None
        if initial_dir is None or not initial_dir.exists():
            initial_dir = self.dxf_paths[0].parent if self.dxf_paths else Path.home()
        filename = filedialog.askopenfilename(
            title="Desen görseli seç",
            initialdir=str(initial_dir),
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg *.bmp *.PNG *.JPG *.JPEG *.BMP"),
                ("All files", "*.*"),
            ],
        )
        if not filename:
            return
        self.pattern_path.set(filename)
        self.pattern_enabled.set(True)
        try:
            image = open_pattern_image(Path(filename))
            if image.size[0] > 0:
                target_width = self.parse_float(self.pattern_width, "Desen genişliği") or 60
                self.pattern_height.set(converter.fmt(target_width * image.size[1] / image.size[0]))
        except Exception:
            pass
        if self.current_layout is not None:
            self.fit_pattern_to_part()
        else:
            self.schedule_preview()

    def clear_pattern(self) -> None:
        self.pattern_enabled.set(False)
        self.pattern_path.set("")
        self.pattern_preview_image = None
        self.schedule_preview()

    def get_primary_part_rect(self) -> tuple[float, float, float, float] | None:
        layout = self.current_layout
        if layout is None or not layout.placements or not self.parts:
            return None
        best: tuple[float, float, float, float] | None = None
        best_area = -1.0
        for placement in layout.placements:
            part = self.parts[placement.part_index]
            width = part.height if placement.rotation == 90 else part.width
            height = part.width if placement.rotation == 90 else part.height
            area = width * height
            if area > best_area:
                best_area = area
                best = (placement.x, placement.y, width, height)
        return best

    def center_pattern_on_part(self) -> None:
        rect = self.get_primary_part_rect()
        if rect is None:
            self.preview()
            rect = self.get_primary_part_rect()
        if rect is None:
            return
        x, y, width, height = rect
        pattern_width = self.parse_float(self.pattern_width, "Desen genişliği") or 0
        pattern_height = self.parse_float(self.pattern_height, "Desen yüksekliği") or 0
        if pattern_width <= 0 or pattern_height <= 0:
            return
        self.pattern_x.set(converter.fmt(x + (width - pattern_width) / 2))
        self.pattern_y.set(converter.fmt(y + (height - pattern_height) / 2))
        self.pattern_enabled.set(bool(self.pattern_path.get().strip()))
        self.preview()

    def fit_pattern_to_part(self) -> None:
        rect = self.get_primary_part_rect()
        if rect is None:
            self.preview()
            rect = self.get_primary_part_rect()
        if rect is None:
            return
        x, y, width, height = rect
        padding = min(width, height) * 0.12
        usable_width = max(width - 2 * padding, width * 0.2)
        usable_height = max(height - 2 * padding, height * 0.2)
        pattern_width = self.parse_float(self.pattern_width, "Desen genişliği") or usable_width
        pattern_height = self.parse_float(self.pattern_height, "Desen yüksekliği") or usable_height
        ratio = pattern_width / pattern_height if pattern_height > 0 else 1.0
        target_width = usable_width
        target_height = target_width / ratio
        if target_height > usable_height:
            target_height = usable_height
            target_width = target_height * ratio
        self.pattern_width.set(converter.fmt(target_width))
        self.pattern_height.set(converter.fmt(target_height))
        self.pattern_x.set(converter.fmt(x + (width - target_width) / 2))
        self.pattern_y.set(converter.fmt(y + (height - target_height) / 2))
        self.pattern_enabled.set(bool(self.pattern_path.get().strip()))
        self.preview()

    def rotate_pattern(self, delta: float) -> None:
        rotation = self.parse_float(self.pattern_rotation, "Desen açısı") or 0
        self.pattern_rotation.set(converter.fmt((rotation + delta) % 360))
        self.pattern_enabled.set(bool(self.pattern_path.get().strip()))
        self.preview()

    def screen_to_bed(self, x: float, y: float) -> Point:
        return (x - self.preview_offset_x) / self.preview_scale, (y - self.preview_offset_y) / self.preview_scale

    def pattern_contains_bed_point(self, point: Point) -> bool:
        try:
            settings = self.get_pattern_settings(validate_bounds=False)
        except Exception:
            return False
        return settings is not None and point_in_polygon(point, pattern_corners(settings))

    def on_canvas_press(self, event) -> None:
        if not self.pattern_enabled.get() or not self.pattern_path.get().strip():
            return
        bed_point = self.screen_to_bed(event.x, event.y)
        if not self.pattern_contains_bed_point(bed_point):
            return
        current_x = self.parse_float(self.pattern_x, "Desen X") or 0
        current_y = self.parse_float(self.pattern_y, "Desen Y") or 0
        self._pattern_drag = (bed_point[0], bed_point[1], current_x, current_y)
        self.canvas.configure(cursor="fleur")

    def on_canvas_drag(self, event) -> None:
        if self._pattern_drag is None:
            return
        start_x, start_y, original_x, original_y = self._pattern_drag
        current_x, current_y = self.screen_to_bed(event.x, event.y)
        self.pattern_x.set(converter.fmt(original_x + current_x - start_x))
        self.pattern_y.set(converter.fmt(original_y + current_y - start_y))
        self.draw_preview()

    def on_canvas_release(self, _event) -> None:
        if self._pattern_drag is not None:
            self._pattern_drag = None
            self.canvas.configure(cursor="")
            self.update_summary()

    def on_canvas_wheel(self, event) -> str | None:
        if not self.pattern_enabled.get() or not self.pattern_path.get().strip():
            return None
        bed_point = self.screen_to_bed(event.x, event.y)
        if not self.pattern_contains_bed_point(bed_point):
            return None
        direction = 1 if event.delta > 0 else -1
        if event.state & 0x0001:
            self.rotate_pattern(5 * direction)
            return "break"

        width = self.parse_float(self.pattern_width, "Desen genişliği") or 0
        height = self.parse_float(self.pattern_height, "Desen yüksekliği") or 0
        if width <= 0 or height <= 0:
            return "break"
        factor = 1.08 if direction > 0 else 1 / 1.08
        center_x = (self.parse_float(self.pattern_x, "Desen X") or 0) + width / 2
        center_y = (self.parse_float(self.pattern_y, "Desen Y") or 0) + height / 2
        new_width = max(1.0, width * factor)
        new_height = max(1.0, height * factor)
        self.pattern_width.set(converter.fmt(new_width))
        self.pattern_height.set(converter.fmt(new_height))
        self.pattern_x.set(converter.fmt(center_x - new_width / 2))
        self.pattern_y.set(converter.fmt(center_y - new_height / 2))
        self.draw_preview()
        return "break"

    def parse_float(self, variable: tk.StringVar, label: str, allow_blank: bool = False) -> float | None:
        text = variable.get().strip().replace(",", ".")
        if not text and allow_blank:
            return None
        try:
            return float(text)
        except ValueError as exc:
            raise ValueError(f"{label} sayısal olmalı.") from exc

    def parse_int(self, variable: tk.StringVar, label: str) -> int:
        text = variable.get().strip()
        try:
            value = int(text)
        except ValueError as exc:
            raise ValueError(f"{label} tam sayı olmalı.") from exc
        if value < 1:
            raise ValueError(f"{label} en az 1 olmalı.")
        return value

    def parse_positive_int(self, variable: tk.StringVar, label: str) -> int:
        return self.parse_int(variable, label)

    def parse_power(self) -> int:
        text = self.power.get().strip()
        try:
            value = int(text)
        except ValueError as exc:
            raise ValueError("Güç S tam sayı olmalı.") from exc
        if value < converter.POWER_MIN or value > converter.POWER_MAX:
            raise ValueError(f"Güç S {converter.POWER_MIN} ile {converter.POWER_MAX} arasında olmalı.")
        return value

    def parse_int_between(self, variable: tk.StringVar, label: str, minimum: int, maximum: int) -> int:
        text = variable.get().strip()
        try:
            value = int(text)
        except ValueError as exc:
            raise ValueError(f"{label} tam sayı olmalı.") from exc
        if value < minimum or value > maximum:
            raise ValueError(f"{label} {minimum} ile {maximum} arasında olmalı.")
        return value

    def get_pattern_settings(self, validate_bounds: bool = True) -> PatternSettings | None:
        if not self.pattern_enabled.get() or not self.pattern_path.get().strip():
            return None

        settings = PatternSettings(
            path=Path(self.pattern_path.get().strip()),
            x=self.parse_float(self.pattern_x, "Desen X") or 0,
            y=self.parse_float(self.pattern_y, "Desen Y") or 0,
            width=self.parse_float(self.pattern_width, "Desen genişliği") or 0,
            height=self.parse_float(self.pattern_height, "Desen yüksekliği") or 0,
            rotation=self.parse_float(self.pattern_rotation, "Desen açısı") or 0,
            power=self.parse_int_between(self.pattern_power, "Desen güç S", converter.POWER_MIN, converter.POWER_MAX),
            feed=self.parse_float(self.pattern_feed, "Desen hızı") or 0,
            line_step=self.parse_float(self.pattern_step, "Desen satır aralığı") or 0,
            threshold=self.parse_int_between(self.pattern_threshold, "Desen eşiği", 0, 255),
        )
        if validate_bounds and (settings.x < 0 or settings.y < 0):
            raise ValueError("Desen X/Y konumu negatif olamaz.")
        if settings.width <= 0 or settings.height <= 0:
            raise ValueError("Desen genişlik/yükseklik 0'dan büyük olmalı.")
        if settings.feed <= 0:
            raise ValueError("Desen hızı 0'dan büyük olmalı.")
        if settings.line_step <= 0:
            raise ValueError("Desen satır aralığı 0'dan büyük olmalı.")

        if validate_bounds:
            bed_width = self.parse_float(self.bed_width, "Tabla X") or 0
            bed_height = self.parse_float(self.bed_height, "Tabla Y") or 0
            corners = pattern_corners(settings)
            min_x = min(point[0] for point in corners)
            min_y = min(point[1] for point in corners)
            max_x = max(point[0] for point in corners)
            max_y = max(point[1] for point in corners)
            if min_x < -1e-9 or min_y < -1e-9 or max_x > bed_width + 1e-9 or max_y > bed_height + 1e-9:
                raise ValueError("Desen tabla dışına taşıyor. X/Y veya genişlik/yüksekliği küçültün.")
        return settings

    def build_pattern_gcode(self, travel_feed: float | None) -> list[str]:
        settings = self.get_pattern_settings(validate_bounds=True)
        if settings is None:
            return []
        return build_raster_engrave_lines(settings, travel_feed)

    def load_dxf(self) -> None:
        if not self.dxf_paths and self.dxf_path.get().strip():
            self.dxf_paths = [Path(self.dxf_path.get().strip())]
            self._refresh_parts_listbox()
        if not self.dxf_paths:
            raise ValueError("Önce DXF dosyası seçin.")

        tolerance = self.parse_float(self.tolerance, "Yay toleransı") or 0.25
        join_tolerance = self.parse_float(self.join_tolerance, "Birleştirme toleransı") or 0.05
        parts: list[LoadedPart] = []
        all_unsupported: dict[str, int] = {}

        for dxf in self.dxf_paths:
            if not dxf.exists():
                raise ValueError(f"DXF dosyası bulunamadı: {dxf}")
            paths, unsupported, _supported_count = converter.convert_dxf_paths(dxf, tolerance, join_tolerance)
            if not paths:
                raise ValueError(f"DXF içinde desteklenen kesim çizgisi bulunamadı: {dxf.name}")
            if self.inner_first.get():
                paths = converter.ordered_paths(paths, join_tolerance)
            normalized, width, height = normalize_paths(paths)
            parts.append(
                LoadedPart(
                    path=dxf,
                    name=dxf.name,
                    paths=normalized,
                    width=width,
                    height=height,
                    unsupported=unsupported,
                )
            )
            for name, count in unsupported.items():
                all_unsupported[name] = all_unsupported.get(name, 0) + count

        self.parts = parts
        self.unsupported = all_unsupported
        first = parts[0]
        self.source_paths = first.paths
        self.normalized_paths = first.paths
        self.part_width = first.width
        self.part_height = first.height

    def preview(self) -> None:
        try:
            if not self.dxf_path.get():
                self.status_text.set("DXF dosyası seçin.")
                self.draw_empty()
                return
            self.load_dxf()
            layout, cut_paths = self.build_current_cut_paths()
            self.current_layout = layout
            self.current_cut_paths = cut_paths
            self.update_summary()
            self.draw_preview()
            self.status_text.set("Önizleme hazır. Ölçüler mm olarak korunur; desen varsa önce kazınır.")
        except Exception as exc:  # GUI boundary
            self.current_layout = None
            self.current_cut_paths = None
            self.status_text.set(str(exc))
            self.update_summary(error=str(exc))
            self.draw_message(str(exc))

    def build_current_cut_paths(self) -> tuple[Layout, list[list[Point]]]:
        if not self.parts:
            raise ValueError("DXF yüklenmedi.")
        quantity = self.parse_int(self.quantity, "Adet")
        bed_width = self.parse_float(self.bed_width, "Tabla X") or 0
        bed_height = self.parse_float(self.bed_height, "Tabla Y") or 0
        gap = self.parse_float(self.gap, "Parça arası") or 0
        margin = self.parse_float(self.margin, "Kenar payı") or 0

        if len(self.parts) == 1:
            part = self.parts[0]
            layout = build_layout(
                quantity=quantity,
                part_width=part.width,
                part_height=part.height,
                bed_width=bed_width,
                bed_height=bed_height,
                gap=gap,
                margin=margin,
                allow_rotate=self.allow_rotate.get(),
            )
            cut_paths = make_cut_paths(part.paths, layout, part.width, part.height)
        else:
            layout = build_mixed_layout(
                parts=self.parts,
                set_count=quantity,
                bed_width=bed_width,
                bed_height=bed_height,
                gap=gap,
                margin=margin,
                allow_rotate=self.allow_rotate.get(),
            )
            cut_paths = make_mixed_cut_paths(self.parts, layout)
        return layout, cut_paths

    def generate(self) -> None:
        try:
            if not self.output_path.get().strip():
                self.select_output()
                if not self.output_path.get().strip():
                    return
            self.load_dxf()
            layout, cut_paths = self.build_current_cut_paths()
            feed = self.parse_float(self.feed, "Kesim hızı") or 600
            power = self.parse_power()
            rapid_feed = self.parse_float(self.rapid_feed, "Boş hız", allow_blank=True)
            pierce_delay = self.parse_float(self.pierce_delay, "Pierce bekleme") or 0
            overcut = self.parse_float(self.overcut, "Bindirme") or 0
            travel_feed = self.parse_float(self.travel_feed, "Boş hareket G1", allow_blank=True)
            passes = self.parse_positive_int(self.passes, "Pas sayısı")
            pattern_lines = self.build_pattern_gcode(travel_feed)

            converter.write_gcode(
                output_path=Path(self.output_path.get()),
                paths=cut_paths,
                feed=feed,
                power=power,
                rapid_feed=rapid_feed,
                laser_cmd=self.laser_cmd.get(),
                pierce_delay=pierce_delay,
                comments=True,
                overcut=overcut,
                return_to_origin=self.return_to_origin.get(),
                travel_feed=travel_feed,
                passes=passes,
                pre_cut_lines=pattern_lines,
            )

            self.current_layout = layout
            self.current_cut_paths = cut_paths
            self.update_summary()
            self.draw_preview()
            cut_min_x, cut_min_y, cut_max_x, cut_max_y = paths_bounds(cut_paths)
            cut_width = cut_max_x - cut_min_x
            cut_height = cut_max_y - cut_min_y
            status = (
                f"G-code hazır. Kesim alanı: "
                f"{converter.fmt(cut_width)} x {converter.fmt(cut_height)} mm."
            )
            if pattern_lines:
                status += " Desen kesimden önce kazınacak."
            self.status_text.set(status)
            messagebox.showinfo(
                "G-code hazır",
                f"Dosya oluşturuldu:\n{self.output_path.get()}\n\n{status}",
            )
        except Exception as exc:  # GUI boundary
            messagebox.showerror("Hata", str(exc))
            self.status_text.set(str(exc))

    def update_summary(self, error: str | None = None) -> None:
        self.summary_text.configure(state="normal")
        self.summary_text.delete("1.0", tk.END)
        if error:
            self.summary_text.insert(tk.END, f"Hata: {error}")
            self.summary_text.configure(state="disabled")
            return
        layout = self.current_layout
        if layout is None:
            self.summary_text.insert(tk.END, "Önizleme yok.")
            self.summary_text.configure(state="disabled")
            return
        bed_width = self.parse_float(self.bed_width, "Tabla X") or 0
        bed_height = self.parse_float(self.bed_height, "Tabla Y") or 0
        usable_area = max(0.0, bed_width * bed_height)
        packed_area = layout.used_width * layout.used_height
        utilization = (packed_area / usable_area * 100.0) if usable_area else 0.0
        if len(self.parts) <= 1:
            part_line = f"Parça ölçüsü: {converter.fmt(self.part_width)} x {converter.fmt(self.part_height)} mm"
        else:
            part_line = f"Parça seti: {len(self.parts)} farklı DXF, toplam {len(layout.placements)} parça"
        lines = [
            part_line,
            f"Yerleşim: {len(layout.placements)} adet, {layout.columns} sütun x {layout.rows} sıra, rotasyon {layout.rotation} derece",
            f"Kullanılan alan: {converter.fmt(layout.used_width)} x {converter.fmt(layout.used_height)} mm ({utilization:.1f}% tabla dikdörtgeni)",
            f"G-code yolu: {self.output_path.get() or '-'}",
        ]
        if len(self.parts) > 1:
            details = ", ".join(
                f"{part.path.stem}: {converter.fmt(part.width)}x{converter.fmt(part.height)}"
                for part in self.parts[:4]
            )
            if len(self.parts) > 4:
                details += f", +{len(self.parts) - 4}"
            lines.insert(1, details)
        if self.current_cut_paths:
            cut_min_x, cut_min_y, cut_max_x, cut_max_y = paths_bounds(self.current_cut_paths)
            lines.insert(
                3,
                f"G-code kesim alanı: {converter.fmt(cut_max_x - cut_min_x)} x {converter.fmt(cut_max_y - cut_min_y)} mm",
            )
        try:
            pattern = self.get_pattern_settings(validate_bounds=False)
        except Exception as exc:
            pattern = None
            lines.append(f"Desen ayarı okunamadı: {exc}")
        if pattern is not None:
            lines.append(
                f"Desen: {pattern.path.name}, X{converter.fmt(pattern.x)} Y{converter.fmt(pattern.y)}, "
                f"{converter.fmt(pattern.width)} x {converter.fmt(pattern.height)} mm, "
                f"{converter.fmt(pattern.rotation)} derece, S{pattern.power}"
            )
        if self.unsupported:
            skipped = ", ".join(f"{name}={count}" for name, count in sorted(self.unsupported.items()))
            lines.append(f"Atlanan DXF entity: {skipped}")
        self.summary_text.insert(tk.END, "\n".join(lines))
        self.summary_text.configure(state="disabled")

    def draw_empty(self) -> None:
        self.draw_message("DXF seçildiğinde yerleşim burada görünecek.")

    def draw_message(self, text: str) -> None:
        self.canvas.delete("all")
        width = max(self.canvas.winfo_width(), 1)
        height = max(self.canvas.winfo_height(), 1)
        self.canvas.create_text(
            width / 2,
            height / 2,
            text=text,
            fill="#cbd5e1",
            font=("Segoe UI", 13),
            width=max(300, width - 80),
        )

    def draw_preview(self) -> None:
        self.canvas.delete("all")
        cut_paths = self.current_cut_paths
        layout = self.current_layout
        if cut_paths is None or layout is None:
            self.draw_empty()
            return

        bed_width = self.parse_float(self.bed_width, "Tabla X") or 1
        bed_height = self.parse_float(self.bed_height, "Tabla Y") or 1
        canvas_width = max(self.canvas.winfo_width(), 1)
        canvas_height = max(self.canvas.winfo_height(), 1)
        pad = 24
        scale = min((canvas_width - 2 * pad) / bed_width, (canvas_height - 2 * pad) / bed_height)
        if scale <= 0:
            scale = 1
        offset_x = (canvas_width - bed_width * scale) / 2
        offset_y = (canvas_height - bed_height * scale) / 2
        self.preview_scale = scale
        self.preview_offset_x = offset_x
        self.preview_offset_y = offset_y

        def screen(point: Point) -> Point:
            x, y = point
            return offset_x + x * scale, offset_y + y * scale

        self.canvas.create_rectangle(
            offset_x,
            offset_y,
            offset_x + bed_width * scale,
            offset_y + bed_height * scale,
            outline="#64748b",
            width=2,
            fill="#0f172a",
        )

        grid_step = 50
        for gx in range(0, int(bed_width) + 1, grid_step):
            x = offset_x + gx * scale
            self.canvas.create_line(x, offset_y, x, offset_y + bed_height * scale, fill="#1f2937")
        for gy in range(0, int(bed_height) + 1, grid_step):
            y = offset_y + gy * scale
            self.canvas.create_line(offset_x, y, offset_x + bed_width * scale, y, fill="#1f2937")

        for placement in layout.placements:
            part = self.parts[placement.part_index] if self.parts else None
            base_width = part.width if part else self.part_width
            base_height = part.height if part else self.part_height
            item_width = base_height if placement.rotation == 90 else base_width
            item_height = base_width if placement.rotation == 90 else base_height
            x1, y1 = screen((placement.x, placement.y))
            x2, y2 = screen((placement.x + item_width, placement.y + item_height))
            self.canvas.create_rectangle(x1, y1, x2, y2, outline="#334155", dash=(4, 3))

        self.pattern_preview_image = None
        try:
            pattern = self.get_pattern_settings(validate_bounds=False)
        except Exception:
            pattern = None
        if pattern is not None:
            corners = [screen(point) for point in pattern_corners(pattern)]
            flat_corners = [coord for point in corners for coord in point]
            min_screen_x = min(point[0] for point in corners)
            min_screen_y = min(point[1] for point in corners)
            preview_width = max(1, int(pattern.width * scale))
            preview_height = max(1, int(pattern.height * scale))
            if Image is not None and ImageTk is not None and pattern.path.exists() and preview_width > 2 and preview_height > 2:
                try:
                    image = open_pattern_image(pattern.path).convert("RGB")
                    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
                    image = image.resize((preview_width, preview_height), resample)
                    rotate_resample = Image.Resampling.BICUBIC if hasattr(Image, "Resampling") else Image.BICUBIC
                    image = image.rotate(-pattern.rotation, expand=True, resample=rotate_resample)
                    self.pattern_preview_image = ImageTk.PhotoImage(image)
                    self.canvas.create_image(min_screen_x, min_screen_y, image=self.pattern_preview_image, anchor="nw")
                except Exception:
                    pass
            self.canvas.create_polygon(*flat_corners, outline="#a78bfa", fill="", width=2, dash=(6, 3))
            self.canvas.create_text(
                min_screen_x + 6,
                min_screen_y + 6,
                text="Desen",
                anchor="nw",
                fill="#f5d0fe",
                font=("Segoe UI", 9, "bold"),
            )

        for index, path in enumerate(cut_paths):
            if len(path) < 2:
                continue
            coords: list[float] = []
            for point in path:
                sx, sy = screen(point)
                coords.extend([sx, sy])
            color = "#38bdf8"
            if converter.is_closed(path, 0.05) and abs(converter.signed_area(path)) > (self.part_width * self.part_height * 0.25):
                color = "#f59e0b"
            self.canvas.create_line(*coords, fill=color, width=1.8)
            if index < len(cut_paths) - 1:
                continue

        label = f"{converter.fmt(bed_width)} x {converter.fmt(bed_height)} mm tabla"
        self.canvas.create_text(offset_x + 8, offset_y + 8, text=label, anchor="nw", fill="#e5e7eb", font=("Segoe UI", 10))


def main() -> None:
    app = LaserGcodeApp()
    app.mainloop()


if __name__ == "__main__":
    main()
