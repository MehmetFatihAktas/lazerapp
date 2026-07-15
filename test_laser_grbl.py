import laser_grbl
import threading
import time
from collections import deque
from pathlib import Path
from tempfile import TemporaryDirectory


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def test_clean_gcode_line_strips_comments():
    assert_true(laser_grbl.clean_gcode_line("G1 X1 (inner move) Y2 ; trailing") == "G1 X1 Y2", "comments should be stripped")
    assert_true(laser_grbl.clean_gcode_line("(comment only)") == "", "comment-only lines should be skipped")
    assert_true(laser_grbl.clean_gcode_line("%") == "", "program delimiter should be skipped")


def test_gcode_file_reader_accepts_legacy_turkish_comments():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "legacy.nc"
        path.write_bytes("(Çalışma başlangıcı)\nG21\nG90\nM4 S0\n".encode("cp1254"))

        raw_lines = laser_grbl.gcode_raw_lines_from_file(path)
        machine_lines = laser_grbl.gcode_lines_from_file(path)

        assert_true(raw_lines[0] == "(Çalışma başlangıcı)", "preview reader should preserve decoded comments")
        assert_true(machine_lines == ["G21", "G90", "M4 S0"], "machine reader should still remove comments")


def test_parse_status_line_reads_state_position_and_power():
    status = laser_grbl.parse_status_line("<Idle|MPos:1.000,2.500,0.000|FS:1200,255|WCO:0.000,0.000,0.000>")
    assert_true(status["state"] == "Idle", "state should be parsed")
    assert_true(status["MPos"] == [1.0, 2.5, 0.0], "machine position should be parsed")
    assert_true(status["feed"] == 1200.0 and status["spindle"] == 255.0, "feed and spindle should be parsed")


def test_gcode_bounds_tracks_modal_xy():
    bounds = laser_grbl.gcode_bounds(["G0 X1 Y2", "G1 X5", "G1 Y8", "G1 X-1 Y3"])
    assert_true(bounds == {"minX": -1.0, "minY": 2.0, "maxX": 5.0, "maxY": 8.0}, f"unexpected bounds: {bounds}")


def test_analyze_gcode_marks_cut_travel_and_timing():
    lines = ["G90", "G0 X0 Y0", "M4 S500", "G1 X10 F600", "G1 Y10", "M5", "G0 X0"]
    info = laser_grbl.analyze_gcode(lines)

    assert_true(len(info["lineSeconds"]) == len(lines), "preview timing should keep one entry per source line")
    assert_true(info["bounds"]["width"] == 10.0 and info["bounds"]["height"] == 10.0, f"unexpected bounds: {info['bounds']}")
    assert_true(info["cutLength"] == 20.0, f"cut length should include two laser-on moves: {info['cutLength']}")
    assert_true(info["segments"][0][:6] == [0.0, 0.0, 10.0, 0.0, 1, 3], f"first cut segment mismatch: {info['segments'][0]}")
    assert_true(info["segments"][0][6] == "laser", f"unmarked jobs should retain generic laser operation: {info['segments'][0]}")
    assert_true(info["segments"][-1][4] == 0, "rapid return should be marked as travel")
    assert_true(info["usesM4"] and not info["usesM3"], "preview should report laser command flavor")


def test_analyze_gcode_classifies_cut_engrave_and_ranges():
    lines = [
        "G21", "G90", "M4 S0",
        "(engrave vector motif R0)", "G0 X0 Y0", "S250", "G1 X10 F1800", "S0", "(engrave vector end)",
        "(cut paths begin)", "G0 X20 Y0", "S1000", "G1 X30 F500", "S0", "(cut paths end)", "M5 S0",
    ]
    info = laser_grbl.analyze_gcode(lines)

    assert_true(info["operationLengths"] == {"engrave_line": 10.0, "cut": 10.0}, f"unexpected operation lengths: {info['operationLengths']}")
    assert_true(info["processCutLength"] == 10.0 and info["engraveLength"] == 10.0, f"unexpected classified lengths: {info}")
    assert_true(info["powerRange"] == {"min": 250.0, "max": 1000.0}, f"unexpected power range: {info['powerRange']}")
    assert_true(info["feedRange"] == {"min": 500.0, "max": 1800.0}, f"unexpected feed range: {info['feedRange']}")


