# 데이터 출처 (KOMIS)

화면에 표시되는 모든 가격은 **한국광해광업공단 KOMIS**의 일간 시세를 사용한다. spec/단위 일관성을 위해 단일 공식 출처로 운영.

## KOMIS 페이지

종목 카테고리별 입력 페이지:

| 카테고리 | URL | 적재 종목 |
|---------|-----|---------|
| 비철금속 | https://www.komis.or.kr/Komis/RsrcPrice/BaseMetals | Cu, Al, Ni, Pb, Zn, Sn |
| 희소금속 | https://www.komis.or.kr/Komis/RsrcPrice/MinorMetals | Co, Li, Mn, W |
| 철광석 | https://www.komis.or.kr/Komis/RsrcPrice/IronOre | (참고용, 현재 미적재) |

## 종목 매핑

사용자 정의 spec과 단위를 기준으로 정리. KOMIS에서 다운로드한 xlsx는 종목마다 단위가 다르므로 Supabase 적재 시 모두 **USD/kg**으로 통일한다.

| 한글 | DB symbol | spec | KOMIS 원본 단위 | 변환 |
|------|-----------|------|---------------|------|
| 코발트 | `Co` | 99.8%min In warehouse Rotterdam | USD/kg | 그대로 |
| 리튬 | `Li` | Li2CO3 99.5%min CIF China | USD/kg | 그대로 |
| 니켈 | `Ni` | LME CASH | USD/ton | ÷1000 |
| 망간 | `Mn` | Mn 75%min, C 2%max EXW China | USD/mt | ÷1000 |
| 동(구리) | `Cu` | LME CASH | USD/ton | ÷1000 |
| 알루미늄 | `Al` | LME CASH | USD/ton | ÷1000 |
| 주석 | `Sn` | LME CASH | USD/ton | ÷1000 |
| 연(납) | `Pb` | LME CASH | USD/ton | ÷1000 |
| 아연 | `Zn` | LME CASH | USD/ton | ÷1000 |
| 텅스텐 WC | `W_WC` | 99.8%min 2.5-7.0μm FOB China | USD/kg | 그대로 |
| 텅스텐 WO3 | `W_WO3` | 99.95%min EXW China | USD/kg | 그대로 |

## 다운로드 → 적재 흐름

```
KOMIS 사이트 (수동)
     │ 종목별 xlsx 다운로드 11개
     ▼
~/Downloads/광물시세/ 폴더
     │ Python으로 일괄 변환
     ▼
scripts/data/{symbol}-komis.json (11개)
     │ git commit + push
     ▼
GitHub Actions (수동 트리거)
     │ scripts/backfill-all-komis.js 실행
     ▼
Supabase price_snapshots
     │ source = 'KOMIS (광해광업공단)'
     ▼
Vercel /api/prices, /api/history
     │ KOMIS source 필터링
     ▼
브라우저 화면
```

### 단계별 명령

#### 1. KOMIS xlsx 11개 다운로드 (수동)

각 카테고리 페이지에서 종목별 클릭 → 일간 시세 화면 → 우측 상단 **다운로드** 버튼.

파일을 모두 `C:\Users\PREMAN-HOME\Downloads\광물시세\` 폴더에 모은다.

#### 2. xlsx → JSON 일괄 변환

```bash
python3 -c "
import openpyxl, json, os, glob
MAP = {
    '리튬':     ('Li',    1),
    '코발트':   ('Co',    1),
    '망간':     ('Mn',    1000),
    '니켈':     ('Ni',    1000),
    '동':       ('Cu',    1000),
    '알루미늄': ('Al',    1000),
    '주석':     ('Sn',    1000),
    '아연':     ('Zn',    1000),
    '연':       ('Pb',    1000),
    '텅스텐WC': ('W_WC',  1),
    '텅스텐WO3':('W_WO3', 1),
}
out_dir = 'C:/Users/PREMAN-HOME/Documents/New project/scripts/data'
for path in sorted(glob.glob('C:/Users/PREMAN-HOME/Downloads/광물시세/*.xlsx')):
    name = os.path.basename(path)
    symbol = divisor = None
    for k, (s, d) in MAP.items():
        if f'_{k}_' in name: symbol, divisor = s, d; break
    if not symbol: continue
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb['RsrcPrice']
    rows = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row[0] or row[1] is None: continue
        s = str(row[0]); iso = f'{s[:4]}-{s[4:6]}-{s[6:8]}'
        rows.append([iso, round(float(row[1]) / divisor, 6), float(row[1])])
    rows.sort(key=lambda r: r[0])
    with open(f'{out_dir}/{symbol.lower()}-komis.json', 'w', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False, indent=0)
    print(f'{symbol}: {len(rows)}행')
