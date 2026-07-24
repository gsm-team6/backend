// backend/config/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Supabase 연결 시 SSL 설정이 필요한 경우가 많습니다. (연결 에러가 나면 아래 주석 해제)
    // ssl: { rejectUnauthorized: false }
});

module.exports = pool;