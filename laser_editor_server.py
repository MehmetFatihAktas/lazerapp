#!/usr/bin/env python3
"""Local server for the visual laser job editor."""

from __future__ import annotations

import json
import base64
import hashlib
import math
import mimetypes
import os
import platform
import re
import socket
import sys
import tempfile
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import laser_grbl
import laser_editor_core as core
from PIL import Image, ImageOps
try:
    from fontTools.ttLib import TTCollection, TTFont
except ImportError:  # pragma: no cover - source installs include fontTools
    TTCollection = None
    TTFont = None


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "laser_editor"
DEFAULT_DIR = Path("D:/SolidÇalışmalarım")
MACHINE = laser_grbl.GrblController()
CLIENT_STALE_SECONDS = 90.0
CLIENT_CLOSE_GRACE_SECONDS = 8.0
CLIENT_MONITOR_INTERVAL = 2.0
CLIENT_LOCK = threading.RLock()
CLIENTS: dict[str, float] = {}
CLIENT_EVER_CONNECTED = False
NO_CLIENTS_SINCE: float | None = None
DIALOG_LOCK = threading.Lock()
SYSTEM_FONT_LOCK = threading.Lock()
SYSTEM_FONT_CACHE: dict | None = None
APP_VERSION = "2026.07.16"


FONT_SUFFIXES = {".ttf", ".otf", ".ttc", ".otc"}
FONT_EXCLUDE_TOKENS = (
    "symbol",
    "wingdings",
    "webdings",
    "marlett",
    "mdl2",
    "fluent icons",
    "hololens",
)
FONT_THICK_TOKENS = (
    "black",
    "heavy",
    "bold",
    "impact",
    "poster",
    "fat",
    "cooper",
    "broadway",
    "bauhaus",
    "britannic",
    "showcard",
    "stencil",
)
FONT_HANDWRITING_TOKENS = (
    "script",
    "hand",
    "brush",
    "calligraphy",
    "chancery",
    "corsiva",
    "mistral",
    "pristina",
    "viner",
    "vladimir",
    "vivaldi",
    "blackadder",
    "edwardian",
    "kristen",
    "ravie",
)
FONT_DECORATIVE_TOKENS = (
    "algerian",
    "broadway",
    "castellar",
    "chiller",
    "curlz",
    "elephant",
    "forte",
    "gigi",
    "harrington",
    "jokerman",
    "magneto",
    "old english",
    "onyx",
    "papyrus",
    "playbill",
    "ravie",
    "showcard",
    "snap itc",
    "stencil",
)


def _font_directories() -> list[Path]:
    candidates: list[Path] = []
    if sys.platform.startswith("win"):
        windows_root = Path(os.environ.get("WINDIR") or "C:/Windows")
        candidates.append(windows_root / "Fonts")
        local_app_data = os.environ.get("LOCALAPPDATA")
        if local_app_data:
            candidates.append(Path(local_app_data) / "Microsoft" / "Windows" / "Fonts")
    elif sys.platform == "darwin":
        candidates.extend([Path("/System/Library/Fonts"), Path("/Library/Fonts"), Path.home() / "Library" / "Fonts"])
    else:
        candidates.extend([Path("/usr/share/fonts"), Path("/usr/local/share/fonts"), Path.home() / ".fonts"])
    result: list[Path] = []
    seen: set[str] = set()
    for path in candidates:
        resolved = str(path).casefold()
        if path.is_dir() and resolved not in seen:
            seen.add(resolved)
            result.append(path)
    return result


def _font_name(font, name_ids: tuple[int, ...]) -> str:
    if "name" not in font:
        return ""
    records = font["name"].names
    for name_id in name_ids:
        values: list[tuple[int, str]] = []
        for record in records:
            if record.nameID != name_id:
                continue
            try:
                value = re.sub(r"\s+", " ", record.toUnicode()).strip()
            except Exception:
                continue
            if not value:
                continue
            language_priority = 0 if record.langID in {0x409, 0x41F} else 1
            values.append((language_priority, value))
        if values:
            values.sort(key=lambda item: (item[0], len(item[1]), item[1].casefold()))
            return values[0][1]
    return ""


def _font_category(family: str, font) -> str:
    lowered = family.casefold()
    if any(token in lowered for token in FONT_HANDWRITING_TOKENS):
        return "handwriting"
    if any(token in lowered for token in FONT_DECORATIVE_TOKENS):
        return "decorative"
    if "post" in font and bool(getattr(font["post"], "isFixedPitch", 0)):
        return "monospace"
    if "OS/2" in font:
        panose = getattr(font["OS/2"], "panose", None)
        family_type = int(getattr(panose, "bFamilyType", 0) or 0)
        serif_style = int(getattr(panose, "bSerifStyle", 0) or 0)
        proportion = int(getattr(panose, "bProportion", 0) or 0)
        if proportion == 9:
            return "monospace"
        if family_type == 3:
            return "handwriting"
        if family_type == 4:
            return "decorative"
        if family_type == 2:
            return "sans" if serif_style >= 11 else "serif"
    return "other"


