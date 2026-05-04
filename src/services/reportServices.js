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


  const moment = require('moment-timezone');

  const agoraSP = moment()
    .tz('America/Sao_Paulo')
    .format('YYYY-MM-DD HH:mm:ss');

  console.log(agoraSP)


  let sql = `SELECT
        COALESCE(t.cluster, '(Sem)') AS cluster,
        SUM(t.minutos >=  100 AND t.minutos < 120) AS coord,
        SUM(t.minutos >= 120 AND t.minutos < 180) AS ger,
        SUM(t.minutos >= 180 AND t.minutos < 240) AS ger_s,
        SUM(t.minutos >= 240 AND t.minutos < 300) AS dir_r,
        SUM(t.minutos >= 300 AND t.minutos < 360) AS dir_e,
        SUM(t.minutos >= 360)                     AS vp
      FROM (
        SELECT
          b.cluster,
          TIMESTAMPDIFF(
            MINUTE,
            TIMESTAMP(
              b.date,
              STR_TO_DATE(SUBSTRING_INDEX(b.time_slot, '-', 1), '%H:%i')
            ),
            ?
          ) AS minutos
        FROM ne.base_eta_nodejs b
        WHERE
          b.astatus = 'Nao Iniciada'
          AND b.date = CURDATE()
          AND b.time_slot <> 'Dia Completo'
          AND b.tecnologia = 'GPON'
          AND b.time_slot REGEXP '^[0-9]{2}:[0-9]{2}-'
      ) t
      GROUP BY t.cluster
      ORDER BY t.cluster;
    `;




  const rows = await db.query(sql, [agoraSP]);
  console.log(rows)
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

    let msg = `🚨 *ESCALONAMENTO - Atividades não Iniciadas – ${cargo.nome}*\n`;


    msg += '```\n';

    itens.forEach(i => {
      msg += `${i.cidade} | ${String(i.valor).padStart(3, ' ')}\n`;
    });


    msg += '```\n';

    // ✅ TOTAL NO FINAL
    msg += `*Total:* ${total}\n\n`;
    msg += `🔗*Link para ver os PONs:*\n`;
    msg += `http://10.59.112.107/escalonamento\n\n`;
    msg += `_enviado automáticamente pelo GOPER_`;

    mensagens.push(msg);
  });

  return mensagens;
}

module.exports = { gerarRelatoriosPorCargo };