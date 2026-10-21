/* ============================================================
   QUIZ ENGINE — اجرای جریان آزمون
   v2: resolveNext با محافظ بیشتر + گزارش دقیق حلقه
   ============================================================ */

const QuizEngine = (() => {
  let _questionsById = {};
  let _pathRules = [];
  let _startQuestionId = null;
  let _guardSet = new Set();
  let _inFlight = false;

  function init({ questionsData, rulesData }) {
    _questionsById = {};
    for (const q of questionsData.questions) {
      _questionsById[q.id] = q;
    }
    _pathRules = rulesData.path_rules || [];
    _startQuestionId = questionsData.start_question_id;
  }

  function getQuestion(id) {
    return _questionsById[id] || null;
  }

  function getAllQuestionIds() {
    return Object.keys(_questionsById);
  }

  function start() {
    EventBus.emit("quiz_started", {});
    ChatRenderer.setFlowStep("quiz");
    goTo(_startQuestionId, { reset: true });
  }

  function goTo(questionId, { reset = false } = {}) {
    if (questionId === "result") {
      completeQuiz();
      return;
    }

    const q = getQuestion(questionId);
    if (!q) {
      ChatRenderer.renderError(
        `سؤال با شناسه "${questionId}" پیدا نشد. لطفاً آزمون را از ابتدا شروع کنید.`,
        { onRetry: () => EventBus.emit("reset_requested") }
      );
      return;
    }

    if (reset) {
      _guardSet.clear();
    }

    if (_guardSet.has(questionId)) {
      console.error(
        "[QuizEngine] حلقه شناسایی شد:",
        "سؤال", questionId,
        "دوباره در مسیر ظاهر شد.",
        "path =", State.getPath()
      );
      ChatRenderer.renderError(
        "مسیر آزمون دچار حلقه شده است. لطفاً از ابتدا شروع کنید.",
        { onRetry: () => EventBus.emit("reset_requested") }
      );
      return;
    }
    _guardSet.add(questionId);

    State.setCurrentQuestion(questionId);
    State.pushPath(questionId);

    ChatRenderer.renderQuestion(q, {
      onSelect: (answerId) => handleAnswer(questionId, answerId),
      onBack: () => goBack(),
    });

    const answered = Object.keys(State.getAllAnswers()).length;
    const totalEstimate = 6;
    ChatRenderer.renderProgress({
      answered: Math.min(answered, totalEstimate),
      total: totalEstimate,
    });
  }

  async function handleAnswer(questionId, answerId) {
    if (_inFlight) return;
    _inFlight = true;

    const q = getQuestion(questionId);
    if (!q) { _inFlight = false; return; }

    const opt = q.options.find((o) => o.id === answerId);
    if (!opt) {
      _inFlight = false;
      ChatRenderer.renderError(
        `پاسخ "${answerId}" برای سؤال "${questionId}" معتبر نیست.`,
        { onRetry: () => goTo(questionId) }
      );
      return;
    }

    ChatRenderer.renderUserBubble(opt.label);
    State.setAnswer(questionId, answerId);
    EventBus.emit("answer_selected", {
      question_id: questionId,
      answer_id: answerId,
    });

    ChatRenderer.setBackEnabled(false);
    await new Promise((r) => setTimeout(r, 250));

    const nextId = resolveNext(questionId, opt);
    _inFlight = false;

    goTo(nextId);
  }

  /**
   * resolveNext — ترتیب:
   *   1) path rule با apply_on برابر سؤال جاری (if any)
   *   2) next گزینه‌ی انتخاب‌شده (questions.json)
   *   3) fallback = "result"
   */
  function resolveNext(questionId, selectedOption) {
    const answers = State.getAllAnswers();

    const override = RuleEngine.resolvePath(_pathRules, answers, questionId);
    if (override && override.next && override.next !== questionId) {
      return override.next;
    }

    if (selectedOption && selectedOption.next) {
      return selectedOption.next;
    }

    return "result";
  }

  function goBack() {
    const prevId = State.getPreviousQuestionId();
    if (!prevId) return;

    EventBus.emit("back_clicked", { question_id: State.getCurrentQuestionId() });
    State.popPath();

    // پاک‌کردن guard برای اجازه‌ی عبور مجدد
    _guardSet.delete(State.getCurrentQuestionId());

    goTo(prevId);
  }

  function completeQuiz() {
    State.setCompleting(true);
    ChatRenderer.clearOptions();
    ChatRenderer.setBackEnabled(false);
    ChatRenderer.setFlowStep("result");
    EventBus.emit("quiz_completed", {});
    EventBus.emit("scoring_requested");
  }

  return {
    init,
    start,
    goTo,
    resolveNext,
    getQuestion,
    getAllQuestionIds,
  };
})();

window.QuizEngine = QuizEngine;