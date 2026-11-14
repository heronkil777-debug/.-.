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
from store import Store


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.store = Store(Path(cls.temp.name) / 'data')
        cls.patch = patch.object(server, 'BOOTSTRAP_KEY', 'test-bootstrap-key')
        cls.patch.start()
        cls.server = server.NexoServer(('127.0.0.1', 0), cls.store)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.store.close(); cls.temp.cleanup(); cls.patch.stop()

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        conn.request(method, path, body=json.dumps(data) if data is not None else None, headers=headers or {})
        response = conn.getresponse(); body = response.read()
        result = (response.status, dict(response.getheaders()), json.loads(body) if body.startswith(b'{') else body)
        conn.close(); return result

    def session(self):
        status, headers, data = self.request('GET', '/api/session', headers={'X-NEXO-Key': 'test-bootstrap-key'})
        self.assertEqual(status, 200)
        return {'Cookie': headers['Set-Cookie'].split(';')[0], 'Origin': f'http://127.0.0.1:{self.port}', 'X-NEXO-Request': '1', 'Content-Type': 'application/json'}

    def test_session_key_required(self):
        self.assertEqual(self.request('GET', '/api/session')[0], 401)
        self.assertEqual(self.request('GET', '/api/notes')[0], 401)
        self.assertEqual(self.request('GET', '/api/session?nexo_key=test-bootstrap-key')[0], 200)

    def test_host_and_origin_rejected(self):
        self.assertEqual(self.request('GET', '/api/session', headers={'Host': 'evil.example', 'X-NEXO-Key': 'test-bootstrap-key'})[0], 403)
        headers = self.session(); headers['Origin'] = 'https://evil.example'
        self.assertEqual(self.request('POST', '/api/notes', {'title': 'x'}, headers)[0], 403)
        del headers['Origin']
        self.assertEqual(self.request('POST', '/api/notes', {'title': 'x'}, headers)[0], 403)

    def test_crud_and_command_no_execution(self):
        headers = self.session()
        status, _, data = self.request('POST', '/api/notes', {'title': 'Nota API', 'body': 'corpo'}, headers)
        self.assertEqual(status, 201)
        note_id = data['note']['id']
        self.assertEqual(self.request('PATCH', f'/api/notes/{note_id}', {'pinned': True}, headers)[2]['note']['pinned'], True)
        self.assertEqual(self.request('DELETE', f'/api/notes/{note_id}', headers=headers)[0], 200)
        with patch('system.subprocess.run') as run:
            result = self.request('POST', '/api/commands', {'action': 'install', 'package': 'firefox'}, headers)
            self.assertEqual(result[2]['command'], 'sudo pacman -S --needed -- firefox')
            self.assertFalse(result[2]['executed']); run.assert_not_called()
        self.assertEqual(self.request('POST', '/api/commands', {'action': 'install', 'package': 'x; id'}, headers)[0], 400)
        self.assertEqual(self.request('POST', '/api/run', {'command': 'id'}, headers)[0], 404)

    def test_clipboard_off_by_default_and_no_desktop(self):
        headers = self.session()
        data = self.request('GET', '/api/clips', headers=headers)[2]
        self.assertFalse(data['status']['enabled'])
        self.assertEqual(self.request('PATCH', '/api/settings', {'clipboardEnabled': True}, headers)[0], 409)
        self.assertFalse(self.request('POST', '/api/clipboard/copy', {'text': 'x'}, headers)[2]['copied'])

    def test_body_limit_and_static_unavailable(self):
        headers = self.session(); headers['Content-Length'] = str(70000)
        self.assertEqual(self.request('POST', '/api/notes', {'title': 'x'}, headers)[0], 413)
        with patch.object(server, 'STATIC', Path(self.temp.name) / 'not-built'):
            self.assertEqual(self.request('GET', '/')[0], 503)


if __name__ == '__main__': unittest.main()
