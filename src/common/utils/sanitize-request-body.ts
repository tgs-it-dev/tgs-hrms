// utils/sanitize-request.util.ts
export function sanitizeRequestBody(body: object) {
  if (!body || typeof body !== "object") return body;

  const clone = { ...body };
  const sensitiveKeys = ["password", "token"];

  for (const key of Object.keys(clone)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      clone[key] = "***REDACTED***";
    }
  }

  return clone;
}
