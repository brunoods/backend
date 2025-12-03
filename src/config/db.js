const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Falha ao conectar ao banco de dados:', err.code);
        console.error('Verifique as credenciais no arquivo .env');
    } else {
        console.log('✅ Conectado ao banco de dados MySQL com sucesso!');
        connection.release();
    }
});

module.exports = pool.promise();