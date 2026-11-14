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

from store import ClipboardBridge, Store, data_home
from system import SystemMonitor, command_exists, package_commands, pacman_packages

ROOT = Path(__file__).resolve().parent.parent
STATIC = Path(os.environ.get("NEXO_STATIC_DIR", str(ROOT / "dist")))
TOKEN = secrets.token_urlsafe(32)
BOOTSTRAP_KEY = os.environ.get("NEXO_BOOTSTRAP_KEY", "")
MAX_BODY = 64 * 1024


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        self.status = status
        self.message = message


class NexoServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], store: Store, preview: bool = False) -> None:
        super().__init__(address, Handler)
        self.store = store
        self.clipboard = ClipboardBridge(store)
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
        # Query bootstrap is consumed and removed by the frontend before React effects.
        # Also accept the header for CLI probes and the explicitly enabled dev proxy.
        supplied = self.headers.get("X-NEXO-Key") or parse_qs(urlparse(self.path).query).get("nexo_key", [""])[0]
        return self.server.preview or hmac.compare_digest(supplied, BOOTSTRAP_KEY)

    def authorized(self) -> bool:
        cookie = self.headers.get("Cookie", "")
        values = {}
        for part in cookie.split(";"):
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
                # The launcher delivers this one-time bootstrap key in the URL fragment/query.
                # Other OS users cannot read its 0600 runtime file just because loopback is shared.
                if not self.authorized() and not self.bootstrap_authorized():
                    raise ApiError(401, "Abra o NEXO pelo atalho ou pelo comando nexo open.")
                return self.respond(200, {"app": "NEXO", "version": "2.0.0", "preview": self.server.preview,
                                          "dataDir": str(self.server.store.directory), "tokenReady": True}, cookie=True)
            if not self.authorized():
                raise ApiError(401, "Abra a sessão local primeiro.")
            if parsed.path == "/api/system":
                return self.respond(200, self.server.monitor.snapshot())
            if parsed.path == "/api/notes":
                return self.respond(200, {"notes": self.server.store.notes(search)})
            if parsed.path == "/api/clips":
                return self.respond(200, {"clips": self.server.store.clips(search), "status": self.server.clipboard.status()})
            if parsed.path == "/api/packages":
                return self.respond(200, pacman_packages(search))
            if parsed.path == "/api/export":
                return self.respond(200, self.server.store.export())
            if parsed.path == "/api/capabilities":
                return self.respond(200, {"clipboard": self.server.clipboard.status(),
                                          "pacman": command_exists("pacman"),
                                          "browser": next((b for b in ("chromium", "google-chrome-stable", "firefox") if command_exists(b)), None),
                                          "preview": self.server.preview})
            raise ApiError(404, "Endpoint não encontrado.")
        except ApiError as exc:
            self.error(exc.status, exc.message)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.error(500, "Não foi possível concluir a operação local.")

    def do_POST(self) -> None:
        self.mutate(create=True)

    def do_PATCH(self) -> None:
        self.mutate(create=False)

    def do_DELETE(self) -> None:
        try:
            if self.headers.get("Content-Length", "0") != "0":
                self.close_connection = True
                raise ApiError(400, "DELETE não aceita corpo.")
            self.check_origin(mutating=True)
            path = urlparse(self.path).path
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[:2] == ["api", "notes"]:
                self.server.store.delete_note(parts[2])
            elif len(parts) == 3 and parts[:2] == ["api", "clips"]:
                self.server.store.delete_clip(parts[2])
            elif path == "/api/clips":
                self.server.store.clear_clips()
            else:
                raise ApiError(404, "Item não encontrado.")
            self.respond(200, {"ok": True})
        except ApiError as exc:
            self.error(exc.status, exc.message)
        except KeyError as exc:
            self.error(404, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass

    def mutate(self, create: bool) -> None:
        try:
            self.check_origin(mutating=True)
            path = urlparse(self.path).path
            data = self.body()
            store = self.server.store
            if path == "/api/notes" and create:
                return self.respond(201, {"note": store.create_note(data)})
            parts = path.strip("/").split("/")
            if len(parts) == 3 and parts[:2] == ["api", "notes"] and not create:
                return self.respond(200, {"note": store.update_note(parts[2], data)})
            if path == "/api/clips" and create:
                clip = store.add_clip(str(data.get("text", "")), "manual")
                return self.respond(201, {"clip": clip})
            if len(parts) == 3 and parts[:2] == ["api", "clips"] and not create:
                store.pin_clip(parts[2], bool(data.get("pinned", False)))
                return self.respond(200, {"ok": True})
            if path == "/api/clipboard/copy" and create:
                text = str(data.get("text", ""))[:20000]
                copied = self.server.clipboard.write(text)
                return self.respond(200, {"copied": copied, "message": "" if copied else "Sem acesso à área de transferência do desktop. Use a cópia pelo navegador."})
            if path == "/api/settings" and not create:
                if "clipboardEnabled" in data:
                    enabled = bool(data["clipboardEnabled"])
                    if enabled and not self.server.clipboard.backend():
                        raise ApiError(409, "Instale wl-clipboard no Wayland ou xclip no X11 e abra o NEXO no seu desktop.")
                    store.set_setting("clipboardEnabled", enabled)
                return self.respond(200, {"status": self.server.clipboard.status()})
            if path == "/api/commands" and create:
                return self.respond(200, package_commands(str(data.get("action", "")), str(data.get("package", ""))))
            raise ApiError(404, "Endpoint não encontrado.")
        except ApiError as exc:
            self.error(exc.status, exc.message)
        except ValueError as exc:
            self.error(400, str(exc))
        except KeyError as exc:
            self.error(404, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.error(500, "Não foi possível salvar a alteração local.")

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
    parser = argparse.ArgumentParser(description="NEXO — central local para Linux")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--preview", action="store_true", help="Explicit public-sandbox mode; use only behind the development proxy")
    args = parser.parse_args()
    if not args.preview and not BOOTSTRAP_KEY:
        parser.error("Inicie com ./nexo start (ou nexo open), que cria a chave local de sessão.")
    if not args.preview and args.host not in ("127.0.0.1", "localhost", "::1"):
        parser.error("O NEXO local só aceita loopback. Use --preview apenas no sandbox de demonstração.")
    store = Store(data_home())
    server = NexoServer((args.host, args.port), store, preview=args.preview)
    # Clipboard capture is opt-in per process, never silently resumed after a restart.
    store.set_setting("clipboardEnabled", False)
    server.clipboard.start()
    print(f"NEXO API: http://{args.host}:{args.port}", flush=True)
    print(f"Dados locais: {store.directory}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.clipboard.stop()
        server.server_close()
        store.close()


if __name__ == "__main__":
    main()
