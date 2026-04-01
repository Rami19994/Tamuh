import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  casesTable,
  caseStatusHistoryTable,
  internalNotesTable,
  adminUsersTable,
  auditLogsTable,
  generatedDraftsTable,
  emailNotificationsTable,
  exploitationReportsTable,
} from "@workspace/db/schema";
import { eq, desc, ilike, or, sql } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { generateEmailTemplate } from "../lib/emailTemplates.js";
import {
  sendEmail,
  getSmtpStatus,
  testSmtpConnection,
} from "../lib/emailSender.js";

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
  under_review: "طلبك قيد المراجعة حالياً من قبل الفريق المختص.",
  need_more_info: "يحتاج الفريق إلى معلومات إضافية لاستكمال معالجة طلبك.",
  approved_for_guidance:
    "تهانينا! تم قبول طلبك للتوجيه. يرجى مراجعة المسودة المخصصة لك.",
  draft_prepared:
    "تم تحضير مسودة رسالتك المخصصة. يرجى قراءتها بعناية واتباع التعليمات.",
  awaiting_student_sending:
    "يرجى إرسال الرسالة المخصصة من بريدك الإلكتروني الجامعي وتأكيد ذلك هنا.",
  sent_by_student: "شكراً لك على التأكيد. الفريق يتابع حالتك الآن.",
  follow_up_in_progress: "المتابعة جارية مع الجهات المعنية.",
  completed: "تم إتمام حالتك بنجاح.",
  closed: "تم إغلاق هذه الحالة.",
  rejected: "نأسف، لم نتمكن من معالجة طلبك في الوقت الحالي.",
};

const BCRYPT_ROUNDS = 12;

function sha256Legacy(password: string): string {
  return crypto.createHash("sha256").update(password + "sweida_salt").digest("hex");
}

async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function isLegacySha256Hash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (isLegacySha256Hash(storedHash)) {
    return sha256Legacy(password) === storedHash;
  }
  return bcrypt.compare(password, storedHash);
}

