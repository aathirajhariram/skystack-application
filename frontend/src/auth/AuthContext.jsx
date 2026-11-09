import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // user = { client_code, client_name, email, display_name, role, permissions, must_change_password }
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setUser(await api.me()); } catch { setUser(null); }
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null));           // session expired / account disabled
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signIn = useCallback(async (email, password) => {
    const result = await api.login(email, password);           // { redirect, must_change_password }
    await refresh();
    return result;
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, refresh }), [user, loading, signIn, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
