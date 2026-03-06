const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'xsmart_tv'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const [tables] = await connection.execute('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));

        const [historyCols] = await connection.execute('DESCRIBE watch_history');
        console.log('watch_history columns:', historyCols);

        const [favCols] = await connection.execute('DESCRIBE favorites');
        console.log('favorites columns:', favCols);

        await connection.end();
    } catch (err) {
        console.error('Check failed:', err.message);
    }
}

checkSchema();
