import axios from "axios";
import * as crypto from "crypto";
import { Request, Response } from "express";
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

// GET /api/github/status - Check if the user's GitHub account is connected
export const getGitHubStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const connected = !!(user.githubId && user.githubAccessToken);
    return res.status(200).json({ connected });
  } catch (error) {
    console.error("Error getting GitHub status:", error);
    res.status(500).json({ error: "Failed to get GitHub status" });
  }
};

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
  // --- Normalize commit dates to UTC "YYYY-MM-DD" and dedupe ---
  const datesSet = new Set<string>();
  for (const c of commits) {
    const day = new Date(c.commit.author.date).toISOString().slice(0, 10); // UTC day
    datesSet.add(day);
  }

  const daysAsc = [...datesSet].sort(); // ascending "YYYY-MM-DD"
  const lastCommitDate = daysAsc.length ? daysAsc[daysAsc.length - 1] : null;

  // --- Today/Yesterday in UTC to match normalization above ---
  const todayUTC = new Date().toISOString().slice(0, 10);
  const yesterdayUTC = addDaysUTC(todayUTC, -1);

  // --- 1) longestStreak over *all* history ---
  let longest = 0;
  let run = 0;
  for (let i = 0; i < daysAsc.length; i++) {
    if (i === 0) {
      run = 1;
    } else {
      // If consecutive (prev -> curr = +1 day), extend the run; otherwise reset
      const d = diffDaysUTC(daysAsc[i - 1], daysAsc[i]); // expected 1 for consecutive
      run = d === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
  }

  // --- 2) currentStreak starting from today or from yesterday ---
  let current = 0;
  let anchor: string | null = null;
  if (datesSet.has(todayUTC)) anchor = todayUTC;
  else if (datesSet.has(yesterdayUTC)) anchor = yesterdayUTC; // allow yesterday as active
  // If you want "today only", delete the 'else if' line above.

  if (anchor) {
    current = 1; // anchor day counts as 1
    // Walk backwards while consecutive days exist in the set
    while (true) {
      const prev = addDaysUTC(anchor, -1);
      if (datesSet.has(prev)) {
        current++;
        anchor = prev;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    totalContributions: datesSet.size,
    lastCommitDate,
    commitDates: [...datesSet],
  };
};

/** Add days to a UTC date string "YYYY-MM-DD", return "YYYY-MM-DD" in UTC. */
function addDaysUTC(yyyyMMdd: string, delta: number): string {
  // Force UTC midnight to avoid TZ/DST issues
  const d = new Date(yyyyMMdd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Difference in whole days between two UTC date strings (b - a). */
function diffDaysUTC(aYYYYMMDD: string, bYYYYMMDD: string): number {
  const a = new Date(aYYYYMMDD + "T00:00:00Z").getTime();
  const b = new Date(bYYYYMMDD + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

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

    console.log(
      `Fetching commits for user: ${user.username}, GitHub ID: ${user.githubId}`
    );
    let allCommits: GitHubCommit[] = [];

    // Try the search/commits approach first (works for public repos)
    try {
      const since = new Date();
      since.setDate(since.getDate() - 365); // Past 1 year

      const searchResponse = await axios.get(
        `https://api.github.com/search/commits?q=author:${
          user.username
        }+committer-date:>${since.toISOString().split("T")[0]}`,
        {
          headers: {
            Authorization: `Bearer ${user.githubAccessToken}`,
            Accept: "application/vnd.github.cloak-preview",
          },
        }
      );

      allCommits = searchResponse.data.items || [];
      console.log(`Found ${allCommits.length} commits via search API`);
      if (allCommits.length > 0) {
        console.log(
          `First commit author: ${allCommits[0].commit.author.name}, date: ${allCommits[0].commit.author.date}`
        );
      }
    } catch (searchError: any) {
      console.warn(
        "Search API failed, trying repository approach:",
        searchError.message
      );

      // Fallback to repository-based approach
      try {
        const reposResponse = await axios.get(
          `https://api.github.com/user/repos?per_page=100&sort=updated&type=public`,
          {
            headers: {
              Authorization: `Bearer ${user.githubAccessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        const repos = reposResponse.data;

        // Get commits from each repository
        for (const repo of repos.slice(0, 10)) {
          try {
            const since = new Date();
            since.setDate(since.getDate() - 365);

            const commitsResponse = await axios.get(
              `https://api.github.com/repos/${repo.full_name}/commits?author=${
                user.username
              }&since=${since.toISOString()}&per_page=100`,
              {
                headers: {
                  Authorization: `Bearer ${user.githubAccessToken}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );

            allCommits = allCommits.concat(commitsResponse.data);
          } catch (repoError: any) {
            console.warn(
              `Failed to fetch commits from ${repo.full_name}:`,
              repoError.message
            );
          }
        }
      } catch (repoError: any) {
        console.error("Repository approach also failed:", repoError.message);
      }
    }

    const streakData = calculateStreak(allCommits);

    // Update user's streak information
    const todayUTC = new Date().toISOString().slice(0, 10);
    const yesterdayUTC = addDaysUTC(todayUTC, -1);
    const taskStreakActive =
      user.lastCommitDate === todayUTC ||
      user.lastCommitDate === yesterdayUTC;

    if (streakData.currentStreak > 0) {
      // GitHub activity is recent — use GitHub-calculated streak
      user.streak = streakData.currentStreak;
      user.lastCommitDate = streakData.lastCommitDate || undefined;
    } else if (!taskStreakActive) {
      // No GitHub activity and no recent task activity — reset streak
      user.streak = 0;
    }
    // else: no GitHub activity but task activity is still within the streak window — keep existing streak

    user.longestStreak = Math.max(
      user.longestStreak || 0,
      streakData.longestStreak,
      user.streak
    );
    user.totalContributions = streakData.totalContributions;

    await user.save();

    res.status(200).json({
      ...streakData,
      currentStreak: user.streak,
      longestStreak: user.longestStreak,
    });
  } catch (error: any) {
    console.error("Error updating streak:", error);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "GitHub token expired or invalid" });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({
        error: "GitHub API rate limit exceeded or insufficient permissions",
      });
    }

    res.status(500).json({ error: "Failed to update streak" });
  }
};

