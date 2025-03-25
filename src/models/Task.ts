import mongoose, { Document, Schema } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  experience: number;
  creator: mongoose.Schema.Types.ObjectId;
  completed: boolean;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String },
  experience: { type: Number, required: true },
  creator: { type: Schema.Types.ObjectId, ref: "User", required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Task = mongoose.model<ITask>("Task", taskSchema);

export default Task;
