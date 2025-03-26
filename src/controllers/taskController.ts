import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/verifyToken";
import Task from "../models/Task";
import User from "../models/User";

// GET /api/tasks
export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasks = await Task.find({ creator: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// POST /api/tasks
export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, difficulty } = req.body;

  if (!title || difficulty === undefined) {
    res.status(400).json({ error: "Title and difficulty are required" });
    return;
  }

  // Determine experience based on difficulty
  let experience = 0;
  switch (difficulty) {
    case "easy":
      experience = 5;
      break;
    case "medium":
      experience = 10;
      break;
    case "hard":
      experience = 15;
      break;
    default:
      res.status(400).json({ error: "Invalid difficulty" });
      return;
  }

  try {
    // Create new task (creator is logged in user)
    const newTask = new Task({
      title,
      description,
      experience,
      creator: req.userId,
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
};

// PATCH /api/tasks/:id/complete
export const completeTask = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  // Get task ID from URL
  const taskId = req.params.id;

  try {
    // Find task created by logged in user
    const task = await Task.findOne({ _id: taskId, creator: req.userId });

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Prevent completing task more than once
    if (task.completed) {
      res.status(400).json({ error: "Task already completed" });
      return;
    }

    // Mark task as completed
    task.completed = true;

    await task.save();

    // Update user's experience
    const user = await User.findById(req.userId);

    if (user) {
      user.experience += task.experience;
      await user.save();
    }

    res.status(200).json({ message: "Task marked as completed", task });
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ error: "Failed to complete task" });
  }
};
