// Every backend call lives here. The session is an HttpOnly cookie - JavaScript never sees the token.
// Dev: "/api" is proxied to the backend by vite.config.js. Prod: VITE_API_URL=https://api.skystack.global
const API = import.meta.env.VITE_API_URL || "/api";
const BASE = { "X-Requested-With": "skystack" };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(path, { method = "GET", json, form } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      credentials: "include",
      headers: json ? { ...BASE, "Content-Type": "application/json" } : BASE,
      body: json ? JSON.stringify(json) : form,
    });
  } catch {
    const err = new Error("Cannot reach SkyStack right now. Please try again.");
    err.status = 0;
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data.detail === "string" ? data.detail : "request_failed";
    const err = new Error(code);
    err.status = res.status;
    err.code = code;
    err.data = data;                                   // full reply, e.g. the list of validation problems
    if (res.status === 401 && path !== "/auth/login") onUnauthorized();
    throw err;
  }
  return data;
}

export const login = (email, password) => request("/auth/login", { method: "POST", json: { email, password } });
export const me = () => request("/auth/me");
export const logout = () => request("/auth/logout", { method: "POST" });
export const changePassword = (current_password, new_password) =>
  request("/account/password", { method: "POST", json: { current_password, new_password } });

export const adminUnlock = (password) => request("/admin/unlock", { method: "POST", json: { password } });
export const adminLock = () => request("/admin/lock", { method: "POST" });
export const listUsers = () => request("/admin/users");
export const inviteUser = (email, display_name, role) =>
  request("/admin/users", { method: "POST", json: { email, display_name, role } });
export const updateUser = (id, patch) => request(`/admin/users/${id}`, { method: "PATCH", json: patch });
export const resetPassword = (id) => request(`/admin/users/${id}/reset-password`, { method: "POST" });
export const activityLog = () => request("/admin/activity");

export const runs = () => request("/portal/runs");
export const dashboard = () => request("/portal/dashboard");
export const tables = () => request("/portal/tables");
export const uploadFile = (table, file) => {
  const form = new FormData();
  form.append("table", table);
  form.append("file", file);
  return request("/portal/upload", { method: "POST", form });
};

export const features = () => request("/portal/features");
export const entryStatus = (source) => request(`/portal/entry/${encodeURIComponent(source)}/lock`);
export const entryLock = (source) => request(`/portal/entry/${encodeURIComponent(source)}/lock`, { method: "POST", json: {} });
export const entryRelease = (source, force = false) => request(`/portal/entry/${encodeURIComponent(source)}/release?force=${force}`, { method: "POST", json: {} });
export const entryHistory = () => request("/portal/entry-history");

// ---- public (no sign-in) ----
export const publicPlans = () => request("/public/plans");
export const publicIndustries = () => request("/public/industries");
export const subscribe = (payload) => request("/public/subscribe", { method: "POST", json: payload });

// ---- per-employee dashboard visibility (admin) ----
export const getVisibility = (id) => request(`/admin/users/${id}/visibility`);
export const setVisibility = (id, hidden) => request(`/admin/users/${id}/visibility`, { method: "PUT", json: { hidden } });

// table entry: save a table (name + columns), or check the rows by data type and send them as one CSV
export const saveTable = (name, columns) => request("/portal/tables", { method: "POST", json: { name, columns } });
export const sendEntry = (name, columns, rows) => request("/portal/entry", { method: "POST", json: { name, columns, rows } });
