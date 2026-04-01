import { PublicLayout } from "@/components/layout/PublicLayout";
import { ShieldCheck, Lock, EyeOff } from "lucide-react";

export default function Privacy() {
  return (
    <PublicLayout>
      <div className="pt-16 pb-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <ShieldCheck className="w-16 h-16 text-secondary mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-primary mb-4">الخصوصية والأمان</h1>
          <p className="text-xl text-muted-foreground">نحن نأخذ خصوصيتك على محمل الجد. حماية بياناتك هي أولويتنا القصوى.</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <Lock className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold text-primary mb-3">جمع بيانات بالحد الأدنى</h3>
            <p className="text-muted-foreground leading-relaxed">
              نحن نطلب فقط المعلومات الضرورية جداً لمعالجة حالتك وتقديم المساعدة لك. لن نطلب أبداً كلمات مرور لحساباتك الجامعية.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <EyeOff className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-xl font-bold text-primary mb-3">وصول مقيد للمعلومات</h3>
            <p className="text-muted-foreground leading-relaxed">
              لا يتم مشاركة بياناتك أبداً مع جهات خارجية، ولا يطلع عليها سوى أعضاء فريق الدعم المخصصين لمعالجة حالتك وبسرية تامة.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-2xl p-8 text-primary border border-blue-100">
          <h2 className="text-2xl font-bold mb-4">التزامنا تجاهك</h2>
          <ul className="space-y-3 list-disc list-inside ms-4 text-primary/80 font-medium">
            <li>كافة المراسلات تتم عبر قنوات مشفرة وآمنة.</li>
            <li>يحق لك في أي وقت طلب إيقاف المساعدة وحذف بيانات طلبك من سجلاتنا.</li>
            <li>نلتزم بعدم استخدام بيانات الاتصال الخاصة بك لأي أغراض أخرى غير متابعة حالتك.</li>
          </ul>
        </div>
      </div>
    </PublicLayout>
  );
}