function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (!/[A-Z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل";
  if (!/[a-z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل";
  if (!/[0-9]/.test(password)) return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  return null;
}

function validateToken(
  req: any,
): { username: string; role: string; name: string } | null {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const parsed = JSON.parse(decoded);
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Verifies the role from the actual database — source of truth for permission checks
async function getDbRole(username: string): Promise<string | null> {
  const cleanUsername = username.trim();
  const [admin] = await db
    .select({ role: adminUsersTable.role, isActive: adminUsersTable.isActive })
    .from(adminUsersTable)
    .where(sql`btrim(${adminUsersTable.username}, ' ' || chr(9) || chr(10) || chr(13)) = ${cleanUsername}`)
    .limit(1);
  if (!admin || !admin.isActive) return null;
  return admin.role;
}

// Used for sensitive mutations — validates token AND verifies role from DB
async function requireSuperAdmin(req: any, res: any): Promise<string | false> {
  const user = validateToken(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  const dbRole = await getDbRole(user.username);
  if (dbRole !== "super_admin") {
    res.status(403).json({ error: "ليس لديك صلاحية تنفيذ هذا الإجراء. مخصص للمدير العام فقط." });
    return false;
  }
  return user.username;
}

router.post("/admin/login", async (req, res) => {
  const { username: rawUsername, password } = req.body;
  const username = typeof rawUsername === "string" ? rawUsername.trim() : rawUsername;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  // Match username with all whitespace stripped (handles accounts stored with trailing tab/space)
  const [admin] = await db
    .select()
    .from(adminUsersTable)
    .where(sql`btrim(${adminUsersTable.username}, ' ' || chr(9) || chr(10) || chr(13)) = ${username}`)
    .limit(1);

  if (!admin || !admin.isActive) {
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    await db.insert(auditLogsTable).values({
      action: "admin_login_failed",
      performedBy: username,
      details: `Failed login attempt for username: ${username}`,
    });
    return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
  }

  // Transparent migration: upgrade legacy SHA256 hash to bcrypt on first login
  if (isLegacySha256Hash(admin.passwordHash)) {
    const newHash = await hashPasswordBcrypt(password);
    await db.update(adminUsersTable)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(adminUsersTable.id, admin.id));
  }

  // Record last login time
  await db.update(adminUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsersTable.id, admin.id));

  await db.insert(auditLogsTable).values({
    action: "admin_login",
    performedBy: admin.username,
    details: `Admin '${admin.name}' (${admin.role}) logged in`,
  });

  const payload = {
    username: admin.username,
    role: admin.role,
    name: admin.name,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  };
  const token = Buffer.from(JSON.stringify(payload)).toString("base64");

  return res.json({ token, role: admin.role, name: admin.name });
});

router.get("/admin/cases", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const {
    status,
    search,
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  const offset = (pageNum - 1) * limitNum;

  let query = db.select().from(casesTable);

  const cases = await db
    .select()
    .from(casesTable)
    .orderBy(desc(casesTable.submittedAt));

  let filtered = cases;
  if (status) filtered = filtered.filter((c) => c.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.caseNumber.toLowerCase().includes(s) ||
        c.fullName.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s),
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limitNum);

  return res.json({
    cases: paginated.map((c) => ({
      caseNumber: c.caseNumber,
      fullName: c.fullName,
      email: c.email,
      status: c.status,
      statusLabel: STATUS_LABELS[c.status] || c.status,
      submittedAt: c.submittedAt.toISOString(),
      governorate: c.governorate,
      assignedTo: c.assignedTo,
      isFlagged: c.isFlagged,
    })),
    total,
    page: pageNum,
    limit: limitNum,
  });
});

router.get("/admin/cases/:caseNumber", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  const notes = await db
    .select()
    .from(internalNotesTable)
    .where(eq(internalNotesTable.caseId, caseRecord.id))
    .orderBy(desc(internalNotesTable.createdAt));

  const history = await db
    .select()
    .from(caseStatusHistoryTable)
    .where(eq(caseStatusHistoryTable.caseId, caseRecord.id))
    .orderBy(desc(caseStatusHistoryTable.changedAt));

  return res.json({
    caseNumber: caseRecord.caseNumber,
    fullName: caseRecord.fullName,
    email: caseRecord.email,
    studentId: caseRecord.studentId,
    status: caseRecord.status,
    statusLabel: STATUS_LABELS[caseRecord.status] || caseRecord.status,
    caseDescription: caseRecord.caseDescription,
    canAccessCertificate: caseRecord.canAccessCertificate,
    governorate: caseRecord.governorate,
    submittedAt: caseRecord.submittedAt.toISOString(),
    assignedTo: caseRecord.assignedTo,
    isFlagged: caseRecord.isFlagged,
    currentDraft: caseRecord.currentDraft,
    notes: notes.map((n) => ({
      id: n.id,
      content: n.content,
      authorName: n.authorName,
      createdAt: n.createdAt.toISOString(),
    })),
    statusHistory: history.map((h) => ({
      id: h.id,
      status: h.status,
      statusLabel: STATUS_LABELS[h.status] || h.status,
      changedAt: h.changedAt.toISOString(),
      changedBy: h.changedBy,
    })),
  });
});

router.patch("/admin/cases/:caseNumber/status", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const {
    status,
    note,
    sendEmailNow,
    customEmailMessage,
    studentInstruction: customInstruction,
  } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  // Build the student-facing instruction
  let studentInstruction =
    customInstruction || STATUS_INSTRUCTIONS[status] || "";
  if (status === "rejected" && note && !customInstruction) {
    const reason = note.replace(/^سبب الرفض:\s*/i, "").trim();
    studentInstruction =
      `نأسف، لم نتمكن من معالجة طلبك في الوقت الحالي. ${reason ? `السبب: ${reason}` : ""}`.trim();
  }

  await db
    .update(casesTable)
    .set({
      status,
      currentInstruction: studentInstruction,
      updatedAt: new Date(),
    })
    .where(eq(casesTable.id, caseRecord.id));

  await db.insert(caseStatusHistoryTable).values({
    caseId: caseRecord.id,
    status,
    changedBy: user.name,
    note,
  });

  await db.insert(auditLogsTable).values({
    action: "status_changed",
    caseId: caseRecord.id,
    performedBy: user.username,
    details: `Status changed to ${status} by ${user.name}`,
  });

  // Auto-send email if requested
  let emailResult: { sent: boolean; error?: string } = { sent: false };
  if (sendEmailNow) {
    const template = generateEmailTemplate(
      status,
      caseNumber,
      caseRecord.fullName,
      customEmailMessage || undefined,
    );
    const result = await sendEmail(
      caseRecord.email,
      template.subject,
      template.bodyHtml,
    );
    await db.insert(emailNotificationsTable).values({
      caseId: caseRecord.id,
      caseNumber,
      recipientEmail: caseRecord.email,
      recipientName: caseRecord.fullName,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      status: result.success ? "sent" : "failed",
      triggeredBy: user.name,
      sentAt: result.success ? new Date() : undefined,
      errorMessage: result.error || undefined,
      caseStatus: status,
    });
    await db.insert(auditLogsTable).values({
      action: "email_sent",
      caseId: caseRecord.id,
      performedBy: user.username,
      details: result.success
        ? `Auto-email sent to ${caseRecord.email} for status: ${status}`
        : `Auto-email FAILED to ${caseRecord.email}: ${result.error}`,
    });
    emailResult = { sent: result.success, error: result.error };
  }

  return res.json({
    success: true,
    message: "Status updated",
    email: emailResult,
  });
});

