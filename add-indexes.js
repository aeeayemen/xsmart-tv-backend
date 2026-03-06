const mysql = require('mysql2/promise');
require('dotenv').config();

async function addIndexes() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'xsmart_tv'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database for indexing.');

        // Add indexes for favorites
        try {
            await connection.execute('CREATE INDEX idx_fav_user_type ON favorites(user_id, type)');
            console.log('Added index to favorites(user_id, type).');
        } catch (e) { console.log('Index on favorites already exists or failed:', e.message); }

        // Add indexes for history
        try {
            await connection.execute('CREATE INDEX idx_hist_user_type ON watch_history(user_id, type)');
            console.log('Added index to watch_history(user_id, type).');
        } catch (e) { console.log('Index on watch_history already exists or failed:', e.message); }

        console.log('Indexing completed.');
        await connection.end();
    } catch (err) {
        console.error('Indexing failed:', err.message);
    }
}

addIndexes();
