import axiosInstance from "./axiosInstance";
import type { LoginPayload, RegisterPayload } from "@/types/auth";

export const authApi = {
  login: (payload: LoginPayload) => axiosInstance.post("/auth/login", payload),

  register: (payload: RegisterPayload) =>
    axiosInstance.post("/auth/register", payload),

  logout: () => axiosInstance.post("/auth/logout"),

  refreshToken: () => axiosInstance.post("/auth/refresh"),

  getMe: () => axiosInstance.get("/auth/me"),
};
