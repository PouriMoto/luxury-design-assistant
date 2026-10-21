/* ============================================================
   APP — Bootstrap + wiring نهایی
   v2: api-client + analytics با IndexedDB + مدیریت network
   ============================================================ */

(async function App() {

  // ---- DATA LOADING ----

  async function loadJSON(path, fallbackId) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      const el = fallbackId ? document.getElementById(fallbackId) : null;
      if (el && el.textContent.trim()) {
        try { return JSON.parse(el.textContent); }
        catch (e) { throw new Error(`JSON در "${fallbackId}" نامعتبر است`); }
      }
      throw new Error(`بارگذاری ${path} ناموفق: ${err.message}`);
    }
  }

  // ---- BOOT ----
  let config, questionsData, rulesData, outcomesData;

  try {
    [config, questionsData, rulesData, outcomesData] = await Promise.all([
      loadJSON("data/config.json"),
      loadJSON("data/questions.json"),
      loadJSON("data/rules.json"),
      loadJSON("data/outcomes.json"),
    ]);
  } catch (err) {
    console.error("خطای راه‌اندازی:", err);
    document.body.innerHTML = `
      <div style="max-width:600px;margin:80px auto;padding:24px;text-align:center;font-family:Vazir,Tahoma,sans-serif;color:#2b2419">
        <h2>خطا در راه‌اندازی</h2>
        <p style="color:#6b5e48">${err.message}</p>
        <p style="font-size:13px;color:#9a8d75">
          اگر فایل را با دابل‌کلیک باز کرده‌اید،
          با <code>python3 -m http.server 8000</code> دوباره تلاش کنید.
        </p>
      </div>
    `;
    return;
  }

  // ---- INIT MODULES ----

  State.init({ quizId: config.quiz_id });
  ChatRenderer.init({ config });
  QuizEngine.init({ questionsData, rulesData });

  // API Client
  const apiConfigured = ApiClient.init(config);
  State.setApiConfigured(apiConfigured);

  // Analytics (async — IndexedDB)
  Analytics.init(config).catch((err) => {
    console.warn("[App] Analytics init warn:", err.message);
  });

  // شبکه
  State.setNetworkOnline(navigator.onLine);
  window.addEventListener("online", () => {
    State.setNetworkOnline(true);
    ChatRenderer.updateFooterStatus();
    Analytics.flush().catch(() => {});
  });
  window.addEventListener("offline", () => {
    State.setNetworkOnline(false);
    ChatRenderer.updateFooterStatus();
  });

  // flush هنگام unload
  window.addEventListener("beforeunload", () => {
    Analytics.flush().catch(() => {});
  });

  // ---- START UI ----
  ChatRenderer.setFlowStep("intro");
  EventBus.emit("assistant_opened", {});

  await ChatRenderer.renderBotMessage(
    `سلام 👋<br/>من دستیار <strong>طراحی لوکس</strong> هستم.
     با چند سؤال کوتاه، سبک مناسب و قدم بعدی پروژه‌ات را پیدا می‌کنم.`,
    { withTyping: true }
  );

  const introContainer = document.getElementById("options-area");
  const composer = document.getElementById("composer");
  composer.hidden = false;

  introContainer.innerHTML = `
    <div class="intro-block">
      <div class="intro-hero" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none"
             stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V8l7-5 7 5v13"/>
          <path d="M9 21v-6h6v6"/>
        </svg>
      </div>
      <h1 class="intro-title">دستیار طراحی لوکس</h1>
      <p class="intro-sub">
        در کمتر از یک دقیقه، سبک مناسب و قدم بعدی پروژه‌ات را بشناس.
      </p>
      <ul class="intro-points">
        <li>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>۶ سؤال کوتاه درباره پروژه و سلیقه‌ات</span>
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>نتیجه شخصی‌سازی‌شده با نمونه‌های واقعی</span>
        </li>
        <li>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>در صورت تمایل، دریافت مشاوره از کارشناس</span>
        </li>
      </ul>
      <button type="button" class="btn btn--accent btn-block intro-cta" id="btn-start">
        شروع کنیم
      </button>
    </div>
  `;

  document.getElementById("btn-start").addEventListener("click", () => {
    introContainer.innerHTML = "";
    QuizEngine.start();
  });

  // ---- EVENT WIRING → ANALYTICS ----
  // همه‌ی رویدادها به Analytics سپرده می‌شوند
  [
    "assistant_opened", "quiz_started", "question_viewed",
    "answer_selected", "back_clicked", "quiz_completed",
    "scoring_completed", "result_generated", "result_viewed",
    "catalog_opened", "recommendation_clicked",
    "lead_form_opened", "lead_form_submitted", "lead_saved",
    "contact_consent_given", "consultation_requested",
  ].forEach((name) => {
    EventBus.on(name, (payload) => {
      Analytics.track(name, payload || {}).catch(() => {});
    });
  });

  // ---- RESET ----
  EventBus.on("reset_requested", () => {
    Analytics.flush().catch(() => {});
    State.reset();
    document.getElementById("chat-stream").innerHTML = "";
    document.getElementById("options-area").innerHTML = "";
    QuizEngine.init({ questionsData, rulesData });
    ChatRenderer.setFlowStep("intro");
    location.reload();
  });

  // ---- SCORING + RESULT ----
  EventBus.on("scoring_requested", async () => {
    ChatRenderer.showLoading("در حال محاسبه نتیجه...");
    await new Promise((r) => setTimeout(r, 900));

    const answers = State.getAllAnswers();
    const scores = ScoringEngine.computeAll(
      answers,
      rulesData.score_rules,
      outcomesData.profiles,
      outcomesData.lead_priority_thresholds,
      outcomesData.tie_breaker
    );

    State.setScores({
      styleScores: scores.styleScores,
      leadPriority: scores.leadPriority,
    });

    EventBus.emit("scoring_completed", {
      metadata: {
        selected_profile_id: scores.selected_profile_id,
        lead_priority: scores.leadPriority,
      },
    });

    const result = ResultEngine.buildResult(scores, outcomesData);
    if (!result.ok) {
      ChatRenderer.clearOptions();
      ChatRenderer.renderError(result.error, {
        onRetry: () => EventBus.emit("reset_requested"),
      });
      return;
    }

    State.setOutcome(result.outcome);
    EventBus.emit("result_generated", {
      metadata: { result_id: result.outcome.id },
    });

    ChatRenderer.clearOptions();
    ChatRenderer.setFlowStep("result");

    await ChatRenderer.renderBotMessage("عالی! نتیجه‌ات آماده است 👇", {
      withTyping: true,
    });

    ChatRenderer.renderResult({
      outcome: result.outcome,
      chartData: result.chartData,
      nextSteps: result.nextSteps,
      meta: result.meta,
    });

    EventBus.emit("result_viewed", {
      metadata: { result_id: result.outcome.id },
    });

    // پیشنهاد لید
    setTimeout(() => {
      ChatRenderer.renderBotMessage(
        "اگر خواستی، می‌توانی برای بررسی دقیق‌تر پروژه‌ات با کارشناس ما در ارتباط باشی. " +
        "این کار اختیاری است و هر زمان خواستی می‌توانی درخواست بدهی.",
        { withTyping: true }
      ).then(() => {
        ChatRenderer.setFlowStep("lead");
        showLeadForm();
      });
    }, 1200);
  });

  // ---- LEAD FORM REQUEST ----
  EventBus.on("lead_form_requested", () => {
    EventBus.emit("lead_form_opened", {});
    showLeadForm();
  });

  function showLeadForm() {
    const composer = document.getElementById("composer");
    composer.hidden = false;
    ChatRenderer.renderLeadForm({
      onSubmit: (data, form) => {
        LeadForm.handleSubmit(data, form);
      },
      onSkip: () => {
        ChatRenderer.clearOptions();
        ChatRenderer.renderBotMessage("باشد، هر زمان خواستی در دسترس هستیم 🌿", {
          withTyping: true,
        });
        ChatRenderer.setFlowStep("done");
      },
    });
  }

  // ---- DEBUG ----
  window.__lda = {
    state: () => State.snapshot(),
    events: () => Analytics.getQueue(),
    flush: () => Analytics.flush(),
    count: () => Analytics.getCount(),
    clearQueue: () => Analytics.clearQueue(),
    scores: () => State.getScores(),
    history: () => EventBus.getHistory(),
    apiHealth: () => ApiClient.healthCheck(),
  };

  console.log(
    "%c✨ Luxury Design Assistant آماده است",
    "background:linear-gradient(90deg,#c9a961,#a8874a);color:#fff;padding:6px 12px;border-radius:6px;font-weight:bold"
  );
  console.log("🔧 API configured:", apiConfigured);
  console.log("🔧 برای دیباگ: window.__lda.state() | .events() | .flush() | .apiHealth()");
})();