import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash?: string;
  githubId?: string;
  avatarUrl?: string;
  displayName: string;
  totalExperience: number;
  currentHP: number;
  maxHP: number;
  currentLevelXP: number;
  levelUpXP: number;
  rank: number;
  level: number;
  streak: number;
  tasksCompleted: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String },
    githubId: { type: String },
    avatarUrl: { type: String },
    displayName: { type: String, required: true },
    totalExperience: { type: Number, default: 0 },
    currentHP: { type: Number, default: 100 },
    maxHP: { type: Number, default: 100 },
    currentLevelXP: { type: Number, default: 0 },
    levelUpXP: { type: Number, default: 1500 },
    rank: { type: Number, default: 1 },
    level: { type: Number, default: 1 },
    streak: { type: Number, default: 0 },
    tasksCompleted: [{ type: Schema.Types.ObjectId, ref: "Task" }],
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
