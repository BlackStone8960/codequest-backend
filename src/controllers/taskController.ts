import { isBefore, parseISO, startOfDay } from "date-fns";
import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middleware/verifyToken";
import Task from "../models/Task";
import User from "../models/User";

// Calculate experience based on difficulty
function calculateExperience(difficulty: "easy" | "medium" | "hard"): number {
  switch (difficulty) {
    case "easy":
      return 5;
    case "medium":
      return 10;
    case "hard":
      return 15;
    default:
      throw new Error("Invalid difficulty");
  }
}

// GET /api/tasks
export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tasks = await Task.find({ creator: req.userId }).sort({
      dueDate: 1, // Sort by due date (ascending)
      createdAt: -1, // Sort by creation date (descending)
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// POST /api/tasks
export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, difficulty, dueDate } = req.body;

  if (!title || !difficulty) {
    res.status(400).json({ error: "Title and difficulty are required" });
    return;
  }

  if (!["easy", "medium", "hard"].includes(difficulty)) {
    res.status(400).json({ error: "Invalid difficulty" });
    return;
  }

  // Check if due date is in the past (using date-fns for timezone-safe comparison)
  if (dueDate) {
    const inputDate = parseISO(dueDate);
    const today = startOfDay(new Date());

    console.log({ inputDate, today });

    if (isBefore(inputDate, today)) {
      res.status(400).json({ error: "Due date cannot be in the past" });
      return;
    }
  }

  try {
    const experience = calculateExperience(difficulty);

    // Create new task (creator is logged in user)
    const newTask = new Task({
      title,
      description,
      difficulty,
      experience,
      creator: req.userId,
      dueDate: dueDate ? parseISO(dueDate) : undefined,
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

    const user = await User.findById(req.userId);

    if (user) {
      if (!user.tasksCompleted.includes(task._id as mongoose.Types.ObjectId)) {
        user.tasksCompleted.push(task._id as mongoose.Types.ObjectId);
      }

      // Add experience to user
      user.currentLevelXP += task.experience;
      user.totalExperience += task.experience;

      // Level up user if they have enough experience
      while (user.currentLevelXP >= getRequiredExp(user.level)) {
        user.currentLevelXP -= getRequiredExp(user.level);
        user.level++;

        user.levelUpXP = getRequiredExp(user.level);
        user.maxHP += 10 + user.level * 2; // Increase max HP by 10 + 2 per level
        user.currentHP = user.maxHP; // Restore HP on level up
      }

      await user.save();
    }

    res.status(200).json({
      message: "Task marked as completed",
      task,
      user,
    });
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ error: "Failed to complete task" });
  }
};

// Get required experience for next level
function getRequiredExp(level: number) {
  return level * 15;
}
