import copy
from pathlib import Path
from tempfile import TemporaryDirectory

import dxf_to_laser_gcode as dxf
import laser_editor_core as core
import laser_editor_server as server


def write_dxf(path: Path, insunits: int | None) -> None:
    header = []
    if insunits is not None:
        header = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", str(insunits), "0", "ENDSEC"]
    entities = [
        "0", "SECTION", "2", "ENTITIES",
        "0", "LWPOLYLINE", "90", "4", "70", "1",
        "10", "0", "20", "0",
        "10", "2", "20", "0",
        "10", "2", "20", "1",
        "10", "0", "20", "1",
        "0", "ENDSEC", "0", "EOF",
    ]
    path.write_text("\n".join([*header, *entities]), encoding="utf-8")


def machine_profile(max_s=1000):
    return {
        "id": f"test-s{max_s}",
        "name": "Test",
        "maxS": max_s,
        "travelX": 400,
        "travelY": 400,
        "stepsX": 80,
        "stepsY": 80,
        "maxRateX": 6000,
        "maxRateY": 6000,
        "accelerationX": 200,
        "accelerationY": 200,
        "accelerationValidated": False,
        "requiresLaserMode": True,
        "airAssist": {"supported": False, "onCommand": "M8", "offCommand": "M9"},
        "verified": True,
    }


def base_state():
    return {
        "project": {"id": "project-1", "revision": 7},
        "machineProfile": machine_profile(),
        "parts": [
            {
                "id": "part-1",
                "name": "part.dxf",
                "width": 20,
                "height": 10,
                "quantity": 1,
                "paths": [[[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]]],
            }
        ],
        "placements": [
            {"id": "placement-1", "partId": "part-1", "x": 5, "y": 5, "rotation": 0, "operation": "cut"}
        ],
        "patterns": [],
        "settings": {"bedWidth": 100, "bedHeight": 100, "margin": 1},
    }


def test_dxf_units_normalize_to_mm():
    with TemporaryDirectory() as directory:
        directory = Path(directory)
        mm_path = directory / "mm.dxf"
        inch_path = directory / "inch.dxf"
        unitless_path = directory / "unitless.dxf"
        write_dxf(mm_path, 4)
        write_dxf(inch_path, 1)
        write_dxf(unitless_path, None)

        assert dxf.dxf_unit_info(mm_path)["scaleToMm"] == 1.0
        assert dxf.dxf_unit_info(inch_path)["scaleToMm"] == 25.4
        assert dxf.dxf_unit_info(unitless_path)["scaleToMm"] is None
        assert dxf.dxf_unit_info(unitless_path, "cm")["scaleToMm"] == 10.0

        inch_paths, _unsupported, _count = dxf.convert_dxf_paths(inch_path, 0.25, 0.05)
        xs = [point[0] for path in inch_paths for point in path]
        assert abs(max(xs) - 50.8) < 1e-6


def test_svg_physical_units_and_aspect_ratio():
    with TemporaryDirectory() as directory:
        directory = Path(directory)
        expected = {
            "96px": 25.4,
            "25.4mm": 25.4,
            "2.54cm": 25.4,
            "1in": 25.4,
            "72pt": 25.4,
            "6pc": 25.4,
        }
        for raw, width_mm in expected.items():
            path = directory / f"unit-{raw.replace('.', '_')}.svg"
            path.write_text(
                f'<svg xmlns="http://www.w3.org/2000/svg" width="{raw}" height="{raw}" viewBox="0 0 96 96">'
                '<path d="M0 0 L96 96"/></svg>',
                encoding="utf-8",
            )
            info = core.svg_physical_info(path)
            assert abs(info["widthMm"] - width_mm) < 1e-6

        meet = directory / "meet.svg"
        meet.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" '
            'viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">'
            '<path d="M0 0 L200 100"/></svg>',
            encoding="utf-8",
        )
        info = core.svg_physical_info(meet)
        assert info["scaleX"] == info["scaleY"] == 0.5
        assert info["physicalSpecified"] is True

        estimated = directory / "estimated.svg"
        estimated.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 48"><path d="M0 0 L96 48"/></svg>',
            encoding="utf-8",
        )
        estimated_info = core.svg_physical_info(estimated)
        assert estimated_info["estimatedAt96Dpi"] is True
        assert abs(estimated_info["widthMm"] - 25.4) < 1e-6


def test_percent_power_maps_to_machine_max_s():
    assert core.power_percent_to_s(25, 255) == 64
    assert core.power_percent_to_s(25, 1000) == 250
    assert core.power_percent_to_s(100, 777) == 777
    for invalid in (-2, 500):
        try:
            core.power_percent_to_s(invalid, 1000)
        except ValueError:
            pass
        else:
            raise AssertionError("power outside 0..100 must be rejected")


