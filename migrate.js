const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'xsmart_tv'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database for migration.');

        // Add provider columns if they don't exist
        const [columns] = await connection.execute('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('provider_host')) {
            await connection.execute('ALTER TABLE users ADD COLUMN provider_host VARCHAR(255)');
            console.log('Added provider_host column.');
        }
        if (!columnNames.includes('provider_user')) {
            await connection.execute('ALTER TABLE users ADD COLUMN provider_user VARCHAR(100)');
            console.log('Added provider_user column.');
        }
        if (!columnNames.includes('provider_pass')) {
            await connection.execute('ALTER TABLE users ADD COLUMN provider_pass VARCHAR(100)');
            console.log('Added provider_pass column.');
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

migrate();
