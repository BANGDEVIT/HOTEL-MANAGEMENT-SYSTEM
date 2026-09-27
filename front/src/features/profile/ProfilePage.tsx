import { useEffect } from "react";
import { useProfileStore } from "./store/profileStore";
import IdentityCard from "./components/IdentityCard";
import ProfileInfoForm from "./components/ProfileInfoForm";
import ChangePasswordForm from "./components/ChangePasswordForm";

export default function ProfilePage() {
  const profile = useProfileStore((s) => s.profile);
  const loading = useProfileStore((s) => s.loading);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Chưa có dữ liệu thì CHƯA render form:
  // defaultValues của useForm chỉ đọc 1 lần, render sớm thì form bị kẹt ở giá trị rỗng
  if (!profile) {
    return (
      <div className="bg-white border border-line rounded-[10px] py-16 text-center text-[13px] text-ink-muted">
        {loading ? "Đang tải hồ sơ" : "Không tải được hồ sơ"}
      </div>
    );
  }

  return (
    <div className="max-w-[1040px]">
      <div className="mb-4">
        <h1 className="text-[19px] font-semibold text-ink tracking-[-0.01em]">
          Hồ sơ
        </h1>
        <p className="text-[12px] text-ink-muted mt-0.5">
          Thông tin tài khoản của bạn
        </p>
      </div>

      {/* Màn hình lớn chia 2 cột, màn hình nhỏ xếp chồng thành 1 cột */}
      <div className="grid gap-4 items-start lg:grid-cols-[300px_minmax(0,1fr)]">
        <IdentityCard profile={profile} />

        <div className="bg-white border border-line rounded-[10px] overflow-hidden">
          <ProfileInfoForm
            key={profile.id}
            profile={profile}
          />
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
