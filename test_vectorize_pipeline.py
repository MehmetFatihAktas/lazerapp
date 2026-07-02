import re
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

import laser_editor_core as core


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_filter_keeps_auto_removed_paths():
    paths = [
        {"points": [[0, 0], [100, 0], [100, 80], [0, 80]], "closed": True, "area": 10},
        {"points": [[20, 20], [80, 20]], "closed": False, "area": 0},
        {"points": [[40, 40]], "closed": False, "area": 0},
    ]

    filtered, stats = core.filter_vector_paths(paths, 100, 80, True, 20, "centerline")
    removed = [item for item in filtered if item.get("removed")]
    active = [item for item in filtered if not item.get("removed")]

    assert_true(len(filtered) == 3, "auto-filtered paths should remain in the model")
    assert_true(len(active) == 1, "one usable path should stay active")
    assert_true(len(removed) == 2, "border and too-short paths should be hidden")
    assert_true(stats["removedBorder"] == 1, "border-frame count should be reported")
    assert_true(stats["removedShortPost"] == 1, "too-short count should be reported")
    assert_true(removed[0].get("removedReason") == "border-frame", "border path should keep its reason")
    assert_true(removed[1].get("removedReason") == "too-short", "short path should keep its reason")


def test_vectorize_image_returns_debug_stages_and_metadata():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "line_art.png"
        image = Image.new("RGB", (180, 120), "white")
        draw = ImageDraw.Draw(image)
        draw.arc([25, 20, 155, 100], start=20, end=325, fill="black", width=4)
        draw.line([40, 82, 145, 82], fill="black", width=3)
        draw.rectangle([80, 42, 104, 66], outline="black", width=3)
        image.save(image_path)

        data = core.vectorize_image(
            image_path,
            mode="centerline",
            threshold_mode="otsu",
            threshold=128,
            min_length=4,
            remove_border=True,
            stitch_gap=3,
            simplify=0.5,
            max_contours=200,
        )

    paths = data["vectorPaths"]
    active_paths = [item for item in paths if not item.get("removed")]
    previews = data.get("debugPreviews", [])

    assert_true(active_paths, "centerline vectorization should produce active paths")
    assert_true(len(previews) >= 4, "gray, mask, cleaned mask and skeleton previews should be returned")
    assert_true(all(preview.get("dataUrl", "").startswith("data:image/png;base64,") for preview in previews), "debug previews should be PNG data URLs")
    assert_true(data["stats"]["pathsTotal"] >= data["stats"]["pathsKept"], "total path count should include hidden paths")

    sample = active_paths[0]
    for key in ("bbox", "touchesBorder", "warnings", "confidence", "sourceComponentId", "operation", "mode"):
        assert_true(key in sample, f"path metadata missing: {key}")


def test_background_normalization_rescues_gradient_photo():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "gradient_line_art.png"
        width, height = 180, 120
        image = Image.new("L", (width, height), 255)
        pixels = image.load()
        for y in range(height):
            for x in range(width):
                value = int(250 - 115 * (x / width) - 55 * (y / height))
                pixels[x, y] = max(80, min(255, value))
        draw = ImageDraw.Draw(image)
        draw.arc([34, 26, 146, 94], start=15, end=335, fill=25, width=4)
        draw.line([50, 82, 136, 82], fill=25, width=3)
        image.convert("RGB").save(image_path)

        flat = core.vectorize_image(
            image_path,
            mode="centerline",
            threshold_mode="otsu",
            threshold=140,
            blur=1,
            morph_close=2,
            min_length=5,
            simplify=0.55,
            max_contours=300,
            remove_border=True,
            stitch_gap=6,
            background_normalize=True,
        )

    assert_true(flat["stats"]["pathsKept"] > 0, "background normalization should prevent gradient photos from becoming empty")
    assert_true(any(item["name"] == "Isik Duzeltme" for item in flat["debugPreviews"]), "debug previews should show the normalized stage")


def test_large_filled_border_component_is_not_deleted_as_frame():
    binary = core.np.zeros((100, 160), dtype=core.np.uint8)
    core.cv2.rectangle(binary, (0, 0), (145, 85), 255, -1)

    cleaned, removed = core.clean_border_components(binary, True, margin=3)

    assert_true(removed == 0, "large filled objects near the border should not be treated as a thin frame")
    assert_true(int(core.np.count_nonzero(cleaned)) > 0, "large filled object should remain after border cleanup")