router.post("/admin/cases/:caseNumber/notes", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { content } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  await db.insert(internalNotesTable).values({
    caseId: caseRecord.id,
    content,
    authorName: user.name,
  });

  return res.json({ success: true, message: "Note added" });
});

router.post("/admin/cases/:caseNumber/draft", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { draftContent } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  await db
    .update(casesTable)
    .set({
      currentDraft: draftContent,
      status: "draft_prepared",
      currentInstruction:
        "تم تحضير مسودة رسالتك المخصصة. يرجى قراءتها بعناية واتباع التعليمات.",
      updatedAt: new Date(),
    })
    .where(eq(casesTable.id, caseRecord.id));

  await db.insert(generatedDraftsTable).values({
    caseId: caseRecord.id,
    draftContent,
    variation: `V${Date.now()}`,
    releasedAt: new Date(),
    releasedBy: user.name,
  });

  await db.insert(caseStatusHistoryTable).values({
    caseId: caseRecord.id,
    status: "draft_prepared",
    changedBy: user.name,
    note: "تم تحضير المسودة المخصصة",
  });

  await db.insert(auditLogsTable).values({
    action: "draft_released",
    caseId: caseRecord.id,
    performedBy: user.username,
    details: `Draft prepared and released for ${caseNumber}`,
  });

  return res.json({
    success: true,
    message: "Draft generated and released to student",
  });
});

router.patch("/admin/cases/:caseNumber/assign", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { assignedTo } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  await db
    .update(casesTable)
    .set({ assignedTo, updatedAt: new Date() })
    .where(eq(casesTable.id, caseRecord.id));

  return res.json({ success: true, message: "Case assigned" });
});

router.get("/admin/stats", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const allCases = await db
    .select()
    .from(casesTable)
    .orderBy(desc(casesTable.submittedAt));
  const total = allCases.length;

  const statusMap: Record<string, number> = {};
  for (const c of allCases) {
    statusMap[c.status] = (statusMap[c.status] || 0) + 1;
  }

  const byStatus = Object.entries(statusMap).map(([status, count]) => ({
    status,
    statusLabel: STATUS_LABELS[status] || status,
    count,
  }));

  const recentCases = allCases.slice(0, 5).map((c) => ({
    caseNumber: c.caseNumber,
    fullName: c.fullName,
    email: c.email,
    status: c.status,
    statusLabel: STATUS_LABELS[c.status] || c.status,
    submittedAt: c.submittedAt.toISOString(),
    governorate: c.governorate,
    assignedTo: c.assignedTo,
    isFlagged: c.isFlagged,
  }));

  return res.json({ total, byStatus, recentCases });
});

