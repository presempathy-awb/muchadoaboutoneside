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

/**
 * Where a module's identity-aware routes answer. Traefik runs Authentik
 * forward-auth only on `/crew*`, and blanks X-authentik-* everywhere else, so
 * a route that needs to know who is asking must also live under `/crew`. The
 * `/api/modules/<name>` copy stays for the public page, where it always sees
 * nobody: that is what tells the page to offer the sign-in link.
 */
export function identityBases(name: string) {
  return [`/api/modules/${name}`, `/crew/api/${name}`] as const;
}