def test_centerline_stitches_junction_segments_before_filtering():
    binary = core.np.zeros((60, 70), dtype=core.np.uint8)
    core.cv2.line(binary, (10, 30), (58, 30), 255, 1)
    core.cv2.line(binary, (34, 16), (34, 30), 255, 1)

    paths, stats = core.trace_skeleton_vectors(
        binary,
        min_length=32,
        simplify=0.2,
        smooth=0,
        max_contours=20,
        stitch_gap=1.5,
    )

    active = [item for item in paths if not item.get("removed")]
    assert_true(active, "junction-split centerline should survive min-length filtering after stitch")
    assert_true(max(item["length"] for item in active) >= 45, "main horizontal stroke should be stitched through the junction")
    assert_true(stats["stitchedRaw"] > 0, "raw skeleton stitching should report a merge")


def test_skeleton_spur_pruning_removes_short_hairs():
    skeleton = core.np.zeros((80, 120), dtype=core.np.uint8)
    core.cv2.line(skeleton, (10, 40), (108, 40), 255, 1)
    for x in range(18, 104, 12):
        core.cv2.line(skeleton, (x, 40), (x + 3, 34), 255, 1)

    pruned, removed = core.prune_skeleton_spurs(skeleton, max_length=8, max_rounds=4)
    paths, stats = core.trace_skeleton_vectors(
        pruned,
        min_length=5,
        simplify=0.8,
        smooth=1,
        max_contours=20,
        stitch_gap=3,
        skeleton=pruned,
    )
    paths, merged = core.stitch_open_vector_paths(paths, 2)

    active = [item for item in paths if not item.get("removed")]
    short_paths = [item for item in active if item["length"] < 20]
    assert_true(removed > 0 or stats["skippedShort"] > 0, "short spur artifacts should be removed or skipped")
    # Capraz-baglanti duzeltmesinden sonra izleyici ana cizgiyi zaten tek
    # parca cikarabilir; dikis sayisi 0 olabilir. Onemli olan mekanizma degil
    # sonuc: ana cizgi butun kalmali, kil yollar kalmamali.
    assert_true(len(active) <= 2, "hairy single stroke should not become many separate paths")
    assert_true(not short_paths, "short hair paths should not survive as engrave lines")
    assert_true(max(item["length"] for item in active) >= 90, "main stroke should remain")


def test_centerline_solidify_collapses_double_edge_bands():
    binary = core.np.zeros((70, 130), dtype=core.np.uint8)
    core.cv2.line(binary, (12, 28), (116, 28), 255, 1)
    core.cv2.line(binary, (12, 34), (116, 34), 255, 1)

    solid = core.solidify_centerline_mask(binary, radius=3)
    skeleton = core.thin_binary(solid)
    paths, stats = core.trace_skeleton_vectors(
        solid,
        min_length=10,
        simplify=0.7,
        smooth=1,
        max_contours=20,
        stitch_gap=3,
        skeleton=skeleton,
    )
    paths, _merged = core.stitch_open_vector_paths(paths, 2)
    active = [item for item in paths if not item.get("removed")]

    assert_true(len(active) == 1, "two close edge bands should collapse into one centerline path")
    # Medial axis, yuvarlak kapak ucundan yarim-kalinlik iceride biter; bu
    # geometrik olarak dogrudur (104px bandin merkez cizgisi ~93px olur).
    assert_true(active[0]["length"] >= 90, "collapsed centerline should preserve the stroke length")
    ys = [point[1] for point in active[0]["points"]]
    avg_y = sum(ys) / len(ys)
    assert_true(29 <= avg_y <= 33, "collapsed centerline should run between the two edge bands")


