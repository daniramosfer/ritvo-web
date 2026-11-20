"use strict";

const api = "https://api.ritvo.app/v1/account/web/";
const strings = {
  es: {
    title: "Cuenta de Ritvo",
    intro: "Consulta tus aparatos o borra tu cuenta.",
    nickname: "Apodo",
    login: "Entrar con llave de acceso",
    qr: "Si tu llave está en el móvil, elige usar otro aparato y escanea el QR del navegador. Ten el móvil cerca.",
    logout: "Cerrar sesión",
    devices: "Aparatos",
    remove: "Quitar",
    removeQuestion: "¿Quitar este aparato de tu cuenta?",
    removed: "Aparato quitado.",
    empty: "No hay aparatos vinculados.",
    unknown: "Aparato",
    lastSeen: "Último uso",
    deleteTitle: "Borrar la cuenta",
    deleteInfo: "Se borrarán tu apodo, tus llaves de acceso, tus aparatos y tus datos cifrados en Ritvo. Las copias caducan en 30 días. Gestiona tu suscripción Pro en la tienda donde la compraste.",
    confirm: "Escribe tu apodo para confirmar",
    deleteButton: "Borrar mi cuenta",
    deleteQuestion: "¿Borrar tu cuenta de Ritvo de forma permanente?",
    deleted: "Tu cuenta se ha borrado.",
    help: "Si has perdido tu llave, puedes borrar la cuenta desde Ajustes en un aparato con sesión iniciada. Las cuentas inactivas se borran a los 18 meses.",
    privacy: "Política de privacidad",
    unsupported: "Este navegador no puede pedir una llave de acceso. Prueba en otro navegador.",
    expired: "La sesión ha caducado. Vuelve a entrar con tu llave de acceso.",
    cancelled: "Se canceló la comprobación de la llave de acceso.",
    invalid: "No se pudo entrar con esa llave. Comprueba tu apodo.",
    limited: "Hay demasiados intentos. Espera un minuto y vuelve a intentarlo.",
    failed: "No se pudo completar la operación. Inténtalo de nuevo."
  },
  en: {
    title: "Ritvo Account",
    intro: "Review your devices or delete your account.",
    nickname: "Nickname",
    login: "Sign in with a passkey",
    qr: "If your passkey is on your phone, choose to use another device and scan the browser’s QR code. Keep your phone nearby.",
    logout: "Sign out",
    devices: "Devices",
    remove: "Remove",
    removeQuestion: "Remove this device from your account?",
    removed: "Device removed.",
    empty: "No linked devices.",
    unknown: "Device",
    lastSeen: "Last used",
    deleteTitle: "Delete your account",
    deleteInfo: "This deletes your nickname, passkeys, devices and encrypted Ritvo data. Backups expire within 30 days. Manage your Pro subscription in the store where you bought it.",
    confirm: "Enter your nickname to confirm",
    deleteButton: "Delete my account",
    deleteQuestion: "Permanently delete your Ritvo account?",
    deleted: "Your account has been deleted.",
    help: "If you lost your passkey, you can delete your account from Settings on a signed-in device. Inactive accounts are deleted after 18 months.",
    privacy: "Privacy Policy",
    unsupported: "This browser can’t request a passkey. Try another browser.",
    expired: "Your session expired. Sign in with your passkey again.",
    cancelled: "The passkey check was cancelled.",
    invalid: "That passkey couldn’t open the account. Check your nickname.",
    limited: "Too many attempts. Wait a minute and try again.",
    failed: "Ritvo couldn’t complete the request. Try again."
  }
};

const platforms = {
  ios: "iPhone", ipados: "iPad", tvos: "Apple TV", macos: "Mac",
  android: "Android", androidtv: "Android TV", firetv: "Fire TV"
};
const byID = (id) => document.getElementById(id);
let language = new URLSearchParams(location.search).get("lang") === "en"
  || (!new URLSearchParams(location.search).has("lang") && navigator.language.startsWith("en"))
  ? "en" : "es";
let session = null;
let devices = [];
let busy = false;
let statusKey = "";
let expiration;

const t = (key) => strings[language][key];

function render() {
  document.documentElement.lang = language;
  document.title = t("title");
  document.querySelectorAll("[data-text]").forEach((node) => {
    node.textContent = t(node.dataset.text);
  });
  byID("language").lang = language === "es" ? "en" : "es";
  byID("language").textContent = language === "es" ? "English" : "Español";
  byID("privacy").href = language === "es" ? "../privacidad.html" : "../privacy.html";
  byID("login").hidden = Boolean(session);
  byID("account").hidden = !session;
  byID("help").hidden = Boolean(session);
  byID("handle").textContent = session ? "@" + session.nickname : "";
  byID("status").textContent = statusKey ? t(statusKey) : "";
  renderDevices();
  updateControls();
}