def _font_face_record(font) -> dict | None:
    family = _font_name(font, (16, 1))
    if not family or family.startswith("@"):
        return None
    lowered = family.casefold()
    if any(token in lowered for token in FONT_EXCLUDE_TOKENS):
        return None
    try:
        cmap = font.getBestCmap() or {}
    except Exception:
        cmap = {}
    if ord("A") not in cmap and ord("a") not in cmap:
        return None
    subfamily = _font_name(font, (17, 2)) or "Regular"
    weight = 400
    italic = "italic" in subfamily.casefold() or "oblique" in subfamily.casefold()
    if "OS/2" in font:
        os2 = font["OS/2"]
        weight = max(100, min(1000, int(getattr(os2, "usWeightClass", 400) or 400)))
        italic = italic or bool(int(getattr(os2, "fsSelection", 0) or 0) & 0x01)
    supports_turkish = all(ord(char) in cmap for char in "ÇĞİÖŞÜçğıöşü")
    return {
        "family": family,
        "subfamily": subfamily,
        "weight": weight,
        "italic": italic,
        "category": _font_category(family, font),
        "supportsTurkish": supports_turkish,
    }


def build_system_font_catalog(face_records: list[dict]) -> list[dict]:
    families: dict[str, dict] = {}
    category_priority = {"other": 0, "sans": 1, "serif": 1, "monospace": 2, "decorative": 3, "handwriting": 4}
    for record in face_records:
        family = re.sub(r"\s+", " ", str(record.get("family") or "")).strip()
        if not family:
            continue
        key = family.casefold()
        entry = families.setdefault(
            key,
            {
                "family": family,
                "weights": set(),
                "styles": set(),
                "category": "other",
                "supportsTurkish": False,
            },
        )
        entry["weights"].add(max(100, min(1000, int(record.get("weight") or 400))))
        entry["styles"].add("italic" if record.get("italic") else "normal")
        category = str(record.get("category") or "other")
        if category_priority.get(category, 0) > category_priority.get(entry["category"], 0):
            entry["category"] = category
        entry["supportsTurkish"] = bool(entry["supportsTurkish"] or record.get("supportsTurkish"))
    result: list[dict] = []
    for entry in families.values():
        family = entry["family"]
        weights = sorted(entry["weights"])
        lowered = family.casefold()
        result.append(
            {
                "id": f"system-{hashlib.sha1(lowered.encode('utf-8')).hexdigest()[:12]}",
                "family": family,
                "weights": weights,
                "styles": sorted(entry["styles"]),
                "category": entry["category"],
                "supportsTurkish": bool(entry["supportsTurkish"]),
                "thickSuitable": max(weights, default=400) >= 700 or any(token in lowered for token in FONT_THICK_TOKENS),
            }
        )
    return sorted(result, key=lambda item: item["family"].casefold())


def system_font_catalog(force: bool = False) -> dict:
    global SYSTEM_FONT_CACHE
    with SYSTEM_FONT_LOCK:
        if SYSTEM_FONT_CACHE is not None and not force:
            return SYSTEM_FONT_CACHE
        started = time.perf_counter()
        records: list[dict] = []
        scanned_files = 0
        failed_files = 0
        if TTFont is not None and TTCollection is not None:
            seen_files: set[str] = set()
            for directory in _font_directories():
                for path in directory.rglob("*"):
                    if not path.is_file() or path.suffix.casefold() not in FONT_SUFFIXES:
                        continue
                    path_key = str(path.resolve()).casefold()
                    if path_key in seen_files:
                        continue
                    seen_files.add(path_key)
                    scanned_files += 1
                    collection = None
                    fonts = []
                    try:
                        if path.suffix.casefold() in {".ttc", ".otc"}:
                            collection = TTCollection(str(path), lazy=True)
                            fonts = collection.fonts
                        else:
                            fonts = [TTFont(str(path), lazy=True)]
                        for font in fonts:
                            record = _font_face_record(font)
                            if record:
                                records.append(record)
                    except Exception:
                        failed_files += 1
                    finally:
                        for font in fonts:
                            try:
                                font.close()
                            except Exception:
                                pass
                        if collection is not None:
                            try:
                                collection.close()
                            except Exception:
                                pass
        fonts = build_system_font_catalog(records)
        SYSTEM_FONT_CACHE = {
            "fonts": fonts,
            "count": len(fonts),
            "scannedFiles": scanned_files,
            "failedFiles": failed_files,
            "durationMs": round((time.perf_counter() - started) * 1000),
        }
        return SYSTEM_FONT_CACHE


