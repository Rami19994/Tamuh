import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAdminGetCases, useAdminGetStats } from "@workspace/api-client-react";
import { getAdminHeaders, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search, Filter, Loader2, Download, Mail, CheckCircle, XCircle, AlertTriangle, RefreshCw, Send } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function authHeaders() {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [unreadReports, setUnreadReports] = useState(0);

  // ── SMTP status state ──
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [showSmtpPanel, setShowSmtpPanel] = useState(false);

  const loadSmtpStatus = useCallback(async () => {
    setSmtpLoading(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/smtp-status`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSmtpStatus(data);
      setShowSmtpPanel(!data.configured);
    } catch {
      // ignore
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  useEffect(() => { loadSmtpStatus(); }, [loadSmtpStatus]);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/exploitation-reports/unread-count`, { headers: authHeaders() });
        if (res.ok) {
          const { count } = await res.json();
          setUnreadReports(count);
        }
      } catch { /* ignore */ }
    };
    fetchUnread();
  }, []);

  const handleTestConnection = async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/smtp-test`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      setSmtpTestResult({ ok: data.ok, error: data.error });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) return;
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch(`${API_BASE}/admin/smtp-test-email`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ to: testEmailAddress }),
      });
      const data = await res.json();
      setTestEmailResult({ ok: data.ok, error: data.error });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/admin/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { alert("فشل التصدير. تحقق من صلاحياتك."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cases-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const { data: stats } = useAdminGetStats({ request: { headers: getAdminHeaders() } });
  const { data: casesData, isLoading } = useAdminGetCases(
    { search: search || undefined, status: statusFilter || undefined },
    { request: { headers: getAdminHeaders() } }
  );

  const smtpOk = smtpStatus?.configured && smtpTestResult?.ok;
  const smtpFailed = smtpTestResult && !smtpTestResult.ok;

  return (
    <AdminLayout>
      {/* ── Abuse Reports Alert ── */}
      {unreadReports > 0 && (
        <button
          onClick={() => setLocation("/admin/abuse-reports")}
          className="w-full mb-6 flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-right hover:bg-red-100 transition-all shadow-sm group"
        >
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-red-200 transition-all">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800">
              {unreadReports === 1
                ? "بلاغ استغلال جديد يحتاج إلى مراجعة"
                : `${unreadReports} بلاغات استغلال جديدة تحتاج إلى مراجعة`}
            </p>
            <p className="text-sm text-red-600 mt-0.5">انقر هنا للاطلاع على التفاصيل واتخاذ الإجراء المناسب</p>
          </div>
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-red-500 text-white text-sm font-bold flex-shrink-0">
            {unreadReports}
          </span>
        </button>
      )}

      {/* ── SMTP Status Card ── */}
      <div className={`mb-6 rounded-2xl border shadow-sm overflow-hidden ${
        !smtpStatus ? "bg-white border-gray-200"
        : smtpStatus.configured ? "bg-emerald-50 border-emerald-200"
        : "bg-amber-50 border-amber-200"
      }`}>
        <div
          className="w-full flex items-center justify-between px-5 py-4 cursor-pointer select-none"
          onClick={() => setShowSmtpPanel(v => !v)}
        >
          <div className="flex items-center gap-3">
            {smtpLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : !smtpStatus ? (
              <AlertTriangle className="w-5 h-5 text-gray-400" />
            ) : smtpStatus.configured ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <XCircle className="w-5 h-5 text-amber-600" />
            )}
            <div>
              <span className={`font-bold text-sm ${
                !smtpStatus ? "text-gray-600"
                : smtpStatus.configured ? "text-emerald-800"
                : "text-amber-800"
              }`}>
                إعدادات SMTP —{" "}
                {!smtpStatus ? "جاري التحميل..." : smtpStatus.configured ? "مُكوَّن" : "غير مكتمل"}
              </span>
              {smtpStatus && !smtpStatus.configured && (
                <span className="block text-xs text-amber-700 mt-0.5">
                  المتغيرات المفقودة: {smtpStatus.missing.join("، ")}
                </span>
              )}
              {smtpStatus?.configured && (
                <span className="block text-xs text-emerald-700 mt-0.5">
                  {smtpStatus.host}:{smtpStatus.port} · من: {smtpStatus.from}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); loadSmtpStatus(); }}
              className="p-1.5 rounded-lg bg-white/60 hover:bg-white border border-white/80 transition"
              title="تحديث حالة SMTP"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-xs text-gray-500 font-bold">{showSmtpPanel ? "▲" : "▼"}</span>
          </div>
        </div>

        {showSmtpPanel && (
          <div className="px-5 pb-5 border-t border-black/5 pt-4 space-y-4 bg-white/40">
            {/* Config details */}
            {smtpStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: "SMTP_HOST", value: smtpStatus.host },
                  { label: "SMTP_PORT", value: smtpStatus.port },
                  { label: "SMTP_USER", value: smtpStatus.user },
                  { label: "SMTP_FROM", value: smtpStatus.from },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
                    <p className="text-gray-400 font-bold mb-1">{label}</p>
                    <p className={`font-mono font-bold truncate ${value ? "text-gray-800" : "text-red-500"}`}>
                      {value || "غير محدد"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Test connection */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleTestConnection}
                disabled={smtpTesting || !smtpStatus?.configured}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                {smtpTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                اختبار الاتصال
              </button>

              <div className="flex gap-2 flex-1">
                <input
                  type="email"
                  placeholder="بريد إلكتروني لإرسال رسالة اختبارية..."
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  dir="ltr"
                />
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testEmailAddress || !smtpStatus?.configured}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  {sendingTestEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال اختبار
                </button>
              </div>
            </div>

            {/* Test connection result */}
            {smtpTestResult && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm font-bold ${
                smtpTestResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {smtpTestResult.ok
                  ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>
                  {smtpTestResult.ok
                    ? "✓ اتصال SMTP ناجح — الخادم جاهز لإرسال الرسائل"
                    : `✗ فشل الاتصال: ${smtpTestResult.error}`}
                </span>
              </div>
            )}

            {/* Test email result */}
            {testEmailResult && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm font-bold ${
                testEmailResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                {testEmailResult.ok
                  ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span>
                  {testEmailResult.ok
                    ? `✓ تم إرسال رسالة الاختبار إلى ${testEmailAddress}`
                    : `✗ فشل الإرسال: ${testEmailResult.error}`}
                </span>
              </div>
            )}

            {!smtpStatus?.configured && (
              <p className="text-xs text-amber-700 bg-amber-100 rounded-xl px-4 py-3 border border-amber-200">
                لتفعيل الإرسال الفعلي، أضف المتغيرات المفقودة في لوحة Secrets في Replit، ثم أعد تشغيل الخادم.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <span className="text-muted-foreground text-sm font-bold mb-2">إجمالي الحالات</span>
          <span className="text-3xl font-black text-primary">{stats?.total || 0}</span>
        </div>
        {stats?.byStatus.slice(0, 3).map(stat => (
          <div key={stat.status} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <span className="text-muted-foreground text-sm font-bold mb-2">{STATUS_LABELS[stat.status] || stat.statusLabel}</span>
            <span className="text-3xl font-black text-primary">{stat.count}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-t-2xl border border-gray-200 border-b-0 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو رقم الطلب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Filter className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full pr-12 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
            >
              <option value="">جميع الحالات</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            title="تصدير جميع الحالات كملف CSV"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Download className="w-4 h-4" />
            {exporting ? "جاري..." : "تصدير CSV"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-b-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-600">
                <th className="px-6 py-4">رقم الطلب</th>
                <th className="px-6 py-4">الاسم</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">تاريخ التقديم</th>
                <th className="px-6 py-4">المسؤول</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                    جاري التحميل...
                  </td>
                </tr>
              ) : casesData?.cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                    لا يوجد حالات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                casesData?.cases.map(item => (
                  <tr
                    key={item.caseNumber}
                    onClick={() => setLocation(`/admin/cases/${item.caseNumber}`)}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-sm font-bold text-primary">{item.caseNumber}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{item.fullName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[item.status] || item.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500" dir="ltr" style={{ textAlign: "right" }}>
                      {item.submittedAt ? format(new Date(item.submittedAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.assignedTo || 'غير معين'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
