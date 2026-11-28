// GET /api/session
// 세션 쿠키 발급. 사이트 로드 시 프론트가 호출.
//
// 보안 설계:
// - ADMIN_TOKEN 환경변수로 HMAC-SHA256 서명 (서버만 앎)
// - HttpOnly, Secure, SameSite=Strict (XSS로 탈취 불가, 외부 사이트에서 사용 불가)
// - Origin 체크 (허용된 출처만 세션 발급 가능)
//
// 쓰기/조회 API들은 이 쿠키의 HMAC을 검증한다 (lib/session.js).

import { createSessionToken, isAllowedOrigin, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from "../lib/session.js";

const { ADMIN_TOKEN } = process.env;

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET만 허용됩니다." });
  }
  if (!ADMIN_TOKEN) {
    return res.status(500).json({ error: "서버 설정 미완료 (ADMIN_TOKEN)." });
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: "허용되지 않은 출처입니다." });
  }

  const token = createSessionToken(ADMIN_TOKEN);
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SEC}`
  ];
  // 로컬 개발(HTTP)에서는 Secure 속성 때문에 쿠키가 안 저장됨 → NODE_ENV로 분기
  const isLocal = /^(http:\/\/)(localhost|127\.0\.0\.1)/.test(origin || "");
  const cookie = isLocal
    ? cookieParts.filter((p) => p !== "Secure").join("; ")
    : cookieParts.join("; ");

  res.setHeader("Set-Cookie", cookie);
  return res.status(200).json({ ok: true, expiresInSec: SESSION_MAX_AGE_SEC });
}
