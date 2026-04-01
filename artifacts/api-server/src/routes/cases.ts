import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  casesTable,
  caseStatusHistoryTable,
  internalNotesTable,
  exploitationReportsTable,
  generatedDraftsTable,
  uploadsTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

const STATUS_LABELS: Record<string, string> = {
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

const STATUS_INSTRUCTIONS: Record<string, string> = {
  received:
    "تم استلام طلبك بنجاح. سيتم مراجعته من قبل الفريق في أقرب وقت ممكن.",
  under_review:
    "طلبك قيد المراجعة حالياً من قبل الفريق المختص. سيتم التواصل معك عند الحاجة.",
  need_more_info:
    "يحتاج الفريق إلى معلومات إضافية لاستكمال معالجة طلبك. يرجى مراجعة التعليمات الخاصة بك أدناه.",
  approved_for_guidance:
    "تهانينا! تم قبول طلبك للتوجيه. يرجى مراجعة المسودة المخصصة لك أدناه.",
  draft_prepared:
    "تم تحضير مسودة رسالتك المخصصة. يرجى قراءتها بعناية واتباع التعليمات.",
  awaiting_student_sending:
    "يرجى إرسال الرسالة المخصصة من بريدك الإلكتروني الجامعي وتأكيد ذلك هنا.",
  sent_by_student:
    "شكراً لك على التأكيد. الفريق يتابع حالتك الآن ويراقب أي رد.",
  follow_up_in_progress:
    "المتابعة جارية مع الجهات المعنية. سيتم تحديثك عند وجود أي تطور.",
  completed: "تم إتمام حالتك بنجاح. نتمنى لك التوفيق في مسيرتك الأكاديمية.",
  closed:
    "تم إغلاق هذه الحالة. إذا كنت بحاجة إلى مساعدة إضافية، يمكنك تقديم طلب جديد.",
};

function generateCaseNumber(id: number): string {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(4, "0");
  return `CASE-${year}-${padded}`;
}

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/cases", async (req, res) => {
  const {
    fullName,
    email,
    studentId,
    caseDescription,
    canAccessCertificate,
    governorate,
    consentConfirmed,
  } = req.body;

  if (!fullName || !email || !caseDescription || !canAccessCertificate || !consentConfirmed) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const verificationCode = generateVerificationCode();

  const [inserted] = await db
    .insert(casesTable)
    .values({
      caseNumber: `TEMP-${Date.now()}`,
      fullName,
      email,
      studentId,
      caseDescription,
      canAccessCertificate,
      governorate,
      status: "received",
      verificationCode,
      consentConfirmed: true,
      currentInstruction: STATUS_INSTRUCTIONS["received"],
    })
    .returning();

  const caseNumber = generateCaseNumber(inserted.id);
  await db
    .update(casesTable)
    .set({ caseNumber })
    .where(eq(casesTable.id, inserted.id));

  await db.insert(caseStatusHistoryTable).values({
    caseId: inserted.id,
    status: "received",
    changedBy: "system",
    note: "تم استلام الطلب",
  });

  await db.insert(auditLogsTable).values({
    action: "case_submitted",
    caseId: inserted.id,
    performedBy: email,
    details: `Case ${caseNumber} submitted`,
  });

  return res.status(201).json({
    caseNumber,
    message:
      "تم تقديم طلبك بنجاح. يرجى الاحتفاظ برقم الحالة للمتابعة لاحقاً.",
    verificationCode,
  });
});

router.post("/cases/track", async (req, res) => {
  const { caseNumber, email } = req.body;

  if (!caseNumber || !email) {
    return res.status(400).json({ error: "Case number and email are required" });
  }

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(404).json({ error: "Case not found or email does not match" });
  }

  const responseData: Record<string, string | boolean | undefined> = {
    caseNumber: caseRecord.caseNumber,
    status: caseRecord.status,
    statusLabel: STATUS_LABELS[caseRecord.status] || caseRecord.status,
    currentInstruction:
      caseRecord.currentInstruction || STATUS_INSTRUCTIONS[caseRecord.status] || "",
    followUpResponse: caseRecord.followUpResponse || undefined,
    isFlagged: caseRecord.isFlagged,
  };

  // Include emailDraft whenever a draft exists — relevant from draft_prepared onwards
  const DRAFT_STATUSES = [
    "approved_for_guidance",
    "draft_prepared",
    "awaiting_student_sending",
    "sent_by_student",
    "follow_up_in_progress",
  ];
  if (DRAFT_STATUSES.includes(caseRecord.status) && caseRecord.currentDraft) {
    responseData.emailDraft = caseRecord.currentDraft;
  }

  return res.json(responseData);
});

