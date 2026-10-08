import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

export function roleHome(role) {
  if (role === "provider") return "/provider";
  if (role === "admin") return "/admin";
  return "/customer";
}

export default function RoleRoute({ roles }) {
  const { token, user } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!user || !roles.includes(user.role)) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }

  return <Outlet />;
}
