#!/usr/bin/env python3
"""Local server for the visual laser job editor."""

from __future__ import annotations

import json
import mimetypes
import socket
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote

import laser_editor_core as core


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "laser_editor"
DEFAULT_DIR = Path("D:/SolidÇalışmalarım")


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
                ("Desen", "*.png *.jpg *.jpeg *.bmp *.svg *.PNG *.JPG *.JPEG *.BMP *.SVG"),
                ("All files", "*.*"),
            ],
        )
    finally:
        root.destroy()


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
            elif self.path == "/api/save-gcode-dialog":
                output = choose_gcode_output()
                self._json({"path": output})
            elif self.path == "/api/generate":
                state = self._read_json()
                result = core.generate_from_state(state)
                self._json({"ok": True, "result": result})
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
        filename = payload.get("path") or choose_raster_image_file()
        if not filename:
            self._json({"ok": True, "vector": None})
            return
        vector = core.vectorize_image(
            Path(filename),
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
        self._json({"ok": True, "vector": vector})

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
    port = find_port()
    server = HTTPServer(("127.0.0.1", port), LaserEditorHandler)
    url = f"http://127.0.0.1:{port}/"
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    print(f"Lazer editor acildi: {url}")
    print("Kapatmak icin bu pencereyi kapatin veya Ctrl+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatiliyor...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
