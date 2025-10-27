// src/utils/auth.ts
export interface User {
    id: string;
    email: string;
    name: string;
    createdAt: string;
}

export interface AuthToken {
    token: string;
    expiresAt: number;
}

const API_BASE_URL = "http://localhost:8000/api/auth";
// 🔁 Replace with your real backend URL

/**
 * Login with email and password
 */
export async function login(
    email: string,
    password: string
): Promise<{ user: User; token: AuthToken }> {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
    }

    const data = await response.json();

    localStorage.setItem("auth_token", data.token.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return data;
}

/**
 * Register a new user
 */
export async function register(
    email: string,
    password: string,
    name: string
): Promise<{ user: User; token: AuthToken }> {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
    }

    const data = await response.json();

    localStorage.setItem("auth_token", data.token.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    return data;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
    const token = localStorage.getItem("auth_token");
    await fetch(`${API_BASE_URL}/logout`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
}

/**
 * Get current user from localStorage
 */
export function getCurrentUser(): User | null {
    const userJson = localStorage.getItem("user");
    if (!userJson) return null;
    try {
        return JSON.parse(userJson);
    } catch {
        return null;
    }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = localStorage.getItem("auth_token");
    if (!token) return false;

    const response = await fetch(`${API_BASE_URL}/verify`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        logout();
        return false;
    }

    const data = await response.json();
    return data.valid === true;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
    await fetch(`${API_BASE_URL}/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
}
