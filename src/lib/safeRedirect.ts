// Only accept same-origin relative paths — reject absolute URLs and
// `//host` (browsers treat a leading double-slash as protocol-relative),
// since this guards values coming straight from a `redirect_url` query param.
export function safeRedirectPath(value: string | string[] | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function withFlash(path: string, message: string): string {
  const url = new URL(path, "http://internal");
  url.searchParams.set("flash", message);
  return `${url.pathname}${url.search}`;
}
