import express from "express";
import {
  getGitHubCommits,
  getGitHubToken,
  updateUserStreak,
} from "../controllers/githubController";
import { verifyToken } from "../middleware/verifyToken";

const router = express.Router();

// GET /api/github/token - Get GitHub access token for the user
router.get("/token", verifyToken, getGitHubToken as express.RequestHandler);

// POST /api/github/update-streak - Update user's GitHub streak
router.post("/update-streak", verifyToken, updateUserStreak as unknown as express.RequestHandler);

// GET /api/github/commits - Get GitHub commits for calendar display
router.get("/commits", verifyToken, getGitHubCommits as unknown as express.RequestHandler);

export default router;