function updateControls() {
  document.querySelectorAll("form input, form button, #logout, #devices button").forEach((node) => {
    node.disabled = busy;
  });
}

function renderDevices() {
  const list = byID("devices");
  list.replaceChildren();
  if (!session) return;
  if (devices.length === 0) {
    const row = document.createElement("li");
    row.textContent = t("empty");
    list.append(row);
    return;
  }
  const formatter = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" });
  for (const device of devices) {
    const row = document.createElement("li");
    const detail = document.createElement("div");
    const name = platforms[device.platform] ?? t("unknown");
    const date = document.createElement("time");
    date.className = "note";
    date.dateTime = device.lastActive;
    date.textContent = t("lastSeen") + " · " + formatter.format(new Date(device.lastActive));
    detail.append(name, date);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet";
    remove.textContent = t("remove");
    remove.setAttribute("aria-label", t("remove") + " · " + name);
    remove.addEventListener("click", () => {
      if (!window.confirm(t("removeQuestion"))) return;
      run(async () => {
        await request("devices/" + encodeURIComponent(device.id), { method: "DELETE" });
        devices = devices.filter((item) => item.id !== device.id);
        statusKey = "removed";
      });
    });
    row.append(detail, remove);
    list.append(row);
  }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = {};
  if (session) headers.Authorization = "Bearer " + session.token;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(api + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
    credentials: "omit", cache: "no-store", redirect: "error"
  });
  if (!response.ok) {
    const error = new Error("Account request failed");
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

function clearSession() {
  clearTimeout(expiration);
  session = null;
  devices = [];
  byID("delete").reset();
}

async function run(action) {
  if (busy) return;
  busy = true;
  statusKey = "";
  byID("status").textContent = "";
  updateControls();
  try {
    await action();
  } catch (error) {
    if (error.status === 401 && session) {
      clearSession();
      statusKey = "expired";
    } else if (error.status === 401) statusKey = "invalid";
    else if (error.status === 429) statusKey = "limited";
    else if (error.name === "NotAllowedError" || error.name === "AbortError") statusKey = "cancelled";
    else statusKey = "failed";
  } finally {
    busy = false;
    render();
  }
}

function fromBase64URL(value) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (byte) => byte.charCodeAt(0));
}

function toBase64URL(value) {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

byID("login").addEventListener("submit", (event) => {
  event.preventDefault();
  const nickname = byID("nickname").value.toLowerCase();
  run(async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) {
      statusKey = "unsupported";
      return;
    }
    const { session_id, ...options } = await request("login/options", { method: "POST", body: { nickname } });
    if (options.rpId !== "ritvo.app") throw new Error("Unexpected relying party");
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON
      ? PublicKeyCredential.parseRequestOptionsFromJSON(options)
      : { ...options, challenge: fromBase64URL(options.challenge) };
    const assertion = await navigator.credentials.get({ publicKey });
    const { response } = assertion;
    const credential = {
      id: assertion.id, type: assertion.type, rawId: toBase64URL(assertion.rawId),
      response: {
        authenticatorData: toBase64URL(response.authenticatorData),
        clientDataJSON: toBase64URL(response.clientDataJSON),
        signature: toBase64URL(response.signature),
        userHandle: response.userHandle ? toBase64URL(response.userHandle) : null
      }
    };
    session = await request("login", { method: "POST", body: { session_id, credential } });
    expiration = setTimeout(() => {
      if (!session) return;
      clearSession();
      statusKey = "expired";
      render();
    }, 300_000);
    devices = await request("devices");
    devices.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
  });
});

byID("delete").addEventListener("submit", (event) => {
  event.preventDefault();
  const confirmation = byID("confirmation").value.toLowerCase();
  if (confirmation !== session?.nickname) {
    byID("confirmation").setCustomValidity(t("confirm"));
    byID("confirmation").reportValidity();
    return;
  }
  if (!window.confirm(t("deleteQuestion"))) return;
  run(async () => {
    await request("account", { method: "DELETE", body: { confirmation } });
    clearSession();
    byID("login").reset();
    statusKey = "deleted";
  });
});

byID("confirmation").addEventListener("input", (event) => event.target.setCustomValidity(""));
byID("logout").addEventListener("click", () => run(async () => {
  try { await request("session", { method: "DELETE" }); }
  finally { clearSession(); }
}));
byID("language").addEventListener("click", () => {
  language = language === "es" ? "en" : "es";
  render();
});
render();
