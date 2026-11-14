import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
import server


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patch = patch.object(server, 'BOOTSTRAP_KEY', 'test-bootstrap-key')
        cls.patch.start()
        cls.server = server.NexoServer(('127.0.0.1', 0))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.patch.stop()

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        conn.request(method, path, body=json.dumps(data) if data is not None else None, headers=headers or {})
        response = conn.getresponse()
        body = response.read()
        result = (response.status, dict(response.getheaders()), json.loads(body) if body.startswith(b'{') else body)
        conn.close()
        return result

    def session(self):
        status, headers, data = self.request('GET', '/api/session', headers={'X-NEXO-Key': 'test-bootstrap-key'})
        self.assertEqual(status, 200)
        self.assertEqual(data['focus'], 'system-pacman')
        return {'Cookie': headers['Set-Cookie'].split(';')[0], 'Origin': f'http://127.0.0.1:{self.port}', 'X-NEXO-Request': '1', 'Content-Type': 'application/json'}

    def test_session_key_required(self):
        self.assertEqual(self.request('GET', '/api/session')[0], 401)
        self.assertEqual(self.request('GET', '/api/system')[0], 401)
        self.assertEqual(self.request('GET', '/api/session?nexo_key=test-bootstrap-key')[0], 200)

    def test_host_and_origin_rejected(self):
        self.assertEqual(self.request('GET', '/api/session', headers={'Host': 'evil.example', 'X-NEXO-Key': 'test-bootstrap-key'})[0], 403)
        headers = self.session()
        headers['Origin'] = 'https://evil.example'
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'update'}, headers)[0], 403)
        del headers['Origin']
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'update'}, headers)[0], 403)
        headers['Origin'] = f'http://127.0.0.1:{self.port}'
        del headers['X-NEXO-Request']
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'update'}, headers)[0], 403)

    def test_command_no_execution_and_validation(self):
        headers = self.session()
        with patch('system.subprocess.run') as run:
            result = self.request('POST', '/api/commands', {'action': 'install', 'package': 'firefox'}, headers)
            self.assertEqual(result[0], 200)
            self.assertEqual(result[2]['command'], 'sudo pacman -S --needed -- firefox')
            self.assertFalse(result[2]['executed'])
            run.assert_not_called()
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'install', 'package': 'x; id'}, headers)[0], 400)
        self.assertEqual(self.request('POST', '/api/run', {'command': 'id'}, headers)[0], 404)

    def test_removed_personal_data_endpoints_are_gone(self):
        headers = self.session()
        for path in ('/api/notes', '/api/clips', '/api/settings', '/api/clipboard/copy'):
            self.assertEqual(self.request('GET', path, headers=headers)[0], 404)
            self.assertEqual(self.request('POST', path, {'x': 1}, headers)[0], 404)
        self.assertEqual(self.request('PATCH', '/api/settings', {'x': 1}, headers)[0], 405)
        self.assertEqual(self.request('DELETE', '/api/clips', headers=headers)[0], 405)

    def test_readonly_endpoints_and_export_shape(self):
        headers = self.session()
        with patch('server.pacman_insights', return_value={'available': False, 'message': 'sem pacman'}), \
             patch('server.pacman_packages', return_value={'available': False, 'packages': [], 'total': 0, 'message': ''}), \
             patch('server.pacman_package_info', return_value={'available': False, 'found': False, 'message': ''}):
            self.assertFalse(self.request('GET', '/api/pacman/insights', headers=headers)[2]['available'])
            self.assertFalse(self.request('GET', '/api/packages?q=git', headers=headers)[2]['available'])
            self.assertFalse(self.request('GET', '/api/pacman/package?name=git', headers=headers)[2]['found'])
            data = self.request('GET', '/api/export', headers=headers)[2]
        self.assertEqual(data['app'], 'NEXO')
        self.assertIn('system', data)
        self.assertIn('pacman', data)
        self.assertNotIn('notes', data)
        self.assertNotIn('clips', data)
        self.assertNotIn('key', json.dumps(data))

    def test_body_limit_content_type_and_static_unavailable(self):
        headers = self.session()
        headers['Content-Length'] = str(70000)
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'update'}, headers)[0], 413)
        headers['Content-Length'] = '2'
        headers['Content-Type'] = 'text/plain'
        self.assertEqual(self.request('POST', '/api/commands', {}, headers)[0], 415)
        with patch.object(server, 'STATIC', Path(tempfile.gettempdir()) / 'nexo-not-built'):
            self.assertEqual(self.request('GET', '/')[0], 503)


if __name__ == '__main__':
    unittest.main()
