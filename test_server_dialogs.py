import base64
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


def main():
    tests = [
        test_dialog_lock_rejects_instead_of_queueing,
        test_existing_gcode_requires_explicit_overwrite_confirmation,
        test_edited_raster_is_materialized_for_gcode_and_can_be_cleaned_up,
        test_embedded_image_is_rejected_for_non_raster_pattern,
        test_transparent_raster_pixels_are_white_in_gcode_pipeline,
        test_local_vector_crop_uses_top_left_normalized_coordinates,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All server dialog tests passed.")


if __name__ == "__main__":
    main()
