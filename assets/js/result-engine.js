/* ============================================================
   RESULT ENGINE — ساخت نتیجه نهایی از امتیازها
   ورودی: scores + outcomes.json → خروجی: outcome کامل + chartData
   هیچ DOM، هیچ شبکه. منطق خالص.
   ============================================================ */

const ResultEngine = (() => {
  /**
   * پیدا کردن outcome متناظر با selected_profile_id.
   */
  function pickOutcome(selectedId, outcomesData) {
    if (!outcomesData || !Array.isArray(outcomesData.profiles)) {
      return null;
    }
    return (
      outcomesData.profiles.find((p) => p.id === selectedId) || null
    );
  }

  /**
   * ساخت داده نمودار از styleScores.
   * خروجی مرتب‌شده (نزولی) با label و درصد نسبت به max.
   *   [{ id, label, value, percent, is_top }, ...]
   */
  function buildChartData(styleScores, outcomesData) {
    if (!styleScores || !outcomesData || !Array.isArray(outcomesData.profiles)) {
      return [];
    }

    const labelById = {};
    for (const p of outcomesData.profiles) {
      labelById[p.id] = p.chart_label || p.title || p.id;
    }

    const entries = Object.entries(styleScores);
    if (entries.length === 0) return [];

    const max = Math.max(...entries.map(([, v]) => v)) || 1;

    return entries
      .map(([id, value]) => ({
        id,
        label: labelById[id] || id,
        value,
        percent: Math.round((value / max) * 100),
      }))
      .sort((a, b) => b.value - a.value)
      .map((row, i) => ({ ...row, is_top: i === 0 && row.value > 0 }));
  }

  /**
   * انتخاب "قدم بعدی" بر اساس وضعیت پروژه.
   * منطق ساده: اگر آماده یا نزدیک، مشاوره؛ اگر در حال بررسی، کاتالوگ.
   */
  function pickNextSteps(outcome, answers) {
    if (!outcome || !Array.isArray(outcome.next_steps)) return [];

    const timeline = answers.project_timeline;
    const stage = answers.project_stage;

    const readyNow =
      timeline === "ready_now" ||
      timeline === "one_to_three" ||
      stage === "ready_for_order";

    // اگر آماده است، مشاوره را برجسته کن
    if (readyNow) {
      // ترتیب: consult → catalog → guide
      const order = { next_consult: 0, next_catalog: 1, next_guide: 2 };
      return [...outcome.next_steps].sort(
        (a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9)
      );
    }

    // پیش‌فرض: کاتالوگ → راهنما → مشاوره
    const order = { next_catalog: 0, next_guide: 1, next_consult: 2 };
    return [...outcome.next_steps].sort(
      (a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9)
    );
  }

  /**
   * ساخت نتیجه‌ی نهایی برای نمایش.
   * ورودی: scores از ScoringEngine.computeAll + outcomesData
   * خروجی: شیء آماده برای ChatRenderer.renderResult
   */
  function buildResult(scores, outcomesData) {
    if (!scores || !outcomesData) {
      return { ok: false, error: "scores یا outcomesData موجود نیست" };
    }

    const outcome = pickOutcome(scores.selected_profile_id, outcomesData);
    if (!outcome) {
      return {
        ok: false,
        error: `پروفایل با شناسه "${scores.selected_profile_id}" پیدا نشد`,
      };
    }

    const chartData = buildChartData(scores.styleScores, outcomesData);
    const nextSteps = pickNextSteps(outcome, State.getAllAnswers());

    return {
      ok: true,
      outcome,
      chartData,
      nextSteps,
      leadPriority: scores.leadPriority,
      tieBroken: scores.tie_broken,
      tieReason: scores.tie_reason,
      meta: {
        selected_profile_id: scores.selected_profile_id,
        leadScore: scores.leadScore,
        thresholds: scores.thresholds,
        matched_rules: scores.matched_rules,
      },
    };
  }

  return {
    pickOutcome,
    buildChartData,
    pickNextSteps,
    buildResult,
  };
})();

window.ResultEngine = ResultEngine;