def device_capabilities() -> dict:
    return {
        "protocol": "grbl-serial",
        "serial": True,
        "frame": True,
        "workOrigin": True,
        "feedOverride": True,
        "powerOverride": True,
        "camera": False,
        "rotary": False,
        "curvedSurface": False,
        "blade": False,
        "pen": False,
        "networkPairing": False,
        "safetySensors": False,
    }


def diagnostics_snapshot() -> dict:
    machine = MACHINE.snapshot()
    return {
        "app": {
            "name": "Laser Editor",
            "version": APP_VERSION,
            "server": LaserEditorHandler.server_version if "LaserEditorHandler" in globals() else "LaserEditor/1.0",
        },
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "architecture": platform.machine(),
        },
        "capabilities": device_capabilities(),
        "machine": {
            "available": bool(machine.get("available")),
            "connected": bool(machine.get("connected")),
            "port": machine.get("port") or "",
            "baud": machine.get("baud") or 0,
            "state": machine.get("state") or "",
            "alarm": machine.get("alarm") or "",
            "firmware": machine.get("firmware") or "",
        },
        "privacy": {
            "projectGeometryIncluded": False,
            "projectPathsIncluded": False,
            "gcodeIncluded": False,
        },
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


class NativeDialogBusyError(RuntimeError):
    pass


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def gcode_file_info(path_value: str | Path) -> dict:
    path = Path(path_value)
    if not path.is_file():
        raise ValueError(f"G-code dosyasi bulunamadi: {path}")
    info = laser_grbl.analyze_gcode(laser_grbl.gcode_raw_lines_from_file(path))
    stat = path.stat()
    info.update({
        "fileHash": file_sha256(path),
        "fileSize": stat.st_size,
        "modifiedAt": stat.st_mtime,
    })
    return info


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{time.time_ns()}.tmp")
    try:
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def validate_generate_output_choice(state: dict) -> None:
    requested_output = str(state.get("outputPath") or "").strip()
    output_path = Path(requested_output) if requested_output else None
    if output_path and output_path.exists() and not bool(state.get("overwriteConfirmed")):
        raise ValueError("Mevcut G-code dosyasının üzerine yazmak için hedefi yeniden seçin.")


def image_data_url_to_temp_file(data_url: str) -> Path:
    text = str(data_url or "")
    if not text.startswith("data:image/") or ";base64," not in text:
        raise ValueError("Gecersiz gorsel verisi.")
    header, encoded = text.split(",", 1)
    mime = header[5:].split(";", 1)[0].lower()
    suffix = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/webp": ".webp",
    }.get(mime)
    if not suffix:
        raise ValueError("Desteklenmeyen gorsel formati.")
    raw = base64.b64decode(encoded, validate=True)
    if not raw or len(raw) > 24 * 1024 * 1024:
        raise ValueError("Gorsel verisi bos veya cok buyuk.")
    temp = tempfile.NamedTemporaryFile(prefix="laser_text_", suffix=suffix, delete=False)
    try:
        temp.write(raw)
        return Path(temp.name)
    finally:
        temp.close()


def crop_raster_image_to_temp(source_path: Path, crop_normalized: dict, padding_pixels: int = 12) -> tuple[Path, dict]:
    """Crop an EXIF-oriented raster using top-left normalized source coordinates."""
    if not isinstance(crop_normalized, dict):
        raise ValueError("Gecersiz yerel vektor secim alani.")

    def crop_value(name: str, fallback: float) -> float:
        try:
            value = float(crop_normalized.get(name, fallback))
        except (TypeError, ValueError) as error:
            raise ValueError("Gecersiz yerel vektor secim alani.") from error
        if not 0.0 <= value <= 1.0:
            raise ValueError("Yerel vektor secim alani gorsel sinirlari disinda.")
        return value

    min_x = crop_value("minX", 0.0)
    min_y = crop_value("minY", 0.0)
    max_x = crop_value("maxX", 1.0)
    max_y = crop_value("maxY", 1.0)
    if max_x - min_x <= 1e-6 or max_y - min_y <= 1e-6:
        raise ValueError("Yerel vektor secim alani cok kucuk.")

    with Image.open(source_path) as opened:
        oriented = ImageOps.exif_transpose(opened)
        width, height = oriented.size
        if width < 2 or height < 2:
            raise ValueError("Yerel vektorlestirme icin gorsel cok kucuk.")
        requested_left = max(0, min(width - 1, int(math.floor(min_x * width))))
        requested_top = max(0, min(height - 1, int(math.floor(min_y * height))))
        requested_right = max(requested_left + 1, min(width, int(math.ceil(max_x * width))))
        requested_bottom = max(requested_top + 1, min(height, int(math.ceil(max_y * height))))
        if requested_right - requested_left < 3 or requested_bottom - requested_top < 3:
            raise ValueError("Yerel vektor secim alani en az 3 piksel olmali.")

        padding = max(0, min(256, int(padding_pixels or 0)))
        left = max(0, requested_left - padding)
        top = max(0, requested_top - padding)
        right = min(width, requested_right + padding)
        bottom = min(height, requested_bottom + padding)
        cropped = oriented.crop((left, top, right, bottom))
        if cropped.mode not in {"L", "RGB", "RGBA"}:
            cropped = cropped.convert("RGBA")

        temp = tempfile.NamedTemporaryFile(prefix="laser_vector_crop_", suffix=".png", delete=False)
        temp_path = Path(temp.name)
        temp.close()
        try:
            cropped.save(temp_path, format="PNG")
        except Exception:
            temp_path.unlink(missing_ok=True)
            raise

    return temp_path, {
        "normalized": {
            "minX": left / width,
            "minY": top / height,
            "maxX": right / width,
            "maxY": bottom / height,
        },
        "requestedNormalized": {
            "minX": min_x,
            "minY": min_y,
            "maxX": max_x,
            "maxY": max_y,
        },
        "pixelBounds": {"left": left, "top": top, "right": right, "bottom": bottom},
        "pixelWidth": right - left,
        "pixelHeight": bottom - top,
        "originalWidth": width,
        "originalHeight": height,
    }


