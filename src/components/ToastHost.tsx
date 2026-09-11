import { useToastStore } from "../store/toastStore";
import type { ToastKind } from "../store/toastStore";

const ICONS: Record<ToastKind, string> = {
  success: "✓",
  error: "✕",
  info: "i",
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
          role="status"
        >
          <span className="toast-icon">{ICONS[t.kind]}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
