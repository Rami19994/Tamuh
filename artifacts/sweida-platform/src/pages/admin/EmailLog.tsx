import { AdminLayout } from "@/components/layout/AdminLayout";
import { useState, useEffect } from "react";
import { Mail, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { STATUS_LABELS } from "@/lib/constants";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminEmailLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/email-log?page=${p}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setLogs(data.notifications || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(1); }, []);

  const statusColor: Record<string, string> = {
    sent: "bg-green-100 text-green-700",
    simulated: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-gray-100 text-gray-600",
  };

  const statusLabel: Record<string, string> = {
    sent: "مُرسَل",
    simulated: "محاكاة",
    failed: "فشل",
    pending: "معلّق",
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-primary mb-1">سجل الإشعارات البريدية</h2>
          <p className="text-sm text-muted-foreground">جميع إشعارات البريد الإلكتروني المرسلة أو المسجّلة ({total} إجمالي)</p>
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
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">لا توجد إشعارات مسجّلة بعد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-5 py-3 font-bold text-gray-600">رقم الطلب</th>
                <th className="text-right px-5 py-3 font-bold text-gray-600">البريد المُرسَل إليه</th>
                <th className="text-right px-5 py-3 font-bold text-gray-600">الحالة المُخطَر عنها</th>
                <th className="text-right px-5 py-3 font-bold text-gray-600">الحالة</th>
                <th className="text-right px-5 py-3 font-bold text-gray-600">أرسله</th>
                <th className="text-right px-5 py-3 font-bold text-gray-600">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono font-bold text-primary">{n.caseNumber}</td>
                  <td className="px-5 py-3 font-mono text-gray-600 text-xs" dir="ltr">{n.recipientEmail}</td>
                  <td className="px-5 py-3 text-gray-700">{STATUS_LABELS[n.caseStatus] || n.caseStatus}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusColor[n.status] || "bg-gray-100 text-gray-600"}`}>
                      {statusLabel[n.status] || n.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{n.triggeredBy}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs" dir="ltr">
                    {format(new Date(n.triggeredAt), "yyyy-MM-dd HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {total > 30 && (
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
                disabled={page * 30 >= total}
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
