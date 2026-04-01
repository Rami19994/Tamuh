import { AdminLayout } from "@/components/layout/AdminLayout";
import { useState, useEffect } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  case_created: { label: "طلب جديد", color: "bg-blue-100 text-blue-700" },
  status_changed: { label: "تغيير الحالة", color: "bg-amber-100 text-amber-700" },
  note_added: { label: "ملاحظة", color: "bg-indigo-100 text-indigo-700" },
  draft_released: { label: "مسودة جديدة", color: "bg-purple-100 text-purple-700" },
  email_sent: { label: "إشعار بريدي", color: "bg-green-100 text-green-700" },
  case_flagged: { label: "تبليغ", color: "bg-red-100 text-red-700" },
  case_unflagged: { label: "إلغاء تبليغ", color: "bg-gray-100 text-gray-600" },
  student_confirmed_sent: { label: "تأكيد الإرسال", color: "bg-emerald-100 text-emerald-700" },
};

export default function AdminActivityLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/activity-log?page=${p}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-primary mb-1">سجل النشاط الداخلي</h2>
          <p className="text-sm text-muted-foreground">جميع الإجراءات المسجّلة في النظام ({total} إجمالي)</p>
        </div>
        <button
          onClick={() => fetchLogs(1)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">لا توجد سجلات بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const meta = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-600" };
              return (
                <div key={log.id} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="font-bold text-gray-800 text-sm">{log.performedBy}</span>
                    </div>
                    {log.details && (
                      <p className="text-sm text-gray-600 leading-relaxed">{log.details}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0 text-left" dir="ltr">
                    {format(new Date(log.performedAt), "yyyy-MM-dd HH:mm")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {total > 50 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">صفحة {page} · {total} إجمالي</span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                السابق
              </button>
              <button
                onClick={() => fetchLogs(page + 1)}
                disabled={page * 50 >= total}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
