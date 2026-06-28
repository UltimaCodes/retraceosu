const AUTHORIZE_URL = "https://osu.ppy.sh/oauth/authorize";
const TOKEN_URL = "https://osu.ppy.sh/oauth/token";
const SCOPES = "identify public";

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

function osuEnv() {
  const clientId = process.env.OSU_CLIENT_ID;
  const clientSecret = process.env.OSU_CLIENT_SECRET;
  const redirectUri =
    process.env.OSU_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback";
  if (!clientId || !clientSecret) {
    throw new Error("Missing OSU_CLIENT_ID / OSU_CLIENT_SECRET");
  }
  return { clientId, clientSecret, redirectUri };
}

export function authorizeUrl(state: string): string {
  const { clientId, redirectUri } = osuEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = osuEnv();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
