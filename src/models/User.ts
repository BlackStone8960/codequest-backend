import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash?: string;
  githubId?: string;
  avatarUrl?: string;
  experience: number;
  level: number;
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
    experience: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    tasksCompleted: [{ type: Schema.Types.ObjectId, ref: "Task" }],
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
