import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function getUserId(req) {
  return req.user.id || req.user.sub;
}

function publicUser(user) {
  const result = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete result.passwordHash;
  delete result.isBlocked;
  return result;
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    { sub: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function createAuthController(User) {
  return {
    register: async (req, res, next) => {
      try {
        const email = req.body.email.toLowerCase();
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const passwordHash = await bcrypt.hash(req.body.password, 12);
        const user = await new User({
          name: req.body.name,
          email,
          phone: req.body.phone,
          passwordHash,
          role: req.body.role || "customer"
        }).save();

        return res.status(201).json({
          success: true,
          user: publicUser(user),
          token: createToken(user)
        });
      } catch (error) {
        return next(error);
      }
    },

    login: async (req, res, next) => {
      try {
        const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+passwordHash");
        const passwordMatches = user && await bcrypt.compare(req.body.password, user.passwordHash);

        if (!passwordMatches || user.isBlocked) {
          return res.status(401).json({ success: false, message: "Email or password is incorrect." });
        }

        return res.json({ success: true, user: publicUser(user), token: createToken(user) });
      } catch (error) {
        return next(error);
      }
    },

    me: async (req, res, next) => {
      try {
        const user = await User.findById(getUserId(req));
        if (!user || user.isBlocked) {
          return res.status(401).json({ success: false, message: "Your account is not available." });
        }
        return res.json({ success: true, user: publicUser(user) });
      } catch (error) {
        return next(error);
      }
    },

    changePassword: async (req, res, next) => {
      try {
        const user = await User.findById(getUserId(req)).select("+passwordHash");
        if (!user || user.isBlocked) {
          return res.status(401).json({ success: false, message: "Your account is not available." });
        }
        const passwordMatches = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
        if (!passwordMatches) {
          return res.status(400).json({ success: false, message: "Current password is incorrect." });
        }

        user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
        await user.save();
        return res.json({ success: true, message: "Password updated successfully." });
      } catch (error) {
        return next(error);
      }
    }
  };
}
