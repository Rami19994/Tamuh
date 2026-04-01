import { AdminLayout } from "@/components/layout/AdminLayout";
import { useState, useEffect, useCallback } from "react";
import { getAdminHeaders } from "@/lib/constants";
import {
  Users, Plus, Shield, Check, X, RefreshCw,
  Eye, EyeOff, Key, UserCheck, UserX, Loader2,
  ChevronDown, Lock,
} from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const ROLE_LABELS: Record<string, string> = {
  intake_officer: "موظف استقبال الطلبات",
  verification_officer: "موظف التحقق",
  drafting_followup_officer: "موظف الصياغة والمتابعة",
  records_officer: "موظف السجلات",
  admin: "مدير",
  super_admin: "مدير عام",
  intake: "موظف استقبال",
  verification: "موظف تحقق",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  intake_officer: "bg-teal-100 text-teal-800",
  verification_officer: "bg-cyan-100 text-cyan-800",
  drafting_followup_officer: "bg-indigo-100 text-indigo-800",
  records_officer: "bg-orange-100 text-orange-800",
  intake: "bg-teal-100 text-teal-800",
  verification: "bg-cyan-100 text-cyan-800",
};

const SELECTABLE_ROLES = [
  { value: "intake_officer", label: "موظف استقبال الطلبات" },
  { value: "verification_officer", label: "موظف التحقق" },
  { value: "drafting_followup_officer", label: "موظف الصياغة والمتابعة" },
  { value: "records_officer", label: "موظف السجلات" },
  { value: "admin", label: "مدير" },
  { value: "super_admin", label: "مدير عام" },
];

function getTokenInfo(): { username: string; role: string; name: string } | null {
  try {
    const raw = localStorage.getItem("adminToken");
    if (!raw) return null;
    return JSON.parse(atob(raw));
  } catch { return null; }
}

