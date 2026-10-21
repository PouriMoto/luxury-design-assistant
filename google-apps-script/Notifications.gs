/* ============================================================
   NOTIFICATIONS.GS — Adapter بله (مرحله ۵ تکمیل می‌شود)
   در این مرحله فقط یک تابع آماده است.
   شکست این تابع نباید لید را از بین ببرد.
   ============================================================ */

/**
 * اطلاع‌رسانی به کارشناس
 * @param {string} leadId
 * @param {Object} data — payload کامل submit_lead
 */
function notifyExpert(leadId, data) {
  const token = getProperty("BALE_TOKEN", "");
  if (!token) {
    console.log("[notifyExpert] BALE_TOKEN تنظیم نشده — اطلاع‌رسانی رد شد.");
    return { ok: false, reason: "not_configured" };
  }

  // TODO مرحله ۵: ساخت پیام و ارسال واقعی به بله
  // const message = buildLeadMessage(leadId, data);
  // return sendBaleMessage(token, getProperty("BALE_CHAT_ID", ""), message);

  console.log("[notifyExpert] placeholder — پیام ساخته نشد (مرحله ۵).");
  return { ok: false, reason: "placeholder" };
}

/**
 * ساخت متن پیام خلاصه لید (مرحله ۵ استفاده می‌شود)
 */
function buildLeadMessage(leadId, data) {
  const lead = data.lead || {};
  const answers = {};
  for (const a of (data.answers || [])) {
    answers[a.question_id] = a.answer_id;
  }
  const result = data.result || {};

  const lines = [
    "🔔 درخواست مشاوره جدید",
    "شناسه: " + leadId,
    "نام: " + (lead.name || "—"),
    "نوع پروژه: " + (answers["project_type"] || "—"),
    "مرحله پروژه: " + (answers["project_stage"] || "—"),
    "سبک: " + (answers["preferred_style"] || "—"),
    "زمان اجرا: " + (answers["project_timeline"] || "—"),
    "اولویت: " + (result.lead_priority || "—"),
    "رضایت تماس: " + (lead.contact_consent ? "ثبت شده" : "ثبت نشده"),
  ];
  return lines.join("\n");
}