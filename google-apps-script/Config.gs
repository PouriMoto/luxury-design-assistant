/* ============================================================
   CONFIG.GS — ثابت‌ها، Script Properties، setup
   ============================================================ */

const CONFIG = {
  SCHEMA_VERSION: 1,

  MAX_BODY_BYTES: 64 * 1024,          // 64KB
  MAX_EVENTS_PER_BATCH: 50,
  DEDUP_TTL_SECONDS: 6 * 60 * 60,     // ۶ ساعت

  // نام‌های Sheets
  HEADERS: {
    Leads: [
      "lead_id", "created_at", "request_id", "session_id",
      "name", "phone", "city",
      "project_type", "project_stage", "preferred_style",
      "design_priority", "project_timeline", "measurement_status",
      "result_id", "lead_priority",
      "consultation_requested", "contact_consent",
      "lead_status",
    ],
    Answers: [
      "lead_id", "session_id", "question_id", "answer_id", "timestamp",
    ],
    Events: [
      "event_id", "session_id", "lead_id", "event_name",
      "question_id", "answer_id", "timestamp", "metadata_json",
    ],
    Followups: [
      "lead_id", "assigned_to", "status", "last_contact_at", "next_action", "notes",
    ],
  },
};

/**
 * خواندن Script Property (با fallback)
 * برای توکن‌های حساس مثل BALE_TOKEN استفاده می‌شود.
 */
function getProperty(key, defaultValue) {
  try {
    const val = PropertiesService.getScriptProperties().getProperty(key);
    return (val !== null && val !== undefined) ? val : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * راه‌اندازی اولیه: ساخت شیت‌ها + هدرها
 * یک بار از داخل Apps Script اجرا کن.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const [name, headers] of Object.entries(CONFIG.HEADERS)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      console.log("ساخته شد:", name);
    } else {
      console.log("از قبل موجود:", name);
    }
  }

  // تنظیم Script Property پیش‌فرض (اختیاری)
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ENV")) {
    props.setProperty("ENV", "prod");
  }

  console.log("✅ setup کامل شد.");
}

/**
 * تست سریع: بررسی دسترسی به شیت‌ها
 */
function testSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const name of Object.keys(CONFIG.HEADERS)) {
    const sheet = ss.getSheetByName(name);
    console.log(name, sheet ? "✓" : "✗");
  }
}