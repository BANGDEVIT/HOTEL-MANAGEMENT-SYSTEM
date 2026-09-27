import axios from "axios";

export function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err?.response?.data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (typeof msg === "string") return msg;
  }
  return fallback;
}
