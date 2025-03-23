import { z } from "zod";

export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.string().email("Invalid email address"),
  passwordHash: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .optional(),
  githubId: z.string().optional(),
  avatarUrl: z.string().url("Invalid avatar URL").optional(),
});
