"""
Migração Firestore → MongoDB

Uso:
  python scripts/migrate.py --key caminho/para/serviceAccount.json

Como gerar a chave:
  1. console.firebase.google.com → projeto → Configuracoes → Contas de Servico
  2. "Gerar nova chave privada" → baixa arquivo .json
  3. Passe o caminho do arquivo com --key
"""
import json, os, sys, paramiko, io
from datetime import datetime, timezone
from pathlib import Path
from _env import load_env

# ─── CONFIG VPS ──────────────────────────────────────────────────────────────
load_env()
VPS_HOST = os.environ.get('VPS_IP')
VPS_USER = "root"
VPS_PASS = os.environ.get('VPS_PASSWORD')
if not VPS_HOST or not VPS_PASS:
    raise SystemExit('Defina VPS_IP e VPS_PASSWORD no .env (raiz do projeto) antes de rodar este script.')

COLLECTIONS = [
    "founders", "challenges", "comments", "messages",
    "rooms", "bookings", "checkins", "news", "indicacoes", "settings",
]

# ─── SCRIPT DE EXPORTAÇÃO (roda via Node.js com firebase-admin) ──────────────
EXPORT_SCRIPT = r"""
const admin = require('firebase-admin');
const fs    = require('fs');

const keyPath = process.argv[2];
const outPath = process.argv[3] || '/tmp/migration-data.json';
const dbId    = process.argv[4] || '(default)';

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
});

const db = admin.firestore();
db.settings({ databaseId: dbId });

const COLLECTIONS = [
  'founders','challenges','comments','messages',
  'rooms','bookings','checkins','news','indicacoes','settings',
];

async function exportCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map(doc => ({ _firebaseId: doc.id, ...doc.data() }));
}

// Converte Timestamps do Firestore para ISO strings
function serialize(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj.constructor?.name === 'Timestamp' || (obj._seconds !== undefined)) {
    return new Date(obj._seconds * 1000 + Math.floor((obj._nanoseconds || 0) / 1e6)).toISOString();
  }
  if (Array.isArray(obj)) return obj.map(serialize);
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]));
}

async function main() {
  const data = {};
  let total = 0;
  for (const col of COLLECTIONS) {
    const docs = await exportCollection(col);
    data[col] = docs.map(serialize);
    total += docs.length;
    console.log(`  ${col.padEnd(15)} ${docs.length} docs`);
  }
  fs.writeFileSync(outPath, JSON.stringify(data), 'utf8');
  console.log(`\nTotal: ${total} documentos exportados → ${outPath}`);
  process.exit(0);
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
"""

# ─── SCRIPT DE IMPORTAÇÃO (roda dentro do container backend) ─────────────────
IMPORT_SCRIPT = r"""
'use strict';
const mongoose = require('mongoose');
const fs       = require('fs');

const MONGO_URI = process.env.MONGODB_URI;
const data      = JSON.parse(fs.readFileSync('/tmp/migration-data.json', 'utf8'));

const DATE_FIELDS = [
  'registeredAt','createdAt','completedAt','criadoEm','updatedAt',
  'checkinTime','checkoutTime',
];

const COLLECTION_MAP = {
  founders:   'users',
  challenges: 'challenges',
  comments:   'comments',
  messages:   'messages',
  rooms:      'rooms',
  bookings:   'bookings',
  checkins:   'checkins',
  news:       'news',
  indicacoes: 'indicacaos',
  settings:   'settings',
};

function toDate(v) {
  if (!v || typeof v !== 'string') return v;
  const d = new Date(v);
  return isNaN(d) ? v : d;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection;

  for (const [col, docs] of Object.entries(data)) {
    const mongoCol = COLLECTION_MAP[col] || col;
    const collection = db.collection(mongoCol);

    if (!docs || docs.length === 0) {
      console.log(`  ${col.padEnd(15)} 0 docs (pulando)`);
      continue;
    }

    await collection.deleteMany({});

    const transformed = docs.map(doc => {
      const out = { ...doc, _migratedFrom: 'firestore', _migratedAt: new Date() };
      for (const f of DATE_FIELDS) {
        if (out[f]) out[f] = toDate(out[f]);
      }
      return out;
    });

    await collection.insertMany(transformed, { ordered: false });
    console.log(`  ${col.padEnd(15)} ${transformed.length} docs OK → ${mongoCol}`);
  }

  await mongoose.disconnect();
  console.log('\nImportacao concluida!');
}

run().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
"""

