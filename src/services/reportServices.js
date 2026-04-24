const db = require('../config/db');

// Formata cidade para exatamente 12 caracteres
function formatarCidade(nome) {
  if (!nome) return '------------';

  const partes = nome.trim().split(/\s+/);
  let base = '';

  if (partes.length === 1) {
    base = partes[0];
  } else if (partes.length === 2) {
    base = `${partes[0][0]}.${partes[1]}`;
  } else {
    base = `${partes[0][0]}.${partes[partes.length - 1]}`;
  }

  if (base.length > 12) return base.substring(0, 12);
  return base.padEnd(12, '-');
}

async function gerarRelatoriosPorCargo() {

  const sql = `
    SELECT
      COALESCE(t.cluster, '(Sem)') AS cluster,
      SUM(t.minutos >=  60 AND t.minutos < 120) AS coord,
      SUM(t.minutos >= 120 AND t.minutos < 180) AS ger,
      SUM(t.minutos >= 180 AND t.minutos < 240) AS ger_s,
      SUM(t.minutos >= 240 AND t.minutos < 300) AS dir_r,
      SUM(t.minutos >= 300 AND t.minutos < 360) AS dir_e,
      SUM(t.minutos >= 360)                     AS vp
    FROM (
      SELECT
        cluster,
        TIMESTAMPDIFF(
          MINUTE,
          TIMESTAMP(
            date,
            STR_TO_DATE(SUBSTRING_INDEX(time_slot, '-', 1), '%H:%i')
          ),
          NOW()
        ) AS minutos
      FROM ne.base_eta_nodejs
      WHERE
        astatus = 'Nao Iniciada'
        AND date = CURDATE()
        AND tecnologia = 'GPON'
        AND time_slot <> 'Dia Completo'
        AND time_slot REGEXP '^[0-9]{2}:[0-9]{2}-'
    ) t
    GROUP BY t.cluster
    ORDER BY t.cluster;
  `;

  const rows = await db.query(sql);
  if (!rows || rows.length === 0) return [];

  const cargos = [
    { key: 'coord', nome: 'COORDENADOR' },
    { key: 'ger', nome: 'GERENTE' },
    { key: 'ger_s', nome: 'GERENTE SÊNIOR' },
    { key: 'dir_r', nome: 'DIRETOR REGIONAL' },
    { key: 'dir_e', nome: 'DIRETOR EXECUTIVO' },
    { key: 'vp', nome: 'VICE-PRESIDENTE' }
  ];

  const mensagens = [];

  cargos.forEach(cargo => {
    const itens = rows
      .filter(r => r[cargo.key] > 0)
      .map(r => ({
        cidade: formatarCidade(r.cluster),
        valor: r[cargo.key]
      }));

    if (itens.length === 0) return;

    const total = itens.reduce((sum, i) => sum + Number(i.valor), 0);

    let msg = `📌 *ESCALONAMENTO – ${cargo.nome}*\n`;
    msg += `Clusters: ${itens.length}\n\n`;

    msg += '```\n';
    itens.forEach(i => {
      msg += `${i.cidade}|${i.valor}\n`;
    });
    msg += '```\n';

    // ✅ TOTAL NO FINAL
    msg += `*Total:* ${total}`;

    mensagens.push(msg);
  });

  return mensagens;
}

module.exports = { gerarRelatoriosPorCargo };