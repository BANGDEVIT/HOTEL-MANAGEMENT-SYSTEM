import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "./features/auth/store/authStore";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/AdminLayout";
import LoginPage from "./features/auth/LoginPage";
import RoomManagement from "./features/rooms/RoomManagement";
import RoomTypeManagement from "./features/roomTypes/RoomTypeManagement";
import EmployeeManagement from "./features/employees/EmployeeManagement";
import ShiftManagement from "./features/shifts/ShiftManagement";

export default function App() {
  const { bootstrap, isInitializing } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F5F6F7]">
        <div className="w-7 h-7 border-2 border-[#E4E6E9] border-t-[#1B3A5C] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        closeButton
        toastOptions={{
          style: {
            borderRadius: "10px",
            border: "1px solid #E4E6E9",
            fontSize: "13px",
            fontFamily: "inherit",
          },
          classNames: {
            error: "!bg-[#FEF2F2] !text-[#B4321F] !border-[#FBD5D0]",
            // success: '!bg-[#1B3A5C] !text-white !border-[#1B3A5C]',
            success: "!bg-[#ECFDF5] !text-[#0E7C5A] !border-[#B7E4CE]",
          },
        }}
      />

      <Routes>
        <Route
          path="login"
          element={<LoginPage />}
        />

        <Route
          path="/admin/rooms"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <RoomManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/room-types"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager"]}>
              <AdminLayout>
                <RoomTypeManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager"]}>
              <AdminLayout>
                <EmployeeManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/shifts"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager"]}>
              <AdminLayout>
                <ShiftManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/unauthorized"
          element={
            <div className="flex flex-col items-center justify-center h-screen gap-3">
              <p className="text-[15px] text-[#14181D]">
                Tài khoản của bạn không có quyền xem trang này.
              </p>
              <a
                href="/admin/dashboard"
                className="h-8 px-4 flex items-center rounded-md bg-[#1B3A5C] text-white text-[13px]"
              >
                Về trang phòng
              </a>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
