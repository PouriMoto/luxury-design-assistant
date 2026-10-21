/* ============================================================
   EVENT BUS — Pub/Sub سبک با مدیریت خطای شنونده‌ها
   ماژول‌های دیگر فقط از این طریق با هم حرف می‌زنند.
   ============================================================ */

const EventBus = (() => {
  const listeners = Object.create(null);
  const history = []; // برای دیباگ در v0

  function on(eventName, callback) {
    if (typeof callback !== "function") {
      throw new TypeError("EventBus.on: callback باید تابع باشد");
    }
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(callback);

    // برگرداندن تابع off برای راحتی
    return () => off(eventName, callback);
  }

  function off(eventName, callback) {
    const arr = listeners[eventName];
    if (!arr) return;
    const i = arr.indexOf(callback);
    if (i >= 0) arr.splice(i, 1);
  }

  function emit(eventName, payload = {}) {
    // ثبت برای دیباگ
    history.push({ eventName, payload, at: Date.now() });
    if (history.length > 200) history.shift();

    const arr = listeners[eventName];
    if (!arr || arr.length === 0) return;

    // هر شنونده در try جدا — خطای یکی بقیه را نمی‌کشد
    for (const cb of arr.slice()) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[EventBus] listener error on "${eventName}":`, err);
      }
    }
  }

  function once(eventName, callback) {
    const wrapper = (payload) => {
      off(eventName, wrapper);
      callback(payload);
    };
    return on(eventName, wrapper);
  }

  function getHistory() {
    return history.slice();
  }

  function clearHistory() {
    history.length = 0;
  }

  return { on, off, once, emit, getHistory, clearHistory };
})();

window.EventBus = EventBus;