"""Read-only Linux/Arch cockpit sensors. No shell, no root, no third-party deps."""
from __future__ import annotations

import os
import platform
import pwd
import re
import shlex
import shutil
import subprocess
import threading
import time
from pathlib import Path


def read_text(path: str | Path) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def os_release() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in read_text("/etc/os-release").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"')
    return values


def meminfo() -> dict:
    values: dict[str, int] = {}
    for line in read_text("/proc/meminfo").splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1].isdigit():
            values[parts[0].rstrip(":")] = int(parts[1]) * 1024
    total = values.get("MemTotal", 0)
    available = values.get("MemAvailable", values.get("MemFree", 0))
    swap_total = values.get("SwapTotal", 0)
    swap_used = max(0, swap_total - values.get("SwapFree", 0))
    return {
        "total": total,
        "available": available,
        "used": max(0, total - available),
        "percent": round((total - available) / total * 100, 1) if total else 0,
        "cached": values.get("Cached", 0),
        "buffers": values.get("Buffers", 0),
        "swapTotal": swap_total,
        "swapUsed": swap_used,
        "swapPercent": round(swap_used / swap_total * 100, 1) if swap_total else 0,
    }


def _times_from_line(line: str) -> tuple[int, int]:
    parts = line.split()
    if len(parts) < 5:
        return 0, 0
    try:
        values = [int(v) for v in parts[1:]]
    except ValueError:
        return 0, 0
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return sum(values), idle


def cpu_times() -> tuple[int, int]:
    text = read_text("/proc/stat")
    if not text:
        return 0, 0
    first = text.splitlines()[0]
    return _times_from_line(first) if first.startswith("cpu ") else (0, 0)


def cpu_core_times() -> dict[str, tuple[int, int]]:
    cores: dict[str, tuple[int, int]] = {}
    for line in read_text("/proc/stat").splitlines():
        if re.match(r"^cpu\d+ ", line):
            cores[line.split()[0]] = _times_from_line(line)
    return cores


def _percent(current: tuple[int, int], previous: tuple[int, int]) -> float:
    total = current[0] - previous[0]
    idle = current[1] - previous[1]
    if total <= 0:
        return 0.0
    return max(0.0, min(100.0, round(100 * (1 - idle / total), 1)))


