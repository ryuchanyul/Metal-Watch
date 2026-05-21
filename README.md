# Metal Watch

원자재 시세와 분석표 자동정리 웹앱.

## 아키텍처

```
┌─ GitHub Actions (cron, 매시 5분) ──┐
│  scripts/collect.js                 │
│  → Trading Economics 스크랩         │
│  → Supabase 적재                    │
└─────────────────────────────────────┘
                ↓
┌─ Supabase ──────────────────────────┐
│  price_snapshots                    │
│  fx_snapshots                       │
└─────────────────────────────────────┘
                ↓ SELECT
┌─ Vercel ────────────────────────────┐
│  api/prices.js → public/ 정적 파일  │
└─────────────────────────────────────┘
                ↓
            웹 브라우저
```

## 데이터 흐름

- **수집**: GitHub Actions가 1시간마다 Trading Economics를 스크랩하여 Supabase에 적재
- **저장**: Supabase가 단일 진실의 원천 (이력 누적)
- **응답**: Vercel Function이 Supabase에서 최신값 SELECT → 프론트 응답
- **백필**: 1년치 LME 일별 데이터(Cu/Al/Ni/Sn)는 네이버 finance에서 1회성 수집

## 배포 절차

### 1) Supabase 설정

```sql
-- 1회: 테이블 생성
-- 파일: supabase/migrations/0001_init.sql
```

```sql
-- 1회: Vercel이 anon 키로 SELECT 가능하게 정책 추가
-- 파일: supabase/migrations/0002_rls_public_read.sql
```

두 파일 모두 Supabase SQL Editor에서 차례로 실행.

### 2) GitHub Actions (자동 수집)

레포 Settings → Secrets and variables → Actions에 두 secret 등록:

- `SUPABASE_URL` = `https://<project>.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role secret 키

워크플로우는 `.github/workflows/collect.yml` (매시 5분 자동).
초기 백필: Actions 탭 → "Backfill historical prices" → Run workflow.

### 3) Vercel 배포

1. https://vercel.com 가입 → GitHub 로그인
2. **New Project** → `Metal-Watch` 레포 import
3. Framework Preset: **Other**
4. **Environment Variables** 등록:
   - `SUPABASE_URL` = Supabase 프로젝트 URL
   - `SUPABASE_ANON_KEY` = anon/publishable 키
5. **Deploy** → 1~2분 후 URL 발급

이후 `git push`마다 자동 재배포.

## 로컬 개발

```bash
npm install -g vercel       # 최초 1회
vercel dev                   # http://localhost:3000
```

`vercel dev`는 Vercel Function을 로컬에서 시뮬레이션. 환경변수는 `vercel env pull`로 가져옴.

## 파일 구조

```
public/         # 정적 파일 (HTML/CSS/JS)
api/            # Vercel Functions
  └── prices.js # GET /api/prices
lib/            # 공유 모듈
  ├── prices.js # Trading Economics 파싱 (수집용)
  ├── db.js     # Supabase SELECT (응답용)
  └── sources/  # 백필 출처별 파서
scripts/        # 1회성 스크립트
  ├── collect.js          # GitHub Actions 실행
  └── backfill-naver.js   # 네이버 1년치 백필
supabase/migrations/      # SQL 마이그레이션
.github/workflows/        # GitHub Actions 정의
```

## 데이터 출처

화면에 보이는 모든 가격은 **KOMIS (한국광해광업공단)** 의 일간 시세를 사용한다.
- 11종목 (Co, Li, Ni, Mn, Cu, Al, Sn, Pb, Zn, W_WC, W_WO3)
- 2024-01-02부터의 일별 데이터
- spec/단위 매핑 + 다운로드/적재 흐름: [`docs/data-sources.md`](docs/data-sources.md)

매시간 자동 수집 (Trading Economics)은 백업/이력용으로 Supabase에 누적되지만 화면에는 미노출.
