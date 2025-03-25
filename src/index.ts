import cors from "cors";
import dotenv from "dotenv";
import express, { Response } from "express";
import mongoose from "mongoose";
import morgan from "morgan";
import { AuthenticatedRequest, verifyToken } from "./middleware/verifyToken";
import authRoutes from "./routes/authRoutes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.use("/api/auth", authRoutes);

// Routes
app.get("/", (req, res) => {
  res.send("CodeQuest API is running...");
});

app.get(
  "/api/profile",
  verifyToken,
  (req: AuthenticatedRequest, res: Response) => {
    res.json({ message: "You are authenticated!", userId: req.userId });
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
