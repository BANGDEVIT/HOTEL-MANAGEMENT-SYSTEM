import { useAuthStore } from "@/features/auth/store/authStore";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedReouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // optional
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedReouteProps) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  // 1. Chưa đăng nhập → đá về /login
  //    Lưu lại "location" hiện tại vào state để sau khi login xong
  //    có thể quay lại ĐÚNG trang user định vào (thay vì luôn về trang chủ)

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // 2. Có allowedRoles → kiểm tra role user có nằm trong danh sách được phép không
  if (allowedRoles && allowedRoles.length > 0) {
    const hasPermission = user?.roles?.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      return (
        <Navigate
          to="/unauthorized"
          replace
        />
      );
    }
  }
  // 3. Qua hết check → render nội dung thật sự
  return <>{children}</>;
}

// 1. replace (trong <Navigate to="..." replace />)
//    → Thay thế entry hiện tại trong history, KHÔNG thêm entry mới
//    → Nếu không có replace: user bấm nút "Back" của trình duyệt
//      sẽ quay lại trang bị chặn → lại bị đá ra /login → lại Back
//      → vòng lặp khó chịu
//    → Có replace: bấm Back sẽ nhảy qua trang bị chặn luôn

// 2. state={{ from: location }}
//    → Đây là kỹ thuật "nhớ trang muốn vào" để sau khi login xong
//      tự động điều hướng lại đúng chỗ, thay vì luôn về "/"
//    → Cách dùng ở LoginPage (sẽ làm ở bước sau):
//      const from = location.state?.from?.pathname || "/";
//      navigate(from);

// 3. user?.roles?.some(...)
//    → Dùng optional chaining (?.) 2 lần vì:
//      - user có thể là null (dù đã qua check isAuthenticated,
//        TypeScript vẫn không tự suy luận được → cần ?. để an toàn)
//      - roles có thể undefined trong trường hợp hiếm (lỗi data)
//    → .some() thay vì .includes() vì allowedRoles là MẢNG,
//      cần kiểm tra "có ít nhất 1 phần tử trùng" — .includes()
//      chỉ check được 1 giá trị đơn, không check được với mảng khác
