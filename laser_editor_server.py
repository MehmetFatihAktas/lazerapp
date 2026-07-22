#!/usr/bin/env python3
"""Local server for the visual laser job editor."""

from __future__ import annotations

import json
import base64
import hashlib
import hmac
import math
import mimetypes
import os
import platform
import re
import secrets
import socket
import sys
import tempfile
import threading
import time
import traceback
import webbrowser
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import laser_grbl
import laser_editor_core as core
import dxf_to_laser_gcode as dxf_converter
from PIL import Image, ImageOps
try:
    from fontTools.ttLib import TTCollection, TTFont
except ImportError:  # pragma: no cover - source installs include fontTools
    TTCollection = None
    TTFont = None


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "laser_editor"
APP_DATA_DIR = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local")) / "LaserEditor"
LAST_DIRECTORY_FILE = APP_DATA_DIR / "last-directory.json"
RECENT_PROJECTS_FILE = APP_DATA_DIR / "recent-projects.json"
MACHINE_PROFILE_FILE = APP_DATA_DIR / "machine-profile.json"
OFFLINE_DEFAULT_MACHINE_PROFILE = {
    "id": "offline-grbl-s1000-400",
    "name": "Çevrimdışı GRBL S1000 / 400×400",
    "maxS": 1000,
    "travelX": 400,
    "travelY": 400,
    # These values only plan conservative fill motion. They are never written
    # to the controller; connected-machine preflight still compares real GRBL settings.
    "stepsX": 80,
    "stepsY": 80,
    "maxRateX": 6000,
    "maxRateY": 6000,
    "accelerationX": 200,
    "accelerationY": 200,
    "accelerationValidated": False,
    "laserOnDelayMs": 0,
    "laserOffDelayMs": 0,
    "requiresLaserMode": True,
    "airAssist": {"supported": False, "onCommand": "M8", "offCommand": "M9"},
    "focus": {
        "normalMaxPercent": 3,
        "normalMaxMs": 100,
        "expertMaxPercent": 5,
        "expertMaxMs": 250,
    },
    "verified": True,
    "verifiedAt": "2026-07-19T00:00:00Z",
    "source": "offline-production-default",
}
DEFAULT_DIR = Path.home() / "Documents"
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
APP_VERSION = "2026.07.17"
API_TOKEN_HEADER = "X-LaserApp-Token"
API_DEFAULT_BODY_LIMIT = 2 * 1024 * 1024
API_LARGE_BODY_LIMIT = 24 * 1024 * 1024
FILE_HANDLE_MAX_AGE_SECONDS = 8 * 60 * 60
LARGE_BODY_ENDPOINTS = {
    "/api/generate",
    "/api/preflight",
    "/api/open-project",
    "/api/save-project",
    "/api/vectorize-image",
    "/api/open-raster-image",
    "/api/save-vector-svg",
}


class ApiRequestError(RuntimeError):
    def __init__(self, status: int, message: str, code: str):
        super().__init__(message)
        self.status = int(status)
        self.code = str(code)


@dataclass
class FileGrant:
    handle: str
    path: Path
    scopes: frozenset[str]
    expires_at: float
    single_use: bool = False
    consumed: bool = False
    metadata: dict = field(default_factory=dict)


class FileGrantRegistry:
    """Server-lifetime, opaque file permissions returned by native dialogs."""

    def __init__(self, max_age_seconds: float = FILE_HANDLE_MAX_AGE_SECONDS):
        self.max_age_seconds = min(FILE_HANDLE_MAX_AGE_SECONDS, max(60.0, float(max_age_seconds)))
        self._grants: dict[str, FileGrant] = {}
        self._lock = threading.RLock()

    def issue(
        self,
        path: str | Path,
        scopes: set[str] | frozenset[str] | tuple[str, ...] | list[str],
        *,
        single_use: bool = False,
        metadata: dict | None = None,
    ) -> str:
        resolved = Path(path).expanduser().resolve()
        handle = secrets.token_urlsafe(32)
        grant = FileGrant(
            handle=handle,
            path=resolved,
            scopes=frozenset(str(scope) for scope in scopes),
            expires_at=time.monotonic() + self.max_age_seconds,
            single_use=bool(single_use),
            metadata=dict(metadata or {}),
        )
        with self._lock:
            self._purge_expired_locked()
            self._grants[handle] = grant
        return handle

    def resolve(self, handle: str, scope: str, *, consume: bool = False) -> Path:
        key = str(handle or "").strip()
        if not key:
            raise ApiRequestError(403, "Dosya yetkisi eksik. Dosyayi yeniden secin.", "file_handle_missing")
        with self._lock:
            self._purge_expired_locked()
            grant = self._grants.get(key)
            if grant is None or grant.consumed:
                raise ApiRequestError(403, "Dosya yetkisi gecersiz veya suresi dolmus.", "file_handle_invalid")
            if str(scope) not in grant.scopes:
                raise ApiRequestError(403, "Dosya yetkisi bu islem icin uygun degil.", "file_handle_scope")
            if consume:
                if not grant.single_use:
                    raise ApiRequestError(403, "Yazma yetkisi tek kullanimlik degil.", "file_handle_not_single_use")
                grant.consumed = True
            return grant.path

    def describe(self, handle: str) -> dict | None:
        with self._lock:
            self._purge_expired_locked()
            grant = self._grants.get(str(handle or ""))
            if grant is None or grant.consumed:
                return None
            return {
                "handle": grant.handle,
                "displayPath": str(grant.path),
                "name": grant.path.name,
                "scopes": sorted(grant.scopes),
                "singleUse": grant.single_use,
                "metadata": dict(grant.metadata),
            }

    def metadata(self, handle: str, scope: str) -> dict:
        key = str(handle or "").strip()
        with self._lock:
            self._purge_expired_locked()
            grant = self._grants.get(key)
            if grant is None or grant.consumed or scope not in grant.scopes:
                raise ApiRequestError(403, "Dosya artifact yetkisi gecersiz.", "file_handle_invalid")
            return dict(grant.metadata)

    def _purge_expired_locked(self) -> None:
        now = time.monotonic()
        for handle, grant in list(self._grants.items()):
            if grant.expires_at <= now or grant.consumed:
                self._grants.pop(handle, None)


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


def source_fingerprint(path_value: str | Path, *, units: dict | None = None) -> dict:
    path = Path(path_value)
    stat = path.stat()
    return {
        "sha256": file_sha256(path),
        "size": int(stat.st_size),
        "modifiedAt": float(stat.st_mtime),
        "units": dict(units or {}),
        "geometrySnapshotVersion": 1,
    }


