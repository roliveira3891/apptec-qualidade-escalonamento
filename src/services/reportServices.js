const db = require('../config/db');
const moment = require('moment-timezone');

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

  // Horário atual em São Paulo — usado como referência para o tempo decorrido
  const agoraSP = moment()
    .tz('America/Sao_Paulo')
    .format('YYYY-MM-DD HH:mm:ss');

  console.log(agoraSP);

  // Conta, por cidade, as atividades em execução (Iniciada / em rota)
  // agrupando pelo tempo decorrido desde inicio_previsto:
  //   coord   -> de 1h00 a 1h30 (60 a 90 min)
  //   gestor  -> de 1h31 a 2h00 (91 a 120 min)
  //   gerente -> acima de 2h     (> 120 min)
  const sql = `SELECT
        COALESCE(t.cidade, '(Sem)') AS cidade,
        SUM(t.minutos >= 60  AND t.minutos <= 90)  AS coord,
        SUM(t.minutos >  90  AND t.minutos <= 120) AS gestor,
        SUM(t.minutos >  120)                      AS gerente
      FROM (
        SELECT
          a.cidade,
          TIMESTAMPDIFF(MINUTE, a.inicio_previsto, ?) AS minutos
        FROM remuneracao_atividades a
        INNER JOIN users u ON u.matricula = a.login_tecnico
        WHERE
          a.status IN ('Iniciada', 'em rota')
          AND a.inicio_previsto IS NOT NULL
          AND a.data_agendada_execucao = CURDATE()
      ) t
      WHERE t.minutos >= 60
      GROUP BY t.cidade
      ORDER BY t.cidade;
    `;

  const rows = await db.query(sql, [agoraSP]);
  console.log(rows);
  if (!rows || rows.length === 0) return [];

  const cargos = [
    { key: 'coord',   nome: 'Escalonado para Coordenador/Coordenador Qualidade', tempo: 'mais de 1 hora' },
    { key: 'gestor',  nome: 'Escalonado para Gestor',                            tempo: 'mais de 1h30' },
    { key: 'gerente', nome: 'Escalonado para o Gerente',                         tempo: 'mais de 2 horas' }
  ];

  const mensagens = [];

  cargos.forEach(cargo => {
    const itens = rows
      .filter(r => r[cargo.key] > 0)
      .map(r => ({
        cidade: formatarCidade(r.cidade),
        valor: r[cargo.key]
      }));

    if (itens.length === 0) return;

    const total = itens.reduce((sum, i) => sum + Number(i.valor), 0);

    let msg = `🚨 *${cargo.nome}*\n`;
    msg += `Atividades iniciadas com ${cargo.tempo} em execução\n`;

    msg += '```\n';

    itens.forEach(i => {
      msg += `${i.cidade} | ${String(i.valor).padStart(3, ' ')}\n`;
    });

    msg += '```\n';

    msg += `*Total:* ${total}\n\n`;
    msg += `_enviado pelo SGT Qualidade_`;

    mensagens.push(msg);
  });

  // Mensagem analítica do GERENTE — alerta mais grave (mesmas regras: > 120 min,
  // técnico TECNOMULTI e agendada para hoje), porém detalhada atividade a atividade.
  const sqlGerente = `SELECT
        a.recurso,
        a.janela_servico,
        a.tipo_atividade,
        a.numero_ordem_servico,
        a.cidade,
        a.status,
        a.inicio_previsto
      FROM remuneracao_atividades a
      INNER JOIN users u ON u.matricula = a.login_tecnico
      WHERE
        a.status IN ('Iniciada', 'em rota')
        AND a.inicio_previsto IS NOT NULL
        AND a.data_agendada_execucao = CURDATE()
        AND TIMESTAMPDIFF(MINUTE, a.inicio_previsto, ?) > 120
      ORDER BY a.cidade, a.numero_ordem_servico;
    `;

  const detalhes = await db.query(sqlGerente, [agoraSP]);

  if (detalhes && detalhes.length > 0) {
    let msg = `🔴 *Escalonado para o Gerente — DETALHADO*\n`;
    msg += `Atividades iniciadas com mais de 2 horas em execução\n\n`;

    detalhes.forEach(d => {
      msg += `*OS:* ${d.numero_ordem_servico || '-'}\n`;
      msg += `*Recurso:* ${d.recurso || '-'}\n`;
      msg += `*Cidade:* ${d.cidade || '-'}\n`;
      msg += `*Tipo:* ${d.tipo_atividade || '-'}\n`;
      msg += `*Janela:* ${d.janela_servico || '-'}\n`;
      msg += `*Início Previsto:* ${d.inicio_previsto ? moment(d.inicio_previsto).tz('America/Sao_Paulo').format('DD/MM HH:mm') : '-'}\n`;
      msg += `*Status:* ${d.status || '-'}\n`;
      msg += `---------------------------\n`;
    });

    msg += `\n*Total:* ${detalhes.length}\n\n`;
    msg += `_enviado pelo SGT Qualidade_`;

    mensagens.push(msg);
  }

  return mensagens;
}

module.exports = { gerarRelatoriosPorCargo };
