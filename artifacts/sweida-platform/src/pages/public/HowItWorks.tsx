import { PublicLayout } from "@/components/layout/PublicLayout";

export default function HowItWorks() {
  return (
    <PublicLayout>
      <div className="pt-16 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-primary mb-8 text-center">آلية العمل</h1>
        
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-gray-100">
          <div className="space-y-12">
            
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl shrink-0">أ</div>
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">تقديم الطلب</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  تبدأ العملية بتقديمك لطلب مساعدة عبر منصتنا. ستحتاج إلى توفير بعض المعلومات الأساسية عن حالتك الجامعية ووصف دقيق للمشكلة التي تواجهها بخصوص مستندات المرحلة الثانوية.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl shrink-0">ب</div>
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">المراجعة والتحقق</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  يقوم فريق المبادرة بمراجعة بياناتك بعناية تامة وبسرية. يتم تقييم الحالة لتحديد أفضل مسار ممكن للمساعدة بناءً على القوانين المتاحة.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl shrink-0">ج</div>
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">التوجيه المخصص</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  بمجرد الموافقة وتحديد مسار العمل، سنقوم بتزويدك بالتوجيه الدقيق. قد يتضمن ذلك مسودة جاهزة لرسالة بريد إلكتروني يجب أن ترسلها للجامعة من بريدك الشخصي، أو تعليمات لخطوات بديلة.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xl shrink-0">د</div>
              <div>
                <h3 className="text-2xl font-bold text-primary mb-3">المتابعة</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  لا ينتهي دورنا هنا. سنبقى على تواصل من خلال نظام التتبع الخاص بالمنصة لضمان أن خطواتك قد تكللت بالنجاح وتجاوزت العقبة.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
