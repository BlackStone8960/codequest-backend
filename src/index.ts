import cors from "cors";
import dotenv from "dotenv";
import express, { Response } from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import passport from "passport";
import "./config/passport";
import { AuthenticatedRequest, verifyToken } from "./middleware/verifyToken";
import User from "./models/User";
import authRoutes from "./routes/authRoutes";
import githubRoutes from "./routes/githubRoutes";
import taskRoutes from "./routes/taskRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());
app.use(passport.initialize());
app.use(morgan("dev"));
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/github", githubRoutes);

// Routes
app.get("/", (req, res) => {
  res.send("CodeQuest API is running...");
});

app.get(
  "/api/profile",
  verifyToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await User.findById(req.userId);
      res.status(200).json({ user });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  }
);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(err));

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
