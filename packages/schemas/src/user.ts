import { z } from "zod";

export const signupSchema = z.object({
  username: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).optional(),
});

export const signinSchema = z.object({
  username: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
});

export type Signup = z.infer<typeof signupSchema>;
export type Signin = z.infer<typeof signinSchema>;
