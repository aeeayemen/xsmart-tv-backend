const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixUniqueConstraints() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'xsmart_tv'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database to fix constraints.');

        // 1. Clean duplicates in favorites
        console.log('Cleaning duplicates in favorites...');
        await connection.execute(`
            DELETE f1 FROM favorites f1
            INNER JOIN favorites f2 
            WHERE f1.id < f2.id 
            AND f1.user_id = f2.user_id 
            AND f1.stream_id = f2.stream_id 
            AND f1.type = f2.type
        `);

        // 2. Add unique key to favorites
        try {
            await connection.execute('ALTER TABLE favorites ADD UNIQUE KEY unique_user_fav (user_id, stream_id, type)');
            console.log('Added UNIQUE KEY to favorites.');
        } catch (e) {
            console.log('UNIQUE KEY on favorites already exists or failed:', e.message);
        }

        // 3. Clean duplicates in watch_history
        console.log('Cleaning duplicates in watch_history...');
        await connection.execute(`
            DELETE h1 FROM watch_history h1
            INNER JOIN watch_history h2 
            WHERE h1.id < h2.id 
            AND h1.user_id = h2.user_id 
            AND h1.stream_id = h2.stream_id 
            AND h1.type = h2.type
        `);

        // 4. Add unique key to watch_history
        try {
            await connection.execute('ALTER TABLE watch_history ADD UNIQUE KEY unique_user_history (user_id, stream_id, type)');
            console.log('Added UNIQUE KEY to watch_history.');
        } catch (e) {
            console.log('UNIQUE KEY on watch_history already exists or failed:', e.message);
        }

        console.log('Migration completed successfully.');
        await connection.end();
    } catch (err) {
        console.error('Migration failed:', err.message);
    }
}

fixUniqueConstraints();
