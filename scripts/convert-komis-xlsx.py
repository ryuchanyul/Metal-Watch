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
    "mg":    0.001,   # USD/T → USD/kg
    "ti":    1.0,     # USD/kg 그대로
    "in":    1.0,     # USD/kg 그대로
}

here = Path(__file__).parent
TMP_DIR = here.parent / "tmp" / "komis"
DATA_DIR = here / "data"
DATA_DIR.mkdir(exist_ok=True)


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

    # DEBUG: xlsx 첫 3행 (최신순) — KOMIS 다운로드 시점 실제 데이터 확인
    _dbg = list(ws.iter_rows(min_row=4, max_row=6, values_only=True))
    print(f"  [debug {symbol}] xlsx 첫 3행: {[(r[0], r[1]) for r in _dbg if r[0]]}")

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
