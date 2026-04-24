require('dotenv').config();// Carrega as variáveis salvas no .env

const mariadb = require('mariadb');

const pool = mariadb.createPool({


    host: process.env.DB_HOST,     // IP do servidor ()
    user: process.env.DB_USER,     // Usuário do banco
    password: process.env.DB_PASS, // Senha 
    database: process.env.DB_NAME, // Nome do banco de dados (ne )
    waitForConnections: true,      // Se o banco estiver cheio espera uma vaga
    connectionLimit: 10,           // Máximo de 10 conexções simuâneas
    queueLimit: 0                  // Sem limite de fila de espera

});

// Exporta o pool para que os outros arquivos possam fazer consultas (queries)

module.exports = pool;