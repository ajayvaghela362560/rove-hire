type Level = "debug" | "info" | "warn" | "error";

type Fields = Record<string, unknown>;

/**
 * Minimal structured logger. Emits one JSON line per event to stdout/stderr so
 * Vercel log drains stay parseable. Deliberately dependency-free.
 */
function emit(level: Level, message: string, fields?: Fields) {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) =>
    process.env.NODE_ENV !== "production" && emit("debug", message, fields),
  info: (message: string, fields?: Fields) => emit("info", message, fields),
  warn: (message: string, fields?: Fields) => emit("warn", message, fields),
  error: (message: string, fields?: Fields) => emit("error", message, fields),
};
