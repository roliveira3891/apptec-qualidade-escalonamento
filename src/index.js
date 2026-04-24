require('dotenv').config();

// Importa as funções de serviço
const { gerarRelatoriosPorCargo } = require('./services/reportServices');
const { enviarParaWhatsapp } = require('./services/evolutionApi');

// Função principal que organiza o fluxo
async function executarTarefa() {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] Iniciando verificação...`);

  try {
    // 1. Gera os relatórios separados por cargo
    const mensagens = await gerarRelatoriosPorCargo();

    // 2. Se não houver mensagens, apenas loga
    if (!mensagens || mensagens.length === 0) {
      console.log('Nenhum escalonamento para enviar.');
      return;
    }

    // 3. Envia cada mensagem (uma por cargo)
    for (const msg of mensagens) {
      await enviarParaWhatsapp(msg);
    }

    console.log(`✅ ${mensagens.length} mensagem(ns) enviada(s) com sucesso.`);

  } catch (error) {
    console.error('❌ Erro no loop principal:', error.message || error);
  }
}

// Executa imediatamente ao iniciar
executarTarefa();

// Agenda para rodar a cada 30 minutos
setInterval(executarTarefa, 30 * 60 * 1000);

console.log('Bot de Escalonamento iniciado! Rodando a cada 30 min.');
``