def materialize_raster_pattern_data_urls(state: dict) -> list[Path]:
    """Replace embedded edited raster sources with temporary file paths."""
    created: list[Path] = []
    try:
        for pattern in state.get("patterns") or []:
            data_url = pattern.pop("dataUrl", None)
            if not data_url:
                continue
            if str(pattern.get("kind") or "").lower() != "raster":
                raise ValueError("Gomulu gorsel yalniz raster desenlerde kullanilabilir.")
            path = image_data_url_to_temp_file(str(data_url))
            created.append(path)
            pattern["path"] = str(path)
            pattern["sourcePath"] = str(path)
        return created
    except Exception:
        for path in created:
            path.unlink(missing_ok=True)
        raise


def record_client_ping(client_id: str) -> None:
    global CLIENT_EVER_CONNECTED, NO_CLIENTS_SINCE
    client_id = str(client_id or "default")[:120]
    with CLIENT_LOCK:
        CLIENTS[client_id] = time.monotonic()
        CLIENT_EVER_CONNECTED = True
        NO_CLIENTS_SINCE = None


def record_client_close(client_id: str) -> None:
    global NO_CLIENTS_SINCE
    client_id = str(client_id or "default")[:120]
    with CLIENT_LOCK:
        CLIENTS.pop(client_id, None)
        if not CLIENTS and NO_CLIENTS_SINCE is None:
            NO_CLIENTS_SINCE = time.monotonic()


def client_shutdown_due() -> bool:
    global NO_CLIENTS_SINCE
    now = time.monotonic()
    with CLIENT_LOCK:
        for client_id, last_seen in list(CLIENTS.items()):
            if now - last_seen > CLIENT_STALE_SECONDS:
                CLIENTS.pop(client_id, None)
        if not CLIENT_EVER_CONNECTED:
            return False
        if CLIENTS:
            NO_CLIENTS_SINCE = None
            return False
        if NO_CLIENTS_SINCE is None:
            NO_CLIENTS_SINCE = now
            return False
        return now - NO_CLIENTS_SINCE >= CLIENT_CLOSE_GRACE_SECONDS


def monitor_client_shutdown(server: ThreadingHTTPServer) -> None:
    while True:
        time.sleep(CLIENT_MONITOR_INTERVAL)
        if not client_shutdown_due():
            continue
        try:
            snapshot = MACHINE.snapshot()
            if snapshot.get("job", {}).get("running"):
                continue
        except Exception:
            pass
        print("Tarayici oturumu kapandi; sunucu kapatiliyor.")
        server.shutdown()
        return


def locked_dialog(func):
    def wrapper(*args, **kwargs):
        if not DIALOG_LOCK.acquire(blocking=False):
            raise NativeDialogBusyError("Bir dosya seçme veya kaydetme penceresi zaten açık.")
        try:
            return func(*args, **kwargs)
        finally:
            DIALOG_LOCK.release()

    return wrapper


@locked_dialog
def choose_dxf_files() -> list[str]:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        filenames = filedialog.askopenfilenames(
            title="DXF parçalarını seç",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            filetypes=[("DXF", "*.dxf *.DXF"), ("All files", "*.*")],
        )
        return list(filenames)
    finally:
        root.destroy()


