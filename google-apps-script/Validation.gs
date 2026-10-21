/* ============================================================
   VALIDATION.GS — اعتبارسنجی سمت سرور
   به مرورگر اعتماد نمی‌کنیم.
   ============================================================ */

function validateSchemaVersion(data) {
  if (!data || typeof data !== "object") {
    return errorResponse("VALIDATION_ERROR", "بدنه درخواست نامعتبر است.");
  }
  if (data.schema_version !== CONFIG.SCHEMA_VERSION) {
    return errorResponse(
      "VALIDATION_ERROR",
      "schema_version نامعتبر است. انتظار: " + CONFIG.SCHEMA_VERSION
    );
  }
  return null;
}

function validateLeadPayload(data) {
  // request_id
  if (!data.request_id || typeof data.request_id !== "string" || data.request_id.length > 100) {
    return { ok: false, message: "request_id نامعتبر است." };
  }

  // lead
  const lead = data.lead;
  if (!lead || typeof lead !== "object") {
    return { ok: false, message: "اطلاعات لید موجود نیست." };
  }

  // name
  const name = (lead.name || "").trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, message: "نام باید بین ۲ تا ۶۰ کاراکتر باشد." };
  }

  // phone — ۱۱ رقم، شروع با ۰۹
  const phone = (lead.phone || "").trim();
  if (!/^09\d{9}$/.test(phone)) {
    return { ok: false, message: "شماره تماس نامعتبر است." };
  }

  // contact_consent — باید boolean باشد (اما اجباری نیست true)
  if (typeof lead.contact_consent !== "boolean") {
    return { ok: false, message: "وضعیت رضایت تماس نامعتبر است." };
  }

  // answers — آرایه (اختیاری اما اگر بود، باید معتبر باشد)
  if (data.answers && !Array.isArray(data.answers)) {
    return { ok: false, message: "آرایه پاسخ‌ها نامعتبر است." };
  }
  if (Array.isArray(data.answers)) {
    for (const a of data.answers) {
      if (!a || !a.question_id || !a.answer_id) {
        return { ok: false, message: "یکی از پاسخ‌ها فاقد شناسه است." };
      }
      if (String(a.question_id).length > 60 || String(a.answer_id).length > 60) {
        return { ok: false, message: "شناسه پاسخ بیش از حد طولانی است." };
      }
    }
  }

  // result
  if (data.result && typeof data.result === "object") {
    if (data.result.result_id && String(data.result.result_id).length > 60) {
      return { ok: false, message: "شناسه نتیجه نامعتبر است." };
    }
  }

  return { ok: true };
}

function validateEventPayload(evt) {
  if (!evt || typeof evt !== "object") {
    return { ok: false, message: "رویداد نامعتبر است." };
  }

  // event_id الزامی
  if (!evt.event_id || typeof evt.event_id !== "string" || evt.event_id.length > 100) {
    return { ok: false, message: "event_id نامعتبر است." };
  }

  // event_name الزامی
  if (!evt.event_name || typeof evt.event_name !== "string" || evt.event_name.length > 60) {
    return { ok: false, message: "event_name نامعتبر است." };
  }

  // event_name باید در whitelist باشد
  const allowed = [
    "assistant_opened", "quiz_started", "question_viewed",
    "answer_selected", "back_clicked", "question_skipped",
    "quiz_completed", "quiz_abandoned",
    "scoring_completed", "result_generated", "result_viewed",
    "catalog_opened", "recommendation_clicked",
    "lead_form_opened", "lead_form_submitted", "lead_saved",
    "consultation_requested", "contact_consent_given",
  ];
  if (allowed.indexOf(evt.event_name) < 0) {
    return { ok: false, message: "event_name ناشناخته: " + evt.event_name };
  }

  // timestamp
  if (!evt.timestamp || typeof evt.timestamp !== "string") {
    return { ok: false, message: "timestamp نامعتبر است." };
  }

  // metadata (اختیاری)
  if (evt.metadata && typeof evt.metadata !== "object") {
    return { ok: false, message: "metadata باید آبجکت باشد." };
  }

  // طول فیلدها
  if (evt.question_id && String(evt.question_id).length > 60) {
    return { ok: false, message: "question_id طولانی است." };
  }
  if (evt.answer_id && String(evt.answer_id).length > 60) {
    return { ok: false, message: "answer_id طولانی است." };
  }

  return { ok: true };
}