import React from 'react';
import { X, Bell } from 'lucide-react';

export const NotificationDrawer = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onDismiss,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
      <div className="bg-white w-full sm:max-w-sm h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-800" />
            <h2 className="text-sm font-bold text-slate-900">Academic Notifications</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs text-blue-700 hover:text-blue-900 font-medium cursor-pointer"
            >
              Mark all read
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {(!notifications || notifications.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No unread notifications at this time.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded text-xs transition-colors ${
                  item.read ? 'bg-white text-slate-600' : 'bg-blue-50/50 text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900">{item.title}</div>
                  <button
                    onClick={() => onDismiss(item.id)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                  {item.message}
                </p>
                <div className="text-[10px] text-slate-400 font-mono mt-1.5">{item.time}</div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
          <span className="text-[11px] text-slate-500">
            BVCOE Student Information System Sync Active
          </span>
        </div>
      </div>
    </div>
  );
};