def dxf_unit_choice_payload(sources: list[tuple[Path, str]], payload: dict) -> dict:
    tolerance = float(payload.get("tolerance", 0.25))
    join_tolerance = float(payload.get("joinTolerance", 0.05))
    files: list[dict] = []
    for path, handle in sources:
        if dxf_converter.dxf_unit_info(path).get("scaleToMm") is not None:
            continue
        raw_paths, _unsupported, _count = dxf_converter.convert_dxf_paths(
            path,
            tolerance,
            join_tolerance,
            unit_override="mm",
        )
        min_x, min_y, max_x, max_y = core.paths_bounds(raw_paths)
        raw_width = max_x - min_x
        raw_height = max_y - min_y
        files.append(
            {
                "name": path.name,
                "sourceHandle": handle,
                "candidates": [
                    {"unit": "mm", "width": raw_width, "height": raw_height},
                    {"unit": "cm", "width": raw_width * 10.0, "height": raw_height * 10.0},
                    {"unit": "inch", "width": raw_width * 25.4, "height": raw_height * 25.4},
                ],
            }
        )
    return {
        "requiresUnitChoice": True,
        "sourceHandles": [handle for _path, handle in sources],
        "unitChoices": ["mm", "cm", "inch"],
        "files": files,
    }


def validate_expert_grbl_command(command: str, *, expert: bool, setting_confirmed: bool) -> str:
    normalized = " ".join(str(command or "").strip().split())
    if not expert:
        raise ApiRequestError(403, "Ham GRBL alani yalniz Uzman modunda kullanilabilir.", "expert_mode_required")
    if normalized.upper() in {"$$", "$I", "$G", "$#", "$N"}:
        return normalized.upper()
    if re.fullmatch(r"\$\d+\s*=\s*-?\d+(?:\.\d+)?", normalized):
        if not setting_confirmed:
            raise ApiRequestError(403, "GRBL ayar degisikligi icin ayri onay gerekli.", "setting_confirmation_required")
        return normalized
    raise ApiRequestError(
        403,
        "Yalniz tanilama komutlari veya ayri onayli $n=value ayarlari kabul edilir.",
        "raw_command_rejected",
    )


def authoritative_preflight(
    state: dict,
    file_grants: FileGrantRegistry,
    *,
    require_machine: bool = False,
) -> dict:
    result = core.preflight_state(
        state,
        machine_snapshot=MACHINE.snapshot() if require_machine else None,
        require_machine=require_machine,
    ).to_payload()
    blockers = list(result.get("blockers") or [])
    warnings = list(result.get("warnings") or [])
    for part in state.get("parts") or []:
        if not part.get("paths"):
            blockers.append(
                {
                    "code": "embedded_geometry_missing",
                    "message": f"DXF gomulu geometrisi eksik: {part.get('name') or part.get('id')}.",
                    "itemType": "part",
                    "itemId": str(part.get("id") or ""),
                }
            )
    for pattern in state.get("patterns") or []:
        operation = core.normalize_operation(pattern.get("operation"), "engrave_line")
        if operation == "ignore":
            continue
        kind = str(pattern.get("kind") or "").lower()
        if kind == "raster":
            data_url = str(pattern.get("dataUrl") or "")
            if not data_url.startswith("data:image/"):
                blockers.append(
                    {
                        "code": "embedded_raster_missing",
                        "message": f"Raster kazima kaynagi projeye gomulu degil: {pattern.get('name') or pattern.get('id')}.",
                        "itemType": "pattern",
                        "itemId": str(pattern.get("id") or ""),
                    }
                )
        elif kind in {"svg", "vector"} and not (
            pattern.get("vectorPaths") or core._int(pattern.get("vectorModelVersion"), 0) == 2
        ):
            blockers.append(
                {
                    "code": "embedded_geometry_missing",
                    "message": f"Vektor gomulu geometrisi eksik: {pattern.get('name') or pattern.get('id')}.",
                    "itemType": "pattern",
                    "itemId": str(pattern.get("id") or ""),
                }
            )
    for item_type, collection, scope in (
        ("part", state.get("parts") or [], "dxf:read"),
        ("pattern", state.get("patterns") or [], "image:read"),
    ):
        for item in collection:
            expected = item.get("sourceFingerprint")
            handle = str(item.get("sourceHandle") or "")
            if not isinstance(expected, dict):
                continue
            if not handle:
                if str(item.get("sourceResolution") or "") == "snapshot":
                    warnings.append(
                        {
                            "code": "source_snapshot_only",
                            "message": f"Kullanici kayitli geometriyi secti: {item.get('name') or item.get('id')}.",
                            "itemType": item_type,
                            "itemId": str(item.get("id") or ""),
                        }
                    )
                else:
                    blockers.append(
                        {
                            "code": "source_reauthorization_required",
                            "message": f"Kaynak dosya yeniden yetkilendirilmeli veya kayitli geometri acikca secilmeli: {item.get('name') or item.get('id')}.",
                            "itemType": item_type,
                            "itemId": str(item.get("id") or ""),
                        }
                    )
                continue
            try:
                path = file_grants.resolve(handle, scope)
                actual = source_fingerprint(path, units=expected.get("units") or {})
            except (ApiRequestError, OSError):
                blockers.append(
                    {
                        "code": "source_authorization_invalid",
                        "message": f"Kaynak dosya yetkisi gecersiz: {item.get('name') or item.get('id')}.",
                        "itemType": item_type,
                        "itemId": str(item.get("id") or ""),
                    }
                )
                continue
            if (
                str(actual.get("sha256") or "") != str(expected.get("sha256") or "")
                or int(actual.get("size") or 0) != int(expected.get("size") or 0)
                or abs(float(actual.get("modifiedAt") or 0) - float(expected.get("modifiedAt") or 0)) > 1e-6
            ):
                blockers.append(
                    {
                        "code": "source_fingerprint_mismatch",
                        "message": f"Kaynak dosya proje anlik goruntusunden farkli: {item.get('name') or item.get('id')}.",
                        "itemType": item_type,
                        "itemId": str(item.get("id") or ""),
                        "expected": expected,
                        "actual": actual,
                    }
                )
    result["blockers"] = blockers
    result["warnings"] = warnings
    result["status"] = "blocked" if blockers else "ready"
    return result


def sanitize_project_for_storage(project: dict) -> dict:
    sanitized = json.loads(json.dumps(project, ensure_ascii=False))
    sanitized["outputPath"] = ""
    for collection_name in ("parts", "patterns"):
        for item in sanitized.get(collection_name) or []:
            item.pop("sourceHandle", None)
            item.pop("sourcePath", None)
            item.pop("originalPath", None)
            item["path"] = str(item.get("name") or item.get("id") or "embedded")
    return sanitized


def sanitize_embedded_production_paths(state: dict) -> None:
    for part in state.get("parts") or []:
        part["path"] = str(part.get("name") or part.get("id") or "embedded.dxf")
        part.pop("sourcePath", None)
        part.pop("originalPath", None)
    for pattern in state.get("patterns") or []:
        if str(pattern.get("kind") or "").lower() == "raster" and str(pattern.get("dataUrl") or "").startswith("data:image/"):
            continue
        pattern["path"] = str(pattern.get("name") or pattern.get("id") or "embedded.svg")
        pattern.pop("sourcePath", None)
        pattern.pop("originalPath", None)


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