function PasswordInput({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir="ltr"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none text-left pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "8 أحرف على الأقل", ok: password.length >= 8 },
    { label: "حرف كبير", ok: /[A-Z]/.test(password) },
    { label: "حرف صغير", ok: /[a-z]/.test(password) },
    { label: "رقم", ok: /[0-9]/.test(password) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const color = passed <= 1 ? "bg-red-500" : passed <= 2 ? "bg-orange-400" : passed <= 3 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= passed ? color : "bg-gray-200"}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={`text-xs flex items-center gap-1 ${c.ok ? "text-emerald-600" : "text-gray-400"}`}>
            {c.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const tokenInfo = getTokenInfo();
  const isSuperAdmin = tokenInfo?.role === "super_admin";

  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [newRole, setNewRole] = useState("intake_officer");
  const [newActive, setNewActive] = useState(true);

  // Edit role state
  const [editRoleId, setEditRoleId] = useState<number | null>(null);
  const [editRoleValue, setEditRoleValue] = useState("");
  const [editRolePending, setEditRolePending] = useState(false);

  // Reset password state
  const [resetId, setResetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetPending, setResetPending] = useState(false);
  const [resetError, setResetError] = useState("");

  // Change own password
  const [showChangeOwn, setShowChangeOwn] = useState(false);
  const [ownCurrent, setOwnCurrent] = useState("");
  const [ownNew, setOwnNew] = useState("");
  const [ownConfirm, setOwnConfirm] = useState("");
  const [ownPending, setOwnPending] = useState(false);
  const [ownError, setOwnError] = useState("");
  const [ownSuccess, setOwnSuccess] = useState("");

  // Action feedback
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 4000);
  };

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/admins`, { headers: getAdminHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdmins(data.admins || []);
    } catch (e: any) {
      setError(e.message || "فشل تحميل قائمة المستخدمين");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/admins`, {
        method: "POST",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName, username: newUsername, email: newEmail,
          password: newPassword, confirmPassword: newConfirmPassword,
          role: newRole, isActive: newActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateSuccess(`تم إنشاء الحساب بنجاح للمستخدم: ${newUsername}`);
      setNewName(""); setNewUsername(""); setNewEmail("");
      setNewPassword(""); setNewConfirmPassword("");
      setNewRole("intake_officer"); setNewActive(true);
      loadAdmins();
      setTimeout(() => { setShowCreateForm(false); setCreateSuccess(""); }, 2500);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (admin: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/admins/${admin.id}/status`, {
        method: "PATCH",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash("ok", `تم ${!admin.isActive ? "تفعيل" : "تعطيل"} حساب ${admin.username}`);
      loadAdmins();
    } catch (e: any) {
      flash("err", e.message);
    }
  };

  const handleSaveRole = async (id: number) => {
    setEditRolePending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/admins/${id}/role`, {
        method: "PATCH",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRoleValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash("ok", "تم تحديث الدور بنجاح");
      setEditRoleId(null);
      loadAdmins();
    } catch (e: any) {
      flash("err", e.message);
    } finally {
      setEditRolePending(false);
    }
  };

  const handleResetPassword = async (id: number) => {
    setResetError("");
    setResetPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/admins/${id}/reset-password`, {
        method: "POST",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPassword, confirmPassword: resetConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      flash("ok", "تم إعادة تعيين كلمة المرور بنجاح");
      setResetId(null); setResetPassword(""); setResetConfirm("");
    } catch (e: any) {
      setResetError(e.message);
    } finally {
      setResetPending(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnError(""); setOwnSuccess("");
    setOwnPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/change-password`, {
        method: "POST",
        headers: { ...getAdminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: ownCurrent, newPassword: ownNew, confirmPassword: ownConfirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOwnSuccess("تم تغيير كلمة المرور بنجاح");
      setOwnCurrent(""); setOwnNew(""); setOwnConfirm("");
      setTimeout(() => { setShowChangeOwn(false); setOwnSuccess(""); }, 2500);
    } catch (e: any) {
      setOwnError(e.message);
    } finally {
      setOwnPending(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-primary flex items-center gap-3">
              <Users className="w-7 h-7" />
              إدارة حسابات المسؤولين
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isSuperAdmin ? "إنشاء وإدارة حسابات الفريق" : "عرض حسابات الفريق"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowChangeOwn(!showChangeOwn); setOwnError(""); setOwnSuccess(""); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
            >
              <Lock className="w-4 h-4" />
              تغيير كلمة مروري
            </button>
            {isSuperAdmin && (
              <>
                <button onClick={loadAdmins} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(""); setCreateSuccess(""); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  إنشاء حساب جديد
                </button>
              </>
            )}
          </div>
        </div>

        {/* Read-only notice for non-super-admin */}
        {!isSuperAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              ليس لديك صلاحية تعديل حسابات المسؤولين. هذه الصفحة للعرض فقط — التعديلات مقتصرة على المدير العام.
            </p>
          </div>
        )}

        {/* Global feedback */}
        {actionMsg && (
          <div className={`rounded-xl p-4 font-bold text-sm flex items-center gap-2 ${
            actionMsg.type === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
            : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {actionMsg.type === "ok" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {actionMsg.text}
          </div>
        )}

        {/* Change own password panel */}
        {showChangeOwn && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-primary mb-5 flex items-center gap-2">
              <Key className="w-5 h-5" />
              تغيير كلمة مروري
            </h2>
            <form onSubmit={handleChangeOwnPassword} className="space-y-4 max-w-md">
              <PasswordInput label="كلمة المرور الحالية" value={ownCurrent} onChange={setOwnCurrent} required />
              <PasswordInput label="كلمة المرور الجديدة" value={ownNew} onChange={setOwnNew} required />
              <PasswordStrength password={ownNew} />
              <PasswordInput label="تأكيد كلمة المرور الجديدة" value={ownConfirm} onChange={setOwnConfirm} required />
              {ownError && <p className="text-red-600 text-sm font-medium">{ownError}</p>}
              {ownSuccess && <p className="text-emerald-600 text-sm font-medium">{ownSuccess}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={ownPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {ownPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  حفظ كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangeOwn(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create admin form */}
        {isSuperAdmin && showCreateForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-primary mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              إنشاء حساب مسؤول جديد
            </h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="مثال: سمير النجار"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    اسم المستخدم <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                    placeholder="samir_najjar"
                    dir="ltr"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    type="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none"
                    placeholder="samir@example.com"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    الدور <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 outline-none bg-white"
                    required
                  >
                    {SELECTABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <PasswordInput
                    label="كلمة المرور"
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="••••••••"
                    required
                  />
                  <PasswordStrength password={newPassword} />
                </div>
                <PasswordInput
                  label="تأكيد كلمة المرور"
                  value={newConfirmPassword}
                  onChange={setNewConfirmPassword}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer gap-2">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={newActive}
                    onChange={(e) => setNewActive(e.target.checked)}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 ring-primary/30 rounded-full peer peer-checked:bg-emerald-500 transition-all after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-[-20px]" />
                  <span className="text-sm font-bold text-gray-700">الحساب مفعّل</span>
                </label>
              </div>
              {createError && <p className="text-red-600 text-sm font-medium">{createError}</p>}
              {createSuccess && <p className="text-emerald-600 text-sm font-medium">{createSuccess}</p>}
              <div className="flex gap-3 border-t pt-5">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? "جاري الإنشاء..." : "إنشاء الحساب"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setCreateError(""); }}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Admin users list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Shield className="w-5 h-5" />
              حسابات الفريق ({admins.length})
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 font-medium">{error}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {admins.map((admin) => (
                <div key={admin.id} className="p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-bold text-gray-900">{admin.name}</span>
                        <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                          {admin.username}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[admin.role] || "bg-gray-100 text-gray-800"}`}>
                          {ROLE_LABELS[admin.role] || admin.role}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${admin.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {admin.isActive ? "مفعّل" : "معطّل"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                        {admin.email && <span className="block" dir="ltr">{admin.email}</span>}
                        <span>أُنشئ: {admin.createdAt ? format(new Date(admin.createdAt), "yyyy-MM-dd") : "—"}</span>
                        {admin.lastLoginAt && (
                          <span className="mr-4">آخر دخول: {format(new Date(admin.lastLoginAt), "yyyy-MM-dd HH:mm")}</span>
                        )}
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Edit role */}
                        {editRoleId === admin.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editRoleValue}
                              onChange={(e) => setEditRoleValue(e.target.value)}
                              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white outline-none"
                            >
                              {SELECTABLE_ROLES.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveRole(admin.id)}
                              disabled={editRolePending}
                              className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                            >
                              {editRolePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setEditRoleId(null)}
                              className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditRoleId(admin.id); setEditRoleValue(admin.role); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                            تغيير الدور
                          </button>
                        )}

                        {/* Reset password */}
                        {resetId === admin.id ? (
                          <div className="flex flex-col gap-2 mt-1 w-full sm:w-auto">
                            <PasswordInput label="كلمة المرور الجديدة" value={resetPassword} onChange={setResetPassword} required />
                            <PasswordStrength password={resetPassword} />
                            <PasswordInput label="تأكيد كلمة المرور" value={resetConfirm} onChange={setResetConfirm} required />
                            {resetError && <p className="text-red-500 text-xs">{resetError}</p>}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResetPassword(admin.id)}
                                disabled={resetPending || !resetPassword}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                              >
                                {resetPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                حفظ
                              </button>
                              <button
                                onClick={() => { setResetId(null); setResetPassword(""); setResetConfirm(""); setResetError(""); }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setResetId(admin.id); setResetPassword(""); setResetConfirm(""); setResetError(""); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                          >
                            <Key className="w-3.5 h-3.5" />
                            إعادة تعيين كلمة المرور
                          </button>
                        )}

                        {/* Toggle active */}
                        {admin.username !== tokenInfo?.username && (
                          <button
                            onClick={() => handleToggleActive(admin)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              admin.isActive
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {admin.isActive
                              ? <><UserX className="w-3.5 h-3.5" /> تعطيل</>
                              : <><UserCheck className="w-3.5 h-3.5" /> تفعيل</>
                            }
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
