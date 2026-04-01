export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
}

const STATUS_ARABIC_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  under_review: "قيد المراجعة",
  need_more_info: "بحاجة إلى معلومات إضافية",
  approved_for_guidance: "معتمد للتوجيه",
  draft_prepared: "تم تحضير المسودة",
  awaiting_student_sending: "في انتظار إرسالك",
  sent_by_student: "تم تأكيد الإرسال",
  follow_up_in_progress: "المتابعة جارية",
  completed: "مكتملة",
  closed: "مغلقة",
  rejected: "مرفوضة",
};

function wrapArabicEmail(body: string, caseNumber: string, statusLabel: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>تحديث حالة طلبك — ${caseNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; background: #f3f4f6; color: #1a1a2e; direction: rtl; }
    .wrapper { max-width: 640px; margin: 30px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header p { color: #a0b4d6; font-size: 14px; }
    .status-badge { display: inline-block; background: rgba(255,255,255,0.15); color: #fff; padding: 6px 18px; border-radius: 30px; font-size: 13px; font-weight: 600; margin-top: 12px; }
    .content { padding: 36px 40px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1a1a2e; margin-bottom: 20px; }
    .message { font-size: 15px; line-height: 2; color: #374151; margin-bottom: 24px; }
    .info-box { background: #f0f7ff; border-right: 4px solid #1a1a2e; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .info-box strong { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box span { font-size: 22px; font-weight: 700; color: #1a1a2e; font-family: monospace; }
    .cta-button { display: block; text-align: center; background: #1a1a2e; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; margin: 24px 0; }
    .warning { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 14px 18px; font-size: 13px; color: #92400e; margin-top: 16px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { font-size: 12px; color: #9ca3af; line-height: 1.8; }
    .footer a { color: #1a1a2e; text-decoration: none; }
    .divider { height: 1px; background: #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>مبادرة طلاب السويداء</h1>
      <p>منصة دعم مستندات UoPeople — خدمة مجانية وسرية</p>
      <span class="status-badge">تحديث الحالة: ${statusLabel}</span>
    </div>
    <div class="content">
      <div class="info-box">
        <strong>رقم طلبك</strong>
        <span>${caseNumber}</span>
      </div>
      ${body}
      <div class="divider"></div>
      <a class="cta-button" href="https://sweida-platform.replit.app/track">متابعة حالة طلبي</a>
      <div class="warning">
        ⚠️ <strong>تذكير مهم:</strong> هذه الخدمة مجانية 100٪. أي شخص يطلب مبلغاً مالياً لا يمثل فريقنا. يرجى الإبلاغ فوراً.
      </div>
    </div>
    <div class="footer">
      <p>هذا البريد تم إرساله تلقائياً بناءً على تحديث حالة طلبك.<br>
      يرجى عدم الرد على هذا البريد مباشرةً.<br>
      <a href="https://sweida-platform.replit.app/privacy">سياسة الخصوصية</a> · <a href="https://sweida-platform.replit.app/report">الإبلاغ عن استغلال</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function generateEmailTemplate(
  status: string,
  caseNumber: string,
  studentName: string,
  customMessage?: string
): EmailTemplate {
  const statusLabel = STATUS_ARABIC_LABELS[status] || status;
  const firstName = studentName.split(" ")[0] || studentName;

  const bodyContent = customMessage
    ? buildCustomBody(firstName, customMessage, status)
    : buildDefaultBody(firstName, status, statusLabel);

  return {
    subject: `تحديث حالة طلبك [${caseNumber}] — ${statusLabel}`,
    bodyHtml: wrapArabicEmail(bodyContent, caseNumber, statusLabel),
  };
}

function buildCustomBody(firstName: string, customMessage: string, status: string): string {
  return `
    <p class="greeting">عزيزي/عزيزتي ${firstName}،</p>
    <p class="message">${customMessage}</p>
    ${buildActionNote(status)}
  `;
}

function buildDefaultBody(firstName: string, status: string, statusLabel: string): string {
  const greet = `<p class="greeting">عزيزي/عزيزتي ${firstName}،</p>`;

  const bodies: Record<string, string> = {
    received: `
      ${greet}
      <p class="message">
        نود إعلامك بأننا <strong>استلمنا طلبك بنجاح</strong> وهو الآن مسجّل في نظامنا.
        سيقوم الفريق بمراجعة تفاصيل طلبك في أقرب وقت ممكن.
      </p>
      <p class="message">يرجى الاحتفاظ برقم طلبك في مكان آمن لمتابعة حالتك لاحقاً.</p>
    `,
    under_review: `
      ${greet}
      <p class="message">
        نود إعلامك بأن طلبك <strong>قيد المراجعة حالياً</strong> من قبل الفريق المختص.
        يعكف الفريق على دراسة حالتك بعناية لتقديم أفضل توجيه ممكن.
      </p>
      <p class="message">لا يلزمك القيام بأي إجراء في الوقت الراهن. سنتواصل معك عند الحاجة.</p>
    `,
    need_more_info: `
      ${greet}
      <p class="message">
        بعد مراجعة طلبك، <strong>يحتاج الفريق إلى معلومات أو وثائق إضافية</strong> لاستكمال معالجة حالتك.
      </p>
      <p class="message">يرجى زيارة صفحة متابعة الطلب للاطلاع على ما هو مطلوب منك تحديداً، ثم رفع المعلومات أو الملفات المطلوبة في أقرب وقت.</p>
    `,
    approved_for_guidance: `
      ${greet}
      <p class="message">
        يسعدنا إبلاغك بأن طلبك <strong>تمت الموافقة عليه</strong> للمضي في مرحلة التوجيه.
        سيتم تحضير مسودة رسالة مخصصة لك خلال فترة وجيزة.
      </p>
      <p class="message">سنرسل إليك إشعاراً آخر عندما تكون المسودة جاهزة. ترقّب!</p>
    `,
    draft_prepared: `
      ${greet}
      <p class="message">
        يسعدنا إبلاغك بأن <strong>مسودة الرسالة المخصصة لك جاهزة</strong>.
        يرجى تسجيل الدخول بصفحة متابعة الطلب لقراءتها وتحضيرها للإرسال.
      </p>
      <p class="message">هذه المسودة مصمَّمة خصيصاً لحالتك. يرجى عدم مشاركتها مع أحد.</p>
    `,
    awaiting_student_sending: `
      ${greet}
      <p class="message">
        <strong>المسودة جاهزة وبانتظارك!</strong>
        يرجى فتح صفحة متابعة الطلب، نسخ المسودة المخصصة لك، ثم إرسالها من بريدك الإلكتروني الجامعي إلى الجهة المعنية.
      </p>
      <p class="message">بعد الإرسال، يرجى العودة لصفحة المتابعة وتأكيد أنك أرسلت البريد.</p>
    `,
    sent_by_student: `
      ${greet}
      <p class="message">
        شكراً جزيلاً! <strong>تم تسجيل تأكيد إرسالك للرسالة</strong> إلى الجامعة.
        سيتابع الفريق الحالة من الآن ويتواصل معك عند أي تطور.
      </p>
    `,
    follow_up_in_progress: `
      ${greet}
      <p class="message">
        نود إعلامك بأن الفريق <strong>يتابع حالتك حالياً</strong> مع الجهات المعنية.
        هذه المرحلة قد تستغرق بعض الوقت. سنطلعك على أي مستجدات فور توفّرها.
      </p>
    `,
    completed: `
      ${greet}
      <p class="message">
        يسعدنا إبلاغك بأن <strong>حالتك اكتملت بنجاح</strong>! 🎉
        نتمنى لك التوفيق في مسيرتك الأكاديمية.
      </p>
      <p class="message">إذا احتجت مساعدة مستقبلاً أو أردت الإبلاغ عن أي استغلال، نحن هنا دائماً.</p>
    `,
    closed: `
      ${greet}
      <p class="message">
        نود إعلامك بأنه <strong>تم إغلاق طلبك</strong> في نظامنا.
        إذا كان لديك استفسار أو تحتاج إعادة فتحه، يرجى التواصل معنا عبر صفحة الإبلاغ.
      </p>
    `,
    rejected: `
      ${greet}
      <p class="message">
        نأسف لإبلاغك بأنه <strong>تعذّر علينا معالجة طلبك في الوقت الراهن</strong>.
        يرجى مراجعة صفحة متابعة الطلب للاطلاع على سبب ذلك.
      </p>
      <p class="message">إذا كان لديك وثائق أو معلومات إضافية تدعم طلبك، يمكنك تقديم طلب جديد مع توضيح إضافي.</p>
    `,
  };

  return bodies[status] || `${greet}<p class="message">تم تحديث حالة طلبك إلى: <strong>${statusLabel}</strong>. يرجى متابعة صفحة الطلب للتفاصيل.</p>`;
}

function buildActionNote(status: string): string {
  const actions: Record<string, string> = {
    need_more_info: `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;font-size:14px;color:#92400e;margin-top:16px;">📎 <strong>إجراء مطلوب منك:</strong> يرجى رفع المعلومات أو الملفات المطلوبة في صفحة متابعة الطلب.</div>`,
    awaiting_student_sending: `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px 18px;font-size:14px;color:#065f46;margin-top:16px;">📧 <strong>إجراء مطلوب منك:</strong> يرجى إرسال المسودة من بريدك الجامعي ثم تأكيد ذلك في صفحة المتابعة.</div>`,
  };
  return actions[status] || "";
}
