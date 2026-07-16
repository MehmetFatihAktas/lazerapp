import base64
import json
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

import laser_editor_server as server
from PIL import Image


ONE_PIXEL_PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def test_dialog_lock_rejects_instead_of_queueing():
    wrapped = server.locked_dialog(lambda: "opened")
    server.DIALOG_LOCK.acquire()
    try:
        try:
            wrapped()
        except server.NativeDialogBusyError:
            pass
        else:
            raise AssertionError("a second native dialog request must be rejected")
    finally:
        server.DIALOG_LOCK.release()
    assert wrapped() == "opened"


def test_existing_gcode_requires_explicit_overwrite_confirmation():
    with TemporaryDirectory() as directory:
        output = Path(directory) / "job.nc"
        output.write_text("old", encoding="utf-8")
        try:
            server.validate_generate_output_choice({"outputPath": str(output)})
        except ValueError as error:
            assert "yeniden seçin" in str(error)
        else:
            raise AssertionError("an existing G-code file must not be overwritten silently")
        server.validate_generate_output_choice({"outputPath": str(output), "overwriteConfirmed": True})
        server.validate_generate_output_choice({"outputPath": str(Path(directory) / "new.nc")})


def test_edited_raster_is_materialized_for_gcode_and_can_be_cleaned_up():
    state = {"patterns": [{"id": "p1", "kind": "raster", "path": "original.png", "dataUrl": ONE_PIXEL_PNG}]}
    created = server.materialize_raster_pattern_data_urls(state)
    try:
        assert len(created) == 1
        assert created[0].exists()
        assert state["patterns"][0]["path"] == str(created[0])
        assert state["patterns"][0]["sourcePath"] == str(created[0])
        assert "dataUrl" not in state["patterns"][0]
    finally:
        for path in created:
            path.unlink(missing_ok=True)
    assert not created[0].exists()


def test_embedded_image_is_rejected_for_non_raster_pattern():
    state = {"patterns": [{"id": "p1", "kind": "vector", "dataUrl": ONE_PIXEL_PNG}]}
    try:
        server.materialize_raster_pattern_data_urls(state)
    except ValueError as error:
        assert "raster" in str(error)
    else:
        raise AssertionError("embedded images must not replace vector sources")


def test_transparent_raster_pixels_are_white_in_gcode_pipeline():
    image = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
    state = {"patterns": [{"id": "p1", "kind": "raster", "dataUrl": data_url}]}
    created = server.materialize_raster_pattern_data_urls(state)
    try:
        grayscale = server.core.open_pattern_image(created[0])
        assert grayscale.getpixel((0, 0)) == 255
    finally:
        for path in created:
            path.unlink(missing_ok=True)


def test_local_vector_crop_uses_top_left_normalized_coordinates():
    with TemporaryDirectory() as directory:
        source = Path(directory) / "source.png"
        image = Image.new("RGB", (100, 50), "white")
        for y in range(50):
            color = (255, y * 5, 0)
            for x in range(100):
                image.putpixel((x, y), color)
        image.save(source)
        cropped_path, metadata = server.crop_raster_image_to_temp(
            source,
            {"minX": 0.2, "minY": 0.1, "maxX": 0.6, "maxY": 0.7},
            padding_pixels=0,
        )
        try:
            assert metadata["pixelBounds"] == {"left": 20, "top": 5, "right": 60, "bottom": 35}
            assert metadata["pixelWidth"] == 40
            assert metadata["pixelHeight"] == 30
            assert metadata["normalized"] == {"minX": 0.2, "minY": 0.1, "maxX": 0.6, "maxY": 0.7}
            with Image.open(cropped_path) as cropped:
                assert cropped.size == (40, 30)
                assert cropped.getpixel((0, 0)) == (255, 25, 0)
                assert cropped.getpixel((0, 29)) == (255, 170, 0)
        finally:
            cropped_path.unlink(missing_ok=True)
        assert not cropped_path.exists()


def test_gcode_info_contains_stable_file_identity_and_safety():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "job.nc"
        path.write_bytes(
            "(Çalışma)\nG21\nG90\nG94\nM4 S0\n(cut paths begin)\nS500\nG1 X10 F600\n(cut paths end)\nM5 S0\n".encode("cp1254")
        )
        first = server.gcode_file_info(path)
        second = server.gcode_file_info(path)

        assert first["fileHash"] == second["fileHash"]
        assert len(first["fileHash"]) == 64
        assert first["fileSize"] == path.stat().st_size
        assert first["laserLength"] == 10.0
        assert first["processCutLength"] == 10.0
        assert first["finalLaserOff"] is True


