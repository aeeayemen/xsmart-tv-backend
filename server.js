require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// Simple In-memory Cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let pool;

async function initDB() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Connected to MySQL Database');

        // Ensure columns are large enough for long names/IDs
        await pool.execute('ALTER TABLE watch_history MODIFY COLUMN stream_id VARCHAR(255)');
        await pool.execute('ALTER TABLE watch_history MODIFY COLUMN name VARCHAR(255)');
        await pool.execute('ALTER TABLE favorites MODIFY COLUMN stream_id VARCHAR(255)');
        await pool.execute('ALTER TABLE favorites MODIFY COLUMN name VARCHAR(255)');

    } catch (err) {
        console.error('Database connection or init failed:', err);
    }
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) return res.status(401).json({ message: 'User not found' });

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid password' });

        // Get subscription
        const [subs] = await pool.execute('SELECT * FROM subscriptions WHERE user_id = ?', [user.id]);
        const subscription = subs[0] || { start_date: null, end_date: null };

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({
            token,
            user_info: {
                id: user.id,
                username: user.username,
                provider_host: user.provider_host,
                provider_user: user.provider_user,
                provider_pass: user.provider_pass,
                created_at: Math.floor(new Date(subscription.start_date).getTime() / 1000),
                exp_date: Math.floor(new Date(subscription.end_date).getTime() / 1000),
                auth: 1
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Provider Info
app.post('/api/user/provider', authenticateToken, async (req, res) => {
    const { host, username, password } = req.body;
    console.log('Update Provider Info Request:', { host, username, password, userId: req.user.id });
    try {
        await pool.execute('UPDATE users SET provider_host = ?, provider_user = ?, provider_pass = ? WHERE id = ?',
            [host, username, password, req.user.id]);
        console.log('Provider info updated successfully for user:', req.user.id);
        res.json({ message: 'Provider info updated' });
    } catch (err) {
        console.error('Error in /api/user/provider:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- IPTV PROXY ---
app.post('/api/proxy', authenticateToken, async (req, res) => {
    const { url, params } = req.body;
    const cacheKey = JSON.stringify({ url, params, userId: req.user.id });

    // Check Cache
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json(cached.data);
        }
        cache.delete(cacheKey);
    }

    try {
        const queryParams = new URLSearchParams(params).toString();
        const fullUrl = `${url}/player_api.php?${queryParams}`;

        const response = await fetch(fullUrl);
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('IPTV Server returned non-JSON:', text.substring(0, 100));
            return res.status(500).json({ error: 'IPTV Server response was not valid JSON.' });
        }

        // Save to Cache
        cache.set(cacheKey, { data, timestamp: Date.now() });

        res.json(data);
    } catch (err) {
        console.error('Error in /api/proxy POST:', err.message);
        res.status(500).json({ error: 'Proxy request failed: ' + err.message });
    }
});

// Register (for initial setup/demo)
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);

        // Default 1 month subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await pool.execute('INSERT INTO subscriptions (user_id, end_date) VALUES (?, ?)', [result.insertId, endDate]);

        res.json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- DATA ROUTES ---

// Favorites
app.get('/api/favorites/:type', authenticateToken, async (req, res) => {
    try {
        const [favs] = await pool.execute('SELECT * FROM favorites WHERE user_id = ? AND type = ?', [req.user.id, req.params.type]);
        res.json(favs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/favorites', authenticateToken, async (req, res) => {
    const { stream_id, name, icon, type } = req.body;
    try {
        await pool.execute('INSERT INTO favorites (user_id, stream_id, name, icon, type) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=name',
            [req.user.id, stream_id, name, icon, type]);
        res.json({ message: 'Added to favorites' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/favorites/:type/:stream_id', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM favorites WHERE user_id = ? AND type = ? AND stream_id = ?',
            [req.user.id, req.params.type, req.params.stream_id]);
        res.json({ message: 'Removed from favorites' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// History
app.get('/api/history/:type', authenticateToken, async (req, res) => {
    try {
        const [history] = await pool.execute('SELECT * FROM watch_history WHERE user_id = ? AND type = ? ORDER BY updated_at DESC LIMIT 20',
            [req.user.id, req.params.type]);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/history', authenticateToken, async (req, res) => {
    const { stream_id, name, icon, type, progress } = req.body;
    console.log('History Update Request:', { stream_id, name, type, userId: req.user.id });
    try {
        if (!stream_id || !name) {
            console.error('Missing stream_id or name in history update');
            return res.status(400).json({ error: 'stream_id and name are required' });
        }
        await pool.execute('INSERT INTO watch_history (user_id, stream_id, name, icon, type, progress) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE progress = ?, updated_at = CURRENT_TIMESTAMP',
            [req.user.id, stream_id, name, icon || '', type, progress || 0, progress || 0]);
        res.json({ message: 'History updated' });
    } catch (err) {
        console.error('Error in /api/history POST:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    await initDB();
    console.log(`Server running on port ${PORT}`);
});
