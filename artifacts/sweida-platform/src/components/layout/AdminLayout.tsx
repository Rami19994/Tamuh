import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Mail,
  Activity,
  Clock,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

// Prevent search engines from indexing admin pages
if (typeof document !== "undefined") {
  let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!metaRobots) {
    metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    document.head.appendChild(metaRobots);
  }
  metaRobots.content = "noindex, nofollow";
}

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const WARN_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before expiry

function getTokenInfo(): { name: string; role: string; exp: number } | null {
  const token = localStorage.getItem("adminToken");
  if (!token) return null;
  try {
    return JSON.parse(atob(token));
  } catch {
    return null;
  }
}

function getRoleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "مدير",
    super_admin: "مدير عام",
    intake: "مسؤول الاستقبال",
    verifier: "مسؤول التحقق",
    drafter: "مسؤول المسودات",
    records: "مسؤول السجلات",
  };
  return labels[role] || role;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [unreadReports, setUnreadReports] = useState(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const tokenInfo = getTokenInfo();

  const fetchUnreadCount = useCallback(async () => {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/admin/exploitation-reports/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { count } = await res.json();
        setUnreadReports(count);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setLocation("/admin/login");
  };

  useEffect(() => {
    if (!tokenInfo) {
      setLocation("/admin/login");
      return;
    }

    const now = Date.now();
    const remaining = tokenInfo.exp - now;

    if (remaining <= 0) {
      handleLogout();
      return;
    }

    const warnIn = Math.max(0, remaining - WARN_BEFORE_MS);

    warningTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
      setTimeLeft(Math.floor(WARN_BEFORE_MS / 1000));
      countdownRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(countdownRef.current);
            handleLogout();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }, warnIn);

    logoutTimerRef.current = setTimeout(handleLogout, remaining);

    return () => {
      clearTimeout(warningTimerRef.current);
      clearTimeout(logoutTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  const menu = [
    { icon: LayoutDashboard, label: "لوحة التحكم", href: "/admin" },
    { icon: AlertTriangle, label: "بلاغات الاستغلال", href: "/admin/abuse-reports", badge: unreadReports },
    { icon: Mail, label: "سجل الإشعارات", href: "/admin/email-log" },
    { icon: Activity, label: "سجل النشاط", href: "/admin/activity-log" },
    { icon: Users, label: "المستخدمون", href: "/admin/users" },
  ];

  const avatarInitial = tokenInfo?.name ? tokenInfo.name.charAt(0) : "أ";

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans" dir="rtl">
      {/* Session Timeout Warning */}
      {showTimeoutWarning && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-50 border border-amber-300 shadow-xl rounded-xl p-4 flex items-center gap-4 max-w-sm w-full">
          <Clock className="w-6 h-6 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-amber-900 text-sm">جلستك على وشك الانتهاء</p>
            <p className="text-amber-700 text-xs">سيتم تسجيل خروجك خلال {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")} دقيقة</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
          >
            خروج الآن
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-primary text-white flex-shrink-0 flex flex-col hidden md:flex">
        <div className="h-20 flex items-center px-5 border-b border-white/10 gap-3">
          <img src="/logo.png" alt="مركز طموح" className="h-14 object-contain brightness-0 invert" />
          <span className="font-bold text-base leading-tight">بوابة الإدارة</span>
        </div>

        {tokenInfo && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/5">
            <p className="text-white font-bold text-sm truncate">{tokenInfo.name}</p>
            <p className="text-white/50 text-xs mt-0.5">{getRoleLabel(tokenInfo.role)}</p>
          </div>
        )}

        <nav className="flex-1 py-6 px-4 space-y-1">
          {menu.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium
                ${location === item.href
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {"badge" in item && item.badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/60 hover:bg-red-500/20 hover:text-red-300 transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-primary text-white flex items-center px-4 justify-between z-40">
        <span className="font-bold">بوابة الإدارة</span>
        <button onClick={handleLogout} className="text-white/70">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center px-8 justify-between flex-shrink-0">
          <h1 className="font-bold text-xl text-primary">
            {menu.find((m) => m.href === location)?.label || "إدارة الحالات"}
          </h1>
          <div className="flex items-center gap-3">
            {tokenInfo && (
              <span className="text-sm font-medium text-muted-foreground hidden sm:block">
                مرحباً، {tokenInfo.name}
              </span>
            )}
            <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg">
              {avatarInitial}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8 mt-14 md:mt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
