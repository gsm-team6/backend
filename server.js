// backend/server.js
const express = require('express');
const cors = require('cors');

// 1. 라우터 파일들 불러오기
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { ensureSeverityColumn, ensureAiSummaryColumns } = require('./config/migrate');

// ★ 2. express 앱 객체 생성 (반드시 app.use들보다 상단에 있어야 합니다!)
const app = express();

// 3. 미들웨어 설정
app.use(cors());
app.use(express.json());

// 4. 라우트 연결 (app 선언 및 미들웨어 설정 이후에 배치)
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);

// 5. 서버 실행
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 정상 실행 중입니다.`);
});

// 신고 심각도(severity) 컬럼 마이그레이션 (없으면 생성, 있으면 무시)
ensureSeverityColumn().catch((error) => {
  console.error('severity 컬럼 마이그레이션 실패:', error);
});

// AI 요약/우선 대응 추천 컬럼 마이그레이션 (없으면 생성, 있으면 무시)
ensureAiSummaryColumns().catch((error) => {
  console.error('summary/recommendation 컬럼 마이그레이션 실패:', error);
});