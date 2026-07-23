import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 기본 경로 테스트
app.get('/', (req, res) => {
  res.send('백엔드 서버가 성공적으로 작동 중입니다!');
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`🚀 서버가 실행되었습니다: http://localhost:${PORT}`);
});