def validate_gcode_path(path: Path, machine_profile: dict) -> dict:
    return laser_grbl.validate_gcode_for_machine(
        laser_grbl.gcode_raw_lines_from_file(path),
        max_s=machine_profile["maxS"],
        travel_x=machine_profile["travelX"],
        travel_y=machine_profile["travelY"],
    )


def safe_gcode_copy_content(path: Path, machine_profile: dict) -> tuple[str, dict]:
    lines = laser_grbl.gcode_raw_lines_from_file(path)
    validation = laser_grbl.validate_gcode_for_machine(
        lines,
        max_s=machine_profile["maxS"],
        travel_x=machine_profile["travelX"],
        travel_y=machine_profile["travelY"],
    )
    non_closure_blockers = [
        blocker
        for blocker in validation.get("blockers") or []
        if blocker.get("code") != "gcode_final_laser_off"
    ]
    if non_closure_blockers:
        first = non_closure_blockers[0]
        raise ApiRequestError(
            409,
            f"Guvenli kopya yalniz M5/S0 kapanisini ekleyebilir [{first['code']}]: {first['message']}",
            "safe_copy_modal_blocked",
        )
    content = "\n".join(line.rstrip() for line in lines).rstrip()
    content = f"{content}\nM5\nS0\n" if content else "M5\nS0\n"
    copied_validation = laser_grbl.validate_gcode_for_machine(
        content.splitlines(),
        max_s=machine_profile["maxS"],
        travel_x=machine_profile["travelX"],
        travel_y=machine_profile["travelY"],
    )
    if copied_validation.get("blockers"):
        first = copied_validation["blockers"][0]
        raise ApiRequestError(
            409,
            f"Guvenli kopya dogrulanamadi [{first['code']}]: {first['message']}",
            "safe_copy_invalid",
        )
    return content, copied_validation


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{time.time_ns()}.tmp")
    try:
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


MACHINE_PROFILE_MOTION_FIELDS = (
    "stepsX",
    "stepsY",
    "maxRateX",
    "maxRateY",
    "accelerationX",
    "accelerationY",
)


def normalized_persistent_machine_profile(profile: dict) -> dict:
    try:
        normalized = core.validated_machine_profile({"machineProfile": profile})
    except (TypeError, ValueError) as exc:
        raise ApiRequestError(422, str(exc), "machine_profile_invalid") from exc
    missing = [field for field in MACHINE_PROFILE_MOTION_FIELDS if normalized.get(field) is None]
    if missing:
        raise ApiRequestError(
            422,
            "Kalici profil icin GRBL $100/$101/$110/$111/$120/$121 degerlerinin tamami gerekli.",
            "machine_profile_motion_incomplete",
        )
    air_assist = normalized.get("airAssist") if isinstance(normalized.get("airAssist"), dict) else {}
    focus = normalized.get("focus") if isinstance(normalized.get("focus"), dict) else {}
    return {
        "id": str(normalized.get("id") or "grbl-machine"),
        "name": str(normalized.get("name") or "GRBL Makinesi"),
        "maxS": float(normalized["maxS"]),
        "travelX": float(normalized["travelX"]),
        "travelY": float(normalized["travelY"]),
        **{field: float(normalized[field]) for field in MACHINE_PROFILE_MOTION_FIELDS},
        "accelerationValidated": bool(normalized.get("accelerationValidated")),
        "laserOnDelayMs": max(0.0, float(normalized.get("laserOnDelayMs") or 0.0)),
        "laserOffDelayMs": max(0.0, float(normalized.get("laserOffDelayMs") or 0.0)),
        "requiresLaserMode": normalized.get("requiresLaserMode") is not False,
        "airAssist": {
            "supported": bool(air_assist.get("supported")),
            "onCommand": str(air_assist.get("onCommand") or "M8"),
            "offCommand": "M9",
        },
        "focus": {
            "normalMaxPercent": float(focus.get("normalMaxPercent") or 3.0),
            "normalMaxMs": int(focus.get("normalMaxMs") or 100),
            "expertMaxPercent": float(focus.get("expertMaxPercent") or 5.0),
            "expertMaxMs": int(focus.get("expertMaxMs") or 250),
        },
        "verified": True,
        "verifiedAt": str(normalized.get("verifiedAt") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        "source": str(normalized.get("source") or "persistent-default"),
    }


def load_default_machine_profile() -> dict | None:
    try:
        payload = json.loads(MACHINE_PROFILE_FILE.read_text(encoding="utf-8"))
        return normalized_persistent_machine_profile(payload if isinstance(payload, dict) else {})
    except (OSError, ValueError, TypeError, json.JSONDecodeError, ApiRequestError):
        return normalized_persistent_machine_profile(OFFLINE_DEFAULT_MACHINE_PROFILE)


def save_default_machine_profile(profile: dict) -> dict:
    normalized = normalized_persistent_machine_profile(profile if isinstance(profile, dict) else {})
    atomic_write_text(MACHINE_PROFILE_FILE, json.dumps(normalized, ensure_ascii=False, indent=2))
    return normalized


def recent_project_id(path_value: str | Path) -> str:
    normalized = os.path.normcase(str(Path(path_value).expanduser().resolve()))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]


