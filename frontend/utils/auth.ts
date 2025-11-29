// --------------------------------------
// Decode JWT safely
// --------------------------------------
function decodeToken(token: string) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

// --------------------------------------
// SAVE AUTH (after login)
// --------------------------------------
export function saveAuth(token: string) {
  if (typeof window === "undefined") return null;

  localStorage.setItem("token", token);

  const payload = decodeToken(token);
  if (!payload) return null;

  const authData = {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    exp: payload.exp,
    token,
  };

  return authData;
}

// --------------------------------------
// LOAD AUTH (on app start)
// --------------------------------------
export function getAuth() {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("token");
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    exp: payload.exp,
    token,
  };
}

// --------------------------------------
// CLEAR AUTH (logout)
// --------------------------------------
export function clearAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}

// --------------------------------------
// TOKEN EXPIRATION CHECK
// --------------------------------------
export function isTokenExpired(exp: number) {
  return Date.now() >= exp * 1000;
}
