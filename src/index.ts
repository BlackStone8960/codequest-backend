import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import User from "./models/User";
import { userSchema } from "./validators/userValidator";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// Routes
app.get("/", (req, res) => {
  res.send("CodeQuest API is running...");
});

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    // Validate with Zod
    const parsed = userSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { username, email, passwordHash, githubId, avatarUrl } = req.body;

    // Create new user & save to database
    const user = new User({
      username,
      email,
      passwordHash,
      githubId,
      avatarUrl,
    });
    await user.save();

    res.status(201).json(user);
  } catch (error: any) {
    // Handle duplicate key error
    if (error.code === 11000) {
      res.status(409).json({ error: "Username or email already exists" });
      return;
    }

    // Handle other errors
    console.error(error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