def test_analyze_gcode_does_not_draw_g92_as_motion():
    lines = ["G21", "G90", "G0 X10 Y10", "G92 X0 Y0", "M4 S500", "G1 X5 Y0 F600", "M5"]
    info = laser_grbl.analyze_gcode(lines)

    laser_segments = [segment for segment in info["segments"] if segment[4] == 1]
    assert_true(len(laser_segments) == 1, f"G92 must not create a phantom move: {info['segments']}")
    assert_true(laser_segments[0][:4] == [10.0, 10.0, 15.0, 10.0], f"G92 work offset should preserve physical position: {laser_segments[0]}")


def test_analyze_gcode_converts_inch_jobs_to_mm():
    lines = ["G20", "G90", "G94", "M4 S100", "G1 X1 F10", "M5"]
    info = laser_grbl.analyze_gcode(lines)

    assert_true(abs(info["cutLength"] - 25.4) < 1e-6, f"inch path should be converted to mm: {info['cutLength']}")
    assert_true(info["feedRange"] == {"min": 254.0, "max": 254.0}, f"inch feed should be converted to mm/min: {info['feedRange']}")
    assert_true(info["unitMode"] == "inch", f"reported unit mode should remain inch: {info['unitMode']}")


def test_analyze_gcode_reports_modal_safety_warnings():
    info = laser_grbl.analyze_gcode(["M3 S1000", "G1 X5 F500"])

    warnings = " ".join(info["safetyWarnings"])
    assert_true("birim" in warnings and "koordinat" in warnings and "M3" in warnings, f"missing safety warnings: {warnings}")
    assert_true(not info["finalLaserOff"], "laser left on should be reported")


def test_analyze_gcode_does_not_accept_earlier_m5_as_final_shutdown():
    info = laser_grbl.analyze_gcode(
        [
            "G21",
            "G90",
            "G94",
            "M4 S0",
            "S200",
            "G1 X5 Y0 F500",
            "M5 S0",
            "M4 S1000",
            "G1 X10 Y0 F500",
        ]
    )

    assert_true(not info["finalLaserOff"], "an earlier M5 must not hide a later laser-on final state")
    assert_true(
        any("Dosya sonunda" in warning for warning in info["safetyWarnings"]),
        "the unsafe final state must remain visible in preflight",
    )


def test_usb_serial_port_scores_above_bluetooth():
    usb_score, usb_reason = laser_grbl.serial_port_score("COM7", "USB Seri Cihaz (COM7)", "USB VID:PID=303A:1001")
    bt_score, bt_reason = laser_grbl.serial_port_score("COM3", "Bluetooth bağlantısı üzerinden Standart Seri (COM3)", "BTHENUM\\TEST")

    assert_true(usb_score > bt_score, f"USB port should rank above Bluetooth: usb={usb_score}, bt={bt_score}")
    assert_true("USB" in usb_reason.upper(), f"USB reason should be visible: {usb_reason}")
    assert_true("Bluetooth" in bt_reason, f"Bluetooth reason should be visible: {bt_reason}")


def test_bluetooth_port_is_never_auto_selected():
    bluetooth_only = [{"device": "COM9", "likelyLaser": False}]
    with_usb = [{"device": "COM9", "likelyLaser": False}, {"device": "COM6", "likelyLaser": True}]
    assert_true(laser_grbl.preferred_serial_port(bluetooth_only) == "", "Bluetooth must require manual selection")
    assert_true(laser_grbl.preferred_serial_port(with_usb) == "COM6", "laser-like USB port should be preferred")


