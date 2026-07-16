"""Minimal GRBL serial controller for the local laser editor server."""

from __future__ import annotations

import re
import threading
import time
from collections import deque
from math import isfinite
from pathlib import Path
from typing import Any

try:
    import serial
    from serial.tools import list_ports
except Exception:  # pragma: no cover - exercised on machines without pyserial
    serial = None
    list_ports = None


COMMENT_RE = re.compile(r"\([^)]*\)")
XY_WORD_RE = re.compile(r"\b([XY])\s*(-?\d+(?:\.\d+)?)", re.IGNORECASE)
LASER_PORT_KEYWORDS = (
    "usb serial",
    "usb-seri",
    "usb seri",
    "usb-serial",
    "ch340",
    "ch341",
    "cp210",
    "silicon labs",
    "ftdi",
    "arduino",
    "wch",
    "esp",
    "grbl",
)
BAD_PORT_KEYWORDS = ("bluetooth", "bthenum")
SERIAL_READ_TIMEOUT = 0.1
SERIAL_WRITE_TIMEOUT = 5.0


def pyserial_available() -> bool:
    return serial is not None and list_ports is not None


def clean_gcode_line(line: str) -> str:
    """Strip comments and whitespace while preserving GRBL commands."""
    value = line.strip()
    if not value or value == "%":
        return ""
    value = COMMENT_RE.sub("", value)
    value = value.split(";", 1)[0].strip()
    return " ".join(value.split())


