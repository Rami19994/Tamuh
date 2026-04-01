import { AdminLayout } from "@/components/layout/AdminLayout";
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle, Clock, Eye, Filter } from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function authHeaders() {
  const token = localStorage.getItem("adminToken");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

type Report = {
  id: number;
  reporterNameOrAlias: string;
  contactMethod: string | null;
  notes: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  new: { label: "جديد", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  reviewed: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Eye },
  resolved: { label: "تم التعامل معه", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
};

export default function AbuseReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/exploitation-reports`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API_BASE}/admin/exploitation-reports/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      setReports((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status, reviewedAt: new Date().toISOString() }
            : r
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const newCount = reports.filter((r) => r.status === "new").length;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">بلاغات الاستغلال</h2>
              <p className="text-sm text-gray-500">
                {reports.length} بلاغ إجمالي
                {newCount > 0 && (
                  <span className="mr-2 inline-flex items-center gap-1 text-red-600 font-semibold">
                    · {newCount} جديد
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="text-sm text-primary hover:underline font-medium"
          >
            تحديث
          </button>
        </div>

        {/* New reports alert */}
        {newCount > 0 && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-800">
                {newCount === 1 ? "يوجد بلاغ جديد لم تتم مراجعته" : `يوجد ${newCount} بلاغات جديدة لم تتم مراجعتها`}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                يرجى مراجعة هذه البلاغات وتحديث حالتها في أقرب وقت.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          {[
            { key: "all", label: "الكل" },
            { key: "new", label: "جديد" },
            { key: "reviewed", label: "قيد المراجعة" },
            { key: "resolved", label: "تم التعامل معه" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                filter === f.key
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-600 border-gray-200 hover:border-primary/40"
              }`}
            >
              {f.label}
              {f.key === "new" && newCount > 0 && (
                <span className={`mr-1.5 inline-block min-w-[18px] h-[18px] leading-[18px] text-center rounded-full text-xs font-bold ${
                  filter === "new" ? "bg-white text-primary" : "bg-red-500 text-white"
                }`}>
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Report cards */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <Clock className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>جاري التحميل...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-gray-500">لا توجد بلاغات في هذا التصنيف</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((report) => {
              const s = STATUS_MAP[report.status] || STATUS_MAP.new;
              const Icon = s.icon;
              const isExpanded = expandedId === report.id;
              return (
                <div
                  key={report.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    report.status === "new" ? "border-red-200" : "border-gray-100"
                  }`}
                >
                  {/* Card header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        report.status === "new" ? "bg-red-100" : report.status === "resolved" ? "bg-emerald-100" : "bg-amber-100"
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          report.status === "new" ? "text-red-600" : report.status === "resolved" ? "text-emerald-600" : "text-amber-600"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 truncate">
                            {report.reporterNameOrAlias}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.color}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {format(new Date(report.submittedAt), "yyyy/MM/dd HH:mm")}
                          {report.contactMethod && (
                            <span className="mr-3 text-gray-500">· {report.contactMethod}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : report.id)}
                        className="text-sm text-primary hover:underline font-medium"
                      >
                        {isExpanded ? "إخفاء" : "عرض التفاصيل"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-4">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">تفاصيل البلاغ</p>
                        <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4">
                          {report.notes || "لا توجد تفاصيل إضافية"}
                        </p>
                      </div>

                      {report.reviewedBy && (
                        <p className="text-xs text-gray-400">
                          راجعه: <span className="font-semibold text-gray-600">{report.reviewedBy}</span>
                          {report.reviewedAt && (
                            <span className="mr-2">
                              في {format(new Date(report.reviewedAt), "yyyy/MM/dd")}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Status update buttons */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <span className="text-xs font-bold text-gray-500 ml-1">تحديث الحالة:</span>
                        {report.status !== "reviewed" && (
                          <button
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "reviewed")}
                            className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-semibold hover:bg-amber-100 transition disabled:opacity-50"
                          >
                            قيد المراجعة
                          </button>
                        )}
                        {report.status !== "resolved" && (
                          <button
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "resolved")}
                            className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
                          >
                            تم التعامل معه
                          </button>
                        )}
                        {report.status !== "new" && (
                          <button
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "new")}
                            className="px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-100 transition disabled:opacity-50"
                          >
                            إعادة فتح
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
