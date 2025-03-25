import express from "express";
import {
  completeTask,
  createTask,
  getTasks,
} from "../controllers/taskController";
import { verifyToken } from "../middleware/verifyToken";

const router = express.Router();

// Get all tasks by authenticated user
router.get("/", verifyToken, getTasks);

// Create a new task by authenticated user
router.post("/", verifyToken, createTask);

// Complete a task by authenticated user
router.patch("/:id/complete", verifyToken, completeTask);

export default router;
