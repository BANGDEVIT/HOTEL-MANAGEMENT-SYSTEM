import { create } from "zustand";
import { toast } from "sonner";
import { profileApi } from "../../../api/profileApi";
import type { Employee } from "../../../types/employee";
import type {
  ChangePasswordPayload,
  UpdateProfilePayload,
} from "../../../types/profile";
import { useAuthStore } from "../../auth/store/authStore";
import { errorMessage } from "../../../utils/errorMessage";

interface ProfileState {
  profile: Employee | null;
  loading: boolean;

  fetchProfile: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload, file?: File) => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

/**
 * Tên hiện ở sidebar và header lấy từ authStore, không phải từ profileStore.
 * Đổi tên xong mà không cập nhật authStore thì góc màn hình vẫn hiện tên cũ tới khi F5.
 */
function syncAuthUser(p: Employee) {
  useAuthStore.setState((s) =>
    s.user ? { user: { ...s.user, fullname: `${p.last_name} ${p.first_name}` } } : s,
  );
}

export const useProfileStore = create<ProfileState>()((set) => ({
  profile: null,
  loading: false,

  fetchProfile: async () => {
    set({ loading: true });
    try {
      set({ profile: await profileApi.getProfile() });
    } catch (err) {
      toast.error(errorMessage(err, "Không tải được hồ sơ"));
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (payload, file) => {
    try {
      const profile = await profileApi.updateProfile(payload, file);
      set({ profile });
      syncAuthUser(profile);
    } catch (err) {
      toast.error(errorMessage(err, "Cập nhật hồ sơ thất bại"));
      throw err; // để form biết mà KHÔNG reset
    }
  },

  changePassword: async (payload) => {
    try {
      await profileApi.changePassword(payload);
    } catch (err) {
      toast.error(errorMessage(err, "Đổi mật khẩu thất bại"));
      throw err;
    }
  },
}));