class SystemMonitor:
    def __init__(self) -> None:
        self.previous_cpu = cpu_times()
        self.previous_cores = cpu_core_times()
        self.previous_processes: dict[int, int] = {}
        self._lock = threading.Lock()

    def snapshot(self) -> dict:
        # HTTP requests run in threads; keep CPU deltas paired with their own baseline.
        with self._lock:
            return self._snapshot()

    def _snapshot(self) -> dict:
        current_cpu = cpu_times()
        current_cores = cpu_core_times()
        cpu_percent = _percent(current_cpu, self.previous_cpu)
        cores = [
            {"name": name, "percent": _percent(times, self.previous_cores.get(name, (0, 0)))}
            for name, times in sorted(current_cores.items(), key=lambda item: int(item[0][3:]))
        ]
        total_delta = current_cpu[0] - self.previous_cpu[0]
        processes = self.processes(current_cpu, limit=80, total_delta=total_delta)
        self.previous_cpu = current_cpu
        self.previous_cores = current_cores

        release = os_release()
        uptime = read_text("/proc/uptime").split()
        try:
            uptime_seconds = float(uptime[0]) if uptime else 0.0
        except ValueError:
            uptime_seconds = 0.0
        cpu_model = "Processador Linux"
        for line in read_text("/proc/cpuinfo").splitlines():
            if line.lower().startswith("model name"):
                cpu_model = line.split(":", 1)[1].strip()
                break
        memory = meminfo()
        disks = self.disks()
        home_disk = shutil.disk_usage(str(Path.home()))
        return {
            "hostname": platform.node(),
            "os": release.get("PRETTY_NAME", platform.system()),
            "isArch": release.get("ID") == "arch" or "arch" in release.get("ID_LIKE", "").split(),
            "kernel": platform.release(),
            "architecture": platform.machine(),
            "uptimeSeconds": int(uptime_seconds),
            "cpu": {
                "percent": cpu_percent,
                "cores": os.cpu_count() or 1,
                "model": cpu_model,
                "load": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
                "perCore": cores,
            },
            "memory": memory,
            "disk": {
                "total": home_disk.total,
                "used": home_disk.used,
                "free": home_disk.free,
                "percent": round(home_disk.used / home_disk.total * 100, 1) if home_disk.total else 0,
                "mount": str(Path.home()),
            },
            "disks": disks,
            "network": self.network(),
            "temperatures": self.temperatures(),
            "batteries": self.batteries(),
            "processes": processes,
            "timestamp": time.time(),
        }

    @staticmethod
    def network() -> dict:
        interfaces = []
        for line in read_text("/proc/net/dev").splitlines()[2:]:
            if ":" not in line:
                continue
            name, data = line.split(":", 1)
            parts = data.split()
            name = name.strip()
            if name == "lo" or len(parts) < 16:
                continue
            try:
                interfaces.append({"name": name, "rx": int(parts[0]), "tx": int(parts[8])})
            except ValueError:
                continue
        return {
            "interfaces": interfaces,
            "rx": sum(i["rx"] for i in interfaces),
            "tx": sum(i["tx"] for i in interfaces),
        }

    @staticmethod
    def disks() -> list[dict]:
        fstypes = {"ext4", "ext3", "ext2", "btrfs", "xfs", "f2fs", "zfs", "ntfs", "vfat", "exfat"}
        seen: set[str] = set()
        disks: list[dict] = []
        for line in read_text("/proc/self/mounts").splitlines():
            parts = line.split()
            if len(parts) < 3 or parts[2] not in fstypes:
                continue
            mount = parts[1].replace("\\040", " ").replace("\\011", "\t").replace("\\134", "\\")
            if mount in seen or not mount.startswith("/"):
                continue
            seen.add(mount)
            try:
                usage = shutil.disk_usage(mount)
            except OSError:
                continue
            if usage.total <= 0:
                continue
            disks.append({
                "mount": mount,
                "fstype": parts[2],
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": round(usage.used / usage.total * 100, 1),
            })
            if len(disks) >= 8:
                break
        return disks

    @staticmethod
    def temperatures() -> list[dict]:
        sensors = []
        for zone in sorted(Path("/sys/class/thermal").glob("thermal_zone*")):
            raw = read_text(zone / "temp").strip()
            if not raw:
                continue
            try:
                millidegrees = int(raw)
            except ValueError:
                continue
            if not 0 < millidegrees < 150_000:
                continue
            label = read_text(zone / "type").strip() or zone.name
            sensors.append({"label": label, "celsius": round(millidegrees / 1000, 1)})
            if len(sensors) >= 6:
                break
        return sensors

    @staticmethod
    def batteries() -> list[dict]:
        batteries = []
        for supply in sorted(Path("/sys/class/power_supply").iterdir()) if Path("/sys/class/power_supply").exists() else []:
            if read_text(supply / "type").strip().lower() != "battery":
                continue
            capacity = read_text(supply / "capacity").strip()
            status = read_text(supply / "status").strip()
            try:
                percent = int(capacity)
            except ValueError:
                continue
            batteries.append({"name": supply.name, "percent": max(0, min(100, percent)), "status": status})
        return batteries

    def processes(self, current_cpu: tuple[int, int], limit: int = 80,
                  total_delta: int | None = None) -> list[dict]:
        if total_delta is None:
            total_delta = current_cpu[0] - self.previous_cpu[0]
        core_count = os.cpu_count() or 1
        page_size = os.sysconf("SC_PAGE_SIZE") if hasattr(os, "sysconf") else 4096
        processes: list[dict] = []
        current_ticks: dict[int, int] = {}
        try:
            entries = list(Path("/proc").iterdir())
        except OSError:
            entries = []
        for entry in entries:
            if not entry.name.isdigit():
                continue
            stat = read_text(entry / "stat")
            if ")" not in stat:
                continue
            name = stat[stat.find("(") + 1:stat.rfind(")")]
            fields = stat[stat.rfind(")") + 2:].split()
            if len(fields) < 22:
                continue
            try:
                pid = int(entry.name)
                rss = int(fields[21]) * page_size
                ticks = int(fields[11]) + int(fields[12])
            except (ValueError, IndexError):
                continue
            current_ticks[pid] = ticks
            cpu = 0.0
            previous = self.previous_processes.get(pid)
            if previous is not None and total_delta > 0:
                cpu = max(0.0, round(100 * (ticks - previous) / total_delta * core_count, 1))
            user = ""
            for line in read_text(entry / "status").splitlines():
                if line.startswith("Uid:"):
                    try:
                        user = pwd.getpwuid(int(line.split()[1])).pw_name
                    except (KeyError, ValueError, IndexError):
                        user = line.split()[1] if len(line.split()) > 1 else ""
                    break
            processes.append({"pid": pid, "name": name, "memory": rss, "cpu": cpu, "state": fields[0], "user": user})
        self.previous_processes = current_ticks
        processes.sort(key=lambda p: p["memory"], reverse=True)
        return processes[:limit]


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_readonly(args: list[str], timeout: float = 8) -> subprocess.CompletedProcess[str]:
    """Explicit argv only. Never exposed as a generic command endpoint."""
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "LC_ALL": "C.UTF-8"}, check=False)


