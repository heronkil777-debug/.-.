import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from system import SystemMonitor, cpu_times, meminfo, package_commands, pacman_packages


class SystemTests(unittest.TestCase):
    def test_snapshot_real_linux_shape(self):
        data = SystemMonitor().snapshot()
        self.assertGreater(data['memory']['total'], 0)
        self.assertGreater(data['disk']['total'], 0)
        self.assertGreaterEqual(data['cpu']['percent'], 0)
        self.assertLessEqual(data['cpu']['percent'], 100)
        self.assertGreaterEqual(data['uptimeSeconds'], 0)
        self.assertIn('timestamp', data)
        self.assertIsInstance(data['processes'], list)

    def test_meminfo_parser(self):
        text = 'MemTotal: 1000 kB\nMemAvailable: 250 kB\nSwapTotal: 500 kB\nSwapFree: 100 kB\n'
        with patch('system.read_text', return_value=text):
            data = meminfo()
        self.assertEqual(data['total'], 1024000)
        self.assertEqual(data['used'], 768000)
        self.assertEqual(data['percent'], 75)
        self.assertEqual(data['swapUsed'], 409600)

    def test_cpu_parser_handles_missing_proc(self):
        with patch('system.read_text', return_value=''):
            self.assertEqual(cpu_times(), (0, 0))

    def test_process_name_with_parentheses(self):
        stat = '123 (worker (nested)) S ' + ' '.join(['0'] * 22)
        fields = stat[stat.rfind(')') + 2:].split(); fields[21] = '10'
        stat = '123 (worker (nested)) ' + ' '.join(fields)
        class Entry:
            name = '123'
            def __truediv__(self, other): return self
        with patch('system.Path.iterdir', return_value=[Entry()]), patch('system.read_text', return_value=stat):
            result = SystemMonitor.processes()
        self.assertEqual(result[0]['name'], 'worker (nested)')
        self.assertEqual(result[0]['memory'], 40960)

    def test_commands_never_execute_and_guard_names(self):
        for action, name, expected in [('update', '', 'sudo pacman -Syu'), ('install', 'firefox', 'sudo pacman -S --needed -- firefox'), ('remove', 'git', 'sudo pacman -Rns -- git'), ('orphans', '', 'pacman -Qdt')]:
            result = package_commands(action, name)
            self.assertEqual(result['command'], expected)
            self.assertFalse(result['executed'])
        for name in ['firefox; rm -rf /', '$(id)', '-Syu', '../x', 'a b', 'a|b', '']:
            with self.assertRaises(ValueError): package_commands('install', name)
        with self.assertRaises(ValueError): package_commands('execute', 'git')

    def test_pacman_absent_is_honest(self):
        with patch('system.command_exists', return_value=False):
            data = pacman_packages()
        self.assertFalse(data['available']); self.assertEqual(data['packages'], [])

    def test_pacman_installed_and_search_mocked(self):
        output = 'local/firefox 140.0-1\n    Fast browser\nlocal/git 2.50-1\n    Version control\n'
        with patch('system.command_exists', return_value=True), patch('system.run_readonly') as run:
            run.return_value = subprocess.CompletedProcess([], 0, output, '')
            data = pacman_packages()
            self.assertEqual(data['total'], 2)
            self.assertEqual(run.call_args.args[0], ['pacman', '-Q'])
            run.return_value = subprocess.CompletedProcess([], 0, 'local/firefox 140.0-1\n    Fast browser\n', '')
            data = pacman_packages('fire')
            self.assertEqual(data['packages'][0]['name'], 'firefox')
            self.assertEqual(run.call_args.args[0], ['pacman', '-Qs', '--', 'fire'])


if __name__ == '__main__': unittest.main()
