import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { login, register } from "../controllers/authController";

dotenv.config();

const router = express.Router();

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// GET /api/auth/github - Start Github OAuth
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

// GET /api/auth/github/callback - Callback URL for Github OAuth
router.get(
  "/github/callback",
  passport.authenticate("github", { session: false }),
  (req, res) => {
    const user = req.user as any;

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    // Redirect to frontend with JWT
    res.redirect(`http://localhost:3000/auth-callback?token=${token}`);
  }
);

export default router;
