import { z } from "zod";

export const authSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters long."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .regex(/[a-zA-Z]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const taskSchema = z.object({
  title: z.string().trim().min(3, "Task title must be at least 3 characters long."),
  description: z.string().trim().max(500).optional().default(""),
  status: z.enum(["todo", "in-progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z
    .string()
    .trim()
    .min(1)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});

export const taskUpdateSchema = taskSchema.partial();

export type AuthInput = z.infer<typeof authSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;