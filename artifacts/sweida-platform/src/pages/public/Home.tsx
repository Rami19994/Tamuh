import { PublicLayout } from "@/components/layout/PublicLayout";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Lock, FileCheck, HelpCircle } from "lucide-react";

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white pt-24 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-right"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-primary leading-[1.2] mb-6">
                منصة مساعدة <span className="text-secondary">مجانية وسرية</span> للطلاب المتضررين
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl">
                نراجع كل حالة بشكل منظم، ونوفر توجيهًا خاصًا وآمنًا لاستكمال متطلبات التسجيل في UoPeople، 
                دون أي مقابل مادي، وبسرية تامة لحماية خصوصيتك.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/submit" className="inline-flex items-center justify-center px-8 py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all duration-300">
                  تقديم طلب مساعدة
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Link>
                <Link href="/track" className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary border-2 border-primary/20 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-primary/40 transition-all duration-300">
                  التحقق من حالة الطلب
                </Link>
              </div>

              <div className="flex items-center gap-8 text-sm font-semibold text-primary/80">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-secondary" /> مساعدة مجانية 100%</div>
                <div className="flex items-center gap-2"><Lock className="w-5 h-5 text-secondary" /> سرية تامة للبيانات</div>
                <div className="flex items-center gap-2"><FileCheck className="w-5 h-5 text-secondary" /> توجيه منظم وموثوق</div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-secondary/20 to-primary/10 rounded-3xl transform rotate-3 scale-105 -z-10"></div>
              <img 
                src={`${import.meta.env.BASE_URL}images/hero-illustration.png`} 
                alt="تنظيم ومساعدة الطلاب" 
                className="w-full h-auto object-cover rounded-3xl shadow-2xl border border-white"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-primary mb-4">كيف تعمل المبادرة؟</h2>
            <p className="text-muted-foreground text-lg">آلية عمل بسيطة ومنظمة لضمان حصولك على الدعم المناسب بأسرع وقت وأكثر الطرق أماناً.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { num: "01", title: "تقديم الطلب", desc: "املأ النموذج بمعلوماتك واشرح حالتك بدقة من خلال المنصة الآمنة." },
              { num: "02", title: "المراجعة والتحقق", desc: "يقوم فريقنا بمراجعة الحالة لضمان توافقها مع معايير الدعم ووضع خطة مناسبة." },
              { num: "03", title: "التوجيه المخصص", desc: "نزودك بمسودة البريد الإلكتروني أو الخطوات الدقيقة التي يجب عليك اتباعها." },
              { num: "04", title: "المتابعة", desc: "نتابع معك حتى استكمال الإجراءات والتأكد من حل المشكلة." },
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gray-50 rounded-2xl p-8 border border-gray-100 relative hover:shadow-lg hover:-translate-y-1 transition-all"
              >
                <div className="text-5xl font-extrabold text-primary/10 absolute top-4 left-4">{step.num}</div>
                <h3 className="text-xl font-bold text-primary mb-3 relative z-10">{step.title}</h3>
                <p className="text-muted-foreground relative z-10">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <HelpCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-primary">الأسئلة الشائعة</h2>
          </div>

          <div className="space-y-4">
            {[
              { q: "هل هناك أي رسوم لهذه الخدمة؟", a: "لا، الخدمة مجانية بالكامل. إذا طلب منك أي شخص مقابلاً مالياً، يرجى الإبلاغ عنه فوراً من خلال صفحة الإبلاغ عن الاستغلال." },
              { q: "كم تستغرق عملية المراجعة؟", a: "نحاول الرد في أقرب وقت ممكن (عادة خلال 48 ساعة)، ولكن قد يختلف الوقت حسب عدد الطلبات الواردة وطبيعة الحالة." },
              { q: "هل ستشاركون بياناتي مع أي جهة؟", a: "بياناتك سرية تماماً، ولا يطلع عليها سوى الفريق المصرح له بالمراجعة لغرض المساعدة فقط." },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg text-primary mb-2 flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2"></div>
                  {faq.q}
                </h3>
                <p className="text-muted-foreground mr-4">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
