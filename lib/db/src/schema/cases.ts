import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const casesTable = pgTable("cases", {
  id: serial("id").primaryKey(),
  caseNumber: text("case_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  studentId: text("student_id"),
  caseDescription: text("case_description").notNull(),
  canAccessCertificate: text("can_access_certificate").notNull(),
  governorate: text("governorate"),
  status: text("status").notNull().default("received"),
  assignedTo: text("assigned_to"),
  isFlagged: boolean("is_flagged").notNull().default(false),
  verificationCode: text("verification_code").notNull(),
  currentInstruction: text("current_instruction"),
  currentDraft: text("current_draft"),
  consentConfirmed: boolean("consent_confirmed").notNull().default(false),
  followUpResponse: text("follow_up_response"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseSchema = createInsertSchema(casesTable).omit({ id: true, submittedAt: true, updatedAt: true });
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof casesTable.$inferSelect;

export const caseStatusHistoryTable = pgTable("case_status_history", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  status: text("status").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  changedBy: text("changed_by").notNull(),
  note: text("note"),
});

export const insertStatusHistorySchema = createInsertSchema(caseStatusHistoryTable).omit({ id: true, changedAt: true });
export type InsertStatusHistory = z.infer<typeof insertStatusHistorySchema>;
export type StatusHistory = typeof caseStatusHistoryTable.$inferSelect;

export const internalNotesTable = pgTable("internal_notes", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  content: text("content").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(internalNotesTable).omit({ id: true, createdAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof internalNotesTable.$inferSelect;

export const uploadsTable = pgTable("uploads", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  caseNumber: text("case_number").notNull().default(""),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull().default(""),
  mimeType: text("mime_type").notNull().default(""),
  size: integer("size").notNull().default(0),
  category: text("category").notNull().default("other"),
  documentType: text("document_type"),
  uploadedBy: text("uploaded_by").notNull().default("student"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const generatedDraftsTable = pgTable("generated_drafts", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  draftContent: text("draft_content").notNull(),
  variation: text("variation"),
  releasedAt: timestamp("released_at"),
  releasedBy: text("released_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exploitationReportsTable = pgTable("exploitation_reports", {
  id: serial("id").primaryKey(),
  reporterNameOrAlias: text("reporter_name_or_alias").notNull(),
  contactMethod: text("contact_method"),
  notes: text("notes"),
  hasScreenshot: boolean("has_screenshot").notNull().default(false),
  isConfidential: boolean("is_confidential").notNull().default(true),
  status: text("status").notNull().default("new"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const insertExploitationReportSchema = createInsertSchema(exploitationReportsTable).omit({ id: true, submittedAt: true });
export type InsertExploitationReport = z.infer<typeof insertExploitationReportSchema>;
export type ExploitationReport = typeof exploitationReportsTable.$inferSelect;

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("intake"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  caseId: integer("case_id"),
  performedBy: text("performed_by").notNull(),
  details: text("details"),
  performedAt: timestamp("performed_at").notNull().defaultNow(),
});

export const emailNotificationsTable = pgTable("email_notifications", {
  id: serial("id").primaryKey(),
  caseId: integer("case_id").notNull(),
  caseNumber: text("case_number").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  status: text("status").notNull().default("pending"),
  triggeredBy: text("triggered_by").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  caseStatus: text("case_status").notNull(),
});