router.post("/cases/:caseNumber/documents", async (req, res) => {
  const { caseNumber } = req.params;
  const { email, fileName, documentType } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord || caseRecord.email.toLowerCase() !== email?.toLowerCase()) {
    return res.status(404).json({ error: "Case not found" });
  }

  await db.insert(uploadsTable).values({
    caseId: caseRecord.id,
    fileName,
    documentType,
  });

  return res.json({ success: true, message: "تم رفع الملف بنجاح" });
});

router.post("/cases/:caseNumber/confirm-sent", async (req, res) => {
  const { caseNumber } = req.params;
  const { email } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord || caseRecord.email.toLowerCase() !== email?.toLowerCase()) {
    return res.status(404).json({ error: "Case not found" });
  }

  await db
    .update(casesTable)
    .set({
      status: "sent_by_student",
      currentInstruction: STATUS_INSTRUCTIONS["sent_by_student"],
      updatedAt: new Date(),
    })
    .where(eq(casesTable.id, caseRecord.id));

  await db.insert(caseStatusHistoryTable).values({
    caseId: caseRecord.id,
    status: "sent_by_student",
    changedBy: email,
    note: "أكد الطالب إرسال الرسالة",
  });

  return res.json({ success: true, message: "تم تأكيد الإرسال بنجاح" });
});

// ── Follow-up response: POST /api/cases/:caseNumber/follow-up-response ──
router.post("/cases/:caseNumber/follow-up-response", async (req, res) => {
  const { caseNumber } = req.params;
  const { email, response } = req.body;

  if (!email || !response) {
    return res.status(400).json({ error: "Email and response are required" });
  }
  if (!["yes", "still_waiting"].includes(response)) {
    return res.status(400).json({ error: "Invalid response value" });
  }

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
    return res.status(404).json({ error: "Case not found or email does not match" });
  }

  if (caseRecord.status !== "follow_up_in_progress") {
    return res.status(409).json({ error: "Case is not in follow-up stage" });
  }

  const now = new Date();

  if (response === "yes") {
    // Flag the case for admin review; keep status unchanged
    await db
      .update(casesTable)
      .set({
        followUpResponse: "yes",
        isFlagged: true,
        currentInstruction:
          "تم استلام الرد المرفق وسيتم مراجعته من قبل الإدارة لتحديد النتيجة النهائية.",
        updatedAt: now,
      })
      .where(eq(casesTable.id, caseRecord.id));

    await db.insert(caseStatusHistoryTable).values({
      caseId: caseRecord.id,
      status: "follow_up_in_progress",
      changedBy: email,
      note: "أكد الطالب استلام رد على بريده الإلكتروني — لقطة الشاشة مرفوعة — في انتظار مراجعة الإدارة",
    });

    await db.insert(auditLogsTable).values({
      action: "follow_up_response_yes",
      caseId: caseRecord.id,
      performedBy: email,
      details: `الطالب أكد استلام رد على البريد الإلكتروني. الحالة مُعلَّمة لمراجعة الإدارة.`,
    });

    return res.json({
      success: true,
      message: "تم استلام ردك. ستتم مراجعته من قبل الإدارة لاتخاذ القرار النهائي.",
    });
  } else {
    // still_waiting — record but don't move case forward
    await db
      .update(casesTable)
      .set({ followUpResponse: "still_waiting", updatedAt: now })
      .where(eq(casesTable.id, caseRecord.id));

    await db.insert(auditLogsTable).values({
      action: "follow_up_response_still_waiting",
      caseId: caseRecord.id,
      performedBy: email,
      details: "الطالب أبلغ أنه لا يزال ينتظر رداً على البريد الإلكتروني.",
    });

    return res.json({
      success: true,
      message: "تم تسجيل ردك. يرجى العودة لاحقاً عند استلام أي تحديث.",
    });
  }
});

router.post("/reports/exploitation", async (req, res) => {
  const { reporterNameOrAlias, contactMethod, notes } = req.body;

  if (!reporterNameOrAlias) {
    return res.status(400).json({ error: "Name or alias is required" });
  }

  await db.insert(exploitationReportsTable).values({
    reporterNameOrAlias,
    contactMethod,
    notes,
    hasScreenshot: false,
    isConfidential: true,
  });

  return res.status(201).json({
    success: true,
    message: "تم استلام بلاغك بسرية تامة. شكراً لمساعدتك في حماية الطلاب.",
  });
});

export default router;
