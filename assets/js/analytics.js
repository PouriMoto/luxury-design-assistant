/* ============================================================
   ANALYTICS — صف رویدادها در IndexedDB + ارسال دسته‌ای
   جریان:
     1. track(event) → رویداد به memory buffer + IndexedDB
     2. هر batch_interval_ms → تلاش برای flush
     3. flush → submitEvents → در صورت موفقیت، از IndexedDB حذف
     4. در صورت خطای شبکه، رویدادها در IndexedDB می‌مانند
     5. retry خودکار (۲ تلاش) توسط ApiClient انجام می‌شود
   هیچ شکستی در Analytics باعث توقف آزمون نمی‌شود.
   ============================================================ */

const Analytics = (() => {
  let _config = null;
  let _db = null;
  let _dbReady = false;
  let _flushTimer = null;
  let _inFlight = false;

  // ---- INIT ----
  async function init(config) {
    _config = config || {};
    if (!_config.analytics) _config.analytics = {};

    try {
      _db = await openDB();
      _dbReady = true;
      schedulePeriodicFlush();
      // تلاش برای flush رویدادهای باقی‌مانده از نشست قبلی
      setTimeout(() => flush().catch(() => {}), 2000);
    } catch (err) {
      console.warn("[Analytics] IndexedDB در دسترس نیست، صف فقط در حافظه:", err.message);
      _dbReady = false;
      schedulePeriodicFlush();
    }
  }

  // ---- INDEXEDDB ----

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB در این مرورگر پشتیبانی نمی‌شود."));
        return;
      }
      const dbName = _config.analytics.db_name || "lda_analytics";
      const dbVersion = _config.analytics.db_version || 1;
      const storeName = _config.analytics.store_name || "events";

      const req = indexedDB.open(dbName, dbVersion);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "event_id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("session_id", "session_id", { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error || new Error("خطای IndexedDB"));
    });
  }

  function idbStore(mode) {
    const storeName = _config.analytics.store_name || "events";
    const tx = _db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  function idbPut(event) {
    if (!_dbReady) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const store = idbStore("readwrite");
        const req = store.put(event);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function idbGetAll() {
    if (!_dbReady) return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        const store = idbStore("readonly");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  function idbDeleteBatch(eventIds) {
    if (!_dbReady || !eventIds.length) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const store = idbStore("readwrite");
        eventIds.forEach((id) => store.delete(id));
        // منتظر تکمیل تراکنش
        store.transaction.oncomplete = () => resolve();
        store.transaction.onerror = () => resolve();
      } catch (e) {
        resolve();
      }
    });
  }

  function idbCount() {
    if (!_dbReady) return Promise.resolve(0);
    return new Promise((resolve) => {
      try {
        const store = idbStore("readonly");
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }

  // ---- EVENT BUILDING ----

  function makeEventId() {
    const rnd = Math.random().toString(36).slice(2, 10);
    return "evt_" + Date.now().toString(36) + "_" + rnd;
  }

  function buildEvent(eventName, payload = {}) {
    return {
      event_id: makeEventId(),
      event_name: eventName,
      session_id: (window.State && State.getSessionId()) || null,
      lead_id: (window.State && State.getLeadId()) || null,
      quiz_id: (window.State && State.getQuizId()) || null,
      question_id: payload.question_id || null,
      answer_id: payload.answer_id || null,
      timestamp: new Date().toISOString(),
      metadata: payload.metadata || {},
    };
  }

  // ---- TRACK ----

  async function track(eventName, payload = {}) {
    if (!_config || !_config.analytics || _config.analytics.enabled === false) return;

    try {
      const evt = buildEvent(eventName, payload);

      // لاگ کنسول برای دیباگ
      const tag = `%c[${eventName}]`;
      const style = "background:#c9a961;color:#2b2419;padding:1px 6px;border-radius:3px;font-weight:bold";
      console.log(tag, style, evt);

      // ذخیره در IndexedDB
      const saved = await idbPut(evt);
      if (!saved) {
        console.warn("[Analytics] IndexedDB ذخیره نشد، رویداد فقط در حافظه:", eventName);
      }

      // اگر از حد مجاز صف گذشتیم، flush فوری
      const count = await idbCount();
      const maxQueue = _config.analytics.max_queue_size || 300;
      if (count >= maxQueue) {
        flush().catch(() => {});
      }
    } catch (err) {
      // Analytics هرگز جریان آزمون را قطع نمی‌کند
      console.warn("[Analytics] track failed:", err);
    }
  }

  // ---- FLUSH ----

  function schedulePeriodicFlush() {
    if (_flushTimer) clearInterval(_flushTimer);
    const interval = (_config.analytics.batch_interval_ms) || 15000;
    _flushTimer = setInterval(() => {
      flush().catch(() => {});
    }, interval);
  }

  async function flush() {
    if (_inFlight) return;
    if (!window.ApiClient || !ApiClient.isConfigured()) {
      // endpoint هنوز تنظیم نشده، صبر می‌کنیم
      return;
    }

    _inFlight = true;
    try {
      const allEvents = await idbGetAll();
      if (allEvents.length === 0) return;

      const batchSize = _config.analytics.batch_size || 20;
      const batch = allEvents
        .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
        .slice(0, batchSize);

      const res = await ApiClient.submitEvents(batch);

      if (res.ok) {
        const ids = batch.map((e) => e.event_id);
        await idbDeleteBatch(ids);
        console.log(
          `%c[Analytics] ${ids.length} رویداد با موفقیت ارسال شد`,
          "color:#7a9670"
        );
        // اگر رویداد بیشتری مانده، بلافاصله دوباره تلاش کن
        const remaining = await idbCount();
        if (remaining > 0) {
          _inFlight = false;
          setTimeout(() => flush().catch(() => {}), 500);
          return;
        }
      } else {
        console.warn(
          "[Analytics] ارسال ناموفق:",
          res.error && res.error.code,
          "- رویدادها در صف می‌مانند"
        );
      }
    } catch (err) {
      console.warn("[Analytics] خطای flush:", err.message);
    } finally {
      _inFlight = false;
    }
  }

  // ---- PUBLIC ----

  async function getQueue() {
    return await idbGetAll();
  }

  async function getCount() {
    return await idbCount();
  }

  async function clearQueue() {
    const all = await idbGetAll();
    await idbDeleteBatch(all.map((e) => e.event_id));
  }

  function stop() {
    if (_flushTimer) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
  }

  return {
    init,
    track,
    flush,
    getQueue,
    getCount,
    clearQueue,
    stop,
  };
})();

window.Analytics = Analytics;