export type Gender = "male" | "female" | "other";

export const GENDERS: Gender[] = ["male", "female", "other"];

export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

/** BE lưu gender là string -> giá trị lạ thì quy về 'other' */
export const toGender = (g: string | null | undefined): Gender =>
  GENDERS.includes(g as Gender) ? (g as Gender) : "other";

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: Gender;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// Khớp với FileInterceptor bên BE
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
