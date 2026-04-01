export const STATUS_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  under_review: "قيد المراجعة",
  need_more_info: "بحاجة إلى معلومات إضافية",
  approved_for_guidance: "معتمد للتوجيه",
  draft_prepared: "تم تحضير المسودة",
  awaiting_student_sending: "في انتظار إرسال الطالب",
  sent_by_student: "تم الإرسال بواسطة الطالب",
  follow_up_in_progress: "المتابعة جارية",
  completed: "مكتمل",
  closed: "مغلق",
  rejected: "مرفوض",
};

export const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  need_more_info: "bg-orange-100 text-orange-800",
  approved_for_guidance: "bg-emerald-100 text-emerald-800",
  draft_prepared: "bg-indigo-100 text-indigo-800",
  awaiting_student_sending: "bg-purple-100 text-purple-800",
  sent_by_student: "bg-cyan-100 text-cyan-800",
  follow_up_in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  rejected: "bg-red-100 text-red-800",
};

export const GOVERNORATES = [
  "السويداء",
  "ريف السويداء",
  "جبل الشيخ",
  "جرمانا",
  "صحنايا",
  "أشرفية صحنايا",
];

export const getAdminHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};
