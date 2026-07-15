import copy
import math
import re
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

import laser_editor_core as core


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def write_rect_dxf(path, width=20, height=10):
    path.write_text(
        "\n".join(
            [
                "0",
                "SECTION",
                "2",
                "ENTITIES",
                "0",
                "LWPOLYLINE",
                "90",
                "4",
                "70",
                "1",
                "10",
                "0",
                "20",
                "0",
                "10",
                str(width),
                "20",
                "0",
                "10",
                str(width),
                "20",
                str(height),
                "10",
                "0",
                "20",
                str(height),
                "0",
                "ENDSEC",
                "0",
                "EOF",
            ]
        ),
        encoding="utf-8",
    )


def base_generation_settings():
    return {
        "bedWidth": 60,
        "bedHeight": 40,
        "margin": 2,
        "gap": 3,
        "quantity": 1,
        "allowRotate": True,
        "feed": 500,
        "power": 900,
        "travelFeed": 3000,
        "engravePower": 250,
        "engraveFeed": 1800,
        "passes": 1,
        "laserCmd": "M4",
        "innerFirst": True,
        "tolerance": 0.25,
        "joinTolerance": 0.05,
    }


def assert_raises_contains(func, text):
    try:
        func()
    except Exception as exc:
        assert_true(text in str(exc), f"expected error containing {text!r}, got {exc!r}")
        return
    raise AssertionError(f"expected error containing {text!r}")


def test_toolpath_optimizer_reduces_empty_travel_and_reverses_open_paths():
    paths = [
        [(90.0, 0.0), (100.0, 0.0)],
        [(20.0, 0.0), (10.0, 0.0)],
        [(60.0, 0.0), (50.0, 0.0)],
    ]
    before = core.toolpath_travel_distance(paths)
    optimized = core.optimize_toolpaths(paths)
    after = core.toolpath_travel_distance(optimized)

    assert_true(after < before * 0.4, f"expected substantial travel reduction, before={before}, after={after}")
    assert_true(optimized[0][0] == (10.0, 0.0), "nearest open path must be allowed to run in reverse")
    original_segments = {frozenset(path) for path in paths}
    optimized_segments = {frozenset(path) for path in optimized}
    assert_true(original_segments == optimized_segments, "optimizer must not change open-path geometry")


def test_cut_toolpath_optimizer_keeps_outer_contour_last():
    outer = [(0.0, 0.0), (100.0, 0.0), (100.0, 100.0), (0.0, 100.0), (0.0, 0.0)]
    hole = [(20.0, 20.0), (40.0, 20.0), (40.0, 40.0), (20.0, 40.0), (20.0, 20.0)]
    open_detail = [(80.0, 80.0), (85.0, 85.0)]
    optimized = core.optimize_toolpaths([outer, hole, open_detail], inner_first=True)

    assert_true(optimized[0][0] in open_detail, "open cut details must run before releasing closed contours")
    assert_true(abs(core.polygon_signed_area(optimized[-1][:-1])) == 10000.0, "outer contour must remain last")
    assert_true(optimized[-1][0] == optimized[-1][-1], "closed contour must remain closed after rotation")


def test_embedded_vector_builder_uses_optimized_path_order():
    item = {
        "path": "synthetic-vector.svg",
        "name": "route test",
        "kind": "vector",
        "operation": "engrave_line",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 100,
        "sourceWidth": 100,
        "sourceHeight": 100,
        "power": 250,
        "feed": 1800,
        "vectorPaths": [
            {"id": "far", "points": [[90, 50], [100, 50]], "closed": False, "operation": "engrave_line"},
            {"id": "near", "points": [[20, 50], [10, 50]], "closed": False, "operation": "engrave_line"},
            {"id": "middle", "points": [[60, 50], [50, 50]], "closed": False, "operation": "engrave_line"},
        ],
    }
    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000)
    emitted = list(core.iter_powered_toolpaths_from_gcode(lines))

    assert_true(len(emitted) == 3, "all vector paths must still be emitted")
    assert_true(emitted[0][0][0] == 10.0, "nearest path endpoint should be emitted first")
    assert_true(core.toolpath_travel_distance(emitted) < 130.0, "builder must use optimized route, not source order")


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


def test_cad_centerline_mode_returns_single_line_metadata():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "cad-line-art.png"
        image = Image.new("RGB", (240, 180), "white")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle([15, 15, 225, 165], radius=28, outline="black", width=5)
        draw.ellipse([65, 45, 175, 145], outline="black", width=5)
        draw.line([28, 90, 210, 90], fill="black", width=5)
        draw.ellipse([112, 58, 117, 63], fill="black")
        image.save(image_path)

        data = core.vectorize_image(
            image_path,
            mode="cad_centerline",
            threshold_mode="otsu",
            blur=0,
            contrast=1.08,
            morph_close=1,
            simplify=0.9,
            smooth=3,
            min_area=4,
            min_length=3,
            max_contours=500,
            stitch_gap=0.5,
            remove_border=False,
            background_normalize=False,
            denoise=0,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    assert_true(active, "CAD centerline mode should produce usable paths")
    assert_true(data["stats"]["traceEngine"] == "centerline", "CAD line art must use the centerline engine")
    assert_true(data["stats"]["cadCenterline"] is True, "CAD centerline metadata should be explicit")
    assert_true(data["stats"].get("cadTraceScale", 1) >= 3.9, "small CAD details should use up to 4x high-resolution tracing")
    assert_true(data["stats"].get("cadTopologyPreserved") is True, "CAD tracing should preserve real short junction branches")
    assert_true(data["stats"].get("cadProximityWeldDisabled") is True, "CAD detail paths must not be proximity-welded")
    assert_true(data["stats"].get("prunedSpurPixels") == 0, "CAD tracing must not prune legitimate short connections")
    assert_true(data["settings"]["cadCenterline"] is True, "saved settings should preserve CAD centerline mode")
    assert_true(data["sourceWidth"] == 240 and data["sourceHeight"] == 180, "trace upscaling must not change source coordinates")
    assert_true(data["stats"]["modeMismatch"] is False, "CAD centerline must not be reported as a mode mismatch")
    assert_true(data["stats"].get("preservedDotDetails", 0) >= 1, "isolated eye/dot details should survive centerline thinning")
    assert_true(any("preserved-dot" in item.get("warnings", []) for item in active), "preserved dots should be identifiable")


def test_vector_region_classifier_supports_exterior_marked_and_frame_removal():
    paths = [
        {
            "id": "outer",
            "closed": True,
            "points": [[10, 10], [90, 10], [90, 90], [10, 90]],
        },
        {
            "id": "inner",
            "closed": True,
            "points": [[30, 30], [70, 30], [70, 70], [30, 70]],
        },
        {
            "id": "detail",
            "closed": False,
            "points": [[40, 50], [60, 50]],
        },
    ]

    exterior = core.classify_vector_region_boundaries(paths, 100, 100)
    assert_true(exterior["exteriorPathIds"] == ["outer"], f"only the outer frame should cut: {exterior}")
    assert_true("inner" not in exterior["cutPathIds"] and "detail" not in exterior["cutPathIds"], "inner details should engrave")

    marked = core.classify_vector_region_boundaries(paths, 100, 100, seeds=[{"x": 50, "y": 40}])
    assert_true("inner" in marked["markedPathIds"], "marking an enclosed area should cut its boundary")
    assert_true("detail" not in marked["markedPathIds"], "an open detail inside the area should remain engraving")

    paths[0]["removed"] = True
    exposed = core.classify_vector_region_boundaries(paths, 100, 100)
    assert_true(exposed["exteriorPathIds"] == ["inner"], "the new large exterior contour should become cut")
    assert_true(exposed["cutPathIds"] == ["inner"], "only structural exterior contours should be promoted")
    assert_true("inner" in exposed["adjacentExteriorPathIds"], "the classifier may detect exterior contact without turning it into cut")
    assert_true("detail" not in exposed["cutPathIds"], "small engraving details must stay out of automatic cutting")
    assert_true(exposed["stats"]["structuralExteriorPaths"] == 1, "the promoted structural contour count should be explicit")
    assert_true(exposed["stats"]["exteriorPromotionSuppressed"] is True, "removed frame history should suppress bulk detail promotion")

    explicitly_marked = core.classify_vector_region_boundaries(paths, 100, 100, seeds=[{"x": 50, "y": 40}])
    assert_true("inner" in explicitly_marked["cutPathIds"], "the user must still be able to mark an interior area for cutting")
    assert_true("detail" not in explicitly_marked["cutPathIds"], "open details inside a marked area should remain engraving")


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


def test_clean_line_art_preserves_fine_details():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "clean_family_tree.png"
        image = Image.new("RGB", (512, 512), "white")
        draw = ImageDraw.Draw(image)
        draw.ellipse([54, 42, 458, 446], outline="black", width=3)
        draw.line([256, 94, 256, 410], fill="black", width=3)
        for center_x, center_y in ((160, 190), (352, 190), (160, 330), (352, 330)):
            draw.ellipse([center_x - 42, center_y - 32, center_x + 42, center_y + 32], outline="black", width=2)
            for offset in (-18, -9, 0, 9, 18):
                draw.line([center_x + offset, center_y - 7, center_x + offset + 5, center_y + 1], fill="black", width=1)
        draw.text((198, 438), "BIZ BIR AILEYIZ", fill="black")
        image.save(image_path)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            threshold=140,
            blur=1,
            contrast=1.08,
            morph_close=1,
            denoise=5,
            min_area=35,
            min_length=10,
            simplify=0.45,
            smooth=3,
            max_contours=2500,
            stitch_gap=0.8,
            background_normalize=True,
        )
        centerline = core.vectorize_image(
            image_path,
            mode="centerline",
            threshold_mode="otsu",
            blur=0,
            denoise=4,
            min_length=8,
            simplify=0.6,
            stitch_gap=2,
            background_normalize=True,
        )

    assert_true(data["stats"].get("cleanLineArt") is True, "uniform white line art should be detected")
    assert_true(data["stats"].get("detailPreservation") is True, "clean line art should enable detail preservation")
    assert_true(data["settings"]["backgroundNormalize"] is False, "illumination normalization should be skipped for clean line art")
    assert_true(data["settings"]["denoise"] == 0, "denoise should not erase clean one-pixel details")
    assert_true(data["settings"]["minLength"] <= 5, "short real contours should survive a coarse preset")
    assert_true(data["stats"].get("pointsKept", 0) > 500, "fine line art should retain a substantial vector point set")
    assert_true(centerline["settings"]["minLength"] <= 2.5, "centerline mode should keep short clean details")
    assert_true(centerline["settings"]["stitchGap"] <= 0.5, "centerline mode should not merge nearby clean details")


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


