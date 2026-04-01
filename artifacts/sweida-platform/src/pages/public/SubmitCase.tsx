import { PublicLayout } from "@/components/layout/PublicLayout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSubmitCase } from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { CheckCircle2, Copy, Upload, FileText, Image, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { GOVERNORATES } from "@/lib/constants";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const schema = z.object({
  fullName: z.string().min(3, "الاسم الكامل مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  studentId: z.string().optional(),
  caseDescription: z.string().min(20, "الرجاء شرح المشكلة بوضوح أكثر (20 حرف على الأقل)"),
  canAccessCertificate: z.enum(["yes", "no", "partially"], {
    required_error: "الرجاء تحديد قدرتك على الوصول للوثائق",
  }),
  governorate: z.string().min(1, "الرجاء تحديد المنطقة"),
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: "يجب الموافقة على شروط الخصوصية للمتابعة" }),
  }),
});

type FormValues = z.infer<typeof schema>;

function FileUploadField({
  label,
  sublabel,
  icon: Icon,
  accept,
  onChange,
  file,
}: {
  label: string;
  sublabel?: string;
  icon: typeof Upload;
  accept: string;
  onChange: (f: File | null) => void;
  file: File | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm font-bold text-primary mb-2">
        {label}
        {sublabel && <span className="text-muted-foreground font-normal mr-1 text-xs">({sublabel})</span>}
      </label>
      <div
        onClick={() => ref.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-5 cursor-pointer transition-colors flex items-center gap-4 ${
          file
            ? "border-secondary bg-secondary/5"
            : "border-border hover:border-primary/40 bg-gray-50"
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${file ? "bg-secondary/20" : "bg-gray-100"}`}>
          <Icon className={`w-5 h-5 ${file ? "text-secondary" : "text-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          {file ? (
            <>
              <p className="font-bold text-sm text-secondary truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB — انقر للتغيير
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-sm text-gray-700">انقر لاختيار الملف</p>
              <p className="text-xs text-muted-foreground">أو اسحب الملف وأفلته هنا</p>
            </>
          )}
        </div>
        {file && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              if (ref.current) ref.current.value = "";
            }}
            className="text-xs text-red-500 hover:text-red-700 font-bold flex-shrink-0"
          >
            إزالة
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null;
          onChange(f);
        }}
      />
    </div>
  );
}

async function uploadFile(
  file: File,
  caseNumber: string,
  email: string,
  category: string
): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("caseNumber", caseNumber);
  fd.append("email", email);
  fd.append("category", category);
  await fetch(`${API_BASE}/upload/${caseNumber}`, { method: "POST", body: fd });
}