def read_gcode_text(path: str | Path) -> str:
    source = Path(path)
    if not source.exists() or not source.is_file():
        raise ValueError(f"G-code dosyasi bulunamadi: {source}")
    payload = source.read_bytes()
    for encoding in ("utf-8-sig", "cp1254", "cp1252"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue
    return payload.decode("latin-1")


def gcode_raw_lines_from_file(path: str | Path) -> list[str]:
    return [line for line in read_gcode_text(path).splitlines() if line.strip()]


def gcode_lines_from_file(path: str | Path) -> list[str]:
    return [line for line in (clean_gcode_line(item) for item in gcode_raw_lines_from_file(path)) if line]


def gcode_bounds(lines: list[str]) -> dict[str, float]:
    current_x: float | None = None
    current_y: float | None = None
    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    for line in lines:
        words = {axis.upper(): float(value) for axis, value in XY_WORD_RE.findall(clean_gcode_line(line))}
        if "X" in words:
            current_x = words["X"]
        if "Y" in words:
            current_y = words["Y"]
        if current_x is None or current_y is None:
            continue
        min_x = min(min_x, current_x)
        min_y = min(min_y, current_y)
        max_x = max(max_x, current_x)
        max_y = max(max_y, current_y)
    if not all(isfinite(value) for value in (min_x, min_y, max_x, max_y)):
        raise ValueError("G-code icinde X/Y sinir kutusu bulunamadi.")
    return {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y}


def gcode_bounds_from_file(path: str | Path) -> dict[str, float]:
    return gcode_bounds(gcode_lines_from_file(path))


def normalize_bounds(bounds: dict[str, Any], padding: float = 0.0) -> dict[str, float]:
    try:
        min_x = float(bounds["minX"]) - padding
        min_y = float(bounds["minY"]) - padding
        max_x = float(bounds["maxX"]) + padding
        max_y = float(bounds["maxY"]) + padding
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Cerceve icin gecerli minX/minY/maxX/maxY gerekli.") from exc
    if not all(isfinite(value) for value in (min_x, min_y, max_x, max_y)):
        raise ValueError("Cerceve sinir kutusu gecersiz.")
    if max_x < min_x or max_y < min_y:
        raise ValueError("Cerceve sinir kutusu ters.")
    return {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y}


def serial_port_score(device: str, description: str = "", hwid: str = "") -> tuple[int, str]:
    text = f"{device} {description} {hwid}".lower()
    score = 0
    reasons: list[str] = []
    if any(keyword in text for keyword in BAD_PORT_KEYWORDS):
        score -= 100
        reasons.append("Bluetooth/sanal port")
    if "vid:pid" in text or "usb vid:pid" in text:
        score += 80
        reasons.append("USB VID/PID")
    for keyword in LASER_PORT_KEYWORDS:
        if keyword in text:
            score += 35
            reasons.append(keyword.upper())
            break
    if re.match(r"^COM\d+$", str(device), re.IGNORECASE):
        score += 3
    return score, ", ".join(dict.fromkeys(reasons)) or "Genel seri port"


def serial_port_payload(port: Any) -> dict[str, Any]:
    device = str(getattr(port, "device", "") or "")
    description = str(getattr(port, "description", "") or "")
    hwid = str(getattr(port, "hwid", "") or "")
    score, reason = serial_port_score(device, description, hwid)
    return {
        "device": device,
        "description": description,
        "hwid": hwid,
        "score": score,
        "likelyLaser": score > 0 and "bluetooth" not in reason.lower(),
        "reason": reason,
    }


def preferred_serial_port(ports: list[dict[str, Any]]) -> str:
    return str(next((port.get("device") for port in ports if port.get("likelyLaser")), "") or "")


GCODE_WORD_RE = re.compile(r"([A-Za-z])([-+]?[0-9]*\.?[0-9]+)")
GRBL_SETTING_RE = re.compile(r"^\$(\d+)\s*=\s*(-?\d+(?:\.\d+)?)")


def gcode_uses_m3(lines: list[str]) -> bool:
    for raw in lines:
        line = clean_gcode_line(raw).upper()
        for letter, value_text in GCODE_WORD_RE.findall(line):
            if letter == "M" and int(float(value_text)) == 3:
                return True
    return False


def gcode_operation_marker(raw: str, current: str) -> str:
    text = str(raw or "").strip().lower()
    if not text.startswith("("):
        return current
    if "cut paths end" in text or "vector paths end" in text or "vector fill end" in text or "engrave fill end" in text or "engrave photo end" in text or "engrave image end" in text or "engrave vector end" in text:
        return "laser"
    if "cut paths begin" in text or text.startswith("(cut begin") or text.startswith("(cut vector") or text.startswith("(cut svg"):
        return "cut"
    if "engrave fill begin" in text or "engrave vector fill begin" in text or text.startswith("(engrave image"):
        return "engrave_fill"
    if text.startswith("(engrave photo"):
        return "engrave_photo"
    if "engrave line begin" in text or text.startswith("(engrave vector") or text.startswith("(engrave svg"):
        return "engrave_line"
    return current


def analyze_gcode(lines: list[str], rapid_feed: float = 6000.0) -> dict[str, Any]:
    """Onizleme + sure tahmini icin G-code'u coz.

    Donus: segments=[x1,y1,x2,y2,mod(0=bos,1=kesim),satirIndex], bounds,
    cutLength/travelLength (mm), estimatedSeconds, lineSeconds (satir bazli
    kumulatif sure -> kalan sure hesabi icin).
    """
    segments: list[list[float]] = []
    line_seconds: list[float] = []
    x = y = 0.0
    coordinate_offset_x = coordinate_offset_y = 0.0
    absolute = True
    unit_scale = 1.0
    feed = rapid_feed
    power = 0.0
    laser_on = False
    modal_motion: int | None = None
    cut_length = travel_length = 0.0
    operation_lengths: dict[str, float] = {}
    total_seconds = 0.0
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    uses_m3 = False
    uses_m4 = False
    saw_m5 = False
    saw_s0 = False
    active_operation = "laser"
    laser_powers: list[float] = []
    laser_feeds: list[float] = []
    explicit_units = False
    explicit_distance_mode = False
    explicit_feed_mode = False
    has_g21 = False
    has_g90 = False
    has_g94 = False
    laser_move_count = 0
    arc_move_count = 0
    unsupported_coordinate_commands: set[str] = set()
    unsupported_axis_words: set[str] = set()
    unsupported_machine_commands: set[str] = set()
    unsupported_words: set[str] = set()
    commanded_powers: list[float] = []

    for index, raw in enumerate(lines):
        active_operation = gcode_operation_marker(raw, active_operation)
        line = clean_gcode_line(raw).upper()
        elapsed_before = total_seconds
        if line:
            target_x: float | None = None
            target_y: float | None = None
            motion = None
            coordinate_setting = False
            for letter, value_text in GCODE_WORD_RE.findall(line):
                value = float(value_text)
                if letter == "G":
                    if abs(value - round(value)) > 1e-9:
                        unsupported_coordinate_commands.add(f"G{value:g}")
                        continue
                    code = int(round(value))
                    if code in (0, 1, 2, 3):
                        motion = code
                        if code in (2, 3):
                            arc_move_count += 1
                    elif code == 20:
                        unit_scale = 25.4
                        explicit_units = True
                    elif code == 21:
                        unit_scale = 1.0
                        explicit_units = True
                        has_g21 = True
                    elif code == 90:
                        absolute = True
                        explicit_distance_mode = True
                        has_g90 = True
                    elif code == 91:
                        absolute = False
                        explicit_distance_mode = True
                    elif code == 94:
                        explicit_feed_mode = True
                        has_g94 = True
                    elif code == 92 and abs(value - 92.0) <= 1e-9:
                        coordinate_setting = True
                    elif code in {4, 17, 40, 49, 54, 80}:
                        pass
                    else:
                        unsupported_coordinate_commands.add(f"G{value:g}")
                elif letter == "M":
                    code = int(value)
                    if code in (3, 4):
                        laser_on = True
                        uses_m3 = uses_m3 or code == 3
                        uses_m4 = uses_m4 or code == 4
                    elif code == 5:
                        laser_on = False
                        saw_m5 = True
                    elif code not in {7, 8, 9}:
                        unsupported_machine_commands.add(f"M{value:g}")
                elif letter == "F":
                    feed = max(1.0, value * unit_scale)
                elif letter == "S":
                    power = value
                    commanded_powers.append(value)
                    if abs(value) <= 1e-9:
                        saw_s0 = True
                elif letter == "X":
                    target_x = value
                elif letter == "Y":
                    target_y = value
                elif letter in {"Z", "A", "B", "C", "U", "V", "W"}:
                    unsupported_axis_words.add(letter)
                elif letter in {"T", "H", "D", "E", "Q", "I", "J", "K", "R"}:
                    unsupported_words.add(letter)
            if motion is not None:
                modal_motion = motion
            if coordinate_setting:
                if "G92" in line:
                    if target_x is not None:
                        coordinate_offset_x = x - target_x * unit_scale
                    if target_y is not None:
                        coordinate_offset_y = y - target_y * unit_scale
                line_seconds.append(round(total_seconds - elapsed_before, 4))
                continue
            if (target_x is not None or target_y is not None) and modal_motion is not None:
                new_x = x if target_x is None else (target_x * unit_scale + coordinate_offset_x if absolute else x + target_x * unit_scale)
                new_y = y if target_y is None else (target_y * unit_scale + coordinate_offset_y if absolute else y + target_y * unit_scale)
                distance = ((new_x - x) ** 2 + (new_y - y) ** 2) ** 0.5
                if distance > 1e-9:
                    is_cut = modal_motion in (1, 2, 3) and laser_on and power > 0
                    move_feed = feed if modal_motion in (1, 2, 3) else rapid_feed
                    total_seconds += distance / max(1.0, move_feed) * 60.0
                    if is_cut:
                        cut_length += distance
                        laser_move_count += 1
                        operation = active_operation if active_operation != "travel" else "laser"
                        operation_lengths[operation] = operation_lengths.get(operation, 0.0) + distance
                        laser_powers.append(power)
                        laser_feeds.append(move_feed)
                    else:
                        travel_length += distance
                        operation = "travel"
                    segments.append([
                        round(x, 3), round(y, 3), round(new_x, 3), round(new_y, 3),
                        1 if is_cut else 0, index, operation, round(power, 3), round(move_feed, 3),
                    ])
                    for px, py in ((x, y), (new_x, new_y)):
                        min_x = min(min_x, px); max_x = max(max_x, px)
                        min_y = min(min_y, py); max_y = max(max_y, py)
                x, y = new_x, new_y
        line_seconds.append(round(total_seconds - elapsed_before, 4))

    if min_x > max_x:
        min_x = min_y = max_x = max_y = 0.0
    rounded_operations = {key: round(value, 1) for key, value in operation_lengths.items() if value > 0}
    process_cut_length = rounded_operations.get("cut", 0.0)
    engrave_length = round(sum(value for key, value in operation_lengths.items() if key.startswith("engrave")), 1)
    generic_laser_length = rounded_operations.get("laser", 0.0)
    safety_warnings: list[str] = []
    if not explicit_units:
        safety_warnings.append("G20/G21 birim komutu yok; kontrolcüde kalan birim modu kullanılabilir.")
    if not explicit_distance_mode:
        safety_warnings.append("G90/G91 koordinat modu açıkça belirtilmemiş.")
    if not explicit_feed_mode:
        safety_warnings.append("G94 ilerleme modu açıkça belirtilmemiş.")
    if uses_m3:
        safety_warnings.append("M3 sabit güç kullanılıyor; duraklama ve köşe yanığı riski ayrıca doğrulanmalı.")
    final_laser_off = saw_m5 and saw_s0 and not laser_on and power <= 0
    if cut_length > 0 and not final_laser_off:
        safety_warnings.append("Dosya sonunda M5/S0 ile lazerin kapandığı doğrulanamadı.")
    if arc_move_count:
        safety_warnings.append("G2/G3 yayları önizlemede kiriş olarak gösteriliyor; makinede gerçek yay hareketi oluşur.")
    if unsupported_coordinate_commands:
        safety_warnings.append(f"Önizleme, {', '.join(sorted(unsupported_coordinate_commands))} koordinat komutlarını yaklaşık gösterir.")
    if unsupported_axis_words:
        safety_warnings.append(f"2B önizleme, {', '.join(sorted(unsupported_axis_words))} eksen hareketlerini çözümlemez.")
    if unsupported_machine_commands:
        safety_warnings.append(f"Desteklenmeyen M komutları var: {', '.join(sorted(unsupported_machine_commands))}.")
    if unsupported_words:
        safety_warnings.append(f"Sınır analizinde desteklenmeyen alanlar var: {', '.join(sorted(unsupported_words))}.")
    return {
        "segments": segments,
        "bounds": {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y,
                   "width": max_x - min_x, "height": max_y - min_y},
        "cutLength": round(cut_length, 1),
        "laserLength": round(cut_length, 1),
        "processCutLength": process_cut_length,
        "engraveLength": engrave_length,
        "genericLaserLength": generic_laser_length,
        "operationLengths": rounded_operations,
        "travelLength": round(travel_length, 1),
        "estimatedSeconds": round(total_seconds, 1),
        "lineSeconds": line_seconds,
        "lineCount": len(lines),
        "usesM3": uses_m3,
        "usesM4": uses_m4,
        "unitMode": "inch" if unit_scale == 25.4 else "mm",
        "explicitUnits": explicit_units,
        "explicitDistanceMode": explicit_distance_mode,
        "explicitFeedMode": explicit_feed_mode,
        "hasG21": has_g21,
        "hasG90": has_g90,
        "hasG94": has_g94,
        "finalLaserOff": final_laser_off,
        "laserMoveCount": laser_move_count,
        "arcMoveCount": arc_move_count,
        "unresolvedArcCount": arc_move_count,
        "unsupportedCoordinateCommands": sorted(unsupported_coordinate_commands),
        "unsupportedAxisWords": sorted(unsupported_axis_words),
        "unsupportedMachineCommands": sorted(unsupported_machine_commands),
        "unsupportedWords": sorted(unsupported_words),
        "commandedPowerRange": {
            "min": min(commanded_powers) if commanded_powers else 0.0,
            "max": max(commanded_powers) if commanded_powers else 0.0,
        },
        "safetyWarnings": safety_warnings,
        "powerRange": {
            "min": min(laser_powers) if laser_powers else 0.0,
            "max": max(laser_powers) if laser_powers else 0.0,
        },
        "feedRange": {
            "min": min(laser_feeds) if laser_feeds else 0.0,
            "max": max(laser_feeds) if laser_feeds else 0.0,
        },
    }


def validate_gcode_for_machine(
    lines: list[str],
    *,
    max_s: float,
    travel_x: float | None = None,
    travel_y: float | None = None,
) -> dict[str, Any]:
    info = analyze_gcode(lines)
    blockers: list[dict[str, str]] = []

    def block(code: str, message: str) -> None:
        blockers.append({"code": code, "message": message})

    if not info.get("hasG21") or info.get("unitMode") != "mm":
        block("gcode_g21_required", "G-code acikca G21 milimetre modunu secmeli.")
    if not info.get("hasG90"):
        block("gcode_g90_required", "G-code acikca G90 mutlak koordinat modunu secmeli.")
    if not info.get("hasG94"):
        block("gcode_g94_required", "G-code acikca G94 mm/dakika ilerleme modunu secmeli.")
    if not info.get("finalLaserOff"):
        block("gcode_final_laser_off", "G-code sonunda M5 ve S0 ile lazer kapanisi dogrulanamadi.")
    unsupported = info.get("unsupportedCoordinateCommands") or []
    if unsupported:
        block("gcode_unsupported_coordinates", f"Desteklenmeyen koordinat komutlari: {', '.join(unsupported)}.")
    unsupported_axes = info.get("unsupportedAxisWords") or []
    if unsupported_axes:
        block("gcode_unsupported_axes", f"2B lazer isi icin desteklenmeyen eksenler: {', '.join(unsupported_axes)}.")
    unsupported_m = info.get("unsupportedMachineCommands") or []
    if unsupported_m:
        block("gcode_unsupported_machine_commands", f"Desteklenmeyen M komutlari: {', '.join(unsupported_m)}.")
    unsupported_words = info.get("unsupportedWords") or []
    if unsupported_words:
        block("gcode_unsupported_words", f"Sinir analizinde desteklenmeyen G-code alanlari: {', '.join(unsupported_words)}.")
    if int(info.get("unresolvedArcCount") or 0) > 0:
        block("gcode_unresolved_arc", "G2/G3 yaylari kesin sinir analizi yapilamadigi icin makineye gonderilemez.")
    try:
        normalized_max_s = float(max_s)
    except (TypeError, ValueError):
        normalized_max_s = 0.0
    power_range = info.get("commandedPowerRange") or {}
    min_power = float(power_range.get("min") or 0.0)
    max_power = float(power_range.get("max") or 0.0)
    if normalized_max_s <= 0:
        block("machine_max_s_unknown", "Makine $30 maksimum guc ayari bilinmiyor.")
    elif min_power < -1e-9 or max_power > normalized_max_s + 1e-9:
        block(
            "gcode_power_range",
            f"G-code gucu S{min_power:g}..S{max_power:g}; makine siniri S0..S{normalized_max_s:g}.",
        )
    bounds = info.get("bounds") or {}
    min_x = float(bounds.get("minX") or 0.0)
    min_y = float(bounds.get("minY") or 0.0)
    max_x = float(bounds.get("maxX") or 0.0)
    max_y = float(bounds.get("maxY") or 0.0)
    if min_x < -1e-6 or min_y < -1e-6:
        block("gcode_negative_bounds", "G-code makine calisma sifirinin disina tasiyor.")
    if travel_x is not None and float(travel_x) > 0 and max_x > float(travel_x) + 1e-6:
        block("gcode_x_limit", f"G-code X{max_x:.3f}, makine X siniri {float(travel_x):.3f} mm.")
    if travel_y is not None and float(travel_y) > 0 and max_y > float(travel_y) + 1e-6:
        block("gcode_y_limit", f"G-code Y{max_y:.3f}, makine Y siniri {float(travel_y):.3f} mm.")
    return {**info, "blockers": blockers, "safeForMachine": not blockers}


def _parse_axis_values(value: str) -> list[float]:
    result: list[float] = []
    for item in value.split(","):
        try:
            result.append(float(item))
        except ValueError:
            result.append(0.0)
    return result


def parse_status_line(line: str) -> dict[str, Any]:
    text = line.strip()
    if not (text.startswith("<") and text.endswith(">")):
        return {}
    fields = text[1:-1].split("|")
    status: dict[str, Any] = {"raw": text, "state": fields[0] if fields else ""}
    for field in fields[1:]:
        if ":" not in field:
            continue
        key, value = field.split(":", 1)
        if key in {"MPos", "WPos", "WCO", "Ov"}:
            status[key] = _parse_axis_values(value)
        elif key == "FS":
            numbers = _parse_axis_values(value)
            status["feed"] = numbers[0] if numbers else 0
            status["spindle"] = numbers[1] if len(numbers) > 1 else 0
        else:
            status[key] = value
    return status


class GrblController:
    def __init__(self) -> None:
        self._serial: Any = None
        self._port = ""
        self._baud = 115200
        self._lock = threading.RLock()
        self._io_lock = threading.RLock()
        self._write_lock = threading.RLock()
        self._log: deque[str] = deque(maxlen=180)
        self._last_status: dict[str, Any] = {}
        self._job: dict[str, Any] = self._empty_job()
        self._worker: threading.Thread | None = None
        self._abort_requested = False
        self._paused = False
        self._settings: dict[str, float] = {}
        self._warnings: list[str] = []
        self._last_status_at = 0.0
        self._focus_timer: threading.Timer | None = None
        self._focus_active = False

    def list_ports(self) -> dict[str, Any]:
        if not pyserial_available():
            return {
                "available": False,
                "ports": [],
                "error": "pyserial kurulu degil. `pip install pyserial` gerekli.",
            }
        ports = [serial_port_payload(port) for port in list_ports.comports()]
        ports.sort(key=lambda item: (int(item.get("score") or 0), str(item.get("device") or "")), reverse=True)
        preferred = preferred_serial_port(ports)
        return {"available": True, "ports": ports, "preferredPort": preferred}

    def connect(self, port: str, baud: int = 115200) -> dict[str, Any]:
        if not pyserial_available():
            raise ValueError("pyserial kurulu degil. `pip install pyserial` gerekli.")
        port = str(port or "").strip()
        if not port:
            raise ValueError("COM port secilmedi.")
        baud = int(baud or 115200)
        if baud <= 0:
            raise ValueError("Baud degeri gecersiz.")
        with self._lock:
            self.disconnect()
            try:
                self._serial = serial.Serial(
                    port=port,
                    baudrate=baud,
                    timeout=SERIAL_READ_TIMEOUT,
                    write_timeout=SERIAL_WRITE_TIMEOUT,
                )
            except Exception as exc:
                ports = self.list_ports().get("ports", [])
                preferred = next((item.get("device") for item in ports if item.get("likelyLaser")), "")
                hint = f" Onerilen USB port: {preferred}." if preferred and preferred != port else ""
                raise ValueError(f"{port} acilamadi: {exc}.{hint}") from exc
            self._port = port
            self._baud = baud
            self._last_status = {}
            self._last_status_at = 0.0
            self._settings = {}
            self._warnings = []
            self._log.clear()
            self._abort_requested = False
            self._paused = False
            self._append_log(f"Baglandi: {port} @ {baud}")
        time.sleep(1.8)
        self._read_available(0.4)
        self.query_status()
        try:
            self.refresh_settings()
        except Exception as exc:
            self._append_log(f"UYARI: GRBL ayarlari okunamadi: {exc}")
        return self.snapshot()

    def disconnect(self) -> dict[str, Any]:
        with self._lock:
            if self._focus_timer is not None:
                self._focus_timer.cancel()
                self._focus_timer = None
            self._focus_active = False
            self._abort_requested = True
            self._paused = False
            if self._serial is not None:
                try:
                    # GUVENLIK: baglanti kapanmadan lazeri durdur. Soft reset
                    # (CTRL-X) planlayiciyi bosaltir ve lazeri kapatir; yoksa
                    # is ortasinda koparildiginda lazer acik kalabilir.
                    try:
                        self._write_serial(b"\x18")
                        self._serial.flush()
                        time.sleep(0.1)
                    except Exception:
                        pass
                    self._serial.close()
                finally:
                    self._append_log("Baglanti kapatildi (soft reset gonderildi).")
            self._serial = None
            self._port = ""
            self._job["running"] = False
        return self.snapshot()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "available": pyserial_available(),
                "connected": self._is_connected_unlocked(),
                "port": self._port,
                "baud": self._baud,
                "lastStatus": dict(self._last_status),
                "lastStatusAt": self._last_status_at,
                "statusAgeMs": round(max(0.0, time.monotonic() - self._last_status_at) * 1000) if self._last_status_at else None,
                "settings": dict(self._settings),
                "warnings": list(self._warnings),
                "focus": {"active": self._focus_active},
                "job": dict(self._job),
                "log": list(self._log)[-80:],
            }

    def refresh_settings(self) -> dict[str, Any]:
        self._require_connected()
        settings: dict[str, float] = {}
        with self._io_lock:
            self._append_log("> $$")
            self._write_serial(b"$$\n")
            deadline = time.monotonic() + 2.5
            while time.monotonic() < deadline:
                line = self._readline()
                if not line:
                    continue
                self._append_log(f"< {line}")
                if line.startswith("<"):
                    parsed = parse_status_line(line)
                    if parsed:
                        with self._lock:
                            self._last_status = parsed
                            self._last_status_at = time.monotonic()
                    continue
                lower = line.lower()
                if lower == "ok":
                    break
                if lower.startswith("error") or lower.startswith("alarm"):
                    break
                match = GRBL_SETTING_RE.match(line)
                if match:
                    settings[match.group(1)] = float(match.group(2))
        with self._lock:
            self._settings = settings
            self._warnings = self._machine_warnings()
        return self.snapshot()

    def query_status(self) -> dict[str, Any]:
        self._require_connected()
        with self._lock:
            job_running = bool(self._job.get("running"))
        if job_running:
            # Is calisirken io_lock isci thread'te (ok bekliyor); kilide
            # girmeye calismak UI durum sorgusunu satir suresince bloke eder.
            # "?" gercek-zamanli tek bayttir, akisin icine guvenle yazilir;
            # yaniti isci thread'in okuma dongusu zaten isler.
            self._write_realtime(b"?")
            return self.snapshot()
        with self._io_lock:
            self._write_serial(b"?")
            deadline = time.monotonic() + 1.0
            while time.monotonic() < deadline:
                line = self._readline()
                if not line:
                    continue
                if line.startswith("<"):
                    parsed = parse_status_line(line)
                    with self._lock:
                        self._last_status = parsed
                        self._last_status_at = time.monotonic()
                    self._append_log(f"< {line}")
                    break
                self._append_log(f"< {line}")
        return self.snapshot()

    def control(self, action: str) -> dict[str, Any]:
        action = str(action or "").strip().lower()
        if action == "status":
            return self.query_status()
        if action == "disconnect":
            return self.disconnect()
        self._require_connected()
        if action == "unlock":
            self._ensure_no_active_job()
            self._send_command_wait("$X", timeout=4)
        elif action == "home":
            self._ensure_no_active_job()
            self._send_command_wait("$H", timeout=60)
        elif action == "reset":
            with self._lock:
                job_running = bool(self._job.get("running"))
            self._write_realtime(b"\x18")
            with self._lock:
                self._abort_requested = True
                self._paused = False
                self._job["running"] = False
            self._append_log("> CTRL-X soft reset")
            if not job_running:
                time.sleep(0.5)
                self._read_available(0.8)
        elif action == "hold":
            self._paused = True
            self._write_realtime(b"!")
            self._append_log("> ! feed hold")
        elif action == "resume":
            self._paused = False
            self._write_realtime(b"~")
            self._append_log("> ~ resume")
        elif action == "abort":
            self._abort_requested = True
            self._paused = False
            self._write_realtime(b"\x18")
            self._append_log("> CTRL-X abort")
        else:
            raise ValueError(f"Bilinmeyen makine komutu: {action}")
        return self.snapshot()

    def jog(self, axis: str, distance: float, feed: float = 1200.0) -> dict[str, Any]:
        self._ensure_operator_ready()
        axis = str(axis or "").upper()
        if axis not in {"X", "Y", "Z"}:
            raise ValueError("Jog ekseni X, Y veya Z olmali.")
        distance = float(distance)
        feed = max(1.0, float(feed or 1200.0))
        self._send_command_wait(f"$J=G91 G21 {axis}{distance:.3f} F{feed:.0f}", timeout=5)
        return self.snapshot()

    def send_raw(self, command: str) -> dict[str, Any]:
        command = str(command or "").strip()
        if not command:
            raise ValueError("Komut bos.")
        if "\n" in command or "\r" in command:
            raise ValueError("Tek seferde sadece tek komut gonderilebilir.")
        self._ensure_operator_ready()
        self._send_command_wait(command, timeout=10)
        return self.snapshot()

    _OVERRIDE_BYTES = {
        ("feed", "reset"): b"\x90",
        ("feed", "plus"): b"\x91",
        ("feed", "minus"): b"\x92",
        ("spindle", "reset"): b"\x99",
        ("spindle", "plus"): b"\x9a",
        ("spindle", "minus"): b"\x9b",
    }

    def override(self, kind: str, action: str) -> dict[str, Any]:
        """Gercek-zamanli hiz/guc carpani (GRBL override). Is calisirken de
        gonderilebilir: tek bayttir, satir kuyrugunu beklemez."""
        payload = self._OVERRIDE_BYTES.get((str(kind or "").lower(), str(action or "").lower()))
        if payload is None:
            raise ValueError("Bilinmeyen override komutu.")
        self._require_connected()
        self._write_realtime(payload)
        self._append_log(f"> override {kind} {action}")
        # Yeni carpan degerini (Ov:...) hemen gormek icin durum iste.
        self._write_realtime(b"?")
        return self.snapshot()

    def frame_bounds(self, bounds: dict[str, Any], feed: float = 3000.0, padding: float = 0.0, confirmed: bool = False) -> dict[str, Any]:
        if not confirmed:
            raise ValueError("Cerceve gezdirme icin kullanici onayi gerekli.")
        self._ensure_operator_ready()
        feed = max(1.0, float(feed or 3000.0))
        padding = max(0.0, float(padding or 0.0))
        box = normalize_bounds(bounds, padding)
        self._validate_machine_bounds(box)
        min_x = box["minX"]
        min_y = box["minY"]
        max_x = box["maxX"]
        max_y = box["maxY"]
        commands = [
            "M5",
            "S0",
            "G21",
            "G90",
            "G94",
            f"G0 X{min_x:.3f} Y{min_y:.3f}",
            f"G1 X{max_x:.3f} Y{min_y:.3f} F{feed:.0f}",
            f"G1 X{max_x:.3f} Y{max_y:.3f} F{feed:.0f}",
            f"G1 X{min_x:.3f} Y{max_y:.3f} F{feed:.0f}",
            f"G1 X{min_x:.3f} Y{min_y:.3f} F{feed:.0f}",
            "M5",
            "S0",
        ]
        try:
            for command in commands:
                self._send_command_wait(command, timeout=180)
        except Exception:
            self._safety_stop()
            raise
        self._append_log(
            f"Cerceve gezdirildi: X{min_x:.2f}..{max_x:.2f} Y{min_y:.2f}..{max_y:.2f}"
        )
        return self.snapshot()

    def set_work_origin(self, clear: bool = False, confirmed: bool = False) -> dict[str, Any]:
        if not confirmed:
            raise ValueError("Is sifiri degistirmek icin kullanici onayi gerekli.")
        self._ensure_operator_ready()
        command = "G10 L2 P1 X0 Y0" if clear else "G10 L20 P1 X0 Y0"
        self._send_command_wait(command, timeout=5)
        self._append_log("Is sifiri temizlendi." if clear else "Mevcut kafa konumu X0 Y0 yapildi.")
        return self.snapshot()

    def focus_pulse(self, power: int = 10, duration_ms: int = 80, confirmed: bool = False) -> dict[str, Any]:
        if not confirmed:
            raise ValueError("Odak atimi icin kullanici onayi gerekli.")
        power = int(float(power or 0))
        duration_ms = int(float(duration_ms or 0))
        if power <= 0:
            raise ValueError("Odak atimi gucu 0'dan buyuk olmali.")
        if power > 200:
            raise ValueError("Guvenlik icin odak atimi S200'u asamaz.")
        if duration_ms <= 0 or duration_ms > 1000:
            raise ValueError("Odak atimi suresi 1-1000 ms arasinda olmali.")
        self._ensure_operator_ready()
        try:
            self._send_command_wait("M5", timeout=4)
            self._send_command_wait("S0", timeout=4)
            self._send_command_wait(f"M3 S{power}", timeout=4)
            time.sleep(duration_ms / 1000.0)
        finally:
            try:
                self._send_command_wait("M5", timeout=4)
                self._send_command_wait("S0", timeout=4)
            except Exception:
                self._safety_stop()
        self._append_log(f"Odak atimi: S{power} / {duration_ms} ms")
        return self.snapshot()

    def focus_start(self, power_percent: float, *, expert: bool = False, confirmed: bool = False) -> dict[str, Any]:
        if not confirmed:
            raise ValueError("Odak lazeri icin kullanici onayi gerekli.")
        percent = float(power_percent or 0.0)
        limit = 5.0 if expert else 3.0
        watchdog_seconds = 0.25 if expert else 0.1
        if percent <= 0 or percent > limit:
            raise ValueError(f"Odak gucu bu modda %0 ile %{limit:g} arasinda olmali.")
        self._ensure_operator_ready()
        max_s, _travel_x, _travel_y = self._validate_laser_settings()
        power_s = max(1, int(round(percent / 100.0 * max_s)))
        with self._lock:
            if self._focus_timer is not None:
                self._focus_timer.cancel()
                self._focus_timer = None
        try:
            self._send_command_wait("M5", timeout=2)
            self._send_command_wait("S0", timeout=2)
            self._send_command_wait(f"M3 S{power_s}", timeout=2)
        except Exception:
            self._safety_stop()
            raise
        with self._lock:
            self._focus_active = True
            timer = threading.Timer(watchdog_seconds, self._focus_watchdog_stop)
            timer.daemon = True
            self._focus_timer = timer
            timer.start()
        self._append_log(f"Odak basladi: %{percent:g} = S{power_s}; watchdog {watchdog_seconds * 1000:.0f} ms")
        return self.snapshot()

    def focus_stop(self) -> dict[str, Any]:
        with self._lock:
            timer = self._focus_timer
            self._focus_timer = None
        if timer is not None:
            timer.cancel()
        try:
            self._shutdown_laser_or_raise()
        except Exception:
            self._safety_stop()
            raise
        finally:
            with self._lock:
                self._focus_active = False
        self._append_log("Odak lazeri kapatildi.")
        return self.snapshot()

    def _focus_watchdog_stop(self) -> None:
        try:
            self.focus_stop()
        except Exception as exc:
            self._append_log(f"GUVENLIK: odak watchdog kapanisi basarisiz: {exc}")

    def start_gcode(self, lines: list[str], confirmed: bool = False) -> dict[str, Any]:
        if not confirmed:
            raise ValueError("Makineye G-code gondermek icin kullanici onayi gerekli.")
        self._require_connected()
        with self._lock:
            already_running = bool(self._job.get("running"))
        if not already_running:
            self._ensure_operator_ready()
        clean_lines = [line for line in (clean_gcode_line(item) for item in lines) if line]
        if not clean_lines:
            raise ValueError("Gonderilecek G-code satiri yok.")
        max_s, travel_x, travel_y = self._validate_laser_settings()
        preflight = validate_gcode_for_machine(
            clean_lines,
            max_s=max_s,
            travel_x=travel_x,
            travel_y=travel_y,
        )
        if preflight["blockers"]:
            message = " ".join(str(item.get("message") or "") for item in preflight["blockers"])
            raise ValueError(f"G-code makine guvenlik kontrolunden gecemedi: {message}")
        with self._lock:
            if self._job.get("running"):
                raise ValueError("Makinede zaten calisan bir G-code gonderimi var.")
            self._abort_requested = False
            self._paused = False
            self._job = {
                "running": True,
                "paused": False,
                "total": len(clean_lines),
                "sent": 0,
                "ok": 0,
                "errors": 0,
                "currentLine": "",
                "message": "G-code gonderimi basladi.",
                "startedAt": time.time(),
                "finishedAt": None,
            }
            self._worker = threading.Thread(target=self._run_gcode_job, args=(clean_lines,), daemon=True)
            self._worker.start()
        self._append_log(f"G-code gonderimi basladi: {len(clean_lines)} satir")
        return self.snapshot()

    def _run_gcode_job(self, lines: list[str]) -> None:
        try:
            for index, line in enumerate(lines, start=1):
                if self._abort_requested:
                    raise RuntimeError("G-code gonderimi iptal edildi.")
                while self._paused and not self._abort_requested:
                    with self._lock:
                        self._job["paused"] = True
                        self._job["message"] = "Duraklatildi."
                    time.sleep(0.08)
                if self._abort_requested:
                    raise RuntimeError("G-code gonderimi iptal edildi.")
                with self._lock:
                    self._job["paused"] = False
                    self._job["currentLine"] = line
                    self._job["sent"] = index
                # NOT: GRBL "ok"u satir planlayici kuyruguna girince yollar;
                # kuyruk doluyken ok ancak bir onceki hareket BITINCE gelir.
                # Uzun bir G1 (orn. 200mm @ F500 = 24sn) 20sn'lik zaman
                # asimini asar ve isi ortada dusururdu -> 180sn.
                response = self._send_command_wait(line, timeout=180)
                with self._lock:
                    if response.startswith("ok"):
                        self._job["ok"] += 1
                    else:
                        self._job["errors"] += 1
                        raise RuntimeError(response)
            self._shutdown_laser_or_raise()
            with self._lock:
                self._job["running"] = False
                self._job["paused"] = False
                self._job["message"] = "G-code gonderimi tamamlandi."
                self._job["finishedAt"] = time.time()
            self._append_log("G-code gonderimi tamamlandi.")
        except Exception as exc:  # background worker boundary
            shutdown_error = None
            try:
                self._shutdown_laser_or_raise()
            except Exception as stop_exc:
                shutdown_error = stop_exc
                self._safety_stop()
            message = str(exc)
            if shutdown_error is not None:
                message = f"{message} Lazer kapanisi dogrulanamadi: {shutdown_error}"
            with self._lock:
                self._job["running"] = False
                self._job["paused"] = False
                self._job["errors"] = int(self._job.get("errors") or 0) + 1
                self._job["message"] = message
                self._job["finishedAt"] = time.time()
            self._append_log(f"HATA: {message}")

    def _shutdown_laser_or_raise(self) -> None:
        if not self._is_connected_unlocked():
            raise ValueError("Lazer kapanisi icin makine bagli degil.")
        first = self._send_command_wait("M5", timeout=2.0, allow_abort=False)
        second = self._send_command_wait("S0", timeout=2.0, allow_abort=False)
        if not first.startswith("ok") or not second.startswith("ok"):
            raise RuntimeError(f"M5/S0 yaniti basarisiz: {first}, {second}")
        self._append_log("GUVENLIK: M5 ve S0 dogrulandi.")

    def _safety_stop(self) -> None:
        """Is basarisiz bittiginde lazeri garantiye al: soft reset planlayiciyi
        bosaltir ve lazeri kapatir. M3 modunda duran kafa + acik lazer yangin
        riskidir; hata yolunda asla lazer acik birakilmaz."""
        try:
            if self._is_connected_unlocked():
                self._write_serial(b"\x18")
                self._serial.flush()
                self._append_log("GUVENLIK: soft reset gonderildi (lazer kapatildi).")
        except Exception:
            pass

    def _ensure_operator_ready(self) -> None:
        self._ensure_no_active_job()
        try:
            self.query_status()
        except Exception as exc:
            raise ValueError(f"Makine durumu dogrulanamadi: {exc}") from exc
        with self._lock:
            state = str(self._last_status.get("state", ""))
            status_age = time.monotonic() - self._last_status_at if self._last_status_at else float("inf")
        normalized = state.split(":", 1)[0].strip().lower()
        if status_age > 2.0:
            raise ValueError("Makine durumu 2 saniyeden eski; hareket komutu engellendi.")
        if normalized != "idle":
            visible = state or "bilinmiyor"
            raise ValueError(f"Makine tam Idle durumda degil ({visible}); hareket veya lazer komutu engellendi.")

    def _ensure_no_active_job(self) -> None:
        self._require_connected()
        with self._lock:
            if self._job.get("running") or self._job.get("paused"):
                raise ValueError("Makinede calisan is varken bu komut gonderilemez.")

    def _send_command_wait(self, command: str, timeout: float, allow_abort: bool = True) -> str:
        self._require_connected()
        with self._io_lock:
            with self._lock:
                abortable_wait = bool(self._job.get("running")) and bool(allow_abort)
            self._append_log(f"> {command}")
            self._write_serial((command.strip() + "\n").encode("ascii", errors="ignore"))
            deadline = time.monotonic() + timeout
            last_line = ""
            while time.monotonic() < deadline:
                if abortable_wait and self._abort_requested:
                    raise RuntimeError("G-code gonderimi iptal edildi.")
                if self._paused:
                    # Feed hold sirasinda hareket bitmez, ok gelmez; sayaci
                    # dondur ki uzun duraklatma isi zaman asimiyla dusurmesin.
                    deadline = time.monotonic() + timeout
                line = self._readline()
                if not line:
                    continue
                last_line = line
                self._append_log(f"< {line}")
                if line.startswith("<"):
                    parsed = parse_status_line(line)
                    if parsed:
                        with self._lock:
                            self._last_status = parsed
                            self._last_status_at = time.monotonic()
                    continue
                lower = line.lower()
                if lower == "ok" or lower.startswith("error") or lower.startswith("alarm"):
                    return lower
            raise TimeoutError(f"Makine yaniti zaman asimi: {command} {last_line}".strip())

    def _read_available(self, duration: float = 0.2) -> None:
        if not self._is_connected_unlocked():
            return
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            line = self._readline()
            if not line:
                continue
            self._append_log(f"< {line}")
            if line.startswith("<"):
                parsed = parse_status_line(line)
                if parsed:
                    with self._lock:
                        self._last_status = parsed
                        self._last_status_at = time.monotonic()

    def _readline(self) -> str:
        if self._serial is None:
            return ""
        try:
            raw = self._serial.readline()
        except Exception as exc:
            raise ValueError(f"Seri port okuma hatasi: {exc}") from exc
        if not raw:
            return ""
        return raw.decode("utf-8", errors="ignore").strip()

    def _write_realtime(self, payload: bytes) -> None:
        self._write_serial(payload)

    def _write_serial(self, payload: bytes) -> None:
        self._require_connected()
        try:
            with self._write_lock:
                written = self._serial.write(payload)
                if written is not None and written != len(payload):
                    raise TimeoutError(f"{written}/{len(payload)} byte yazildi")
        except Exception as exc:
            message = str(exc) or exc.__class__.__name__
            is_timeout = "timeout" in message.lower() or "zaman" in message.lower() or exc.__class__.__name__ == "SerialTimeoutException"
            if is_timeout:
                raise ValueError(
                    f"Seri port yazma zaman asimi ({self._port}). "
                    "USB kablo/port, baud veya portu kullanan baska bir uygulama kontrol edilmeli: "
                    f"{message}"
                ) from exc
            raise ValueError(f"Seri port yazma hatasi ({self._port}): {message}") from exc

    def _append_log(self, message: str) -> None:
        with self._lock:
            stamp = time.strftime("%H:%M:%S")
            self._log.append(f"{stamp} {message}")

    def _laser_mode_enabled(self) -> bool:
        with self._lock:
            value = self._settings.get("32")
        return value == 1.0

    def _required_setting(self, number: str, label: str) -> float:
        with self._lock:
            value = self._settings.get(str(number))
        if value is None or not isfinite(float(value)):
            raise ValueError(f"Makine {label} ayari (${number}) okunamadi.")
        return float(value)

    def _validate_machine_bounds(self, bounds: dict[str, Any]) -> None:
        travel_x = self._required_setting("130", "X hareket siniri")
        travel_y = self._required_setting("131", "Y hareket siniri")
        box = normalize_bounds(bounds)
        if box["minX"] < -1e-6 or box["minY"] < -1e-6:
            raise ValueError("Hareket siniri makine sifirinin disina tasiyor.")
        if box["maxX"] > travel_x + 1e-6:
            raise ValueError(f"X siniri asiliyor: {box['maxX']:.3f} > ${130}={travel_x:.3f} mm.")
        if box["maxY"] > travel_y + 1e-6:
            raise ValueError(f"Y siniri asiliyor: {box['maxY']:.3f} > ${131}={travel_y:.3f} mm.")

    def _validate_laser_settings(self) -> tuple[float, float, float]:
        laser_mode = self._required_setting("32", "lazer modu")
        if laser_mode != 1.0:
            raise ValueError("Lazer isi icin GRBL $32=1 olmali.")
        max_s = self._required_setting("30", "maksimum guc")
        if max_s <= 0:
            raise ValueError("GRBL $30 maksimum guc ayari 0'dan buyuk olmali.")
        travel_x = self._required_setting("130", "X hareket siniri")
        travel_y = self._required_setting("131", "Y hareket siniri")
        return max_s, travel_x, travel_y

    def _machine_warnings(self) -> list[str]:
        warnings: list[str] = []
        if "32" not in self._settings:
            warnings.append("GRBL $32 ayari okunamadi; feed hold sirasinda lazer davranisini makinede dogrulayin.")
        elif self._settings.get("32") != 1.0:
            warnings.append("GRBL $32 lazer modu kapali gorunuyor; is gondermeden once $32=1 oldugunu dogrulayin.")
        if float(self._settings.get("30") or 0.0) <= 0:
            warnings.append("GRBL $30 maksimum guc ayari okunamadi veya gecersiz.")
        if float(self._settings.get("130") or 0.0) <= 0 or float(self._settings.get("131") or 0.0) <= 0:
            warnings.append("GRBL $130/$131 hareket sinirlari okunamadi veya gecersiz.")
        return warnings

    def _require_connected(self) -> None:
        if not self._is_connected_unlocked():
            raise ValueError("Makine bagli degil.")

    def _is_connected_unlocked(self) -> bool:
        return self._serial is not None and bool(getattr(self._serial, "is_open", False))

    @staticmethod
    def _empty_job() -> dict[str, Any]:
        return {
            "running": False,
            "paused": False,
            "total": 0,
            "sent": 0,
            "ok": 0,
            "errors": 0,
            "currentLine": "",
            "message": "",
            "startedAt": None,
            "finishedAt": None,
        }
