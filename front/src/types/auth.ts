import { z } from "zod";
export const loginSchema = z.object({
  email: z.string().email("Email không tôn tại"),
  password: z.string().min(1, "Vui Lông nhập mật khẩu"),
});

export type LoginformValues = z.infer<typeof loginSchema>;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  fullname?: string | null;
}

export interface LoginReponseData {
  accessToken: string;
  account: AuthUser;
}

export interface MeResponseData {
  id: string;
  email: string;
  roles: string[];
  fullName: string | null;
}
