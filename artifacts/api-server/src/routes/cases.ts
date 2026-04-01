import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  casesTable,
  caseStatusHistoryTable,
  exploitationReportsTable,
  uploadsTable,
  auditLogsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

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
  rejected: "تم رفض الحالة.",
};

type CreateCaseBody = {
  fullName?: string;
  email?: string;
  studentId?: string;
  caseDescription?: string;
  canAccessCertificate?: string;
  governorate?: string;
  consentConfirmed?: boolean;
};

type TrackCaseBody = {
  caseNumber?: string;
  email?: string;
};

type UploadDocumentBody = {
  email?: string;
  fileName?: string;
  documentType?: string;
};

type ConfirmSentBody = {
  email?: string;
};

type FollowUpResponseBody = {
  email?: string;
  response?: "yes" | "still_waiting";
};

type ExploitationReportBody = {
  reporterNameOrAlias?: string;
  contactMethod?: string;
  notes?: string;
};

function generateCaseNumber(id: number): string {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(4, "0");
  return `CASE-${year}-${padded}`;
}

function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/cases", async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      fullName,
      email,
      studentId,
      caseDescription,
      canAccessCertificate,
      governorate,
      consentConfirmed,
    } = req.body as CreateCaseBody;

    if (
      !fullName ||
      !email ||
      !caseDescription ||
      !canAccessCertificate ||
      consentConfirmed !== true
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const verificationCode = generateVerificationCode();

    const insertedRows = await db
      .insert(casesTable)
      .values({
        caseNumber: `TEMP-${Date.now()}`,
        fullName,
        email,
        studentId: studentId ?? null,
        caseDescription,
        canAccessCertificate,
        governorate: governorate ?? null,
        status: "received",
        verificationCode,
        consentConfirmed: true,
        currentInstruction: STATUS_INSTRUCTIONS.received,
      })
      .returning();

    const inserted = insertedRows[0];

    if (!inserted) {
      res.status(500).json({ error: "Failed to create case" });
      return;
    }

    const caseNumber = generateCaseNumber(inserted.id);

    await db
      .update(casesTable)
      .set({ caseNumber, updatedAt: new Date() })
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

    res.status(201).json({
      caseNumber,
      message:
        "تم تقديم طلبك بنجاح. يرجى الاحتفاظ برقم الحالة للمتابعة لاحقاً.",
      verificationCode,
    });
  } catch (error) {
    console.error("Error creating case:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/cases/track", async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseNumber, email } = req.body as TrackCaseBody;

    if (!caseNumber || !email) {
      res.status(400).json({ error: "Case number and email are required" });
      return;
    }

    const rows = await db
      .select()
      .from(casesTable)
      .where(eq(casesTable.caseNumber, caseNumber))
      .limit(1);

    const caseRecord = rows[0];

    if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
      res.status(404).json({ error: "Case not found or email does not match" });
      return;
    }

    const responseData: Record<string, string | boolean | undefined> = {
      caseNumber: caseRecord.caseNumber,
      status: caseRecord.status,
      statusLabel: STATUS_LABELS[caseRecord.status] ?? caseRecord.status,
      currentInstruction:
        caseRecord.currentInstruction ??
        STATUS_INSTRUCTIONS[caseRecord.status] ??
        "",
      followUpResponse: caseRecord.followUpResponse ?? undefined,
      isFlagged: caseRecord.isFlagged,
    };

    const draftStatuses = new Set([
      "approved_for_guidance",
      "draft_prepared",
      "awaiting_student_sending",
      "sent_by_student",
      "follow_up_in_progress",
    ]);

    if (draftStatuses.has(caseRecord.status) && caseRecord.currentDraft) {
      responseData.emailDraft = caseRecord.currentDraft;
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error tracking case:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/cases/:caseNumber/documents",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const caseNumber = req.params.caseNumber;
      const { email, fileName, documentType } = req.body as UploadDocumentBody;

      if (!caseNumber || !email || !fileName) {
        res.status(400).json({ error: "Missing required fields" });
        return;
      }

      const rows = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.caseNumber, caseNumber))
        .limit(1);

      const caseRecord = rows[0];

      if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      await db.insert(uploadsTable).values({
        caseId: caseRecord.id,
        caseNumber: caseRecord.caseNumber,
        fileName,
        storagePath: "",
        mimeType: "",
        size: 0,
        category: "other",
        documentType: documentType ?? null,
        uploadedBy: "student",
      });

      res.json({ success: true, message: "تم رفع الملف بنجاح" });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/cases/:caseNumber/confirm-sent",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const caseNumber = req.params.caseNumber;
      const { email } = req.body as ConfirmSentBody;

      if (!caseNumber || !email) {
        res.status(400).json({ error: "Case number and email are required" });
        return;
      }

      const rows = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.caseNumber, caseNumber))
        .limit(1);

      const caseRecord = rows[0];

      if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
        res.status(404).json({ error: "Case not found" });
        return;
      }

      await db
        .update(casesTable)
        .set({
          status: "sent_by_student",
          currentInstruction: STATUS_INSTRUCTIONS.sent_by_student,
          updatedAt: new Date(),
        })
        .where(eq(casesTable.id, caseRecord.id));

      await db.insert(caseStatusHistoryTable).values({
        caseId: caseRecord.id,
        status: "sent_by_student",
        changedBy: email,
        note: "أكد الطالب إرسال الرسالة",
      });

      res.json({ success: true, message: "تم تأكيد الإرسال بنجاح" });
    } catch (error) {
      console.error("Error confirming sent status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/cases/:caseNumber/follow-up-response",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const caseNumber = req.params.caseNumber;
      const { email, response } = req.body as FollowUpResponseBody;

      if (!caseNumber || !email || !response) {
        res.status(400).json({ error: "Email and response are required" });
        return;
      }

      if (response !== "yes" && response !== "still_waiting") {
        res.status(400).json({ error: "Invalid response value" });
        return;
      }

      const rows = await db
        .select()
        .from(casesTable)
        .where(eq(casesTable.caseNumber, caseNumber))
        .limit(1);

      const caseRecord = rows[0];

      if (!caseRecord || caseRecord.email.toLowerCase() !== email.toLowerCase()) {
        res.status(404).json({ error: "Case not found or email does not match" });
        return;
      }

      if (caseRecord.status !== "follow_up_in_progress") {
        res.status(409).json({ error: "Case is not in follow-up stage" });
        return;
      }

      const now = new Date();

      if (response === "yes") {
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
          note: "أكد الطالب استلام رد على بريده الإلكتروني في انتظار مراجعة الإدارة",
        });

        await db.insert(auditLogsTable).values({
          action: "follow_up_response_yes",
          caseId: caseRecord.id,
          performedBy: email,
          details:
            "الطالب أكد استلام رد على البريد الإلكتروني. الحالة معلمة لمراجعة الإدارة.",
        });

        res.json({
          success: true,
          message:
            "تم استلام ردك. ستتم مراجعته من قبل الإدارة لاتخاذ القرار النهائي.",
        });
        return;
      }

      await db
        .update(casesTable)
        .set({
          followUpResponse: "still_waiting",
          updatedAt: now,
        })
        .where(eq(casesTable.id, caseRecord.id));

      await db.insert(auditLogsTable).values({
        action: "follow_up_response_still_waiting",
        caseId: caseRecord.id,
        performedBy: email,
        details: "الطالب أبلغ أنه لا يزال ينتظر رداً على البريد الإلكتروني.",
      });

      res.json({
        success: true,
        message: "تم تسجيل ردك. يرجى العودة لاحقاً عند استلام أي تحديث.",
      });
    } catch (error) {
      console.error("Error saving follow-up response:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

router.post(
  "/reports/exploitation",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { reporterNameOrAlias, contactMethod, notes } =
        req.body as ExploitationReportBody;

      if (!reporterNameOrAlias) {
        res.status(400).json({ error: "Name or alias is required" });
        return;
      }

      await db.insert(exploitationReportsTable).values({
        reporterNameOrAlias,
        contactMethod: contactMethod ?? null,
        notes: notes ?? null,
        hasScreenshot: false,
        isConfidential: true,
      });

      res.status(201).json({
        success: true,
        message: "تم استلام بلاغك بسرية تامة. شكراً لمساعدتك في حماية الطلاب.",
      });
    } catch (error) {
      console.error("Error creating exploitation report:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
