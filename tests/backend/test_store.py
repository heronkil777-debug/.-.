import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from store import ClipboardBridge, Store, looks_sensitive


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / 'data')

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_note_roundtrip_and_persistence(self):
        note = self.store.create_note({'title': 'Arch', 'body': 'pacman -Syu', 'color': 'blue'})
        self.assertEqual(self.store.notes()[0]['body'], 'pacman -Syu')
        updated = self.store.update_note(note['id'], {'pinned': True, 'body': 'novo'})
        self.assertTrue(updated['pinned'])
        self.store.close()
        self.store = Store(Path(self.temp.name) / 'data')
        self.assertEqual(self.store.notes()[0]['body'], 'novo')
        self.store.delete_note(note['id'])
        self.assertEqual(self.store.notes(), [])

    def test_validation_and_search(self):
        with self.assertRaises(ValueError): self.store.create_note({'title': ' ', 'body': ''})
        with self.assertRaises(ValueError): self.store.create_note({'title': 'x', 'color': 'invalid'})
        self.store.create_note({'title': 'Olá MUNDO', 'body': 'texto local'})
        self.assertEqual(len(self.store.notes('mundo')), 1)
        self.assertEqual(len(self.store.notes('inexistente')), 0)
        with self.assertRaises(KeyError): self.store.delete_note('missing')

    def test_clip_dedup_pin_retention_and_clear(self):
        first = self.store.add_clip('um')
        self.store.add_clip('dois')
        self.assertEqual(len(self.store.clips()), 2)
        self.store.pin_clip(first['id'], True)
        self.store.clear_clips()
        self.assertEqual([c['text'] for c in self.store.clips()], ['um'])
        for i in range(205): self.store.add_clip(f'texto {i}')
        self.assertEqual(len(self.store.clips()), 200)
        self.assertIn('um', [c['text'] for c in self.store.clips()])
        self.assertNotIn('hash', self.store.clips()[0])

    def test_clip_limits_and_sensitive_capture(self):
        with self.assertRaises(ValueError): self.store.add_clip('')
        with self.assertRaises(ValueError): self.store.add_clip('x' * 20001)
        self.assertIsNone(self.store.add_clip('senha=abc123', 'clipboard'))
        self.assertIsNotNone(self.store.add_clip('senha=abc123', 'manual'))
        self.assertTrue(looks_sensitive('-----BEGIN PRIVATE KEY-----\nabc'))
        self.assertTrue(looks_sensitive('ghp_' + 'a' * 30))
        self.assertFalse(looks_sensitive('pacman -Syu'))

    def test_settings_and_export(self):
        self.assertFalse(self.store.setting('clipboardEnabled', False))
        self.store.set_setting('clipboardEnabled', True)
        data = self.store.export()
        self.assertEqual(data['app'], 'NEXO')
        self.assertTrue(data['settings']['clipboardEnabled'])

    def test_private_file_permissions(self):
        mode = stat.S_IMODE((self.store.directory / 'nexo.db').stat().st_mode)
        self.assertEqual(mode, 0o600)
        self.assertEqual(stat.S_IMODE(self.store.directory.stat().st_mode), 0o700)

    def test_clipboard_unavailable_and_mocked_wayland(self):
        bridge = ClipboardBridge(self.store)
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(bridge.backend())
            self.assertFalse(bridge.status()['available'])
            self.assertFalse(bridge.write('x'))
        with patch.dict(os.environ, {'WAYLAND_DISPLAY': 'wayland-1'}, clear=True), patch('store.shutil.which', return_value='/usr/bin/tool'):
            self.assertEqual(bridge.backend(), 'wayland')
            with patch('store.subprocess.run') as run:
                run.return_value.returncode = 0
                run.return_value.stdout = 'texto'
                self.assertEqual(bridge.read(), 'texto')
                self.assertTrue(bridge.write('texto'))
                self.assertEqual(run.call_args.args[0][0], 'wl-copy')
                self.assertNotIn('shell', run.call_args.kwargs)


if __name__ == '__main__': unittest.main()