def test_centerline_endpoint_snap_closes_natural_gap_without_sideways_join():
    natural = [
        {"id": "stem", "points": [[0, 5], [4, 5]], "closed": False, "removed": False},
        {"id": "edge", "points": [[5, 0], [5, 10]], "closed": False, "removed": False},
    ]
    snapped, stats = core.snap_open_vector_endpoints_to_paths(natural, max_gap=2.0, max_angle=70.0)
    assert_true(stats["snappedCenterlineEndpoints"] == 1, f"one natural endpoint gap should close: {stats}")
    assert_true(core._point_distance(snapped[0]["points"][-1], [5, 5]) < 1e-6, "stem should meet the target segment exactly")

    sideways = [
        {"id": "stem", "points": [[0, 0], [0, 4]], "closed": False, "removed": False},
        {"id": "shape", "points": [[1, 3], [3, 3], [3, 5], [1, 5]], "closed": True, "removed": False},
    ]
    unchanged, sideways_stats = core.snap_open_vector_endpoints_to_paths(sideways, max_gap=2.0, max_angle=70.0)
    assert_true(sideways_stats["snappedCenterlineEndpoints"] == 0, "a sideways nearby contour must stay separate")
    assert_true(unchanged[0]["points"][-1] == [0.0, 4.0], "rejected endpoint should not move")

    micro_detail, micro_stats = core.snap_open_vector_endpoints_to_paths(
        natural,
        max_gap=2.0,
        max_angle=70.0,
        min_path_length=8.0,
    )
    assert_true(micro_stats["snappedCenterlineEndpoints"] == 0, "short detail paths must not be auto-joined")
    assert_true(micro_stats["skippedMicroDetailSnaps"] == 1, "the protected micro detail should be reported")
    assert_true(micro_detail[0]["points"][-1] == [4.0, 5.0], "protected detail endpoint must stay unchanged")


def test_centerline_micro_hole_fill_removes_pixel_artifact_but_keeps_real_region():
    binary = core.np.zeros((32, 32), dtype=core.np.uint8)
    core.cv2.rectangle(binary, (4, 4), (27, 27), 255, -1)
    binary[10, 10] = 0
    binary[16:21, 16:21] = 0

    filled, stats = core.fill_centerline_micro_holes(binary, stroke_width=2.5)

    assert_true(filled[10, 10] == 255, "a one-pixel enclosed anti-alias hole should be filled")
    assert_true(filled[18, 18] == 0, "a meaningful enclosed region must remain open")
    assert_true(stats["filledCenterlineMicroHoles"] == 1, f"only the micro hole should be filled: {stats}")


def test_cad_centerline_preserves_dense_outlined_details():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "dense-line-art.png"
        source = core.np.full((140, 180), 255, dtype=core.np.uint8)
        core.cv2.rectangle(source, (54, 40), (82, 104), 0, 3)
        core.cv2.line(source, (10, 104), (168, 104), 0, 3)
        core.cv2.line(source, (54, 40), (28, 18), 0, 3)
        core.cv2.line(source, (82, 68), (112, 46), 0, 3)
        core.cv2.line(source, (61, 104), (56, 113), 0, 2)
        core.cv2.line(source, (70, 104), (70, 114), 0, 2)
        core.cv2.line(source, (78, 104), (84, 113), 0, 2)
        core.cv2.imwrite(str(image_path), source)

        data = core.vectorize_image(
            image_path,
            threshold=140,
            threshold_mode="otsu",
            mode="cad_centerline",
            blur=0,
            min_area=1,
            min_length=0,
            simplify=0.25,
            smooth=0,
            invert=True,
            max_contours=1000,
            contrast=1.0,
            morph_open=0,
            morph_close=0,
            max_dimension=180,
            remove_border=False,
            stitch_gap=0.25,
            background_normalize=False,
            denoise=0,
        )

    traced = core.np.zeros_like(source)
    for item in data["vectorPaths"]:
        if item.get("removed") or len(item.get("points", [])) < 2:
            continue
        points = core.np.array(item["points"], dtype=core.np.float32).round().astype(core.np.int32)
        core.cv2.polylines(traced, [points], bool(item.get("closed")), 255, 1)
    expected_binary = core.cv2.threshold(source, 140, 255, core.cv2.THRESH_BINARY_INV)[1]
    expected_skeleton = core.thin_binary(expected_binary)
    distance_to_trace = core.cv2.distanceTransform((traced == 0).astype(core.np.uint8), core.cv2.DIST_L2, 3)
    covered = distance_to_trace[expected_skeleton > 0] <= 2.0
    coverage = float(core.np.mean(covered)) if covered.size else 0.0
    assert_true(coverage >= 0.94, f"CAD centerline must preserve dense source strokes, got {coverage:.3f}")


def test_cad_centerline_smoothing_keeps_junction_anchors():
    skeleton = core.np.zeros((130, 150), dtype=core.np.uint8)
    core.cv2.polylines(
        skeleton,
        [core.np.array([[12, 72], [48, 46], [76, 58], [118, 24]], dtype=core.np.int32)],
        False,
        255,
        1,
    )
    core.cv2.line(skeleton, (76, 58), (106, 105), 255, 1)

    paths, stats = core.trace_skeleton_vectors(
        skeleton,
        min_length=0,
        simplify=0.9,
        smooth=3,
        max_contours=40,
        stitch_gap=0.5,
        skeleton=skeleton,
        trim_open_ends=False,
        post_simplify_epsilon=0.25,
        preserve_junctions=True,
    )

    ys, xs = core.np.where(skeleton > 0)
    pixels = {(int(x), int(y)) for x, y in zip(xs, ys)}
    offsets = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
    junctions = {
        pixel
        for pixel in pixels
        if len(core._skeleton_neighbors(pixels, pixel, offsets)) >= 3
    }
    traced_points = {
        (int(round(point[0])), int(round(point[1])))
        for path in paths
        if not path.get("removed")
        for point in path.get("points", [])
    }

    assert_true(junctions, "synthetic detail must contain a real graph junction")
    assert_true(stats.get("preservedJunctionAnchors", 0) >= len(junctions), f"junction anchors must be reported: {stats}")
    assert_true(junctions <= traced_points, f"smoothing must not move shared graph junctions: {junctions - traced_points}")


def test_cad_centerline_collapses_small_outlined_junctions():
    binary = core.np.zeros((180, 220), dtype=core.np.uint8)
    core.cv2.ellipse(binary, (105, 90), (22, 12), 0, 0, 360, 255, 3)
    core.cv2.line(binary, (30, 90), (83, 90), 255, 3)
    core.cv2.line(binary, (127, 90), (190, 90), 255, 3)
    core.cv2.line(binary, (105, 30), (105, 78), 255, 3)

    skeleton = core.thin_binary(binary)
    fixed, stats = core.centerline_dense_junction_holes(
        binary,
        skeleton,
        stroke_width=core.estimate_stroke_width(binary),
    )

    assert_true(stats.get("centerlinedDenseJunctionHoles") == 1, f"dense outlined junction must be detected: {stats}")
    assert_true(stats.get("centerlinedDenseJunctionBridges", 0) >= 2, f"real branches must be reconnected: {stats}")
    assert_true(core.np.count_nonzero(fixed) < core.np.count_nonzero(skeleton), "outlined loop must collapse to a simpler centerline")


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


def test_centerline_straightens_long_wavy_frame_lines():
    wavy = {
        "points": [[0, 20], [20, 20.5], [40, 19.7], [60, 20.4], [80, 19.8], [100, 20.2]],
        "closed": False,
        "length": 100.0,
        "removed": False,
    }
    curve = {
        "points": [[0, 0], [18, 16], [35, 22], [52, 16], [70, 0]],
        "closed": False,
        "length": 90.0,
        "removed": False,
    }

    paths, stats = core.straighten_centerline_paths([wavy, curve], stroke_width=2.0, source_width=140, source_height=80)

    assert_true(stats["straightenedCenterlinePaths"] == 1, f"only the nearly-straight path should be cleaned: {stats}")
    assert_true(len(paths[0]["points"]) == 2, f"wavy frame line should become one segment: {paths[0]}")
    assert_true(abs(paths[0]["points"][0][1] - paths[0]["points"][1][1]) < 1e-6, f"horizontal frame line should be axis-flat: {paths[0]}")
    assert_true(len(paths[1]["points"]) == 5, "curved ornament path should stay untouched")


def test_centerline_straightening_preserves_shared_branch_anchors():
    left_anchor = [10.0, 20.6]
    right_anchor = [110.0, 20.1]
    branch = {
        "id": "branch",
        "points": [left_anchor, [30, 19.8], [50, 20.4], [70, 19.7], [90, 20.3], right_anchor],
        "closed": False,
        "length": 100.0,
        "removed": False,
    }
    left_foot = {
        "id": "left-foot",
        "points": [[2, 8], left_anchor],
        "closed": False,
        "length": 15.0,
        "removed": False,
    }
    right_foot = {
        "id": "right-foot",
        "points": [right_anchor, [118, 8]],
        "closed": False,
        "length": 15.0,
        "removed": False,
    }

    paths, stats = core.straighten_centerline_paths(
        [branch, left_foot, right_foot],
        stroke_width=2.0,
        source_width=140,
        source_height=80,
    )

    assert_true(len(paths[0]["points"]) == 2, "shared branch should still be simplified to one segment")
    assert_true(paths[0]["points"][0] == left_anchor, f"left graph anchor moved: {paths[0]}")
    assert_true(paths[0]["points"][-1] == right_anchor, f"right graph anchor moved: {paths[0]}")
    assert_true(paths[0]["points"][0] == paths[1]["points"][-1], "left foot and branch must remain continuous")
    assert_true(paths[0]["points"][-1] == paths[2]["points"][0], "right foot and branch must remain continuous")
    assert_true(stats.get("preservedStraightenedJunctionAnchors") == 2, f"shared anchors must be reported: {stats}")