/* ─────────────────────────────────────────────
   EMAIL PREVIEW
───────────────────────────────────────────── */
router.get("/admin/cases/:caseNumber/email-preview", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { status, customMessage } = req.query as Record<string, string>;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  const targetStatus = status || caseRecord.status;
  const template = generateEmailTemplate(
    targetStatus,
    caseNumber,
    caseRecord.fullName,
    customMessage || undefined,
  );

  return res.json({
    to: caseRecord.email,
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    status: targetStatus,
    statusLabel: STATUS_LABELS[targetStatus] || targetStatus,
  });
});

/* ─────────────────────────────────────────────
   SEND EMAIL NOTIFICATION
───────────────────────────────────────────── */
router.post("/admin/cases/:caseNumber/send-email", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { status, customMessage } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  const targetStatus = status || caseRecord.status;
  const template = generateEmailTemplate(
    targetStatus,
    caseNumber,
    caseRecord.fullName,
    customMessage || undefined,
  );

  const result = await sendEmail(
    caseRecord.email,
    template.subject,
    template.bodyHtml,
  );

  const notif = await db
    .insert(emailNotificationsTable)
    .values({
      caseId: caseRecord.id,
      caseNumber,
      recipientEmail: caseRecord.email,
      recipientName: caseRecord.fullName,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      status: result.success ? "sent" : "failed",
      triggeredBy: user.name,
      sentAt: result.success ? new Date() : undefined,
      errorMessage: result.error || undefined,
      caseStatus: targetStatus,
    })
    .returning();

  await db.insert(auditLogsTable).values({
    action: "email_sent",
    caseId: caseRecord.id,
    performedBy: user.username,
    details: result.success
      ? `Email sent to ${caseRecord.email} for status: ${targetStatus}`
      : `Email FAILED to ${caseRecord.email}: ${result.error}`,
  });

  return res.json({
    success: result.success,
    error: result.error,
    notificationId: notif[0]?.id,
  });
});

/* ─────────────────────────────────────────────
   EMAIL LOG FOR A CASE
───────────────────────────────────────────── */
router.get("/admin/cases/:caseNumber/email-log", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;

  const notifications = await db
    .select()
    .from(emailNotificationsTable)
    .where(eq(emailNotificationsTable.caseNumber, caseNumber))
    .orderBy(desc(emailNotificationsTable.triggeredAt));

  return res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      subject: n.subject,
      recipientEmail: n.recipientEmail,
      status: n.status,
      triggeredBy: n.triggeredBy,
      triggeredAt: n.triggeredAt.toISOString(),
      sentAt: n.sentAt?.toISOString(),
      caseStatus: n.caseStatus,
      caseStatusLabel: STATUS_LABELS[n.caseStatus] || n.caseStatus,
      errorMessage: n.errorMessage,
    })),
  });
});

/* ─────────────────────────────────────────────
   GLOBAL EMAIL LOG
───────────────────────────────────────────── */
router.get("/admin/email-log", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { page = "1" } = req.query as Record<string, string>;
  const pageNum = parseInt(page) || 1;
  const limitNum = 30;
  const offset = (pageNum - 1) * limitNum;

  const all = await db
    .select()
    .from(emailNotificationsTable)
    .orderBy(desc(emailNotificationsTable.triggeredAt));

  const total = all.length;
  const paginated = all.slice(offset, offset + limitNum);

  return res.json({
    notifications: paginated.map((n) => ({
      id: n.id,
      caseNumber: n.caseNumber,
      subject: n.subject,
      recipientEmail: n.recipientEmail,
      status: n.status,
      triggeredBy: n.triggeredBy,
      triggeredAt: n.triggeredAt.toISOString(),
      sentAt: n.sentAt?.toISOString(),
      caseStatus: n.caseStatus,
      caseStatusLabel: STATUS_LABELS[n.caseStatus] || n.caseStatus,
    })),
    total,
    page: pageNum,
  });
});

/* ─────────────────────────────────────────────
   FLAG / UNFLAG A CASE
───────────────────────────────────────────── */
router.patch("/admin/cases/:caseNumber/flag", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { caseNumber } = req.params;
  const { flagged } = req.body;

  const [caseRecord] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.caseNumber, caseNumber))
    .limit(1);

  if (!caseRecord) return res.status(404).json({ error: "Case not found" });

  await db
    .update(casesTable)
    .set({ isFlagged: flagged, updatedAt: new Date() })
    .where(eq(casesTable.id, caseRecord.id));

  await db.insert(auditLogsTable).values({
    action: flagged ? "case_flagged" : "case_unflagged",
    caseId: caseRecord.id,
    performedBy: user.username,
    details: `Case ${caseNumber} ${flagged ? "flagged" : "unflagged"} by ${user.name}`,
  });

  return res.json({ success: true, isFlagged: flagged });
});