PACKAGE_NAME = re.compile(r"^[a-zA-Z0-9@][a-zA-Z0-9@._+\-]{0,199}$")


def _validate_package(package: str) -> str:
    package = package.strip()
    if not PACKAGE_NAME.fullmatch(package) or package.startswith("-"):
        raise ValueError("Use apenas o nome do pacote, sem opções ou operadores de shell.")
    return package


def pacman_packages(query: str = "", limit: int = 100) -> dict:
    if not command_exists("pacman"):
        return {"available": False, "packages": [], "total": 0,
                "message": "pacman não está disponível neste sistema. No Arch, esta busca usa o banco local de pacotes."}
    query = query.strip()[:120]
    args = ["pacman", "-Q"] if not query else ["pacman", "-Qs", "--", query]
    try:
        result = run_readonly(args)
    except (OSError, subprocess.TimeoutExpired):
        return {"available": True, "packages": [], "total": 0, "message": "Não foi possível consultar o banco local agora."}
    if result.returncode not in (0, 1):
        return {"available": True, "packages": [], "total": 0, "message": "O banco local de pacotes não pôde ser consultado."}
    packages = []
    if query:
        lines = result.stdout.splitlines()
        for index, line in enumerate(lines):
            if line.startswith((" ", "\t")) or not line:
                continue
            parts = line.split()
            if len(parts) >= 2 and "/" in parts[0]:
                next_line = lines[index + 1] if index + 1 < len(lines) else ""
                description = next_line.strip() if next_line.startswith((" ", "\t")) else ""
                packages.append({"name": parts[0].split("/")[-1], "version": parts[1], "description": description})
    else:
        for line in result.stdout.splitlines():
            if line.startswith((" ", "\t")):
                continue
            parts = line.split()
            if len(parts) >= 2:
                packages.append({"name": parts[0].split("/")[-1], "version": parts[1], "description": "Pacote instalado"})
    if query:
        literal = query.lower()
        packages = [p for p in packages if literal in p["name"].lower() or literal in p["description"].lower()]
    packages.sort(key=lambda p: p["name"])
    return {"available": True, "packages": packages[:limit], "total": len(packages), "message": ""}


