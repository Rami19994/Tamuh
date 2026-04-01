import { Link, useLocation } from "wouter";
import { Shield, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "الرئيسية" },
    { href: "/how-it-works", label: "آلية العمل" },
    { href: "/privacy", label: "الخصوصية والأمان" },
    { href: "/report", label: "الإبلاغ عن استغلال" },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary/20">
      {/* Top Warning Banner */}
      <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm md:text-base font-semibold text-center flex items-center justify-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        تنبيه: أي شخص يطلب مبلغًا ماليًا مقابل هذه المساعدة لا يمثل الفريق وهو
        يقوم بالاحتيال. المساعدة مجانية 100%.
      </div>

      {/* Navbar */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <img
                src="/logo.png"
                alt="مركز طموح"
                className="h-16 object-contain group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xl leading-tight text-primary">
                  فريق طموح السويداء
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  UoPeople منصة دعم مستندات
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-semibold transition-colors hover:text-primary relative py-2
                    ${location === link.href ? "text-primary" : "text-muted-foreground"}
                  `}
                >
                  {link.label}
                  {location === link.href && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                    />
                  )}
                </Link>
              ))}
              <div className="w-px h-6 bg-border mx-2"></div>
              <Link
                href="/admin/login"
                className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                دخول الفريق
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="مركز طموح" className="h-10 object-contain brightness-0 invert" />
              <span className="font-bold text-xl">طموح السويداء</span>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-sm">
              مبادرة تطوعية مستقلة تهدف لمساعدة طلاب جامعة UoPeople في سوريا
              (محافظة السويداء) على استكمال متطلبات التسجيل وتأمين المستندات
              بطرق آمنة ومجانية بالكامل.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">روابط هامة</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/80">
              <li>
                <Link
                  href="/submit"
                  className="hover:text-white transition-colors"
                >
                  تقديم طلب جديد
                </Link>
              </li>
              <li>
                <Link
                  href="/track"
                  className="hover:text-white transition-colors"
                >
                  متابعة حالة الطلب
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="hover:text-white transition-colors"
                >
                  كيف نعمل؟
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  سياسة الخصوصية
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-4">هل تعرضت للاستغلال؟</h4>
            <p className="text-primary-foreground/70 text-sm mb-4">
              إذا طلب منك أي شخص مبالغ مالية أو تصرف بشكل مريب باسم المبادرة،
              يرجى إبلاغنا فوراً.
            </p>
            <Link
              href="/report"
              className="inline-flex items-center justify-center px-4 py-2 bg-destructive/20 text-white rounded-lg hover:bg-destructive/40 transition-colors text-sm font-semibold"
            >
              الإبلاغ عن إساءة
            </Link>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} جميع الحقوق محفوظة لمبادرة مساعدة طلاب
          السويداء. هذه المبادرة غير تابعة لجامعة UoPeople بشكل رسمي بل هي جهد
          طلابي تطوعي.
        </div>
      </footer>
    </div>
  );
}
