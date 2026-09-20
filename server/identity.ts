/**
 * Who is asking, according to Authentik. Traefik injects X-authentik-* on the
 * forward-auth routers and blanks them everywhere else, so a present header is
 * Authentik's word, not the browser's.
 */
export interface Identity {
  uid: string;
  username: string;
  email: string;
  name: string;
  groups: string[];
}

export function identityOf(request: Request): Identity | undefined {
  const h = request.headers;
  const uid = h.get("x-authentik-uid")?.trim();
  const username = h.get("x-authentik-username")?.trim();
  if (!uid || !username) return undefined;
  return {
    uid,
    username,
    email: h.get("x-authentik-email")?.trim() ?? "",
    name: h.get("x-authentik-name")?.trim() || username,
    groups: (h.get("x-authentik-groups") ?? "")
      .split("|")
      .map((g) => g.trim())
      .filter(Boolean),
  };
}