def test_axis_flattening_preserves_shared_open_endpoint_anchor():
    anchor = [0.0, 0.7]
    horizontal = {
        "id": "horizontal",
        "points": [anchor, [25, -0.3], [50, 0.2], [75, -0.2], [100, 0.3]],
        "closed": False,
        "length": 100.0,
        "removed": False,
    }
    attached = {
        "id": "attached",
        "points": [[-8, -12], anchor],
        "closed": False,
        "length": 15.0,
        "removed": False,
    }

    paths, stats = core.flatten_axis_aligned_centerline_runs(
        [horizontal, attached],
        stroke_width=2.0,
        source_width=140,
        source_height=80,
    )

    assert_true(paths[0]["points"][0] == anchor, f"axis cleanup moved a shared graph anchor: {paths[0]}")
    assert_true(paths[0]["points"][0] == paths[1]["points"][-1], "axis cleanup disconnected the attached path")
    assert_true(stats.get("preservedAxisJunctionAnchors", 0) >= 1, f"preserved axis anchor must be reported: {stats}")


def test_centerline_flattens_axis_runs_inside_closed_frame():
    frame = {
        "points": [
            [0, 0.4],
            [25, -0.3],
            [50, 0.2],
            [75, -0.2],
            [100, 0.3],
            [100.4, 28],
            [99.8, 56],
            [100.2, 80],
            [50, 80.5],
            [0, 79.7],
            [-0.2, 40],
        ],
        "closed": True,
        "length": 360.0,
        "removed": False,
    }

    paths, stats = core.flatten_axis_aligned_centerline_runs([frame], stroke_width=2.0, source_width=140, source_height=100)
    points = paths[0]["points"]

    assert_true(stats["axisStraightenedCenterlineRuns"] >= 2, f"frame sides should be flattened: {stats}")
    assert_true(len({points[index][1] for index in range(0, 5)}) == 1, f"top frame run should have one Y value: {points}")
    assert_true(len({points[index][0] for index in range(4, 8)}) == 1, f"right frame run should have one X value: {points}")


def test_centerline_polishes_curves_without_flattening_them():
    curve = {
        "points": [[0, 20], [8, 11], [18, 8], [30, 10], [40, 19], [48, 31], [58, 35], [70, 30]],
        "closed": False,
        "length": 95.0,
        "removed": False,
    }

    paths, stats = core.polish_centerline_curves([curve], stroke_width=2.0, source_width=120, source_height=80)

    assert_true(stats["polishedCenterlineCurves"] == 1, f"curve should be polished: {stats}")
    assert_true(len(paths[0]["points"]) < len(curve["points"]), "curve polish should reduce noisy point count")
    ys = [point[1] for point in paths[0]["points"]]
    assert_true(max(ys) - min(ys) > 10, f"curve polish must not collapse the curve into a straight line: {paths[0]}")


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


def test_auto_mode_uses_centerline_for_wide_technical_line_art():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "wide_technical_line_art.jpg"
        image = Image.new("RGB", (736, 408), "white")
        draw = ImageDraw.Draw(image)
        ink = (24, 24, 24)
        for y_offset in (0, 96, 192):
            top = 64 + y_offset
            bottom = top + 84
            center_y = (top + bottom) / 2.0
            draw.rectangle([70, top, 666, bottom], outline=ink, width=2)
            draw.rectangle([92, top + 14, 644, bottom - 14], outline=ink, width=2)
            draw.ellipse([330, top + 18, 406, bottom - 18], outline=ink, width=2)
            draw.ellipse([360, center_y - 9, 378, center_y + 9], outline=ink, width=2)
            for index in range(12):
                angle = math.tau * index / 12.0
                x0 = 368 + math.cos(angle) * 18
                y0 = center_y + math.sin(angle) * 18
                x1 = 368 + math.cos(angle) * 48
                y1 = center_y + math.sin(angle) * 34
                draw.line([x0, y0, x1, y1], fill=ink, width=2)
            for side in (0, 1):
                mirror = -1 if side == 0 else 1
                anchor = 368 + mirror * 72
                draw.arc([anchor - 130, top - 18, anchor + 92, bottom + 18], 20, 155, fill=ink, width=2)
                draw.arc([anchor - 95, top + 10, anchor + 70, bottom - 10], 205, 342, fill=ink, width=2)
                for step in range(5):
                    x = anchor + mirror * (38 + step * 42)
                    draw.arc([x - 34, top + 2, x + 34, bottom - 2], 35, 325, fill=ink, width=2)
                    draw.line([x - mirror * 18, top + 6, x + mirror * 28, bottom - 6], fill=ink, width=2)
        image.save(image_path, quality=92)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            threshold=140,
            blur=1,
            min_area=25,
            min_length=8,
            simplify=0.55,
            smooth=3,
            max_contours=3000,
            morph_close=1,
            denoise=5,
            invert=True,
            remove_border=True,
            background_normalize=True,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    stats = data["stats"]
    assert_true(active, "wide technical line art should produce active vector paths")
    assert_true(stats.get("autoCenterlineTrace"), f"wide technical line art should trigger centerline auto routing: {stats}")
    assert_true(stats.get("traceEngine") == "centerline", f"wide technical line art should use centerline tracing: {stats}")
    assert_true(stats.get("autoCenterlineBackgroundNormalize") is False, "wide technical line art should bypass shadow normalization")
    assert_true(stats.get("autoCenterlineMinLength", 99) <= 4.0, "wide technical line art should keep short valid line details")
    assert_true(stats.get("autoCenterlineStitchGap", 0) >= 3.0, "wide technical line art should bridge small raster gaps")
    assert_true(stats.get("skeletonPixels", 0) > 0, "centerline tracing should report skeleton pixels")


def test_auto_mode_uses_vtracer_for_filled_ribbon_ornaments():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "filled_ribbon_ornament.jpg"
        scale = 3
        image = Image.new("RGB", (96 * scale, 420 * scale), "white")
        draw = ImageDraw.Draw(image)
        for base_y in (-15, 95, 205, 315):
            points = [
                (48 * scale, (base_y + 0) * scale),
                (34 * scale, (base_y + 34) * scale),
                (62 * scale, (base_y + 76) * scale),
                (47 * scale, (base_y + 112) * scale),
            ]
            draw.line(points, fill=(8, 8, 8), width=36, joint="curve")
        image = image.resize((96, 420), Image.Resampling.LANCZOS)
        image.save(image_path, quality=92)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            blur=1,
            min_length=4,
            simplify=0.55,
            smooth=1,
            max_contours=500,
            morph_close=2,
            background_normalize=True,
        )

    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    stats = data["stats"]
    assert_true(active, "filled ribbon ornament should produce active vector paths")
    assert_true(5.5 < stats.get("estimatedStrokeWidth", 0) <= 10.0, f"fixture should exercise medium stroke classification: {stats}")
    assert_true(stats.get("traceEngine") == "vtracer", f"medium filled ornaments should use VTracer contours: {stats}")
    assert_true(all(item.get("sourceEngine") == "vtracer" for item in active), "auto filled-ornament paths should be VTracer sourced")


def test_auto_mode_detects_bright_stencil_panel_photo():
    with TemporaryDirectory() as temp_dir:
        image_path = Path(temp_dir) / "white_stencil_panel.jpg"
        image = Image.new("RGB", (360, 720), (229, 229, 229))
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle([110, 40, 250, 680], radius=2, fill=(255, 255, 255), outline=(160, 160, 170), width=2)
        for center_y in (150, 360, 570):
            for index in range(12):
                angle = 6.283185307179586 * index / 12.0
                cx = 180 + math.cos(angle) * 38
                cy = center_y + math.sin(angle) * 38
                box = [cx - 8, cy - 20, cx + 8, cy + 20]
                draw.ellipse([box[0] + 3, box[1] + 3, box[2] + 3, box[3] + 3], fill=(90, 94, 102))
                draw.ellipse(box, fill=(150, 155, 165))
            for cx in (140, 220):
                box = [cx - 18, center_y + 70, cx + 18, center_y + 105]
                draw.ellipse([box[0] + 3, box[1] + 3, box[2] + 3, box[3] + 3], fill=(90, 94, 102))
                draw.ellipse(box, fill=(150, 155, 165))
        image.save(image_path, quality=92)

        data = core.vectorize_image(
            image_path,
            mode="auto",
            threshold_mode="otsu",
            threshold=140,
            blur=1,
            min_area=25,
            min_length=8,
            simplify=0.55,
            smooth=3,
            max_contours=3000,
            morph_close=1,
            denoise=5,
            invert=True,
            remove_border=True,
            background_normalize=True,
        )

    stats = data["stats"]
    active = [item for item in data["vectorPaths"] if not item.get("removed")]
    assert_true(stats.get("autoStencilTrace"), f"bright stencil photo should trigger the white-panel trace path: {stats}")
    assert_true(stats.get("traceEngine") == "vtracer", f"stencil panel should use VTracer contours: {stats}")
    assert_true(data["settings"].get("invert") is False, "stencil trace should switch to bright-material masking")
    assert_true(len(active) >= 5, "stencil panel should produce several cutout contours")


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


def test_svg_image_payload_exposes_selectable_vector_paths():
    with TemporaryDirectory() as temp_dir:
        svg_path = Path(temp_dir) / "two-paths.svg"
        svg_path.write_text(
            """<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" viewBox="0 0 40 20">
  <path d="M 2 2 L 18 2 L 18 18 L 2 18 Z" fill="none" stroke="black"/>
  <path d="M 22 2 L 38 18" fill="none" stroke="black"/>
</svg>""",
            encoding="utf-8",
        )

        payload = core.image_payload(svg_path)

    assert_true(payload["kind"] == "svg", "SVG payload should stay SVG")
    assert_true(len(payload.get("vectorPaths", [])) >= 2, "SVG payload should expose selectable paths")
    assert_true(payload.get("vectorStats", {}).get("traceEngine") == "svg", "SVG vector paths should be tagged as SVG sourced")


def test_svg_image_payload_keeps_light_filled_reference_geometry():
    with TemporaryDirectory() as temp_dir:
        svg_path = Path(temp_dir) / "light-reference.svg"
        svg_path.write_text(
            """<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40">
  <path fill="rgb(250,250,248)" d="M5 5 L95 5 L95 35 L5 35 Z M20 15 L80 15 L80 25 L20 25 Z"/>
</svg>""",
            encoding="utf-8",
        )

        payload = core.image_payload(svg_path)

    assert_true(payload.get("vectorPaths"), "light filled reference SVG should still expose geometry")
    assert_true(payload.get("vectorStats", {}).get("traceEngine") == "svg", "light filled reference should remain a direct SVG trace")


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
        "lineStep": 5,
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
        "lineStep": 5,
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


