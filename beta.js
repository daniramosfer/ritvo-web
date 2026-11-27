// The external beta's signup form (beta.html, beta-en.html).
// It sends the form as a browser would (no CORS preflight) and asks for JSON;
// without this script, the form still posts and the server redirects.
(() => {
  const form = document.getElementById("signup");
  const status = document.getElementById("status");
  const english = document.documentElement.lang === "en";
  const params = new URLSearchParams(location.search);
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  // Only a page served from this Mac may talk to a local server (docs/BETA_EXTERNA.md).
  const api = local ? (params.get("api") || "http://127.0.0.1:8080") : "https://api.ritvo.app";
  form.action = api + "/v1/beta/signup";

  const text = english ? {
    invalid_email: "That email address doesn't look right.",
    consent_required: "Tick the box to accept how we keep your answers.",
    invalid_country: "Choose your country.",
    invalid_language: "Choose a language.",
    invalid_devices: "Choose at least one device.",
    invalid_iptv: "Tell us whether you already have an IPTV playlist.",
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

  // Where each refusal points.
  const fields = {
    invalid_email: "email", invalid_country: "country", invalid_language: "language", invalid_name: "name",
    invalid_models: "models", invalid_sports: "sports", invalid_expectations: "expectations",
    invalid_devices: "devices", invalid_iptv: "iptv", invalid_source: "source", consent_required: "consent",
  };

  // Conserva las ayudas de cada campo al asociarle un error para VoiceOver.
  function clearErrors() {
    form.querySelectorAll(".invalid").forEach((element) => element.classList.remove("invalid"));
    form.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
      input.removeAttribute("aria-invalid");
      const descriptions = (input.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== "status");
      if (descriptions.length) input.setAttribute("aria-describedby", descriptions.join(" "));
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
    inputs.forEach((input) => {
      (input.closest(".choice, .consent") || input).classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
      const descriptions = input.getAttribute("aria-describedby");
      input.setAttribute("aria-describedby", descriptions ? descriptions + " status" : "status");
    });
    inputs[0]?.focus();
  }

  // The links from Mastodon and Telegram say where they come from (?from=mastodon).
  const from = params.get("from");
  const source = from && form.querySelector(`[name="source"][value="${CSS.escape(from)}"]`);
  if (source) source.checked = true;
  document.querySelectorAll("[data-keep-query]").forEach((link) => {
    if (location.search) link.search = location.search;
  });

  // Without the script the server sends us back with ?error=.
  if (params.get("error")) show(params.get("error"));

  function check() {
    const email = form.elements.email;
    if (!email.value.trim() || !email.validity.valid) return "invalid_email";
    if (!form.elements.country.value) return "invalid_country";
    if (!form.querySelector('[name="devices"]:checked')) return "invalid_devices";
    if (!form.querySelector('[name="iptv"]:checked')) return "invalid_iptv";
    if (!form.querySelector('[name="source"]:checked')) return "invalid_source";
    if (!form.elements.consent.checked) return "consent_required";
    return null;
  }

  let busy = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    const problem = check();
    if (problem) return show(problem);
    clearErrors();
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.className = "status";
    status.textContent = text.sending;
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new URLSearchParams(new FormData(form)),
        headers: { Accept: "application/json" },
        credentials: "omit", cache: "no-store", redirect: "error", referrerPolicy: "no-referrer",
      });
      if (response.ok) {
        location.href = english ? "beta-thanks.html" : "beta-gracias.html";
        return;
      }
      let code = "other";
      try { code = (await response.json()).error || code; } catch (_) {}
      show(code);
    } catch (_) {
      show("offline");
    } finally {
      busy = false;
      button.disabled = false;
    }
  });
})();

// Una sola llegada del gol cuando el teléfono entra en pantalla.
(() => {
  const arena = document.querySelector(".arena");
  if (!arena || !window.IntersectionObserver || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  arena.classList.add("motion-ready");
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    arena.classList.add("is-visible");
    observer.disconnect();
  }, { threshold: 0.15 });
  observer.observe(arena.querySelector(".phone"));
})();
