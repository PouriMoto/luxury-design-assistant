/* ============================================================
   QUIZ ENGINE — اجرای جریان آزمون
   از questions.json + rules.json استفاده می‌کند.
   هیچ تصمیم UI یا شبکه. فقط جریان.
   ============================================================ */

const QuizEngine = (() => {
  let _questionsById = {};
  let _pathRules = [];
  let _startQuestionId = null;
  let _guardSet = new Set(); // جلوگیری از حلقه
  let _inFlight = false;     // جلوگیری از کلیک دوباره در حین typing

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

  // ---- FLOW ----

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

    // جلوگیری از حلقه
    if (_guardSet.has(questionId)) {
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

    // progress: answered / total-path-possible
    const answered = Object.keys(State.getAllAnswers()).length;
    const totalEstimate = 6; // برآورد برای progress bar
    ChatRenderer.renderProgress({
      answered: Math.min(answered, totalEstimate),
      total: totalEstimate,
    });
  }

  async function handleAnswer(questionId, answerId) {
    if (_inFlight) return;
    _inFlight = true;

    const q = getQuestion(questionId);
    if (!q) {
      _inFlight = false;
      return;
    }

    const opt = q.options.find((o) => o.id === answerId);
    if (!opt) {
      _inFlight = false;
      ChatRenderer.renderError(
        `پاسخ "${answerId}" برای سؤال "${questionId}" معتبر نیست.`,
        { onRetry: () => goTo(questionId) }
      );
      return;
    }

    // 1) حباب کاربر فوراً
    ChatRenderer.renderUserBubble(opt.label);

    // 2) ذخیره پاسخ
    State.setAnswer(questionId, answerId);
    EventBus.emit("answer_selected", {
      question_id: questionId,
      answer_id: answerId,
    });

    // 3) گزینه‌ها غیرفعال
    ChatRenderer.setBackEnabled(false);

    // 4) نمایش typing روی سؤال بعدی (در goTo یا completeQuiz)
    //    قبلش یک تأخیر کوتاه برای طبیعی‌تر بودن
    await new Promise((r) => setTimeout(r, 250));

    // 5) تعیین سؤال بعدی
    const nextId = resolveNext(questionId, opt);
    _inFlight = false;

    // 6) رفتن به بعدی
    goTo(nextId);
  }

  function resolveNext(questionId, selectedOption) {
    // 1) بررسی path rules ابتدا
    const answers = State.getAllAnswers();
    const override = RuleEngine.resolvePath(_pathRules, answers, questionId);
    if (override && override.next) {
      return override.next;
    }
    // 2) اگر گزینه next دارد
    if (selectedOption && selectedOption.next) {
      return selectedOption.next;
    }
    // 3) fallback: نتیجه
    return "result";
  }

  function goBack() {
    const prevId = State.getPreviousQuestionId();
    if (!prevId) return;

    EventBus.emit("back_clicked", { question_id: State.getCurrentQuestionId() });

    // پاک‌کردن سؤال جاری از path (پاسخ حفظ می‌شود)
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