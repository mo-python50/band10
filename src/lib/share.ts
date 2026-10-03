import { toast } from "sonner";

export async function copyText(text: string, label = "تم النسخ") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("تعذّر النسخ، انسخ النص يدوياً");
  }
}

export async function shareOrCopy(opts: { title: string; text?: string; url: string }) {
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share(opts);
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  await copyText(opts.url, "تم نسخ الرابط");
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "حدث خطأ غير متوقع";
}