def test_cut_mode_skips_near_parallel_inner_duplicate_paths():
    item = {
        "path": "vector",
        "name": "double-edge-cut",
        "x": 0,
        "y": 0,
        "width": 24,
        "height": 24,
        "rotation": 0,
        "power": 900,
        "feed": 500,
        "sourceWidth": 24,
        "sourceHeight": 24,
        "vectorPaths": [
            {"operation": "engrave", "points": [[0, 0], [24, 0], [24, 24], [0, 24]], "closed": True, "removed": False},
            {"operation": "engrave", "points": [[2, 2], [22, 2], [22, 22], [2, 22]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="cut")
    text = "\n".join(lines)

    assert_true(sum(1 for line in lines if line.startswith("S900")) == 1, "near parallel inner duplicate should not be cut")
    assert_true("X2 Y22" not in text and "X22 Y2" not in text, "inner duplicate coordinates should not be emitted")


def test_cut_mode_keeps_small_real_inner_motifs():
    item = {
        "path": "vector",
        "name": "real-inner-motif-cut",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 50,
        "rotation": 0,
        "power": 900,
        "feed": 500,
        "sourceWidth": 100,
        "sourceHeight": 50,
        "vectorPaths": [
            {"points": [[0, 0], [100, 0], [100, 50], [0, 50]], "closed": True, "removed": False},
            {"points": [[20, 20], [30, 20], [30, 30], [20, 30]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="cut")
    text = "\n".join(lines)

    assert_true(sum(1 for line in lines if line.startswith("S900")) == 2, "small independent inner motif should still be cut")
    assert_true("X20" in text and "X30" in text, "real inner motif coordinates should be emitted")


def test_vector_cut_micro_tabs_leave_power_off_gaps():
    item = {
        "path": "vector",
        "name": "tabbed-cut",
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 10,
        "rotation": 0,
        "power": 900,
        "feed": 500,
        "sourceWidth": 10,
        "sourceHeight": 10,
        "vectorPaths": [
            {
                "points": [[0, 0], [10, 0], [10, 10], [0, 10]],
                "closed": True,
                "removed": False,
                "tabCount": 2,
                "tabWidth": 1.0,
            },
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="cut")
    text = "\n".join(lines)

    assert_true("(micro tabs 2 x 1mm)" in text, "micro tab metadata should be emitted")
    assert_true(sum(1 for line in lines if line.startswith("S900")) == 3, "two tabs should split a loop into three powered cuts")
    assert_true("X9.5 Y10" in text and "X10 Y9.5" in text, "first tab gap endpoints should be in the G-code")
    assert_true("X0.5 Y0" in text and "X0 Y0.5" in text, "second tab gap endpoints should be in the G-code")


def test_convert_engrave_vector_gcode_to_cut_file():
    with TemporaryDirectory() as tmp:
        source = Path(tmp) / "job.nc"
        source.write_text(
            "\n".join(
                [
                    "G90",
                    "M4 S0",
                    "(engrave vector sample.svg R0)",
                    "S0",
                    "G1 X0 Y0 F3000",
                    "S250",
                    "G1 X10 Y0 F1800",
                    "G1 X10 Y10",
                    "S0",
                    "(engrave vector end)",
                ]
            )
            + "\n",
            encoding="utf-8",
        )

        result = core.convert_gcode_engrave_vectors_to_cut(source, cut_power=900, cut_feed=450)
        converted = Path(result["outputPath"]).read_text(encoding="utf-8")

        assert_true(result["convertedBlocks"] == 1, "only the vector block start should be counted")
        assert_true("(cut vector sample.svg R0)" in converted, "block comment should become cut")
        assert_true("S900" in converted and "S250" not in converted, "powered S should use cut power")
        assert_true("G1 X10 Y0 F450" in converted, "powered feed should use cut feed")
        assert_true("G1 X0 Y0 F3000" in converted, "travel feed should stay unchanged")
        assert_true(source.read_text(encoding="utf-8").count("S250") == 1, "source file should not be overwritten")


def test_convert_gcode_rejects_raster_or_fill_engraving():
    with TemporaryDirectory() as tmp:
        source = Path(tmp) / "raster.nc"
        source.write_text("(engrave raster photo)\nS250\nG1 X1 Y1 F1800\n", encoding="utf-8")
        try:
            core.convert_gcode_engrave_vectors_to_cut(source)
        except ValueError as exc:
            assert_true("Raster" in str(exc), "raster engraving should be rejected")
        else:
            raise AssertionError("raster engraving conversion should fail")


def test_vector_path_operations_mix_cut_engrave_and_ignore():
    item = {
        "path": "vector",
        "name": "mixed-ops",
        "x": 0,
        "y": 0,
        "width": 40,
        "height": 20,
        "rotation": 0,
        "power": 250,
        "feed": 1000,
        "cutPower": 900,
        "cutFeed": 500,
        "engravePower": 250,
        "engraveFeed": 1000,
        "sourceWidth": 40,
        "sourceHeight": 20,
        "vectorPaths": [
            {"operation": "cut", "points": [[1, 1], [10, 1]], "closed": False, "removed": False},
            {"operation": "engrave_line", "points": [[12, 1], [20, 1]], "closed": False, "removed": False},
            {"operation": "ignore", "points": [[30, 1], [38, 1]], "closed": False, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")
    text = "\n".join(lines)

    assert_true("S900" in text, "cut path should use cut power")
    assert_true("F500" in text, "cut path should use cut feed")
    assert_true("S250" in text, "engrave path should use engrave power")
    assert_true("X30" not in text and "X38" not in text, "ignored path should not be emitted")


def test_vector_path_operation_fill_uses_scanlines():
    item = {
        "path": "vector",
        "name": "path-fill",
        "x": 0,
        "y": 0,
        "width": 30,
        "height": 30,
        "rotation": 0,
        "power": 250,
        "feed": 1000,
        "lineStep": 5,
        "sourceWidth": 30,
        "sourceHeight": 30,
        "vectorPaths": [
            {"operation": "engrave_fill", "points": [[10, 10], [20, 10], [20, 20], [10, 20]], "closed": True, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")

    assert_true(any("vector fill end" in line for line in lines), "path-level fill operation should use fill scanlines")
    assert_true(sum(1 for line in lines if line.startswith("S250")) >= 2, "path fill should create multiple powered scanlines")


def test_open_vector_path_fill_falls_back_to_line_engrave():
    item = {
        "path": "vector",
        "name": "open-fill",
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
        "vectorPaths": [
            {"operation": "engrave_fill", "points": [[10, 10], [20, 20]], "closed": False, "removed": False},
        ],
    }

    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")

    assert_true(not any("vector fill end" in line for line in lines), "open paths should not create fill scanlines")
    assert_true(sum(1 for line in lines if line.startswith("S250")) == 1, "open fill path should engrave as one line")


def test_raster_photo_engrave_modulates_power_by_grayscale():
    with TemporaryDirectory() as tmp:
        path = Path(tmp) / "photo-gradient.png"
        image = Image.new("L", (6, 2), 255)
        pixels = image.load()
        for x, gray in enumerate([255, 210, 160, 100, 45, 0]):
            pixels[x, 0] = gray
            pixels[x, 1] = gray
        image.save(path)

        pattern = core.RasterPattern(
            path=path,
            x=0,
            y=0,
            width=6,
            height=2,
            rotation=0,
            power=300,
            feed=1800,
            line_step=1,
            threshold=245,
            raster_mode="grayscale",
            power_min=20,
            gamma=1.0,
            bidirectional=False,
        )

        lines = core.build_raster_engrave_lines(pattern, travel_feed=3000)
        text = "\n".join(lines)
        powered = {int(line[1:]) for line in lines if re.fullmatch(r"S\d+", line) and line != "S0"}

        assert_true("(engrave photo" in text, "photo raster mode should label the grayscale engraving block")
        assert_true(len(powered) >= 3, f"grayscale engraving should emit multiple S levels, got {powered}")
        assert_true(max(powered) == 300, "black pixels should reach requested max power")
        assert_true(min(powered) < max(powered), "midtone pixels should use lower power than black pixels")


def gcode_xy_points(lines):
    points = []
    for line in lines:
        match = re.search(r"\b[GX][0-9]+\s+X(-?\d+(?:\.\d+)?)\s+Y(-?\d+(?:\.\d+)?)", line)
        if match:
            points.append((float(match.group(1)), float(match.group(2))))
    return points


def gcode_section(lines, marker):
    section = []
    active = False
    for line in lines:
        if active and line.startswith("(") and " end)" in line:
            break
        if marker in line:
            active = True
            continue
        if active:
            section.append(line)
    return section


def test_clip_segment_respects_part_margin():
    region = core.ClipRegion([[(0, 0), (10, 0), (10, 10), (0, 10)]], margin=2)

    clipped = core.clip_segment_to_region((-5, 5), (15, 5), region, step=0.25)

    assert_true(len(clipped) == 1, "crossing line should become one clipped segment")
    start, end = clipped[0]
    assert_true(1.75 <= start[0] <= 2.25, f"clipped start should respect left margin, got {start}")
    assert_true(7.75 <= end[0] <= 8.25, f"clipped end should respect right margin, got {end}")
    assert_true(abs(start[1] - 5) < 1e-6 and abs(end[1] - 5) < 1e-6, "clipping should keep segment y")


def test_closed_clip_connector_follows_inset_margin_boundary():
    region = core.ClipRegion([[(0, 0), (20, 0), (20, 10), (0, 10)]], margin=2)
    clipped = core.clip_polyline_to_region(
        [(10, 3), (25, 3), (25, 7), (10, 7), (10, 3)],
        region,
        close_boundary=True,
        closed_source=True,
    )

    assert_true(clipped, "closed crossing contour should leave a clipped path")
    points = clipped[0]
    assert_true(all(1.95 <= x <= 18.05 and 1.95 <= y <= 8.05 for x, y in points), f"closed path should stay on/in inset margin: {points}")
    has_right_inset_connector = any(
        abs(a[0] - 18) <= 0.05
        and abs(b[0] - 18) <= 0.05
        and {round(a[1]), round(b[1])} == {3, 7}
        for a, b in zip(points, points[1:])
    )
    assert_true(has_right_inset_connector, f"connector should follow the inset boundary, got {points}")


def test_clip_region_handles_reversed_slanted_polygons():
    region = core.ClipRegion([[(0, 10), (10, 5), (0, 0)]], margin=0)

    assert_true(not core.clip_region_contains((-1, 5), region), "outside point must stay outside reversed slanted polygon")
    assert_true(core.clip_region_contains((1, 5), region), "inside point must stay inside reversed slanted polygon")


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


def test_pattern_point_supports_mirroring():
    base = {
        "path": Path("dummy.png"),
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 5,
        "rotation": 0,
        "power": 100,
        "feed": 1000,
        "line_step": 1,
        "threshold": 128,
    }

    normal = core.RasterPattern(**base)
    mirror_x = core.RasterPattern(**base, mirror_x=True)
    mirror_y = core.RasterPattern(**base, mirror_y=True)

    assert_true(core.pattern_point(normal, 0, 0) == (0, 0), "normal local origin should map to lower-left")
    assert_true(core.pattern_point(mirror_x, 0, 0) == (10, 0), "mirror_x should flip local x across pattern center")
    assert_true(core.pattern_point(mirror_y, 0, 0) == (0, 5), "mirror_y should flip local y across pattern center")


def test_generate_excludes_active_placement_outside_bed():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        result = core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [
                    {"id": "inside", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"},
                    {"id": "outside", "partId": "p1", "x": 50, "y": 5, "rotation": 0, "operation": "cut"},
                ],
                "patterns": [],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        points = gcode_xy_points(output_path.read_text(encoding="utf-8").splitlines())
        assert_true(result["cutPathCount"] == 1, "only the inside placement should be generated")
        assert_true(result["excludedObjectCount"] == 1, "outside placement should be reported as excluded")
        assert_true(points and all(x <= 22.001 and y <= 12.001 for x, y in points), f"outside coordinates must not enter G-code: {points}")


def test_generate_rejects_when_every_active_object_is_outside():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        def run():
            core.generate_from_state(
                {
                    "parts": [{"id": "p1", "path": str(dxf_path)}],
                    "placements": [{"id": "outside", "partId": "p1", "x": 50, "y": 5, "rotation": 0, "operation": "cut"}],
                    "patterns": [],
                    "settings": base_generation_settings(),
                    "outputPath": str(output_path),
                }
            )

        assert_raises_contains(run, "aktif kesim veya kazima")
        assert_true(not output_path.exists(), "an all-outside job must not create an empty G-code file")


def test_generate_excludes_pattern_bound_to_outside_placement():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        result = core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [
                    {"id": "inside", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"},
                    {"id": "outside", "partId": "p1", "x": 50, "y": 5, "rotation": 0, "operation": "cut"},
                ],
                "patterns": [
                    {
                        "id": "child",
                        "kind": "vector",
                        "path": "embedded-vector",
                        "name": "outside-child",
                        "parentId": "outside",
                        "x": 50,
                        "y": 5,
                        "width": 20,
                        "height": 10,
                        "sourceWidth": 20,
                        "sourceHeight": 10,
                        "operation": "engrave_line",
                        "vectorPaths": [
                            {"operation": "engrave_line", "closed": False, "points": [[0, 5], [20, 5]]},
                        ],
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        text = output_path.read_text(encoding="utf-8")
        assert_true(result["cutPathCount"] == 1 and result["patternCount"] == 0, "only the safe parent should generate")
        assert_true(result["excludedObjectCount"] == 2, "outside parent and its child pattern should both be reported")
        assert_true("outside-child" not in text, "child of an excluded placement must not enter G-code")


def test_generate_validates_available_area_polygon():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        settings = {
            **base_generation_settings(),
            "availableArea": {
                "type": "polygon",
                "points": [
                    {"x": 2, "y": 2},
                    {"x": 35, "y": 2},
                    {"x": 35, "y": 20},
                    {"x": 2, "y": 20},
                ],
            },
        }

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"}],
                "patterns": [],
                "settings": settings,
                "outputPath": str(output_path),
            }
        )
        assert_true(output_path.exists(), "placement inside available area should generate")

        result = core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [
                    {"id": "inside", "partId": "p1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"},
                    {"id": "outside", "partId": "p1", "x": 24, "y": 5, "rotation": 0, "operation": "cut"},
                ],
                "patterns": [],
                "settings": settings,
                "outputPath": str(output_path),
            }
        )
        points = gcode_xy_points(output_path.read_text(encoding="utf-8").splitlines())
        assert_true(result["excludedObjectCount"] == 1, "placement outside custom material area should be excluded")
        assert_true(points and all(x <= 25.001 for x, _y in points), f"custom-area escape must not enter G-code: {points}")


def test_generate_skips_ignored_outside_placements():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        result = core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [
                    {"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"},
                    {"id": "pl2", "partId": "p1", "x": 50, "y": 5, "rotation": 0, "operation": "ignore"},
                ],
                "patterns": [],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        text = output_path.read_text(encoding="utf-8")
        assert_true(result["cutPathCount"] == 1, "ignored outside placement should not add cut paths")
        assert_true("X70" not in text, "ignored outside geometry should not appear in G-code")


def test_generate_skips_ignored_vector_paths_before_bed_validation():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        result = core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"}],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "vector",
                        "path": "vector",
                        "name": "ignored-vector",
                        "x": 500,
                        "y": 500,
                        "width": 20,
                        "height": 10,
                        "rotation": 0,
                        "operation": "engrave_line",
                        "sourceWidth": 20,
                        "sourceHeight": 10,
                        "vectorPaths": [
                            {"operation": "ignore", "points": [[0, 0], [20, 0]], "closed": False, "removed": False},
                        ],
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        text = output_path.read_text(encoding="utf-8")
        assert_true(result["cutPathCount"] == 1, "cut placement should still generate")
        assert_true("ignored-vector" not in text, "ignored vector paths should not be emitted")


def test_generate_accepts_legacy_engrave_operation():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "engrave"}],
                "patterns": [],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        text = output_path.read_text(encoding="utf-8")
        assert_true("S250" in text, "legacy engrave operation should use engraving power")
        assert_true("(use absolute coordinates)" in text, "G-code should still be written")


def test_generate_rejects_no_active_operations():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)

        def run():
            core.generate_from_state(
                {
                    "parts": [{"id": "p1", "path": str(dxf_path)}],
                    "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "ignore"}],
                    "patterns": [],
                    "settings": base_generation_settings(),
                    "outputPath": str(output_path),
                }
            )

        assert_raises_contains(run, "aktif kesim veya kazima")


def test_generate_air_assist_emits_on_and_off_commands():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        settings = {**base_generation_settings(), "airAssist": True, "airAssistCommand": "M8"}

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"}],
                "patterns": [],
                "settings": settings,
                "outputPath": str(output_path),
            }
        )

        lines = output_path.read_text(encoding="utf-8").splitlines()
        assert_true(any(line.startswith("M8") for line in lines), "air assist should turn on with M8")
        assert_true(any(line.startswith("M9") for line in lines), "air assist should turn off with M9")
        assert_true(lines.index("M8 (air assist on)") < lines.index("M5 S0"), "air should turn on before job end")


def test_generate_unbound_svg_crossing_dxf_boundary_is_clipped():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        svg_path = Path(temp_dir) / "oversized.svg"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10">'
            '<path d="M 0 5 L 30 5" />'
            '</svg>',
            encoding="utf-8",
        )

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"}],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "svg",
                        "path": str(svg_path),
                        "name": "oversized.svg",
                        "x": 2,
                        "y": 5,
                        "width": 30,
                        "height": 10,
                        "rotation": 0,
                        "operation": "engrave_line",
                        "power": 250,
                        "feed": 1800,
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        points = gcode_xy_points(output_path.read_text(encoding="utf-8").splitlines())
        assert_true(points, "unbound crossing SVG should generate clipped G-code")
        assert_true(all(4.999 <= x <= 25.001 for x, _y in points), f"unbound clipped SVG must stay inside parent X limits: {points}")
        assert_true(all(4.999 <= y <= 15.001 for _x, y in points), f"unbound clipped SVG must stay inside parent Y limits: {points}")


def test_generate_bound_svg_clips_to_parent_boundary():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        svg_path = Path(temp_dir) / "oversized.svg"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10">'
            '<path d="M 0 5 L 30 5" />'
            '</svg>',
            encoding="utf-8",
        )

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"}],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "svg",
                        "path": str(svg_path),
                        "name": "oversized.svg",
                        "parentId": "pl1",
                        "x": 2,
                        "y": 5,
                        "width": 30,
                        "height": 10,
                        "rotation": 0,
                        "operation": "engrave_line",
                        "power": 250,
                        "feed": 1800,
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        points = gcode_xy_points(output_path.read_text(encoding="utf-8").splitlines())
        assert_true(points, "bound SVG should generate clipped G-code")
        assert_true(all(4.999 <= x <= 25.001 for x, _y in points), f"bound SVG must stay inside parent X limits: {points}")
        assert_true(all(4.999 <= y <= 15.001 for _x, y in points), f"bound SVG must stay inside parent Y limits: {points}")


def test_generate_closes_clipped_closed_svg_on_parent_boundary():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        svg_path = Path(temp_dir) / "oversized_closed.svg"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10">'
            '<path d="M 0 1 L 30 1 L 30 9 L 0 9 Z" />'
            '</svg>',
            encoding="utf-8",
        )

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [{"id": "pl1", "partId": "p1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"}],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "svg",
                        "path": str(svg_path),
                        "name": "oversized_closed.svg",
                        "parentId": "pl1",
                        "x": 5,
                        "y": 5,
                        "width": 30,
                        "height": 10,
                        "rotation": 0,
                        "operation": "engrave_line",
                        "power": 250,
                        "feed": 1800,
                        "clipCloseBoundary": True,
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        points = gcode_xy_points(output_path.read_text(encoding="utf-8").splitlines())
        assert_true(points, "closed clipped SVG should generate G-code")
        assert_true(all(4.999 <= x <= 25.001 for x, _y in points), f"closed clipped SVG must stay inside parent X limits: {points}")
        assert_true(all(4.999 <= y <= 15.001 for _x, y in points), f"closed clipped SVG must stay inside parent Y limits: {points}")
        has_boundary_connector = any(
            abs(a[0] - 25) <= 0.02
            and abs(b[0] - 25) <= 0.02
            and {round(a[1]), round(b[1])} == {6, 14}
            for a, b in zip(points, points[1:])
        )
        assert_true(has_boundary_connector, f"closed clipping should connect endpoints along parent boundary: {points}")


def test_generate_uses_placement_boundary_margin_and_close_rule():
    with TemporaryDirectory() as temp_dir:
        dxf_path = Path(temp_dir) / "part.dxf"
        svg_path = Path(temp_dir) / "oversized_closed.svg"
        output_path = Path(temp_dir) / "job.nc"
        write_rect_dxf(dxf_path)
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10">'
            '<path d="M 5 3 L 30 3 L 30 7 L 5 7 Z" />'
            '</svg>',
            encoding="utf-8",
        )

        core.generate_from_state(
            {
                "parts": [{"id": "p1", "path": str(dxf_path)}],
                "placements": [
                    {
                        "id": "pl1",
                        "partId": "p1",
                        "x": 5,
                        "y": 5,
                        "rotation": 0,
                        "operation": "cut",
                        "boundaryMargin": 2,
                        "clipCloseBoundary": True,
                    }
                ],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "svg",
                        "path": str(svg_path),
                        "name": "oversized_closed.svg",
                        "parentId": "pl1",
                        "x": 5,
                        "y": 5,
                        "width": 30,
                        "height": 10,
                        "rotation": 0,
                        "operation": "engrave_line",
                        "power": 250,
                        "feed": 1800,
                    }
                ],
                "settings": base_generation_settings(),
                "outputPath": str(output_path),
            }
        )

        lines = output_path.read_text(encoding="utf-8").splitlines()
        points = gcode_xy_points(gcode_section(lines, "(engrave svg"))
        assert_true(points, "closed SVG should generate clipped engraving section")
        assert_true(all(6.999 <= x <= 23.001 for x, _y in points), f"SVG X points should respect placement boundary margin: {points}")
        assert_true(all(6.999 <= y <= 13.001 for _x, y in points), f"SVG Y points should respect placement boundary margin: {points}")
        has_inset_connector = any(
            abs(a[0] - 23) <= 0.02
            and abs(b[0] - 23) <= 0.02
            and {round(a[1]), round(b[1])} == {8, 12}
            for a, b in zip(points, points[1:])
        )
        assert_true(has_inset_connector, f"placement close rule should connect along inset boundary: {points}")


def test_kerf_offsets_outer_out_and_holes_in():
    def rect(x0, y0, x1, y1):
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]

    def bbox(points):
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return min(xs), min(ys), max(xs), max(ys)

    outer = rect(0, 0, 100, 50)
    hole = rect(40, 20, 60, 30)
    island = rect(45, 22, 55, 28)
    open_path = [(0, 60), (50, 60), (100, 65)]

    result = core.apply_kerf_to_paths([outer, hole, island, open_path], 0.2)

    ob = bbox(result[0])
    hb = bbox(result[1])
    ib = bbox(result[2])
    assert_true(abs((ob[2] - ob[0]) - 100.2) < 0.01, "outer contour should grow by kerf/2 per side")
    assert_true(abs((hb[2] - hb[0]) - 19.8) < 0.01, "hole should shrink by kerf/2 per side")
    assert_true(abs((ib[2] - ib[0]) - 10.2) < 0.01, "island inside hole should grow again (parity)")
    assert_true(result[3] == open_path, "open paths must stay untouched")
    assert_true(core.converter.dist(result[0][0], result[0][-1]) < 1e-6, "offset contour must stay closed")
    assert_true(core.apply_kerf_to_paths([outer], 0) == [outer], "kerf 0 must be a no-op")


def test_kerf_handles_concave_part_without_degenerate_output():
    concave = [(0, 0), (30, 0), (30, 10), (10, 10), (10, 30), (0, 30), (0, 0)]
    result = core.apply_kerf_to_paths([concave], 0.3)[0]
    xs = [point[0] for point in result]
    ys = [point[1] for point in result]
    assert_true(len(result) >= len(concave), "concave kerf output should keep a usable contour")
    assert_true(all(math.isfinite(value) for value in [*xs, *ys]), "concave kerf output must be finite")
    assert_true(core.converter.dist(result[0], result[-1]) < 1e-6, "concave kerf output must stay closed")
    assert_true(abs(core.polygon_signed_area(result[:-1])) > 1.0, "concave kerf output must not collapse")
    assert_true(max(xs) - min(xs) > 30 and max(ys) - min(ys) > 30, "outer concave contour should grow outward")


def test_generate_uses_embedded_part_geometry_when_dxf_path_is_missing():
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "embedded.nc"
        result = core.generate_from_state(
            {
                "parts": [
                    {
                        "id": "p1",
                        "path": str(Path(tmp) / "missing-source.dxf"),
                        "name": "embedded-source.dxf",
                        "width": 10,
                        "height": 8,
                        "paths": [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]],
                        "unsupported": {},
                    }
                ],
                "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"}],
                "patterns": [],
                "settings": base_generation_settings(),
                "outputPath": str(output),
            }
        )
        text = output.read_text(encoding="utf-8")
        assert_true(result["cutPathCount"] == 1, "embedded DXF geometry should generate one cut path")
        assert_true("X2 Y2" in text and "X12 Y10" in text, "embedded geometry coordinates should be emitted")


