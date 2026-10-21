/* ============================================================
   APP — Bootstrap و اتصال ماژول‌ها
   تنها جایی که fetch داده‌ها انجام می‌شود و EventBus به همه وصل می‌شود.
   ============================================================ */

(async function App() {
  // ---- DATA LOADING ----

  /**
   * بارگذاری JSON با پشتیبانی از fetch و fallback به script tag
   * (برای اجرا در حالت file://)
   */
  async function loadJSON(path, fallbackId) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      // fallback: در صورت وجود <script type="application/json" id="...">
      const el = fallbackId ? document.getElementById(fallbackId) : null;
      if (el && el.textContent.trim()) {
        try {
          return JSON.parse(el.textContent);
        } catch (e) {
          throw new Error(`JSON در "${fallbackId}" نامعتبر است`);
        }
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
          نکته: اگر فایل را مستقیماً با دابل‌کلیک باز کرده‌اید،
          با اجرای <code>python3 -m http.server 8000</code> در پوشه v0
          و باز کردن <code>http://localhost:8000/v0.html</code> دوباره تلاش کنید.
        </p>
      </div>
    `;
    return;
  }

  // ---- INIT MODULES ----

  // 1) State
  State.init({ quizId: config.quiz_id });

  // 2) ChatRenderer
  ChatRenderer.init({ config });

  // 3) QuizEngine
  QuizEngine.init({ questionsData, rulesData });

  // ---- START UI ----
  ChatRenderer.setFlowStep("intro");
  EventBus.emit("assistant_opened", {});

  // پیام خوش‌آمد
  await ChatRenderer.renderBotMessage(
    `سلام 👋<br/>من دستیار <strong>طراحی لوکس</strong> هستم.
     با چند سؤال کوتاه، سبک مناسب و قدم بعدی پروژه‌ات را پیدا می‌کنم.`,
    { withTyping: true }
  );

  // نمایش بلوک معرفی
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
    composer.querySelector(".intro-block")?.remove();
    introContainer.innerHTML = "";
    QuizEngine.start();
  });

  // ---- EVENT WIRING ----

  // پاسخ‌ها در analytics
  EventBus.on("answer_selected", (p) => Analytics.track("answer_selected", p));
  EventBus.on("question_viewed", (p) => Analytics.track("question_viewed", p));
  EventBus.on("quiz_started", () => Analytics.track("quiz_started", {}));
  EventBus.on("quiz_completed", () => Analytics.track("quiz_completed", {}));
  EventBus.on("back_clicked", (p) => Analytics.track("back_clicked", p));
  EventBus.on("assistant_opened", () => Analytics.track("assistant_opened", {}));
  EventBus.on("catalog_opened", (p) => Analytics.track("catalog_opened", p));
  EventBus.on("recommendation_clicked", (p) => Analytics.track("recommendation_clicked", p));
  EventBus.on("lead_form_opened", () => Analytics.track("lead_form_opened", {}));
  EventBus.on("lead_form_submitted", (p) => Analytics.track("lead_form_submitted", p));
  EventBus.on("lead_saved", (p) => Analytics.track("lead_saved", p));
  EventBus.on("contact_consent_given", () => Analytics.track("contact_consent_given", {}));

  // پاسخ به درخواست reset
  EventBus.on("reset_requested", () => {
    Analytics.reset();
    State.reset();
    document.getElementById("chat-stream").innerHTML = "";
    document.getElementById("options-area").innerHTML = "";
    QuizEngine.init({ questionsData, rulesData });
    ChatRenderer.setFlowStep("intro");
    // reload صفحه ساده‌ترین
    location.reload();
  });

  // ---- SCORING + RESULT ----

  EventBus.on("scoring_requested", async () => {
    ChatRenderer.showLoading("در حال محاسبه نتیجه...");

    // 1) کمی تأخیر برای طبیعی‌تر بودن
    await new Promise((r) => setTimeout(r, 900));

    const answers = State.getAllAnswers();

    // 2) محاسبه امتیازها
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

    // 3) ساخت نتیجه
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

    // 4) نمایش
    ChatRenderer.clearOptions();
    ChatRenderer.setFlowStep("result");

    await ChatRenderer.renderBotMessage(
      "عالی! نتیجه‌ات آماده است 👇",
      { withTyping: true }
    );

    ChatRenderer.renderResult({
      outcome: result.outcome,
      chartData: result.chartData,
      nextSteps: result.nextSteps,
      meta: result.meta,
    });

    EventBus.emit("result_viewed", {
      metadata: { result_id: result.outcome.id },
    });

    // 5) پیشنهاد فرم لید (اختیاری)
    setTimeout(() => {
      ChatRenderer.renderBotMessage(
        "اگر خواستی، می‌توانی برای بررسی دقیق‌تر پروژه‌ات با کارشناس ما در ارتباط باشی. " +
        "این کار اختیاری است و هر زمان خواستی می‌توانی درخواست بدهی.",
        { withTyping: true }
      ).then(() => {
        const composer = document.getElementById("composer");
        composer.hidden = false;
        ChatRenderer.renderLeadForm({
          onSubmit: (data, form) => {
            const v = LeadForm.handleSubmit(data, form);
            if (v.ok) {
              form.replaceWith(
                (() => {
                  const el = document.createElement("div");
                  el.className = "card";
                  el.style.marginTop = "12px";
                  el.innerHTML = `
                    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
                      <span class="badge badge--success">✓ ثبت شد (شبیه‌سازی)</span>
                    </div>
                    <p style="margin:8px 0 0;font-size:var(--fs-sm);color:var(--ink-secondary)">
                      نام: ${escapeHtml(data.name)}<br/>
                      تماس: ${escapeHtml(data.phone)}<br/>
                      رضایت تماس: ${data.contact_consent ? "ثبت شده" : "ثبت نشده"}
                    </p>
                    <p style="margin:8px 0 0;font-size:var(--fs-xs);color:var(--ink-muted)">
                      در نسخه نهایی، این درخواست در Google Sheets ثبت و به کارشناس اطلاع داده می‌شود.
                    </p>
                  `;
                  return el;
                })()
              );
              ChatRenderer.setFlowStep("done");
            } else {
              // خطاها نمایش داده شد — کاری لازم نیست
            }
          },
          onSkip: () => {
            ChatRenderer.clearOptions();
            ChatRenderer.renderBotMessage("باشد، هر زمان خواستی در دسترس هستیم 🌿", {
              withTyping: true,
            });
            ChatRenderer.setFlowStep("done");
          },
        });
      });
    }, 1200);
  });

  // ---- UTIL ----
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- DEBUG: نمایش رویدادها ----
  window.__v0Debug = {
    state: () => State.snapshot(),
    events: () => Analytics.getQueue(),
    sent: () => Analytics.getSentLog(),
    history: () => EventBus.getHistory(),
    scores: () => State.getScores(),
  };

  console.log(
    "%c✨ Luxury Design Assistant v0 آماده است",
    "background:linear-gradient(90deg,#c9a961,#a8874a);color:#fff;padding:6px 12px;border-radius:6px;font-weight:bold"
  );
  console.log("🔧 برای دیباگ: window.__v0Debug.state() | .events() | .history() | .scores()");
})();