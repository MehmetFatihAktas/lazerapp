import http.client
import json
import threading
from pathlib import Path
from tempfile import TemporaryDirectory

import laser_editor_server as server


def assert_status(response, expected):
    body = response.read()
    if response.status != expected:
        raise AssertionError(f"expected HTTP {expected}, got {response.status}: {body!r}")
    return json.loads(body.decode("utf-8"))


def request(api_server, method, path, *, token="", origin="", content_type="application/json", body=b"{}"):
    host, port = api_server.server_address[:2]
    connection = http.client.HTTPConnection(host, port, timeout=5)
    headers = {
        "Host": api_server.expected_host,
        "Content-Type": content_type,
        "Content-Length": str(len(body)),
    }
    if token:
        headers[server.API_TOKEN_HEADER] = token
    if origin:
        headers["Origin"] = origin
    connection.request(method, path, body=body, headers=headers)
    return connection, connection.getresponse()


def test_api_security_boundary():
    api_server = server.LaserEditorHttpServer(("127.0.0.1", 0), server.LaserEditorHandler)
    worker = threading.Thread(target=api_server.serve_forever, daemon=True)
    worker.start()
    try:
        connection, response = request(
            api_server,
            "GET",
            "/api/health",
            origin=api_server.expected_origin,
            body=b"",
        )
        assert_status(response, 401)
        connection.close()

        connection, response = request(
            api_server,
            "GET",
            "/api/health",
            token=api_server.api_token,
            origin="http://evil.invalid",
            body=b"",
        )
        assert_status(response, 403)
        connection.close()

        connection, response = request(
            api_server,
            "POST",
            "/api/client/ping",
            token=api_server.api_token,
            origin=api_server.expected_origin,
            content_type="text/plain",
        )
        assert_status(response, 415)
        connection.close()

        connection, response = request(
            api_server,
            "POST",
            "/api/client/ping",
            token=api_server.api_token,
            origin=api_server.expected_origin,
            body=b'{"clientId":"security-test"}',
        )
        payload = assert_status(response, 200)
        assert payload["ok"] is True
        connection.close()

        connection, response = request(
            api_server,
            "GET",
            "/",
            body=b"",
        )
        html = response.read().decode("utf-8")
        assert response.status == 200
        assert api_server.api_token in html
        assert 'name="laser-app-token"' in html
        connection.close()
    finally:
        api_server.shutdown()
        api_server.server_close()
        worker.join(timeout=5)


def test_api_rejects_oversized_declared_body():
    api_server = server.LaserEditorHttpServer(("127.0.0.1", 0), server.LaserEditorHandler)
    worker = threading.Thread(target=api_server.serve_forever, daemon=True)
    worker.start()
    try:
        host, port = api_server.server_address[:2]
        connection = http.client.HTTPConnection(host, port, timeout=5)
        connection.putrequest("POST", "/api/client/ping", skip_host=True)
        connection.putheader("Host", api_server.expected_host)
        connection.putheader(server.API_TOKEN_HEADER, api_server.api_token)
        connection.putheader("Origin", api_server.expected_origin)
        connection.putheader("Content-Type", "application/json")
        connection.putheader("Content-Length", str(server.API_DEFAULT_BODY_LIMIT + 1))
        connection.endheaders()
        payload = assert_status(connection.getresponse(), 413)
        assert payload["code"] == "body_too_large"
        connection.close()
    finally:
        api_server.shutdown()
        api_server.server_close()
        worker.join(timeout=5)


def test_file_grants_are_scoped_and_single_use():
    with TemporaryDirectory() as directory:
        path = Path(directory) / "job.nc"
        registry = server.FileGrantRegistry(max_age_seconds=60)
        read_handle = registry.issue(path, {"gcode:read"})
        assert registry.resolve(read_handle, "gcode:read") == path.resolve()
        try:
            registry.resolve(read_handle, "gcode:write")
        except server.ApiRequestError as error:
            assert error.code == "file_handle_scope"
        else:
            raise AssertionError("read handle must not authorize writes")

        write_handle = registry.issue(path, {"gcode:write"}, single_use=True)
        assert registry.resolve(write_handle, "gcode:write", consume=True) == path.resolve()
        try:
            registry.resolve(write_handle, "gcode:write", consume=True)
        except server.ApiRequestError as error:
            assert error.code == "file_handle_invalid"
        else:
            raise AssertionError("single-use write handle must be consumed")


def test_api_rejects_wrong_handle_scope():
    api_server = server.LaserEditorHttpServer(("127.0.0.1", 0), server.LaserEditorHandler)
    worker = threading.Thread(target=api_server.serve_forever, daemon=True)
    worker.start()
    try:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "project.json"
            path.write_text("{}", encoding="utf-8")
            wrong_handle = api_server.file_grants.issue(path, {"project:read"})
            body = json.dumps({"artifactHandle": wrong_handle}).encode("utf-8")
            connection, response = request(
                api_server,
                "POST",
                "/api/machine/gcode-info",
                token=api_server.api_token,
                origin=api_server.expected_origin,
                body=body,
            )
            payload = assert_status(response, 403)
            assert payload["code"] == "file_handle_scope"
            connection.close()
    finally:
        api_server.shutdown()
        api_server.server_close()
        worker.join(timeout=5)


def test_machine_profile_api_persists_verified_profile():
    with TemporaryDirectory() as directory:
        original_file = server.MACHINE_PROFILE_FILE
        server.MACHINE_PROFILE_FILE = Path(directory) / "machine-profile.json"
        api_server = server.LaserEditorHttpServer(("127.0.0.1", 0), server.LaserEditorHandler)
        worker = threading.Thread(target=api_server.serve_forever, daemon=True)
        worker.start()
        profile = {
            "id": "grbl-api-test",
            "name": "API Test",
            "maxS": 1000,
            "travelX": 400,
            "travelY": 400,
            "stepsX": 80,
            "stepsY": 80,
            "maxRateX": 6000,
            "maxRateY": 6000,
            "accelerationX": 500,
            "accelerationY": 500,
            "verified": True,
        }
        try:
            body = json.dumps({"machineProfile": profile}).encode("utf-8")
            connection, response = request(
                api_server,
                "POST",
                "/api/machine-profile",
                token=api_server.api_token,
                origin=api_server.expected_origin,
                body=body,
            )
            saved = assert_status(response, 200)["machineProfile"]
            assert saved["id"] == "grbl-api-test"
            connection.close()

            connection, response = request(
                api_server,
                "GET",
                "/api/machine-profile",
                token=api_server.api_token,
                origin=api_server.expected_origin,
                body=b"",
            )
            loaded = assert_status(response, 200)["machineProfile"]
            assert loaded["accelerationX"] == 500
            connection.close()
        finally:
            api_server.shutdown()
            api_server.server_close()
            worker.join(timeout=5)
            server.MACHINE_PROFILE_FILE = original_file


def main():
    tests = [
        test_api_security_boundary,
        test_api_rejects_oversized_declared_body,
        test_file_grants_are_scoped_and_single_use,
        test_api_rejects_wrong_handle_scope,
        test_machine_profile_api_persists_verified_profile,
    ]
    for test in tests:
        test()
        print(f"PASS {test.__name__}")
    print("All server security tests passed.")


if __name__ == "__main__":
    main()
