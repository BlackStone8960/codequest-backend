import axios from "axios";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/verifyToken";
import User from "../models/User";

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalContributions: number;
  lastCommitDate: string | null;
  commitDates: string[];
}

// Get GitHub access token for the user
export const getGitHubToken = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubAccessToken) {
      return res.status(404).json({ error: "GitHub access token not found" });
    }

    res.status(200).json({ githubToken: user.githubAccessToken });
  } catch (error) {
    console.error("Error getting GitHub token:", error);
    res.status(500).json({ error: "Failed to get GitHub token" });
  }
};

// Calculate streak from GitHub commits
const calculateStreak = (commits: GitHubCommit[]): StreakData => {
  const commitDates = new Set<string>();

  // Collect commit dates
  commits.forEach((commit) => {
    const date = new Date(commit.commit.author.date)
      .toISOString()
      .split("T")[0];
    commitDates.add(date);
  });

  const sortedDates = Array.from(commitDates).sort();
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let lastDate: string | null = null;

  // Process dates in reverse order
  const dates = sortedDates.reverse();

  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i];

    if (i === 0) {
      // First date
      if (currentDate === today || currentDate === yesterday) {
        currentStreak = 1;
        tempStreak = 1;
      }
      lastDate = currentDate;
    } else {
      const prevDate = dates[i - 1];
      const currentDateObj = new Date(currentDate);
      const prevDateObj = new Date(prevDate);
      const diffDays = Math.floor(
        (prevDateObj.getTime() - currentDateObj.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        // Consecutive days
        tempStreak++;
        if (i === 1 && (currentDate === today || currentDate === yesterday)) {
          currentStreak = tempStreak;
        }
      } else {
        // Streak broken
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
      lastDate = currentDate;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    totalContributions: commitDates.size,
    lastCommitDate: lastDate,
    commitDates: Array.from(commitDates),
  };
};

// Update user's GitHub streak
export const updateUserStreak = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.githubId || !user.githubAccessToken) {
      return res.status(400).json({ error: "GitHub account not linked" });
    }

    // Get commit history from GitHub API
    const since = new Date();
    since.setDate(since.getDate() - 365); // Past 1 year

    const response = await axios.get(
      `https://api.github.com/search/commits?q=author:${
        user.githubId
      }+committer-date:>${since.toISOString().split("T")[0]}`,
      {
        headers: {
          Authorization: `token ${user.githubAccessToken}`,
          Accept: "application/vnd.github.cloak-preview",
        },
      }
    );

    const commits: GitHubCommit[] = response.data.items || [];
    const streakData = calculateStreak(commits);

    // Update user's streak information
    user.streak = streakData.currentStreak;
    user.longestStreak = Math.max(
      user.longestStreak || 0,
      streakData.longestStreak
    );
    user.totalContributions = streakData.totalContributions;
    user.lastCommitDate = streakData.lastCommitDate;

    await user.save();

    res.status(200).json(streakData);
  } catch (error: any) {
    console.error("Error updating streak:", error);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "GitHub token expired or invalid" });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({ error: "GitHub API rate limit exceeded" });
    }

    res.status(500).json({ error: "Failed to update streak" });
  }
};