def test_generate_requires_bed_dimensions():
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "missing-bed.nc"

        def run():
            core.generate_from_state(
                {
                    "parts": [],
                    "placements": [],
                    "patterns": [],
                    "settings": {"feed": 500, "power": 900, "laserCmd": "M4"},
                    "outputPath": str(output),
                }
            )

        assert_raises_contains(run, "tabla genisligi ve yuksekligi")
        assert_true(not output.exists(), "missing bed dimensions must fail before writing G-code")


def test_generate_rejects_laser_command_injection():
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "injected.nc"
        settings = {
            **base_generation_settings(),
            "laserCmd": "M4\nG0 X999 Y999\nM3 S1000",
        }

        def run():
            core.generate_from_state(
                {
                    "parts": [
                        {
                            "id": "p1",
                            "name": "embedded.dxf",
                            "width": 10,
                            "height": 8,
                            "paths": [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]],
                        }
                    ],
                    "placements": [{"id": "pl1", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"}],
                    "patterns": [],
                    "settings": settings,
                    "outputPath": str(output),
                }
            )

        assert_raises_contains(run, "M3 veya M4")
        assert_true(not output.exists(), "invalid laser command must not create a G-code file")

        direct_output = Path(tmp) / "direct-injected.nc"

        def run_direct():
            core.converter.write_gcode(
                output_path=direct_output,
                paths=[[(1, 1), (2, 2)]],
                feed=500,
                power=900,
                rapid_feed=None,
                laser_cmd="M4\nG0 X999 Y999",
                pierce_delay=0,
                comments=True,
            )

        assert_raises_contains(run_direct, "M3 or M4")
        assert_true(not direct_output.exists(), "low-level writer must also reject laser command injection")


def test_generate_excludes_vector_geometry_outside_declared_pattern_bounds():
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "escaped-vector.nc"
        settings = {**base_generation_settings(), "bedWidth": 100, "bedHeight": 100, "margin": 0}

        result = core.generate_from_state(
            {
                "parts": [
                    {
                        "id": "safe",
                        "name": "safe.dxf",
                        "width": 10,
                        "height": 8,
                        "paths": [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]],
                    }
                ],
                "placements": [{"id": "safe-pl", "partId": "safe", "x": 2, "y": 2, "rotation": 0, "operation": "cut"}],
                "patterns": [
                    {
                        "id": "pat1",
                        "kind": "vector",
                        "path": "embedded-vector",
                        "name": "escaped-vector",
                        "x": 10,
                        "y": 10,
                        "width": 20,
                        "height": 20,
                        "sourceWidth": 20,
                        "sourceHeight": 20,
                        "operation": "cut",
                        "vectorPaths": [
                            {"operation": "cut", "closed": False, "points": [[0, 10], [500, 10]]},
                        ],
                    }
                ],
                "settings": settings,
                "outputPath": str(output),
            }
        )

        points = gcode_xy_points(output.read_text(encoding="utf-8").splitlines())
        assert_true(result["cutPathCount"] == 1, "safe DXF should still generate")
        assert_true(result["patternCount"] == 0 and result["excludedObjectCount"] == 1, "escaped vector should be excluded as one object")
        assert_true(points and all(x <= 12.001 and y <= 10.001 for x, y in points), f"escaped vector coordinates must not enter G-code: {points}")


