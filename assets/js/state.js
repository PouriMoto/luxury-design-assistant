/* ============================================================
   STATE — نگهداری وضعیت آزمون + وضعیت شبکه + وضعیت API
   تنها نقطه مرجع برای پاسخ‌ها، مسیر، شناسه‌ها، وضعیت اتصال.
   ============================================================ */

const State = (() => {
  function uuid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const _state = {
    sessionId: null,
    quizId: null,

    answers: {},
    path: [],

    currentQuestionId: null,
    answeredCount: 0,

    outcome: null,
    styleScores: null,
    leadPriority: null,

    isTyping: false,
    isCompleting: false,

    lead: null,
    leadId: null,
    leadSaved: false,

    // وضعیت شبکه/API
    networkOnline: true,
    apiConfigured: false,
    lastApiError: null,
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
    _state.leadSaved = false;
    _state.lastApiError = null;
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

  function getAnswersArray() {
    // خروجی به فرمت موردنیاز Apps Script
    const ts = new Date().toISOString();
    return Object.entries(_state.answers).map(([question_id, answer_id]) => ({
      question_id,
      answer_id,
      timestamp: ts,
    }));
  }

  function hasAnswer(questionId) {
    return questionId in _state.answers;
  }

  // ---- PATH ----
  function pushPath(questionId) {
    if (_state.path[_state.path.length - 1] !== questionId) {
      _state.path.push(questionId);
    }
  }

  function popPath() {
    return _state.path.pop() || null;
  }

  function getPreviousQuestionId() {
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
  }

  function setLeadId(id) {
    _state.leadId = id;
  }

  function setLeadSaved(v) {
    _state.leadSaved = !!v;
  }

  function getLead() {
    return _state.lead;
  }

  function getLeadId() {
    return _state.leadId;
  }

  function isLeadSaved() {
    return _state.leadSaved;
  }

  // ---- UI FLAGS ----
  function setTyping(v) { _state.isTyping = !!v; }
  function isTyping() { return _state.isTyping; }

  function setCompleting(v) { _state.isCompleting = !!v; }
  function isCompleting() { return _state.isCompleting; }

  // ---- NETWORK / API ----
  function setNetworkOnline(v) {
    _state.networkOnline = !!v;
  }

  function isNetworkOnline() {
    return _state.networkOnline;
  }

  function setApiConfigured(v) {
    _state.apiConfigured = !!v;
  }

  function isApiConfigured() {
    return _state.apiConfigured;
  }

  function setLastApiError(err) {
    _state.lastApiError = err;
  }

  function getLastApiError() {
    return _state.lastApiError;
  }

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
    getAnswersArray,
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
    setLeadId,
    setLeadSaved,
    getLead,
    getLeadId,
    isLeadSaved,
    setTyping,
    isTyping,
    setCompleting,
    isCompleting,
    setNetworkOnline,
    isNetworkOnline,
    setApiConfigured,
    isApiConfigured,
    setLastApiError,
    getLastApiError,
    getSessionId,
    getQuizId,
    snapshot,
  };
})();

window.State = State;