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


def gcode_lines_from_file(path: str | Path) -> list[str]:
    source = Path(path)
    if not source.exists() or not source.is_file():
        raise ValueError(f"G-code dosyasi bulunamadi: {source}")
    return [line for line in (clean_gcode_line(item) for item in source.read_text(encoding="utf-8").splitlines()) if line]


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


GCODE_WORD_RE = re.compile(r"([A-Za-z])([-+]?[0-9]*\.?[0-9]+)")
GRBL_SETTING_RE = re.compile(r"^\$(\d+)\s*=\s*(-?\d+(?:\.\d+)?)")


def gcode_uses_m3(lines: list[str]) -> bool:
    for raw in lines:
        line = clean_gcode_line(raw).upper()
        for letter, value_text in GCODE_WORD_RE.findall(line):
            if letter == "M" and int(float(value_text)) == 3:
                return True
    return False


def analyze_gcode(lines: list[str], rapid_feed: float = 6000.0) -> dict[str, Any]:
    """Onizleme + sure tahmini icin G-code'u coz.

    Donus: segments=[x1,y1,x2,y2,mod(0=bos,1=kesim),satirIndex], bounds,
    cutLength/travelLength (mm), estimatedSeconds, lineSeconds (satir bazli
    kumulatif sure -> kalan sure hesabi icin).
    """
    segments: list[list[float]] = []
    line_seconds: list[float] = []
    x = y = 0.0
    absolute = True
    feed = rapid_feed
    power = 0.0
    laser_on = False
    modal_motion: int | None = None
    cut_length = travel_length = 0.0
    total_seconds = 0.0
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    uses_m3 = False
    uses_m4 = False

    for index, raw in enumerate(lines):
        line = clean_gcode_line(raw).upper()
        elapsed_before = total_seconds
        if line:
            target_x: float | None = None
            target_y: float | None = None
            motion = None
            for letter, value_text in GCODE_WORD_RE.findall(line):
                value = float(value_text)
                if letter == "G":
                    code = int(value)
                    if code in (0, 1, 2, 3):
                        motion = code
                    elif code == 90:
                        absolute = True
                    elif code == 91:
                        absolute = False
                elif letter == "M":
                    code = int(value)
                    if code in (3, 4):
                        laser_on = True
                        uses_m3 = uses_m3 or code == 3
                        uses_m4 = uses_m4 or code == 4
                    elif code == 5:
                        laser_on = False
                elif letter == "F":
                    feed = max(1.0, value)
                elif letter == "S":
                    power = value
                elif letter == "X":
                    target_x = value
                elif letter == "Y":
                    target_y = value
            if motion is not None:
                modal_motion = motion
            if (target_x is not None or target_y is not None) and modal_motion is not None:
                new_x = x if target_x is None else (target_x if absolute else x + target_x)
                new_y = y if target_y is None else (target_y if absolute else y + target_y)
                distance = ((new_x - x) ** 2 + (new_y - y) ** 2) ** 0.5
                if distance > 1e-9:
                    is_cut = modal_motion in (1, 2, 3) and laser_on and power > 0
                    move_feed = feed if modal_motion in (1, 2, 3) else rapid_feed
                    total_seconds += distance / max(1.0, move_feed) * 60.0
                    if is_cut:
                        cut_length += distance
                    else:
                        travel_length += distance
                    segments.append([
                        round(x, 3), round(y, 3), round(new_x, 3), round(new_y, 3),
                        1 if is_cut else 0, index,
                    ])
                    for px, py in ((x, y), (new_x, new_y)):
                        min_x = min(min_x, px); max_x = max(max_x, px)
                        min_y = min(min_y, py); max_y = max(max_y, py)
                x, y = new_x, new_y
        line_seconds.append(round(total_seconds - elapsed_before, 4))

    if min_x > max_x:
        min_x = min_y = max_x = max_y = 0.0
    return {
        "segments": segments,
        "bounds": {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y,
                   "width": max_x - min_x, "height": max_y - min_y},
        "cutLength": round(cut_length, 1),
        "travelLength": round(travel_length, 1),
        "estimatedSeconds": round(total_seconds, 1),
        "lineSeconds": line_seconds,
        "lineCount": len(lines),
        "usesM3": uses_m3,
        "usesM4": uses_m4,
    }


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

    def list_ports(self) -> dict[str, Any]:
        if not pyserial_available():
            return {
                "available": False,
                "ports": [],
                "error": "pyserial kurulu degil. `pip install pyserial` gerekli.",
            }
        ports = [serial_port_payload(port) for port in list_ports.comports()]
        ports.sort(key=lambda item: (int(item.get("score") or 0), str(item.get("device") or "")), reverse=True)
        preferred = next((port["device"] for port in ports if port.get("likelyLaser")), ports[0]["device"] if ports else "")
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
                "settings": dict(self._settings),
                "warnings": list(self._warnings),
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
        min_x = box["minX"]
        min_y = box["minY"]
        max_x = box["maxX"]
        max_y = box["maxY"]
        commands = [
            "M5",
            "S0",
            "G90",
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
        if gcode_uses_m3(clean_lines) and not self._laser_mode_enabled():
            self._append_log("UYARI: G-code M3 kullaniyor; GRBL $32=1 degilse feed hold lazeri kapatmayabilir.")
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
            with self._lock:
                self._job["running"] = False
                self._job["paused"] = False
                self._job["message"] = "G-code gonderimi tamamlandi."
                self._job["finishedAt"] = time.time()
            self._append_log("G-code gonderimi tamamlandi.")
        except Exception as exc:  # background worker boundary
            self._safety_stop()
            with self._lock:
                self._job["running"] = False
                self._job["paused"] = False
                self._job["errors"] = int(self._job.get("errors") or 0) + 1
                self._job["message"] = str(exc)
                self._job["finishedAt"] = time.time()
            self._append_log(f"HATA: {exc}")

    def _safety_stop(self) -> None:
        """Is basarisiz bittiginde lazeri garantiye al: soft reset planlayiciyi
        bosaltir ve lazeri kapatir. M3 modunda duran kafa + acik lazer yangin
        riskidir; hata yolunda asla lazer acik birakilmaz."""
        try:
            if self._is_connected_unlocked() and not self._abort_requested:
                self._write_serial(b"\x18")
                self._serial.flush()
                self._append_log("GUVENLIK: soft reset gonderildi (lazer kapatildi).")
        except Exception:
            pass

    def _ensure_operator_ready(self) -> None:
        self._ensure_no_active_job()
        try:
            self.query_status()
        except Exception:
            pass
        with self._lock:
            state = str(self._last_status.get("state", "")).lower()
        if state.startswith("alarm"):
            raise ValueError("Makine ALARM durumunda. Once $X (kilit ac) veya $H (home) gerekli.")
        if state.startswith("hold"):
            raise ValueError("Makine duraklatilmis (Hold). Once ~ (devam) gonderin.")
        if state.startswith("run"):
            raise ValueError("Makine hareket halinde. Komut icin once durmasini bekleyin.")

    def _ensure_no_active_job(self) -> None:
        self._require_connected()
        with self._lock:
            if self._job.get("running") or self._job.get("paused"):
                raise ValueError("Makinede calisan is varken bu komut gonderilemez.")

    def _send_command_wait(self, command: str, timeout: float) -> str:
        self._require_connected()
        with self._io_lock:
            with self._lock:
                abortable_wait = bool(self._job.get("running"))
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

    def _machine_warnings(self) -> list[str]:
        warnings: list[str] = []
        if "32" not in self._settings:
            warnings.append("GRBL $32 ayari okunamadi; feed hold sirasinda lazer davranisini makinede dogrulayin.")
        elif self._settings.get("32") != 1.0:
            warnings.append("GRBL $32 lazer modu kapali gorunuyor; is gondermeden once $32=1 oldugunu dogrulayin.")
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
