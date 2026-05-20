# Metal Watch Local MVP

원자재 시세, 연간 차트, 분석표 자동정리 흐름을 확인할 수 있는 로컬 웹앱입니다.

## 실행 방법

PowerShell에서 `npm run dev`가 실행 정책 때문에 막힐 수 있으므로, 아래 명령을 권장합니다.

```powershell
node server.js
```

실행 후 브라우저에서 아래 주소를 엽니다.

```text
http://localhost:4173
```

또는 Windows에서 `start-metal-watch.cmd` 파일을 더블클릭하면 서버와 브라우저를 함께 실행합니다.

## 현재 포함된 기능

- 대시보드
- USD/KRW 환율 표시
- 원자재 시세표
- 월평균 대비 변화율
- 특정 원자재 상세 차트
- 1년 가격 흐름 차트
- 분석표 업로드 데모
- OCR 결과 형태의 샘플 분석
- 항목별 비용 계산
- 총 비용 계산
- 원자재 수동 추가

## 향후 Supabase/Vercel 연결 방향

- 코드 저장: GitHub
- 배포: Vercel
- DB: Supabase PostgreSQL
- 파일 저장: Supabase Storage
- 로그인: Supabase Auth
- OCR: Google Vision, Azure OCR, OpenAI Vision API 등 선택
