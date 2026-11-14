#!/usr/bin/env python3
"""NEXO local API and production static server. Python standard library only."""
from __future__ import annotations

import argparse
import hmac
import json
import os
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from system import (
    SystemMonitor,
    command_exists,
    package_commands,
    pacman_insights,
    pacman_package_info,
    pacman_packages,
)

ROOT = Path(__file__).resolve().parent.parent
STATIC = Path(os.environ.get("NEXO_STATIC_DIR", str(ROOT / "dist")))
TOKEN = secrets.token_urlsafe(32)
BOOTSTRAP_KEY = os.environ.get("NEXO_BOOTSTRAP_KEY", "")
MAX_BODY = 64 * 1024
VERSION = "3.0.0"


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        self.status = status
        self.message = message


class NexoServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], preview: bool = False) -> None:
        super().__init__(address, Handler)
        self.monitor = SystemMonitor()
        self.preview = preview
        self.started = time.time()


class Handler(BaseHTTPRequestHandler):
    server: NexoServer
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        if os.environ.get("NEXO_VERBOSE"):
            super().log_message(fmt, *args)

    def security_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")

    def respond(self, status: int, data: dict | list, cookie: bool = False) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.security_headers()
        if cookie:
            self.send_header("Set-Cookie", f"nexo_session={TOKEN}; HttpOnly; SameSite=Strict; Path=/")
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, message: str) -> None:
        self.respond(status, {"error": message})

    def bootstrap_authorized(self) -> bool:
        supplied = self.headers.get("X-NEXO-Key") or parse_qs(urlparse(self.path).query).get("nexo_key", [""])[0]
        return self.server.preview or hmac.compare_digest(supplied, BOOTSTRAP_KEY)

    def authorized(self) -> bool:
        values = {}
        for part in self.headers.get("Cookie", "").split(";"):
            if "=" in part:
                key, value = part.strip().split("=", 1)
                values[key] = value
        return hmac.compare_digest(values.get("nexo_session", ""), TOKEN)

    def check_origin(self, mutating: bool = False) -> None:
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        allowed_hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        if host not in allowed_hosts:
            raise ApiError(403, "Host não autorizado.")
        if origin:
            parsed = urlparse(origin)
            if parsed.scheme not in ("http", "https") or parsed.netloc not in allowed_hosts:
                raise ApiError(403, "Origem não autorizada.")
        if mutating:
            if not self.authorized():
                raise ApiError(401, "Sessão local necessária. Abra o NEXO novamente.")
            if not origin:
                raise ApiError(403, "Origem necessária para alterar dados.")
            if self.headers.get("X-NEXO-Request") != "1":
                raise ApiError(403, "Cabeçalho de proteção ausente.")

    def body(self) -> dict:
        self.close_connection = True
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ApiError(400, "Tamanho inválido.")
        if length <= 0 or length > MAX_BODY:
            raise ApiError(413, "Corpo vazio ou maior que 64 KB.")
        if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            raise ApiError(415, "Envie JSON.")
        try:
            data = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise ApiError(400, "JSON inválido.")
        if not isinstance(data, dict):
            raise ApiError(400, "Esperado um objeto JSON.")
        self.close_connection = False
        return data

    def do_GET(self) -> None:
        try:
            parsed = urlparse(self.path)
            if not parsed.path.startswith("/api/"):
                return self.static(parsed.path)
            self.check_origin()
            query = parse_qs(parsed.query)
            search = query.get("q", [""])[0][:200]
            if parsed.path == "/api/session":
                if not self.authorized() and not self.bootstrap_authorized():
                    raise ApiError(401, "Abra o NEXO pelo atalho ou pelo comando nexo open.")
                return self.respond(200, {"app": "NEXO", "version": VERSION, "preview": self.server.preview,
                                          "focus": "system-pacman", "tokenReady": True}, cookie=True)
            if not self.authorized():
                raise ApiError(401, "Abra a sessão local primeiro.")
            if parsed.path == "/api/system":
                return self.respond(200, self.server.monitor.snapshot())
            if parsed.path == "/api/packages":
                return self.respond(200, pacman_packages(search))
            if parsed.path == "/api/pacman/insights":
                return self.respond(200, pacman_insights())
            if parsed.path == "/api/pacman/package":
                name = query.get("name", [""])[0][:200]
                return self.respond(200, pacman_package_info(name))
            if parsed.path == "/api/export":
                return self.respond(200, {"app": "NEXO", "version": VERSION, "generated": time.time(),
                                          "system": self.server.monitor.snapshot(), "pacman": pacman_insights()})
            if parsed.path == "/api/capabilities":
                return self.respond(200, {"pacman": command_exists("pacman"),
                                          "browser": next((b for b in ("chromium", "google-chrome-stable", "firefox") if command_exists(b)), None),
                                          "preview": self.server.preview})
            raise ApiError(404, "Endpoint não encontrado.")
        except ApiError as exc:
            self.error(exc.status, exc.message)
        except ValueError as exc:
            self.error(400, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.error(500, "Não foi possível concluir a operação local.")

    def do_POST(self) -> None:
        try:
            self.check_origin(mutating=True)
            path = urlparse(self.path).path
            data = self.body()
            if path == "/api/commands":
                return self.respond(200, package_commands(str(data.get("action", "")), str(data.get("package", ""))))
            raise ApiError(404, "Endpoint não encontrado.")
        except ApiError as exc:
            self.error(exc.status, exc.message)
        except ValueError as exc:
            self.error(400, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.error(500, "Não foi possível montar o comando.")

    def do_PATCH(self) -> None:
        self.close_connection = True
        self.error(405, "O NEXO focado não possui configurações graváveis no servidor.")

    def do_DELETE(self) -> None:
        self.close_connection = True
        self.error(405, "O NEXO focado não armazena notas ou histórico de clipboard.")

    def static(self, request_path: str) -> None:
        if not STATIC.is_dir():
            return self.error(503, "Interface ainda não compilada. Execute npm run build.")
        relative = request_path.lstrip("/") or "index.html"
        candidate = (STATIC / relative).resolve()
        if not candidate.is_relative_to(STATIC.resolve()):
            return self.error(403, "Caminho não autorizado.")
        if not candidate.is_file():
            if Path(relative).suffix:
                return self.error(404, "Arquivo não encontrado.")
            candidate = STATIC / "index.html"
        types = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
                 ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json"}
        body = candidate.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", types.get(candidate.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.security_headers()
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    parser = argparse.ArgumentParser(description="NEXO — cockpit local de sistema e pacman para Arch")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--preview", action="store_true", help="Explicit public-sandbox mode; use only behind the development proxy")
    args = parser.parse_args()
    if not args.preview and not BOOTSTRAP_KEY:
        parser.error("Inicie com ./nexo start (ou nexo open), que cria a chave local de sessão.")
    if not args.preview and args.host not in ("127.0.0.1", "localhost", "::1"):
        parser.error("O NEXO local só aceita loopback. Use --preview apenas no sandbox de demonstração.")
    server = NexoServer((args.host, args.port), preview=args.preview)
    print(f"NEXO API: http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
