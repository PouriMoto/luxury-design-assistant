/* ============================================================
   API CLIENT — تنها لایه ارتباط با Google Apps Script
   هیچ ماژول دیگری مجاز نیست fetch مستقیم بزند.
   در مرحله ۲، endpoint خالی است → همه‌ی فراخوانی‌ها خطای
   NOT_CONFIGURED برمی‌گردانند تا زمانی که مرحله ۳ کامل شود.
   ============================================================ */

const ApiClient = (() => {
  let _config = null;
  let _queueInFlight = false;

  // ---- INIT ----
  function init(config) {
    _config = config || {};
    if (!_config.api) _config.api = {};
    return isConfigured();
  }

  function isConfigured() {
    return !!(_config && _config.api && _config.api.endpoint);
  }

  function getEndpoint() {
    return (_config && _config.api && _config.api.endpoint) || "";
  }

  function getTimeout() {
    return (_config && _config.api && _config.api.timeout_ms) || 12000;
  }

  function getMaxRetries() {
    return (_config && _config.api && _config.api.max_retries) ?? 2;
  }

  function getRetryDelays() {
    return (_config && _config.api && Array.isArray(_config.api.retry_delays_ms))
      ? _config.api.retry_delays_ms
      : [2000, 5000];
  }

  // ---- HELPERS ----

  function makeRequestId() {
    const rnd = Math.random().toString(36).slice(2, 10);
    return "req_" + Date.now().toString(36) + "_" + rnd;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * fetch با timeout و بدون CORS preflight
   * content-type: text/plain → Apps Script بدون preflight می‌پذیرد
   */
  async function rawFetch(payload) {
    const url = getEndpoint();
    if (!url) {
      throw makeError("NOT_CONFIGURED", "آدرس API هنوز تنظیم نشده است.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), getTimeout());

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      if (!res.ok) {
        throw makeError(
          "HTTP_" + res.status,
          `پاسخ سرور: ${res.status}`
        );
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw makeError("INVALID_RESPONSE", "پاسخ سرور JSON معتبر نبود.");
      }
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err && err.name === "AbortError") {
        throw makeError("TIMEOUT", "درخواست بیش از حد طول کشید.");
      }
      if (err && err.code) throw err;
      throw makeError("NETWORK_ERROR", err.message || "خطای شبکه.");
    }
  }

  function makeError(code, message) {
    const err = new Error(message);
    err.code = code;
    err.isApiError = true;
    return err;
  }

  /**
   * fetch با retry خودکار فقط برای خطاهای شبکه/تایم‌اوت
   */
  async function fetchWithRetry(payload) {
    const maxRetries = getMaxRetries();
    const delays = getRetryDelays();
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await rawFetch(payload);
        return result;
      } catch (err) {
        lastError = err;
        const retryable =
          err.code === "NETWORK_ERROR" ||
          err.code === "TIMEOUT" ||
          (err.code && err.code.startsWith("HTTP_5"));

        if (!retryable || attempt === maxRetries) {
          throw err;
        }
        const delay = delays[attempt] || 5000;
        console.warn(
          `[ApiClient] تلاش ${attempt + 1} ناموفق (${err.code}). تلاش بعدی در ${delay}ms`
        );
        await sleep(delay);
      }
    }
    throw lastError;
  }

  // ---- PUBLIC METHODS ----

  /**
   * ارسال لید
   * @param {Object} leadData - { name, phone, contact_consent, ... }
   * @param {Object} extra - { session_id, quiz_id, answers, result }
   * @returns {Object} { ok, lead_id, request_id, error? }
   */
  async function submitLead(leadData, extra = {}) {
    if (!isConfigured()) {
      return {
        ok: false,
        request_id: null,
        error: {
          code: "NOT_CONFIGURED",
          message: "اتصال به سرور هنوز تنظیم نشده است. مرحله ۳ (راه‌اندازی Apps Script) تکمیل نشده.",
        },
      };
    }

    const requestId = makeRequestId();
    const payload = {
      action: "submit_lead",
      schema_version: 1,
      request_id: requestId,
      session_id: extra.session_id || State.getSessionId(),
      lead: {
        name: leadData.name,
        phone: leadData.phone,
        city: leadData.city || null,
        consultation_requested: true,
        contact_consent: !!leadData.contact_consent,
      },
      answers: extra.answers || [],
      result: extra.result || null,
    };

    try {
      const res = await fetchWithRetry(payload);
      return {
        ok: res.ok === true,
        lead_id: res.lead_id || null,
        request_id: requestId,
        error: res.ok ? null : (res.error || { code: "UNKNOWN", message: "خطای ناشناخته" }),
      };
    } catch (err) {
      return {
        ok: false,
        request_id: requestId,
        error: { code: err.code || "UNKNOWN", message: err.message },
      };
    }
  }

  /**
   * ارسال batch رویدادها
   * @param {Array} events - آرایه‌ای از رویدادهای استاندارد
   * @returns {Object} { ok, accepted, request_id, error? }
   */
  async function submitEvents(events) {
    if (!Array.isArray(events) || events.length === 0) {
      return { ok: true, accepted: 0, request_id: null };
    }

    if (!isConfigured()) {
      return {
        ok: false,
        accepted: 0,
        request_id: null,
        error: {
          code: "NOT_CONFIGURED",
          message: "اتصال به سرور هنوز تنظیم نشده است.",
        },
      };
    }

    const requestId = makeRequestId();
    const payload = {
      action: "submit_events",
      schema_version: 1,
      request_id: requestId,
      session_id: State.getSessionId(),
      events,
    };

    try {
      const res = await fetchWithRetry(payload);
      return {
        ok: res.ok === true,
        accepted: (res.accepted != null) ? res.accepted : events.length,
        request_id: requestId,
        error: res.ok ? null : (res.error || { code: "UNKNOWN", message: "خطای ناشناخته" }),
      };
    } catch (err) {
      return {
        ok: false,
        accepted: 0,
        request_id: requestId,
        error: { code: err.code || "UNKNOWN", message: err.message },
      };
    }
  }

  /**
   * تست سلامت اتصال
   */
  async function healthCheck() {
    if (!isConfigured()) {
      return {
        ok: false,
        error: { code: "NOT_CONFIGURED", message: "endpoint تنظیم نشده." },
      };
    }

    try {
      const res = await rawFetch({
        action: "health_check",
        schema_version: 1,
      });
      return { ok: res.ok === true, raw: res };
    } catch (err) {
      return { ok: false, error: { code: err.code || "UNKNOWN", message: err.message } };
    }
  }

  return {
    init,
    isConfigured,
    submitLead,
    submitEvents,
    healthCheck,
    makeRequestId,
    _getQueueInFlight: () => _queueInFlight,
  };
})();

window.ApiClient = ApiClient;