def test_vtracer_mode_produces_laser_vector_paths():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "vtracer_shape.png"
        image = Image.new("RGB", (220, 150), "white")
        draw = ImageDraw.Draw(image)
        draw.ellipse([30, 28, 120, 118], outline="black", width=5)
        draw.polygon([(145, 32), (200, 75), (145, 118)], fill="black")
        image.save(image_path)

        data = core.vectorize_image(
            image_path,
            mode="vtracer",
            threshold_mode="otsu",
            blur=1,
            morph_close=2,
            min_length=5,
            simplify=0.55,
            max_contours=300,
            background_normalize=True,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    assert_true(active, "VTracer mode should produce active vector paths")
    assert_true(data["stats"].get("vtracerPathElements", 0) > 0, "VTracer SVG path count should be reported")
    assert_true(all(item.get("sourceEngine") == "vtracer" for item in active), "VTracer paths should be marked with their source engine")
    assert_true(all(len(item.get("points", [])) >= 2 for item in active), "VTracer paths should be converted to point lists for G-code")


def test_vtracer_polish_closes_short_mask_breaks():
    binary = core.np.zeros((45, 95), dtype=core.np.uint8)
    core.cv2.line(binary, (10, 23), (38, 23), 255, 3)
    core.cv2.line(binary, (45, 23), (82, 23), 255, 3)

    polished, stats = core.polish_trace_binary(binary, smooth=2, stitch_gap=8)

    assert_true(stats["tracePolishClose"] > 0, "VTracer polish should report the closing radius")
    assert_true(polished[23, 41] == 255, "short mask gaps should be closed before VTracer tracing")
    assert_true(core.np.count_nonzero(polished) >= core.np.count_nonzero(binary), "polish should not erase the main stroke")


def test_auto_mode_traces_photo_line_art_with_potrace():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "photo_line_art.jpg"
        image = Image.new("RGB", (220, 320), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle([8, 8, 212, 312], outline=(28, 28, 28), width=3)
        draw.arc([20, 20, 190, 180], start=10, end=330, fill=(50, 50, 50), width=3)
        draw.arc([30, 155, 205, 300], start=20, end=350, fill=(70, 70, 70), width=3)
        draw.line([25, 245, 195, 110], fill=(80, 80, 80), width=2)
        image.save(image_path, quality=92)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            min_length=4,
            simplify=0.55,
            smooth=2,
            max_contours=500,
            background_normalize=True,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    assert_true(active, "auto mode should produce usable vector paths")
    assert_true(data["stats"].get("traceEngine") == "potrace", "thin line art should use the Potrace-style trace engine")
    assert_true(data["stats"].get("potraceCurves", 0) > 0, "Potrace curve count should be reported")
    assert_true(not data["stats"].get("filledTraceInvert"), "thin line art should engrave the dark strokes, not the background")
    assert_true(all(item.get("sourceEngine") == "potrace" for item in active), "auto line-art paths should be marked as Potrace sourced")


def test_photo_line_art_uses_upscaled_ink_mask_without_background_fill():
    with TemporaryDirectory() as temp_dir:
        real_source = Path(r"C:\Users\mehme\Downloads\indir (6).jpg")
        if real_source.exists():
            image_path = real_source
        else:
            image_path = Path(temp_dir) / "spiral_line_art.jpg"
            image = Image.new("RGB", (190, 360), "white")
            draw = ImageDraw.Draw(image)
            draw.rectangle([8, 8, 182, 352], outline=(25, 25, 25), width=2)
            for offset in (0, 155):
                draw.arc([18, 18 + offset, 170, 175 + offset], start=15, end=355, fill=(42, 42, 42), width=2)
                draw.arc([45, 45 + offset, 150, 145 + offset], start=35, end=320, fill=(50, 50, 50), width=2)
                draw.ellipse([88, 76 + offset, 116, 104 + offset], outline=(45, 45, 45), width=2)
            draw.line([18, 180, 172, 250], fill=(55, 55, 55), width=2)
            image.save(image_path, quality=92)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            min_length=4,
            simplify=0.55,
            smooth=2,
            max_contours=1200,
            background_normalize=True,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    stats = data["stats"]
    assert_true(active, "line-art ink-mask trace should produce active paths")
    assert_true(stats.get("lineArtTrace"), "line-art should use the ink-mask trace path")
    assert_true(stats.get("lineArtUpscale", 1) >= 2, "small line-art should be upscaled before contour tracing")
    assert_true(not stats.get("filledTraceInvert"), "white paper/background must not be engraved as filled output")
    assert_true(stats.get("filledTraceRatio", 1) < 0.25, "filled line-art area should stay close to ink coverage")
    assert_true(stats.get("lineArtForegroundRatio", 1) < 0.30, "foreground mask should not swallow the white background")


def test_potrace_polish_removes_short_spike_without_losing_main_corners():
    points = [
        [0, 0],
        [8, 0],
        [16, 0.5],
        [18, 4.5],
        [20, 0.8],
        [30, 0],
        [40, 0],
        [40, 18],
        [0, 18],
    ]

    polished, stats = core.polish_potrace_paths(
        [{"points": points, "closed": True, "removed": False}],
        smooth=2,
        simplify=0.55,
    )
    cleaned = polished[0]["points"]

    assert_true(stats["potraceSpikePointsRemoved"] >= 1, "short cusp spike should be removed from Potrace contours")
    assert_true(max(point[1] for point in cleaned if 12 <= point[0] <= 24) < 2.0, "cleaned top edge should not keep the spike tip")
    assert_true(any(abs(point[0] - 40) < 0.01 and abs(point[1] - 18) < 0.01 for point in cleaned), "real rectangular corner should remain")


def test_restore_hollowed_fills_keeps_light_holes_open():
    base = core.np.full((90, 120), 235, dtype=core.np.uint8)
    core.cv2.rectangle(base, (20, 18), (100, 72), 35, -1)
    core.cv2.circle(base, (60, 45), 12, 235, -1)

    binary = core.np.zeros((90, 120), dtype=core.np.uint8)
    core.cv2.rectangle(binary, (20, 18), (100, 72), 255, 2)
    core.cv2.circle(binary, (60, 45), 12, 255, 1)

    restored = core.restore_hollowed_fills(binary, base, invert=True)

    assert_true(restored[30, 30] == 255, "dark filled interior should be restored")
    assert_true(restored[45, 60] == 0, "true light hole should remain open")


def test_vtracer_svg_import_skips_light_fill_paths():
    with TemporaryDirectory() as temp_dir:
        svg_path = Path(temp_dir) / "fills.svg"
        svg_path.write_text(
            """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">
  <path fill="rgb(249,249,249)" d="M0 0 L100 0 L100 80 L0 80 Z"/>
  <path fill="rgb(90,90,90)" d="M20 20 L80 20 L80 60 L20 60 Z"/>
</svg>""",
            encoding="utf-8",
        )
        paths, stats = core.svg_file_to_vector_paths(svg_path, min_length=1, simplify=0.1, max_contours=20, skip_light_fills=True)

    assert_true(len(paths) == 1, "white VTracer background path should be skipped")
    assert_true(stats["skippedLightFill"] == 1, "skipped light fill count should be reported")
    assert_true(paths[0]["area"] > 0, "black shape path should remain usable")


def test_inset_frame_sides_are_hidden_not_deleted():
    paths = [
        {"points": [[6, 5], [94, 5]], "closed": False, "area": 0},
        {"points": [[20, 30], [80, 30]], "closed": False, "area": 0},
    ]

    filtered, stats = core.filter_vector_paths(paths, 100, 80, True, 0, "centerline")

    assert_true(len(filtered) == 2, "frame side should stay restorable in the model")
    assert_true(filtered[0].get("removed"), "inset top frame side should be auto-hidden")
    assert_true(filtered[0].get("removedReason") == "border-frame", "frame side should keep a border-frame reason")
    assert_true(not filtered[1].get("removed"), "normal inner stroke should remain active")
    assert_true(stats["removedBorder"] == 1, "hidden frame side should be counted")


def test_svg_export_skips_removed_paths():
    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "vector.svg"
        vector_paths = [
            {"points": [[0, 0], [30, 0], [30, 20]], "closed": False, "removed": False},
            {"points": [[0, 0], [100, 0], [100, 80], [0, 80]], "closed": True, "removed": True},
        ]

        result = core.write_vector_svg(output_path, vector_paths, 100, 80)
        text = output_path.read_text(encoding="utf-8")

    assert_true(result["pathCount"] == 1, "only active paths should be exported")
    assert_true(text.count("<path") == 1, "removed paths should not be written to SVG")


def test_svg_export_can_write_filled_compound_paths():
    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "filled-vector.svg"
        vector_paths = [
            {"points": [[0, 0], [100, 0], [100, 80], [0, 80]], "closed": True, "removed": False},
            {"points": [[30, 20], [70, 20], [70, 60], [30, 60]], "closed": True, "removed": False},
        ]

        result = core.write_vector_svg(output_path, vector_paths, 100, 80, fill_mode=True)
        text = output_path.read_text(encoding="utf-8")

    assert_true(result["fillMode"], "filled export should report fill mode")
    assert_true('fill-rule="evenodd"' in text, "filled export should preserve holes with evenodd rule")
    assert_true('fill="black"' in text and 'stroke="none"' in text, "filled export should use filled compound geometry")


def test_svg_export_can_invert_filled_compound_paths():
    with TemporaryDirectory() as temp_dir:
        output_path = Path(temp_dir) / "inverted-filled-vector.svg"
        vector_paths = [
            {"points": [[20, 20], [80, 20], [80, 60], [20, 60]], "closed": True, "removed": False},
        ]

        result = core.write_vector_svg(output_path, vector_paths, 100, 80, fill_mode=True, fill_invert=True)
        text = output_path.read_text(encoding="utf-8")

    assert_true(result["fillInvert"], "filled export should report inverted fill mode")
    assert_true("M 0 0 L 100 0 L 100 80 L 0 80 Z" in text, "inverted fill should prepend the page rectangle")
    assert_true('fill-rule="evenodd"' in text, "inverted fill should use evenodd rule")


def test_vector_fill_scan_segments_support_inverted_fill():
    paths = [
        {"points": [[10, 10], [20, 10], [20, 20], [10, 20]], "closed": True, "removed": False},
    ]

    normal = core.vector_fill_scan_segments(paths, 30, 30, 10, fill_invert=False)
    inverted = core.vector_fill_scan_segments(paths, 30, 30, 10, fill_invert=True)

    assert_true(any(abs(a[0] - 10) < 1e-6 and abs(b[0] - 20) < 1e-6 for a, b in normal), "normal fill should engrave inside the square")
    assert_true(any(abs(a[0] - 0) < 1e-6 and abs(b[0] - 10) < 1e-6 for a, b in inverted), "inverted fill should engrave before the hole")
    assert_true(any(abs(a[0] - 20) < 1e-6 and abs(b[0] - 30) < 1e-6 for a, b in inverted), "inverted fill should engrave after the hole")


def test_potrace_vector_gcode_uses_fill_scanlines():
    item = {
        "path": "vector",
        "name": "filled-vector",
        "x": 0,
        "y": 0,
        "width": 30,
        "height": 30,
        "rotation": 0,
        "power": 250,
        "feed": 1000,
        "lineStep": 10,
        "sourceWidth": 30,
        "sourceHeight": 30,
        "vectorEngraveMode": "fill",
        "vectorStats": {"traceEngine": "potrace", "filledTraceInvert": True},
        "vectorPaths": [
            {"points": [[10, 10], [20, 10], [20, 20], [10, 20]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")

    assert_true(any("vector fill end" in line for line in lines), "Potrace vectors should use fill scanline engraving")
    assert_true(sum(1 for line in lines if line.startswith("S250")) >= 2, "fill scanlines should create multiple powered moves")


def test_potrace_vector_engrave_defaults_to_contours():
    item = {
        "path": "vector",
        "name": "filled-vector-contour",
        "x": 0,
        "y": 0,
        "width": 30,
        "height": 30,
        "rotation": 0,
        "power": 250,
        "feed": 1000,
        "lineStep": 10,
        "sourceWidth": 30,
        "sourceHeight": 30,
        "vectorStats": {"traceEngine": "potrace", "filledTraceInvert": False},
        "vectorPaths": [
            {"points": [[10, 10], [20, 10], [20, 20], [10, 20]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")

    assert_true(not any("vector fill end" in line for line in lines), "default Potrace engraving should follow contours, not hatch-fill")
    assert_true(sum(1 for line in lines if line.startswith("S250")) == 1, "default contour engraving should power once per path")


def test_potrace_vector_cut_uses_contours_not_fill_scanlines():
    item = {
        "path": "vector",
        "name": "filled-vector-cut",
        "x": 0,
        "y": 0,
        "width": 30,
        "height": 30,
        "rotation": 0,
        "power": 900,
        "feed": 500,
        "lineStep": 1,
        "sourceWidth": 30,
        "sourceHeight": 30,
        "vectorStats": {"traceEngine": "potrace", "filledTraceInvert": False},
        "vectorPaths": [
            {"points": [[10, 10], [20, 10], [20, 20], [10, 20]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="cut")

    assert_true(any("(cut vector filled-vector-cut" in line for line in lines), "cut operation should be labelled as vector cut")
    assert_true(not any("vector fill end" in line for line in lines), "cut operation must not create fill scanlines")
    assert_true(sum(1 for line in lines if line.startswith("S900")) == 1, "cut contour should power once per path, not every hatch row")


def gcode_xy_points(lines):
    points = []
    for line in lines:
        match = re.search(r"\b[GX][0-9]+\s+X(-?\d+(?:\.\d+)?)\s+Y(-?\d+(?:\.\d+)?)", line)
        if match:
            points.append((float(match.group(1)), float(match.group(2))))
    return points


def test_clip_segment_respects_part_margin():
    region = core.ClipRegion([[(0, 0), (10, 0), (10, 10), (0, 10)]], margin=2)

    clipped = core.clip_segment_to_region((-5, 5), (15, 5), region, step=0.25)

    assert_true(len(clipped) == 1, "crossing line should become one clipped segment")
    start, end = clipped[0]
    assert_true(1.75 <= start[0] <= 2.25, f"clipped start should respect left margin, got {start}")
    assert_true(7.75 <= end[0] <= 8.25, f"clipped end should respect right margin, got {end}")
    assert_true(abs(start[1] - 5) < 1e-6 and abs(end[1] - 5) < 1e-6, "clipping should keep segment y")


def test_vector_gcode_is_clipped_to_part_margin():
    item = {
        "path": "vector",
        "name": "oversized-vector",
        "x": 0,
        "y": 0,
        "width": 20,
        "height": 10,
        "rotation": 0,
        "power": 250,
        "feed": 1000,
        "lineStep": 1,
        "sourceWidth": 20,
        "sourceHeight": 10,
        "vectorPaths": [
            {"points": [[-5, 5], [25, 5]], "closed": False, "removed": False},
        ],
    }
    region = core.ClipRegion([[(0, 0), (20, 0), (20, 10), (0, 10)]], margin=2)

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave", clip_region=region)
    points = gcode_xy_points(lines)

    assert_true(points, "clipped vector should still emit gcode inside the part")
    assert_true(all(1.7 <= x <= 18.3 for x, _y in points), f"gcode x points should stay inside margin: {points}")
    assert_true(all(2.0 <= y <= 8.0 for _x, y in points), f"gcode y points should stay inside margin: {points}")


def test_svg_gcode_is_clipped_to_part_margin():
    with TemporaryDirectory() as temp_dir:
        svg_path = Path(temp_dir) / "oversized.svg"
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10">'
            '<path d="M -5 5 L 25 5" />'
            '</svg>',
            encoding="utf-8",
        )
        pattern = core.RasterPattern(
            path=svg_path,
            x=0,
            y=0,
            width=20,
            height=10,
            rotation=0,
            power=250,
            feed=1000,
            line_step=1,
            threshold=140,
        )
        region = core.ClipRegion([[(0, 0), (20, 0), (20, 10), (0, 10)]], margin=2)

        lines = core.build_svg_vector_engrave_lines(pattern, travel_feed=3000, operation="engrave", clip_region=region)

    points = gcode_xy_points(lines)
    assert_true(points, "clipped SVG should still emit gcode inside the part")
    assert_true(all(1.7 <= x <= 18.3 for x, _y in points), f"svg gcode x points should stay inside margin: {points}")


def main():
    tests = [
        test_filter_keeps_auto_removed_paths,
        test_vectorize_image_returns_debug_stages_and_metadata,
        test_background_normalization_rescues_gradient_photo,
        test_large_filled_border_component_is_not_deleted_as_frame,
        test_centerline_stitches_junction_segments_before_filtering,
        test_skeleton_spur_pruning_removes_short_hairs,
        test_centerline_solidify_collapses_double_edge_bands,
        test_vtracer_mode_produces_laser_vector_paths,
        test_vtracer_polish_closes_short_mask_breaks,
        test_auto_mode_traces_photo_line_art_with_potrace,
        test_photo_line_art_uses_upscaled_ink_mask_without_background_fill,
        test_potrace_polish_removes_short_spike_without_losing_main_corners,
        test_restore_hollowed_fills_keeps_light_holes_open,
        test_vtracer_svg_import_skips_light_fill_paths,
        test_inset_frame_sides_are_hidden_not_deleted,
        test_svg_export_skips_removed_paths,
        test_svg_export_can_write_filled_compound_paths,
        test_svg_export_can_invert_filled_compound_paths,
        test_vector_fill_scan_segments_support_inverted_fill,
        test_potrace_vector_gcode_uses_fill_scanlines,
        test_potrace_vector_engrave_defaults_to_contours,
        test_potrace_vector_cut_uses_contours_not_fill_scanlines,
        test_clip_segment_respects_part_margin,
        test_vector_gcode_is_clipped_to_part_margin,
        test_svg_gcode_is_clipped_to_part_margin,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All vector pipeline tests passed.")


if __name__ == "__main__":
    main()
