"""Local SQLite storage and opt-in text clipboard capture for NEXO."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any

MAX_TEXT = 20_000
MAX_NOTES = 500
MAX_CLIPS = 200


def data_home() -> Path:
    override = os.environ.get("NEXO_DATA_DIR")
    base = Path(override) if override else Path(os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))) / "nexo"
    base.mkdir(parents=True, exist_ok=True, mode=0o700)
    return base


def looks_sensitive(text: str) -> bool:
    """Conservative, explicitly documented heuristic; never claim perfect secret detection."""
    patterns = [
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
        r"\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b",
        r"\bgh[pousr]_[A-Za-z0-9]{20,}\b",
        r"\bAKIA[A-Z0-9]{16}\b",
        r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b",
        r"(?im)^\s*(?:password|passwd|senha|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+",
    ]
    return any(re.search(pattern, text) for pattern in patterns)


class Store:
    def __init__(self, directory: Path | None = None) -> None:
        self.directory = directory or data_home()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(self.directory / "nexo.db"), check_same_thread=False, timeout=10)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT 'sage', pinned INTEGER NOT NULL DEFAULT 0,
                created REAL NOT NULL, updated REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY, text TEXT NOT NULL, hash TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        """)
        self.db.commit()
        try:
            os.chmod(self.directory / "nexo.db", 0o600)
        except OSError:
            pass

    def close(self) -> None:
        with self.lock:
            self.db.close()

    def setting(self, key: str, default: Any) -> Any:
        with self.lock:
            row = self.db.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return json.loads(row["value"]) if row else default

    def set_setting(self, key: str, value: Any) -> None:
        with self.lock:
            self.db.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))
            self.db.commit()

    def notes(self, query: str = "") -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM notes ORDER BY pinned DESC, updated DESC").fetchall()
        notes = [dict(row) for row in rows]
        for note in notes:
            note["pinned"] = bool(note["pinned"])
        if query:
            q = query.casefold()
            notes = [n for n in notes if q in n["title"].casefold() or q in n["body"].casefold()]
        return notes

    def create_note(self, data: dict) -> dict:
        title = str(data.get("title", "")).strip()[:160]
        body = str(data.get("body", ""))[:MAX_TEXT]
        if not title and not body.strip():
            raise ValueError("Escreva um título ou algum texto.")
        color = data.get("color", "sage")
        if color not in ("sage", "sand", "blue", "rose", "plain"):
            raise ValueError("Cor inválida.")
        now = time.time()
        note = {"id": str(uuid.uuid4()), "title": title or "Sem título", "body": body,
                "color": color, "pinned": bool(data.get("pinned", False)), "created": now, "updated": now}
        with self.lock:
            count = self.db.execute("SELECT count(*) FROM notes").fetchone()[0]
            if count >= MAX_NOTES:
                raise ValueError("Limite de 500 notas atingido. Exporte ou remova notas antigas.")
            self.db.execute("INSERT INTO notes VALUES(:id,:title,:body,:color,:pinned,:created,:updated)", note)
            self.db.commit()
        return note

    def update_note(self, note_id: str, data: dict) -> dict:
        with self.lock:
            row = self.db.execute("SELECT * FROM notes WHERE id=?", (note_id,)).fetchone()
            if not row:
                raise KeyError("Nota não encontrada.")
            note = dict(row)
            for field in ("title", "body", "color", "pinned"):
                if field in data:
                    note[field] = data[field]
            note["title"] = str(note["title"]).strip()[:160] or "Sem título"
            note["body"] = str(note["body"])[:MAX_TEXT]
            if note["color"] not in ("sage", "sand", "blue", "rose", "plain"):
                raise ValueError("Cor inválida.")
            note["pinned"] = int(bool(note["pinned"]))
            note["updated"] = time.time()
            self.db.execute("UPDATE notes SET title=:title,body=:body,color=:color,pinned=:pinned,updated=:updated WHERE id=:id", note)
            self.db.commit()
        note["pinned"] = bool(note["pinned"])
        return note

    def delete_note(self, note_id: str) -> None:
        with self.lock:
            cursor = self.db.execute("DELETE FROM notes WHERE id=?", (note_id,))
            self.db.commit()
        if cursor.rowcount == 0:
            raise KeyError("Nota não encontrada.")

    def clips(self, query: str = "") -> list[dict]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM clips ORDER BY pinned DESC, created DESC LIMIT ?", (MAX_CLIPS,)).fetchall()
        clips = [dict(row) for row in rows]
        for clip in clips:
            clip["pinned"] = bool(clip["pinned"])
            clip.pop("hash", None)
        if query:
            clips = [c for c in clips if query.casefold() in c["text"].casefold()]
        return clips

    def add_clip(self, text: str, source: str = "manual") -> dict | None:
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT:
            raise ValueError("O texto precisa ter entre 1 e 20.000 caracteres.")
        if source == "clipboard" and looks_sensitive(text):
            return None
        digest = hashlib.sha256(text.encode()).hexdigest()
        now = time.time()
        with self.lock:
            existing = self.db.execute("SELECT id FROM clips WHERE hash=?", (digest,)).fetchone()
            if existing:
                if source == "clipboard":
                    return None
                self.db.execute("UPDATE clips SET created=? WHERE id=?", (now, existing["id"]))
            else:
                self.db.execute("INSERT INTO clips(id,text,hash,source,pinned,created) VALUES(?,?,?,?,0,?)",
                                (str(uuid.uuid4()), text, digest, source, now))
            self.db.execute("DELETE FROM clips WHERE pinned=0 AND id NOT IN (SELECT id FROM clips ORDER BY created DESC LIMIT ?)", (MAX_CLIPS,))
            self.db.commit()
            row = self.db.execute("SELECT * FROM clips WHERE hash=?", (digest,)).fetchone()
        clip = dict(row)
        clip.pop("hash")
        clip["pinned"] = bool(clip["pinned"])
        return clip

    def pin_clip(self, clip_id: str, pinned: bool) -> None:
        with self.lock:
            cursor = self.db.execute("UPDATE clips SET pinned=? WHERE id=?", (int(pinned), clip_id))
            self.db.commit()
        if cursor.rowcount == 0:
            raise KeyError("Item não encontrado.")

    def delete_clip(self, clip_id: str) -> None:
        with self.lock:
            cursor = self.db.execute("DELETE FROM clips WHERE id=?", (clip_id,))
            self.db.commit()
        if cursor.rowcount == 0:
            raise KeyError("Item não encontrado.")

    def clear_clips(self) -> None:
        with self.lock:
            self.db.execute("DELETE FROM clips WHERE pinned=0")
            self.db.commit()

    def export(self) -> dict:
        return {"app": "NEXO", "version": 1, "exported": time.time(),
                "notes": self.notes(), "clips": self.clips(),
                "settings": {"clipboardEnabled": self.setting("clipboardEnabled", False)}}


