"""Read-only Linux system information. No shell, no root, no third-party dependencies."""
from __future__ import annotations

import os
import platform
import re
import shutil
import subprocess
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


def meminfo() -> dict[str, int]:
    values: dict[str, int] = {}
    for line in read_text("/proc/meminfo").splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[1].isdigit():
            values[parts[0].rstrip(":")] = int(parts[1]) * 1024
    total = values.get("MemTotal", 0)
    available = values.get("MemAvailable", values.get("MemFree", 0))
    swap_total = values.get("SwapTotal", 0)
    return {
        "total": total,
        "available": available,
        "used": max(0, total - available),
        "percent": round((total - available) / total * 100, 1) if total else 0,
        "swapTotal": swap_total,
        "swapUsed": max(0, swap_total - values.get("SwapFree", 0)),
    }


def cpu_times() -> tuple[int, int]:
    line = read_text("/proc/stat").splitlines()[0] if read_text("/proc/stat") else ""
    parts = line.split()
    if len(parts) < 5 or parts[0] != "cpu":
        return 0, 0
    values = list(map(int, parts[1:]))
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return sum(values), idle


class SystemMonitor:
    def __init__(self) -> None:
        self.previous = cpu_times()

    def snapshot(self) -> dict:
        current = cpu_times()
        total_delta = current[0] - self.previous[0]
        idle_delta = current[1] - self.previous[1]
        self.previous = current
        cpu = round(100 * (1 - idle_delta / total_delta), 1) if total_delta > 0 else 0
        release = os_release()
        disk = shutil.disk_usage(str(Path.home()))
        net = self.network()
        uptime_seconds = 0
        uptime = read_text("/proc/uptime").split()
        if uptime:
            try:
                uptime_seconds = float(uptime[0])
            except ValueError:
                pass
        cpu_model = "Processador Linux"
        for line in read_text("/proc/cpuinfo").splitlines():
            if line.lower().startswith("model name"):
                cpu_model = line.split(":", 1)[1].strip()
                break
        return {
            "hostname": platform.node(),
            "os": release.get("PRETTY_NAME", platform.system()),
            "isArch": release.get("ID") == "arch" or "arch" in release.get("ID_LIKE", "").split(),
            "kernel": platform.release(),
            "architecture": platform.machine(),
            "uptimeSeconds": int(uptime_seconds),
            "cpu": {"percent": max(0, min(100, cpu)), "cores": os.cpu_count() or 1, "model": cpu_model,
                     "load": list(os.getloadavg()) if hasattr(os, "getloadavg") else []},
            "memory": meminfo(),
            "disk": {"total": disk.total, "used": disk.used, "free": disk.free,
                     "percent": round(disk.used / disk.total * 100, 1) if disk.total else 0, "mount": str(Path.home())},
            "network": net,
            "processes": self.processes(),
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
            interfaces.append({"name": name, "rx": int(parts[0]), "tx": int(parts[8])})
        return {"interfaces": interfaces,
                "rx": sum(i["rx"] for i in interfaces), "tx": sum(i["tx"] for i in interfaces)}

    @staticmethod
    def processes(limit: int = 8) -> list[dict]:
        processes = []
        page_size = os.sysconf("SC_PAGE_SIZE") if hasattr(os, "sysconf") else 4096
        for entry in Path("/proc").iterdir():
            if not entry.name.isdigit():
                continue
            stat = read_text(entry / "stat")
            # comm may contain spaces/parentheses; fields start after the final ')'.
            if ")" not in stat:
                continue
            name = stat[stat.find("(") + 1:stat.rfind(")")]
            fields = stat[stat.rfind(")") + 2:].split()
            if len(fields) < 22:
                continue
            try:
                rss = int(fields[21]) * page_size
                processes.append({"pid": int(entry.name), "name": name, "memory": rss,
                                  "state": fields[0]})
            except (ValueError, IndexError):
                continue
        return sorted(processes, key=lambda p: p["memory"], reverse=True)[:limit]


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def run_readonly(args: list[str], timeout: float = 8) -> subprocess.CompletedProcess[str]:
    """Explicit argv only. This function is never exposed as a generic command endpoint."""
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                          env={**os.environ, "LC_ALL": "C.UTF-8"}, check=False)


def pacman_packages(query: str = "", limit: int = 100) -> dict:
    if not command_exists("pacman"):
        return {"available": False, "packages": [], "total": 0,
                "message": "pacman não está disponível neste sistema. No Arch, esta busca usa o banco local de pacotes."}
    query = query.strip()[:120]
    args = ["pacman", "-Q"]
    if query:
        # pacman -Qs accepts a regex, never shell syntax. Post-filter the results
        # literally so the UI's substring search has predictable semantics.
        args = ["pacman", "-Qs", "--", query]
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
            if line.startswith(("local/", "core/", "extra/", "multilib/")) or (line and not line.startswith((" ", "\t")) and "/" in line.split()[0]):
                parts = line.split()
                if len(parts) >= 2:
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


PACKAGE_NAME = re.compile(r"^[a-zA-Z0-9@][a-zA-Z0-9@._+\-]{0,199}$")


def package_commands(action: str, package: str = "") -> dict:
    package = package.strip()
    commands = {
        "update": ["sudo", "pacman", "-Syu"],
        "search": ["pacman", "-Ss", "--", package],
        "info": ["pacman", "-Si", "--", package],
        "install": ["sudo", "pacman", "-S", "--needed", "--", package],
        "remove": ["sudo", "pacman", "-Rns", "--", package],
        "orphans": ["pacman", "-Qdt"],
    }
    if action not in commands:
        raise ValueError("Ação desconhecida.")
    if action not in ("update", "orphans") and not PACKAGE_NAME.fullmatch(package):
        raise ValueError("Use apenas o nome do pacote, sem opções ou operadores de shell.")
    args = commands[action]
    if action not in ("update", "orphans") and package.startswith("-"):
        raise ValueError("O nome do pacote não pode começar com hífen.")
    descriptions = {
        "update": "Sincroniza os repositórios e atualiza o sistema. Leia a saída antes de confirmar.",
        "search": "Pesquisa nomes e descrições nos repositórios sincronizados.",
        "info": "Consulta informações de um pacote nos repositórios sincronizados.",
        "install": "Instala um pacote dos repositórios. Confirme o nome e a origem antes de executar.",
        "remove": "Remove um pacote, dependências não usadas e arquivos de configuração. Revise a lista antes de confirmar.",
        "orphans": "Lista dependências órfãs. Listar não remove nada.",
    }
    import shlex
    return {"command": shlex.join(args), "argv": args, "description": descriptions[action],
            "privileged": args[0] == "sudo", "executed": False}
