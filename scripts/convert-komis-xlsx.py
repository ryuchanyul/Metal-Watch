"""
KOMIS xlsx → JSON 변환.

입력: tmp/komis/{symbol}.xlsx (download-komis.js가 생성)
출력: scripts/data/{symbol}-komis.json

단위 정규화 — raw_value × factor = USD/kg:
- USD/kg:  factor = 1
- USD/T, USD/mt, USD/ton: factor = 0.001
- USD/oz (트로이 온스, 31.1035g): factor = 32.1507
"""

import json
import os
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("openpyxl 미설치 — pip install openpyxl", file=sys.stderr)
    sys.exit(1)

# symbol → factor (raw × factor = USD/kg)
SYMBOLS = {
    "li":    1.0,
    "co":    1.0,
    "mn":    0.001,
    "ni":    0.001,
    "cu":    0.001,
    "al":    0.001,
    "sn":    0.001,
    "zn":    0.001,
    "pb":    0.001,
    "mo":    0.001,   # USD/mt → USD/kg
    "w_wc":  1.0,
    "w_wo3": 1.0,
    "au":    32.1507, # USD/oz → USD/kg (KOMIS EtcMnrl 페이지)
    "ag":    32.1507,
    "pd":    32.1507, # 팔라듐 USD/oz → USD/kg
    "mg":    0.001,   # USD/T → USD/kg
    "ti":    1.0,     # USD/kg 그대로
    "in":    1.0,     # USD/kg 그대로
}

here = Path(__file__).parent
TMP_DIR = here.parent / "tmp" / "komis"
SCREEN_DIR = here.parent / "tmp" / "komis-screen"
DATA_DIR = here / "data"
DATA_DIR.mkdir(exist_ok=True)


def load_screen_rows(symbol: str, factor: float):
    """download-komis.js가 저장한 화면 스크랩 JSON을 로드.

    반환: [[iso, usd_per_kg, raw_value], ...] 또는 [] (파일 없거나 비어있으면)
    """
    path = SCREEN_DIR / f"{symbol}.json"
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)
        rows = []
        for item in items:
            iso = item.get("date")
            price = item.get("price")
            if not iso or price is None:
                continue
            raw = float(price)
            usd_per_kg = round(raw * factor, 6)
            rows.append([iso, usd_per_kg, raw])
        return rows
    except Exception as e:
        print(f"  [screen {symbol}] 로드 실패: {e}")
        return []


def merge_screen_into_xlsx(xlsx_rows, screen_rows, symbol):
    """xlsx 데이터에 없는 최신 날짜를 화면 스크랩에서 append.

    xlsx는 KOMIS의 export 캐시라 사이트 표보다 늦을 수 있음.
    화면에 있는 날짜가 xlsx에 없으면 그 데이터를 추가.
    """
    if not screen_rows:
        return xlsx_rows
    xlsx_dates = {r[0] for r in xlsx_rows}
    added = []
    for sr in screen_rows:
        if sr[0] not in xlsx_dates:
            added.append(sr)
    if added:
        merged = xlsx_rows + added
        merged.sort(key=lambda r: r[0])
        added_dates = sorted([r[0] for r in added])
        print(f"  [merge {symbol}] 화면에서 {len(added)}행 추가: {added_dates}")
        return merged
    return xlsx_rows


# 전일 대비 급변 시 이상값으로 판단할 임계값 (30% 이상 하락/상승)
OUTLIER_THRESHOLD = 0.30


def clean_outliers(rows, symbol):
    """전일 대비 ±30% 이상 급변한 값을 전일 값으로 대체.

    rows: [[iso, usd_per_kg, raw_value], ...] 날짜 오름차순.
    """
    if len(rows) <= 1:
        return rows
    cleaned = [rows[0]]
    replaced = 0
    for i in range(1, len(rows)):
        cur = rows[i]
        prev = cleaned[-1]
        prev_val = prev[1]
        cur_val = cur[1]
        if prev_val > 0:
            change_ratio = abs(cur_val - prev_val) / prev_val
            if change_ratio > OUTLIER_THRESHOLD:
                # 이상값 → 전일 값으로 대체 (raw_value도 함께)
                cleaned.append([cur[0], prev[1], prev[2]])
                replaced += 1
                continue
        cleaned.append(cur)
    if replaced > 0:
        print(f"  [outlier {symbol}] {replaced}건 전일값으로 대체 (임계값 ±{OUTLIER_THRESHOLD*100:.0f}%)")
    return cleaned


def convert_one(xlsx_path: Path, symbol: str, factor: float) -> int:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["RsrcPrice"]

    rows = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row[0] or row[1] is None:
            continue
        s = str(row[0])
        iso = f"{s[:4]}-{s[4:6]}-{s[6:8]}"
        raw = float(row[1])
        usd_per_kg = round(raw * factor, 6)
        rows.append([iso, usd_per_kg, raw])

    rows.sort(key=lambda r: r[0])

    # 화면 스크랩 데이터 병합 (xlsx 캐시 지연 대비)
    screen_rows = load_screen_rows(symbol, factor)
    rows = merge_screen_into_xlsx(rows, screen_rows, symbol)

    # 이상값 필터: 전일 대비 ±30% 이상 급변 → 전일 값으로 대체
    rows = clean_outliers(rows, symbol)

    out_path = DATA_DIR / f"{symbol}-komis.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=0)

    return len(rows)


def main() -> int:
    if not TMP_DIR.exists():
        print(f"입력 폴더 없음: {TMP_DIR}", file=sys.stderr)
        return 1

    success = 0
    failures = []

    for symbol, factor in SYMBOLS.items():
        xlsx = TMP_DIR / f"{symbol}.xlsx"
        if not xlsx.exists():
            print(f"⚠ {symbol}: xlsx 없음 ({xlsx})")
            failures.append(symbol)
            continue

        try:
            count = convert_one(xlsx, symbol, factor)
            print(f"✓ {symbol}: {count}행 (factor={factor})")
            success += 1
        except Exception as e:
            print(f"✗ {symbol}: {e}")
            failures.append(symbol)

    print(f"\n결과: {success}/{len(SYMBOLS)} 성공")
    # 하나라도 성공하면 0 (다음 step 계속). 전부 실패만 exit 1.
    return 0 if success > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
