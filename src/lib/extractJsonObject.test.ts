import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./extractJsonObject";

describe("extractJsonObject", () => {
  it("parses direct JSON objects", () => {
    const result = extractJsonObject("{\"ok\":true}");

    expect(result.success).toBe(true);
    expect(result.success ? result.value : null).toEqual({ ok: true });
  });

  it("extracts the first valid JSON object from wrapped text", () => {
    const result = extractJsonObject(
      "Here is the report:\n{\"report\":{\"status\":\"ok\"}}\nDone."
    );

    expect(result.success).toBe(true);
    expect(result.success ? result.value : null).toEqual({
      report: { status: "ok" }
    });
  });

  it("returns a structured parse failure when no object can be extracted", () => {
    const result = extractJsonObject("Here is the report: not json");

    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error).toContain("No valid JSON object");
  });
});
