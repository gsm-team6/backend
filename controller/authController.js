// backend/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); 

// 1. 회원가입 로직
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 이메일 도메인 검증
        if (!email || !email.endsWith('@gsm.hs.kr')) {
            return res.status(400).json({ success: false, message: '이메일은 @gsm.hs.kr 도메인만 사용할 수 있습니다.' });
        }

        // 비밀번호 길이 검증 (6자리 이상 20자리 이하)
        if (!password || password.length < 6 || password.length > 20) {
            return res.status(400).json({ success: false, message: '비밀번호는 6자리 이상 20자리 이하로 설정해주세요.' });
        }

        // 이메일 중복 확인
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: '이미 가입된 이메일입니다.' });
        }

        // 비밀번호 해싱 및 DB 저장 (기본 권한은 STUDENT)
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery = `
            INSERT INTO users (name, email, password, role) 
            VALUES ($1, $2, $3, 'STUDENT') RETURNING id, name, email, role
        `;
        const newUser = await pool.query(insertQuery, [name, email, hashedPassword]);

        res.status(201).json({ success: true, message: '회원가입이 완료되었습니다.', user: newUser.rows[0] });
    } catch (error) {
        console.error('회원가입 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 2. 로그인 로직
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 사용자 조회
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        const user = result.rows[0];

        // 비밀번호 일치 여부 확인
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }

        // JWT 토큰 발급 (토큰 안에 id, role, name 정보를 담습니다)
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '1d' } // 1일 후 만료
        );

        res.status(200).json({ 
            success: true, 
            token, 
            user: { id: user.id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (error) {
        console.error('로그인 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};