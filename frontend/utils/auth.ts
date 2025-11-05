// Real JWT Authentication Utilities (Connected to FastAPI Backend)
import axios from "axios";


export interface User {
    id: string;
    email: string;
    name: string;
    createdAt?: string;
}

export interface AuthToken {
    token: string;
    expiresAt: number;
}

// Base API URL — replace with your deployed backend or localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1/auth";

/**
 * Decode a JWT token (without verification)
 */
function decodeToken(token: string): { exp: number;[key: string]: any } | null {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

/**
 * Save auth info in localStorage
 */
function storeAuth(token: string, user: User) {
    const decoded = decodeToken(token);
    const expiresAt = decoded?.exp ? decoded.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("access_token", token);
    localStorage.setItem("user", JSON.stringify(user));
    return { token, expiresAt };
}

/**
 * Login user via backend
 */
export async function login(email: string, password: string): Promise<{ user: User; token: AuthToken }> {
    const formData = new URLSearchParams();
    formData.append("username", email); // FastAPI expects 'username'
    formData.append("password", password);

    const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Login failed");
    }

    const data = await response.json();
    const { access_token, user } = data;
    const tokenData = storeAuth(access_token, user);

    return { user, token: { token: access_token, expiresAt: tokenData.expiresAt } };
}

/**
 * Register new user via backend
 */
export async function register(email: string, password: string, name: string): Promise<{ user: User; token: AuthToken }> {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
    }

    const data = await response.json();
    const { access_token, user } = data;
    const tokenData = storeAuth(access_token, user);

    return { user, token: { token: access_token, expiresAt: tokenData.expiresAt } };


}

export async function registerAndRedirect(
    formData: {
        first_name: string;
        last_name: string;
        email: string;
        password: string;
        contact_number?: string;
        address?: string;
        age?: number;
        gender?: string;
    }
) {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed");
    }

    const data = await response.json();

    // ✅ Store token and user
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // ✅ Return message for toast
    return data.message || "🎉 Registration successful!";
}

/**
 * Logout user
 */
export function logout(): void {
    localStorage.removeItem("access_token");
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
export const isAuthenticated = async (): Promise<boolean> => {
    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
        // Decode the token (assumes JWT)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        if (isExpired) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return false;
        }

        // Optionally, you can also ping your backend to confirm it's valid:
        const response = await fetch("http://127.0.0.1:8000/api/v1/auth/", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Invalid token");
        return true;
    } catch (err) {
        console.error("Invalid or expired token:", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return false;
    }

};

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });

    if (!response.ok) {
        throw new Error("Failed to send password reset request");
    }
}


