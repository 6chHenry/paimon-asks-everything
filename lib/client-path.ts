export function clientPath(path: string) {
  if (typeof window === "undefined" || !path.startsWith("/")) return path;
  const match = window.location.pathname.match(/^(.*\/proxy\/\d+)(?:\/.*)?$/u);
  return match?.[1] ? `${match[1]}${path}` : path;
}