def test_generate_excludes_toolpath_that_kerf_pushes_outside_bed():
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "post-kerf-outside.nc"
        settings = {
            **base_generation_settings(),
            "bedWidth": 30,
            "bedHeight": 20,
            "margin": 0,
            "kerf": 0.2,
        }

        result = core.generate_from_state(
            {
                "parts": [
                    {
                        "id": "p1",
                        "name": "square.dxf",
                        "width": 10,
                        "height": 10,
                        "paths": [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
                    }
                ],
                "placements": [
                    {"id": "safe", "partId": "p1", "x": 2, "y": 2, "rotation": 0, "operation": "cut"},
                    {"id": "edge", "partId": "p1", "x": 20, "y": 0, "rotation": 0, "operation": "cut"},
                ],
                "patterns": [],
                "settings": settings,
                "outputPath": str(output),
            }
        )

        points = gcode_xy_points(output.read_text(encoding="utf-8").splitlines())
        assert_true(result["cutPathCount"] == 1, "safe post-kerf path should generate")
        assert_true(result["excludedObjectCount"] == 1, "kerf escape should exclude only the edge placement")
        assert_true(points and all(x <= 12.101 and y <= 12.101 for x, y in points), f"post-kerf escape must not enter G-code: {points}")


def test_vector_cut_builders_apply_outer_and_hole_kerf():
    def path_widths(lines):
        paths = core.powered_toolpaths_from_gcode(lines)
        widths = sorted(max(point[0] for point in path) - min(point[0] for point in path) for path in paths)
        return widths

    vector_item = {
        "path": "embedded-vector",
        "name": "kerf-vector",
        "x": 0,
        "y": 0,
        "width": 40,
        "height": 40,
        "sourceWidth": 40,
        "sourceHeight": 40,
        "power": 900,
        "feed": 500,
        "cutPower": 900,
        "cutFeed": 500,
        "vectorPaths": [
            {"operation": "cut", "closed": True, "points": [[5, 5], [35, 5], [35, 35], [5, 35]]},
            {"operation": "cut", "closed": True, "points": [[15, 15], [25, 15], [25, 25], [15, 25]]},
        ],
    }
    embedded_widths = path_widths(
        core.build_embedded_vector_engrave_lines(vector_item, operation="cut", kerf=0.2)
    )
    assert_true(len(embedded_widths) == 2, f"embedded cut should emit outer and hole paths: {embedded_widths}")
    assert_true(abs(embedded_widths[0] - 9.8) < 0.02, f"embedded hole should shrink by kerf: {embedded_widths}")
    assert_true(abs(embedded_widths[1] - 30.2) < 0.02, f"embedded outer contour should grow by kerf: {embedded_widths}")

    with TemporaryDirectory() as tmp:
        svg_path = Path(tmp) / "kerf.svg"
        svg_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
            '<path d="M5 5 L35 5 L35 35 L5 35 Z" />'
            '<path d="M15 15 L25 15 L25 25 L15 25 Z" />'
            '</svg>',
            encoding="utf-8",
        )
        pattern = core.RasterPattern(
            path=svg_path,
            x=0,
            y=0,
            width=40,
            height=40,
            rotation=0,
            power=900,
            feed=500,
            line_step=0.35,
            threshold=140,
        )
        svg_widths = path_widths(
            core.build_svg_vector_engrave_lines(pattern, operation="cut", kerf=0.2)
        )
        assert_true(len(svg_widths) == 2, f"SVG cut should emit outer and hole paths: {svg_widths}")
        assert_true(abs(svg_widths[0] - 9.8) < 0.02, f"SVG hole should shrink by kerf: {svg_widths}")
        assert_true(abs(svg_widths[1] - 30.2) < 0.02, f"SVG outer contour should grow by kerf: {svg_widths}")


