import { create } from "zustand";
import { toast } from "sonner";
import { profileApi } from "../../../api/profileApi";
import type { NextShift } from "../../../types/shift";

interface MyShiftState {
  employeeId: string | null; // để tô viền vàng ô của mình
  nextShift: NextShift | null;
  nextLoaded: boolean; // phân biệt "chưa tải xong" với "không có ca nào"

  fetchMe: () => Promise<void>;
  fetchNextShift: () => Promise<void>;
}

export const useMyShiftStore = create<MyShiftState>()((set) => ({
  employeeId: null,
  nextShift: null,
  nextLoaded: false,

  fetchMe: async () => {
    try {
      const profile = await profileApi.getProfile();
      set({ employeeId: profile.id });
    } catch {
      toast.error("Không tải được thông tin của bạn");
    }
  },

  fetchNextShift: async () => {
    try {
      set({ nextShift: await profileApi.getNextShift(), nextLoaded: true });
    } catch {
      set({ nextLoaded: true });
      toast.error("Không tải được ca tiếp theo");
    }
  },
}));