/* ─────────────────────────────────────────────
   EXPORT CASES (CSV-like JSON for admin)
───────────────────────────────────────────── */
router.get("/admin/export", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.role !== "admin" && user.role !== "super_admin") {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const allCases = await db
    .select()
    .from(casesTable)
    .orderBy(desc(casesTable.submittedAt));

  const rows = allCases.map((c) => [
    c.caseNumber,
    c.fullName,
    c.email,
    c.studentId || "",
    c.governorate || "",
    STATUS_LABELS[c.status] || c.status,
    c.assignedTo || "",
    c.isFlagged ? "نعم" : "لا",
    c.submittedAt.toISOString().split("T")[0],
    c.updatedAt.toISOString().split("T")[0],
  ]);

  const header =
    "رقم الطلب,الاسم الكامل,البريد الإلكتروني,الرقم الجامعي,المنطقة,الحالة,مسؤول,مُبلَّغ عنه,تاريخ التقديم,آخر تحديث";
  const csv = [
    header,
    ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="cases-export-${Date.now()}.csv"`,
  );
  return res.send("\uFEFF" + csv); // BOM for Arabic Excel
});

/* ─────────────────────────────────────────────
   ACTIVITY LOG
───────────────────────────────────────────── */
router.get("/admin/activity-log", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { page = "1" } = req.query as Record<string, string>;
  const pageNum = parseInt(page) || 1;
  const limitNum = 50;
  const offset = (pageNum - 1) * limitNum;

  const all = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.performedAt));

  const total = all.length;
  const paginated = all.slice(offset, offset + limitNum);

  return res.json({
    logs: paginated.map((l) => ({
      id: l.id,
      action: l.action,
      caseId: l.caseId,
      performedBy: l.performedBy,
      details: l.details,
      performedAt: l.performedAt.toISOString(),
    })),
    total,
    page: pageNum,
  });
});

/* ─────────────────────────────────────────────
   SMTP STATUS + TEST
───────────────────────────────────────────── */

/** GET /api/admin/smtp-status — returns current SMTP config state (no secrets). */
router.get("/admin/smtp-status", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const status = getSmtpStatus();
  return res.json({
    configured: status.configured,
    missing: status.missing,
    host: status.host,
    port: status.port,
    user: status.user ? status.user.replace(/(?<=.{3}).(?=.*@)/g, "*") : null,
    from: status.from,
  });
});

/** POST /api/admin/smtp-test — verifies the SMTP connection. */
router.post("/admin/smtp-test", async (req, res) => {
  const user = validateToken(req);
  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const result = await testSmtpConnection();
  return res.json({ ok: result.ok, error: result.error });
});

/** POST /api/admin/smtp-test-email — sends a real test email to a given address. */
router.post("/admin/smtp-test-email", async (req, res) => {
  const user = validateToken(req);
  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Missing 'to' address" });

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1e3a5f;margin-bottom:8px">اختبار SMTP — مبادرة طلاب السويداء</h2>
      <p style="color:#374151">هذه رسالة اختبارية تؤكد أن إعدادات SMTP تعمل بشكل صحيح.</p>
      <hr style="border-color:#e5e7eb;margin:16px 0"/>
      <p style="color:#6b7280;font-size:13px">أُرسلت بواسطة: ${user.name} | ${new Date().toISOString()}</p>
    </div>`;

  const result = await sendEmail(
    to,
    "اختبار SMTP — مبادرة طلاب السويداء",
    html,
  );
  return res.json({ ok: result.success, error: result.error });
});

const VALID_ROLES = [
  "intake_officer",
  "verification_officer",
  "drafting_followup_officer",
  "records_officer",
  "admin",
  "super_admin",
  "intake",
  "verification",
];

