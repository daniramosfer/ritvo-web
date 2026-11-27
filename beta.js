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

// Add the moving light and ball over the still pitch.
(() => {
  const canvas = document.getElementById("pitch");
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;

  const toggle = document.querySelector(".motion-toggle");
  const english = document.documentElement.lang === "en";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const light = document.createElement("canvas");
  const highlights = light.getContext("2d");
  let width, height, ratio, circle, center, compact;
  let frame = 0, previous = 0, time = .75, paused = false;

  function point(x, y) {
    const depth = compact ? 1 - (1 - y) ** 2.25 : y;
    return [width * (.5 + (x - .5) * (.58 + .76 * y)), height * (.08 + .89 * depth)];
  }

  function dot(context, x, y, radius) {
    context.moveTo(x + radius, y);
    context.arc(x, y, radius, 0, Math.PI * 2);
  }

  function setup() {
    width = innerWidth;
    height = innerHeight;
    compact = width <= 600;
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = light.width = Math.round(width * ratio);
    canvas.height = light.height = Math.round(height * ratio);
    ctx.scale(ratio, ratio);
    highlights.scale(ratio, ratio);
    const markings = [
      [[0,0],[1,0],[1,1],[0,1],[0,0]],
      [[0,.55],[1,.55]],
      [[.2,0],[.2,.16],[.8,.16],[.8,0]],
      [[.36,0],[.36,.06],[.64,.06],[.64,0]],
      [[.2,1],[.2,.84],[.8,.84],[.8,1]],
      [[.36,1],[.36,.94],[.64,.94],[.64,1]],
    ];
    circle = Array.from({length: 97}, (_, i) => {
      const angle = i * Math.PI / 48;
      return point(.5 + .21 * Math.cos(angle), .55 + .109 * Math.sin(angle));
    });
    center = point(.5, .55);

    let seed = 38;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    highlights.fillStyle = "rgba(185,140,255,.48)";
    for (let i = 0; i < Math.min(9500, width * height / 95); i++) {
      const y = random();
      const [x, py] = point(random(), y);
      const size = .6 + random() * 1.55;
      highlights.fillRect(x, py, size, size);
    }

    highlights.beginPath();
    for (const path of [...markings.map(path => path.map(p => point(...p))), circle]) {
      path.forEach((p, i) => {
        if (i === 0) return;
        const [x, y] = path[i - 1];
        const length = Math.hypot(p[0] - x, p[1] - y);
        const count = Math.max(1, Math.ceil(length / 3.3));
        for (let j = 0; j < count; j++) {
          const px = x + (p[0] - x) * j / count;
          const py = y + (p[1] - y) * j / count;
          const radius = .65 + random() * 1.1;
          dot(highlights, px, py, radius + .55);
        }
      });
    }
    highlights.fillStyle = "#f4e9ff";
    highlights.fill();
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const sweep = .53 + .38 * Math.sin(time * .72);
    const band = Math.ceil(canvas.height / 45);
    for (let y = 0; y < canvas.height; y += band) {
      const distance = ((y + band / 2) / canvas.height - sweep) / .145;
      if (Math.abs(distance) >= 1) continue;
      const rows = Math.min(band, canvas.height - y);
      ctx.globalAlpha = .88 * Math.cos(distance * Math.PI / 2) ** 2;
      ctx.drawImage(light, 0, y, canvas.width, rows, 0, y / ratio, width, rows / ratio);
    }
    ctx.globalAlpha = 1;

    const pulse = (1 + Math.sin(time * 2.6)) / 2;
    ctx.beginPath();
    circle.forEach(([x, y], i) => {
      const scale = 1 + pulse * .055;
      const px = center[0] + (x - center[0]) * scale;
      const py = center[1] + (y - center[1]) * scale;
      if (i % 2 === 0) dot(ctx, px, py, 1 + pulse * .75);
    });
    ctx.fillStyle = `rgba(223,195,255,${.26 + pulse * .61})`;
    ctx.fill();

    for (let i = 32; i >= 0; i--) {
      const angle = (time - i * .036) * .69 + .24;
      const [x, y] = point(.5 + .45 * Math.sin(angle), .69 + .19 * Math.cos(angle));
      const life = 1 - i / 33;
      ctx.beginPath();
      dot(ctx, x, y + Math.sin(i * 2.4) * i * .2, i ? .65 + 1.9 * life : 3.7);
      const color = i > 9 ? "185,140,255" : "248,237,255";
      ctx.fillStyle = `rgba(${color},${life * .94})`;
      ctx.fill();
    }
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || paused || reduced.matches) return;
    if (scrollY < height && now - previous >= 1000 / 30 - .5) {
      time += Math.min((now - previous) / 1000, .05);
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = performance.now();
    toggle.hidden = reduced.matches;
    if (reduced.matches) {
      time = .75;
      draw();
    } else if (!document.hidden && !paused) {
      frame = requestAnimationFrame(tick);
    }
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.textContent = english ? (paused ? "Play background" : "Pause background") : (paused ? "Animar fondo" : "Pausar fondo");
    sync();
  });
  addEventListener("resize", setup);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  setup();
  sync();
})();
