import React from 'react';
import { useNotification } from '../../context/NotificationContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
  urgent: <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 animate-bounce" />,
  error: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-amber-500 shrink-0" />,
};

const BORDERS = {
  success: 'border-emerald-200 bg-white/95 text-slate-800',
  urgent: 'border-rose-400 bg-rose-50 text-rose-950 font-medium',
  error: 'border-rose-300 bg-white/95 text-slate-800',
  info: 'border-amber-200 bg-white/95 text-slate-800',
};

export const ToastContainer = () => {
  const { notifications, removeToast } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {notifications.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur transition-all duration-300 transform translate-y-0 ${
            BORDERS[toast.type] || BORDERS.info
          }`}
        >
          {ICONS[toast.type] || ICONS.info}
          <div className="flex-1 text-sm leading-snug">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
