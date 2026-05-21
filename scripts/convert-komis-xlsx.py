"""
KOMIS xlsx → JSON 변환.

입력: tmp/komis/{symbol}.xlsx 11개 (download-komis.js가 생성)
출력: scripts/data/{symbol}-komis.json 11개

종목별 단위 정규화:
- USD/kg 표기 종목: 그대로
- USD/ton, USD/mt 표기 종목: ÷1000
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

# (symbol, USD/kg 환산 분모)
DIVISORS = {
    "li":    1,
    "co":    1,
    "mn":    1000,
    "ni":    1000,
    "cu":    1000,
    "al":    1000,
    "sn":    1000,
    "zn":    1000,
    "pb":    1000,
    "w_wc":  1,
    "w_wo3": 1,
}

here = Path(__file__).parent
TMP_DIR = here.parent / "tmp" / "komis"
DATA_DIR = here / "data"
DATA_DIR.mkdir(exist_ok=True)


def convert_one(xlsx_path: Path, symbol: str, divisor: int) -> int:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["RsrcPrice"]

    rows = []
    for row in ws.iter_rows(min_row=4, values_only=True):
        if not row[0] or row[1] is None:
            continue
        s = str(row[0])
        iso = f"{s[:4]}-{s[4:6]}-{s[6:8]}"
        raw = float(row[1])
        usd_per_kg = round(raw / divisor, 6)
        rows.append([iso, usd_per_kg, raw])

    rows.sort(key=lambda r: r[0])

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

    for symbol, divisor in DIVISORS.items():
        xlsx = TMP_DIR / f"{symbol}.xlsx"
        if not xlsx.exists():
            print(f"⚠ {symbol}: xlsx 없음 ({xlsx})")
            failures.append(symbol)
            continue

        try:
            count = convert_one(xlsx, symbol, divisor)
            print(f"✓ {symbol}: {count}행")
            success += 1
        except Exception as e:
            print(f"✗ {symbol}: {e}")
            failures.append(symbol)

    print(f"\n결과: {success}/{len(DIVISORS)} 성공")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
