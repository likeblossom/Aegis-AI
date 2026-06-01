import { describe, expect, it } from "vitest";
import {
  AzureGenerationError,
  classifyAzureError,
  isTransientAzureFailure,
  sanitizeAzureDiagnosticMessage
} from "./classifyAzureError";

describe("classifyAzureError", () => {
  it("classifies rate limiting", () => {
    const error = new AzureGenerationError({
      reason: "AZURE_RATE_LIMITED",
      message: "Rate limited",
      status: 429
    });

    expect(classifyAzureError(error)).toBe("AZURE_RATE_LIMITED");
    expect(isTransientAzureFailure(error)).toBe(true);
  });

  it("classifies timeouts", () => {
    expect(classifyAzureError(new Error("Request timed out"))).toBe(
      "AZURE_TIMEOUT"
    );
    expect(isTransientAzureFailure(new Error("AbortError: aborted"))).toBe(true);
  });

  it("classifies content filtering", () => {
    expect(
      classifyAzureError(
        new Error("The response was filtered due to content management policy.")
      )
    ).toBe("AZURE_CONTENT_FILTERED");
  });

  it("classifies authentication, permissions, deployment, and bad request failures", () => {
    expect(classifyAzureError({ status: 401, message: "invalid key" })).toBe(
      "AZURE_UNAUTHORIZED"
    );
    expect(classifyAzureError({ status: 403, message: "forbidden" })).toBe(
      "AZURE_FORBIDDEN"
    );
    expect(
      classifyAzureError({ status: 404, message: "DeploymentNotFound" })
    ).toBe("AZURE_DEPLOYMENT_NOT_FOUND");
    expect(classifyAzureError({ status: 400, message: "bad request" })).toBe(
      "AZURE_BAD_REQUEST"
    );
  });

  it("classifies generic errors", () => {
    expect(classifyAzureError(new Error("Unexpected failure"))).toBe(
      "AZURE_UNKNOWN_ERROR"
    );
  });

  it("sanitizes diagnostic messages", () => {
    expect(
      sanitizeAzureDiagnosticMessage(
        "Failed https://example.openai.azure.com/openai/deployments/test/chat?api-version=1 api-key=secret"
      )
    ).toBe("Failed example.openai.azure.com api-key=[redacted]");
  });
});
