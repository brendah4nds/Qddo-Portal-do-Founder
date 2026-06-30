/**
 * Script para corrigir registros de check-in com data errada (bug de timezone UTC vs BRT).
 *
 * COMO USAR:
 *   SSH no VPS → entrar no container MongoDB → rodar no mongosh:
 *     mongosh portal --file /tmp/fix-checkin-dates.js
 *
 *   Ou copiar o conteúdo e colar direto no mongosh.
 *
 * O que faz:
 *   Percorre todos os check-ins e compara o campo `date` (string 'yyyy-MM-dd') com
 *   a data local em BRT (UTC-3) derivada do `checkinTime`.
 *   Onde divergirem, corrige o `date` para o valor local correto.
 *
 * Brasil (América/São Paulo) em junho = UTC-3 (sem horário de verão).
 * Se quiser rodar em outro horário do ano, ajuste BRT_OFFSET_MS.
 */

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000; // UTC-3

let fixed = 0;
let skipped = 0;

db.checkins.find({}).forEach(doc => {
  if (!doc.checkinTime) { skipped++; return; }

  const localTime = new Date(doc.checkinTime.getTime() + BRT_OFFSET_MS);
  const correctDate = localTime.toISOString().slice(0, 10); // 'yyyy-MM-dd'

  if (doc.date !== correctDate) {
    print(`[FIX] _id=${doc._id}  stored="${doc.date}"  correct="${correctDate}"  checkinTime=${doc.checkinTime.toISOString()}`);
    db.checkins.updateOne(
      { _id: doc._id },
      { $set: { date: correctDate } }
    );
    fixed++;
  }
});

print(`\nConcluído: ${fixed} registro(s) corrigido(s), ${skipped} ignorado(s) (sem checkinTime).`);
