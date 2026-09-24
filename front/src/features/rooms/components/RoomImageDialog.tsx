import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useRoomStore } from "../stores/room.store";

const MAX_IMAGES = 10;
const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

interface Props {
  roomId: string | null;
  onClose: () => void;
}

/** key theo roomId: đổi phòng thì dựng lại, state bên trong tự về trạng thái đầu */
export default function RoomImageDialog({ roomId, onClose }: Props) {
  if (!roomId) return null;
  return (
    <DialogBody
      key={roomId}
      roomId={roomId}
      onClose={onClose}
    />
  );
}

function DialogBody({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  // Đọc thẳng từ store — sau mỗi thao tác store cập nhật, dialog tự vẽ lại
  const room = useRoomStore((s) => s.rooms.find((r) => r.id === roomId));
  const { addRoomImages, updateRoomImages } = useRoomStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null);
  const [fileOver, setFileOver] = useState(false);

  if (!room) return null;

  const images = room.images ?? [];
  const remaining = MAX_IMAGES - images.length;
  const busy = uploading || saving;

  // Kiểm tra trước khi gửi — BE cũng kiểm tra, nhưng báo sớm đỡ chờ upload rồi mới biết sai
  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list);

    const wrongType = files.find((f) => !ACCEPT.includes(f.type));
    if (wrongType) {
      toast.error(`${wrongType.name} không phải ảnh jpeg, png hoặc webp`);
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_SIZE);
    if (tooBig) {
      toast.error(`${tooBig.name} lớn hơn 5MB`);
      return;
    }
    if (files.length > remaining) {
      toast.error(`Phòng này chỉ thêm được ${remaining} ảnh nữa`);
      return;
    }

    setUploading(true);
    try {
      await addRoomImages(room.id, files);
      toast.success(`Đã thêm ${files.length} ảnh cho phòng ${room.room_number}`);
    } catch {
      // store đã báo lỗi
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ""; // cho phép chọn lại cùng file
    }
  };

  const save = async (next: string[], message: string) => {
    setSaving(true);
    try {
      await updateRoomImages(room.id, next);
      toast.success(message);
    } catch {
      // store đã báo lỗi
    } finally {
      setSaving(false);
    }
  };

  const move = (from: number, to: number) => {
    const next = [...images];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    return next;
  };

  const handleReorderDrop = (to: number) => {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === to) return;
    save(move(from, to), "Đã đổi thứ tự ảnh");
  };

  const makeCover = (index: number) => save(move(index, 0), "Đã đặt làm ảnh bìa");

  const remove = (url: string) => {
    setConfirmUrl(null);
    save(
      images.filter((u: any) => u !== url),
      "Đã xoá ảnh",
    );
  };

  return (
    <div
      className="fixed inset-0 bg-[#14181D]/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="bg-white rounded-[10px] w-[640px] max-w-full max-h-[86vh] flex flex-col shadow-[0_8px_24px_rgba(20,24,29,.12)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E4E6E9] shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-[#14181D]">
              Ảnh phòng {room.room_number}
            </h2>
            <p className="text-[12px] text-[#98A1AC] mt-0.5 tabular-nums">
              {images.length} trên {MAX_IMAGES} ảnh. Kéo để sắp xếp, ảnh đầu tiên là
              ảnh bìa.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-7 h-7 flex items-center justify-center rounded text-[#98A1AC] hover:bg-[#F5F6F7] disabled:opacity-40"
          >
            <X
              size={15}
              strokeWidth={1.75}
            />
          </button>
        </div>

        {/* Vùng nhận file kéo từ máy tính — phân biệt với kéo để sắp xếp qua dragIndex */}
        <div
          className="relative flex-1 overflow-y-auto p-5"
          onDragOver={(e) => {
            if (dragIndex !== null) return;
            e.preventDefault();
            setFileOver(true);
          }}
          onDragLeave={() => setFileOver(false)}
          onDrop={(e) => {
            if (dragIndex !== null) return;
            e.preventDefault();
            setFileOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          {busy && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E4E6E9] overflow-hidden z-10">
              <div className="h-full w-1/3 bg-[#1B3A5C] rounded-full animate-[slide_1s_ease-in-out_infinite]" />
            </div>
          )}

          {images.length === 0 ? (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={`w-full h-[220px] rounded-lg border border-dashed flex flex-col items-center justify-center gap-2 transition-colors
                ${fileOver ? "border-[#1B3A5C] bg-[#F5F6F7]" : "border-[#CDD2D8] hover:bg-[#FAFBFB]"}`}
            >
              <ImagePlus
                size={20}
                strokeWidth={1.75}
                className="text-[#98A1AC]"
              />
              <span className="text-[13px] text-[#14181D]">
                {uploading ? "Đang tải ảnh lên" : "Kéo ảnh vào đây hoặc chọn từ máy"}
              </span>
              <span className="text-[11px] text-[#98A1AC]">
                jpeg, png, webp, mỗi ảnh dưới 5MB
              </span>
            </button>
          ) : (
            <div
              className={`grid grid-cols-3 gap-2.5 transition-opacity ${
                busy ? "opacity-50 pointer-events-none" : ""
              } ${fileOver ? "outline outline-1 outline-dashed outline-[#1B3A5C] outline-offset-4 rounded-lg" : ""}`}
            >
              {images.map((url: string, index: any) => (
                <div
                  key={url}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) setOverIndex(index);
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleReorderDrop(index);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={`group relative aspect-[4/3] rounded-lg overflow-hidden bg-[#F5F6F7] cursor-grab active:cursor-grabbing
                    ${dragIndex === index ? "opacity-40" : ""}
                    ${overIndex === index && dragIndex !== index ? "ring-2 ring-[#1B3A5C]" : ""}`}
                >
                  <img
                    src={url}
                    alt={`Ảnh ${index + 1} phòng ${room.room_number}`}
                    loading="lazy"
                    draggable={false}
                    className="w-full h-full object-cover"
                  />

                  {index === 0 && (
                    <span className="absolute top-1.5 left-1.5 h-5 px-1.5 flex items-center rounded bg-white/90 text-[10px] font-medium text-[#14181D]">
                      Ảnh bìa
                    </span>
                  )}

                  {confirmUrl === url ? (
                    <div className="absolute inset-0 bg-[#14181D]/70 flex flex-col items-center justify-center gap-2 p-3">
                      <p className="text-[11px] text-white text-center">
                        Xoá ảnh này?
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => remove(url)}
                          className="h-7 px-3 rounded-md bg-[#B4321F] text-white text-[11px] font-medium"
                        >
                          Xoá
                        </button>
                        <button
                          onClick={() => setConfirmUrl(null)}
                          className="h-7 px-3 rounded-md bg-white text-[11px] text-[#14181D]"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      {index !== 0 && (
                        <button
                          onClick={() => makeCover(index)}
                          title="Đặt làm ảnh bìa"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-[#14181D] hover:bg-white"
                        >
                          <Star
                            size={13}
                            strokeWidth={1.75}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmUrl(url)}
                        title="Xoá ảnh"
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white/90 text-[#B4321F] hover:bg-white"
                      >
                        <Trash2
                          size={13}
                          strokeWidth={1.75}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {remaining > 0 && (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="aspect-[4/3] rounded-lg border border-dashed border-[#CDD2D8] flex flex-col items-center justify-center gap-1.5 hover:bg-[#FAFBFB]"
                >
                  <ImagePlus
                    size={18}
                    strokeWidth={1.75}
                    className="text-[#98A1AC]"
                  />
                  <span className="text-[12px] text-[#5C6672]">
                    {uploading ? "Đang tải lên" : "Thêm ảnh"}
                  </span>
                </button>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT.join(",")}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
}
