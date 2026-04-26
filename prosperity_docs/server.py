"""
Local dev server for the Prosperity Dashboard.
Serves static files like http.server, plus a POST /save-excel endpoint
that writes the supplied base64-encoded .xlsx to SAVE_DIR.
"""

import base64
import http.server
import json
import os
import re

SAVE_DIR = r"C:\Users\mitch\OneDrive - purdue.edu\Other\IP4"
PORT = 8765
HOST = "127.0.0.1"
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/save-excel":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                payload = json.loads(body.decode("utf-8"))

                raw_name = os.path.basename(payload.get("filename", "output.xlsx"))
                safe_name = re.sub(r"[^\w.\-]", "_", raw_name)
                if not safe_name.lower().endswith(".xlsx"):
                    safe_name += ".xlsx"

                os.makedirs(SAVE_DIR, exist_ok=True)
                filepath = os.path.join(SAVE_DIR, safe_name)

                file_bytes = base64.b64decode(payload["data"])
                with open(filepath, "wb") as fh:
                    fh.write(file_bytes)

                self._respond(200, {"saved": filepath, "bytes": len(file_bytes)})
            except Exception as exc:
                self._respond(500, {"error": str(exc)})
        else:
            self.send_response(404)
            self.end_headers()

    def _respond(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # silence per-request logs


if __name__ == "__main__":
    os.chdir(REPO_ROOT)
    with http.server.HTTPServer((HOST, PORT), Handler) as httpd:
        print(f"Serving http://{HOST}:{PORT}/  |  save endpoint: POST /save-excel -> {SAVE_DIR}")
        httpd.serve_forever()