def load_recent_projects() -> list[dict]:
    try:
        raw = json.loads(RECENT_PROJECTS_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return []
    result: list[dict] = []
    for item in raw if isinstance(raw, list) else []:
        try:
            path = Path(str(item.get("path") or "")).expanduser().resolve()
        except (OSError, RuntimeError):
            continue
        if not path.is_file():
            continue
        stat = path.stat()
        result.append(
            {
                "id": recent_project_id(path),
                "name": str(item.get("name") or path.name.removesuffix(".laserjob.json").removesuffix(".json")),
                "path": str(path),
                "displayPath": str(path),
                "openedAt": str(item.get("openedAt") or ""),
                "modifiedAt": stat.st_mtime,
            }
        )
    return result[:30]


def save_recent_projects(items: list[dict]) -> None:
    serialized = [
        {
            "id": str(item.get("id") or recent_project_id(item["path"])),
            "name": str(item.get("name") or Path(item["path"]).stem),
            "path": str(Path(item["path"]).expanduser().resolve()),
            "openedAt": str(item.get("openedAt") or ""),
        }
        for item in items[:30]
        if item.get("path")
    ]
    atomic_write_text(RECENT_PROJECTS_FILE, json.dumps(serialized, ensure_ascii=False, indent=2))


def remember_recent_project(path_value: str | Path, name: str = "") -> dict:
    path = Path(path_value).expanduser().resolve()
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    item = {
        "id": recent_project_id(path),
        "name": str(name or path.name.removesuffix(".laserjob.json").removesuffix(".json")),
        "path": str(path),
        "displayPath": str(path),
        "openedAt": now,
        "modifiedAt": path.stat().st_mtime if path.exists() else 0.0,
    }
    existing = [entry for entry in load_recent_projects() if entry.get("id") != item["id"]]
    save_recent_projects([item, *existing])
    return item


def public_recent_projects() -> list[dict]:
    return [
        {
            "id": item["id"],
            "name": item["name"],
            "displayPath": item["displayPath"],
            "openedAt": item.get("openedAt") or "",
            "modifiedAt": item.get("modifiedAt") or 0.0,
        }
        for item in load_recent_projects()
    ]


def resolve_recent_project(recent_id: str) -> Path:
    key = str(recent_id or "").strip()
    for item in load_recent_projects():
        if hmac.compare_digest(str(item.get("id") or ""), key):
            return Path(item["path"]).resolve()
    raise ApiRequestError(404, "Son proje kaydi bulunamadi; dosyayi yeniden yetkilendirin.", "recent_project_missing")


def dialog_initial_directory() -> Path:
    try:
        stored = json.loads(LAST_DIRECTORY_FILE.read_text(encoding="utf-8"))
        candidate = Path(str(stored.get("path") or "")).expanduser()
        if candidate.is_dir():
            return candidate
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        pass
    if DEFAULT_DIR.is_dir():
        return DEFAULT_DIR
    return Path.home()


def remember_dialog_directory(path_value: str | Path) -> None:
    path = Path(path_value).expanduser()
    directory = path if path.is_dir() else path.parent
    if not directory.is_dir():
        return
    try:
        APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        atomic_write_text(LAST_DIRECTORY_FILE, json.dumps({"path": str(directory.resolve())}, ensure_ascii=False))
    except OSError:
        pass


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
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
            initialfile=Path(str(default_name or "laser_job.nc")).name,
            defaultextension=".nc",
            filetypes=[("G-code / NC", "*.nc *.gcode"), ("All files", "*.*")],
        )
    finally:
        root.destroy()


@locked_dialog
def choose_gcode_file() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.askopenfilename(
            title="Harici G-code dosyasi sec",
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
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
            initialdir=str(dialog_initial_directory()),
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
        "physicalSize": image.get("physicalSize") or {},
        "requiresPhysicalSizeConfirmation": bool(image.get("requiresPhysicalSizeConfirmation")),
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


class LaserEditorHttpServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, server_address, handler_class):
        super().__init__(server_address, handler_class)
        host, port = self.server_address[:2]
        public_host = "127.0.0.1" if host in {"", "0.0.0.0"} else str(host)
        self.api_token = secrets.token_urlsafe(32)
        self.expected_host = f"{public_host}:{port}"
        self.expected_origin = f"http://{self.expected_host}"
        self.file_grants = FileGrantRegistry()


