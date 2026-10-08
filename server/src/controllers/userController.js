function publicUser(user) {
  const result = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete result.passwordHash;
  delete result.isBlocked;
  return result;
}

export function createUserController(User) {
  return {
    updateProfile: async (req, res, next) => {
      try {
        if (req.user.role !== "provider" && req.body.isAvailable !== undefined) {
          return res.status(403).json({ success: false, message: "Availability can only be changed by providers." });
        }

        const user = await User.findByIdAndUpdate(
          req.user.id || req.user.sub,
          { $set: req.body },
          { new: true, runValidators: true }
        );
        if (!user || user.isBlocked) {
          return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.json({ success: true, user: publicUser(user) });
      } catch (error) {
        return next(error);
      }
    }
  };
}
