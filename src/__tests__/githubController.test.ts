import axios from "axios";
import { updateUserStreak } from "../controllers/githubController";

// Mock axios and the User model
jest.mock("axios");
jest.mock("../models/User");

const mockedAxios = axios as jest.Mocked<typeof axios>;

import User from "../models/User";
const MockedUser = User as jest.Mocked<typeof User>;

// Helper: build a fake commit with the given UTC date string "YYYY-MM-DD"
function makeCommit(dateStr: string) {
  return {
    sha: `sha-${dateStr}`,
    commit: { author: { name: "test", email: "test@test.com", date: `${dateStr}T12:00:00Z` }, message: "test" },
    html_url: "https://github.com",
  };
}

// Helper: UTC "YYYY-MM-DD" for today / N days ago
function utcDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Build a minimal mock user
function makeUser(overrides: Partial<{
  streak: number;
  longestStreak: number;
  lastCommitDate: string | undefined;
  totalContributions: number;
}> = {}) {
  return {
    githubId: "gh-123",
    githubAccessToken: "token-abc",
    username: "testuser",
    streak: 0,
    longestStreak: 0,
    lastCommitDate: undefined as string | undefined,
    totalContributions: 0,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeReq(userId = "user-1") {
  return { userId } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── calculateStreak (via updateUserStreak with mocked GitHub responses) ─────

describe("streak reset behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resets streak to 0 when GitHub returns no commits and there is no recent task activity", async () => {
    const user = makeUser({ streak: 5, longestStreak: 5, lastCommitDate: utcDate(-5) });
    (MockedUser.findById as jest.Mock).mockResolvedValue(user);
    mockedAxios.get.mockResolvedValue({ data: { items: [] } });

    await updateUserStreak(makeReq(), makeRes());

    expect(user.streak).toBe(0);
    expect(user.save).toHaveBeenCalled();
  });

  it("resets streak to 0 when the last GitHub commit was several days ago and no task activity", async () => {
    const user = makeUser({ streak: 3, longestStreak: 3, lastCommitDate: utcDate(-3) });
    (MockedUser.findById as jest.Mock).mockResolvedValue(user);

    // GitHub returns one commit from 3 days ago — currentStreak will be 0
    mockedAxios.get.mockResolvedValue({
      data: { items: [makeCommit(utcDate(-3))] },
    });

    await updateUserStreak(makeReq(), makeRes());

    expect(user.streak).toBe(0);
  });

  it("keeps streak when there is no GitHub activity but task activity was today", async () => {
    const user = makeUser({ streak: 4, longestStreak: 4, lastCommitDate: utcDate(0) });
    (MockedUser.findById as jest.Mock).mockResolvedValue(user);
    mockedAxios.get.mockResolvedValue({ data: { items: [] } });

    await updateUserStreak(makeReq(), makeRes());

    expect(user.streak).toBe(4);
  });

  it("keeps streak when there is no GitHub activity but task activity was yesterday", async () => {
    const user = makeUser({ streak: 2, longestStreak: 2, lastCommitDate: utcDate(-1) });
    (MockedUser.findById as jest.Mock).mockResolvedValue(user);
    mockedAxios.get.mockResolvedValue({ data: { items: [] } });

    await updateUserStreak(makeReq(), makeRes());

    expect(user.streak).toBe(2);
  });

  it("sets streak from GitHub commits when there is recent activity", async () => {
    const user = makeUser({ streak: 1, longestStreak: 1, lastCommitDate: utcDate(-1) });
    (MockedUser.findById as jest.Mock).mockResolvedValue(user);

    // 3 consecutive days ending today
    mockedAxios.get.mockResolvedValue({
      data: {
        items: [
          makeCommit(utcDate(0)),
          makeCommit(utcDate(-1)),
          makeCommit(utcDate(-2)),
        ],
      },
    });

    await updateUserStreak(makeReq(), makeRes());

    expect(user.streak).toBe(3);
  });
});
