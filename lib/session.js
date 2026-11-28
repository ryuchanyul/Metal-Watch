// 세션 쿠키 공통 유틸.
// - createSessionToken: ADMIN_TOKEN을 서명 키로, 날짜 버킷을 메시지로 HMAC-SHA256
// - verifySessionCookie: 요청 쿠키에서 토큰 추출 후 서버 재계산 HMAC과 상수시간 비교
// - isAllowedOrigin: ALLOWED_ORIGINS 환경변수의 정확 매칭 (와일드카드 없음)
//
// 쓰기/조회 API들은 verifySessionCookie(req, ADMIN_TOKEN)로 인증한다.

import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "mw_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 24시간

// 토큰 = HMAC-SHA256(ADMIN_TOKEN, 날짜 버킷)
// 하루 단위 버킷이라 매일 자동 갱신 → 하루 지나면 유효성 잃음 → 프론트가 /api/session 재호출
function todayBucket() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export function createSessionToken(adminToken) {
  return crypto
    .createHmac("sha256", adminToken)
    .update(todayBucket())
    .digest("hex");
}

// 상수시간 비교 — timing attack 방지
function safeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// 쿠키 헤더에서 세션 토큰 추출
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

// 요청의 세션 쿠키 유효성 검증. 유효하면 true.
// 오늘 또는 어제 버킷 둘 다 수용 (자정 전후 요청 보호)
export function verifySessionCookie(req, adminToken) {
  if (!adminToken) return false;
  const token = parseCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!token) return false;

  const today = createSessionToken(adminToken);
  if (safeEq(token, today)) return true;

  // 어제 버킷 (자정 직후 오래된 쿠키 수용)
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = crypto
    .createHmac("sha256", adminToken)
    .update(d.toISOString().slice(0, 10))
    .digest("hex");
  return safeEq(token, yesterday);
}

// Origin 화이트리스트 — 환경변수 ALLOWED_ORIGINS에 쉼표 구분 명시.
// 설정 안 되어 있으면 Vercel 기본 도메인으로 fallback.
// 와일드카드 매칭 없음 (보안 리뷰 지적 반영).
export function isAllowedOrigin(originStr) {
  if (!originStr) return false;
  let hostname;
  try {
    hostname = new URL(originStr).origin;
  } catch {
    return false;
  }
  const raw = process.env.ALLOWED_ORIGINS || "";
  const envOrigins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    "https://metal-watch.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ];
  const allowed = envOrigins.length > 0 ? envOrigins : defaults;
  return allowed.includes(hostname);
}
