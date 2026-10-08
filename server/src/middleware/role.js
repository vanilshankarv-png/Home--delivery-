export function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You are not authorized to perform this action." });
    }

    return next();
  };
}

export default authorizeRoles;
