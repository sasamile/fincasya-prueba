/** Mensaje legible desde respuestas JSON de fetch (Nest, Convex, Next API routes). */
export function parseFetchApiError(
  body: unknown,
  status: number,
  fallback: string,
): string {
  if (!body || typeof body !== "object") return fallback;
  const data = body as {
    error?: string;
    message?: string;
    statusCode?: number;
  };

  if (status === 404 || data.error === "Not Found") {
    return "El asistente no está disponible en este entorno. Si acabas de desplegar, confirma las rutas /api/web-chat y las variables CONVEX_SITE_URL y CONVEX_ADMIN_API_KEY.";
  }

  if (typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }
  return fallback;
}

export function getErrorMessage(error: any): string {
  if (!error) return "Ocurrió un error inesperado";

  let message = "Ocurrió un error inesperado";

  // Axios error with response
  if (error.response?.data) {
    const data = error.response.data;

    // NestJS often returns message as an array of strings or a single string
    if (Array.isArray(data.message)) {
      message = data.message[0];
    } else if (typeof data.message === "string") {
      message = data.message;
    } else if (typeof data.error === "string") {
      message = data.error;
    }
  } else if (error instanceof Error) {
    // Generic Error object
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  // --- Sanitization Logic ---

  // 1. Remove [Request ID: ...] or similar technical prefixes
  message = message.replace(/\[Request ID:.*?\]\s*/gi, "");

  // 2. Remove common technical prefixes from Convex/NestJS
  message = message.replace(/^Uncaught Error:\s*/gi, "");
  message = message.replace(/^Server Error:\s*/gi, "");

  // 3. Detect and strip stack traces (anything starting with "at " or containing file paths)
  if (message.includes("\n") || message.includes(" at ")) {
    message = message.split(/(\n|\bat\b)/)[0];
  }

  // 4. Final Cleanup: Trim and ensure it doesn't end with technical noise
  message = message.trim();

  // 5. Hard Limit: If it's still too long, it's probably technical vomit
  if (message.length > 200) {
    return "Error en el servidor. Por favor, intente de nuevo más tarde.";
  }

  return message || "Ocurrió un error inesperado";
}