@locked_dialog
def choose_image_file() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.askopenfilename(
            title="Desen görseli seç",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            filetypes=[
                ("SVG", "*.svg *.SVG"),
                ("Desen", "*.png *.jpg *.jpeg *.bmp *.svg *.PNG *.JPG *.JPEG *.BMP *.SVG"),
                ("All files", "*.*"),
            ],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_raster_image_file() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.askopenfilename(
            title="Vektörleştirilecek fotoğraf seç",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            filetypes=[
                ("Fotoğraf", "*.png *.jpg *.jpeg *.bmp *.webp *.tif *.tiff *.gif *.PNG *.JPG *.JPEG *.BMP *.WEBP *.TIF *.TIFF *.GIF"),
                ("All files", "*.*"),
            ],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_gcode_output(default_name: str = "laser_job.nc") -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.asksaveasfilename(
            title="G-code çıktısı",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            initialfile=Path(str(default_name or "laser_job.nc")).name,
            defaultextension=".nc",
            filetypes=[("G-code / NC", "*.nc *.gcode"), ("All files", "*.*")],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_svg_output(default_name: str = "vectorized.svg") -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.asksaveasfilename(
            title="Temiz SVG çıktısı",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            initialfile=default_name,
            defaultextension=".svg",
            filetypes=[("SVG", "*.svg"), ("All files", "*.*")],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_project_output(default_name: str = "laser_job.laserjob.json") -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.asksaveasfilename(
            title="Lazer iş projesi kaydet",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            initialfile=default_name,
            defaultextension=".laserjob.json",
            filetypes=[("Lazer iş projesi", "*.laserjob.json"), ("JSON", "*.json"), ("All files", "*.*")],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_project_file() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.askopenfilename(
            title="Lazer iş projesi aç",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            filetypes=[("Lazer iş projesi", "*.laserjob.json"), ("JSON", "*.json"), ("All files", "*.*")],
        )
    finally:
        root.destroy()


def svg_as_vector_payload(path: Path) -> dict:
    image = core.image_payload(path)
    width = float(image.get("sourceWidth") or image.get("width") or 100)
    height = float(image.get("sourceHeight") or image.get("height") or 100)
    stats = image.get("vectorStats") or {}
    payload = {
        "kind": "vector",
        "sourcePath": str(path),
        "name": image.get("name") or f"{path.stem}.svg",
        "sourceWidth": width,
        "sourceHeight": height,
        "originalWidth": float(image.get("originalWidth") or image.get("width") or width),
        "originalHeight": float(image.get("originalHeight") or image.get("height") or height),
        "vectorPaths": image.get("vectorPaths") or [],
        "preview": {
            "name": image.get("name") or path.name,
            "width": float(image.get("width") or width),
            "height": float(image.get("height") or height),
            "dataUrl": image.get("dataUrl") or image.get("exportDataUrl") or "",
        },
        "debugPreviews": [],
        "settings": {"mode": "svg-direct"},
        "stats": {
            **stats,
            "traceEngine": "svg",
            "directSvgImport": True,
            "pathsTotal": len(image.get("vectorPaths") or []),
            "pathsKept": len([item for item in image.get("vectorPaths") or [] if not item.get("removed")]),
        },
    }
    return core.attach_vector_topology_payload(payload)


class LaserEditorHandler(BaseHTTPRequestHandler):
    server_version = "LaserEditor/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path.startswith("/?"):
            self._serve_file(STATIC_DIR / "index.html")
            return
        if self.path == "/api/health":
            self._json({"ok": True, "version": APP_VERSION})
            return
        if self.path == "/api/capabilities":
            self._json({"ok": True, "capabilities": device_capabilities()})
            return
        if self.path == "/api/diagnostics":
            self._json({"ok": True, "diagnostics": diagnostics_snapshot()})
            return
        if self.path == "/api/system-fonts":
            self._json({"ok": True, **system_font_catalog()})
            return
        if self.path.startswith("/static/"):
            relative = unquote(self.path[len("/static/") :].split("?", 1)[0])
            self._serve_file(STATIC_DIR / relative)
            return
        self._not_found()

    def do_POST(self) -> None:  # noqa: N802
        try:
            if self.path == "/api/open-dxf":
                self._open_dxf()
            elif self.path == "/api/load-dxf-paths":
                self._load_dxf_paths()
            elif self.path == "/api/open-image":
                self._open_image()
            elif self.path == "/api/open-raster-image":
                self._open_raster_image()
            elif self.path == "/api/vectorize-image":
                self._vectorize_image()
            elif self.path == "/api/classify-vector-regions":
                self._classify_vector_regions()
            elif self.path == "/api/analyze-vector-separation":
                self._analyze_vector_separation()
            elif self.path == "/api/save-vector-svg":
                self._save_vector_svg()
            elif self.path == "/api/save-project":
                payload = self._read_json()
                project = payload.get("project") or {}
                default_name = payload.get("defaultName") or project.get("name") or "laser_job.laserjob.json"
                output = payload.get("outputPath") or choose_project_output(default_name)
                if not output:
                    self._json({"ok": True, "saved": None})
                else:
                    path = Path(output)
                    project_meta = project.get("project")
                    if isinstance(project_meta, dict):
                        project_meta["path"] = str(path)
                        project_meta["name"] = path.name.removesuffix(".laserjob.json").removesuffix(".json")
                    atomic_write_text(path, json.dumps(project, ensure_ascii=False, indent=2))
                    self._json({"ok": True, "saved": {"outputPath": str(path)}})
            elif self.path == "/api/open-project":
                payload = self._read_json(optional=True)
                filename = payload.get("path") or choose_project_file()
                if not filename:
                    self._json({"ok": True, "project": None})
                else:
                    path = Path(filename)
                    project = json.loads(path.read_text(encoding="utf-8"))
                    self._json({"ok": True, "project": project, "path": str(path)})
            elif self.path == "/api/save-gcode-dialog":
                payload = self._read_json(optional=True)
                output = choose_gcode_output(payload.get("defaultName") or "laser_job.nc")
                self._json({"path": output})
            elif self.path == "/api/generate":
                state = self._read_json()
                validate_generate_output_choice(state)
                temporary_rasters = materialize_raster_pattern_data_urls(state)
                try:
                    result = core.generate_from_state(state)
                finally:
                    for path in temporary_rasters:
                        path.unlink(missing_ok=True)
                self._json({"ok": True, "result": result})
            elif self.path == "/api/convert-gcode-to-cut":
                payload = self._read_json()
                result = core.convert_gcode_engrave_vectors_to_cut(
                    Path(payload.get("path") or ""),
                    cut_power=int(float(payload.get("cutPower", 1000))),
                    cut_feed=float(payload.get("cutFeed", 500)),
                )
                self._json({"ok": True, "result": result})
            elif self.path == "/api/client/ping":
                payload = self._read_json(optional=True)
                record_client_ping(payload.get("clientId", "default"))
                self._json({"ok": True})
            elif self.path == "/api/client/close":
                payload = self._read_json(optional=True)
                record_client_close(payload.get("clientId", "default"))
                self._json({"ok": True, "shutdownGraceMs": int(CLIENT_CLOSE_GRACE_SECONDS * 1000)})
            elif self.path == "/api/machine/ports":
                self._json({"ok": True, **MACHINE.list_ports()})
            elif self.path == "/api/machine/connect":
                payload = self._read_json()
                self._json({"ok": True, "machine": MACHINE.connect(payload.get("port", ""), int(float(payload.get("baud", 115200))))})
            elif self.path == "/api/machine/disconnect":
                self._json({"ok": True, "machine": MACHINE.disconnect()})
            elif self.path == "/api/machine/status":
                payload = self._read_json(optional=True)
                snapshot = MACHINE.snapshot()
                if payload.get("query") and snapshot.get("connected"):
                    snapshot = MACHINE.query_status()
                self._json({"ok": True, "machine": snapshot})
            elif self.path == "/api/machine/control":
                payload = self._read_json()
                self._json({"ok": True, "machine": MACHINE.control(payload.get("action", ""))})
            elif self.path == "/api/machine/jog":
                payload = self._read_json()
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.jog(
                            payload.get("axis", "X"),
                            float(payload.get("distance", 0)),
                            float(payload.get("feed", 1200)),
                        ),
                    }
                )
            elif self.path == "/api/machine/command":
                payload = self._read_json()
                self._json({"ok": True, "machine": MACHINE.send_raw(payload.get("command", ""))})
            elif self.path == "/api/machine/send-gcode":
                payload = self._read_json()
                if payload.get("path"):
                    lines = laser_grbl.gcode_lines_from_file(payload.get("path"))
                elif payload.get("gcode"):
                    lines = str(payload.get("gcode")).splitlines()
                else:
                    lines = payload.get("lines") or []
                self._json({"ok": True, "machine": MACHINE.start_gcode(lines, confirmed=bool(payload.get("confirmed")))})
            elif self.path == "/api/machine/frame":
                payload = self._read_json()
                bounds = payload.get("bounds")
                if not bounds and payload.get("path"):
                    bounds = laser_grbl.gcode_bounds_from_file(payload.get("path"))
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.frame_bounds(
                            bounds or {},
                            feed=float(payload.get("feed", 3000)),
                            padding=float(payload.get("padding", 0)),
                            confirmed=bool(payload.get("confirmed")),
                        ),
                    }
                )
            elif self.path == "/api/machine/origin":
                payload = self._read_json()
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.set_work_origin(
                            clear=bool(payload.get("clear")),
                            confirmed=bool(payload.get("confirmed")),
                        ),
                    }
                )
            elif self.path == "/api/machine/gcode-info":
                payload = self._read_json()
                self._json({"ok": True, "info": gcode_file_info(payload.get("path") or "")})
            elif self.path == "/api/machine/override":
                payload = self._read_json()
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.override(
                            payload.get("kind", ""),
                            payload.get("action", ""),
                        ),
                    }
                )
            elif self.path == "/api/machine/focus-pulse":
                payload = self._read_json()
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.focus_pulse(
                            power=int(float(payload.get("power", 10))),
                            duration_ms=int(float(payload.get("durationMs", 80))),
                            confirmed=bool(payload.get("confirmed")),
                        ),
                    }
                )
            else:
                self._not_found()
        except Exception as exc:  # API boundary
            self._json({"ok": False, "error": str(exc)}, status=400)

    def _open_dxf(self) -> None:
        paths = choose_dxf_files()
        if not paths:
            self._json({"ok": True, "parts": []})
            return
        payload = self._read_json(optional=True)
        parts = self._load_parts(paths, payload)
        self._json({"ok": True, "parts": parts})

    def _load_dxf_paths(self) -> None:
        payload = self._read_json()
        paths = payload.get("paths") or []
        parts = self._load_parts(paths, payload)
        self._json({"ok": True, "parts": parts})

    def _load_parts(self, paths: list[str], payload: dict) -> list[dict]:
        tolerance = float(payload.get("tolerance", 0.25))
        join_tolerance = float(payload.get("joinTolerance", 0.05))
        inner_first = bool(payload.get("innerFirst", True))
        parts = []
        for index, filename in enumerate(paths):
            part = core.load_part(Path(filename), f"part_{int(time.time() * 1000)}_{index}", tolerance, join_tolerance, inner_first)
            parts.append(core.part_to_payload(part))
        return parts

    def _open_image(self) -> None:
        payload = self._read_json(optional=True)
        filename = payload.get("path") or choose_image_file()
        if not filename:
            self._json({"ok": True, "image": None})
            return
        self._json({"ok": True, "image": core.image_payload(Path(filename))})

    def _open_raster_image(self) -> None:
        payload = self._read_json(optional=True)
        filename = payload.get("path") or choose_raster_image_file()
        if not filename:
            self._json({"ok": True, "image": None})
            return
        path = Path(filename)
        if path.suffix.lower() == ".svg":
            raise ValueError("Foto gravur icin JPG/PNG gibi raster gorsel secin; SVG vektor desen olarak eklenmeli.")
        self._json({"ok": True, "image": core.image_payload(path)})

    def _vectorize_image(self) -> None:
        payload = self._read_json(optional=True)
        temp_paths: list[Path] = []
        try:
            if payload.get("dataUrl"):
                source_path = image_data_url_to_temp_file(str(payload.get("dataUrl")))
                temp_paths.append(source_path)
            else:
                filename = payload.get("path") or choose_raster_image_file()
                if not filename:
                    self._json({"ok": True, "vector": None})
                    return
                source_path = Path(filename)
            original_source_path = source_path
            if source_path.suffix.lower() == ".svg":
                if payload.get("cropNormalized"):
                    raise ValueError("Yerel yeniden isleme yalniz raster kaynakli vektorlerde kullanilabilir.")
                self._json({"ok": True, "vector": svg_as_vector_payload(source_path)})
                return
            crop_meta = None
            if payload.get("cropNormalized"):
                source_path, crop_meta = crop_raster_image_to_temp(
                    source_path,
                    payload.get("cropNormalized"),
                    padding_pixels=int(float(payload.get("cropPaddingPixels", 12))),
                )
                temp_paths.append(source_path)
            product_mode = str(payload.get("productMode") or payload.get("professionalMode") or "").lower().replace("-", "_")
            requested_mode = str(payload.get("mode", "auto"))
            if product_mode in {"cut_stencil", "cut_template"}:
                requested_mode = "auto"
            elif product_mode == "line_engrave":
                requested_mode = "centerline"
            elif product_mode == "cad_line_art":
                requested_mode = "cad_centerline"
            elif product_mode in {"filled_ornament", "fill_motif"}:
                requested_mode = "potrace"
            elif product_mode == "photo_engrave":
                raise ValueError("Foto gravur vektorlestirme degildir; foto modunda raster gravur hazirligi kullanin.")
            vector = core.vectorize_image(
                source_path,
                threshold=int(float(payload.get("threshold", 140))),
                threshold_mode=str(payload.get("thresholdMode", "manual")),
                mode=requested_mode,
                blur=int(float(payload.get("blur", 3))),
                min_area=float(payload.get("minArea", 40)),
                min_length=float(payload.get("minLength", 8)),
                simplify=float(payload.get("simplify", 0.8)),
                smooth=int(float(payload.get("smooth", 1))),
                invert=bool(payload.get("invert", True)),
                max_contours=int(float(payload.get("maxContours", 1200))),
                contrast=float(payload.get("contrast", 1.0)),
                morph_open=int(float(payload.get("morphOpen", 0))),
                morph_close=int(float(payload.get("morphClose", 0))),
                adaptive_block=int(float(payload.get("adaptiveBlock", 35))),
                adaptive_c=float(payload.get("adaptiveC", 5.0)),
                max_dimension=int(float(payload.get("maxDimension", 1800))),
                remove_border=bool(payload.get("removeBorder", True)),
                stitch_gap=float(payload.get("stitchGap", 0.0)),
                background_normalize=bool(payload.get("backgroundNormalize", True)),
                denoise=int(float(payload.get("denoise", 3))),
            )
            if product_mode:
                vector.setdefault("settings", {})["productMode"] = product_mode
                vector.setdefault("stats", {})["productMode"] = product_mode
            if product_mode == "cad_line_art":
                classification = core.classify_vector_region_boundaries(
                    vector.get("vectorPaths", []),
                    float(vector.get("sourceWidth", 1.0)),
                    float(vector.get("sourceHeight", 1.0)),
                    seeds=[],
                    include_exterior=True,
                )
                cut_ids = set(classification.get("cutPathIds", []))
                exterior_ids = set(classification.get("exteriorPathIds", []))
                for vector_path in vector.get("vectorPaths", []):
                    path_id = str(vector_path.get("id") or "")
                    vector_path["operation"] = "cut" if path_id in cut_ids else "engrave_line"
                    vector_path["regionOperation"] = "exterior" if path_id in exterior_ids else "inner"
                vector["cadLineArt"] = True
                vector["regionClassificationMode"] = "exterior-cut"
                vector["cutRegionSeeds"] = []
                vector["regionClassification"] = classification
                vector.setdefault("stats", {})["regionCutPaths"] = len(cut_ids)
                vector.setdefault("stats", {})["regionEngravePaths"] = max(0, len(vector.get("vectorPaths", [])) - len(cut_ids))
                core.refresh_vector_topology_operations(vector)
            if payload.get("name"):
                vector["name"] = str(payload.get("name"))
            if crop_meta:
                vector["crop"] = crop_meta
                vector["sourcePath"] = str(original_source_path)
            self._json({"ok": True, "vector": vector})
        finally:
            for temp_path in reversed(temp_paths):
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass

    def _classify_vector_regions(self) -> None:
        payload = self._read_json()
        result = core.classify_vector_region_boundaries(
            payload.get("vectorPaths", []),
            float(payload.get("sourceWidth", 1.0)),
            float(payload.get("sourceHeight", 1.0)),
            seeds=payload.get("seeds", []),
            include_exterior=bool(payload.get("includeExterior", True)),
            max_dimension=int(float(payload.get("maxDimension", 1600))),
        )
        self._json({"ok": True, "classification": result})

    def _analyze_vector_separation(self) -> None:
        payload = self._read_json()
        self._json({"ok": True, "separation": core.analyze_vector_separation(payload)})

    def _save_vector_svg(self) -> None:
        payload = self._read_json()
        default_name = payload.get("name") or "vectorized.svg"
        output = payload.get("outputPath") or choose_svg_output(default_name)
        if not output:
            self._json({"ok": True, "saved": None})
            return
        saved = core.write_vector_svg(
            Path(output),
            payload.get("vectorPaths", []),
            float(payload.get("sourceWidth", payload.get("width", 100))),
            float(payload.get("sourceHeight", payload.get("height", 100))),
            fill_mode=bool(payload.get("fillMode", False)),
            fill_invert=bool(payload.get("fillInvert", False)),
        )
        self._json({"ok": True, "saved": saved})

    def _read_json(self, optional: bool = False) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {} if optional else {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _serve_file(self, path: Path) -> None:
        try:
            resolved = path.resolve()
            if STATIC_DIR.resolve() not in resolved.parents and resolved != (STATIC_DIR / "index.html").resolve():
                self._not_found()
                return
            if not resolved.exists() or not resolved.is_file():
                self._not_found()
                return
            data = resolved.read_bytes()
            mime = mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
            self.send_response(200)
            self.send_header("Content-Type", f"{mime}; charset=utf-8" if mime.startswith("text/") else mime)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            self._not_found()

    def _json(self, payload: dict, status: int = 200) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _not_found(self) -> None:
        self._json({"ok": False, "error": "Not found"}, status=404)


def find_port(start: int = 8765) -> int:
    for port in range(start, start + 40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError("Bos port bulunamadi.")


def main() -> int:
    if not STATIC_DIR.exists():
        raise RuntimeError(f"Arayuz klasoru bulunamadi: {STATIC_DIR}")
    args = sys.argv[1:]
    no_open = "--no-open" in args
    port_args = [arg for arg in args if arg != "--no-open"]
    port = int(port_args[0]) if port_args else find_port()
    server = ThreadingHTTPServer(("127.0.0.1", port), LaserEditorHandler)
    url = f"http://127.0.0.1:{port}/"
    threading.Thread(target=monitor_client_shutdown, args=(server,), daemon=True).start()
    if not no_open:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    print(f"Lazer editor acildi: {url}")
    print("Tarayici sekmesi kapaninca sunucu otomatik kapanir. Elle kapatmak icin Ctrl+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatiliyor...")
    finally:
        try:
            MACHINE.disconnect()
        except Exception:
            pass
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
