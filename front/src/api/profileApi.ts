import axiosInstance from "./axiosInstance";

import type { Employee } from "../types/employee";
import type { NextShift } from "../types/shift";
import type { ChangePasswordPayload, UpdateProfilePayload } from "../types/profile";
import type { ApiResponse } from "./api";

export const profileApi = {
  async getProfile(): Promise<Employee> {
    const { data } =
      await axiosInstance.get<ApiResponse<Employee>>("/employees/profile");
    return data.data;
  },

  async getNextShift(): Promise<NextShift | null> {
    const { data } = await axiosInstance.get<ApiResponse<NextShift | null>>(
      "/employees/profile/next-shift",
    );
    return data.data;
  },

  /** BE nhận multipart/form-data vì có thể kèm ảnh */
  async updateProfile(
    payload: UpdateProfilePayload,
    file?: File,
  ): Promise<Employee> {
    const form = new FormData();
    // FormData chỉ nhận string hoặc Blob -> bỏ qua field undefined
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) form.append(key, value);
    });
    if (file) form.append("file", file); // tên 'file' khớp FileInterceptor('file') bên BE

    const { data } = await axiosInstance.patch<ApiResponse<Employee>>(
      "/employees/profile",
      form,
      {
        // BẮT BUỘC ghi rõ: nếu axiosInstance đặt mặc định 'application/json'
        // thì axios sẽ tự đổi FormData thành JSON -> file bị mất.
        // Ghi 'multipart/form-data' thì axios tự thêm boundary.
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return data.data;
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await axiosInstance.patch("/employees/profile/password", payload);
  },
};
