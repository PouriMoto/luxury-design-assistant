/* ============================================================
   LEAD FORM — اعتبارسنجی فرم لید در v0
   هیچ ارسال شبکه‌ای. فقط اعتبارسنجی + emit رویداد.
   در نسخه نهایی، این ماژول به api-client.js وصل می‌شود.
   ============================================================ */

const LeadForm = (() => {
  // اعتبارسنجی سمت کاربر (سبک)
  function validate(data) {
    const errors = {};

    const name = (data.name || "").trim();
    if (name.length < 2) {
      errors.name = "نام باید حداقل ۲ حرف باشد.";
    } else if (name.length > 60) {
      errors.name = "نام بیش از حد طولانی است.";
    }

    const phone = (data.phone || "").trim();
    // شماره ایرانی: 09xxxxxxxxx (11 رقم)
    if (!/^09\d{9}$/.test(phone)) {
      errors.phone = "شماره تماس باید با ۰۹ شروع شود و ۱۱ رقم باشد.";
    }

    return { ok: Object.keys(errors).length === 0, errors };
  }

  function handleSubmit(rawData, form) {
    // پاک‌کردن خطاهای قبلی
    ChatRenderer.setFieldError(form, "name", "");
    ChatRenderer.setFieldError(form, "phone", "");

    const result = validate(rawData);

    if (!result.ok) {
      if (result.errors.name) {
        ChatRenderer.setFieldError(form, "name", result.errors.name);
      }
      if (result.errors.phone) {
        ChatRenderer.setFieldError(form, "phone", result.errors.phone);
      }
      return { ok: false, errors: result.errors };
    }

    // ذخیره در state
    State.setLead({
      name: rawData.name,
      phone: rawData.phone,
      contact_consent: !!rawData.contact_consent,
    });

    EventBus.emit("lead_form_submitted", {
      metadata: {
        consultation_requested: true,
        contact_consent: !!rawData.contact_consent,
      },
    });

    if (rawData.contact_consent) {
      EventBus.emit("contact_consent_given", {});
    }

    // در v0 شبیه‌سازی موفقیت
    EventBus.emit("lead_saved", {
      metadata: { lead_id: State.getLeadId(), simulated: true },
    });

    return { ok: true };
  }

  return { validate, handleSubmit };
})();

window.LeadForm = LeadForm;