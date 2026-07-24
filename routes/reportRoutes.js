// backend/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controller/reportController');

router.post('/', reportController.createReport);
router.get('/', reportController.getReports);
router.get('/notifications/me', reportController.getMyNotifications); 

// ★ 새로 추가된 알림 관련 라우트 (여기에 위치해야 안전합니다)
router.put('/notifications/read', reportController.markNotificationsAsRead); // 알림 읽음 처리
router.delete('/notifications/:id', reportController.deleteNotification); // 개별 알림 삭제

// 기존 삭제 및 수정 라우트들
router.post('/bulk-delete', reportController.bulkDeleteReports);
router.post('/cleanup', reportController.deleteOldReports);
router.post('/reclassify', reportController.reclassifySeverity); // 기존 신고 심각도 재분류
router.put('/:id/status', reportController.updateReportStatus);
router.delete('/:id', reportController.deleteReport);

module.exports = router;