import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, UserPlus, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useAdminLogin } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

type View = "login" | "checking" | "bootstrap" | "restricted" | "success";

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 bg-gray-50 outline-none text-left pr-12"
        dir="ltr"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function passwordStrength(pw: string): { label: string; color: string; width: string } | null {
  if (!pw) return null;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const long = pw.length >= 8;
  const score = [hasUpper, hasLower, hasNum, long].filter(Boolean).length;
  if (score <= 1) return { label: "ضعيفة جداً", color: "bg-red-500", width: "w-1/4" };
  if (score === 2) return { label: "ضعيفة", color: "bg-orange-500", width: "w-2/4" };
  if (score === 3) return { label: "متوسطة", color: "bg-yellow-500", width: "w-3/4" };
  return { label: "قوية", color: "bg-green-500", width: "w-full" };
}

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<View>("login");

  // Login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const { mutate, isPending } = useAdminLogin();

  // Bootstrap form
  const [bName, setBName] = useState("");
  const [bUsername, setBUsername] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPassword, setBPassword] = useState("");
  const [bConfirm, setBConfirm] = useState("");
  const [bLoading, setBLoading] = useState(false);
  const [bError, setBError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    mutate(
      { data: { username, password } },
      {
        onSuccess: (res) => {
          localStorage.setItem("adminToken", res.token);
          setLocation("/admin");
        },
        onError: () => {
          setLoginError("بيانات الدخول غير صحيحة. يرجى المحاولة مجدداً.");
        },
      },
    );
  };

  const handleCreateAdminClick = async () => {
    setView("checking");
    try {
      const res = await fetch(`${API_BASE}/admin/check-bootstrap`);
      const data = await res.json();
      if (data.canBootstrap) {
        setView("bootstrap");
      } else {
        setView("restricted");
      }
    } catch {
      setView("restricted");
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setBError("");
    if (!bName || !bUsername || !bPassword || !bConfirm) {
      setBError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (bPassword !== bConfirm) {
      setBError("كلمة المرور وتأكيدها غير متطابقتين");
      return;
    }
    setBLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bName,
          username: bUsername,
          email: bEmail || undefined,
          password: bPassword,
          confirmPassword: bConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBError(data.error || "حدث خطأ أثناء إنشاء الحساب");
      } else {
        setView("success");
      }
    } catch {
      setBError("تعذر الاتصال بالخادم. يرجى المحاولة مجدداً.");
    } finally {
      setBLoading(false);
    }
  };

  const strength = passwordStrength(bPassword);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4" dir="rtl">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="مركز طموح" className="h-32 mx-auto mb-3 object-contain" />
          <h1 className="text-2xl font-bold text-primary">دخول فريق الإدارة</h1>
          <p className="text-muted-foreground text-sm mt-2">منصة إدارة حالات طلاب السويداء</p>
        </div>

        {/* ── LOGIN VIEW ── */}
        {view === "login" && (
          <>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">اسم المستخدم</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 bg-gray-50 outline-none text-left"
                  dir="ltr"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-2">كلمة المرور</label>
                <PasswordInput value={password} onChange={setPassword} />
              </div>

              {loginError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {isPending ? "جاري الدخول..." : "تسجيل الدخول"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <button
                onClick={handleCreateAdminClick}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                <UserPlus className="w-4 h-4" />
                إنشاء حساب إداري
              </button>
            </div>
          </>
        )}

        {/* ── CHECKING VIEW ── */}
        {view === "checking" && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            جاري التحقق...
          </div>
        )}

        {/* ── BOOTSTRAP (first super admin) ── */}
        {view === "bootstrap" && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 mb-6 text-right">
              <p className="font-bold mb-1">إنشاء حساب المدير العام الأول</p>
              <p>لم يُسجَّل أي مدير عام في النظام بعد. يمكنك إنشاء الحساب الأول الآن. بعد الإنشاء، لن يتاح هذا الخيار للعموم.</p>
            </div>

            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-primary mb-1">الاسم الكامل *</label>
                <input
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 bg-gray-50 outline-none"
                  placeholder="مثال: أحمد محمد"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1">اسم المستخدم *</label>
                <input
                  value={bUsername}
                  onChange={(e) => setBUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 bg-gray-50 outline-none text-left"
                  dir="ltr"
                  placeholder="admin"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={bEmail}
                  onChange={(e) => setBEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 bg-gray-50 outline-none text-left"
                  dir="ltr"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1">كلمة المرور *</label>
                <PasswordInput value={bPassword} onChange={setBPassword} />
                {strength && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">قوة كلمة المرور: {strength.label}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">8 أحرف على الأقل، حرف كبير، حرف صغير، ورقم</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-primary mb-1">تأكيد كلمة المرور *</label>
                <PasswordInput value={bConfirm} onChange={setBConfirm} />
                {bConfirm && bPassword !== bConfirm && (
                  <p className="text-xs text-red-500 mt-1">كلمتا المرور غير متطابقتين</p>
                )}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
                الدور: <strong>مدير عام (Super Admin)</strong>
              </div>

              {bError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  {bError}
                </div>
              )}

              <button
                type="submit"
                disabled={bLoading}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {bLoading ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </button>
            </form>

            <button
              onClick={() => setView("login")}
              className="w-full mt-4 py-3 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              العودة لتسجيل الدخول
            </button>
          </>
        )}

        {/* ── RESTRICTED (super admin already exists) ── */}
        {view === "restricted" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-5 text-right mb-6">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-amber-800 mb-1">إنشاء الحسابات مقيّد</p>
                  <p className="text-sm text-amber-700">
                    يوجد مدير عام مسجَّل في النظام. إنشاء حسابات إدارية جديدة مقتصر على المدير العام فقط.
                  </p>
                  <p className="text-sm text-amber-700 mt-2">
                    يرجى تسجيل الدخول بحساب المدير العام ثم التوجه إلى صفحة <strong>المستخدمون</strong> لإضافة حسابات جديدة.
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setView("login")}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              تسجيل الدخول
            </button>
          </>
        )}

        {/* ── SUCCESS ── */}
        {view === "success" && (
          <>
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-700 mb-2">تم إنشاء الحساب بنجاح</h2>
              <p className="text-sm text-muted-foreground mb-6">
                تم إنشاء حساب المدير العام. يمكنك الآن تسجيل الدخول وإدارة حسابات الفريق.
              </p>
            </div>
            <button
              onClick={() => setView("login")}
              className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all"
            >
              تسجيل الدخول
            </button>
          </>
        )}
      </div>
    </div>
  );
}
