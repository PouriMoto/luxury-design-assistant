/* ============================================================
   STATE — نگهداری وضعیت آزمون + تولید شناسه‌ها
   تنها نقطه مرجع برای پاسخ‌ها، مسیر، و شناسه‌ها.
   ============================================================ */

const State = (() => {
  // تولید UUID v4 ساده (بدون کتابخانه)
  function uuid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ساختار داخلی state
  const _state = {
    sessionId: null,
    quizId: null,

    // پاسخ‌ها به شکل { [questionId]: answerId }
    answers: {},

    // تاریخچه‌ی ترتیب سؤال‌ها برای back
    path: [],

    // سؤال فعلی
    currentQuestionId: null,

    // شاخص پیشرفت (تعداد پاسخ‌های معتبر داده‌شده)
    answeredCount: 0,

    // نتیجه محاسبه‌شده
    outcome: null,
    styleScores: null,
    leadPriority: null,

    // وضعیت‌های UI
    isTyping: false,
    isCompleting: false,

    // لید (در v0 فقط برای نمایش)
    lead: null,
    leadId: null,
  };

  // ---- LIFECYCLE ----

  function init({ quizId }) {
    _state.sessionId = "sess_" + uuid();
    _state.quizId = quizId;
    _state.answers = {};
    _state.path = [];
    _state.currentQuestionId = null;
    _state.answeredCount = 0;
    _state.outcome = null;
    _state.styleScores = null;
    _state.leadPriority = null;
    _state.isTyping = false;
    _state.isCompleting = false;
    _state.lead = null;
    _state.leadId = null;
    return _state.sessionId;
  }

  function reset() {
    const quizId = _state.quizId;
    init({ quizId });
  }

  // ---- ANSWERS ----

  function setAnswer(questionId, answerId) {
    if (!questionId || !answerId) {
      throw new Error("State.setAnswer: شناسه سؤال و پاسخ الزامی است");
    }
    const wasEmpty = !(questionId in _state.answers);
    _state.answers[questionId] = answerId;
    if (wasEmpty) _state.answeredCount += 1;
  }

  function getAnswer(questionId) {
    return _state.answers[questionId] || null;
  }

  function getAllAnswers() {
    return { ..._state.answers };
  }

  function hasAnswer(questionId) {
    return questionId in _state.answers;
  }

  // ---- PATH (برای back) ----

  function pushPath(questionId) {
    if (_state.path[_state.path.length - 1] !== questionId) {
      _state.path.push(questionId);
    }
  }

  function popPath() {
    return _state.path.pop() || null;
  }

  function getPreviousQuestionId() {
    // path شامل سؤال فعلی است در انتها؛ پس دومی از آخر می‌شود قبلی
    if (_state.path.length < 2) return null;
    return _state.path[_state.path.length - 2];
  }

  function getPath() {
    return _state.path.slice();
  }

  // ---- CURRENT ----

  function setCurrentQuestion(questionId) {
    _state.currentQuestionId = questionId;
  }

  function getCurrentQuestionId() {
    return _state.currentQuestionId;
  }

  // ---- RESULT ----

  function setScores({ styleScores, leadPriority }) {
    _state.styleScores = styleScores;
    _state.leadPriority = leadPriority;
  }

  function setOutcome(outcome) {
    _state.outcome = outcome;
  }

  function getScores() {
    return {
      styleScores: _state.styleScores,
      leadPriority: _state.leadPriority,
    };
  }

  function getOutcome() {
    return _state.outcome;
  }

  // ---- LEAD ----

  function setLead(lead) {
    _state.lead = lead;
    _state.leadId = "lead_v0_" + Math.floor(Math.random() * 100000);
  }

  function getLead() {
    return _state.lead;
  }

  function getLeadId() {
    return _state.leadId;
  }

  // ---- UI FLAGS ----

  function setTyping(v) { _state.isTyping = !!v; }
  function isTyping() { return _state.isTyping; }

  function setCompleting(v) { _state.isCompleting = !!v; }
  function isCompleting() { return _state.isCompleting; }

  // ---- META ----

  function getSessionId() { return _state.sessionId; }
  function getQuizId() { return _state.quizId; }

  function snapshot() {
    return JSON.parse(JSON.stringify(_state));
  }

  return {
    init,
    reset,
    setAnswer,
    getAnswer,
    getAllAnswers,
    hasAnswer,
    pushPath,
    popPath,
    getPreviousQuestionId,
    getPath,
    setCurrentQuestion,
    getCurrentQuestionId,
    setScores,
    getScores,
    setOutcome,
    getOutcome,
    setLead,
    getLead,
    getLeadId,
    setTyping,
    isTyping,
    setCompleting,
    isCompleting,
    getSessionId,
    getQuizId,
    snapshot,
  };
})();

window.State = State;