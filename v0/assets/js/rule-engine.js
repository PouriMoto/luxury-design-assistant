/* ============================================================
   RULE ENGINE — ارزیابی داده‌محور قواعد
   هیچ eval، هیچ Function()، هیچ اجرای رشته.
   عملگرهای مجاز: equals, not_equals, in, greater_than, less_than, all, any
   ============================================================ */

const RuleEngine = (() => {
  const ALLOWED_OPERATORS = new Set([
    "equals", "not_equals", "in", "greater_than", "less_than", "all", "any",
  ]);

  /**
   * ارزیابی یک شرط منفرد.
   * شرط: { field, operator, value }
   * answers: { [questionId]: answerId }
   */
  function evaluateCondition(condition, answers) {
    if (!condition || typeof condition !== "object") return false;

    const { field, operator, value } = condition;

    if (!field || !operator) return false;
    if (!ALLOWED_OPERATORS.has(operator)) {
      console.warn(`[RuleEngine] عملگر ناشناخته: ${operator}`);
      return false;
    }

    const actual = answers[field];

    switch (operator) {
      case "equals":
        return actual === value;
      case "not_equals":
        return actual !== value;
      case "in":
        return Array.isArray(value) && value.includes(actual);
      case "greater_than":
        return typeof actual === "number" && actual > value;
      case "less_than":
        return typeof actual === "number" && actual < value;
      default:
        return false;
    }
  }

  /**
   * ارزیابی یک قاعده‌ی "when" که می‌تواند شامل all / any باشد.
   * ساختار:
   *   { all: [cond, cond, ...] }  یا
   *   { any: [cond, cond, ...] }  یا
   *   { field, operator, value } (شرط منفرد)
   */
  function evaluateWhen(when, answers) {
    if (!when || typeof when !== "object") return false;

    if (Array.isArray(when.all)) {
      return when.all.every((c) => evaluateWhen(c, answers));
    }
    if (Array.isArray(when.any)) {
      return when.any.some((c) => evaluateWhen(c, answers));
    }
    return evaluateCondition(when, answers);
  }

  /**
   * ارزیابی یک قاعده‌ی کامل.
   */
  function evaluateRule(rule, answers) {
    if (!rule || typeof rule !== "object") return false;
    return evaluateWhen(rule.when, answers);
  }

  /**
   * اعمال مسیر (path rules) — پیدا کردن override_next اگر وجود دارد.
   * برمی‌گرداند: { next, override_rule_id } یا null
   */
  function resolvePath(pathRules, answers, currentQuestionId) {
    if (!Array.isArray(pathRules)) return null;

    for (const rule of pathRules) {
      if (!evaluateRule(rule, answers)) continue;

      const effects = Array.isArray(rule.effects) ? rule.effects : [];
      for (const eff of effects) {
        if (eff.type === "override_next" && typeof eff.target === "string") {
          return { next: eff.target, rule_id: rule.id };
        }
      }
    }
    return null;
  }

  /**
   * جمع‌آوری همه‌ی effects امتیازی از قواعدی که شرطشان برقرار است.
   * برمی‌گرداند:
   *   {
   *     styleScores: { [profile]: number },
   *     contentTags: { [tag]: number },
   *     leadScore: number,
   *     matched_rules: [rule_id, ...]
   *   }
   */
  function collectScoreEffects(scoreRules, answers) {
    const result = {
      styleScores: {},
      contentTags: {},
      leadScore: 0,
      matched_rules: [],
    };

    if (!Array.isArray(scoreRules)) return result;

    for (const rule of scoreRules) {
      if (!evaluateRule(rule, answers)) continue;
      result.matched_rules.push(rule.id);

      const effects = Array.isArray(rule.effects) ? rule.effects : [];
      for (const eff of effects) {
        if (eff.type === "style_score") {
          result.styleScores[eff.target] =
            (result.styleScores[eff.target] || 0) + (Number(eff.value) || 0);
        } else if (eff.type === "content_tag") {
          result.contentTags[eff.target] =
            (result.contentTags[eff.target] || 0) + (Number(eff.value) || 0);
        } else if (eff.type === "lead_score") {
          result.leadScore += Number(eff.value) || 0;
        } else {
          console.warn(`[RuleEngine] نوع اثر ناشناخته: ${eff.type}`);
        }
      }
    }

    return result;
  }

  return {
    evaluateCondition,
    evaluateWhen,
    evaluateRule,
    resolvePath,
    collectScoreEffects,
    ALLOWED_OPERATORS: Array.from(ALLOWED_OPERATORS),
  };
})();

window.RuleEngine = RuleEngine;