// ── Public: check if bootstrap is needed ──
router.get("/admin/check-bootstrap", async (_req, res) => {
  const [existing] = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.role, "super_admin"))
    .limit(1);
  return res.json({ canBootstrap: !existing });
});

// ── Public: create first super_admin (only if none exists) ──
router.post("/admin/bootstrap", async (req, res) => {
  const [existing] = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.role, "super_admin"))
    .limit(1);
  if (existing) {
    return res.status(403).json({ error: "لا يمكن إنشاء حساب المدير العام. يوجد مدير عام بالفعل في النظام." });
  }
  const { name, username, email, password, confirmPassword } = req.body;
  if (!name || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: "جميع الحقول المطلوبة يجب ملؤها" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "كلمة المرور وتأكيدها غير متطابقتين" });
  }
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return res.status(400).json({ error: strengthError });

  const [dup] = await db.select({ id: adminUsersTable.id })
    .from(adminUsersTable).where(eq(adminUsersTable.username, username)).limit(1);
  if (dup) return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });

  const passwordHash = await hashPasswordBcrypt(password);
  const [inserted] = await db.insert(adminUsersTable).values({
    name, username, email: email || null, passwordHash,
    role: "super_admin", isActive: true,
  }).returning({ id: adminUsersTable.id, username: adminUsersTable.username });

  await db.insert(auditLogsTable).values({
    action: "admin_account_created",
    performedBy: "bootstrap",
    details: `First super admin account created: ${username}`,
  });
  return res.status(201).json({ success: true, id: inserted.id, username: inserted.username });
});

// ── List admin users: GET /api/admin/admins ──
// All authenticated admins can view the list; only super_admin can mutate
router.get("/admin/admins", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const admins = await db
    .select({
      id: adminUsersTable.id,
      username: adminUsersTable.username,
      name: adminUsersTable.name,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      isActive: adminUsersTable.isActive,
      createdAt: adminUsersTable.createdAt,
      updatedAt: adminUsersTable.updatedAt,
      lastLoginAt: adminUsersTable.lastLoginAt,
    })
    .from(adminUsersTable)
    .orderBy(adminUsersTable.createdAt);
  return res.json({ admins });
});

// ── Create admin: POST /api/admin/admins ──
router.post("/admin/admins", async (req, res) => {
  const callerUsername = await requireSuperAdmin(req, res);
  if (!callerUsername) return;
  const { name, username, email, password, confirmPassword, role, isActive = true } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: "الاسم واسم المستخدم وكلمة المرور والدور مطلوبة" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "كلمة المرور وتأكيدها غير متطابقتين" });
  }
  const strengthError = validatePasswordStrength(password);
  if (strengthError) return res.status(400).json({ error: strengthError });
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "الدور غير صالح" });
  }
  const [existing] = await db
    .select({ id: adminUsersTable.id })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.username, username))
    .limit(1);
  if (existing) return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });

  const passwordHash = await hashPasswordBcrypt(password);
  const [inserted] = await db.insert(adminUsersTable).values({
    name,
    username,
    email: email || null,
    passwordHash,
    role,
    isActive: Boolean(isActive),
  }).returning({ id: adminUsersTable.id, username: adminUsersTable.username });

  await db.insert(auditLogsTable).values({
    action: "admin_account_created",
    performedBy: callerUsername,
    details: `Created admin account: ${username} (${role}) by ${callerUsername}`,
  });
  return res.status(201).json({ success: true, id: inserted.id, username: inserted.username });
});

// ── Update role: PATCH /api/admin/admins/:id/role ──
router.patch("/admin/admins/:id/role", async (req, res) => {
  const callerUsername = await requireSuperAdmin(req, res);
  if (!callerUsername) return;
  const id = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: "الدور غير صالح" });

  const [target] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, id)).limit(1);
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود" });

  await db.update(adminUsersTable).set({ role, updatedAt: new Date() }).where(eq(adminUsersTable.id, id));
  await db.insert(auditLogsTable).values({
    action: "admin_role_changed",
    performedBy: callerUsername,
    details: `Changed role of ${target.username} from ${target.role} to ${role}`,
  });
  return res.json({ success: true });
});

