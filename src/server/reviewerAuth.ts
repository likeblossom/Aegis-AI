import { timingSafeEqual } from "crypto";

const DEVELOPMENT_REVIEWER_ACCESS_CODE = "aegis-reviewer";

export function validateReviewerAccessCode(accessCode: string) {
  const expected = getReviewerAccessCode();

  if (!expected) {
    return {
      ok: false,
      error:
        "Reviewer access is not configured. Set AEGIS_REVIEWER_ACCESS_CODE before enabling reviewer actions."
    };
  }

  if (!safeEquals(accessCode, expected)) {
    return {
      ok: false,
      error: "Invalid reviewer access code."
    };
  }

  return { ok: true, error: null };
}

function getReviewerAccessCode() {
  const configured = process.env.AEGIS_REVIEWER_ACCESS_CODE?.trim();

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_REVIEWER_ACCESS_CODE;
  }

  return null;
}

function safeEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
