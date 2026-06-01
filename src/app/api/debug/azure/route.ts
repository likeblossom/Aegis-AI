import { NextResponse } from "next/server";
import {
  buildAzureChatCompletionsUrl,
  getAzureApiVersion,
  getAzureEndpointHost,
  getAzureGovernanceModel,
  getAzureOpenAIDeployment,
  isAzureGovernanceConfigured
} from "@/server/governance/azureGovernanceReport";
import {
  AzureGenerationError,
  classifyAzureError,
  getErrorMessage,
  getErrorStatus,
  sanitizeAzureDiagnosticMessage
} from "@/server/governance/classifyAzureError";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Azure debug endpoint is only available in development." },
      { status: 404 }
    );
  }

  const configured = isAzureGovernanceConfigured();
  const baseResponse = {
    configured,
    deployment: getAzureGovernanceModel(),
    apiVersion: getAzureApiVersion(),
    endpointHost: getAzureEndpointHost(),
    errorType: null as string | null,
    errorMessage: null as string | null
  };

  if (!configured) {
    return NextResponse.json({
      ...baseResponse,
      success: false,
      errorType: "AZURE_NOT_CONFIGURED",
      errorMessage: getMissingConfigurationMessage()
    });
  }

  try {
    const response = await fetch(buildAzureChatCompletionsUrl(), {
      method: "POST",
      headers: {
        "api-key": process.env.AZURE_AI_KEY ?? "",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildDebugRequestBody())
    });

    const body = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: unknown } }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message =
        body?.error?.message ?? `Azure debug request failed with ${response.status}.`;
      throw new AzureGenerationError({
        reason: classifyAzureError({ status: response.status, message }),
        message,
        status: response.status
      });
    }

    const content = body?.choices?.[0]?.message?.content;
    const success = typeof content === "string" && content.trim() === "SUCCESS";

    return NextResponse.json({
      ...baseResponse,
      success,
      errorType: success ? null : "AZURE_UNKNOWN_ERROR",
      errorMessage: success
        ? null
        : "Azure responded, but the response content did not match SUCCESS."
    });
  } catch (error) {
    const errorType = classifyAzureError(error);

    return NextResponse.json({
      ...baseResponse,
      success: false,
      errorType,
      errorMessage: buildDebugErrorMessage(error, errorType)
    });
  }
}

function buildDebugRequestBody() {
  return {
    ...(getAzureOpenAIDeployment() ? {} : { model: getAzureGovernanceModel() }),
    messages: [
      {
        role: "user",
        content: "Respond with exactly: SUCCESS"
      }
    ],
    temperature: 0,
    max_tokens: 8
  };
}

function getMissingConfigurationMessage() {
  if (!process.env.AZURE_AI_ENDPOINT || !process.env.AZURE_AI_KEY) {
    return "Set AZURE_AI_ENDPOINT and AZURE_AI_KEY.";
  }

  const endpoint = process.env.AZURE_AI_ENDPOINT.replace(/\/$/, "");

  if (
    endpoint.includes(".openai.azure.com") &&
    !endpoint.endsWith("/chat/completions") &&
    !process.env.AZURE_OPENAI_DEPLOYMENT
  ) {
    return "Set AZURE_OPENAI_DEPLOYMENT for Azure OpenAI endpoints.";
  }

  return "Azure configuration is incomplete.";
}

function buildDebugErrorMessage(error: unknown, errorType: string) {
  const status = getErrorStatus(error);
  const message = sanitizeAzureDiagnosticMessage(getErrorMessage(error));
  const statusPrefix = status ? `HTTP ${status}: ` : "";

  if (errorType === "AZURE_UNAUTHORIZED") {
    return `${statusPrefix}Azure authentication failed. Check AZURE_AI_KEY.`;
  }

  if (errorType === "AZURE_DEPLOYMENT_NOT_FOUND") {
    return `${statusPrefix}Azure deployment was not found. Check AZURE_OPENAI_DEPLOYMENT.`;
  }

  return `${statusPrefix}${message}`;
}
