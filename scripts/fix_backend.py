"""Upload corrected backend files to VPS"""
import paramiko, io

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('72.60.246.211', port=22, username='root', password='+Yi+uoURZuq3YNtU', timeout=15)

def run(cmd, timeout=300):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    o = out.read().decode('utf-8', errors='replace').strip()
    e = err.read().decode('utf-8', errors='replace').strip()
    if o: print(o)
    if e: print('STDERR:', e[:400])
    return out.channel.recv_exit_status()

sftp = client.open_sftp()

# settings.js - note: $set is a literal string here, not shell interpolation
settings_js = """'use strict';
const router   = require('express').Router();
const Settings = require('../models/Settings');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/:key', async (req, res) => {
  try {
    const s = await Settings.findOne({ key: req.params.key });
    res.json(s ? s.data : null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:key', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const s = await Settings.findOneAndUpdate(
      { key: req.params.key },
      { $set: { data: req.body } },
      { new: true, upsert: true }
    );
    req.app.get('io').emit('settings:update', { key: req.params.key, data: s.data });
    res.json(s.data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
"""
sftp.putfo(io.BytesIO(settings_js.encode()), '/docker/portal/backend/src/routes/settings.js')
print('settings.js uploaded')

sftp.close()

print('Rebuilding...')
rc = run('cd /docker/portal && docker compose build portal-backend 2>&1 | tail -5', timeout=300)
if rc == 0:
    run('cd /docker/portal && docker compose up -d portal-backend 2>&1', timeout=60)
    import time; time.sleep(6)
    run('docker logs portal-portal-backend-1 2>&1 | tail -5')
    run('curl -s http://localhost:3001/health')
    run('curl -s http://localhost:3001/api/settings/global | head -c 100')

client.close()
print('Done')
