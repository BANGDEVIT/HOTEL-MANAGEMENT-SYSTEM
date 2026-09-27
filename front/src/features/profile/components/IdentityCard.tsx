import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import type { Employee } from "../../../types/employee";
import { initials, ROLE_LABELS, ROLE_ORDER, tenure } from "../../../types/employee";
import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "../../../types/profile";
import { useProfileStore } from "../store/profileStore";

/** "2023-03-01T00:00:00.000Z" -> "01/03/2023". Cắt chuỗi, không qua Date -> không lệch múi giờ */
const formatDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export default function IdentityCard({ profile }: { profile: Employee }) {
  const updateProfile = useProfileStore((s) => s.updateProfile);

  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSalary, setShowSalary] = useState(false);

  // URL.createObjectURL tạo URL tạm trỏ tới file trong bộ nhớ.
  // Không revoke thì mỗi lần đổi ảnh lại giữ thêm 1 file trong RAM.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handlePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset để chọn lại đúng file đó lần nữa vẫn chạy onChange
    if (!file) return;

    // Kiểm tra ngay ở FE: khỏi phải upload 20MB rồi mới bị BE từ chối
    if (!AVATAR_TYPES.includes(file.type)) {
      toast.error("Chỉ nhận ảnh JPEG, PNG hoặc WEBP");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast.error("Ảnh tối đa 5MB");
      return;
    }

    setPreview(URL.createObjectURL(file)); // hiện ảnh mới NGAY, không chờ upload xong
    setUploading(true);
    try {
      await updateProfile({}, file);
      toast.success("Đã đổi ảnh đại diện");
    } catch {
      // store đã báo lỗi. Bỏ preview -> ảnh quay về ảnh cũ
    } finally {
      setUploading(false);
      setPreview(null);
    }
  };

  const role = ROLE_ORDER.find((r) => profile.account.roles.includes(r));
  const avatarSrc = preview ?? profile.avatar_url;
  const fullName = `${profile.last_name} ${profile.first_name}`;

  return (
    <div className="bg-white border border-[#E4E6E9] rounded-[10px] px-5 py-6 text-center">
      <div className="relative w-24 h-24 mx-auto">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            className={`w-24 h-24 rounded-full object-cover ${uploading ? "opacity-60" : ""}`}
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-[#1B3A5C] text-white text-[32px] font-semibold flex items-center justify-center">
            {initials(profile)}
          </div>
        )}

        {/* input file bị ẩn, bấm nút thì gọi .click() của nó */}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -right-1 -bottom-1 h-7 px-2.5 rounded-full border border-[#E4E6E9] bg-white text-[11px] text-[#14181D] shadow-[0_1px_3px_rgba(20,24,29,.1)] flex items-center gap-1 hover:bg-[#F5F6F7] disabled:opacity-60"
        >
          <Camera
            size={12}
            strokeWidth={1.75}
          />
          {uploading ? "Đang tải" : "Đổi ảnh"}
        </button>
      </div>

      <div className="text-[17px] font-semibold text-[#14181D] mt-3.5">
        {fullName}
      </div>
      <div className="text-[12.5px] text-[#5C6672] mt-0.5">{profile.position}</div>
      {role && (
        <span className="inline-block mt-2.5 text-[11.5px] text-[#1B3A5C] bg-[#EEF2F7] px-2 py-[3px] rounded">
          {ROLE_LABELS[role]}
        </span>
      )}

      <dl className="mt-5 border-t border-[#F0F1F3] text-left">
        <Fact
          label="Email"
          value={profile.email ?? profile.account.email}
        />
        <Fact
          label="Ngày vào làm"
          value={formatDate(profile.hired_date)}
        />
        <Fact
          label="Thâm niên"
          value={tenure(profile.hired_date)}
        />
        <div className="flex justify-between py-2.5 border-b border-[#F0F1F3] text-[12.5px]">
          <dt className="text-[#98A1AC]">Lương</dt>
          <dd>
            <button
              type="button"
              onClick={() => setShowSalary((v) => !v)}
              aria-label={showSalary ? "Ẩn lương" : "Hiện lương"}
              className="tabular-nums text-[#5C6672] hover:text-[#14181D]"
            >
              {showSalary ? `${profile.salary.toLocaleString("vi-VN")} đ` : "••••••"}
            </button>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-2.5 border-b border-[#F0F1F3] text-[12.5px]">
      <dt className="text-[#98A1AC] shrink-0">{label}</dt>
      <dd className="text-[#14181D] tabular-nums truncate">{value}</dd>
    </div>
  );
}
