import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

// Wraps the real client portal route. A signed-in client can only ever open their own page.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { clientCode } = useParams();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.client_code !== clientCode) return <Navigate to={`/portal/${user.client_code}`} replace />;
  return children;
}