def semantic_branch_motif_paths():
    paths = [
        {"id": "trunk", "points": [[0, 0], [100, 0]], "closed": False, "operation": "engrave_line"},
        {"id": "stem", "points": [[50, 0], [50, 20]], "closed": False, "operation": "engrave_line"},
    ]
    for index, offset in enumerate((-8, -4, 0, 4, 8), 1):
        paths.append(
            {
                "id": f"loop-{index}",
                "points": [[50, 20], [48 + offset, 25], [50 + offset, 31], [52 + offset, 25]],
                "closed": True,
                "operation": "engrave_line",
            }
        )
    return paths


def transformed_vector_paths(paths, scale=1.0, angle_degrees=0.0):
    angle = math.radians(angle_degrees)
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return [
        {
            **path,
            "points": [
                [scale * (point[0] * cosine - point[1] * sine), scale * (point[0] * sine + point[1] * cosine)]
                for point in path["points"]
            ],
        }
        for path in paths
    ]


def test_attributed_graph_finds_compact_motif_and_splits_true_t_junction():
    for scale, angle in ((1, 0), (2, 15), (4, 45)):
        model = core.build_vector_topology(
            transformed_vector_paths(semantic_branch_motif_paths(), scale, angle),
            120 * scale,
            120 * scale,
            stroke_width=2 * scale,
        )
        graph = model["vectorGraph"]
        trunk_edges = [edge for edge in graph["edges"] if edge["lineage"]["legacyPathId"] == "trunk"]
        assert_true(len(trunk_edges) == 2, f"true endpoint-on-trunk junction must split at {scale}x/{angle}deg: {trunk_edges}")
        assert_true(len(graph["articulationNodeIds"]) >= 1, f"branch gate must survive {scale}x/{angle}deg")
        assert_true(len(model["objectProposals"]) == 1, f"one compact motif expected at {scale}x/{angle}deg: {model['objectProposals']}")
        proposal = model["objectProposals"][0]
        proposal_lineages = {
            next(edge for edge in graph["edges"] if edge["id"] == edge_id)["lineage"]["legacyPathId"]
            for edge_id in proposal["edgeIds"]
        }
        assert_true("stem" in proposal_lineages, "motif proposal should include its stem")
        assert_true("trunk" not in proposal_lineages, "motif proposal must not capture the main trunk")
        assert_true(proposal["name"].startswith("Kompakt motif"), "automatic names must remain structural")


def test_attributed_graph_does_not_join_near_separate_micro_strokes():
    toe_paths = [
        {"id": "toe-a", "points": [[0, 0], [5, 0]], "closed": False},
        {"id": "toe-b", "points": [[2, 0.7], [2, 4]], "closed": False},
    ]
    for scale, angle in ((1, 0), (2, 15), (4, 45)):
        model = core.build_vector_topology(
            transformed_vector_paths(toe_paths, scale, angle),
            10 * scale,
            10 * scale,
            stroke_width=2 * scale,
        )
        assert_true(len(model["vectorGraph"]["components"]) == 2, f"nearby toe strokes joined at {scale}x/{angle}deg")
        assert_true(not model["vectorGraph"]["junctionRegions"], f"proximity created a junction at {scale}x/{angle}deg")
        assert_true(model["topologyStats"]["autoRepairsApplied"] == 0, "P1 must not auto-apply uncertain gap repairs")


def test_semantic_separation_validates_revision_and_expands_seed_to_proposal():
    model = core.build_vector_topology(semantic_branch_motif_paths(), 100, 40, stroke_width=2)
    proposal = model["objectProposals"][0]
    result = core.analyze_vector_separation(
        {
            "vectorModel": model,
            "graphRevision": model["vectorGraph"]["revision"],
            "foregroundEdgeIds": [proposal["edgeIds"][0]],
            "backgroundEdgeIds": [],
        }
    )
    assert_true(result["proposalId"] == proposal["id"], f"a seed inside the motif should resolve to its structural proposal: {result}")
    assert_true(set(result["foregroundEdgeIds"]) == set(proposal["edgeIds"]), "semantic analysis must return the complete motif edge set")
    assert_true(result["cutGates"] == proposal["gateNodeIds"], "proposal gates must be preserved")
    kept = core.analyze_vector_separation(
        {
            "vectorModel": model,
            "graphRevision": model["vectorGraph"]["revision"],
            "foregroundEdgeIds": [proposal["edgeIds"][0]],
            "gateOverrides": {proposal["gateNodeIds"][0]: "keep"},
        }
    )
    assert_true(proposal["gateNodeIds"][0] not in kept["cutGates"], "a kept gate must not remain in the cut set")
    assert_true(len(kept["foregroundEdgeIds"]) > len(result["foregroundEdgeIds"]), "keeping the branch gate must expand the foreground partition")
    assert_raises_contains(
        lambda: core.analyze_vector_separation(
            {
                "vectorModel": model,
                "graphRevision": model["vectorGraph"]["revision"] + 1,
                "foregroundEdgeIds": [proposal["edgeIds"][0]],
            }
        ),
        "revizyonu degisti",
    )


def vector_object_model_fixture():
    return {
        "vectorModelVersion": 2,
        "sourceToDesign": {"matrix": [10, 0, 0, -10, 0, 100], "unit": "mm"},
        "vectorGraph": {
            "revision": 3,
            "nodes": [
                {"id": "n1", "position": [0, 5]},
                {"id": "n2", "position": [10, 5]},
            ],
            "edges": [
                {
                    "id": "edge:branch",
                    "startNodeId": "n1",
                    "endNodeId": "n2",
                    "points": [[0, 5], [10, 5]],
                    "closed": False,
                    "operation": "engrave_line",
                    "pathData": {"warnings": []},
                    "lineage": {
                        "canonicalEdgeLineageId": "legacy:branch",
                        "legacyPathId": "branch",
                        "sourceInterval": [0, 1],
                    },
                }
            ],
        },
        "vectorObjects": [
            {
                "id": "object:branch",
                "name": "Branch",
                "edgeRefs": [{"edgeId": "edge:branch", "ownership": "exclusive", "emit": True}],
                "transform": [1, 0, 0, 1, 20, 0],
                "operation": "engrave_line",
                "createdBy": "user-rectangle-separation",
            }
        ],
        "connections": [],
        "occlusionMasks": [],
    }


def masked_vector_object_model_fixture():
    return {
        "vectorModelVersion": 2,
        "operation": "engrave_line",
        "sourceToDesign": {"matrix": [10, 0, 0, -10, 0, 100], "unit": "mm"},
        "vectorGraph": {
            "revision": 4,
            "nodes": [
                {"id": "n1", "position": [0, 5]},
                {"id": "n2", "position": [10, 5]},
                {"id": "n3", "position": [4, 4]},
            ],
            "edges": [
                {
                    "id": "edge:branch",
                    "startNodeId": "n1",
                    "endNodeId": "n2",
                    "points": [[0, 5], [10, 5]],
                    "closed": False,
                    "operation": "engrave_line",
                    "lineage": {"canonicalEdgeLineageId": "branch", "sourceInterval": [0, 1]},
                },
                {
                    "id": "edge:flower",
                    "startNodeId": "n3",
                    "endNodeId": "n3",
                    "points": [[4, 4], [6, 4], [6, 6], [4, 6]],
                    "closed": True,
                    "operation": "engrave_line",
                    "lineage": {"canonicalEdgeLineageId": "flower", "sourceInterval": [0, 1]},
                },
            ],
        },
        "vectorObjects": [
            {
                "id": "object:base",
                "operation": "engrave_line",
                "edgeRefs": [{"edgeId": "edge:branch", "ownership": "exclusive", "emit": True}],
                "transform": [1, 0, 0, 1, 0, 0],
            },
            {
                "id": "object:flower",
                "operation": "engrave_line",
                "edgeRefs": [{"edgeId": "edge:flower", "ownership": "exclusive", "emit": True}],
                "transform": [1, 0, 0, 1, 0, 0],
            },
        ],
        "connections": [],
        "occlusionMasks": [
            {
                "id": "mask:flower",
                "mode": "mask-underlay",
                "ownerObjectId": "object:flower",
                "targetObjectIds": ["object:base"],
                "polygonSource": [[4, 4], [6, 4], [6, 6], [4, 6]],
            }
        ],
    }


def test_vector_object_compiler_uses_canonical_model_not_stale_cache():
    item = {
        **vector_object_model_fixture(),
        "operation": "engrave_line",
        "vectorPaths": [{"id": "stale", "points": [[90, 90], [99, 99]], "closed": False}],
    }
    compiled = core.compile_vector_objects(item)
    assert_true(len(compiled) == 1, f"one canonical edge should compile: {compiled}")
    assert_true(compiled[0]["points"] == [[2.0, 5.0], [12.0, 5.0]], f"object transform should be resolved from canonical geometry: {compiled}")
    assert_true(compiled[0]["provenance"]["graphRevision"] == 3, "compiled path must carry graph revision provenance")
    assert_true(all(point[0] < 20 for point in compiled[0]["points"]), "stale cache coordinates must never leak into output")


