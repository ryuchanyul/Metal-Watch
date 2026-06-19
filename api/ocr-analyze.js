// Vercel Serverless Function — /api/ocr-analyze
// 클라이언트가 보낸 이미지(base64 data URL)를 Claude Vision API로 분석.
// 한국 광물/금속 시험성적서에서 시료명, 메탈 함량, 수분, 시험일자 등을 JSON으로 추출.

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `당신은 한국 광물/금속 시험성적서를 분석하는 전문가입니다.
첨부된 이미지에서 정보를 추출하여 JSON 객체로만 응답하세요. 설명 없이 JSON만.

추출 항목 (못 읽으면 null, 추측 금지):
- sample_name: 시료명 (예: "니켈 슬러지 (A)")
- metals: 배열. [{ name: 한글명, symbol: 영문심볼, content_mg_per_kg: 숫자|null, content_percent: 함량%|null }]
- moisture_percent: 수분(%) 숫자
- test_date: 시험완료일자 "YYYY-MM-DD"
- report_number: 성적서번호 (예: "TAK-2026-062853")
- issuer: 발급기관 (예: "KTR 한국화학융합시험연구원")
- confidence: 0.0~1.0 자체 평가 신뢰도

규칙:
1. mg/kg 단위는 content_mg_per_kg에. content_percent = mg/kg ÷ 10000.
2. % 단위는 content_percent에. content_mg_per_kg = percent × 10000.
3. 숫자의 공백/콤마는 모두 제거 (예: "228 832" → 228832).
4. 메탈 심볼: 니켈→Ni, 구리→Cu, 알루미늄→Al, 아연→Zn, 납→Pb, 주석→Sn, 코발트→Co, 리튬→Li, 망간→Mn, 몰리브덴→Mo, 텅스텐→W, 마그네슘→Mg, 티타늄→Ti, 인듐→In, 금→Au, 은→Ag, 바륨→Ba.
5. 응답은 JSON 객체 1개만. 코드블록 백틱 금지.`;

const USER_PROMPT = "이 시험성적서 이미지를 분석해서 JSON으로 추출해주세요.";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured",
      message: "Vercel 환경변수에 ANTHROPIC_API_KEY 등록 필요"
    });
  }

  const { image } = req.body || {};
  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "image (base64 data URL) required" });
  }

  // data:image/jpeg;base64,<base64...> 형식 파싱
  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({
      error: "invalid image format",
      message: "data:image/<jpeg|png|webp|gif>;base64,... 형식이어야 함"
    });
  }
  const mediaType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const base64 = match[2];

  try {
    const claudeRes = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 }
              },
              { type: "text", text: USER_PROMPT }
            ]
          }
        ]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("[ocr-analyze] Claude API error:", claudeRes.status, errText);
      return res.status(502).json({
        error: "Claude API error",
        status: claudeRes.status,
        message: errText.substring(0, 500)
      });
    }

    const result = await claudeRes.json();
    const text = result.content?.[0]?.text?.trim() || "";

    let parsed;
    try {
      // 혹시 코드블록 백틱이 포함된 경우 제거
      const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error("[ocr-analyze] JSON parse failed. raw:", text.substring(0, 500));
      return res.status(502).json({
        error: "JSON parse failed",
        raw_preview: text.substring(0, 500)
      });
    }

    return res.status(200).json({
      ...parsed,
      _model: MODEL,
      _usage: result.usage
    });
  } catch (error) {
    console.error("[ocr-analyze] 실패:", error);
    return res.status(500).json({ error: error.message });
  }
}