// ── Activate/deactivate: PATCH /api/admin/admins/:id/status ──
router.patch("/admin/admins/:id/status", async (req, res) => {
  const callerUsername = await requireSuperAdmin(req, res);
  if (!callerUsername) return;
  const id = parseInt(req.params.id, 10);
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be boolean" });

  const [target] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, id)).limit(1);
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود" });
  if (target.username === callerUsername) return res.status(400).json({ error: "لا يمكنك تعطيل حسابك الخاص" });

  await db.update(adminUsersTable).set({ isActive, updatedAt: new Date() }).where(eq(adminUsersTable.id, id));
  await db.insert(auditLogsTable).values({
    action: isActive ? "admin_account_activated" : "admin_account_deactivated",
    performedBy: callerUsername,
    details: `${isActive ? "Activated" : "Deactivated"} admin account: ${target.username}`,
  });
  return res.json({ success: true });
});

// ── Reset password (super_admin): POST /api/admin/admins/:id/reset-password ──
router.post("/admin/admins/:id/reset-password", async (req, res) => {
  const callerUsername = await requireSuperAdmin(req, res);
  if (!callerUsername) return;
  const id = parseInt(req.params.id, 10);
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) return res.status(400).json({ error: "كلمة المرور الجديدة مطلوبة" });
  if (newPassword !== confirmPassword) return res.status(400).json({ error: "كلمة المرور وتأكيدها غير متطابقتين" });
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return res.status(400).json({ error: strengthError });

  const [target] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, id)).limit(1);
  if (!target) return res.status(404).json({ error: "المستخدم غير موجود" });

  const passwordHash = await hashPasswordBcrypt(newPassword);
  await db.update(adminUsersTable).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsersTable.id, id));
  await db.insert(auditLogsTable).values({
    action: "admin_password_reset",
    performedBy: callerUsername,
    details: `Password reset for admin: ${target.username} by ${callerUsername}`,
  });
  return res.json({ success: true });
});

// ── Change own password: POST /api/admin/change-password ──
router.post("/admin/change-password", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }
  if (newPassword !== confirmPassword) return res.status(400).json({ error: "كلمة المرور الجديدة وتأكيدها غير متطابقتين" });
  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) return res.status(400).json({ error: strengthError });

  const [adminRecord] = await db.select().from(adminUsersTable)
    .where(eq(adminUsersTable.username, user.username)).limit(1);
  if (!adminRecord) return res.status(404).json({ error: "المستخدم غير موجود" });

  const valid = await verifyPassword(currentPassword, adminRecord.passwordHash);
  if (!valid) return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });

  const passwordHash = await hashPasswordBcrypt(newPassword);
  await db.update(adminUsersTable).set({ passwordHash, updatedAt: new Date() })
    .where(eq(adminUsersTable.id, adminRecord.id));
  await db.insert(auditLogsTable).values({
    action: "admin_password_changed",
    performedBy: user.username,
    details: `Admin ${user.username} changed their own password`,
  });
  return res.json({ success: true });
});

// ─────────────────────────────────────────
// Exploitation / Abuse Reports
// ─────────────────────────────────────────

// GET /api/admin/exploitation-reports — list all reports (all authenticated admins)
router.get("/admin/exploitation-reports", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const reports = await db
    .select()
    .from(exploitationReportsTable)
    .orderBy(desc(exploitationReportsTable.submittedAt));
  return res.json(reports);
});

// GET /api/admin/exploitation-reports/unread-count — count of new (unread) reports
router.get("/admin/exploitation-reports/unread-count", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(exploitationReportsTable)
    .where(eq(exploitationReportsTable.status, "new"));
  return res.json({ count });
});

// PATCH /api/admin/exploitation-reports/:id/status — update report status
router.patch("/admin/exploitation-reports/:id/status", async (req, res) => {
  const user = validateToken(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

  const { status } = req.body;
  if (!["new", "reviewed", "resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  await db
    .update(exploitationReportsTable)
    .set({
      status,
      reviewedBy: user.username,
      reviewedAt: new Date(),
    })
    .where(eq(exploitationReportsTable.id, id));

  await db.insert(auditLogsTable).values({
    action: "exploitation_report_status_updated",
    performedBy: user.username,
    details: `Report #${id} status changed to: ${status}`,
  });

  return res.json({ success: true });
});

export default router;
