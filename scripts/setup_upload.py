"""Setup file upload API on VPS backend"""
import paramiko, io, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('72.60.246.211', port=22, username='root', password='+Yi+uoURZuq3YNtU', timeout=15)

def run(cmd, timeout=300):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    o = out.read().decode('utf-8', errors='replace').strip()
    e = err.read().decode('utf-8', errors='replace').strip()
    if o: print(o)
    if e: print('STDERR:', e[:600])
    return out.channel.recv_exit_status()

def read_remote(path):
    sftp = client.open_sftp()
    try:
        with sftp.open(path, 'r') as f:
            return f.read().decode('utf-8')
    finally:
        sftp.close()

sftp = client.open_sftp()

# ─── 1. src/routes/upload.js ─────────────────────────────────────────────────
upload_js = r"""'use strict';
const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { authMiddleware } = require('../middleware/auth');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf'
]);

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error('Tipo de arquivo nao permitido'), { status: 415 }), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// POST /api/upload  { file: <binary> }
// Returns { url: "https://vps.qddo.com.br/uploads/<filename>" }
router.post('/', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const base = (process.env.BASE_URL || 'https://vps.qddo.com.br').replace(/\/$/, '');
  res.json({ url: base + '/uploads/' + req.file.filename });
});

// Error handler para erros do multer
router.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
  res.status(status).json({ error: err.message });
});

module.exports = router;
"""

sftp.putfo(io.BytesIO(upload_js.encode()), '/docker/portal/backend/src/routes/upload.js')
print('[OK] src/routes/upload.js criado')

# ─── 2. package.json — adicionar multer ──────────────────────────────────────
pkg_raw = read_remote('/docker/portal/backend/package.json')
pkg = json.loads(pkg_raw)
if 'multer' not in pkg.get('dependencies', {}):
    pkg.setdefault('dependencies', {})['multer'] = '^1.4.5-lts.1'
    sftp.putfo(io.BytesIO(json.dumps(pkg, indent=2).encode()), '/docker/portal/backend/package.json')
    print('[OK] package.json atualizado com multer')
else:
    print('[--] multer ja estava no package.json')

# ─── 3. src/index.js — registrar rota e servir /uploads ──────────────────────
index_raw = read_remote('/docker/portal/backend/src/index.js')
print('\n--- index.js atual (primeiros 60 chars de cada linha) ---')
for line in index_raw.splitlines()[:40]:
    print(line[:80])
print('...\n')

index_new = index_raw

# a) Servir arquivos estáticos de /uploads
if "'/uploads'" not in index_new and '"/uploads"' not in index_new:
    static_snippet = "app.use('/uploads', require('express').static(require('path').join(__dirname, '../uploads')));\n"
    # Injeta logo antes do primeiro app.use('/api/
    idx = index_new.find("app.use('/api/")
    if idx == -1:
        idx = index_new.find('app.use("/api/')
    if idx != -1:
        index_new = index_new[:idx] + static_snippet + index_new[idx:]
        print('[OK] Trecho de /uploads estatico adicionado ao index.js')
    else:
        print('[WARN] Nao encontrei onde injetar /uploads estatico — adicionando ao fim')
        index_new += '\n' + static_snippet

# b) Registrar a rota /api/upload
if "'/api/upload'" not in index_new and '"/api/upload"' not in index_new:
    upload_route_line = "app.use('/api/upload', require('./routes/upload'));\n"
    # Injeta antes da primeira rota /api/ para garantir ordem
    idx = index_new.find("app.use('/api/")
    if idx == -1:
        idx = index_new.find('app.use("/api/')
    if idx != -1:
        index_new = index_new[:idx] + upload_route_line + index_new[idx:]
        print('[OK] Rota /api/upload registrada no index.js')
    else:
        index_new += '\n' + upload_route_line
        print('[WARN] Rota /api/upload adicionada ao fim do index.js')
else:
    print('[--] /api/upload ja estava no index.js')

if index_new != index_raw:
    sftp.putfo(io.BytesIO(index_new.encode()), '/docker/portal/backend/src/index.js')
    print('[OK] index.js salvo')

# ─── 4. docker-compose.yml — volume para /uploads ────────────────────────────
compose_raw = read_remote('/docker/portal/docker-compose.yml')
print('\n--- docker-compose.yml ---')
print(compose_raw)

if '/docker/portal/uploads:/app/uploads' not in compose_raw:
    # Injeta volume logo após a linha "volumes:" do serviço portal-backend
    # Estrategia: adiciona após a ultima linha de volume do servico, ou apos "volumes:"
    lines = compose_raw.splitlines(keepends=True)
    new_lines = []
    i = 0
    while i < len(lines):
        new_lines.append(lines[i])
        # Detecta bloco volumes: dentro do servico (identado com 6+ spaces)
        stripped = lines[i].rstrip()
        if stripped.endswith('volumes:') and stripped.startswith('      '):
            # Adiciona nossa entrada de volume logo após
            indent = len(stripped) - len(stripped.lstrip())
            new_lines.append(' ' * (indent + 2) + '- /docker/portal/uploads:/app/uploads\n')
            print('[OK] Volume /uploads adicionado ao docker-compose.yml')
        i += 1
    compose_new = ''.join(new_lines)
    if compose_new != compose_raw:
        sftp.putfo(io.BytesIO(compose_new.encode()), '/docker/portal/docker-compose.yml')
        print('[OK] docker-compose.yml salvo')
    else:
        print('[WARN] Nao consegui injetar volume no docker-compose.yml — verifique manualmente')
else:
    print('[--] Volume ja estava no docker-compose.yml')

sftp.close()

# ─── 5. Criar diretorio de uploads no host ───────────────────────────────────
run('mkdir -p /docker/portal/uploads && chmod 755 /docker/portal/uploads')
print('[OK] Diretorio /docker/portal/uploads criado no host')

# ─── 6. Rebuild e restart ─────────────────────────────────────────────────────
print('\n[...] Reconstruindo imagem Docker...')
rc = run('cd /docker/portal && docker compose build portal-backend 2>&1 | tail -20', timeout=360)
if rc == 0:
    print('[OK] Build concluido')
    run('cd /docker/portal && docker compose up -d portal-backend 2>&1', timeout=60)
    import time; time.sleep(6)
    run('docker logs portal-portal-backend-1 2>&1 | tail -8')
    print('\n[...] Testando health...')
    run('curl -s http://localhost:3001/health')
else:
    print('[ERRO] Build falhou')

client.close()
print('\n[DONE]')
