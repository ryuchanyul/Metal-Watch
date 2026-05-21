// KOMIS 사이트에서 11개 종목 일별 가격 xlsx를 자동 다운로드.
// Playwright headless Chrome 사용. GitHub Actions 매일 실행용.

import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_DIR = join(here, "..", "tmp", "komis");

// 한글 종목명 → 출력 파일명(영문 심볼)
// KOMIS는 텅스텐을 단일 옵션으로만 제공 → WC/WO3 둘 다 같은 데이터로 저장
const TARGETS = [
  // 비철금속 (BaseMetals 페이지)
  { category: "BaseMetals", korean: "동",       symbol: "cu" },
  { category: "BaseMetals", korean: "알루미늄", symbol: "al" },
  { category: "BaseMetals", korean: "니켈",     symbol: "ni" },
  { category: "BaseMetals", korean: "연",       symbol: "pb" },
  { category: "BaseMetals", korean: "아연",     symbol: "zn" },
  { category: "BaseMetals", korean: "주석",     symbol: "sn" },
  // 희소금속 (MinorMetals 페이지)
  { category: "MinorMetals", korean: "리튬",   symbol: "li" },
  { category: "MinorMetals", korean: "코발트", symbol: "co" },
  { category: "MinorMetals", korean: "망간",   symbol: "mn" },
  { category: "MinorMetals", korean: "텅스텐", symbol: "w_wc" },
  { category: "MinorMetals", korean: "텅스텐", symbol: "w_wo3" }
];

const CATEGORY_URL = {
  BaseMetals: "https://www.komis.or.kr/Komis/RsrcPrice/BaseMetals",
  MinorMetals: "https://www.komis.or.kr/Komis/RsrcPrice/MinorMetals"
};

const FETCH_TIMEOUT = 30_000;

async function setupDir() {
  if (existsSync(DOWNLOAD_DIR)) {
    await rm(DOWNLOAD_DIR, { recursive: true, force: true });
  }
  await mkdir(DOWNLOAD_DIR, { recursive: true });
}

// 페이지에서 광종 코드 옵션 목록 추출
async function getMineralOptions(page) {
  return page.evaluate(() => {
    const sel = document.querySelector("#srchMnrkndUnqCd");
    if (!sel) return [];
    return Array.from(sel.options).map((o) => ({
      value: o.value,
      text: (o.textContent || "").trim()
    }));
  });
}

async function downloadOne(page, target) {
  const url = CATEGORY_URL[target.category];
  console.log(`[${target.symbol}] 페이지 로드: ${target.category}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: FETCH_TIMEOUT });

  // 광종 select 옵션 로드 대기 (AJAX)
  await page.waitForFunction(
    () => document.querySelectorAll("#srchMnrkndUnqCd option").length > 1,
    { timeout: FETCH_TIMEOUT }
  );

  const options = await getMineralOptions(page);
  // 매칭 우선순위: 정확한 일치 → 시작 일치 → 포함
  // "연" 같은 짧은 한글이 "아연"과 충돌하는 문제 방지
  let match =
    options.find((o) => o.text.trim() === target.korean) ||
    options.find((o) => o.text.trim().startsWith(target.korean));
  if (!match) {
    throw new Error(
      `광종 '${target.korean}' 찾을 수 없음. 옵션: ${options.map((o) => o.text).join(", ")}`
    );
  }

  console.log(`[${target.symbol}] 광종 선택: ${match.text} (${match.value})`);
  await page.selectOption("#srchMnrkndUnqCd", match.value);

  // 검색 버튼 클릭
  await page.click('button:has-text("검색"), a:has-text("검색"), [onclick*="onSearch"]');
  await page.waitForLoadState("networkidle", { timeout: FETCH_TIMEOUT });

  // 엑셀 다운로드 트리거
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: FETCH_TIMEOUT }),
    page.evaluate(() => {
      // 페이지 내부에 정의된 downExcel 함수 직접 호출 (가장 안정적)
      if (typeof downExcel === "function") {
        downExcel();
      } else {
        throw new Error("downExcel 함수 없음");
      }
    })
  ]);

  const filename = `${target.symbol}.xlsx`;
  const dest = join(DOWNLOAD_DIR, filename);
  await download.saveAs(dest);
  console.log(`[${target.symbol}] 저장 완료: ${filename}`);
}

async function main() {
  await setupDir();

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  let success = 0;
  let failures = [];

  for (const target of TARGETS) {
    try {
      await downloadOne(page, target);
      success += 1;
    } catch (error) {
      console.error(`[${target.symbol}] 실패:`, error.message);
      failures.push({ symbol: target.symbol, error: error.message });
    }
  }

  await browser.close();

  console.log(`\n=== 결과: ${success}/${TARGETS.length} 성공 ===`);
  if (failures.length) {
    console.log("실패 종목:");
    failures.forEach((f) => console.log(`  - ${f.symbol}: ${f.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[다운로드 실패]", error);
  process.exit(1);
});
