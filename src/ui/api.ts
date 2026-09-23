export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const options: RequestInit = {
    method,
    headers: {
      "X-Changemap-Request": "1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`);
  return data as T;
}
