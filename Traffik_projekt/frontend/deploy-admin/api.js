const BASE_URL = "https://trafik-q8va.onrender.com";

// En återanvändbar funktion för att göra API-anrop med access_token automatiskt inkluderad
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) throw new Error(data?.error || "Fel vid API-anrop");

  return data;
}
