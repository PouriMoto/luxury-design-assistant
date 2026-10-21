/* ============================================================
   ANALYTICS — ثبت رویدادها در v0
   هیچ ارسال شبکه‌ای ندارد. فقط console + آرایه در حافظه.
   در نسخه نهایی این ماژول مسئول batch ارسال به Apps Script است.
   ============================================================ */

const Analytics = (() => {
  const queue = [];
  const sentLog = []; // برای دیباگ

  function makeEventId() {
    // شناسه یکتای سبک
    const rnd = Math.random().toString(36).slice(2, 10);
    return "evt_" + Date.now().toString(36) + "_" + rnd;
  }

  function buildEvent(eventName, payload = {}) {
    const base = {
      event_id: makeEventId(),
      event_name: eventName,
      session_id: State.getSessionId() || null,
      lead_id: State.getLeadId() || null,
      quiz_id: State.getQuizId() || null,
      question_id: payload.question_id || null,
      answer_id: payload.answer_id || null,
      timestamp: new Date().toISOString(),
      metadata: payload.metadata || {},
    };
    return base;
  }

  function track(eventName, payload) {
    try {
      const evt = buildEvent(eventName, payload);
      queue.push(evt);

      // نمایش کنسول برای v0
      const tag = `%c[${eventName}]`;
      const style = "background:#c9a961;color:#2b2419;padding:1px 6px;border-radius:3px;font-weight:bold";
      console.log(tag, style, evt);

      // در v0 فقط بعد از ۱۰ رویداد "ارسال شبیه‌سازی" می‌کنیم
      if (queue.length >= 10) flush();
    } catch (err) {
      // Analytics هرگز نباید جریان آزمون را قطع کند
      console.warn("[Analytics] track failed:", err);
    }
  }

  function flush() {
    if (queue.length === 0) return;
    // در v0 ارسال واقعی نیست؛ فقط انتقال به sentLog
    const batch = queue.splice(0, queue.length);
    sentLog.push({ at: new Date().toISOString(), count: batch.length });
    console.log(`%c[Analytics] flush شبیه‌سازی شد: ${batch.length} رویداد`, "color:#7a9670");
  }

  function getQueue() {
    return queue.slice();
  }

  function getSentLog() {
    return sentLog.slice();
  }

  function getCount() {
    return sentLog.reduce((sum, b) => sum + b.count, 0) + queue.length;
  }

  function reset() {
    queue.length = 0;
    sentLog.length = 0;
  }

  return { track, flush, getQueue, getSentLog, getCount, reset };
})();

window.Analytics = Analytics;