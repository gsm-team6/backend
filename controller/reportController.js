// backend/controllers/reportController.js
const pool = require('../config/db'); // 위에서 만든 db.js 연결

// 1. 안전 위험 신고하기 (POST)
// 1. 안전 위험 신고하기 (POST)
exports.createReport = async (req, res) => {
    try {
        const { 
            content, description, 
            location, 
            report_type, category, 
            user_id 
        } = req.body;

        const finalContent = content || description || '';
        const finalType = report_type || category || '기타';

        // ★ status 기본값을 'PENDING' -> '접수' 로 수정
        const insertQuery = `
            INSERT INTO reports (content, location, report_type, user_id, status) 
            VALUES ($1, $2, $3, $4, '접수') 
            RETURNING *
        `;

        const newReport = await pool.query(insertQuery, [
            finalContent, 
            location, 
            finalType, 
            user_id
        ]);

        res.status(201).json({ success: true, data: newReport.rows[0] });
    } catch (error) {
        console.error('신고 접수 DB 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 2. 신고 목록 조회 (GET) - 대시보드용
// backend/controllers/reportController.js

exports.getReports = async (req, res) => {
    try {
        // 기존 쿼리에 혹시 student_id가 있었다면 제거하고 구조를 맞춰줍니다.
        const query = `
            SELECT r.*, json_build_object('id', u.id, 'name', u.name, 'email', u.email) as users 
            FROM reports r 
            LEFT JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC;
        `;
        const result = await pool.query(query);
        
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error('목록 조회 에러:', error); // <- 터미널에 에러 원인을 찍어주는 부분
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

exports.updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params; // URL에서 전달받은 신고글 ID
        const { status } = req.body; // 프론트에서 보낸 변경할 상태 ('접수', '처리중', '완료')

        // 1. reports 테이블의 상태 업데이트
        const updateQuery = `
            UPDATE reports 
            SET status = $1, updated_at = NOW() 
            WHERE id = $2 
            RETURNING *;
        `;
        const updateResult = await pool.query(updateQuery, [status, id]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: '신고 내역을 찾을 수 없습니다.' });
        }

        const updatedReport = updateResult.rows[0];

        // 2. 상태가 '완료'로 변경된 경우, notifications 테이블에 알림 데이터 추가
        if (status === '완료') {
            const message = `[${updatedReport.report_type}] 접수하신 위치(${updatedReport.location})의 안전 위험물 처리가 완료되었습니다.`;
            const notifyQuery = `
                INSERT INTO notifications (user_id, report_id, message)
                VALUES ($1, $2, $3);
            `;
            // updatedReport.user_id는 해당 글을 작성한 학생의 ID입니다.
            await pool.query(notifyQuery, [updatedReport.user_id, id, message]);
        }

        res.status(200).json({
            success: true,
            message: '상태가 성공적으로 변경되었습니다.',
            data: updatedReport
        });
    } catch (error) {
        console.error('상태 변경 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 4. [학생] 내 알림함 조회하기 (GET)
exports.getMyNotifications = async (req, res) => {
    try {
        // 원래는 로그인 토큰에서 추출해야 하지만, 테스트를 위해 쿼리로 받거나 기본값(1) 사용
        const userId = req.query.user_id || 1; 

        const query = `
            SELECT id, message, is_read, created_at, report_id
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [userId]);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('알림 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteQuery = 'DELETE FROM reports WHERE id = $1 RETURNING *';
        const result = await pool.query(deleteQuery, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: '해당 신고를 찾을 수 없습니다.' });
        }

        res.status(200).json({ success: true, message: '신고가 삭제되었습니다.' });
    } catch (error) {
        console.error('개별 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 6. [관리자] 선택 일괄 삭제 (조건 4 반영: 상태 무관하게 모두 삭제)
exports.bulkDeleteReports = async (req, res) => {
    try {
        const { ids } = req.body;
        // status = '완료' 조건을 제거하여 선택된 모든 id 삭제
        const deleteQuery = `
            DELETE FROM reports 
            WHERE id = ANY($1::int[]) 
            RETURNING id;
        `;
        const result = await pool.query(deleteQuery, [ids]);

        res.status(200).json({ 
            success: true, 
            message: `선택한 ${result.rowCount}개의 신고가 삭제되었습니다.`,
            deletedIds: result.rows
        });
    } catch (error) {
        console.error('일괄 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 7. [관리자] 완료된 신고 정리 (조건 3 반영: 1일, 7일, 14일, 30일, 전체)
exports.deleteOldReports = async (req, res) => {
    try {
        const { days } = req.body; // 프론트에서 1, 7, 14, 30, 'all' 중 하나를 보냄

        let deleteQuery = '';

        if (days === 'all') {
            // '전체' 선택 시 기간 상관없이 '완료' 상태인 것 모두 삭제
            deleteQuery = `DELETE FROM reports WHERE status = '완료' RETURNING id;`;
        } else {
            // 숫자가 들어오면 해당 일수(days) 경과한 '완료' 상태만 삭제
            deleteQuery = `
                DELETE FROM reports 
                WHERE status = '완료' AND created_at < NOW() - INTERVAL '${days} days'
                RETURNING id;
            `;
        }

        const result = await pool.query(deleteQuery);

        res.status(200).json({ 
            success: true, 
            message: `조건에 맞는 완료된 신고 ${result.rowCount}개가 정리되었습니다.` 
        });
    } catch (error) {
        console.error('완료된 신고 정리 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

exports.markNotificationsAsRead = async (req, res) => {
    try {
        const { user_id } = req.body; 
        
        // 해당 유저의 모든 알림을 읽음(is_read = true) 처리
        const updateQuery = 'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 RETURNING id';
        const result = await pool.query(updateQuery, [user_id]);

        res.status(200).json({ success: true, message: '모든 알림을 읽음 처리했습니다.' });
    } catch (error) {
        console.error('알림 읽음 처리 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 9. [학생] 개별 알림 삭제
exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteQuery = 'DELETE FROM notifications WHERE id = $1 RETURNING id';
        const result = await pool.query(deleteQuery, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: '알림을 찾을 수 없습니다.' });
        }

        res.status(200).json({ success: true, message: '알림이 삭제되었습니다.' });
    } catch (error) {
        console.error('알림 삭제 에러:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};