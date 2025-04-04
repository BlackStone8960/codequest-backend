import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { userSchema } from "../validators/userValidator";

export const register = async (req: Request, res: Response) => {
  // Validate with Zod
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { username, email, passwordHash, githubId, avatarUrl, displayName } =
    req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });
    if (userExists) {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }

    // Hash password
    const hashedPassword = passwordHash
      ? await bcrypt.hash(passwordHash, 10)
      : undefined;

    // Create new user
    const newUser = new User({
      username,
      email,
      passwordHash: hashedPassword,
      githubId,
      avatarUrl,
      displayName,
      currentHP: 100,
      maxHP: 100,
      currentLevelXP: 0,
      levelUpXP: 1500,
      rank: 1,
    });

    // Save user to database
    await newUser.save();

    // Generate JWT
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.status(201).json({ user: newUser, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  // Validate input
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  try {
    // Find user in database
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.status(200).json({ user, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
