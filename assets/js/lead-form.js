/* ============================================================
   LEAD FORM — اعتبارسنجی + اتصال واقعی به Apps Script
   در صورت خطای شبکه، اطلاعات فرم حفظ و دکمه تلاش مجدد نمایش داده می‌شود.
   در صورت endpoint خالی، حالت "پیش‌نمایش" نمایش داده می‌شود.
   ============================================================ */

const LeadForm = (() => {
  function validate(data) {
    const errors = {};

    const name = (data.name || "").trim();
    if (name.length < 2) {
      errors.name = "نام باید حداقل ۲ حرف باشد.";
    } else if (name.length > 60) {
      errors.name = "نام بیش از حد طولانی است.";
    }

    const phone = (data.phone || "").trim();
    if (!/^09\d{9}$/.test(phone)) {
      errors.phone = "شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم باشد.";
    }

    return { ok: Object.keys(errors).length === 0, errors };
  }

  /**
   * ارسال لید به API با مدیریت کامل حالت‌ها
   * @returns {Promise<{ok: boolean, leadId?: string, simulated?: boolean, error?: object}>}
   */
  async function submit(rawData) {
    // 1) اعتبارسنجی سمت کاربر
    const v = validate(rawData);
    if (!v.ok) {
      return { ok: false, validationErrors: v.errors };
    }

    // 2) ذخیره در state
    State.setLead({
      name: rawData.name,
      phone: rawData.phone,
      contact_consent: !!rawData.contact_consent,
    });

    // 3) رویداد
    EventBus.emit("lead_form_submitted", {
      metadata: {
        consultation_requested: true,
        contact_consent: !!rawData.contact_consent,
      },
    });

    if (rawData.contact_consent) {
      EventBus.emit("contact_consent_given", {});
    }

    // 4) اگر API تنظیم نشده، شبیه‌سازی
    if (!ApiClient.isConfigured()) {
      // شبیه‌سازی موفقیت
      State.setLeadSaved(true);
      State.setLeadId("lead_preview_" + Math.floor(Math.random() * 100000));
      EventBus.emit("lead_saved", {
        metadata: { lead_id: State.getLeadId(), simulated: true },
      });
      return { ok: true, leadId: State.getLeadId(), simulated: true };
    }

    // 5) ارسال واقعی
    const answers = State.getAnswersArray();
    const scores = State.getScores();
    const outcome = State.getOutcome();

    const result = {
      result_id: outcome ? outcome.id : null,
      lead_priority: scores.leadPriority || null,
    };

    const res = await ApiClient.submitLead(rawData, {
      session_id: State.getSessionId(),
      answers,
      result,
    });

    if (res.ok) {
      State.setLeadSaved(true);
      State.setLeadId(res.lead_id);
      EventBus.emit("lead_saved", {
        metadata: { lead_id: res.lead_id, simulated: false },
      });
      return { ok: true, leadId: res.lead_id, simulated: false };
    }

    // 6) خطا
    State.setLastApiError(res.error);
    return {
      ok: false,
      error: res.error,
    };
  }

  /**
   * اتصال فرم UI به submit
   * درخواست از renderLeadForm فراخوانی می‌شود
   */
  function handleSubmit(rawData, form) {
    // 1) پاک کردن خطاها
    ChatRenderer.setFieldError(form, "name", "");
    ChatRenderer.setFieldError(form, "phone", "");
    ChatRenderer.clearFormApiError(form);

    // 2) اعتبارسنجی سریع قبل از شروع
    const v = validate(rawData);
    if (!v.ok) {
      if (v.errors.name) ChatRenderer.setFieldError(form, "name", v.errors.name);
      if (v.errors.phone) ChatRenderer.setFieldError(form, "phone", v.errors.phone);
      return;
    }

    // 3) نمایش حالت loading
    ChatRenderer.setFormLoading(form, true);

    // 4) ارسال async
    submit(rawData)
      .then((result) => {
        ChatRenderer.setFormLoading(form, false);

        if (result.ok) {
          ChatRenderer.renderLeadSuccess(form, rawData, {
            leadId: result.leadId,
            simulated: result.simulated,
          });
          ChatRenderer.setFlowStep("done");
          return;
        }

        // خطای شبکه/سرور
        const errMsg =
          result.error && result.error.code === "NOT_CONFIGURED"
            ? "اتصال به سرور هنوز تنظیم نشده است. پس از راه‌اندازی Apps Script می‌توانید درخواست را ثبت کنید."
            : "ارسال درخواست ناموفق بود. لطفاً دوباره تلاش کنید.";

        ChatRenderer.setFormApiError(form, errMsg);

        // فعال کردن مجدد فرم برای تلاش دوباره
        ChatRenderer.setFormLoading(form, false);
      })
      .catch((err) => {
        ChatRenderer.setFormLoading(form, false);
        ChatRenderer.setFormApiError(
          form,
          "خطای غیرمنتظره در ارسال. لطفاً دوباره تلاش کنید."
        );
        console.error("[LeadForm] unexpected:", err);
      });
  }

  return { validate, submit, handleSubmit };
})();

window.LeadForm = LeadForm;