def test_vector_object_compiler_rejects_duplicate_exclusive_owner():
    item = vector_object_model_fixture()
    duplicate = copy.deepcopy(item["vectorObjects"][0])
    duplicate["id"] = "object:duplicate"
    item["vectorObjects"].append(duplicate)
    assert_raises_contains(lambda: core.compile_vector_objects(item), "birden fazla bagimsiz")


def test_vector_object_compiler_ignores_removed_or_ignored_object():
    item = vector_object_model_fixture()
    item["vectorObjects"][0]["operation"] = "ignore"
    assert_true(core.compile_vector_objects(item) == [], "ignored object must emit no vector path")
    item = vector_object_model_fixture()
    item["vectorObjects"][0]["removed"] = True
    assert_true(core.compile_vector_objects(item) == [], "removed object must emit no vector path")


def test_vector_object_mask_underlay_removes_powered_branch_middle():
    item = masked_vector_object_model_fixture()
    compiled = core.compile_vector_objects(item)
    branch = [path for path in compiled if path["edgeId"] == "edge:branch"]
    assert_true(len(branch) == 2, f"mask-underlay must split the branch into two emitted fragments: {branch}")
    assert_true(branch[0]["points"] == [[0.0, 5.0], [4.0, 5.0]], f"unexpected left mask fragment: {branch}")
    assert_true(branch[1]["points"] == [[6.0, 5.0], [10.0, 5.0]], f"unexpected right mask fragment: {branch}")
    assert_true(all(path["provenance"]["occlusionMaskApplied"] for path in branch), "mask provenance must be explicit")

    item.update({
        "path": "masked-vector",
        "name": "masked-vector",
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 10,
        "sourceWidth": 10,
        "sourceHeight": 10,
        "power": 250,
        "feed": 1800,
    })
    powered = core.powered_toolpaths_from_gcode(core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave"))
    horizontal = [path for path in powered if len(path) >= 2 and all(abs(point[1] - 5.0) <= 0.01 for point in path)]
    assert_true(not any(min(point[0] for point in path) < 5 < max(point[0] for point in path) for path in horizontal), "no powered branch may cross the masked motif center")


def test_backend_enforces_pinned_and_shared_joint_anchors():
    item = vector_object_model_fixture()
    vector_object = item["vectorObjects"][0]
    vector_object["transform"] = [1, 0, 0, 1, 20, 0]
    vector_object["attachmentPolicy"] = "pinned"
    vector_object["attachments"] = [{"id": "a1", "graphNodeId": "n1", "policy": "pinned"}]
    assert_raises_contains(lambda: core.compile_vector_objects(item), "anchor kisitini")

    item = vector_object_model_fixture()
    vector_object = item["vectorObjects"][0]
    vector_object["attachmentPolicy"] = "shared-joint"
    vector_object["attachments"] = [
        {"id": "a1", "graphNodeId": "n1", "policy": "shared-joint"},
        {"id": "a2", "graphNodeId": "n2", "policy": "shared-joint"},
    ]
    vector_object["transform"] = [2, 0, 0, 2, 0, -50]
    assert_raises_contains(lambda: core.compile_vector_objects(item), "shared-joint anchor kisitini")


def test_v2_vector_gcode_has_no_ghost_path_from_stale_vector_paths():
    item = {
        **vector_object_model_fixture(),
        "path": "v2-vector",
        "name": "v2-vector",
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 10,
        "sourceWidth": 10,
        "sourceHeight": 10,
        "power": 250,
        "feed": 1800,
        "vectorPaths": [{"id": "stale", "points": [[90, 90], [99, 99]], "closed": False}],
    }
    lines = core.build_embedded_vector_engrave_lines(item, travel_feed=3000, operation="engrave")
    paths = core.powered_toolpaths_from_gcode(lines)
    assert_true(len(paths) == 1, f"only the current canonical object should be powered: {paths}")
    xs = [point[0] for point in paths[0]]
    assert_true(min(xs) >= 1.999 and max(xs) <= 12.001, f"G-code must use moved object coordinates only: {paths}")


def test_final_toolpath_validator_checks_segments_inside_custom_area():
    available_area = core.ClipRegion(
        [
            [(0, 0), (10, 0), (10, 10), (0, 10)],
            [(4, 4), (6, 4), (6, 6), (4, 6)],
        ],
        margin=0,
    )

    def run():
        core.validate_final_toolpaths(
            [[(1, 5), (9, 5)]],
            bed_width=10,
            bed_height=10,
            margin=0,
            available_area=available_area,
        )

    assert_raises_contains(run, "kullanilabilir alanin disina")


def main():
    tests = [
        test_toolpath_optimizer_reduces_empty_travel_and_reverses_open_paths,
        test_cut_toolpath_optimizer_keeps_outer_contour_last,
        test_embedded_vector_builder_uses_optimized_path_order,
        test_kerf_offsets_outer_out_and_holes_in,
        test_kerf_handles_concave_part_without_degenerate_output,
        test_filter_keeps_auto_removed_paths,
        test_vectorize_image_returns_debug_stages_and_metadata,
        test_cad_centerline_mode_returns_single_line_metadata,
        test_vector_region_classifier_supports_exterior_marked_and_frame_removal,
        test_background_normalization_rescues_gradient_photo,
        test_clean_line_art_preserves_fine_details,
        test_large_filled_border_component_is_not_deleted_as_frame,
        test_centerline_stitches_junction_segments_before_filtering,
        test_skeleton_spur_pruning_removes_short_hairs,
        test_centerline_endpoint_snap_closes_natural_gap_without_sideways_join,
        test_centerline_micro_hole_fill_removes_pixel_artifact_but_keeps_real_region,
        test_cad_centerline_preserves_dense_outlined_details,
        test_cad_centerline_smoothing_keeps_junction_anchors,
        test_cad_centerline_collapses_small_outlined_junctions,
        test_centerline_solidify_collapses_double_edge_bands,
        test_centerline_straightens_long_wavy_frame_lines,
        test_centerline_straightening_preserves_shared_branch_anchors,
        test_axis_flattening_preserves_shared_open_endpoint_anchor,
        test_centerline_flattens_axis_runs_inside_closed_frame,
        test_centerline_polishes_curves_without_flattening_them,
        test_vtracer_mode_produces_laser_vector_paths,
        test_vtracer_polish_closes_short_mask_breaks,
        test_auto_mode_traces_photo_line_art_with_potrace,
        test_auto_mode_uses_centerline_for_wide_technical_line_art,
        test_auto_mode_uses_vtracer_for_filled_ribbon_ornaments,
        test_auto_mode_detects_bright_stencil_panel_photo,
        test_photo_line_art_uses_upscaled_ink_mask_without_background_fill,
        test_potrace_polish_removes_short_spike_without_losing_main_corners,
        test_restore_hollowed_fills_keeps_light_holes_open,
        test_vtracer_svg_import_skips_light_fill_paths,
        test_svg_image_payload_exposes_selectable_vector_paths,
        test_svg_image_payload_keeps_light_filled_reference_geometry,
        test_inset_frame_sides_are_hidden_not_deleted,
        test_svg_export_skips_removed_paths,
        test_svg_export_can_write_filled_compound_paths,
        test_svg_export_can_invert_filled_compound_paths,
        test_vector_fill_scan_segments_support_inverted_fill,
        test_potrace_vector_gcode_uses_fill_scanlines,
        test_potrace_vector_engrave_defaults_to_contours,
        test_potrace_vector_cut_uses_contours_not_fill_scanlines,
        test_cut_mode_skips_near_parallel_inner_duplicate_paths,
        test_cut_mode_keeps_small_real_inner_motifs,
        test_vector_cut_micro_tabs_leave_power_off_gaps,
        test_convert_engrave_vector_gcode_to_cut_file,
        test_convert_gcode_rejects_raster_or_fill_engraving,
        test_vector_path_operations_mix_cut_engrave_and_ignore,
        test_vector_path_operation_fill_uses_scanlines,
        test_open_vector_path_fill_falls_back_to_line_engrave,
        test_raster_photo_engrave_modulates_power_by_grayscale,
        test_clip_segment_respects_part_margin,
        test_clip_region_handles_reversed_slanted_polygons,
        test_vector_gcode_is_clipped_to_part_margin,
        test_svg_gcode_is_clipped_to_part_margin,
        test_closed_clip_connector_follows_inset_margin_boundary,
        test_pattern_point_supports_mirroring,
        test_generate_excludes_active_placement_outside_bed,
        test_generate_rejects_when_every_active_object_is_outside,
        test_generate_excludes_pattern_bound_to_outside_placement,
        test_generate_validates_available_area_polygon,
        test_generate_skips_ignored_outside_placements,
        test_generate_skips_ignored_vector_paths_before_bed_validation,
        test_generate_accepts_legacy_engrave_operation,
        test_generate_rejects_no_active_operations,
        test_generate_air_assist_emits_on_and_off_commands,
        test_generate_unbound_svg_crossing_dxf_boundary_is_clipped,
        test_generate_bound_svg_clips_to_parent_boundary,
        test_generate_closes_clipped_closed_svg_on_parent_boundary,
        test_generate_uses_placement_boundary_margin_and_close_rule,
        test_generate_uses_embedded_part_geometry_when_dxf_path_is_missing,
        test_generate_requires_bed_dimensions,
        test_generate_rejects_laser_command_injection,
        test_generate_excludes_vector_geometry_outside_declared_pattern_bounds,
        test_generate_excludes_toolpath_that_kerf_pushes_outside_bed,
        test_vector_cut_builders_apply_outer_and_hole_kerf,
        test_attributed_graph_finds_compact_motif_and_splits_true_t_junction,
        test_attributed_graph_does_not_join_near_separate_micro_strokes,
        test_semantic_separation_validates_revision_and_expands_seed_to_proposal,
        test_vector_object_compiler_uses_canonical_model_not_stale_cache,
        test_vector_object_compiler_rejects_duplicate_exclusive_owner,
        test_vector_object_compiler_ignores_removed_or_ignored_object,
        test_vector_object_mask_underlay_removes_powered_branch_middle,
        test_backend_enforces_pinned_and_shared_joint_anchors,
        test_v2_vector_gcode_has_no_ghost_path_from_stale_vector_paths,
        test_final_toolpath_validator_checks_segments_inside_custom_area,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All vector pipeline tests passed.")


if __name__ == "__main__":
    main()