def test_atomic_write_replaces_complete_project_file():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "project.laserjob.json"
        server.atomic_write_text(path, '{"version":1}')
        server.atomic_write_text(path, '{"version":2,"complete":true}')
        assert path.read_text(encoding="utf-8") == '{"version":2,"complete":true}'
        assert not list(path.parent.glob(f".{path.name}.*.tmp"))


def test_project_storage_removes_browser_source_paths():
    sanitized = server.sanitize_project_for_storage(
        {
            "outputPath": "D:/jobs/job.nc",
            "parts": [
                {
                    "id": "p1",
                    "name": "part.dxf",
                    "path": "D:/private/part.dxf",
                    "sourcePath": "D:/private/part.dxf",
                    "originalPath": "D:/private/part.dxf",
                    "paths": [[[0, 0], [1, 0]]],
                }
            ],
            "patterns": [
                {
                    "id": "v1",
                    "name": "motif.svg",
                    "path": "D:/private/motif.svg",
                    "sourceHandle": "opaque",
                    "vectorPaths": [{"points": [[0, 0], [1, 1]]}],
                }
            ],
        }
    )
    assert sanitized["outputPath"] == ""
    assert sanitized["parts"][0]["path"] == "part.dxf"
    assert "sourcePath" not in sanitized["parts"][0]
    assert sanitized["patterns"][0]["path"] == "motif.svg"
    assert "sourceHandle" not in sanitized["patterns"][0]


def test_recent_projects_are_server_side_and_use_opaque_ids():
    with TemporaryDirectory() as directory:
        directory = Path(directory)
        project_path = directory / "demo.laserjob.json"
        project_path.write_text('{"schema":"laser-editor-project-v4"}', encoding="utf-8")
        original_file = server.RECENT_PROJECTS_FILE
        server.RECENT_PROJECTS_FILE = directory / "recent-projects.json"
        try:
            remembered = server.remember_recent_project(project_path, "Demo")
            public = server.public_recent_projects()
            assert public[0]["id"] == remembered["id"]
            assert public[0]["id"] != str(project_path)
            assert server.resolve_recent_project(public[0]["id"]) == project_path.resolve()
            stored = json.loads(server.RECENT_PROJECTS_FILE.read_text(encoding="utf-8"))
            assert stored[0]["path"] == str(project_path.resolve())
        finally:
            server.RECENT_PROJECTS_FILE = original_file


def test_diagnostics_excludes_project_and_gcode_content():
    diagnostics = server.diagnostics_snapshot()
    assert diagnostics["app"]["version"] == server.APP_VERSION
    assert diagnostics["capabilities"]["serial"] is True
    assert diagnostics["capabilities"]["camera"] is False
    assert diagnostics["privacy"] == {
        "projectGeometryIncluded": False,
        "projectPathsIncluded": False,
        "gcodeIncluded": False,
    }


def test_system_font_catalog_groups_faces_and_marks_thick_families():
    fonts = server.build_system_font_catalog(
        [
            {"family": "Demo Sans", "weight": 400, "italic": False, "category": "sans", "supportsTurkish": True},
            {"family": "Demo Sans", "weight": 700, "italic": True, "category": "sans", "supportsTurkish": True},
            {"family": "Brush Demo", "weight": 400, "italic": False, "category": "handwriting", "supportsTurkish": False},
        ]
    )

    assert [font["family"] for font in fonts] == ["Brush Demo", "Demo Sans"]
    demo = next(font for font in fonts if font["family"] == "Demo Sans")
    assert demo["weights"] == [400, 700]
    assert demo["styles"] == ["italic", "normal"]
    assert demo["supportsTurkish"] is True
    assert demo["thickSuitable"] is True
    assert demo["id"].startswith("system-")


def main():
    tests = [
        test_dialog_lock_rejects_instead_of_queueing,
        test_existing_gcode_requires_explicit_overwrite_confirmation,
        test_edited_raster_is_materialized_for_gcode_and_can_be_cleaned_up,
        test_embedded_image_is_rejected_for_non_raster_pattern,
        test_transparent_raster_pixels_are_white_in_gcode_pipeline,
        test_local_vector_crop_uses_top_left_normalized_coordinates,
        test_gcode_info_contains_stable_file_identity_and_safety,
        test_atomic_write_replaces_complete_project_file,
        test_project_storage_removes_browser_source_paths,
        test_recent_projects_are_server_side_and_use_opaque_ids,
        test_diagnostics_excludes_project_and_gcode_content,
        test_system_font_catalog_groups_faces_and_marks_thick_families,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All server dialog tests passed.")


if __name__ == "__main__":
    main()
