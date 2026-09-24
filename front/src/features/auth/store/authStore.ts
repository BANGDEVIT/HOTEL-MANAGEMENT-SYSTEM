import { authApi } from "@/api/authApi";
import type {
  AuthUser,
  LoginPayload,
  LoginReponseData,
  MeResponseData,
  RegisterPayload,
} from "@/types/auth";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean; // ← true khi đang bootstrap lúc app mount
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>; // ← gọi 1 lần khi App khởi động
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  clearError: () => void;

  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: true, // mặc định true — App.tsx sẽ chờ cờ này
      error: null,

      login: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login(payload);
          const result: LoginReponseData = data.data;
          // Lưu ý: login() BE hiện tại KHÔNG trả fullName
          // → user.fullName sẽ là undefined ngay sau khi login
          // → Cách vá: gọi luôn getMe() sau login để có fullName ngay
          set({
            user: result.account,
            accessToken: result.accessToken,
            isAuthenticated: true,
          });

          // Gọi thêm getMe() để có fullName hiển thị đúng ngay,
          // không phải đợi tới lần F5 trang tiếp theo mới có
          const { data: meRes } = await authApi.getMe();
          const me: MeResponseData = meRes.data; // ← cần thêm .data lần nữa

          set({
            user: {
              id: me.id,
              email: me.email,
              roles: me.roles,
              fullname: me.fullName,
            },
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.message ?? "Đăng nhập thất bại",
            isLoading: false,
          });
          throw err;
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register(payload);
          set({ isLoading: false });
          // register không trả token — FE tự điều hướng sang /login sau khi gọi xong
        } catch (err: any) {
          set({
            error: err.response?.data?.message ?? "Đăng ký thất bại",
            isLoading: false,
          });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // vẫn xóa state local dù API lỗi — user luôn thoát được
        } finally {
          get().clearAuth();
        }
      },

      // chạy đúng 1 lần khi App.tsx mount
      // bootstrap: async () => {
      //   try {
      //     // Cookie refresh-token tự động gửi kèm nhờ withCredentials: true
      //     const { data } = await authApi.refreshToken();
      //     const newToken = data.data.accessToken;

      //     // Chỉ có accessToken mới, CHƯA có thông tin account
      //     // → cần gọi thêm 1 API lấy profile để biết roles/email
      //     // (dùng /employees/profile hoặc /customers/profile tùy roles đã lưu ở "user" persist)
      //     set({ accessToken: newToken });
      //     const { data: meRes } = await authApi.getMe();
      //     const me: MeResponseData = meRes.data;

      //     set({
      //       user: {
      //         id: me.id,
      //         email: me.email,
      //         roles: me.roles,
      //         fullname: me.fullName,
      //       },
      //       isAuthenticated: true,
      //     });
      //   } catch {
      //     // Refresh token cũng đã hết hạn/không tồn tại → coi như chưa đăng nhập
      //     get().clearAuth();
      //   } finally {
      //     set({ isInitializing: false }); // dù thành công hay fail, luôn tắt loading
      //   }
      // },

      bootstrap: async () => {
        // Đã có user trong localStorage → tin tạm, cho vào ngay
        // Hai API vẫn chạy nền để lấy token mới và làm tươi roles
        const cachedUser = get().user;
        if (cachedUser) {
          set({ isAuthenticated: true, isInitializing: false });
        }

        try {
          const { data: refreshRes } = await authApi.refreshToken();
          set({ accessToken: refreshRes.data.accessToken });

          const { data: meRes } = await authApi.getMe();
          const me: MeResponseData = meRes.data;

          set({
            user: {
              id: me.id,
              email: me.email,
              roles: me.roles,
              fullname: me.fullName,
            },
            isAuthenticated: true,
          });
        } catch {
          get().clearAuth();
        } finally {
          set({ isInitializing: false });
        }
      },

      setAccessToken: (token) => set({ accessToken: token }),

      clearAuth: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      clearError: () => set({ error: null }),

      hasRole: (role) => {
        const user = get().user;
        return user?.roles?.includes(role) ?? false;
      },

      isAdmin: () => get().hasRole("admin"),
      isManager: () => get().hasRole("manager") || get().hasRole("admin"),
    }),
    {
      name: "auth-storage", // key trong localStorage
      partialize: (state) => ({
        // accessToken KHÔNG persist → luôn bắt đầu lại từ null sau F
        user: state.user,
        // accessToken: state.accessToken,
        // isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