class FakeSerial:
    def __init__(self, responses=None, fail_on_read=False):
        self.responses = deque(responses or [])
        self.writes = []
        self.is_open = True
        self.fail_on_read = fail_on_read

    def write(self, payload):
        self.writes.append(payload)
        return len(payload)

    def flush(self):
        return None

    def close(self):
        self.is_open = False

    def readline(self):
        if self.fail_on_read:
            raise RuntimeError("readline should not be called")
        if self.responses:
            response = self.responses.popleft()
            return response if isinstance(response, bytes) else str(response).encode("utf-8")
        time.sleep(0.005)
        return b""


class SlowWriteSerial(FakeSerial):
    def __init__(self, responses=None, delay=0.08):
        super().__init__(responses=responses)
        self.delay = delay
        self.active_writes = 0
        self.max_active_writes = 0
        self.counter_lock = threading.Lock()

    def write(self, payload):
        with self.counter_lock:
            self.active_writes += 1
            self.max_active_writes = max(self.max_active_writes, self.active_writes)
        try:
            time.sleep(self.delay)
            return super().write(payload)
        finally:
            with self.counter_lock:
                self.active_writes -= 1


class WriteTimeoutSerial(FakeSerial):
    def write(self, payload):
        raise TimeoutError("Write timeout")


def controller_with_fake(fake):
    controller = laser_grbl.GrblController()
    controller._serial = fake
    controller._port = "COM_TEST"
    controller._baud = 115200
    return controller


