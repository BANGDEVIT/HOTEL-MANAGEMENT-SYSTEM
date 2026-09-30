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
import MyShifts from "./features/shifts/components/MyShifts";
import Unauthorized from "./pages/Unauthorized";
import ProfilePage from "./features/profile/ProfilePage";
import CustomerManagement from "./features/customer/CustomerManagement";
import BookingManagement from "./features/booking/BookingManagement";
import ServiceManagement from "./features/service/ServiceManagement";

export default function App() {
  const { bootstrap, isInitializing } = useAuthStore();

  useEffect(() => {
    bootstrap();
  }, []);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-table-head">
        <div className="w-7 h-7 border-2 border-line border-t-[#1B3A5C] rounded-full animate-spin" />
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
            // success: '!bg-navy-700 !text-white !border-navy-700',
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
          path="/admin/my-shifts"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <MyShifts />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <ProfilePage />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/customers"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <CustomerManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <BookingManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/services"
          element={
            <ProtectedRoute allowedRoles={["admin", "manager", "staff"]}>
              <AdminLayout>
                <ServiceManagement />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/unauthorized"
          element={<Unauthorized />}
        />
      </Routes>
    </BrowserRouter>
  );
}