// Get GitHub commits for calendar display
export const getGitHubCommits = async (
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

    console.log(
      `Fetching commits for calendar - user: ${user.username}, GitHub ID: ${user.githubId}`
    );
    let allCommits: any[] = [];

    // Try the search/commits approach first (works for public repos)
    try {
      const since = new Date();
      since.setDate(since.getDate() - 365);

      const searchResponse = await axios.get(
        `https://api.github.com/search/commits?q=author:${
          user.username
        }+committer-date:>${since.toISOString().split("T")[0]}`,
        {
          headers: {
            Authorization: `Bearer ${user.githubAccessToken}`,
            Accept: "application/vnd.github.cloak-preview",
          },
        }
      );

      allCommits = searchResponse.data.items || [];
      console.log(
        `Found ${allCommits.length} commits via search API for calendar`
      );
      if (allCommits.length > 0) {
        console.log(
          `First commit author: ${allCommits[0].commit.author.name}, date: ${allCommits[0].commit.author.date}`
        );
      }
    } catch (searchError: any) {
      console.warn(
        "Search API failed for calendar, trying repository approach:",
        searchError.message
      );

      // Fallback to repository-based approach
      try {
        const reposResponse = await axios.get(
          `https://api.github.com/user/repos?per_page=100&sort=updated&type=public`,
          {
            headers: {
              Authorization: `Bearer ${user.githubAccessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        const repos = reposResponse.data;

        // Get commits from each repository
        for (const repo of repos.slice(0, 10)) {
          try {
            const since = new Date();
            since.setDate(since.getDate() - 365);

            const commitsResponse = await axios.get(
              `https://api.github.com/repos/${repo.full_name}/commits?author=${
                user.username
              }&since=${since.toISOString()}&per_page=100`,
              {
                headers: {
                  Authorization: `Bearer ${user.githubAccessToken}`,
                  Accept: "application/vnd.github.v3+json",
                },
              }
            );

            allCommits = allCommits.concat(commitsResponse.data);
          } catch (repoError: any) {
            console.warn(
              `Failed to fetch commits from ${repo.full_name}:`,
              repoError.message
            );
          }
        }
      } catch (repoError: any) {
        console.error(
          "Repository approach also failed for calendar:",
          repoError.message
        );
      }
    }

    // Format commits for calendar display
    const formattedCommits = allCommits.map((commit) => ({
      sha: commit.sha,
      date: commit.commit.author.date,
      message: commit.commit.message,
      url: commit.html_url,
      repository: commit.repository?.full_name || "Unknown",
      author: {
        name: commit.commit.author.name,
        email: commit.commit.author.email,
      },
    }));

    res.status(200).json({ commits: formattedCommits });
  } catch (error: any) {
    console.error("Error fetching GitHub commits:", error);

    if (error.response?.status === 401) {
      return res.status(401).json({ error: "GitHub token expired or invalid" });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({
        error: "GitHub API rate limit exceeded or insufficient permissions",
      });
    }

    res.status(500).json({ error: "Failed to fetch GitHub commits" });
  }
};

const XP_PER_PUSH = 10;
const MAX_STORED_DELIVERIES = 100;

// Handle GitHub webhook events
export const handleWebhook = async (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("GITHUB_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // Verify signature
  const signature = req.headers["x-hub-signature-256"] as string;
  if (!signature) {
    return res.status(401).json({ error: "Missing signature" });
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(req.body);
  const digest = `sha256=${hmac.digest("hex")}`;

  let signatureValid = false;
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch {
    // Buffer length mismatch means invalid
  }

  if (!signatureValid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Only handle push events
  const event = req.headers["x-github-event"] as string;
  if (event !== "push") {
    return res.status(200).json({ message: "Event ignored" });
  }

  const deliveryId = req.headers["x-github-delivery"] as string;
  const payload = JSON.parse(req.body.toString());

  // Find user by GitHub ID (sender.id is the GitHub user ID)
  const githubUserId = payload.sender?.id?.toString();
  if (!githubUserId) {
    return res.status(200).json({ message: "No sender info" });
  }

  const user = await User.findOne({ githubId: githubUserId });
  if (!user) {
    return res.status(200).json({ message: "User not found" });
  }

  // Prevent duplicate processing
  if (deliveryId && user.processedDeliveries.includes(deliveryId)) {
    return res.status(200).json({ message: "Already processed" });
  }

  // Award XP
  user.totalExperience += XP_PER_PUSH;
  user.currentLevelXP += XP_PER_PUSH;
  while (user.currentLevelXP >= user.levelUpXP) {
    user.currentLevelXP -= user.levelUpXP;
    user.level += 1;
  }

  // Update streak
  const todayUTC = new Date().toISOString().slice(0, 10);
  const yesterdayUTC = addDaysUTC(todayUTC, -1);

  if (user.lastCommitDate === todayUTC) {
    // Already counted today — streak unchanged
  } else if (user.lastCommitDate === yesterdayUTC) {
    user.streak += 1;
  } else {
    user.streak = 1;
  }
  user.lastCommitDate = todayUTC;
  user.longestStreak = Math.max(user.longestStreak || 0, user.streak);

  // Record delivery ID (keep last N)
  if (deliveryId) {
    user.processedDeliveries.push(deliveryId);
    if (user.processedDeliveries.length > MAX_STORED_DELIVERIES) {
      user.processedDeliveries = user.processedDeliveries.slice(
        -MAX_STORED_DELIVERIES
      );
    }
  }

  await user.save();

  console.log(
    `Webhook processed for user ${user.username}: +${XP_PER_PUSH} XP, streak=${user.streak}`
  );

  return res.status(200).json({
    message: "OK",
    xpAwarded: XP_PER_PUSH,
    streak: user.streak,
  });
};