def pacman_insights() -> dict:
    if not command_exists("pacman"):
        return {"available": False, "message": "pacman não está disponível neste sistema."}

    failed: list[str] = []

    def lines(args: list[str]) -> list[str] | None:
        try:
            result = run_readonly(["pacman", *args])
        except (OSError, subprocess.TimeoutExpired):
            failed.append(" ".join(args))
            return None
        if result.returncode not in (0, 1):
            failed.append(" ".join(args))
            return None
        return [line for line in result.stdout.splitlines() if line.strip()]

    installed = lines(["-Q"])
    orphan_lines = lines(["-Qdt"])
    foreign = lines(["-Qm"])
    update_lines = lines(["-Qu"])
    orphans = [line.split()[0] for line in (orphan_lines or []) if line.split()]
    updates = []
    for line in update_lines or []:
        parts = line.split()
        if len(parts) >= 4 and parts[2] == "->":
            updates.append({"name": parts[0], "from": parts[1], "to": parts[3]})
    cache_bytes = 0
    cache_files = 0
    for file in Path("/var/cache/pacman/pkg").glob("*.pkg.tar.*"):
        try:
            if file.is_file() and not file.name.endswith(".sig"):
                cache_bytes += file.stat().st_size
                cache_files += 1
        except OSError:
            continue
    last_sync = 0.0
    for db in Path("/var/lib/pacman/sync").glob("*.db"):
        try:
            last_sync = max(last_sync, db.stat().st_mtime)
        except OSError:
            continue
    return {
        "available": True,
        "message": "Algumas consultas não responderam; tente atualizar o diagnóstico." if failed else "",
        "installed": len(installed) if installed is not None else None,
        "orphans": orphans,
        "orphanCount": len(orphans) if orphan_lines is not None else None,
        "foreignCount": len(foreign) if foreign is not None else None,
        "updates": updates[:100],
        "updateCount": len(updates) if update_lines is not None else None,
        "cacheBytes": cache_bytes,
        "cacheFiles": cache_files,
        "lastSync": last_sync,
    }


def pacman_package_info(package: str) -> dict:
    package = _validate_package(package)
    if not command_exists("pacman"):
        return {"available": False, "found": False, "message": "pacman não está disponível neste sistema."}
    try:
        result = run_readonly(["pacman", "-Qi", "--", package])
    except (OSError, subprocess.TimeoutExpired):
        return {"available": True, "found": False, "message": "Não foi possível consultar o pacote agora."}
    if result.returncode != 0:
        return {"available": True, "found": False, "message": "Pacote não encontrado no banco local."}
    fields: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return {"available": True, "found": True, "name": package, "fields": fields, "message": ""}


def package_commands(action: str, package: str = "") -> dict:
    package = package.strip()
    commands = {
        "update": ["sudo", "pacman", "-Syu"],
        "search": ["pacman", "-Ss", "--", package],
        "info": ["pacman", "-Si", "--", package],
        "install": ["sudo", "pacman", "-S", "--needed", "--", package],
        "remove": ["sudo", "pacman", "-Rns", "--", package],
        "orphans": ["pacman", "-Qdt"],
        "updates": ["pacman", "-Qu"],
        "files": ["pacman", "-Ql", "--", package],
        "clean-cache": ["sudo", "pacman", "-Sc"],
    }
    if action not in commands:
        raise ValueError("Ação desconhecida.")
    needs_package = action in {"search", "info", "install", "remove", "files"}
    if needs_package:
        package = _validate_package(package)
    args = list(commands[action])
    if needs_package:
        args[-1] = package
    descriptions = {
        "update": "Sincroniza os repositórios e atualiza o sistema inteiro. Leia a saída antes de confirmar.",
        "search": "Pesquisa nomes e descrições nos repositórios sincronizados.",
        "info": "Consulta informações de um pacote nos repositórios sincronizados.",
        "install": "Instala um pacote dos repositórios. Confirme o nome e a origem antes de executar.",
        "remove": "Remove um pacote, dependências não usadas e arquivos de configuração. Revise a lista antes de confirmar.",
        "orphans": "Lista dependências órfãs. Listar não remove nada.",
        "updates": "Lista pacotes com atualização disponível no banco sincronizado. Não instala nada.",
        "files": "Lista arquivos instalados por um pacote local.",
        "clean-cache": "Remove do cache pacotes que não estão instalados. Revise antes de confirmar; não apaga pacotes instalados.",
    }
    return {"command": shlex.join(args), "argv": args, "description": descriptions[action],
            "privileged": args[0] == "sudo", "executed": False}
