import json
from http.server import BaseHTTPRequestHandler

from optimizer.optimizer import optimize


class handler(BaseHTTPRequestHandler):

    def send_json(self, status_code, data):
        body = json.dumps(data).encode("utf-8")

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()

        self.wfile.write(body)

    def do_POST(self):
        try:
            content_length = int(
                self.headers.get("Content-Length", 0)
            )

            if content_length <= 0:
                return self.send_json(
                    400,
                    {
                        "success": False,
                        "message": "Scheduling data is required.",
                    },
                )

            raw_body = self.rfile.read(content_length)

            data = json.loads(raw_body.decode("utf-8"))

            result = optimize(data)

            if not result.get("success"):
                return self.send_json(422, result)

            return self.send_json(200, result)

        except json.JSONDecodeError:
            return self.send_json(
                400,
                {
                    "success": False,
                    "message": "Invalid JSON input.",
                },
            )

        except Exception as error:
            return self.send_json(
                500,
                {
                    "success": False,
                    "message": str(error),
                },
            )