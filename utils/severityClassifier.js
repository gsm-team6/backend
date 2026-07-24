// backend/utils/severityClassifier.js
// 신고 내용(텍스트)을 AI로 분석해 심각도를 자동 분류합니다.
// '긴급' / '보통' / '낮음' 중 하나로 판단하며, OpenAI -> Gemini -> 키워드 분류
// 순서로 사용 가능한 방식을 자동으로 선택합니다. (키 없음/호출 실패 시 다음 단계로 대체)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const API_TIMEOUT_MS = 8000;
const SEVERITY_LEVELS = ['긴급', '보통', '낮음'];

const SYSTEM_PROMPT = `당신은 학교 시설물 안전 신고를 분류하는 안전 담당자입니다.
신고 내용을 읽고 심각도를 "긴급", "보통", "낮음" 중 하나로 분류하세요.

- 긴급: 감전, 화재, 가스 누출, 붕괴, 추락 등 즉각적인 인명 피해 위험이 있는 경우
- 보통: 파손, 고장 등 위험하지만 즉각적인 인명 피해 가능성은 낮은 경우
- 낮음: 미관상 문제, 단순 문의 등 안전과 무관하거나 경미한 경우`;

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

// 모든 AI 호출이 불가능/실패할 때 사용하는 오프라인 최종 폴백
function classifyByKeyword(text) {
    const normalized = (text || '').replace(/\s+/g, '');

    const urgentHit = URGENT_KEYWORDS.find((keyword) =>
        normalized.includes(keyword.replace(/\s+/g, ''))
    );
    if (urgentHit) {
        return { severity: '긴급', matchedKeyword: urgentHit, source: 'keyword' };
    }

    const lowHit = LOW_KEYWORDS.find((keyword) =>
        normalized.includes(keyword.replace(/\s+/g, ''))
    );
    if (lowHit) {
        return { severity: '낮음', matchedKeyword: lowHit, source: 'keyword' };
    }

    return { severity: '보통', matchedKeyword: null, source: 'keyword' };
}

async function classifyByOpenAI(text) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: `신고 내용: "${text}"` },
                ],
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'severity_classification',
                        strict: true,
                        schema: {
                            type: 'object',
                            properties: {
                                severity: { type: 'string', enum: SEVERITY_LEVELS },
                                reason: { type: 'string' },
                            },
                            required: ['severity', 'reason'],
                            additionalProperties: false,
                        },
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`OpenAI API 응답 오류: ${response.status} ${errorBody}`);
        }

        const data = await response.json();
        const rawText = data?.choices?.[0]?.message?.content;
        if (!rawText) {
            throw new Error('OpenAI API 응답에 결과가 없습니다.');
        }

        const parsed = JSON.parse(rawText);
        if (!SEVERITY_LEVELS.includes(parsed.severity)) {
            throw new Error(`알 수 없는 심각도 값: ${parsed.severity}`);
        }

        return { severity: parsed.severity, matchedKeyword: parsed.reason, source: 'openai' };
    } finally {
        clearTimeout(timeout);
    }
}

async function classifyByGemini(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n신고 내용: "${text}"` }] }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            severity: { type: 'STRING', enum: SEVERITY_LEVELS },
                            reason: { type: 'STRING' },
                        },
                        required: ['severity', 'reason'],
                    },
                },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API 응답 오류: ${response.status} ${errorBody}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            throw new Error('Gemini API 응답에 결과가 없습니다.');
        }

        const parsed = JSON.parse(rawText);
        if (!SEVERITY_LEVELS.includes(parsed.severity)) {
            throw new Error(`알 수 없는 심각도 값: ${parsed.severity}`);
        }

        return { severity: parsed.severity, matchedKeyword: parsed.reason, source: 'gemini' };
    } finally {
        clearTimeout(timeout);
    }
}

async function classifySeverity(text) {
    if (OPENAI_API_KEY) {
        try {
            return await classifyByOpenAI(text);
        } catch (error) {
            console.error('OpenAI 심각도 분류 실패, 다음 방식으로 대체합니다:', error.message);
        }
    }

    if (GEMINI_API_KEY) {
        try {
            return await classifyByGemini(text);
        } catch (error) {
            console.error('Gemini 심각도 분류 실패, 키워드 분류로 대체합니다:', error.message);
        }
    }

    return classifyByKeyword(text);
}

module.exports = { classifySeverity, classifyByKeyword, classifyByGemini, classifyByOpenAI };
