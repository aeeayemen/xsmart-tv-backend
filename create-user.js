const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createUser() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'xsmart_tv'
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        const username = 'admin';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists
        const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);

        if (rows.length > 0) {
            await connection.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, username]);
            console.log(`User '${username}' already exists. Password updated to '${password}'.`);
        } else {
            const [result] = await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

            // Default 1 month subscription
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            await connection.execute('INSERT INTO subscriptions (user_id, end_date) VALUES (?, ?)', [result.insertId, endDate]);

            console.log(`User '${username}' created successfully with password '${password}'.`);
        }

        await connection.end();
    } catch (err) {
        console.error('Error creating user:', err.message);
    }
}

createUser();
