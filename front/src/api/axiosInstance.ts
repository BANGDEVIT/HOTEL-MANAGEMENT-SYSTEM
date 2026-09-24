import { useAuthStore } from "@/features/auth/store/authStore";
import axios, { type InternalAxiosRequestConfig } from "axios";
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // ← quan trọng: cho phép gửi/nhận cookie (refresh token)
  headers: { "Content-Type": "application/json" },
});

// ===== REQUEST INTERCEPTOR =====
// Chạy TRƯỚC mỗi request được gửi đi
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // getState() — lấy snapshot TẠI THỜI ĐIỂM request này chạy,
    // không subscribe, không re-render — đúng cách dùng ngoài component
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ===== RESPONSE INTERCEPTOR =====
// Chạy SAU khi nhận response — dùng để xử lý lỗi 401
axiosInstance.interceptors.response.use(
  (res) => res, // request thành công → trả về bình thường
  async (error) => {
    const originalRequest = error.config;

    // ← Lấy ý bạn — chặn các route không cần refresh
    const skipUrls = ["/auth/login", "/auth/register", "/auth/refresh"];
    const isSkipUrl = skipUrls.some((url) => originalRequest.url?.includes(url));

    if (isSkipUrl) {
      return Promise.reject(error); // → Promise THẤT BẠI, mang theo error
    }

    // Nếu lỗi 401 và request này CHƯA từng retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // đánh dấu để tránh lặp vô hạn

      try {
        const { data } = await axiosInstance.post("/auth/refresh");
        // → data ở đây = { success, statusCode, data: {accessToken}, message }
        const newToken = data.data.accessToken;

        useAuthStore.getState().setAccessToken(newToken);
        // Gắn token mới vào request cũ rồi gửi lại
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh cũng fail → token thật sự hết hạn → đá về login
        useAuthStore.getState().clearAuth();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
