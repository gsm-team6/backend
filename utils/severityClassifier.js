// backend/utils/severityClassifier.js
// 신고 내용(텍스트)에서 위험 키워드를 감지해 심각도를 자동 분류합니다.
// '긴급' > '보통' > '낮음' 순으로 판단하며, 매칭된 키워드는 관리자 화면에서
// 왜 긴급으로 분류됐는지 보여주는 용도로 함께 반환합니다.

const URGENT_KEYWORDS = [
    '전선 노출', '전선노출', '감전', '누전', '고압선',
    '가스 누출', '가스누출', '가스 냄새', '가스냄새', '유독가스', '유독 가스',
    '화재', '불꽃', '스파크', '연기 발생', '폭발',
    '붕괴', '무너짐', '무너져', '무너질',
    '낙하 위험', '떨어질 위험', '추락 위험',
    '침수', '누수 심각', '정전',
    '끼임', '매몰', '의식불명', '의식 없음', '출혈', '쓰러짐', '쓰러져',
];

const LOW_KEYWORDS = [
    '경미', '미관', '낙서', '먼지', '가벼운 흠집', '사소한', '흠집',
    '단순 문의', '문의사항', '냄새 약간',
];

function classifySeverity(text) {
    const normalized = (text || '').replace(/\s+/g, '');

    const urgentHit = URGENT_KEYWORDS.find((keyword) =>
        normalized.includes(keyword.replace(/\s+/g, ''))
    );
    if (urgentHit) {
        return { severity: '긴급', matchedKeyword: urgentHit };
    }

    const lowHit = LOW_KEYWORDS.find((keyword) =>
        normalized.includes(keyword.replace(/\s+/g, ''))
    );
    if (lowHit) {
        return { severity: '낮음', matchedKeyword: lowHit };
    }

    return { severity: '보통', matchedKeyword: null };
}

module.exports = { classifySeverity, URGENT_KEYWORDS, LOW_KEYWORDS };
