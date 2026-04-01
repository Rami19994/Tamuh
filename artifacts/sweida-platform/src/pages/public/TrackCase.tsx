import { PublicLayout } from "@/components/layout/PublicLayout";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTrackCase, useConfirmEmailSent } from "@workspace/api-client-react";
import {
  Search, Info, Mail, CheckCircle, XCircle, AlertTriangle,
  Upload, Clock, Star, RefreshCw, Inbox, MessageSquare,
} from "lucide-react";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const schema = z.object({
  caseNumber: z.string().min(3, "رقم الطلب مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
});

type FormValues = z.infer<typeof schema>;

export default function TrackCase() {
  const [result, setResult] = useState<any>(null);
  const [trackedEmail, setTrackedEmail] = useState("");
  const [lastFormValues, setLastFormValues] = useState<FormValues | null>(null);

  // Confirm-sent flow state
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  // Follow-up response flow state
  const [followUpChoice, setFollowUpChoice] = useState<"yes" | "still_waiting" | null>(null);
  const [followUpFile, setFollowUpFile] = useState<File | null>(null);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState("");

  const { mutate, isPending } = useTrackCase();
  const confirmMutate = useConfirmEmailSent();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const refreshCase = (values: FormValues) => {
    mutate(
      { data: values },
      {
        onSuccess: (res) => {
          setResult(res);
          setConfirmStep(false);
          setFollowUpChoice(null);
          setFollowUpFile(null);
          setFollowUpError("");
        },
      }
    );
  };

  const onSubmit = (data: FormValues) => {
    setTrackedEmail(data.email);
    setLastFormValues(data);
    setScreenshotFile(null);
    setConfirmStep(false);
    setFollowUpChoice(null);
    setFollowUpFile(null);
    setFollowUpError("");
    refreshCase(data);
  };

  const handleRefresh = () => {
    if (!lastFormValues) return;
    refreshCase(lastFormValues);
  };

  const handleConfirmSent = async () => {
    if (!result) return;
    if (screenshotFile) {
      try {
        const fd = new FormData();
        fd.append("file", screenshotFile);
        fd.append("email", trackedEmail);
        fd.append("category", "sent_screenshot");
        await fetch(`${API_BASE}/upload/${result.caseNumber}`, { method: "POST", body: fd });
      } catch { /* Non-blocking */ }
    }
    confirmMutate.mutate(
      { caseNumber: result.caseNumber, data: { email: trackedEmail } },
      { onSuccess: () => lastFormValues && refreshCase(lastFormValues) }
    );
  };

  const handleFollowUpStillWaiting = () => {
    // "Pending" is local-only — no DB save.
    // When the student refreshes or searches again, the two options reappear.
    setFollowUpChoice("still_waiting");
  };

  const handleFollowUpYesSubmit = async () => {
    if (!result || !trackedEmail) return;
    if (!followUpFile) {
      setFollowUpError("يرجى إرفاق لقطة الشاشة أولاً.");
      return;
    }
    setFollowUpSubmitting(true);
    setFollowUpError("");
    try {
      // 1. Upload the screenshot
      const fd = new FormData();
      fd.append("file", followUpFile);
      fd.append("email", trackedEmail);
      fd.append("category", "follow_up_reply_screenshot");
      const uploadRes = await fetch(`${API_BASE}/upload/${result.caseNumber}`, {
        method: "POST",
        body: fd,
      });
      if (!uploadRes.ok) throw new Error("فشل رفع الملف");

      // 2. Record the follow-up response
      const responseRes = await fetch(`${API_BASE}/cases/${result.caseNumber}/follow-up-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trackedEmail, response: "yes" }),
      });
      if (!responseRes.ok) throw new Error("فشل تسجيل الرد");

      if (lastFormValues) refreshCase(lastFormValues);
    } catch (err: any) {
      setFollowUpError(err.message || "حدث خطأ. يرجى المحاولة مجدداً.");
    } finally {
      setFollowUpSubmitting(false);
    }
  };

  const status = result?.status;
  const followUpResponse = result?.followUpResponse;

  const isRejected = status === "rejected";
  const isClosed = status === "closed";
  const isCompleted = status === "completed";
  const isSentByStudent = status === "sent_by_student";
  const isFollowUp = status === "follow_up_in_progress";
  const isNeedMoreInfo = status === "need_more_info";
  const isAwaitingSending = status === "awaiting_student_sending";

  // Draft is relevant for all stages EXCEPT follow_up and later
  const hasDraftVisible =
    !!result?.emailDraft &&
    !isRejected && !isClosed && !isFollowUp &&
    !isSentByStudent;

  const isStandardInstruction =
    !isRejected && !isClosed && !isCompleted && !isSentByStudent &&
    !isFollowUp && !isNeedMoreInfo;

  return (
    <PublicLayout>
      <div className="pt-16 pb-24 max-w-3xl mx-auto px-4 sm:px-6 min-h-[70vh]">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-primary mb-4">متابعة حالة الطلب</h1>
          <p className="text-muted-foreground text-lg">
            أدخل رقم الطلب والبريد الإلكتروني الذي سجلت به لمعرفة آخر التحديثات والتعليمات.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col md:flex-row gap-4 mb-8"
        >
          <div className="flex-1">
            <input
              {...register("caseNumber")}
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none font-mono text-left placeholder:text-right"
              placeholder="رقم الطلب (مثال: CASE-2026-0001)"
            />
            {errors.caseNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.caseNumber.message}</p>
            )}
          </div>
          <div className="flex-1">
            <input
              {...register("email")}
              dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-primary/20 outline-none text-left placeholder:text-right"
              placeholder="البريد الإلكتروني الجامعي"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
          >
            <Search className="w-5 h-5" />
            {isPending ? "جاري البحث..." : "بحث"}
          </button>
        </form>

        {result && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Status Header */}
            <div className={`p-6 border-b border-border ${
              isRejected ? "bg-red-50" : isClosed ? "bg-gray-50"
              : isCompleted ? "bg-emerald-50" : "bg-gray-50"
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">رقم الطلب</p>
                  <p className="text-2xl font-black font-mono text-primary">{result.caseNumber}</p>
                </div>
                <div className="text-left flex flex-col items-end gap-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">الحالة الحالية</p>
                  <div
                    className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                      STATUS_COLORS[result.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {STATUS_LABELS[result.status] || result.statusLabel}
                  </div>
                  {lastFormValues && (
                    <button
                      onClick={handleRefresh}
                      disabled={isPending}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
                      تحديث
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">

              {/* ── REJECTED ── */}
              {isRejected && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <XCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-red-800 text-lg mb-2">لم نتمكن من معالجة طلبك</h3>
                      <p className="text-red-700 text-sm leading-relaxed mb-3">{result.currentInstruction}</p>
                      <div className="bg-red-100 rounded-xl p-3 text-xs text-red-600 font-medium">
                        إذا كان لديك وثائق إضافية أو تعتقد أن هناك خطأ، يمكنك تقديم طلب جديد مع توضيح إضافي.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── CLOSED ── */}
              {isClosed && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <Inbox className="w-8 h-8 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-gray-700 text-lg mb-2">تم إغلاق هذه الحالة</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{result.currentInstruction}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── COMPLETED ── */}
              {isCompleted && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <Star className="w-8 h-8 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-emerald-800 text-lg mb-2">تمت معالجة حالتك بنجاح</h3>
                      <p className="text-emerald-700 text-sm leading-relaxed">{result.currentInstruction}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SENT BY STUDENT ── */}
              {isSentByStudent && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-8 h-8 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-cyan-800 text-lg mb-2">تم تسجيل إرسالك بنجاح</h3>
                      <p className="text-cyan-700 text-sm leading-relaxed">{result.currentInstruction}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── FOLLOW UP IN PROGRESS — interactive response flow ── */}
              {isFollowUp && (
                <div className="space-y-6">

                  {/* Already confirmed email received (DB-persisted) */}
                  {followUpResponse === "yes" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                      <div className="flex items-start gap-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-bold text-emerald-800 text-lg mb-2">تم استلام ردك بنجاح</h3>
                          <p className="text-emerald-700 text-sm leading-relaxed">
                            تم استلام لقطة الشاشة المرفقة وسيتم مراجعتها من قبل الفريق لتحديد النتيجة النهائية.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Question + choices — shown when not yet confirmed via DB
                      (null response OR old "still_waiting" from DB — both show the options again) */}
                  {followUpResponse !== "yes" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                      <div className="flex items-start gap-4 mb-5">
                        <MessageSquare className="w-7 h-7 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-bold text-blue-800 text-lg mb-1">المتابعة جارية مع الجهات المعنية</h3>
                          <p className="text-blue-700 text-sm">{result.currentInstruction}</p>
                        </div>
                      </div>

                      <div className="border-t border-blue-200 pt-5">
                        <p className="font-bold text-blue-900 text-base mb-4">
                          هل وصلك بريد إلكتروني بخصوص طلبك؟
                        </p>

                        {/* Initial choice buttons — reappear every time page loads */}
                        {!followUpChoice && (
                          <div className="flex gap-3 flex-wrap">
                            <button
                              onClick={() => setFollowUpChoice("yes")}
                              className="flex-1 min-w-[140px] py-3 px-6 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Mail className="w-5 h-5" />
                              استلمت بريداً إلكترونياً
                            </button>
                            <button
                              onClick={handleFollowUpStillWaiting}
                              className="flex-1 min-w-[140px] py-3 px-6 bg-white border-2 border-blue-300 text-blue-800 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                            >
                              <Clock className="w-5 h-5" />
                              في انتظار
                            </button>
                          </div>
                        )}

                        {/* "Pending" chosen — local message only, no DB save */}
                        {followUpChoice === "still_waiting" && (
                          <div className="bg-white border border-blue-200 rounded-xl p-5 flex items-start gap-3">
                            <Clock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-bold text-blue-800 mb-1">في انتظار رد</p>
                              <p className="text-blue-700 text-sm leading-relaxed">
                                يمكنك العودة لاحقاً عند استلام أي تحديث عبر البريد الإلكتروني.
                              </p>
                            </div>
                            <button
                              onClick={() => setFollowUpChoice(null)}
                              className="text-xs text-blue-500 hover:underline flex-shrink-0 font-medium"
                            >
                              رجوع
                            </button>
                          </div>
                        )}

                        {/* "Email Received" chosen — screenshot upload */}
                        {followUpChoice === "yes" && (
                          <div className="bg-white rounded-xl border border-emerald-200 p-5 space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                <Mail className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-bold text-emerald-800 text-sm">
                                  يرجى إرفاق لقطة شاشة للبريد الإلكتروني الذي وصلك
                                  <span className="text-red-500 mr-1">*</span>
                                </p>
                                <p className="text-xs text-emerald-700">صورة أو ملف PDF — الحجم الأقصى 10 ميغابايت</p>
                              </div>
                            </div>

                            <label className={`flex flex-col items-center justify-center gap-3 w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                              followUpFile
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/50"
                            }`}>
                              <Upload className={`w-8 h-8 ${followUpFile ? "text-emerald-500" : "text-gray-400"}`} />
                              <span className="text-sm font-medium text-center text-gray-700">
                                {followUpFile
                                  ? followUpFile.name
                                  : "اضغط هنا لرفع لقطة الشاشة"}
                              </span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  setFollowUpFile(e.target.files?.[0] || null);
                                  setFollowUpError("");
                                }}
                              />
                            </label>

                            {followUpError && (
                              <p className="text-red-600 text-sm font-medium">{followUpError}</p>
                            )}

                            <div className="flex gap-3">
                              <button
                                onClick={handleFollowUpYesSubmit}
                                disabled={followUpSubmitting || !followUpFile}
                                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              >
                                <Upload className="w-5 h-5" />
                                {followUpSubmitting ? "جاري الإرسال..." : "إرسال لقطة الشاشة"}
                              </button>
                              <button
                                onClick={() => { setFollowUpChoice(null); setFollowUpFile(null); setFollowUpError(""); }}
                                className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                              >
                                رجوع
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── NEED MORE INFO ── */}
              {isNeedMoreInfo && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <AlertTriangle className="w-8 h-8 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-bold text-orange-800 text-lg mb-2">مطلوب منك معلومات إضافية</h3>
                      <p className="text-orange-700 text-sm leading-relaxed mb-3">{result.currentInstruction}</p>
                      <div className="bg-orange-100 rounded-xl p-3 text-xs text-orange-700 font-medium">
                        يرجى تجهيز الوثائق المطلوبة وإرسالها عبر البريد الإلكتروني أو رفعها عند طلب الفريق.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STANDARD INSTRUCTION (received, under_review, approved, draft_prepared, etc.) ── */}
              {isStandardInstruction && (
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-primary mb-4">
                    <Info className="w-6 h-6 text-secondary" />
                    التعليمات الحالية
                  </h3>
                  <div className="bg-blue-50 p-6 rounded-2xl text-blue-900 leading-relaxed font-medium">
                    {result.currentInstruction}
                  </div>
                </div>
              )}

              {/* ── EMAIL DRAFT (shown only for stages before follow-up) ── */}
              {hasDraftVisible && (
                <div>
                  <h3 className="flex items-center gap-2 text-xl font-bold text-primary mb-4">
                    <Mail className="w-6 h-6 text-secondary" />
                    مسودة البريد الإلكتروني المخصصة لك
                  </h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800 font-medium">
                    <AlertTriangle className="inline w-4 h-4 ml-1" />
                    هذه المسودة مخصصة لك شخصياً. يرجى عدم مشاركتها مع أحد. أرسلها من بريدك الجامعي فقط.
                  </div>
                  <div
                    className="bg-white border-2 border-gray-200 p-6 rounded-2xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-gray-800 select-text"
                    dir="ltr"
                  >
                    {result.emailDraft}
                  </div>
                </div>
              )}

              {/* ── AWAITING STUDENT SENDING — confirm action ── */}
              {isAwaitingSending && (
                <div className="pt-2 border-t border-border">
                  {!confirmStep ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                      <h3 className="font-bold text-amber-900 text-lg mb-2">هل قمت بإرسال البريد الإلكتروني؟</h3>
                      <p className="text-amber-800 mb-6 text-sm leading-relaxed">
                        بعد نسخ المسودة وإرسالها إلى الجامعة من بريدك الجامعي الشخصي، يرجى تأكيد ذلك هنا.
                      </p>
                      <button
                        onClick={() => setConfirmStep(true)}
                        className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-secondary/90 transition-all"
                      >
                        <CheckCircle className="w-5 h-5" />
                        نعم، لقد أرسلت البريد
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                      <h3 className="font-bold text-emerald-900 text-lg mb-4 flex items-center gap-2">
                        <Upload className="w-5 h-5" />
                        رفع لقطة شاشة التأكيد
                      </h3>
                      <p className="text-emerald-800 mb-5 text-sm leading-relaxed">
                        يرجى رفع لقطة شاشة من صندوق "المُرسَل" في بريدك تُثبت إرسال البريد إلى الجامعة.
                      </p>
                      <div className="space-y-4">
                        <label className="flex items-center justify-center gap-3 w-full p-4 border-2 border-dashed border-emerald-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-100 transition-colors">
                          <Upload className="w-5 h-5 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-800">
                            {screenshotFile ? screenshotFile.name : "اضغط لاختيار الصورة (اختياري)"}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                          />
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={handleConfirmSent}
                            disabled={confirmMutate.isPending}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-secondary text-white rounded-xl font-bold hover:bg-secondary/90 transition-all disabled:opacity-50"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {confirmMutate.isPending ? "جاري التأكيد..." : "تأكيد الإرسال"}
                          </button>
                          <button
                            onClick={() => setConfirmStep(false)}
                            className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                          >
                            رجوع
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
