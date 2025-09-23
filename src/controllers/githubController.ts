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
    user.streak = streakData.currentStreak;
    user.longestStreak = Math.max(
      user.longestStreak || 0,
      streakData.longestStreak
    );
    user.totalContributions = streakData.totalContributions;
    user.lastCommitDate = streakData.lastCommitDate || undefined;

    await user.save();

    res.status(200).json(streakData);
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
