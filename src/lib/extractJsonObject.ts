export type JsonExtractionResult =
  | {
      success: true;
      value: unknown;
      jsonText: string;
    }
  | {
      success: false;
      error: string;
    };

export function extractJsonObject(input: string): JsonExtractionResult {
  const direct = parseJson(input);

  if (direct.success) {
    return direct;
  }

  for (let start = input.indexOf("{"); start !== -1; start = input.indexOf("{", start + 1)) {
    const candidate = findJsonObjectCandidate(input, start);

    if (!candidate) {
      continue;
    }

    const parsed = parseJson(candidate);

    if (parsed.success) {
      return parsed;
    }
  }

  return {
    success: false,
    error: "No valid JSON object could be extracted from the response."
  };
}

function parseJson(value: string): JsonExtractionResult {
  try {
    return {
      success: true,
      value: JSON.parse(value),
      jsonText: value
    };
  } catch {
    return {
      success: false,
      error: "Input is not valid JSON."
    };
  }
}

function findJsonObjectCandidate(input: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < input.length; index += 1) {
    const char = input[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return input.slice(start, index + 1);
      }
    }
  }

  return null;
}
