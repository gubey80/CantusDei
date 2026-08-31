const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:4710/api";

let authToken = window.localStorage.getItem("cantusdei_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) window.localStorage.setItem("cantusdei_token", authToken);
  else window.localStorage.removeItem("cantusdei_token");
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Error de servidor" }));
    throw new Error(error.errors ? error.errors.join("\n") : error.message || "Error de servidor");
  }
  if (response.status === 204) return null;
  return response.json();
}

export { API_URL };