class ClipboardBridge:
    """Text only. Capture is off by default and runs only while explicitly enabled."""
    def __init__(self, store: Store) -> None:
        self.store = store
        self.stop_event = threading.Event()
        self.thread: threading.Thread | None = None
        self.last_error = ""
        self.last_seen = ""

    @staticmethod
    def backend() -> str | None:
        if os.environ.get("WAYLAND_DISPLAY") and shutil.which("wl-paste") and shutil.which("wl-copy"):
            return "wayland"
        if os.environ.get("DISPLAY") and shutil.which("xclip"):
            return "x11"
        return None

    def status(self) -> dict:
        backend = self.backend()
        return {"available": backend is not None, "backend": backend,
                "enabled": bool(self.store.setting("clipboardEnabled", False)) and backend is not None,
                "error": self.last_error, "textOnly": True, "sensitiveFilter": True}

    def read(self) -> str | None:
        backend = self.backend()
        if backend == "wayland":
            args = ["wl-paste", "--no-newline", "--type", "text/plain"]
        elif backend == "x11":
            args = ["xclip", "-selection", "clipboard", "-o", "-t", "UTF8_STRING"]
        else:
            return None
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=2, check=False)
            return result.stdout if result.returncode == 0 and len(result.stdout) <= MAX_TEXT else None
        except (OSError, subprocess.TimeoutExpired):
            return None

    def write(self, text: str) -> bool:
        backend = self.backend()
        if not backend or not isinstance(text, str) or len(text) > MAX_TEXT:
            return False
        args = ["wl-copy", "--type", "text/plain"] if backend == "wayland" else ["xclip", "-selection", "clipboard", "-i"]
        try:
            result = subprocess.run(args, input=text, text=True, capture_output=True, timeout=3, check=False)
            if result.returncode == 0:
                self.last_seen = text
                return True
        except (OSError, subprocess.TimeoutExpired):
            pass
        return False

    def poll(self) -> None:
        while not self.stop_event.wait(1.2):
            if not self.store.setting("clipboardEnabled", False):
                continue
            text = self.read()
            if text is None or not text.strip() or text == self.last_seen:
                continue
            self.last_seen = text
            try:
                self.store.add_clip(text, "clipboard")
                self.last_error = ""
            except ValueError:
                pass

    def start(self) -> None:
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self.poll, name="nexo-clipboard", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=3)
