import { AdminLayout } from "@/components/layout/AdminLayout";
import { useRoute, useLocation } from "wouter";
import { useAdminGetCase } from "@workspace/api-client-react";
import { getAdminHeaders, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Save, FileText, Check, ThumbsUp, ThumbsDown,
  Flag, FlagOff, User, Paperclip, ChevronRight,
  Mail, AlertTriangle, Download, X, ZoomIn, CheckCircle, XCircle,
} from "lucide-react";
import { format } from "date-fns";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const TEAM_MEMBERS = [
  "فاطمة المصري",
  "أحمد الخوري",
  "سمير النجار",
  "هالة عمران",
  "المدير العام",
];

export default function AdminCaseDetail() {
  const [, params] = useRoute("/admin/cases/:caseNumber");
  const [, setLocation] = useLocation();
  const caseNumber = params?.caseNumber || "";

  const { data: caseData, isLoading, refetch } = useAdminGetCase(caseNumber, {
    request: { headers: getAdminHeaders() },
    query: { enabled: !!caseNumber },
  });

  // UI state
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [studentInstructionOverride, setStudentInstructionOverride] = useState("");
  const [showNeedMoreInfo, setShowNeedMoreInfo] = useState(false);
  const [needMoreInfoText, setNeedMoreInfoText] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [assignTo, setAssignTo] = useState("");

  // Feedback banners
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionPending, setActionPending] = useState(false);

  // Email log (read-only sidebar)
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [emailLogLoading, setEmailLogLoading] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxType, setLightboxType] = useState<"image" | "pdf" | null>(null);
  const [lightboxName, setLightboxName] = useState("");

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("adminToken");
    return token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  }, []);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError("");
    setTimeout(() => setActionSuccess(""), 5000);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setActionSuccess("");
    setTimeout(() => setActionError(""), 7000);
  };

  const loadEmailLog = useCallback(async () => {
    if (!caseNumber) return;
    setEmailLogLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/email-log`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setEmailLog(data.notifications || []);
    } finally {
      setEmailLogLoading(false);
    }
  }, [caseNumber, getAuthHeaders]);

  const loadAttachments = useCallback(async () => {
    if (!caseNumber) return;
    setAttachmentsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/attachments`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) return;
      const data = await res.json();
      setAttachments(data.attachments || []);
    } catch {
      // non-blocking
    } finally {
      setAttachmentsLoading(false);
    }
  }, [caseNumber, getAuthHeaders]);

  useEffect(() => {
    loadEmailLog();
    loadAttachments();
  }, [loadEmailLog, loadAttachments]);

  const handleViewAttachment = (attachment: any) => {
    const token = localStorage.getItem("adminToken");
    const url = `${API_BASE}${attachment.viewUrl}`;
    const isImage = attachment.mimeType?.startsWith("image/");
    const isPdf = attachment.mimeType === "application/pdf";
    if (isImage || isPdf) {
      setLightboxUrl(`${url}?token=${token}`);
      setLightboxType(isImage ? "image" : "pdf");
      setLightboxName(attachment.fileName);
    } else {
      window.open(`${url}?token=${token}`, "_blank");
    }
  };

  const handleDownloadAttachment = (attachment: any) => {
    const token = localStorage.getItem("adminToken");
    const url = `${API_BASE}${attachment.downloadUrl}?token=${token}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  };

  // ── Core status update — no email dependency ──
  const doUpdateStatus = async (
    status: string,
    note?: string,
    instruction?: string
  ) => {
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status,
          note,
          sendEmailNow: false,
          studentInstruction: instruction || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await refetch();
      await loadEmailLog();
      return true;
    } catch (e: any) {
      showError("فشل تحديث الحالة: " + (e.message || "خطأ غير معروف"));
      return false;
    } finally {
      setActionPending(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    const ok = await doUpdateStatus(newStatus, statusNote || undefined, studentInstructionOverride || undefined);
    if (ok) {
      setNewStatus("");
      setStatusNote("");
      setStudentInstructionOverride("");
      showSuccess("تم تحديث حالة الطلب بنجاح");
    }
  };

  const handleApprove = async () => {
    const ok = await doUpdateStatus("approved_for_guidance", "تمت الموافقة على الحالة للتوجيه");
    if (ok) showSuccess("تمت الموافقة على الحالة بنجاح");
  };

  const handleNeedMoreInfo = async () => {
    if (!needMoreInfoText.trim()) {
      showError("يرجى تحديد المعلومات المطلوبة من الطالب");
      return;
    }
    const ok = await doUpdateStatus(
      "need_more_info",
      `طلب معلومات إضافية: ${needMoreInfoText}`,
      needMoreInfoText
    );
    if (ok) {
      setNeedMoreInfoText("");
      setShowNeedMoreInfo(false);
      showSuccess("تم إرسال طلب المعلومات الإضافية للطالب");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showError("يرجى إدخال سبب الرفض");
      return;
    }
    const ok = await doUpdateStatus(
      "rejected",
      `سبب الرفض: ${rejectReason}`,
    );
    if (ok) {
      // Also save reject reason as internal note
      await fetch(`${API_BASE}/admin/cases/${caseNumber}/notes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: `[سبب الرفض] ${rejectReason}` }),
      });
      setRejectReason("");
      setShowRejectModal(false);
      showSuccess("تم رفض الحالة وتسجيل السبب");
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) return;
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/notes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: noteContent }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNoteContent("");
      await refetch();
      showSuccess("تمت إضافة الملاحظة");
    } catch (e: any) {
      showError("فشل إضافة الملاحظة: " + e.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleGenerateDraft = async () => {
    const content = draftContent || caseData?.currentDraft || "";
    if (!content.trim()) {
      showError("يرجى كتابة نص المسودة أولاً");
      return;
    }
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/draft`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ draftContent: content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refetch();
      showSuccess("تم حفظ المسودة وستظهر للطالب في صفحة التتبع");
    } catch (e: any) {
      showError("فشل حفظ المسودة: " + e.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTo) return;
    setActionPending(true);
    try {
      const res = await fetch(`${API_BASE}/admin/cases/${caseNumber}/assign`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ assignedTo: assignTo }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssignTo("");
      await refetch();
      showSuccess("تم تعيين المسؤول بنجاح");
    } catch (e: any) {
      showError("فشل التعيين: " + e.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleFlag = async () => {
    const flagged = !caseData?.isFlagged;
    try {
      await fetch(`${API_BASE}/admin/cases/${caseNumber}/flag`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ flagged }),
      });
      await refetch();
      showSuccess(flagged ? "تم تعليم الحالة كمشبوهة" : "تم إلغاء تعليم الحالة");
    } catch (e: any) {
      showError("فشل تعديل التبليغ");
    }
  };

  // ── Derived state ──
  const isApproved = caseData
    ? ["approved_for_guidance", "draft_prepared", "awaiting_student_sending",
       "sent_by_student", "follow_up_in_progress", "completed"].includes(caseData.status)
    : false;
  const isRejected = caseData?.status === "rejected";
  const isClosed = caseData
    ? ["completed", "closed", "rejected"].includes(caseData.status)
    : false;

  // ── Conditional renders AFTER all hooks ──
  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!caseData) {
    return (
      <AdminLayout>
        <div className="text-center p-12 bg-white rounded-2xl border border-red-100 text-red-500 font-bold">
          لم يتم العثور على الحالة
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* ── Lightbox Modal ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => { setLightboxUrl(null); setLightboxType(null); }}
        >
          <div
            className="relative bg-white rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
              <span className="font-bold text-sm text-gray-800 truncate">{lightboxName}</span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxUrl}
                  download={lightboxName}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3.5 h-3.5" />
                  تنزيل
                </a>
                <button
                  onClick={() => { setLightboxUrl(null); setLightboxType(null); }}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-gray-100 min-h-[400px]">
              {lightboxType === "image" ? (
                <img src={lightboxUrl} alt={lightboxName} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg" />
              ) : lightboxType === "pdf" ? (
                <iframe
                  src={lightboxUrl}
                  className="w-full h-[75vh] border-0 rounded-lg"
                  title={lightboxName}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-red-700 mb-2">تأكيد رفض الحالة</h3>
            <p className="text-gray-600 text-sm mb-4">سيُسجَّل سبب الرفض داخلياً وستُحدَّث حالة الطلب. يرجى كتابة سبب واضح ومحترم.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl border border-gray-200 focus:border-red-400 outline-none text-sm mb-4 resize-none"
              placeholder="مثال: لم يتم تقديم وثائق كافية..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionPending}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {actionPending ? "جاري..." : "تأكيد الرفض"}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => setLocation("/admin")} className="hover:text-primary transition-colors">
          لوحة التحكم
        </button>
        <ChevronRight className="w-4 h-4 rotate-180" />
        <span className="font-bold text-primary">{caseData.caseNumber}</span>
      </div>

      {/* ── Success / Error banners ── */}
      {actionSuccess && (
        <div className="mb-4 flex items-center gap-3 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="mb-4 flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-bold text-sm">
          <XCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          {actionError}
        </div>
      )}

      {/* Header card */}
      <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-primary mb-1">طلب {caseData.caseNumber}</h2>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[caseData.status] || "bg-gray-100 text-gray-800"}`}>
                {STATUS_LABELS[caseData.status] || caseData.statusLabel}
              </span>
              {caseData.isFlagged && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> مُبلَّغ عنه
                </span>
              )}
              {caseData.assignedTo && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 flex items-center gap-1">
                  <User className="w-3 h-3" /> {caseData.assignedTo}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleFlag}
              disabled={actionPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 ${
                caseData.isFlagged
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {caseData.isFlagged ? <FlagOff className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
              {caseData.isFlagged ? "إلغاء التبليغ" : "تبليغ مشبوه"}
            </button>

            {!isClosed && !isApproved && !isRejected && (
              <button
                onClick={handleApprove}
                disabled={actionPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {actionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                قبول الحالة
              </button>
            )}

            {!isClosed && !isRejected && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <ThumbsDown className="w-4 h-4" />
                رفض الحالة
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Follow-up review needed banner — shown whenever student confirms email received ── */}
      {caseData.followUpResponse === "yes" && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-400 rounded-2xl p-5 flex items-start gap-4">
          <AlertTriangle className="w-7 h-7 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-base mb-1">
              ⚡ مطلوب إجراء — الطالب أبلغ باستلام رد من الجامعة عبر البريد الإلكتروني
            </h3>
            <p className="text-amber-800 text-sm leading-relaxed">
              قام الطالب بتأكيد استلام رد وأرفق لقطة شاشة للبريد الإلكتروني. يرجى مراجعة المرفق أدناه (
              <span className="font-bold">لقطة شاشة رد البريد الإلكتروني</span>
              ) ثم تحديد الحالة النهائية: <span className="font-bold">مكتمل</span> أو <span className="font-bold">مرفوض</span>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Student Info */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3">بيانات الطالب</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="الاسم الكامل" value={caseData.fullName} large />
              <InfoRow label="البريد الإلكتروني" value={caseData.email} mono dir="ltr" large />
              <InfoRow label="الرقم الجامعي" value={caseData.studentId || "—"} mono />
              <InfoRow label="المنطقة" value={caseData.governorate || "—"} />
              <InfoRow
                label="الوصول للوثيقة"
                value={
                  caseData.canAccessCertificate === "yes" ? "نعم"
                  : caseData.canAccessCertificate === "no" ? "لا"
                  : "جزئياً"
                }
              />
              <InfoRow
                label="تاريخ التقديم"
                value={caseData.submittedAt ? format(new Date(caseData.submittedAt), "yyyy-MM-dd HH:mm") : "—"}
                mono
              />
            </div>
            <div className="mt-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="block text-gray-500 font-bold text-xs mb-2 uppercase tracking-wider">وصف المشكلة</span>
              <p className="text-gray-800 leading-relaxed">{caseData.caseDescription}</p>
            </div>
          </div>

          {/* Attachments */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                المرفقات والوثائق
              </h3>
              <button
                onClick={loadAttachments}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold transition-colors"
              >
                تحديث
              </button>
            </div>

            {attachmentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : attachments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">لم يرفق الطالب أي ملفات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map((att) => {
                  const isImage = att.mimeType?.startsWith("image/");
                  const isPdf = att.mimeType === "application/pdf";
                  const token = localStorage.getItem("adminToken");
                  const fileExists = att.fileExists !== false;
                  const thumbUrl = isImage && fileExists
                    ? `${API_BASE}${att.viewUrl}?token=${token}` : null;
                  const sizeKb = att.size > 0 ? (att.size / 1024).toFixed(0) : "—";
                  const isFollowUpReply = att.category === "follow_up_reply_screenshot";
                  return (
                    <div key={att.id}
                      className={`border rounded-xl overflow-hidden ${
                        !fileExists ? "border-red-200 bg-red-50"
                        : isFollowUpReply ? "border-amber-400 bg-amber-50"
                        : "border-gray-200"
                      }`}>
                      <div className="flex items-start gap-3 p-3">
                        <div
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border flex items-center justify-center ${
                            fileExists ? "bg-gray-100 border-gray-200 cursor-pointer" : "bg-red-100 border-red-200"
                          }`}
                          onClick={() => fileExists && handleViewAttachment(att)}
                        >
                          {!fileExists ? (
                            <AlertTriangle className="w-7 h-7 text-red-400" />
                          ) : thumbUrl ? (
                            <img src={thumbUrl} alt={att.fileName}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                          ) : isPdf ? (
                            <FileText className="w-7 h-7 text-red-400" />
                          ) : (
                            <Paperclip className="w-7 h-7 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`font-bold text-sm truncate ${fileExists ? "text-gray-900" : "text-red-700"}`}>
                              {att.fileName}
                            </p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!fileExists && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                                  ملف مفقود
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                {att.categoryLabel}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-400 space-y-0.5">
                            <p>{att.mimeType || "نوع غير معروف"} · {sizeKb} KB</p>
                            <p>رُفع بواسطة: {att.uploadedBy} · {att.uploadedAt ? format(new Date(att.uploadedAt), "yyyy-MM-dd HH:mm") : "—"}</p>
                          </div>
                          {fileExists ? (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleViewAttachment(att)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition-colors"
                              >
                                <ZoomIn className="w-3.5 h-3.5" />
                                عرض
                              </button>
                              <button
                                onClick={() => handleDownloadAttachment(att)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                تنزيل
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-red-500 font-semibold mt-2">
                              الملف غير موجود على الخادم — قد يكون قد حُذف
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Change Status */}
          {!isClosed && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3">تغيير حالة الطلب</h3>

              {/* Need More Info Quick Action */}
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-amber-800 text-sm">طلب معلومات إضافية من الطالب</h4>
                  <button
                    onClick={() => setShowNeedMoreInfo(!showNeedMoreInfo)}
                    className="text-xs px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-bold transition-colors"
                  >
                    {showNeedMoreInfo ? "إخفاء" : "تفعيل"}
                  </button>
                </div>
                {showNeedMoreInfo && (
                  <div className="space-y-2">
                    <textarea
                      value={needMoreInfoText}
                      onChange={(e) => setNeedMoreInfoText(e.target.value)}
                      rows={3}
                      placeholder="مثال: يرجى رفع صورة واضحة من الهوية الشخصية + كشف العلامات الرسمي"
                      className="w-full p-3 rounded-xl border border-amber-200 text-sm outline-none focus:border-amber-400 bg-white resize-none"
                    />
                    <button
                      onClick={handleNeedMoreInfo}
                      disabled={actionPending || !needMoreInfoText.trim()}
                      className="w-full py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {actionPending ? "جاري..." : "إرسال طلب المعلومات للطالب"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-primary text-sm"
                >
                  <option value="">اختر الحالة الجديدة...</option>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || actionPending}
                  className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {actionPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {actionPending ? "جاري..." : "تحديث"}
                </button>
              </div>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={2}
                placeholder="ملاحظة داخلية اختيارية عن هذا التغيير..."
                className="w-full mt-3 p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary bg-gray-50 resize-none"
              />
              <textarea
                value={studentInstructionOverride}
                onChange={(e) => setStudentInstructionOverride(e.target.value)}
                rows={2}
                placeholder="تعليمات مخصصة للطالب (اختياري — سيحل محل النص الافتراضي للحالة)"
                className="w-full mt-2 p-3 rounded-xl border border-blue-200 text-sm outline-none focus:border-blue-400 bg-blue-50 resize-none"
              />
            </div>
          )}

          {/* Assign */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3 flex items-center gap-2">
              <User className="w-5 h-5" />
              تعيين مسؤول
            </h3>
            <div className="flex gap-3">
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-primary text-sm"
              >
                <option value="">اختر عضو الفريق...</option>
                {TEAM_MEMBERS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!assignTo || actionPending}
                className="px-5 py-2.5 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 disabled:opacity-50"
              >
                {actionPending ? "جاري..." : "تعيين"}
              </button>
            </div>
          </div>

          {/* Email Draft */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-1 border-b pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              مسودة البريد الإلكتروني للطالب
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              هذه المسودة ستظهر للطالب في صفحة التتبع ليقوم بإرسالها بنفسه.
            </p>
            <textarea
              value={draftContent || caseData.currentDraft || ""}
              onChange={(e) => setDraftContent(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary outline-none font-mono text-sm text-left mb-4 bg-gray-50 resize-none"
              dir="ltr"
              placeholder={"Dear UoPeople Admissions Team,\n\nI am writing regarding..."}
            />
            <button
              onClick={handleGenerateDraft}
              disabled={actionPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl font-bold text-sm hover:bg-secondary/90 disabled:opacity-50"
            >
              {actionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {actionPending ? "جاري الحفظ..." : "حفظ وعرض للطالب"}
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">

          {/* Internal Notes */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3">
              ملاحظات داخلية <span className="text-xs text-red-500 font-normal">(سرية)</span>
            </h3>
            <div className="space-y-3 mb-5 max-h-72 overflow-y-auto">
              {!caseData.notes?.length ? (
                <div className="text-center text-gray-400 text-sm py-6 bg-gray-50 rounded-xl">
                  لا توجد ملاحظات بعد
                </div>
              ) : (
                caseData.notes.map((note: any) => (
                  <div key={note.id} className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-sm">
                    <p className="text-blue-900 mb-2 leading-relaxed">{note.content}</p>
                    <div className="flex justify-between text-blue-400 text-xs">
                      <span className="font-bold">{note.authorName}</span>
                      <span dir="ltr">{format(new Date(note.createdAt), "MM/dd HH:mm")}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="أضف ملاحظة داخلية للفريق..."
              className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary mb-2 bg-gray-50 resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={actionPending || !noteContent.trim()}
              className="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {actionPending ? "جاري..." : "إضافة ملاحظة"}
            </button>
          </div>

          {/* Email Notification Log (read-only) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3 flex items-center gap-2">
              <Mail className="w-5 h-5" />
              سجل الإشعارات البريدية
            </h3>
            {emailLogLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : emailLog.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-6 bg-gray-50 rounded-xl">
                لم يُرسل أي إشعار بعد
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {emailLog.map((n: any) => (
                  <div key={n.id} className="text-xs p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-700 truncate flex-1">
                        {STATUS_LABELS[n.caseStatus] || n.caseStatus}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 flex-shrink-0 ${
                        n.status === "sent" ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                      }`}>
                        {n.status === "sent" ? "مُرسَل" : "فشل"}
                      </span>
                    </div>
                    <div className="text-gray-400 flex justify-between">
                      <span>{n.triggeredBy}</span>
                      <span dir="ltr">{format(new Date(n.triggeredAt), "MM/dd HH:mm")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status History */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-primary mb-4 border-b pb-3">سجل التحديثات</h3>
            <div className="space-y-3">
              {caseData.statusHistory?.map((history: any) => (
                <div key={history.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 truncate">
                      {STATUS_LABELS[history.status] || history.statusLabel}
                    </div>
                    {history.note && (
                      <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{history.note}</div>
                    )}
                    <div className="text-xs text-gray-400 flex gap-2 mt-0.5" dir="ltr">
                      <span>{format(new Date(history.changedAt), "MM/dd HH:mm")}</span>
                      <span>·</span>
                      <span>{history.changedBy}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function InfoRow({
  label,
  value,
  mono,
  large,
  dir,
}: {
  label: string;
  value: string;
  mono?: boolean;
  large?: boolean;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <span className="block text-gray-500 text-xs mb-1 font-bold uppercase tracking-wide">{label}</span>
      <strong
        className={`text-gray-900 ${large ? "text-base" : "text-sm"} ${mono ? "font-mono" : ""}`}
        dir={dir}
      >
        {value}
      </strong>
    </div>
  );
}