# ─── SSH HELPER ──────────────────────────────────────────────────────────────
def ssh_run(client, cmd, timeout=60):
    _, out, err = client.exec_command(cmd, timeout=timeout)
    output = out.read().decode('utf-8', errors='replace')
    errors = err.read().decode('utf-8', errors='replace')
    if output.strip(): print(output.strip())
    if errors.strip():  print("STDERR:", errors.strip()[:500])
    return out.channel.recv_exit_status()

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    key_path = None

    if len(args) == 2 and args[0] == "--key":
        key_path = Path(args[1])
    else:
        print("Uso: python scripts/migrate.py --key caminho/serviceAccount.json")
        sys.exit(1)

    if not key_path.exists():
        print(f"ERRO: arquivo nao encontrado: {key_path}"); sys.exit(1)

    key_data = json.loads(key_path.read_text())
    project_id = key_data.get("project_id", "")
    print(f"\nProjeto Firebase: {project_id}")

    # 1. Instalar firebase-admin localmente se necessário
    print("\n[1/4] Verificando firebase-admin...")
    import subprocess, shutil
    node = shutil.which("node")
    npm  = shutil.which("npm")
    if not node:
        print("ERRO: Node.js nao encontrado. Instale em nodejs.org"); sys.exit(1)

    # Criar dir temporário para o export
    tmp_dir = Path("scripts/_tmp_migration")
    tmp_dir.mkdir(exist_ok=True)
    (tmp_dir / "export.js").write_text(EXPORT_SCRIPT, encoding="utf-8")
    pkg = {"name": "migration", "version": "1.0.0", "dependencies": {"firebase-admin": "^12.0.0"}}
    (tmp_dir / "package.json").write_text(json.dumps(pkg), encoding="utf-8")

    result = subprocess.run([npm, "install", "--prefix", str(tmp_dir), "--silent"],
                            capture_output=True, text=True)
    if result.returncode != 0:
        print("ERRO ao instalar firebase-admin:", result.stderr[:300]); sys.exit(1)
    print("      OK")

    # 2. Exportar Firestore
    print("\n[2/4] Exportando Firestore...")
    ts        = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    local_out = Path(f"firestore-backup-{ts}.json")
    db_id     = "ai-studio-dd7e9dfb-0165-45d3-a20b-394740606e1c"

    result = subprocess.run(
        [node, str(tmp_dir / "export.js"), str(key_path.resolve()), str(local_out.resolve()), db_id],
        capture_output=True, text=True,
        env={**__import__('os').environ, "NODE_PATH": str(tmp_dir / "node_modules")}
    )
    print(result.stdout)
    if result.returncode != 0:
        print("ERRO na exportação:", result.stderr[:500]); sys.exit(1)

    data = json.loads(local_out.read_text(encoding="utf-8"))
    total = sum(len(v) for v in data.values())
    print(f"\n      Backup salvo: {local_out}  ({total} documentos total)")

    # 3. Enviar para VPS
    print("\n[3/4] Enviando dados para o VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, port=22, username=VPS_USER, password=VPS_PASS, timeout=15)
    sftp = client.open_sftp()

    data_bytes = local_out.read_bytes()
    sftp.putfo(io.BytesIO(data_bytes),         "/tmp/migration-data.json")
    sftp.putfo(io.BytesIO(IMPORT_SCRIPT.encode()), "/tmp/import.js")
    sftp.close()
    print(f"      Enviados: {len(data_bytes)//1024} KB")

    # Ler credenciais do MongoDB
    _, out, _ = client.exec_command("cat /docker/portal/.env")
    env_vars   = dict(l.split("=", 1) for l in out.read().decode().strip().splitlines() if "=" in l)
    mongo_user = env_vars.get("MONGO_USERNAME", "portaladmin")
    mongo_pass = env_vars.get("MONGO_PASSWORD", "")
    mongo_uri  = f"mongodb://{mongo_user}:{mongo_pass}@portal-mongodb:27017/portal?authSource=admin"

    # 4. Importar no MongoDB
    print("\n[4/4] Importando no MongoDB...")
    ssh_run(client, "docker cp /tmp/import.js portal-portal-backend-1:/tmp/import.js")
    ssh_run(client, "docker cp /tmp/migration-data.json portal-portal-backend-1:/tmp/migration-data.json")
    ssh_run(client,
        f"docker exec -e MONGODB_URI='{mongo_uri}' portal-portal-backend-1 node /tmp/import.js",
        timeout=120
    )

    client.close()

    # Limpar dir temporário
    import shutil as _shutil
    _shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f"\nMigracao concluida! Backup local salvo em: {local_out}")

if __name__ == "__main__":
    main()