class LaserEditorHandler(BaseHTTPRequestHandler):
    server_version = "LaserEditor/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    @property
    def file_grants(self) -> FileGrantRegistry:
        return getattr(self.server, "file_grants")

    def _issue_file_handle(
        self,
        path: str | Path,
        scopes: set[str] | tuple[str, ...] | list[str],
        *,
        single_use: bool = False,
        metadata: dict | None = None,
    ) -> str:
        remember_dialog_directory(path)
        return self.file_grants.issue(path, scopes, single_use=single_use, metadata=metadata)

    def _resolve_file_handle(self, payload: dict, key: str, scope: str, *, consume: bool = False) -> Path:
        return self.file_grants.resolve(str(payload.get(key) or ""), scope, consume=consume)

    @staticmethod
    def _reject_raw_paths(payload: dict, *keys: str) -> None:
        if any(str(payload.get(key) or "").strip() for key in keys):
            raise ApiRequestError(
                403,
                "Tarayicidan dosya yolu kabul edilmez. Dosyayi yerel secim penceresiyle yeniden yetkilendirin.",
                "raw_path_rejected",
            )

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path.startswith("/?"):
            self._serve_index()
            return
        if self.path.startswith("/api/"):
            try:
                self._require_api_access()
            except ApiRequestError as exc:
                self._json({"ok": False, "error": str(exc), "code": exc.code}, status=exc.status)
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
        if self.path == "/api/recent-projects":
            self._json({"ok": True, "projects": public_recent_projects()})
            return
        if self.path == "/api/machine-profile":
            self._json({"ok": True, "machineProfile": load_default_machine_profile()})
            return
        if self.path.startswith("/static/"):
            relative = unquote(self.path[len("/static/") :].split("?", 1)[0])
            self._serve_file(STATIC_DIR / relative)
            return
        self._not_found()

    def do_POST(self) -> None:  # noqa: N802
        request_id = secrets.token_hex(8)
        self._request_id = request_id
        try:
            self._require_api_access()
            self._require_json_request()
            if self.path == "/api/machine-profile":
                payload = self._read_json()
                profile = save_default_machine_profile(payload.get("machineProfile") or {})
                self._json({"ok": True, "machineProfile": profile})
            elif self.path == "/api/open-dxf":
                self._open_dxf()
            elif self.path == "/api/load-dxf-paths":
                self._load_dxf_paths()
            elif self.path == "/api/reauthorize-source":
                self._reauthorize_source()
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
                self._reject_raw_paths(payload, "outputPath")
                project = sanitize_project_for_storage(payload.get("project") or {})
                default_name = payload.get("defaultName") or project.get("name") or "laser_job.laserjob.json"
                if payload.get("outputHandle"):
                    path = self._resolve_file_handle(payload, "outputHandle", "project:write", consume=True)
                else:
                    output = choose_project_output(default_name)
                    path = Path(output).resolve() if output else None
                if path is None:
                    self._json({"ok": True, "saved": None})
                else:
                    project_meta = project.get("project")
                    if isinstance(project_meta, dict):
                        project_meta["path"] = str(path)
                        project_meta["name"] = path.name.removesuffix(".laserjob.json").removesuffix(".json")
                    atomic_write_text(path, json.dumps(project, ensure_ascii=False, indent=2))
                    remember_recent_project(path, str(project.get("name") or ""))
                    read_handle = self._issue_file_handle(path, {"project:read"})
                    next_write_handle = self._issue_file_handle(path, {"project:write"}, single_use=True)
                    self._json(
                        {
                            "ok": True,
                            "saved": {
                                "displayPath": str(path),
                                "projectHandle": read_handle,
                                "outputHandle": next_write_handle,
                            },
                        }
                    )
            elif self.path == "/api/open-project":
                payload = self._read_json(optional=True)
                self._reject_raw_paths(payload, "path")
                if payload.get("projectHandle"):
                    path = self._resolve_file_handle(payload, "projectHandle", "project:read")
                else:
                    filename = choose_project_file()
                    path = Path(filename).resolve() if filename else None
                if path is None:
                    self._json({"ok": True, "project": None})
                else:
                    project = json.loads(path.read_text(encoding="utf-8"))
                    remember_recent_project(path, str(project.get("name") or ""))
                    read_handle = self._issue_file_handle(path, {"project:read"})
                    self._json(
                        {
                            "ok": True,
                            "project": project,
                            "displayPath": str(path),
                            "projectHandle": read_handle,
                            "requiresWriteAuthorization": True,
                        }
                    )
            elif self.path == "/api/open-recent-project":
                payload = self._read_json()
                self._reject_raw_paths(payload, "path")
                path = resolve_recent_project(payload.get("recentId", ""))
                project = json.loads(path.read_text(encoding="utf-8"))
                remember_recent_project(path, str(project.get("name") or ""))
                read_handle = self._issue_file_handle(path, {"project:read"})
                self._json(
                    {
                        "ok": True,
                        "project": project,
                        "displayPath": str(path),
                        "projectHandle": read_handle,
                        "requiresWriteAuthorization": True,
                    }
                )
            elif self.path == "/api/clear-recent-projects":
                self._read_json(optional=True)
                save_recent_projects([])
                self._json({"ok": True, "projects": []})
            elif self.path == "/api/save-gcode-dialog":
                payload = self._read_json(optional=True)
                output = choose_gcode_output(payload.get("defaultName") or "laser_job.nc")
                if not output:
                    self._json({"ok": True, "outputHandle": "", "displayPath": ""})
                else:
                    output_handle = self._issue_file_handle(output, {"gcode:write"}, single_use=True)
                    self._json({"ok": True, "outputHandle": output_handle, "displayPath": str(Path(output).resolve())})
            elif self.path == "/api/open-gcode":
                payload = self._read_json()
                machine_profile = core.validated_machine_profile({"machineProfile": payload.get("machineProfile")})
                filename = choose_gcode_file()
                if not filename:
                    self._json({"ok": True, "gcode": None})
                else:
                    path = Path(filename).resolve()
                    source_handle = self._issue_file_handle(path, {"gcode:source"})
                    validation = validate_gcode_path(path, machine_profile)
                    file_info = gcode_file_info(path)
                    file_hash = file_info["fileHash"]
                    input_hash = f"external:{file_hash}"
                    source_revision = max(0, int(payload.get("sourceRevision") or 0))
                    artifact_handle = ""
                    if not validation.get("blockers"):
                        artifact_handle = self._issue_file_handle(
                            path,
                            {"gcode:read"},
                            metadata={
                                "fileHash": file_hash,
                                "machineProfileId": machine_profile["id"],
                                "maxS": machine_profile["maxS"],
                                "sourceRevision": source_revision,
                                "inputHash": input_hash,
                                "external": True,
                            },
                        )
                    blocker_codes = {str(item.get("code") or "") for item in validation.get("blockers") or []}
                    self._json(
                        {
                            "ok": True,
                            "gcode": {
                                "displayPath": str(path),
                                "sourceHandle": source_handle,
                                "artifactHandle": artifact_handle,
                                "fileHash": file_hash,
                                "inputHash": input_hash,
                                "sourceRevision": source_revision,
                                "analysis": validation,
                                "safeCopyAvailable": bool(blocker_codes) and blocker_codes == {"gcode_final_laser_off"},
                            },
                        }
                    )
            elif self.path == "/api/create-safe-gcode-copy":
                payload = self._read_json()
                self._reject_raw_paths(payload, "path", "outputPath")
                source_path = self._resolve_file_handle(payload, "sourceHandle", "gcode:source")
                output_path = self._resolve_file_handle(payload, "outputHandle", "gcode:write", consume=True)
                if source_path == output_path:
                    raise ApiRequestError(
                        409,
                        "Guvenli kopya ozgun dosyanin uzerine yazilamaz; yeni bir dosya secin.",
                        "safe_copy_same_file",
                    )
                machine_profile = core.validated_machine_profile({"machineProfile": payload.get("machineProfile")})
                content, validation = safe_gcode_copy_content(source_path, machine_profile)
                atomic_write_text(output_path, content)
                file_hash = file_sha256(output_path)
                input_hash = f"external:{file_hash}"
                source_revision = max(0, int(payload.get("sourceRevision") or 0))
                artifact_handle = self._issue_file_handle(
                    output_path,
                    {"gcode:read"},
                    metadata={
                        "fileHash": file_hash,
                        "machineProfileId": machine_profile["id"],
                        "maxS": machine_profile["maxS"],
                        "sourceRevision": source_revision,
                        "inputHash": input_hash,
                        "external": True,
                    },
                )
                self._json(
                    {
                        "ok": True,
                        "result": {
                            "displayPath": str(output_path),
                            "artifactHandle": artifact_handle,
                            "fileHash": file_hash,
                            "inputHash": input_hash,
                            "sourceRevision": source_revision,
                            "analysis": validation,
                        },
                    }
                )
            elif self.path == "/api/preflight":
                state = self._read_json()
                result = authoritative_preflight(
                    state,
                    self.file_grants,
                    require_machine=bool(state.get("requireMachine")),
                )
                self._json({"ok": True, "preflight": result})
            elif self.path == "/api/generate":
                state = self._read_json()
                self._reject_raw_paths(state, "outputPath")
                preflight = authoritative_preflight(state, self.file_grants)
                if preflight["status"] != "ready":
                    first = preflight["blockers"][0]
                    raise ApiRequestError(
                        409,
                        f"Uretim on kontrolu basarisiz [{first['code']}]: {first['message']}",
                        "preflight_blocked",
                    )
                output_path = self._resolve_file_handle(state, "outputHandle", "gcode:write", consume=True)
                state["outputPath"] = str(output_path)
                validate_generate_output_choice(state)
                sanitize_embedded_production_paths(state)
                temporary_rasters = materialize_raster_pattern_data_urls(state)
                try:
                    result = core.generate_from_state(state)
                finally:
                    for path in temporary_rasters:
                        path.unlink(missing_ok=True)
                profile = core.validated_machine_profile(state)
                generated_analysis = laser_grbl.validate_gcode_for_machine(
                    laser_grbl.gcode_raw_lines_from_file(output_path),
                    max_s=profile["maxS"],
                    travel_x=profile["travelX"],
                    travel_y=profile["travelY"],
                )
                if generated_analysis["blockers"]:
                    output_path.unlink(missing_ok=True)
                    first = generated_analysis["blockers"][0]
                    raise ApiRequestError(
                        409,
                        f"Uretilen G-code guvenli degil [{first['code']}]: {first['message']}",
                        "generated_gcode_unsafe",
                    )
                file_info = gcode_file_info(output_path)
                artifact_handle = self._issue_file_handle(
                    output_path,
                    {"gcode:read"},
                    metadata={
                        "fileHash": file_info["fileHash"],
                        "machineProfileId": str((state.get("machineProfile") or {}).get("id") or ""),
                        "maxS": float((state.get("machineProfile") or {}).get("maxS") or 0),
                        "sourceRevision": int((state.get("project") or {}).get("revision") or 0),
                        "inputHash": preflight["inputHash"],
                    },
                )
                result.update(
                    {
                        "outputPath": str(output_path),
                        "displayPath": str(output_path),
                        "artifactHandle": artifact_handle,
                        "fileHash": file_info["fileHash"],
                        "inputHash": preflight["inputHash"],
                        "sourceRevision": preflight["revision"],
                    }
                )
                self._json({"ok": True, "result": result})
            elif self.path == "/api/convert-gcode-to-cut":
                payload = self._read_json()
                self._reject_raw_paths(payload, "path", "outputPath")
                input_path = self._resolve_file_handle(payload, "artifactHandle", "gcode:read")
                output_path = self._resolve_file_handle(payload, "outputHandle", "gcode:write", consume=True)
                machine_profile = core.validated_machine_profile({"machineProfile": payload.get("machineProfile")})
                cut_power = core.power_percent_to_s(payload.get("cutPower", 100), machine_profile["maxS"], 100)
                result = core.convert_gcode_engrave_vectors_to_cut(
                    input_path,
                    cut_power=cut_power,
                    cut_feed=float(payload.get("cutFeed", 500)),
                    output_path=output_path,
                )
                result_path = Path(result["outputPath"])
                validation = validate_gcode_path(result_path, machine_profile)
                if validation.get("blockers"):
                    result_path.unlink(missing_ok=True)
                    first = validation["blockers"][0]
                    raise ApiRequestError(
                        409,
                        f"Kesime cevrilen G-code guvenli degil [{first['code']}]: {first['message']}",
                        "converted_gcode_unsafe",
                    )
                result["displayPath"] = str(result_path)
                result["fileHash"] = file_sha256(result_path)
                result["inputHash"] = str(payload.get("inputHash") or "")
                result["sourceRevision"] = max(0, int(payload.get("sourceRevision") or 0))
                result["artifactHandle"] = self._issue_file_handle(
                    result_path,
                    {"gcode:read"},
                    metadata={
                        "fileHash": result["fileHash"],
                        "machineProfileId": machine_profile["id"],
                        "maxS": machine_profile["maxS"],
                        "sourceRevision": result["sourceRevision"],
                        "inputHash": result["inputHash"],
                    },
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
                command = validate_expert_grbl_command(
                    payload.get("command", ""),
                    expert=bool(payload.get("expert")),
                    setting_confirmed=bool(payload.get("settingConfirmed")),
                )
                self._json({"ok": True, "machine": MACHINE.send_raw(command)})
            elif self.path == "/api/machine/send-gcode":
                payload = self._read_json()
                self._reject_raw_paths(payload, "path", "gcode")
                if payload.get("lines"):
                    raise ApiRequestError(403, "Tarayicidan ham G-code satiri kabul edilmez.", "raw_gcode_rejected")
                source_path = self._resolve_file_handle(payload, "artifactHandle", "gcode:read")
                expected_hash = str(payload.get("expectedHash") or "").lower()
                actual_hash = file_sha256(source_path)
                if not expected_hash or not hmac.compare_digest(expected_hash, actual_hash):
                    raise ApiRequestError(409, "G-code artifact kimligi degisti; yeniden uretin.", "artifact_hash_mismatch")
                profile = core.validated_machine_profile({"machineProfile": payload.get("machineProfile")})
                artifact_meta = self.file_grants.metadata(str(payload.get("artifactHandle") or ""), "gcode:read")
                if (
                    str(artifact_meta.get("inputHash") or "") != str(payload.get("expectedInputHash") or "")
                    or int(artifact_meta.get("sourceRevision") or 0) != int(payload.get("sourceRevision") or -1)
                ):
                    raise ApiRequestError(409, "Proje artifact uretildikten sonra degisti; yeniden uretin.", "artifact_stale")
                if (
                    str(artifact_meta.get("machineProfileId") or "") != str(profile.get("id") or "")
                    or abs(float(artifact_meta.get("maxS") or 0) - float(profile["maxS"])) > 1e-6
                ):
                    raise ApiRequestError(409, "Artifact farkli bir makine profiliyle uretildi.", "artifact_profile_mismatch")
                machine_settings = MACHINE.snapshot().get("settings") or {}
                try:
                    machine_profile_mismatch = (
                        not math.isclose(float(machine_settings.get("30", -1)), float(profile["maxS"]), rel_tol=0.0, abs_tol=1e-6)
                        or float(machine_settings.get("32", 0)) != 1.0
                        or not math.isclose(float(machine_settings.get("130", -1)), float(profile["travelX"]), rel_tol=0.0, abs_tol=1e-6)
                        or not math.isclose(float(machine_settings.get("131", -1)), float(profile["travelY"]), rel_tol=0.0, abs_tol=1e-6)
                    )
                except (TypeError, ValueError):
                    machine_profile_mismatch = True
                if machine_profile_mismatch:
                    raise ApiRequestError(
                        409,
                        "Makine $30/$32/$130/$131 ayarlari secili profille uyusmuyor.",
                        "machine_profile_mismatch",
                    )
                validation = validate_gcode_path(source_path, profile)
                if validation.get("blockers"):
                    first = validation["blockers"][0]
                    raise ApiRequestError(
                        409,
                        f"G-code gonderim aninda guvenlik kontrolunden gecemedi [{first['code']}]: {first['message']}",
                        "artifact_preflight_failed",
                    )
                lines = laser_grbl.gcode_lines_from_file(source_path)
                self._json({"ok": True, "machine": MACHINE.start_gcode(lines, confirmed=bool(payload.get("confirmed")))})
            elif self.path == "/api/machine/frame":
                payload = self._read_json()
                self._reject_raw_paths(payload, "path")
                source_path = self._resolve_file_handle(payload, "artifactHandle", "gcode:read")
                expected_hash = str(payload.get("expectedHash") or "").lower()
                actual_hash = file_sha256(source_path)
                if not expected_hash or not hmac.compare_digest(expected_hash, actual_hash):
                    raise ApiRequestError(409, "G-code artifact kimligi degisti; yeniden uretin.", "artifact_hash_mismatch")
                analysis = laser_grbl.analyze_gcode(laser_grbl.gcode_raw_lines_from_file(source_path))
                if (
                    analysis.get("unsupportedCoordinateCommands")
                    or analysis.get("unsupportedAxisWords")
                    or analysis.get("unsupportedMachineCommands")
                    or analysis.get("unsupportedWords")
                    or int(analysis.get("unresolvedArcCount") or 0) > 0
                ):
                    raise ValueError("Bu G-code guvenli cerceve analizi icin desteklenmeyen koordinat komutu iceriyor.")
                bounds = analysis.get("bounds")
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
                self._reject_raw_paths(payload, "path")
                source_path = self._resolve_file_handle(payload, "artifactHandle", "gcode:read")
                self._json({"ok": True, "info": gcode_file_info(source_path)})
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
                self._read_json(optional=True)
                raise ApiRequestError(410, "Odak atimi yerine basili tutulan focus-start/focus-stop kullanin.", "focus_deadman_required")
            elif self.path == "/api/machine/focus-start":
                payload = self._read_json()
                self._json(
                    {
                        "ok": True,
                        "machine": MACHINE.focus_start(
                            float(payload.get("powerPercent", 1.0)),
                            expert=bool(payload.get("expert")),
                            confirmed=bool(payload.get("confirmed")),
                        ),
                    }
                )
            elif self.path == "/api/machine/focus-stop":
                self._read_json(optional=True)
                self._json({"ok": True, "machine": MACHINE.focus_stop()})
            else:
                self._not_found()
        except ApiRequestError as exc:
            self._json({"ok": False, "error": str(exc), "code": exc.code, "requestId": request_id}, status=exc.status)
        except (ValueError, RuntimeError) as exc:
            self._json({"ok": False, "error": str(exc), "code": "request_invalid", "requestId": request_id}, status=400)
        except Exception:
            traceback.print_exc()
            self._json(
                {
                    "ok": False,
                    "error": f"Beklenmeyen sunucu hatasi. Istek kimligi: {request_id}",
                    "code": "internal_error",
                    "requestId": request_id,
                },
                status=500,
            )

    def _open_dxf(self) -> None:
        paths = choose_dxf_files()
        if not paths:
            self._json({"ok": True, "parts": []})
            return
        payload = self._read_json(optional=True)
        sources = []
        for filename in paths:
            path = Path(filename).resolve()
            handle = self._issue_file_handle(path, {"dxf:read"})
            sources.append((path, handle))
        unitless = [
            (path, handle)
            for path, handle in sources
            if dxf_converter.dxf_unit_info(path).get("scaleToMm") is None
        ]
        if unitless and not payload.get("unitOverride"):
            self._json({"ok": True, "parts": [], **dxf_unit_choice_payload(sources, payload)})
            return
        parts = self._load_parts(sources, payload)
        self._json({"ok": True, "parts": parts})

    def _load_dxf_paths(self) -> None:
        payload = self._read_json()
        self._reject_raw_paths(payload, "path")
        if payload.get("paths"):
            raise ApiRequestError(403, "DXF yollarini tarayicidan gondermek yasak.", "raw_path_rejected")
        sources = [
            (self.file_grants.resolve(str(handle), "dxf:read"), str(handle))
            for handle in (payload.get("sourceHandles") or [])
        ]
        parts = self._load_parts(sources, payload)
        self._json({"ok": True, "parts": parts})

    def _load_parts(self, sources: list[tuple[Path, str]], payload: dict) -> list[dict]:
        tolerance = float(payload.get("tolerance", 0.25))
        join_tolerance = float(payload.get("joinTolerance", 0.05))
        inner_first = bool(payload.get("innerFirst", True))
        unit_override = str(payload.get("unitOverride") or "").lower() or None
        parts = []
        for index, (path, handle) in enumerate(sources):
            unit_info = dxf_converter.dxf_unit_info(path, unit_override)
            part = core.load_part(
                path,
                f"part_{int(time.time() * 1000)}_{index}",
                tolerance,
                join_tolerance,
                inner_first,
                unit_override=unit_override,
            )
            item = core.part_to_payload(part)
            item["sourceHandle"] = handle
            item["sourceUnits"] = unit_info
            item["sourceFingerprint"] = source_fingerprint(path, units=unit_info)
            item["geometrySnapshotVersion"] = 1
            parts.append(item)
        return parts

    def _reauthorize_source(self) -> None:
        payload = self._read_json()
        item_type = str(payload.get("itemType") or "").lower()
        expected = payload.get("expectedFingerprint") if isinstance(payload.get("expectedFingerprint"), dict) else {}
        if item_type == "part":
            filenames = choose_dxf_files()
            path = Path(filenames[0]).resolve() if filenames else None
            scope = "dxf:read"
        elif item_type == "pattern":
            filename = choose_image_file()
            path = Path(filename).resolve() if filename else None
            scope = "image:read"
        else:
            raise ApiRequestError(400, "Kaynak turu part veya pattern olmali.", "source_type_invalid")
        if path is None:
            self._json({"ok": True, "source": None})
            return

        handle = self._issue_file_handle(path, {scope})
        candidate: dict | None = None
        units: dict = {}
        requires_unit_choice = False
        unit_candidates: list[dict] = []
        if item_type == "part":
            unit_override = str(payload.get("unitOverride") or "").lower() or None
            unit_info = dxf_converter.dxf_unit_info(path, unit_override)
            if unit_info.get("scaleToMm") is None:
                requires_unit_choice = True
                choice_payload = dxf_unit_choice_payload([(path, handle)], payload)
                unit_candidates = choice_payload.get("files", [{}])[0].get("candidates", [])
            else:
                loaded = self._load_parts([(path, handle)], payload)
                candidate = loaded[0] if loaded else None
                units = unit_info
        else:
            candidate_image = core.image_payload(path)
            units = candidate_image.get("physicalSize") or {}
            candidate = {
                "name": candidate_image.get("name") or path.name,
                "kind": candidate_image.get("kind") or "raster",
                "width": candidate_image.get("width") or 0,
                "height": candidate_image.get("height") or 0,
                "physicalSize": candidate_image.get("physicalSize") or {},
                "requiresPhysicalSizeConfirmation": bool(candidate_image.get("requiresPhysicalSizeConfirmation")),
            }

        actual = source_fingerprint(path, units=units)
        self._json(
            {
                "ok": True,
                "source": {
                    "displayPath": str(path),
                    "sourceHandle": handle,
                    "fingerprint": actual,
                    "hashMatches": hmac.compare_digest(
                        str(expected.get("sha256") or ""),
                        str(actual.get("sha256") or ""),
                    ),
                    "candidate": candidate,
                    "requiresUnitChoice": requires_unit_choice,
                    "unitCandidates": unit_candidates,
                },
            }
        )

    def _open_image(self) -> None:
        payload = self._read_json(optional=True)
        self._reject_raw_paths(payload, "path")
        if payload.get("sourceHandle"):
            path = self._resolve_file_handle(payload, "sourceHandle", "image:read")
            source_handle = str(payload.get("sourceHandle"))
        else:
            filename = choose_image_file()
            path = Path(filename).resolve() if filename else None
            source_handle = self._issue_file_handle(path, {"image:read"}) if path else ""
        if path is None:
            self._json({"ok": True, "image": None})
            return
        image = core.image_payload(path)
        image["sourceHandle"] = source_handle
        image["sourceFingerprint"] = source_fingerprint(path, units=image.get("physicalSize") or {})
        self._json({"ok": True, "image": image})

    def _open_raster_image(self) -> None:
        payload = self._read_json(optional=True)
        self._reject_raw_paths(payload, "path")
        if payload.get("sourceHandle"):
            path = self._resolve_file_handle(payload, "sourceHandle", "image:read")
            source_handle = str(payload.get("sourceHandle"))
        else:
            filename = choose_raster_image_file()
            path = Path(filename).resolve() if filename else None
            source_handle = self._issue_file_handle(path, {"image:read"}) if path else ""
        if path is None:
            self._json({"ok": True, "image": None})
            return
        if path.suffix.lower() == ".svg":
            raise ValueError("Foto gravur icin JPG/PNG gibi raster gorsel secin; SVG vektor desen olarak eklenmeli.")
        image = core.image_payload(path)
        image["sourceHandle"] = source_handle
        image["sourceFingerprint"] = source_fingerprint(path)
        self._json({"ok": True, "image": image})

    def _vectorize_image(self) -> None:
        payload = self._read_json(optional=True)
        self._reject_raw_paths(payload, "path")
        temp_paths: list[Path] = []
        source_handle = str(payload.get("sourceHandle") or "")
        try:
            if payload.get("dataUrl"):
                source_path = image_data_url_to_temp_file(str(payload.get("dataUrl")))
                temp_paths.append(source_path)
            else:
                if source_handle:
                    source_path = self.file_grants.resolve(source_handle, "image:read")
                else:
                    filename = choose_raster_image_file()
                    source_path = Path(filename).resolve() if filename else None
                    if source_path:
                        source_handle = self._issue_file_handle(source_path, {"image:read"})
                if source_path is None:
                    self._json({"ok": True, "vector": None})
                    return
            original_source_path = source_path
            if source_path.suffix.lower() == ".svg":
                if payload.get("cropNormalized"):
                    raise ValueError("Yerel yeniden isleme yalniz raster kaynakli vektorlerde kullanilabilir.")
                vector = svg_as_vector_payload(source_path)
                vector["sourceHandle"] = source_handle
                vector["sourceFingerprint"] = source_fingerprint(source_path, units=vector.get("physicalSize") or {})
                self._json({"ok": True, "vector": vector})
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
            if source_handle:
                vector["sourceHandle"] = source_handle
                vector["sourceFingerprint"] = source_fingerprint(original_source_path)
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
        self._reject_raw_paths(payload, "outputPath")
        default_name = payload.get("name") or "vectorized.svg"
        if payload.get("outputHandle"):
            output_path = self._resolve_file_handle(payload, "outputHandle", "svg:write", consume=True)
        else:
            output = choose_svg_output(default_name)
            output_path = Path(output).resolve() if output else None
        if output_path is None:
            self._json({"ok": True, "saved": None})
            return
        saved = core.write_vector_svg(
            output_path,
            payload.get("vectorPaths", []),
            float(payload.get("sourceWidth", payload.get("width", 100))),
            float(payload.get("sourceHeight", payload.get("height", 100))),
            fill_mode=bool(payload.get("fillMode", False)),
            fill_invert=bool(payload.get("fillInvert", False)),
        )
        saved["displayPath"] = str(output_path)
        saved["sourceHandle"] = self._issue_file_handle(output_path, {"image:read"})
        self._json({"ok": True, "saved": saved})

    def _read_json(self, optional: bool = False) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ApiRequestError(400, "Gecersiz Content-Length.", "content_length_invalid") from error
        if length <= 0:
            return {} if optional else {}
        limit = API_LARGE_BODY_LIMIT if self.path in LARGE_BODY_ENDPOINTS else API_DEFAULT_BODY_LIMIT
        if length > limit:
            raise ApiRequestError(413, "Istek govdesi izin verilen siniri asiyor.", "body_too_large")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ApiRequestError(400, "Gecersiz JSON govdesi.", "json_invalid") from error
        if not isinstance(payload, dict):
            raise ApiRequestError(400, "JSON govdesi bir nesne olmali.", "json_object_required")
        return payload

    def _require_json_request(self) -> None:
        content_type = str(self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            raise ApiRequestError(415, "Yalniz application/json kabul edilir.", "content_type_invalid")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ApiRequestError(400, "Gecersiz Content-Length.", "content_length_invalid") from error
        limit = API_LARGE_BODY_LIMIT if self.path in LARGE_BODY_ENDPOINTS else API_DEFAULT_BODY_LIMIT
        if length > limit:
            raise ApiRequestError(413, "Istek govdesi izin verilen siniri asiyor.", "body_too_large")

    def _require_api_access(self) -> None:
        expected_host = str(getattr(self.server, "expected_host", ""))
        expected_origin = str(getattr(self.server, "expected_origin", ""))
        actual_host = str(self.headers.get("Host") or "")
        if not expected_host or not hmac.compare_digest(actual_host, expected_host):
            raise ApiRequestError(403, "Gecersiz yerel sunucu hedefi.", "host_invalid")
        supplied_token = str(self.headers.get(API_TOKEN_HEADER) or "")
        expected_token = str(getattr(self.server, "api_token", ""))
        if not supplied_token or not hmac.compare_digest(supplied_token, expected_token):
            raise ApiRequestError(401, "API oturum yetkisi gecersiz.", "token_invalid")
        origin = str(self.headers.get("Origin") or "")
        if origin:
            if not hmac.compare_digest(origin, expected_origin):
                raise ApiRequestError(403, "Istek kaynagi bu uygulamaya ait degil.", "origin_invalid")
            return
        referer = str(self.headers.get("Referer") or "")
        fetch_site = str(self.headers.get("Sec-Fetch-Site") or "").lower()
        if fetch_site != "same-origin" or not referer.startswith(f"{expected_origin}/"):
            raise ApiRequestError(403, "Ayni kaynak dogrulamasi basarisiz.", "origin_missing")

    def _serve_index(self) -> None:
        try:
            template = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
            bootstrap = (
                f'<meta name="laser-app-token" content="{getattr(self.server, "api_token", "")}" />\n'
                f'    <meta name="laser-app-origin" content="{getattr(self.server, "expected_origin", "")}" />'
            )
            data = template.replace("<!-- LASER_APP_BOOTSTRAP -->", bootstrap).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
            )
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            self._not_found()

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
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        if getattr(self, "_request_id", None):
            self.send_header("X-Request-Id", self._request_id)
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
    server = LaserEditorHttpServer(("127.0.0.1", port), LaserEditorHandler)
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
