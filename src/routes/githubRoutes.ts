import express from "express";
import {
  getGitHubToken,
  updateUserStreak,
} from "../controllers/githubController";
import { verifyToken } from "../middleware/verifyToken";

const router = express.Router();

// GET /api/github/token - Get GitHub access token for the user
router.get("/token", verifyToken, getGitHubToken);

// POST /api/github/update-streak - Update user's GitHub streak
router.post("/update-streak", verifyToken, updateUserStreak);

export default router;
