/* ============================================================
   CHAT RENDERER — تنها ماژول DOM
   v2: افزودن نمایش وضعیت API + موفقیت/خطای لید واقعی
   ============================================================ */

const ChatRenderer = (() => {
  let _container = null;
  let _composer = null;
  let _optionsArea = null;
  let _progressWrap = null;
  let _progressFill = null;
  let _progressLabel = null;
  let _flowSteps = null;
  let _btnBack = null;
  let _btnReset = null;
  let _hint = null;
  let _scrollArea = null;
  let _footerStatus = null;

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function faNum(n) {
    return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
  }

  function scrollToBottom() {
    if (_scrollArea) {
      requestAnimationFrame(() => {
        _scrollArea.scrollTop = _scrollArea.scrollHeight;
      });
    }
  }

  // ---- INIT ----
  function init({ config }) {
    _container = document.getElementById("chat-stream");
    _composer = document.getElementById("composer");
    _optionsArea = document.getElementById("options-area");
    _progressWrap = document.getElementById("progress-wrap");
    _progressFill = document.getElementById("progress-fill");
    _progressLabel = document.getElementById("progress-label");
    _flowSteps = document.getElementById("flow-steps");
    _btnBack = document.getElementById("btn-back");
    _btnReset = document.getElementById("btn-reset");
    _hint = document.getElementById("composer-hint");
    _scrollArea = document.getElementById("chat-scroll");
    _footerStatus = document.getElementById("footer-status");

    if (_btnReset) {
      _btnReset.addEventListener("click", () => {
        EventBus.emit("reset_requested");
      });
    }

    if (_btnBack) {
      _btnBack.addEventListener("click", () => {
        if (_btnBack.disabled) return;
        EventBus.emit("back_clicked", {
          question_id: State.getCurrentQuestionId(),
        });
      });
    }

    ChatRenderer._config = config;
    updateFooterStatus();
  }

  function updateFooterStatus() {
    if (!_footerStatus) return;
    const online = navigator.onLine;
    const apiOk = State.isApiConfigured();
    let text = "دستیار طراحی لوکس";
    if (!online) {
      text += " · آفلاین";
    } else if (!apiOk) {
      text += " · حالت پیش‌نمایش (ارسال واقعی تنظیم نشده)";
    } else {
      text += " · متصل";
    }
    _footerStatus.textContent = text;
  }

  // ---- BOT MESSAGE ----
  function renderBotMessage(text, { withTyping = false } = {}) {
    if (withTyping) return renderTyping(text);
    return appendBubble(text, "bot");
  }

  function appendBubble(text, who) {
    const el = document.createElement("div");
    el.className = `msg msg--${who}`;
    const bubble = document.createElement("div");
    bubble.className = `bubble bubble--${who}`;
    if (who === "bot") {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }
    el.appendChild(bubble);
    _container.appendChild(el);
    scrollToBottom();
    return el;
  }

  // ---- TYPING ----
  async function renderTyping(finalText) {
    const el = document.createElement("div");
    el.className = "msg msg--bot";
    el.innerHTML = `
      <div class="bubble bubble--bot typing" role="status" aria-label="دستیار در حال فکر کردن">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    _container.appendChild(el);
    scrollToBottom();

    const cfg = ChatRenderer._config?.typing || {};
    const min = cfg.min_ms || 1000;
    const max = cfg.max_ms || 1800;
    const wait = min + Math.random() * (max - min);

    await delay(wait);

    el.innerHTML = "";
    const bubble = document.createElement("div");
    bubble.className = "bubble bubble--bot";
    bubble.innerHTML = finalText;
    el.appendChild(bubble);
    scrollToBottom();
    return el;
  }

  function renderUserBubble(label) {
    return appendBubble(label, "user");
  }

  // ---- QUESTION ----
  function renderQuestion(question, { onSelect, onBack }) {
    clearOptions();

    const el = document.createElement("div");
    el.className = "msg msg--bot";
    const bubble = document.createElement("div");
    bubble.className = "bubble bubble--bot";
    bubble.innerHTML = `
      <div class="question-title">${escapeHtml(question.title)}</div>
      ${question.description ? `<p class="question-desc">${escapeHtml(question.description)}</p>` : ""}
    `;
    el.appendChild(bubble);
    _container.appendChild(el);
    scrollToBottom();

    const isImageVariant = question.variant === "image_cards";
    if (isImageVariant) {
      renderImageCards(question, onSelect);
    } else {
      renderOptionButtons(question, onSelect);
    }

    setupBackButton(onBack);
    _composer.hidden = false;

    EventBus.emit("question_viewed", { question_id: question.id });
  }

  function renderOptionButtons(question, onSelect) {
    _optionsArea.innerHTML = "";
    question.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.dataset.optionId = opt.id;
      btn.innerHTML = `
        <span class="option-btn__label">${escapeHtml(opt.label)}</span>
        <span class="option-btn__arrow" aria-hidden="true">←</span>
      `;
      btn.addEventListener("click", () => {
        disableOptions();
        onSelect(opt.id);
      });
      _optionsArea.appendChild(btn);
    });
  }

  function renderImageCards(question, onSelect) {
    _optionsArea.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "image-cards";

    question.options.forEach((opt) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "image-card";
      card.dataset.optionId = opt.id;
      card.setAttribute("aria-label", opt.label);

      const imgPath = opt.image || "";
      const label = escapeHtml(opt.label);

      card.innerHTML = `
        <div class="image-card__media">
          <img src="${imgPath}" alt="${label}" loading="lazy" />
        </div>
        <div class="image-card__label">${label}</div>
      `;

      const img = card.querySelector("img");
      img.addEventListener("error", () => {
        img.style.display = "none";
        const ph = document.createElement("div");
        ph.className = "image-card__placeholder";
        ph.innerHTML = `
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none"
               stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
          <span class="image-card__placeholder-title">${label}</span>
          <span>تصویر سبک (راهنما در پوشه images)</span>
        `;
        card.querySelector(".image-card__media").appendChild(ph);
      }, { once: true });

      card.addEventListener("click", () => {
        disableOptions();
        onSelect(opt.id);
      });

      grid.appendChild(card);
    });

    _optionsArea.appendChild(grid);
  }

  function disableOptions() {
    const btns = _optionsArea.querySelectorAll("button");
    btns.forEach((b) => (b.disabled = true));
  }

  function clearOptions() {
    if (_optionsArea) _optionsArea.innerHTML = "";
  }

  function setupBackButton(onBack) {
    if (!_btnBack) return;
    if (onBack && State.getPreviousQuestionId()) {
      _btnBack.hidden = false;
      _btnBack.disabled = false;
      _btnBack.onclick = () => {
        _btnBack.disabled = true;
        onBack();
      };
    } else {
      _btnBack.hidden = true;
    }
  }

  function setBackEnabled(v) {
    if (_btnBack) _btnBack.disabled = !v;
  }

  // ---- PROGRESS ----
  function renderProgress({ answered, total }) {
    _progressWrap.hidden = false;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    _progressFill.style.width = pct + "%";
    _progressLabel.textContent = faNum(pct) + "٪";
  }

  // ---- FLOW MAP ----
  function setFlowStep(stepName) {
    if (!_flowSteps) return;
    const all = _flowSteps.querySelectorAll("li");
    let reached = false;
    all.forEach((li) => {
      const name = li.dataset.step;
      li.classList.remove("is-active", "is-done");
      if (name === stepName) {
        li.classList.add("is-active");
        reached = true;
      } else if (!reached) {
        li.classList.add("is-done");
      }
    });
  }

  function setHint(text) {
    if (_hint) _hint.textContent = text || "";
  }

  // ---- LOADING ----
  function showLoading(text = "در حال پردازش...") {
    clearOptions();
    _optionsArea.innerHTML = `
      <div class="card" style="display:flex;align-items:center;gap:12px;justify-content:center">
        <span class="spinner"></span>
        <span style="color:var(--ink-secondary);font-size:var(--fs-sm)">${escapeHtml(text)}</span>
      </div>
    `;
    _composer.hidden = false;
  }

  // ---- ERROR ----
  function renderError(message, { onRetry } = {}) {
    const el = document.createElement("div");
    el.className = "msg msg--bot";
    const box = document.createElement("div");
    box.className = "error-bubble";
    box.innerHTML = `
      <div class="error-bubble__msg">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
    if (onRetry) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "error-retry";
      retry.textContent = "تلاش مجدد";
      retry.addEventListener("click", () => {
        box.remove();
        onRetry();
      });
      box.appendChild(retry);
    }
    el.appendChild(box);
    _container.appendChild(el);
    scrollToBottom();
  }

  // ---- LEAD FORM ----
  function renderLeadForm({ onSubmit, onSkip }) {
    clearOptions();
    _composer.hidden = false;

    const form = document.createElement("form");
    form.className = "lead-form";
    form.noValidate = true;

    form.innerHTML = `
      <div class="form-field">
        <label for="lead-name">نام <span class="req">*</span></label>
        <input id="lead-name" name="name" type="text" autocomplete="name" required />
        <div class="form-field__error" data-error="name"></div>
      </div>
      <div class="form-field">
        <label for="lead-phone">شماره تماس <span class="req">*</span></label>
        <input id="lead-phone" name="phone" type="tel" inputmode="numeric"
               autocomplete="tel" placeholder="09xxxxxxxxx" maxlength="11" required />
        <div class="form-field__error" data-error="phone"></div>
      </div>
      <div class="consent-row">
        <input id="lead-consent" name="contact_consent" type="checkbox" />
        <label for="lead-consent">
          با ثبت این درخواست، موافقم کارشناس مجموعه برای پیگیری همین درخواست با من تماس بگیرد.
        </label>
      </div>
      <button type="submit" class="btn btn--accent btn-block" data-action="submit">
        ثبت درخواست
      </button>
      ${onSkip ? '<button type="button" class="btn-ghost btn-block" data-action="skip">فعلاً نه، ممنون</button>' : ""}
    `;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        name: (fd.get("name") || "").toString().trim(),
        phone: (fd.get("phone") || "").toString().trim(),
        contact_consent: fd.get("contact_consent") === "on",
      };
      onSubmit(data, form);
    });

    const skipBtn = form.querySelector('[data-action="skip"]');
    if (skipBtn && onSkip) {
      skipBtn.addEventListener("click", onSkip);
    }

    _optionsArea.appendChild(form);
    scrollToBottom();
  }

  function setFieldError(form, fieldName, message) {
    const input = form.querySelector(`[name="${fieldName}"]`);
    const errorEl = form.querySelector(`[data-error="${fieldName}"]`);
    if (input) input.classList.toggle("is-invalid", !!message);
    if (errorEl) errorEl.textContent = message || "";
  }

  /**
   * نمایش حالت در حال ارسال داخل فرم
   */
  function setFormLoading(form, loading) {
    const submitBtn = form.querySelector('[data-action="submit"]');
    const skipBtn = form.querySelector('[data-action="skip"]');
    const inputs = form.querySelectorAll("input");
    if (submitBtn) {
      submitBtn.disabled = loading;
      submitBtn.innerHTML = loading
        ? '<span class="spinner"></span> در حال ارسال...'
        : "ثبت درخواست";
    }
    if (skipBtn) skipBtn.disabled = loading;
    inputs.forEach((i) => (i.disabled = loading));
  }

  /**
   * نمایش خطای API در فرم
   */
  function setFormApiError(form, message) {
    let box = form.querySelector(".form-api-error");
    if (!box) {
      box = document.createElement("div");
      box.className = "form-api-error error-bubble";
      box.style.marginTop = "4px";
      form.insertBefore(box, form.querySelector('[data-action="submit"]'));
    }
    box.innerHTML = `
      <div class="error-bubble__msg">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  function clearFormApiError(form) {
    const box = form.querySelector(".form-api-error");
    if (box) box.remove();
  }

  /**
   * کارت موفقیت لید (پس از ثبت واقعی)
   */
  function renderLeadSuccess(container, data, { leadId, simulated }) {
    const el = document.createElement("div");
    el.className = "card";
    el.style.marginTop = "12px";
    const badge = simulated
      ? '<span class="badge badge--muted">✓ ثبت شد (پیش‌نمایش)</span>'
      : '<span class="badge badge--success">✓ ثبت شد</span>';
    el.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
        ${badge}
      </div>
      <p style="margin:8px 0 0;font-size:var(--fs-sm);color:var(--ink-secondary)">
        نام: ${escapeHtml(data.name)}<br/>
        تماس: ${escapeHtml(data.phone)}<br/>
        رضایت تماس: ${data.contact_consent ? "ثبت شده" : "ثبت نشده"}
        ${leadId ? `<br/>شناسه: <code>${escapeHtml(leadId)}</code>` : ""}
      </p>
      <p style="margin:8px 0 0;font-size:var(--fs-xs);color:var(--ink-muted)">
        ${simulated
          ? "پس از راه‌اندازی Apps Script در مرحله بعد، این درخواست به Google Sheets ارسال و به کارشناس اطلاع داده می‌شود."
          : "درخواست شما ثبت شد. کارشناس مجموعه به‌زودی برای پیگیری با شما تماس می‌گیرد."}
      </p>
    `;
    container.replaceWith(el);
    scrollToBottom();
  }

  // ---- RESULT ----
  function renderResult({ outcome, chartData, nextSteps, meta }) {
    clearOptions();
    _composer.hidden = false;

    const wrap = document.createElement("div");
    wrap.className = "result-block";

    const hero = document.createElement("div");
    hero.className = "result-hero";
    hero.innerHTML = `
      <span class="result-badge">نتیجه شخصی‌سازی‌شده</span>
      <h2 class="result-title">${escapeHtml(outcome.title)}</h2>
      <p class="result-summary">${escapeHtml(outcome.summary)}</p>
    `;
    wrap.appendChild(hero);

    const imgWrap = document.createElement("div");
    imgWrap.className = "result-image-wrap";
    imgWrap.innerHTML = `<img src="${outcome.image || ""}" alt="${escapeHtml(outcome.chart_label || "")}" loading="lazy" />`;
    const img = imgWrap.querySelector("img");
    img.addEventListener("error", () => {
      img.remove();
      const ph = document.createElement("div");
      ph.className = "result-image-placeholder";
      ph.innerHTML = `
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none"
             stroke="currentColor" stroke-width="1.4"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="9" cy="9" r="2"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
        <span class="result-image-placeholder-title">${escapeHtml(outcome.chart_label || "")}</span>
        <span class="result-image-placeholder-hint">تصویر نمونه این سبک (راهنمای تصاویر در assets/images/results)</span>
      `;
      imgWrap.appendChild(ph);
    }, { once: true });
    wrap.appendChild(imgWrap);

    if (chartData && chartData.length > 0) {
      const chart = document.createElement("div");
      chart.className = "chart-block";
      chart.innerHTML = `<h3 class="chart-title">توزیع ترجیحات طراحی شما</h3>`;
      const rows = document.createElement("div");
      rows.className = "chart-rows";
      chartData.forEach((row) => {
        const r = document.createElement("div");
        r.className = "chart-row" + (row.is_top ? " is-top" : "");
        r.innerHTML = `
          <div class="chart-row__label">${escapeHtml(row.label)}</div>
          <div class="chart-row__bar"><div class="chart-row__fill" data-percent="${row.percent}"></div></div>
          <div class="chart-row__value">${faNum(row.value)}</div>
        `;
        rows.appendChild(r);
      });
      chart.appendChild(rows);
      wrap.appendChild(chart);

      requestAnimationFrame(() => {
        chart.querySelectorAll(".chart-row__fill").forEach((el) => {
          el.style.width = el.dataset.percent + "%";
        });
      });
    }

    if (Array.isArray(outcome.recommendations) && outcome.recommendations.length) {
      const recs = document.createElement("div");
      recs.innerHTML = `<h3 class="recs-title">پیشنهادهای مرتبط با سلیقه شما</h3>`;
      const list = document.createElement("div");
      list.className = "recs-list";
      outcome.recommendations.slice(0, 3).forEach((rec, i) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "rec-item";
        item.innerHTML = `
          <span class="rec-item__num">${faNum(i + 1)}</span>
          <span class="rec-item__text">${escapeHtml(rec.title)}</span>
          <span class="rec-item__arrow" aria-hidden="true">←</span>
        `;
        item.addEventListener("click", () => {
          EventBus.emit("recommendation_clicked", {
            metadata: { recommendation_id: rec.id, result_id: outcome.id },
          });
        });
        list.appendChild(item);
      });
      recs.appendChild(list);
      wrap.appendChild(recs);
    }

    if (Array.isArray(nextSteps) && nextSteps.length) {
      const next = document.createElement("div");
      next.innerHTML = `<h3 class="next-title">قدم بعدی</h3>`;
      const actions = document.createElement("div");
      actions.className = "next-actions";
      nextSteps.forEach((step) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn--primary btn-block";
        btn.textContent = step.label;
        btn.addEventListener("click", () => {
          if (step.id === "next_catalog") {
            EventBus.emit("catalog_opened", {
              metadata: { catalog_id: outcome.catalog_id },
            });
            appendBubble(
              `<strong>کاتالوگ ${escapeHtml(outcome.chart_label || "")}</strong><br/>به‌زودی لینک کاتالوگ اینجا باز می‌شود.`,
              "bot"
            );
          } else if (step.id === "next_consult") {
            EventBus.emit("lead_form_requested", { source: "result_consult" });
          } else {
            appendBubble(
              `این گزینه در نسخه نهایی به محتوای «${escapeHtml(step.label)}» متصل می‌شود.`,
              "bot"
            );
          }
        });
        actions.appendChild(btn);
      });
      next.appendChild(actions);
      wrap.appendChild(next);
    }

    wrap.appendChild(buildDebugPanel(meta));

    _container.appendChild(wrap);
    scrollToBottom();
  }

  // ---- DEBUG PANEL ----
  function buildDebugPanel(meta) {
    const det = document.createElement("details");
    det.className = "debug-panel";

    const scores = State.getScores();
    const answers = State.getAllAnswers();
    const path = State.getPath();

    const styleStr = scores.styleScores
      ? Object.entries(scores.styleScores).map(([k, v]) => `${k}=${v}`).join(", ")
      : "—";

    const answerStr = Object.entries(answers).map(([k, v]) => `${k}=${v}`).join("\n");

    det.innerHTML = `
      <summary>جزئیات محاسبه</summary>
      <div class="debug-content">
<strong>Style Scores:</strong> ${styleStr}
<strong>Selected Profile:</strong> ${meta.selected_profile_id}
<strong>Tie Broken:</strong> ${meta.tieBroken ? "yes (" + meta.tieReason + ")" : "no"}
<strong>Lead Score:</strong> ${meta.leadScore} (high≥${meta.thresholds.high}, medium≥${meta.thresholds.medium})
<strong>Lead Priority:</strong> ${State.getScores().leadPriority || "—"}
<strong>Matched Rules:</strong> ${meta.matched_rules.join(", ") || "—"}

<strong>Answers:</strong>
${answerStr || "—"}

<strong>Path:</strong>
${path.join(" → ")}

<strong>API Configured:</strong> ${State.isApiConfigured() ? "yes" : "no"}
<strong>Network:</strong> ${navigator.onLine ? "online" : "offline"}
      </div>
    `;

    // به‌روزرسانی تعداد رویدادها به‌صورت async
    (async () => {
      try {
        const count = await Analytics.getCount();
        const content = det.querySelector(".debug-content");
        if (content) {
          content.innerHTML += `\n<strong>Analytics Queue:</strong> ${count} events`;
        }
      } catch (e) {}
    })();

    return det;
  }

  // ---- HELPERS ----
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    init,
    renderBotMessage,
    renderUserBubble,
    renderQuestion,
    renderProgress,
    setFlowStep,
    setHint,
    showLoading,
    renderError,
    renderLeadForm,
    setFieldError,
    setFormLoading,
    setFormApiError,
    clearFormApiError,
    renderLeadSuccess,
    renderResult,
    setBackEnabled,
    clearOptions,
    scrollToBottom,
    updateFooterStatus,
    _config: null,
  };
})();

window.ChatRenderer = ChatRenderer;