import { PublicLayout } from "@/components/layout/PublicLayout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitExploitationReport } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const schema = z.object({
  reporterNameOrAlias: z.string().min(2, "الرجاء إدخال الاسم أو اسم مستعار"),
  contactMethod: z.string().optional(),
  notes: z.string().min(10, "الرجاء كتابة تفاصيل المشكلة بوضوح"),
  screenshotData: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function Report() {
  const [submitted, setSubmitted] = useState(false);
  const { mutate, isPending } = useSubmitExploitationReport();
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: FormValues) => {
    mutate({ data }, {
      onSuccess: () => setSubmitted(true)
    });
  };

  return (
    <PublicLayout>
      <div className="pt-16 pb-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-4">الإبلاغ عن استغلال</h1>
          <p className="text-muted-foreground text-lg">
            هذه المنصة مجانية 100%. إذا طلب منك أي شخص مقابلاً مادياً أو تصرف بشكل يسيء للطلاب باسم المبادرة، يرجى إبلاغنا هنا. هذه المعلومات تعامل بسرية تامة.
          </p>
        </div>

        {submitted ? (
          <div className="bg-green-50 rounded-2xl p-12 text-center border border-green-100">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-green-800 mb-4">تم إرسال البلاغ بنجاح</h2>
            <p className="text-green-700 text-lg">نشكرك على حرصك. سيقوم الفريق بمراجعة البلاغ فوراً واتخاذ الإجراءات اللازمة.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">الاسم (أو اسم مستعار) *</label>
                <input 
                  {...register("reporterNameOrAlias")}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-gray-50"
                  placeholder="كيف تفضل أن نناديك؟"
                />
                {errors.reporterNameOrAlias && <p className="text-destructive text-xs mt-1 font-semibold">{errors.reporterNameOrAlias.message}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-primary mb-2">طريقة التواصل (اختياري)</label>
                <input 
                  {...register("contactMethod")}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-gray-50"
                  placeholder="بريد إلكتروني، رقم هاتف، إلخ."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-2">تفاصيل الاستغلال المزعوم *</label>
              <textarea 
                {...register("notes")}
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-gray-50"
                placeholder="يرجى كتابة ما حدث معك بالتفصيل..."
              ></textarea>
              {errors.notes && <p className="text-destructive text-xs mt-1 font-semibold">{errors.notes.message}</p>}
            </div>

            <button 
              type="submit"
              disabled={isPending}
              className="w-full py-4 bg-destructive text-white rounded-xl font-bold text-lg hover:bg-destructive/90 transition-all disabled:opacity-50"
            >
              {isPending ? "جاري الإرسال..." : "إرسال البلاغ السري"}
            </button>
          </form>
        )}
      </div>
    </PublicLayout>
  );
}
