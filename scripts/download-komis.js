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
// 텅스텐은 광종 선택 후 가격기준(srchPrcCrtr)에서 WC/WO3를 구분.
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
  { category: "MinorMetals", korean: "몰리브덴", symbol: "mo" },
  { category: "MinorMetals", korean: "텅스텐", prcCrtrKeyword: "Carbide", symbol: "w_wc" },
  { category: "MinorMetals", korean: "텅스텐", prcCrtrKeyword: "Oxide",   symbol: "w_wo3" },
  // 마그네슘 (USD/T), 티타늄 (USD/kg)
  { category: "MinorMetals", korean: "마그네슘", symbol: "mg" },
  { category: "MinorMetals", korean: "티타늄",   symbol: "ti" },
  { category: "MinorMetals", korean: "인듐",     symbol: "in" },
  // 귀금속 (EtcMnrl 페이지) — 2026-06-19 KOMIS 카테고리 이동 확인 후 복구
  { category: "EtcMnrl", korean: "금", symbol: "au" },
  { category: "EtcMnrl", korean: "은", symbol: "ag" }
];

const CATEGORY_URL = {
  BaseMetals: "https://www.komis.or.kr/Komis/RsrcPrice/BaseMetals",
  MinorMetals: "https://www.komis.or.kr/Komis/RsrcPrice/MinorMetals",
  EtcMnrl: "https://www.komis.or.kr/Komis/RsrcPrice/EtcMnrl"
};

const FETCH_TIMEOUT = 30_000;

async function setupDir() {
  if (existsSync(DOWNLOAD_DIR)) {
    await rm(DOWNLOAD_DIR, { recursive: true, force: true });
  }
  await mkdir(DOWNLOAD_DIR, { recursive: true });
}

// 페이지에서 select 옵션 목록 추출 (제네릭)
async function getSelectOptions(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    return Array.from(el.options).map((o) => ({
      value: o.value,
      text: (o.textContent || "").trim()
    }));
  }, selector);
}

async function getMineralOptions(page) {
  return getSelectOptions(page, "#srchMnrkndUnqCd");
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

  // 가격기준 select가 동적으로 갱신될 시간 대기 (change 이벤트 → AJAX)
  await page.waitForTimeout(800);

  // 가격기준 선택이 필요한 종목 처리
  if (target.prcCrtrKeyword) {
    const prcOptions = await getSelectOptions(page, "#srchPrcCrtr");
    console.log(
      `[${target.symbol}] 가격기준 옵션: ${prcOptions.map((o) => o.text).join(" | ")}`
    );
    const keyword = target.prcCrtrKeyword.toUpperCase();
    const prcMatch = prcOptions.find((o) =>
      o.text.toUpperCase().includes(keyword)
    );
    if (!prcMatch) {
      throw new Error(
        `가격기준 '${target.prcCrtrKeyword}' 못 찾음. 옵션: ${prcOptions.map((o) => o.text).join(", ")}`
      );
    }
    console.log(
      `[${target.symbol}] 가격기준 선택: ${prcMatch.text} (${prcMatch.value})`
    );
    await page.selectOption("#srchPrcCrtr", prcMatch.value);
    await page.waitForTimeout(300);
  }

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
  }

  // 일부 실패해도 workflow 다음 step(commit + backfill) 계속.
  // 단 절반 이상 실패하면 fail (전반 문제로 간주, 사이트 다운 등).
  if (success === 0) {
    console.error("[중대 실패] 모든 종목 다운로드 실패 — 사이트 다운 또는 큰 변경");
    process.exit(1);
  }
  if (failures.length > success) {
    console.warn(`[부분 실패] ${failures.length}건 실패, 그러나 ${success}건 성공 — 다음 step 계속`);
  }
}

main().catch((error) => {
  console.error("[다운로드 실패]", error);
  process.exit(1);
});
