export const GENERATION_FAILURE_REASONS = [
  "AZURE_NOT_CONFIGURED",
  "AZURE_UNAUTHORIZED",
  "AZURE_FORBIDDEN",
  "AZURE_DEPLOYMENT_NOT_FOUND",
  "AZURE_RATE_LIMITED",
  "AZURE_CONTENT_FILTERED",
  "AZURE_BAD_REQUEST",
  "AZURE_TIMEOUT",
  "AZURE_JSON_PARSE_FAILED",
  "AZURE_SCHEMA_VALIDATION_FAILED",
  "AZURE_UNKNOWN_ERROR"
] as const;

export type GenerationFailureReason =
  (typeof GENERATION_FAILURE_REASONS)[number];

export class AzureGenerationError extends Error {
  reason: GenerationFailureReason;
  status?: number;

  constructor({
    message,
    reason,
    status,
    cause
  }: {
    message: string;
    reason: GenerationFailureReason;
    status?: number;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "AzureGenerationError";
    this.reason = reason;
    this.status = status;
  }
}

export function classifyAzureError(error: unknown): GenerationFailureReason {
  if (error instanceof AzureGenerationError) {
    return error.reason;
  }

  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  if (
    status === 404 ||
    message.includes("deploymentnotfound") ||
    message.includes("deployment not found") ||
    message.includes("deployment was not found") ||
    message.includes("deployment does not exist")
  ) {
    return "AZURE_DEPLOYMENT_NOT_FOUND";
  }

  if (status === 401) {
    return "AZURE_UNAUTHORIZED";
  }

  if (status === 403) {
    return "AZURE_FORBIDDEN";
  }

  if (status === 429) {
    return "AZURE_RATE_LIMITED";
  }

  if (status === 408) {
    return "AZURE_TIMEOUT";
  }

  if (
    message.includes("aborterror") ||
    message.includes("aborted") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "AZURE_TIMEOUT";
  }

  if (
    message.includes("content filter") ||
    message.includes("content_filter") ||
    message.includes("content management policy") ||
    message.includes("responsibleai") ||
    message.includes("responsible ai")
  ) {
    return "AZURE_CONTENT_FILTERED";
  }

  if (
    message.includes("unauthorized") ||
    message.includes("authentication") ||
    message.includes("invalid api key") ||
    message.includes("invalid key")
  ) {
    return "AZURE_UNAUTHORIZED";
  }

  if (message.includes("forbidden") || message.includes("permission")) {
    return "AZURE_FORBIDDEN";
  }

  if (status === 400) {
    return "AZURE_BAD_REQUEST";
  }

  return "AZURE_UNKNOWN_ERROR";
}

export function getErrorStatus(error: unknown) {
  if (error instanceof AzureGenerationError) {
    return error.status;
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isInteger(status) ? status : undefined;
  }

  return undefined;
}

export function isTransientAzureFailure(error: unknown) {
  const reason = classifyAzureError(error);
  const status = getErrorStatus(error);

  return (
    reason === "AZURE_RATE_LIMITED" ||
    reason === "AZURE_TIMEOUT" ||
    Boolean(status && status >= 500)
  );
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown Azure generation error.";
}

export function sanitizeAzureDiagnosticMessage(message: string) {
  return message
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return "[invalid-url]";
      }
    })
    .replace(/(api[-_ ]?key\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/(key\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]");
}