def wait_for_job_done(controller, timeout=1.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not controller.snapshot()["job"].get("running"):
            return
        time.sleep(0.01)
    raise AssertionError("job did not finish")


def test_gcode_error_sends_soft_reset():
    fake = FakeSerial([
        "<Idle|MPos:0.000,0.000,0.000|FS:0,0>\n",
        "error:20\n",
    ])
    controller = controller_with_fake(fake)

    controller.start_gcode(["G1 X10 F500"], confirmed=True)
    wait_for_job_done(controller)

    assert_true(b"\x18" in fake.writes, "failed G-code job must send soft reset")
    assert_true(controller.snapshot()["job"]["errors"] >= 1, "job error should be recorded")


def test_disconnect_sends_soft_reset_before_close():
    fake = FakeSerial()
    controller = controller_with_fake(fake)

    controller.disconnect()

    assert_true(fake.writes and fake.writes[0] == b"\x18", "disconnect should send soft reset first")
    assert_true(not fake.is_open, "serial port should be closed")


def test_status_query_during_job_uses_realtime_write_only():
    fake = FakeSerial(fail_on_read=True)
    controller = controller_with_fake(fake)
    controller._job["running"] = True

    controller.query_status()

    assert_true(fake.writes == [b"?"], "running status query should write realtime ? only")


def test_override_uses_realtime_bytes_without_waiting_for_ok():
    fake = FakeSerial(fail_on_read=True)
    controller = controller_with_fake(fake)

    controller.override("feed", "plus")
    controller.override("spindle", "minus")

    assert_true(fake.writes == [b"\x91", b"?", b"\x9b", b"?"], f"unexpected override writes: {fake.writes}")


def test_realtime_write_does_not_overlap_command_write():
    fake = SlowWriteSerial(["ok\n"])
    controller = controller_with_fake(fake)
    result = {}

    def run_command():
        result["value"] = controller._send_command_wait("G1 X10 F500", timeout=1)

    thread = threading.Thread(target=run_command)
    thread.start()
    time.sleep(0.02)
    controller._job["running"] = True
    controller.query_status()
    thread.join(timeout=1.0)

    assert_true(result.get("value") == "ok", "command should finish")
    assert_true(fake.max_active_writes == 1, "serial writes from realtime polling and command streaming must not overlap")
    assert_true(
        [item.decode("ascii", errors="ignore").strip() for item in fake.writes] == ["G1 X10 F500", "?"],
        f"unexpected serialized writes: {fake.writes}",
    )


def test_write_timeout_message_is_actionable():
    fake = WriteTimeoutSerial()
    controller = controller_with_fake(fake)

    try:
        controller._send_command_wait("?", timeout=0.1)
    except ValueError as exc:
        text = str(exc)
        assert_true("yazma zaman asimi" in text, f"timeout should be named clearly: {text}")
        assert_true("COM_TEST" in text, f"port should be included in timeout message: {text}")
    else:
        raise AssertionError("serial write timeout should fail")


def test_pause_extends_command_timeout():
    fake = FakeSerial()
    controller = controller_with_fake(fake)
    controller._paused = True
    result = {}

    def run_command():
        result["value"] = controller._send_command_wait("G1 X10 F500", timeout=0.05)

    thread = threading.Thread(target=run_command)
    thread.start()
    time.sleep(0.15)
    assert_true(thread.is_alive(), "paused command should not time out while paused")
    controller._paused = False
    fake.responses.append("ok\n")
    thread.join(timeout=1.0)

    assert_true(result.get("value") == "ok", "command should finish after resume")


def test_abort_breaks_command_wait_without_timeout():
    fake = FakeSerial()
    controller = controller_with_fake(fake)
    controller._job["running"] = True
    result = {}

    def run_command():
        try:
            controller._send_command_wait("G1 X10 F500", timeout=5)
        except Exception as exc:
            result["error"] = str(exc)

    thread = threading.Thread(target=run_command)
    thread.start()
    time.sleep(0.05)
    controller._abort_requested = True
    thread.join(timeout=0.8)

    assert_true(not thread.is_alive(), "abort should interrupt a waiting command quickly")
    assert_true("iptal" in result.get("error", ""), f"abort error should be explicit: {result}")


def test_frame_bounds_sends_laser_off_rectangle():
    fake = FakeSerial(["<Idle|MPos:0.000,0.000,0.000|FS:0,0>\n"] + ["ok\n"] * 10)
    controller = controller_with_fake(fake)

    controller.frame_bounds({"minX": 1, "minY": 2, "maxX": 11, "maxY": 22}, feed=1500, padding=1, confirmed=True)

    commands = [item.decode("ascii", errors="ignore").strip() for item in fake.writes]
    assert_true(commands[0] == "?", "frame should preflight status")
    assert_true(commands[1:4] == ["M5", "S0", "G90"], f"frame must force laser off first: {commands}")
    assert_true("G0 X0.000 Y1.000" in commands, f"frame should move to padded lower-left: {commands}")
    assert_true("G1 X12.000 Y23.000 F1500" in commands, f"frame should trace padded upper-right: {commands}")
    assert_true(commands[-2:] == ["M5", "S0"], f"frame must end laser off: {commands}")


def test_set_and_clear_work_origin():
    fake = FakeSerial(["<Idle|MPos:3.000,4.000,0.000|FS:0,0>\n", "ok\n"])
    controller = controller_with_fake(fake)

    controller.set_work_origin(confirmed=True)

    commands = [item.decode("ascii", errors="ignore").strip() for item in fake.writes]
    assert_true(commands == ["?", "G10 L20 P1 X0 Y0"], f"set origin should use persistent G10 L20: {commands}")

    fake_clear = FakeSerial(["<Idle|MPos:3.000,4.000,0.000|FS:0,0>\n", "ok\n"])
    controller_clear = controller_with_fake(fake_clear)
    controller_clear.set_work_origin(clear=True, confirmed=True)
    clear_commands = [item.decode("ascii", errors="ignore").strip() for item in fake_clear.writes]
    assert_true(clear_commands == ["?", "G10 L2 P1 X0 Y0"], f"clear origin should reset G54 with G10 L2: {clear_commands}")


def test_job_running_rejects_jog_raw_unlock_and_home():
    for action_name, run_action in (
        ("jog", lambda controller: controller.jog("X", 1, 1000)),
        ("raw", lambda controller: controller.send_raw("$I")),
        ("unlock", lambda controller: controller.control("unlock")),
        ("home", lambda controller: controller.control("home")),
    ):
        fake = FakeSerial()
        controller = controller_with_fake(fake)
        controller._job["running"] = True
        try:
            run_action(controller)
        except ValueError as exc:
            assert_true("calisan is" in str(exc), f"{action_name} should name the active job lock: {exc}")
        else:
            raise AssertionError(f"{action_name} should be rejected while a job is running")
        assert_true(fake.writes == [], f"{action_name} should not write while a job is running")


def test_refresh_settings_reports_laser_mode_warning():
    fake = FakeSerial(["$0=10\n", "$32=0\n", "ok\n"])
    controller = controller_with_fake(fake)

    snapshot = controller.refresh_settings()

    commands = [item.decode("ascii", errors="ignore").strip() for item in fake.writes]
    assert_true(commands == ["$$"], f"settings read should send $$: {commands}")
    assert_true(snapshot["settings"].get("32") == 0.0, f"$32 should be parsed: {snapshot}")
    assert_true(snapshot["warnings"], "disabled laser mode should create a machine warning")


def test_m3_gcode_logs_laser_mode_warning_when_32_disabled():
    fake = FakeSerial(["<Idle|MPos:0.000,0.000,0.000|FS:0,0>\n", "ok\n", "ok\n", "ok\n"])
    controller = controller_with_fake(fake)
    controller._settings = {"32": 0.0}

    controller.start_gcode(["G90", "M3 S100", "G1 X1 F100"], confirmed=True)
    wait_for_job_done(controller)

    assert_true(any("M3" in line and "$32=1" in line for line in controller.snapshot()["log"]), "M3 job should log a $32 warning")


def test_focus_pulse_turns_laser_off_after_short_fire():
    fake = FakeSerial(["<Idle|MPos:0.000,0.000,0.000|FS:0,0>\n"] + ["ok\n"] * 5)
    controller = controller_with_fake(fake)

    controller.focus_pulse(power=10, duration_ms=1, confirmed=True)

    commands = [item.decode("ascii", errors="ignore").strip() for item in fake.writes]
    assert_true(commands[:4] == ["?", "M5", "S0", "M3 S10"], f"pulse should start from laser-off state: {commands}")
    assert_true(commands[-2:] == ["M5", "S0"], f"pulse must end laser off: {commands}")


def test_focus_pulse_rejects_high_power_before_machine_write():
    fake = FakeSerial()
    controller = controller_with_fake(fake)

    try:
        controller.focus_pulse(power=201, duration_ms=80, confirmed=True)
    except ValueError as exc:
        assert_true("S200" in str(exc), f"unexpected error: {exc}")
    else:
        raise AssertionError("high-power focus pulse should be rejected")

    assert_true(fake.writes == [], "invalid focus pulse should not write to machine")


def main():
    tests = [
        test_clean_gcode_line_strips_comments,
        test_gcode_file_reader_accepts_legacy_turkish_comments,
        test_parse_status_line_reads_state_position_and_power,
        test_gcode_bounds_tracks_modal_xy,
        test_analyze_gcode_marks_cut_travel_and_timing,
        test_analyze_gcode_classifies_cut_engrave_and_ranges,
        test_analyze_gcode_does_not_draw_g92_as_motion,
        test_analyze_gcode_converts_inch_jobs_to_mm,
        test_analyze_gcode_reports_modal_safety_warnings,
        test_analyze_gcode_does_not_accept_earlier_m5_as_final_shutdown,
        test_usb_serial_port_scores_above_bluetooth,
        test_bluetooth_port_is_never_auto_selected,
        test_gcode_error_sends_soft_reset,
        test_disconnect_sends_soft_reset_before_close,
        test_status_query_during_job_uses_realtime_write_only,
        test_override_uses_realtime_bytes_without_waiting_for_ok,
        test_realtime_write_does_not_overlap_command_write,
        test_write_timeout_message_is_actionable,
        test_pause_extends_command_timeout,
        test_abort_breaks_command_wait_without_timeout,
        test_frame_bounds_sends_laser_off_rectangle,
        test_set_and_clear_work_origin,
        test_job_running_rejects_jog_raw_unlock_and_home,
        test_refresh_settings_reports_laser_mode_warning,
        test_m3_gcode_logs_laser_mode_warning_when_32_disabled,
        test_focus_pulse_turns_laser_off_after_short_fire,
        test_focus_pulse_rejects_high_power_before_machine_write,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All GRBL helper tests passed.")


if __name__ == "__main__":
    main()
