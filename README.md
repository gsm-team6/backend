# 교내 안전 신고 시스템 - Backend

학생이 접수한 교내 안전 위험 신고를 관리하는 API 서버입니다. Node.js/Express + PostgreSQL로 동작하며, 신고가 접수될 때 AI가 자동으로 심각도를 분류하고 요약/우선 대응 추천까지 함께 생성합니다.

## 기술 스택

- Node.js, Express 5
- PostgreSQL (`pg`)
- JWT 인증 (`jsonwebtoken`, `bcrypt`)
- AI 심각도 분류: OpenAI / Gemini (둘 다 없으면 키워드 매칭으로 대체)

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채워넣기
npm run dev            # nodemon으로 실행 (기본 포트 5000)
```

### 환경 변수 (`.env`)

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `JWT_SECRET` | JWT 서명 키 |
| `PORT` | 서버 포트 (기본 5000) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI 심각도 분류 1순위 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | OpenAI 실패/미설정 시 2순위 |

두 키 모두 없거나 호출이 실패하면 `utils/severityClassifier.js`의 키워드 매칭 로직으로 자동 대체됩니다.

## 주요 기능

- `POST /api/reports` — 신고 접수. 내용(content)을 AI로 분석해 `severity`(긴급/보통/낮음), `summary`(한 줄 요약), `recommendation`(우선 대응 추천)을 함께 저장
- `GET /api/reports` — 신고 목록 조회 (긴급 신고가 항상 최상단에 오도록 정렬)
- `PUT /api/reports/:id/status` — 상태 변경 (접수/처리중/완료), 완료 시 신고자에게 알림 생성
- `POST /api/reports/reclassify` — 기존 신고들의 severity/summary/recommendation 일괄 재생성
- `POST/PUT/DELETE /api/auth/*`, 알림 관련 엔드포인트 등은 `routes/` 참고

DB 컬럼(`severity`, `summary`, `recommendation`)은 서버 시작 시 `config/migrate.js`가 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`로 자동 추가합니다.

## 배포 (CI/CD)

`main` 브랜치에 push되면 `.github/workflows/ci-cd.yml`이:

1. `npm ci`로 설치 확인
2. SSH로 EC2에 접속해 최신 코드를 받고 Docker 이미지를 빌드/재실행

### 배포에 필요한 GitHub Secrets

| Secret | 설명 |
| --- | --- |
| `EC2_HOST` | EC2 퍼블릭 IP / 도메인 |
| `EC2_USER` | SSH 접속 계정 |
| `EC2_SSH_KEY` | SSH 개인키 |
| `EC2_SSH_PORT` | SSH 포트 (⚠️ 기본값 22가 아님, 보안을 위해 커스텀 포트로 변경되어 있으므로 반드시 설정 필요) |
| `EC2_APP_DIR` | 서버 내 저장소 경로 |
| `DATABASE_URL` | 프로덕션 DB 연결 문자열 |

> **참고**: EC2 서버는 무작위 스캔/무차별 대입 공격을 줄이기 위해 SSH 포트를 22 → 커스텀 포트로 변경해 운영합니다. `EC2_SSH_PORT` Secret이 누락되거나 EC2 쪽 포트가 다시 바뀌면 배포 단계에서 `dial tcp ...:22: i/o timeout`으로 실패하니, EC2 서버의 sshd 포트와 이 Secret 값이 항상 같은지 확인하세요.
