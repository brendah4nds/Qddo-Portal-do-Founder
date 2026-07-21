"""Add localhost to CORS allowed origins on VPS backend"""
import os, paramiko, io, re
from _env import load_env

load_env()
VPS_HOST = os.environ.get('VPS_IP')
VPS_PASS = os.environ.get('VPS_PASSWORD')
if not VPS_HOST or not VPS_PASS:
    raise SystemExit('Defina VPS_IP e VPS_PASSWORD no .env (raiz do projeto) antes de rodar este script.')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_HOST, port=22, username='root', password=VPS_PASS, timeout=15)

def run(cmd, timeout=60):
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

index_raw = read_remote('/docker/portal/backend/src/index.js')

print('--- index.js (primeiros 80 chars por linha, até 60 linhas) ---')
for line in index_raw.splitlines()[:60]:
    print(line[:80])
print('...\n')

# Substituir a configuração de CORS para aceitar localhost também
# Padrão mais comum: origin: 'https://...' ou origin: ['https://...']
# Vamos substituir por uma função que aceita qualquer origem em dev

cors_fn = """const allowedOrigins = [
  'https://vps.qddo.com.br',
  'https://portal.qddo.com.br',
  /^http:\\/\\/localhost(:\\d+)?$/,
  /^http:\\/\\/192\\.168\\.\\d+\\.\\d+(:\\d+)?$/,
];
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(ok ? null : new Error('Not allowed by CORS'), ok);
  },
  credentials: true,
};"""

index_new = index_raw

# 1. Se já tem allowedOrigins, não faz nada
if 'allowedOrigins' in index_new:
    print('[--] allowedOrigins já existe no index.js')
else:
    # 2. Procura o require('cors') e injeta logo abaixo
    cors_require_pattern = r"(const cors\s*=\s*require\(['\"]cors['\"]\);?\n)"
    match = re.search(cors_require_pattern, index_new)
    if match:
        insert_pos = match.end()
        index_new = index_new[:insert_pos] + '\n' + cors_fn + '\n' + index_new[insert_pos:]
        print('[OK] Bloco allowedOrigins injetado após require(cors)')
    else:
        print('[WARN] Não encontrei require(cors) — adicionando ao início')
        index_new = cors_fn + '\n\n' + index_new

    # 3. Substituir app.use(cors(...)) pelo corsOptions
    # Pode ser: app.use(cors()); app.use(cors({...})); app.use(cors({ origin: ... }))
    cors_use_pattern = r"app\.use\(cors\((\{[^}]*\}|)\)\);"
    new_cors_use = "app.use(cors(corsOptions));"
    replaced, n = re.subn(cors_use_pattern, new_cors_use, index_new)
    if n > 0:
        index_new = replaced
        print(f'[OK] app.use(cors(...)) substituído por corsOptions ({n} ocorrência(s))')
    else:
        print('[WARN] Não encontrei app.use(cors(...)) para substituir')
        print('       Verifique manualmente o index.js')

if index_new != index_raw:
    sftp.putfo(io.BytesIO(index_new.encode()), '/docker/portal/backend/src/index.js')
    print('[OK] index.js salvo')

    print('\n[...] Reiniciando portal-backend...')
    run('cd /docker/portal && docker compose restart portal-backend 2>&1', timeout=60)
    import time; time.sleep(5)
    run('docker logs portal-portal-backend-1 2>&1 | tail -10')
    print('\n[...] Testando CORS...')
    run("curl -s -I -H 'Origin: http://localhost:3002' -X OPTIONS http://localhost:3001/api/auth/google | head -20")
else:
    print('[--] Nenhuma alteração feita')

sftp.close()
client.close()
print('\n[DONE]')
