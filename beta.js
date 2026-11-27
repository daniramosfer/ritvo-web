// Shared launch behaviour.
(() => {
  const english = document.documentElement.lang === "en";
  const params = new URLSearchParams(location.search);
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  const api = local ? (params.get("api") || "http://127.0.0.1:8080") : "https://api.ritvo.app";
  document.querySelectorAll("[data-keep-query]").forEach(link => {
    if (location.search) link.search = location.search;
  });
  const share = document.getElementById("share");
  if (share) {
    share.hidden = false;
    share.addEventListener("click", async () => {
      const input = document.getElementById("share-url");
      try {
        await navigator.clipboard.writeText(input.value);
        document.getElementById("share-status").textContent = english ? "Link copied." : "Enlace copiado.";
      } catch (_) {
        input.focus(); input.select();
        document.getElementById("share-status").textContent = english ? "Select and copy this link." : "Selecciona y copia este enlace.";
      }
    });
  }
  const form = document.getElementById("signup");
  if (!form) return;
  const status = document.getElementById("status");
  const first = document.getElementById("step-one");
  const profile = document.getElementById("step-two");
  const submit = document.getElementById("submit");
  const skip = document.getElementById("skip-profile");
  const thanks = english ? "beta-thanks.html" : "beta-gracias.html";
  const from = ["mastodon", "telegram"].includes(params.get("from")) ? params.get("from") : "";
  let country = "";
  try { country = new Intl.Locale(navigator.language).region || ""; } catch (_) {}
  if (!/^[A-Z]{2}$/.test(country)) country = "";
  const countryField = form.elements.country;
  if (country && ![...countryField.options].some(o => o.value === country)) {
    let label = country;
    try { label = new Intl.DisplayNames([english ? "en" : "es"], {type:"region"}).of(country); } catch (_) {}
    countryField.add(new Option(label, country));
  }
  countryField.value = country;
  if (from) form.querySelector(`[name="source"][value="${from}"]`).checked = true;
  form.action = api + "/v1/beta/signup";
  form.noValidate = true;
  document.documentElement.classList.add("enhanced");
  profile.hidden = true;
  profile.disabled = true;
  let edit = "", busy = false;
  const text = english ? {
    invalid_email: "That email address doesn't look right.",
    consent_required: "Tick the box to accept how we keep your answers.",
    invalid_country: "Choose your country.",
    invalid_language: "Choose a language.",
    invalid_devices: "Choose at least one device.",
    invalid_iptv: "Tell us whether you already have an IPTV playlist.",
    invalid_watch: "Choose how you watch matches.",
    invalid_source: "Tell us how you heard about Ritvo.",
    invalid_name: "The name is too long.",
    invalid_models: "The model text is too long.",
    invalid_sports: "The sports text is too long.",
    invalid_expectations: "That text is too long.",
    rate_limited: "Too many attempts from this connection. Try again in an hour.",
    offline: "Couldn't reach Ritvo. Check your connection and try again.",
    other: "Something went wrong. Try again in a while.",
    sending: "Sending…",
  } : {
    invalid_email: "Ese correo no parece correcto.",
    consent_required: "Marca la casilla para aceptar cómo guardamos tus respuestas.",
    invalid_country: "Elige tu país.",
    invalid_language: "Elige un idioma.",
    invalid_devices: "Elige al menos un aparato.",
    invalid_iptv: "Dinos si ya tienes una lista IPTV.",
    invalid_watch: "Elige cómo ves los partidos.",
    invalid_source: "Dinos cómo nos has conocido.",
    invalid_name: "El nombre es demasiado largo.",
    invalid_models: "El texto del modelo es demasiado largo.",
    invalid_sports: "El texto de los deportes es demasiado largo.",
    invalid_expectations: "Ese texto es demasiado largo.",
    rate_limited: "Demasiados intentos desde esta conexión. Vuelve a probar dentro de una hora.",
    offline: "No se ha podido conectar con Ritvo. Revisa la conexión y vuelve a intentarlo.",
    other: "Algo ha fallado. Vuelve a intentarlo en un rato.",
    sending: "Enviando…",
  };

  const fields = {
    invalid_email: "email", invalid_country: "country", invalid_language: "language", invalid_name: "name",
    invalid_models: "models", invalid_sports: "sports", invalid_expectations: "expectations",
    invalid_devices: "devices", invalid_iptv: "iptv", invalid_watch: "watch", invalid_source: "source", consent_required: "consent",
  };
  function clearErrors() {
    form.querySelectorAll(".invalid").forEach(element => element.classList.remove("invalid"));
    form.querySelectorAll('[aria-invalid="true"]').forEach(input => {
      input.removeAttribute("aria-invalid");
      const ids = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== "status");
      if (ids.length) input.setAttribute("aria-describedby", ids.join(" "));
      else input.removeAttribute("aria-describedby");
    });
  }
  function show(code) {
    status.textContent = Object.hasOwn(text, code) ? text[code] : text.other;
    status.className = "status error";
    clearErrors();
    const name = Object.hasOwn(fields, code) && fields[code];
    if (!name) return;
    const inputs = form.querySelectorAll(`[name="${name}"]`);
    if (!edit && inputs[0] && profile.contains(inputs[0])) {
      profile.hidden = false; profile.disabled = false;
      form.dataset.nativeRetry = "true";
    }
    inputs.forEach(input => {
      (input.closest(".choice, .consent") || input).classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
      const ids = input.getAttribute("aria-describedby");
      input.setAttribute("aria-describedby", ids ? ids + " status" : "status");
    });
    inputs[0]?.focus();
  }
  function check() {
    if (!edit) {
      const email = form.elements.email;
      if (!email.value.trim() || !email.validity.valid) return "invalid_email";
      if (!form.querySelector('[name="devices"]:checked')) return "invalid_devices";
      if (!form.elements.consent.checked) return "consent_required";
    } else {
      for (const [name, max] of [["name",80],["models",200],["sports",300],["expectations",600]]) {
        if (form.elements[name].value.length > max) return "invalid_" + name;
      }
    }
    return null;
  }
  async function request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(api + path, {
        method: body ? "POST" : "GET", body,
        headers: { Accept: "application/json" },
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer", signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
  }
  async function count() {
    try {
      const response = await request("/v1/beta/count");
      if (!response.ok) return;
      const {count} = await response.json();
      if (typeof count !== "number" || !Number.isFinite(count) || count < 0) return;
      const output = document.getElementById("beta-count");
      const formatted = new Intl.NumberFormat(english ? "en-US" : "de-DE").format(count);
      output.textContent = formatted + (english ? " people on the list" : " personas ya en la lista");
      output.hidden = Boolean(edit);
    } catch (_) {}
  }
  count();
  if (params.get("error")) show(params.get("error"));
  form.addEventListener("submit", async event => {
    if (form.dataset.nativeRetry) { form.noValidate = false; return; }
    event.preventDefault();
    if (busy) return;
    const problem = check();
    if (problem) return show(problem);
    clearErrors(); busy = true; submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.className = "status"; status.textContent = text.sending;
    const data = new URLSearchParams();
    if (!edit) {
      data.set("email", form.elements.email.value.trim());
      form.querySelectorAll('[name="devices"]:checked').forEach(input => data.append("devices", input.value));
      data.set("consent", "yes"); data.set("page", english ? "en" : "es");
      data.set("language", english ? "en" : "es"); data.set("country", country);
      if (from) data.set("source", from);
      data.set("website", form.elements.website.value);
    } else {
      data.set("edit", edit);
      new FormData(form).forEach((value, key) => {
        if (["name","country","language","models","sports","iptv","watch","expectations","source"].includes(key) && value) data.append(key, value);
      });
    }
    try {
      const response = await request(edit ? "/v1/beta/profile" : "/v1/beta/signup", data);
      let result = {}; try { result = await response.json(); } catch (_) {}
      if (!response.ok || result.ok !== true) { show(result.error || "other"); return; }
      if (edit) { location.href = thanks; return; }
      if (response.status !== 201 || typeof result.edit !== "string" || !result.edit) {
        // A valid signup can lack a profile token.
        location.href = thanks; return;
      }
      edit = result.edit;
      first.hidden = true; profile.hidden = false; profile.disabled = false;
      document.querySelector(".signup-card").classList.add("profile-active");
      profile.querySelector(".eyebrow").textContent = english ? "SIGNUP RECEIVED" : "INSCRIPCIÓN RECIBIDA";
      document.getElementById("profile-title").innerHTML = english ? "You’re on the list.<br>A little more about you?" : "Estás dentro.<br>¿Nos cuentas un poco más?";
      skip.hidden = false; submit.textContent = english ? "Send" : "Enviar";
      document.getElementById("beta-count").hidden = true;
      status.textContent = "";
      document.getElementById("profile-title").focus({preventScroll:true});
      document.querySelector(".signup-card").scrollIntoView({block:"start", behavior:"instant"});
    } catch (_) { show("offline"); }
    finally { busy = false; submit.disabled = false; form.removeAttribute("aria-busy"); }
  });
})();
