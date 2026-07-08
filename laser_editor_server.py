#!/usr/bin/env python3
"""Local server for the visual laser job editor."""

from __future__ import annotations

import json
import base64
import mimetypes
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
        with DIALOG_LOCK:
            return func(*args, **kwargs)

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
def choose_gcode_output() -> str:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    try:
        return filedialog.asksaveasfilename(
            title="G-code çıktısı",
            initialdir=str(DEFAULT_DIR if DEFAULT_DIR.exists() else Path.home()),
            initialfile="laser_job.nc",
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
    return {
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


class LaserEditorHandler(BaseHTTPRequestHandler):
    server_version = "LaserEditor/1.0"

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path.startswith("/?"):
            self._serve_file(STATIC_DIR / "index.html")
            return
        if self.path == "/api/health":
            self._json({"ok": True})
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
            elif self.path == "/api/vectorize-image":
                self._vectorize_image()
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
                    path.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
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
                output = choose_gcode_output()
                self._json({"path": output})
            elif self.path == "/api/generate":
                state = self._read_json()
                result = core.generate_from_state(state)
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
                lines = laser_grbl.gcode_lines_from_file(payload.get("path"))
                self._json({"ok": True, "info": laser_grbl.analyze_gcode(lines)})
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
        filename = choose_image_file()
        if not filename:
            self._json({"ok": True, "image": None})
            return
        self._json({"ok": True, "image": core.image_payload(Path(filename))})

    def _vectorize_image(self) -> None:
        payload = self._read_json(optional=True)
        temp_path = None
        try:
            if payload.get("dataUrl"):
                source_path = image_data_url_to_temp_file(str(payload.get("dataUrl")))
                temp_path = source_path
            else:
                filename = payload.get("path") or choose_raster_image_file()
                if not filename:
                    self._json({"ok": True, "vector": None})
                    return
                source_path = Path(filename)
            if source_path.suffix.lower() == ".svg":
                self._json({"ok": True, "vector": svg_as_vector_payload(source_path)})
                return
            vector = core.vectorize_image(
                source_path,
                threshold=int(float(payload.get("threshold", 140))),
                threshold_mode=str(payload.get("thresholdMode", "manual")),
                mode=str(payload.get("mode", "auto")),
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
            if payload.get("name"):
                vector["name"] = str(payload.get("name"))
            self._json({"ok": True, "vector": vector})
        finally:
            if temp_path:
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass

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
