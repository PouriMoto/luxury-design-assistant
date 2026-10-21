/* ============================================================
   SCORING ENGINE — محاسبه دو نوع امتیاز جدا:
   A) Style Score (انتخاب پروفایل طراحی)
   B) Lead Priority (اولویت پیگیری فروش)
   این دو هرگز با هم مخلوط نمی‌شوند.
   ============================================================ */

const ScoringEngine = (() => {
  /**
   * محاسبه امتیاز سبک از روی پاسخ‌ها + قواعد.
   * ورودی:
   *   answers: { [questionId]: answerId }
   *   scoreRules: آرایه‌ای از قواعد امتیازدهی
   *   profiles: آرایه‌ای از پروفایل‌ها از outcomes.json
   * خروجی:
   *   { styleScores, contentTags, matched_rules, top_profile_id }
   */
  function computeStyleScores(answers, scoreRules, profiles) {
    const effects = RuleEngine.collectScoreEffects(scoreRules, answers);

    // اطمینان از این‌که همه‌ی پروفایل‌ها کلید دارند (حتی با ۰)
    const styleScores = {};
    for (const p of profiles) {
      styleScores[p.id] = effects.styleScores[p.id] || 0;
    }

    // پیدا کردن بالاترین (برای گزارش)
    let topProfile = null;
    let topScore = -Infinity;
    for (const [id, score] of Object.entries(styleScores)) {
      if (score > topScore) {
        topScore = score;
        topProfile = id;
      }
    }

    return {
      styleScores,
      contentTags: effects.contentTags,
      matched_rules: effects.matched_rules,
      top_profile_id: topProfile,
    };
  }

  /**
   * محاسبه Lead Priority (high / medium / low) از روی قواعد.
   * آستانه‌ها از outcomes.json می‌آید.
   * ورودی:
   *   answers
   *   scoreRules
   *   thresholds: { high, medium }
   */
  function computeLeadPriority(answers, scoreRules, thresholds) {
    const effects = RuleEngine.collectScoreEffects(scoreRules, answers);
    const score = effects.leadScore;

    const highT = (thresholds && thresholds.high) || 6;
    const mediumT = (thresholds && thresholds.medium) || 3;

    let priority = "low";
    if (score >= highT) priority = "high";
    else if (score >= mediumT) priority = "medium";

    return {
      score,
      priority,
      thresholds: { high: highT, medium: mediumT },
    };
  }

  /**
   * حل تساوی: اگر بیش از یک پروفایل بالاترین امتیاز را دارد،
   * از tie_breaker استفاده می‌شود (اولویت با پاسخ مستقیم کاربر).
   * ورودی:
   *   styleScores: { [id]: number }
   *   answers
   *   tieBreaker: { priority_order, fallback_profile }
   * خروجی:
   *   { selected_id, tie_broken, reason }
   */
  function pickProfileId(styleScores, answers, tieBreaker) {
    const entries = Object.entries(styleScores);
    if (entries.length === 0) {
      return {
        selected_id: (tieBreaker && tieBreaker.fallback_profile) || null,
        tie_broken: false,
        reason: "no_scores",
      };
    }

    // بالاترین امتیاز
    const maxScore = Math.max(...entries.map(([, s]) => s));
    const topIds = entries.filter(([, s]) => s === maxScore).map(([id]) => id);

    // فقط یک برنده
    if (topIds.length === 1) {
      return {
        selected_id: topIds[0],
        tie_broken: false,
        reason: "unique_top",
      };
    }

    // تساوی — اعمال tie_breaker
    if (tieBreaker && Array.isArray(tieBreaker.priority_order)) {
      for (const field of tieBreaker.priority_order) {
        const answerId = answers[field];
        if (!answerId) continue;
        if (topIds.includes(answerId)) {
          return {
            selected_id: answerId,
            tie_broken: true,
            reason: `tie_breaker:${field}`,
          };
        }
      }
    }

    // fallback نهایی
    if (tieBreaker && tieBreaker.fallback_profile &&
        topIds.includes(tieBreaker.fallback_profile)) {
      return {
        selected_id: tieBreaker.fallback_profile,
        tie_broken: true,
        reason: "tie_breaker:fallback",
      };
    }

    // آخرین چاره: الفبایی
    const selected = topIds.sort()[0];
    return {
      selected_id: selected,
      tie_broken: true,
      reason: "tie_breaker:alphabetical",
    };
  }

  /**
   * محاسبه کامل — خروجی نهایی برای ResultEngine.
   */
  function computeAll(answers, scoreRules, profiles, thresholds, tieBreaker) {
    const styleResult = computeStyleScores(answers, scoreRules, profiles);
    const leadResult = computeLeadPriority(answers, scoreRules, thresholds);
    const profilePick = pickProfileId(
      styleResult.styleScores,
      answers,
      tieBreaker
    );

    return {
      styleScores: styleResult.styleScores,
      contentTags: styleResult.contentTags,
      matched_rules: styleResult.matched_rules,
      selected_profile_id: profilePick.selected_id,
      tie_broken: profilePick.tie_broken,
      tie_reason: profilePick.reason,
      leadScore: leadResult.score,
      leadPriority: leadResult.priority,
      thresholds: leadResult.thresholds,
    };
  }

  return {
    computeStyleScores,
    computeLeadPriority,
    pickProfileId,
    computeAll,
  };
})();

window.ScoringEngine = ScoringEngine;