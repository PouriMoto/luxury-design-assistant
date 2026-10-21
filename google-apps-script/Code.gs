/* ============================================================
   CODE.GS — Router اکشن‌ها
   نقاط ورود: doPost (اصلی) و doGet (health check)
   ============================================================ */

/**
 * GET — فقط برای health_check ساده
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || "health_check";
  if (action === "health_check") {
    return jsonResponse({
      ok: true,
      service: "luxury-design-assistant",
      schema_version: CONFIG.SCHEMA_VERSION,
      time: new Date().toISOString(),
    });
  }
  return jsonResponse({ ok: false, error: { code: "UNKNOWN_ACTION", message: "اکشن نامعتبر" } });
}

/**
 * POST — نقطه ورود اصلی
 * body: { action, schema_version, request_id, ... }
 */
function doPost(e) {
  try {
    // 1) بررسی اندازه
    const bodySize = (e && e.postData && e.postData.contents) ? e.postData.contents.length : 0;
    if (bodySize > CONFIG.MAX_BODY_BYTES) {
      return jsonResponse(errorResponse("RATE_LIMITED", "حجم درخواست بیش از حد مجاز است."));
    }

    // 2) parse
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse(errorResponse("VALIDATION_ERROR", "بدنه درخواست JSON معتبر نیست."));
    }

    // 3) اعتبارسنجی اسکیما
    const schemaError = validateSchemaVersion(data);
    if (schemaError) return jsonResponse(schemaError);

    // 4) مسیریابی
    const action = data.action;
    switch (action) {
      case "health_check":
        return jsonResponse({
          ok: true,
          request_id: data.request_id || null,
          service: "luxury-design-assistant",
          schema_version: CONFIG.SCHEMA_VERSION,
          time: new Date().toISOString(),
        });

      case "submit_lead":
        return jsonResponse(handleSubmitLead(data));

      case "submit_events":
        return jsonResponse(handleSubmitEvents(data));

      default:
        return jsonResponse(errorResponse("UNKNOWN_ACTION", "اکشن نامعتبر است: " + action));
    }
  } catch (err) {
    console.error("doPost error:", err);
    return jsonResponse(errorResponse("SERVER_ERROR", "خطای سرور: " + err.message));
  }
}

/* ============================================================
   HANDLERS
   ============================================================ */

function handleSubmitLead(data) {
  // 1) اعتبارسنجی
  const v = validateLeadPayload(data);
  if (!v.ok) {
    return errorResponse("VALIDATION_ERROR", v.message, data.request_id);
  }

  // 2) بررسی تکراری با CacheService
  const cache = CacheService.getScriptCache();
  const dedupKey = "req_" + data.request_id;
  if (cache.get(dedupKey)) {
    return errorResponse("DUPLICATE_REQUEST", "این درخواست قبلاً ثبت شده است.", data.request_id);
  }

  // 3) تولید lead_id (فقط در سرور)
  const leadId = "lead_" + Utilities.getUuid().slice(0, 8) + "_" + Date.now().toString(36);

  // 4) ذخیره در Sheets — قبل از هر اطلاع‌رسانی
  try {
    saveLeadToSheet(leadId, data);
    saveAnswersToSheet(leadId, data);
  } catch (err) {
    console.error("saveLead failed:", err);
    return errorResponse("SERVER_ERROR", "ثبت لید ناموفق بود: " + err.message, data.request_id);
  }

  // 5) علامت‌گذاری dedup (۶ ساعت)
  cache.put(dedupKey, "1", CONFIG.DEDUP_TTL_SECONDS);

  // 6) تلاش برای اطلاع‌رسانی — شکست آن لید را از بین نمی‌برد
  try {
    notifyExpert(leadId, data);
  } catch (notifyErr) {
    console.warn("notifyExpert failed (lead is safe):", notifyErr);
  }

  // 7) پاسخ موفق
  return {
    ok: true,
    request_id: data.request_id,
    lead_id: leadId,
    created_at: new Date().toISOString(),
  };
}

function handleSubmitEvents(data) {
  if (!Array.isArray(data.events) || data.events.length === 0) {
    return errorResponse("VALIDATION_ERROR", "آرایه رویدادها خالی یا نامعتبر است.", data.request_id);
  }

  if (data.events.length > CONFIG.MAX_EVENTS_PER_BATCH) {
    return errorResponse("RATE_LIMITED", "تعداد رویدادها بیش از حد مجاز است.", data.request_id);
  }

  const validated = [];
  for (const evt of data.events) {
    const v = validateEventPayload(evt);
    if (!v.ok) {
      // در prod رویداد نامعتبر را نادیده می‌گیریم (اما در پاسخ گزارش می‌دهیم)
      console.warn("invalid event skipped:", v.message, evt);
      continue;
    }
    validated.push(evt);
  }

  if (validated.length === 0) {
    return {
      ok: true,
      request_id: data.request_id,
      accepted: 0,
      rejected: data.events.length,
    };
  }

  try {
    saveEventsToSheet(validated, data.session_id || null);
  } catch (err) {
    console.error("saveEvents failed:", err);
    return errorResponse("SERVER_ERROR", "ثبت رویدادها ناموفق بود.", data.request_id);
  }

  return {
    ok: true,
    request_id: data.request_id,
    accepted: validated.length,
    rejected: data.events.length - validated.length,
  };
}

/* ============================================================
   SHEET HELPERS
   ============================================================ */

function saveLeadToSheet(leadId, data) {
  const sheet = getOrCreateSheet("Leads", CONFIG.HEADERS.Leads);
  const lead = data.lead || {};
  const answers = answersToMap(data.answers || []);
  const result = data.result || {};

  sheet.appendRow([
    leadId,
    new Date(),
    data.request_id || "",
    data.session_id || "",
    lead.name || "",
    lead.phone || "",
    lead.city || "",
    answers["project_type"] || "",
    answers["project_stage"] || "",
    answers["preferred_style"] || "",
    answers["design_priority"] || "",
    answers["project_timeline"] || "",
    answers["measurement_status"] || "",
    result.result_id || "",
    result.lead_priority || "",
    lead.consultation_requested ? "بله" : "خیر",
    lead.contact_consent ? "بله" : "خیر",
    "new",
  ]);
}

function saveAnswersToSheet(leadId, data) {
  const sheet = getOrCreateSheet("Answers", CONFIG.HEADERS.Answers);
  const answers = data.answers || [];
  if (answers.length === 0) return;

  const rows = answers.map((a) => [
    leadId,
    data.session_id || "",
    a.question_id || "",
    a.answer_id || "",
    a.timestamp || new Date().toISOString(),
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function saveEventsToSheet(events, sessionId) {
  const sheet = getOrCreateSheet("Events", CONFIG.HEADERS.Events);
  if (events.length === 0) return;

  const rows = events.map((evt) => [
    evt.event_id || "",
    sessionId || evt.session_id || "",
    evt.lead_id || "",
    evt.event_name || "",
    evt.question_id || "",
    evt.answer_id || "",
    evt.timestamp || new Date().toISOString(),
    evt.metadata ? JSON.stringify(evt.metadata) : "",
  ]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function answersToMap(answersArray) {
  const map = {};
  for (const a of answersArray) {
    if (a && a.question_id) map[a.question_id] = a.answer_id;
  }
  return map;
}

/* ============================================================
   RESPONSE HELPERS
   ============================================================ */

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(code, message, requestId) {
  return {
    ok: false,
    request_id: requestId || null,
    error: { code: code, message: message },
  };
}