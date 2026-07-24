// backend/config/migrate.js
const pool = require('./db');

// reports 테이블에 severity 컬럼이 없으면 추가합니다. (기존 행은 '보통'으로 채워짐)
async function ensureSeverityColumn() {
    await pool.query(`
        ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS severity VARCHAR(10) NOT NULL DEFAULT '보통'
    `);
}

// reports 테이블에 AI 요약(summary)/우선 대응 추천(recommendation) 컬럼이 없으면 추가합니다.
async function ensureAiSummaryColumns() {
    await pool.query(`
        ALTER TABLE reports
        ADD COLUMN IF NOT EXISTS summary TEXT,
        ADD COLUMN IF NOT EXISTS recommendation TEXT
    `);
}

module.exports = { ensureSeverityColumn, ensureAiSummaryColumns };