export default function SubmitCase() {
  const [successData, setSuccessData] = useState<{ caseNumber: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // File state — store actual File objects
  const [idImage, setIdImage] = useState<File | null>(null);
  const [gradesScreenshot, setGradesScreenshot] = useState<File | null>(null);
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);

  const { mutate, isPending } = useSubmitCase();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    mutate(
      { data },
      {
        onSuccess: async (res) => {
          const email = data.email;
          const caseNumber = res.caseNumber;
          const filesToUpload = [
            { file: idImage, category: "id_image" },
            { file: gradesScreenshot, category: "grades_screenshot" },
            { file: supportingDoc, category: "supporting_doc" },
          ].filter((f) => f.file !== null);

          if (filesToUpload.length > 0) {
            setUploadingFiles(true);
            try {
              await Promise.all(
                filesToUpload.map(({ file, category }) =>
                  uploadFile(file!, caseNumber, email, category)
                )
              );
            } catch {
              // Files upload failure is non-blocking — case is already created
            } finally {
              setUploadingFiles(false);
            }
          }
          setSuccessData({ caseNumber });
        },
        onError: () => {
          alert("حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى.");
        },
      }
    );
  };

  const copyToClipboard = () => {
    if (successData) {
      navigator.clipboard.writeText(successData.caseNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (successData) {
    return (
      <PublicLayout>
        <div className="pt-16 pb-24 max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-3xl p-10 text-center shadow-2xl border border-gray-100">
            <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-secondary" />
            </div>
            <h1 className="text-3xl font-bold text-primary mb-3">تم استلام طلبك بنجاح!</h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              يرجى الاحتفاظ برقم الطلب التالي. ستحتاجه لمتابعة حالتك لاحقاً.
            </p>

            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-border mb-8 flex flex-col items-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">رقم الطلب الخاص بك</span>
              <div className="text-4xl font-black text-primary tracking-widest mb-4 font-mono">
                {successData.caseNumber}
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 text-sm font-bold text-secondary bg-secondary/10 px-5 py-2 rounded-lg hover:bg-secondary/20 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copied ? "تم النسخ ✓" : "نسخ الرقم"}
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-right">
              <p className="text-amber-800 text-sm font-semibold">
                📌 يرجى حفظ رقم الطلب في مكان آمن. ستحتاجه مع بريدك الإلكتروني لمتابعة حالتك.
              </p>
            </div>

            <Link
              href="/track"
              className="inline-flex items-center justify-center w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 transition-all"
            >
              الانتقال لصفحة متابعة الحالة
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="pt-16 pb-24 max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-primary mb-4">تقديم طلب مساعدة جديد</h1>
          <p className="text-muted-foreground text-lg">
            الرجاء تعبئة المعلومات أدناه بدقة. جميع البيانات ستبقى سرية ولن تستخدم إلا لمساعدتك.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-gray-100 space-y-10"
        >
          {/* ── Section 1: Personal Info ── */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-primary border-b border-border pb-3">
              المعلومات الشخصية
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">الاسم الكامل *</label>
                <input
                  {...register("fullName")}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 outline-none"
                  placeholder="محمد عبد الله السعيد"
                />
                {errors.fullName && (
                  <p className="text-red-500 text-xs mt-1 font-semibold">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-primary mb-2">
                  البريد الإلكتروني (المسجل في الجامعة) *
                </label>
                <input
                  type="email"
                  {...register("email")}
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 outline-none text-left"
                  placeholder="student@uopeople.edu"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1 font-semibold">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-primary mb-2">
                  الرقم الجامعي (Student ID)
                  <span className="text-muted-foreground font-normal mr-1 text-xs">(اختياري)</span>
                </label>
                <input
                  {...register("studentId")}
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 outline-none text-left"
                  placeholder="UOP-2024-XXXX"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-primary mb-2">المنطقة / المحافظة *</label>
                <select
                  {...register("governorate")}
                  className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 outline-none cursor-pointer appearance-none"
                  defaultValue=""
                >
                  <option value="" disabled>اختر المنطقة...</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                {errors.governorate && (
                  <p className="text-red-500 text-xs mt-1 font-semibold">{errors.governorate.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2: Case Details ── */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-primary border-b border-border pb-3">
              تفاصيل الحالة
            </h3>

            <div>
              <label className="block text-sm font-bold text-primary mb-3">
                هل تستطيع الوصول إلى وثيقتك الثانوية حالياً؟ *
              </label>
              <div className="space-y-3">
                {[
                  { value: "yes", label: "نعم، أملكها ويمكنني تصويرها أو إرسالها" },
                  { value: "no", label: "لا، لا أستطيع الوصول إليها إطلاقاً بسبب الظروف الأمنية" },
                  { value: "partially", label: "أملك صورة قديمة أو نسخة جزئية فقط" },
                ].map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 p-3.5 border border-border rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      value={value}
                      {...register("canAccessCertificate")}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="font-medium text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              {errors.canAccessCertificate && (
                <p className="text-red-500 text-xs mt-2 font-semibold">{errors.canAccessCertificate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-primary mb-2">اشرح مشكلتك بالتفصيل *</label>
              <textarea
                {...register("caseDescription")}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 outline-none resize-none"
                placeholder="أذكر متى تخرجت، اسم مدرستك، والعقبة التي تواجهها مع الجامعة بخصوص المستندات..."
              />
              {errors.caseDescription && (
                <p className="text-red-500 text-xs mt-1 font-semibold">{errors.caseDescription.message}</p>
              )}
            </div>
          </div>

          {/* ── Section 3: Document Uploads ── */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-primary border-b border-border pb-3 mb-1">
                رفع الوثائق
              </h3>
              <p className="text-sm text-muted-foreground">
                يرجى رفع الوثائق المتاحة لديك. كلما كانت الوثائق أكثر، كان بإمكاننا مساعدتك بشكل أفضل.
              </p>
            </div>

            <FileUploadField
              label="صورة الهوية الشخصية *"
              sublabel="صورة واضحة للوجهين"
              icon={Image}
              accept="image/*,.pdf"
              file={idImage}
              onChange={setIdImage}
            />

            <FileUploadField
              label="لقطة شاشة من كشف العلامات أو الدرجات *"
              sublabel="إن وجدت — من الجامعة أو المدرسة"
              icon={FileText}
              accept="image/*,.pdf"
              file={gradesScreenshot}
              onChange={setGradesScreenshot}
            />

            <FileUploadField
              label="وثائق داعمة إضافية"
              sublabel="اختياري — شهادات، رسائل رسمية، وثائق أخرى"
              icon={Upload}
              accept="image/*,.pdf,.doc,.docx"
              file={supportingDoc}
              onChange={setSupportingDoc}
            />
          </div>

          {/* ── Section 4: Consent ── */}
          <div className="pt-2">
            <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-50/80 transition-colors">
              <input
                type="checkbox"
                {...register("consentConfirmed")}
                className="w-5 h-5 accent-primary mt-0.5 flex-shrink-0"
              />
              <div className="text-sm font-medium text-blue-900 leading-relaxed">
                أفهم أن هذه الخدمة مجانية وسرية تماماً، وأوافق على عدم مشاركة أي تعليمات مخصصة أو تفاصيل التواصل التي تُقدَّم لي مع أي طرف آخر.
              </div>
            </label>
            {errors.consentConfirmed && (
              <p className="text-red-500 text-xs mt-2 font-semibold">{errors.consentConfirmed.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || uploadingFiles}
            className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary/90 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {(isPending || uploadingFiles) && <Loader2 className="w-5 h-5 animate-spin" />}
            {uploadingFiles ? "جاري رفع الملفات..." : isPending ? "جاري الإرسال..." : "تأكيد وإرسال الطلب"}
          </button>
        </form>
      </div>
    </PublicLayout>
  );
}