def test_preflight_blocks_outside_open_cut_and_unknown_profile():
    outside = base_state()
    outside["placements"][0]["x"] = 90
    result = core.preflight_state(outside)
    assert any(item["code"] == "active_object_outside" for item in result.blockers)

    open_cut = base_state()
    open_cut["patterns"] = [
        {
            "id": "vector-1",
            "kind": "vector",
            "name": "open.svg",
            "x": 30,
            "y": 30,
            "width": 10,
            "height": 10,
            "sourceWidth": 10,
            "sourceHeight": 10,
            "operation": "cut",
            "vectorPaths": [{"id": "path-1", "closed": False, "operation": "cut", "points": [[0, 0], [10, 10]]}],
        }
    ]
    result = core.preflight_state(open_cut)
    assert any(item["code"] == "open_cut_contour" for item in result.blockers)

    unknown = base_state()
    unknown["machineProfile"]["verified"] = False
    result = core.preflight_state(unknown)
    assert any(item["code"] == "machine_profile_invalid" for item in result.blockers)


def test_filled_vector_preflight_requires_and_checks_motion_profile():
    state = base_state()
    state["patterns"] = [
        {
            "id": "text-1",
            "kind": "vector",
            "name": "Metin: SAİM",
            "generatedKind": "text",
            "textSettings": {"mode": "outline", "text": "SAİM"},
            "x": 30,
            "y": 30,
            "width": 20,
            "height": 8,
            "sourceWidth": 20,
            "sourceHeight": 8,
            "lineStep": 0.1,
            "operation": "engrave_fill",
            "vectorPaths": [
                {"id": "path-1", "closed": True, "operation": "engrave_fill", "points": [[0, 0], [20, 0], [20, 8], [0, 8]]}
            ],
        }
    ]

    ready = core.preflight_state(state)
    assert not ready.blockers
    assert any(item["code"] == "machine_acceleration_unvalidated" for item in ready.warnings)

    incomplete = copy.deepcopy(state)
    incomplete["machineProfile"]["accelerationX"] = None
    blocked = core.preflight_state(incomplete)
    assert any(item["code"] == "machine_motion_profile_incomplete" for item in blocked.blockers)

    snapshot = {
        "connected": True,
        "lastStatus": {"state": "Idle"},
        "statusAgeMs": 100,
        "settings": {
            "30": 1000,
            "32": 1,
            "100": 80,
            "101": 80,
            "110": 6000,
            "111": 6000,
            "120": 250,
            "121": 200,
            "130": 400,
            "131": 400,
        },
    }
    mismatch = core.preflight_state(state, machine_snapshot=snapshot, require_machine=True)
    assert any(item["code"] == "machine_x_acceleration_mismatch" for item in mismatch.blockers)


def test_authoritative_preflight_requires_source_decision():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "part.dxf"
        write_dxf(path, 4)
        state = base_state()
        state["parts"][0]["sourceFingerprint"] = server.source_fingerprint(path, units={"sourceUnit": "millimeters"})
        registry = server.FileGrantRegistry(max_age_seconds=60)

        blocked = server.authoritative_preflight(state, registry)
        assert any(item["code"] == "source_reauthorization_required" for item in blocked["blockers"])

        state["parts"][0]["sourceResolution"] = "snapshot"
        allowed = server.authoritative_preflight(state, registry)
        assert not allowed["blockers"]
        assert any(item["code"] == "source_snapshot_only" for item in allowed["warnings"])


def test_authoritative_preflight_requires_embedded_raster_data():
    state = base_state()
    state["patterns"] = [
        {
            "id": "raster-1",
            "kind": "raster",
            "name": "photo.png",
            "path": "D:/must-not-be-read/photo.png",
            "x": 30,
            "y": 30,
            "width": 10,
            "height": 10,
            "operation": "engrave_fill",
        }
    ]
    result = server.authoritative_preflight(state, server.FileGrantRegistry(max_age_seconds=60))
    assert any(item["code"] == "embedded_raster_missing" for item in result["blockers"])


def test_safe_gcode_copy_only_repairs_shutdown():
    with TemporaryDirectory() as directory:
        directory = Path(directory)
        source = directory / "unsafe.nc"
        source.write_text("G21\nG90\nG94\nM4 S0\nS500\nG1 X10 F500\n", encoding="utf-8")
        content, validation = server.safe_gcode_copy_content(source, machine_profile())
        assert content.endswith("M5\nS0\n")
        assert validation["safeForMachine"] is True

        modal = directory / "modal.nc"
        modal.write_text("G21\nG90\nM4 S0\nS500\nG1 X10 F500\n", encoding="utf-8")
        try:
            server.safe_gcode_copy_content(modal, machine_profile())
        except server.ApiRequestError as error:
            assert error.code == "safe_copy_modal_blocked"
        else:
            raise AssertionError("safe copy must not invent missing G94")


def main():
    tests = [
        test_dxf_units_normalize_to_mm,
        test_svg_physical_units_and_aspect_ratio,
        test_percent_power_maps_to_machine_max_s,
        test_preflight_blocks_outside_open_cut_and_unknown_profile,
        test_filled_vector_preflight_requires_and_checks_motion_profile,
        test_authoritative_preflight_requires_source_decision,
        test_authoritative_preflight_requires_embedded_raster_data,
        test_safe_gcode_copy_only_repairs_shutdown,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All release preflight tests passed.")


if __name__ == "__main__":
    main()
