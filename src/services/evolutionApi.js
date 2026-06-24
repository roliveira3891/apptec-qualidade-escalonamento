require('dotenv').config();

const axios = require('axios'); // Biblioteca para fazer requisições HTTP (POST)

async function enviarParaWhatsapp(texto) {
    // Monta a URL final usando as variáveis do .env
    const url = `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
    console.log(url, texto)
    try {
        console.log('try evolution')
        // Envia os dados para a Evolution API via POST
        const axiosConfig = {
            // proxy: {
            //     protocol: 'http',
            //     host: process.env.PROXY_URL,
            //     port: process.env.PROXY_PORT,
            // },
            headers: { 'apikey': process.env.EVOLUTION_KEY } 
        };

        await axios.post(url, 
        {
            number: process.env.WHATSAPP_GROUP_ID, // ID do grupo ou número
            text: texto // O texto que o reportService gerou
        },
        axiosConfig );
        
        console.log('✅ Mensagem enviada com sucesso!');
    } catch (error) {
        //Se a API der erro avisa aqui
        console.error('Erro na Evolution API:', error.message);
    }
}
module.exports = { enviarParaWhatsapp };