"
```

#### 3. Commit + Push

```bash
cd "C:/Users/PREMAN-HOME/Documents/New project"
git add scripts/data/*.json
git commit -m "data: refresh KOMIS data (YYYY-MM-DD)"
git push
```

#### 4. GitHub Actions 트리거

```bash
gh workflow run backfill-komis.yml --ref master
```

또는 GitHub 웹: Actions 탭 → "Backfill all KOMIS data" → Run workflow.

#### 5. 검증

```bash
# 종목별 행 수 확인
for sym in Co Li Ni Mn Cu Al Sn Zn Pb W_WC W_WO3; do
  count=$(curl -s -I "https://tyadxmdxdopeemznrnvv.supabase.co/rest/v1/price_snapshots?source=eq.KOMIS%20%28%EA%B4%91%ED%95%B4%EA%B4%91%EC%97%85%EA%B3%B5%EB%8B%A8%29&symbol=eq.$sym" \
    -H "apikey: <publishable_key>" -H "Prefer: count=exact" | grep -oE "[0-9]+/[0-9]+" | head -1)
  echo "$sym: $count"
done
```

## xlsx 파일 구조 (KOMIS)

| 셀 | 내용 |
|----|------|
| A1 | 제목 (예: `광물자원가격_리튬_일간`) |
| A2 | 다운로드 날짜 |
| Row 3 | 헤더: 기준일, 기준가격, 최저가, 최고가, 전일대비등락가, 전일대비등락비율, LME재고량, ... |
| Row 4 이후 | 일별 데이터 (기준일 YYYYMMDD, 가격, ...) |

## 멱등성

`backfill-all-komis.js`는 매번 실행 시 다음을 수행:
1. `source = 'KOMIS (광해광업공단)'` 모든 행 삭제
2. `source = 'Manual estimate (chart)'` 모든 행 삭제 (옛 추정값 정리)
3. JSON 파일 11개 재적재

새 데이터로 갈음하므로 안전하게 반복 가능.

## 자동 매시간 수집 (Trading Economics)

별도 워크플로우 `.github/workflows/collect.yml`이 매시 5분(UTC) Trading Economics에서 7종목(Co, Li, Ni, Mn, Cu, Al, Sn) + Pb, Zn을 수집한다. 다만:

- **spec/단위가 KOMIS와 다름** (예: Li → 일반 lithium, KOMIS → Li2CO3 CIF China)
- **화면에는 미노출** (`lib/db.js`가 `KOMIS` source만 SELECT)
- Supabase에는 백업/이력용으로 누적
- W는 Trading Economics에 없음

## 알려진 한계

| 항목 | 한계 |
|------|------|
| KOMIS 자동 다운로드 | JS 렌더링이라 일반 스크래핑 불가. 수동 다운로드만 가능 |
| 데이터 신선도 | 사용자가 직접 xlsx 받아야 갱신. 매일 자동 안 됨 |
| W_WC vs W_WO3 | KOMIS는 단일 텅스텐 데이터만 제공 — 두 종목이 동일 가격 표시 |
| 정확한 W 가격 | Asian Metal, Argus 등 별도 출처 필요 (유료) |

## 추후 자동화 방안 (참고)

1. **GitHub Action + Playwright**: KOMIS 사이트를 headless browser로 매일 자동 다운로드 → JSON 변환 → 적재
2. **공공데이터포털 API**: KOMIS가 data.go.kr에 공식 API 등록했는지 정기 확인
3. **별도 광물 데이터 구독**: Fastmarkets, Argus 등 유료 API (실시간 + 안정적)
