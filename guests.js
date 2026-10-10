"use strict";

// Apps Script runs in a hidden transport frame; all visible UI belongs to this site.
// A random channel binds messages to this page load. Invitation codes never go in URLs.
function createGuestsConnection(endpoint) {
  let connection;
  let frame;
  const pending = new Map();
  let peer;
  let peerOrigin;
  let channel;
  let receive;
  let frameLoads = 0;
  let started;
  function failure(code, message, phase) {
    const online = typeof navigator === 'undefined' ? 'desconocida'
      : navigator.onLine === false ? 'sin conexión' : 'aparentemente disponible';
    const details = `${code}; fase: ${phase}; red: ${online}; marco: ${frameLoads} cargas; espera: ${Math.round((Date.now() - started) / 1000)} s; origen: ${location.origin}`;
    // Only transport metadata: never log invitation codes, names or responses.
    console.warn('[Invitaciones]', {
      code, phase, online, frameLoads, elapsedMs: Date.now() - started,
      origin: location.origin,
      browser: typeof navigator === 'undefined' ? 'desconocido' : navigator.userAgent
    });
    return new Error(`${message} [${details}]`);
  }
  function connect() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      started = Date.now();
      frameLoads = 0;
      let url;
      try { url = new URL(endpoint); } catch (_) {
        throw failure('CONFIG_URL', 'La URL de Apps Script no es válida.', 'configuración');
      }
      if (url.origin !== 'https://script.google.com' || !url.pathname.endsWith('/exec')) {
        throw failure('CONFIG_URL', 'La conexión necesita una URL de Apps Script terminada en /exec.', 'configuración');
      }
      if (location.origin === 'null') {
        throw failure('PAGE_ORIGIN', 'Abre la web por HTTP o HTTPS, no como archivo local.', 'configuración');
      }
      channel = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
      url.searchParams.set('origin', location.origin);
      url.searchParams.set('channel', channel);
      const timer = setTimeout(() => {
        window.removeEventListener('message', receive);
        frame.remove();
        connection = null;
        reject(failure('BRIDGE_TIMEOUT',
          'Google no confirmó la conexión en 25 segundos. No se llegó a consultar la hoja. Prueba a abrir la web en otro navegador o cambiar de red. Si persiste, revisa el acceso público de Apps Script y los orígenes permitidos. El navegador no permite conocer desde aquí el motivo exacto.',
          'conexión con Apps Script'));
      }, 25000);
      receive = event => {
        const data = event.data;
        if (!/^https:\/\/([a-z0-9-]+[.-])?script\.googleusercontent\.com$/.test(event.origin) ||
            !data || data.app !== 'wedding-guests' || data.channel !== channel) return;
        if (data.ready && !peer) {
          peer = event.source;
          peerOrigin = event.origin;
          clearTimeout(timer);
          resolve();
          return;
        }
        if (event.source !== peer || event.origin !== peerOrigin) return;
        const request = pending.get(data.id);
        if (!request) return;
        pending.delete(data.id);
        clearTimeout(request.timer);
        if (data.error) request.reject(failure('SHEETS_ERROR', String(data.error), request.action));
        else if (request.action === 'petals' ? (!data.guests || !Number.isSafeInteger(data.guests.total) || data.guests.total < 0 || !Array.isArray(data.guests.petals)) : !Array.isArray(data.guests)) request.reject(failure('INVALID_RESPONSE', 'Google devolvió una respuesta con un formato no válido. Revisa la versión publicada de Apps Script.', request.action));
        else request.resolve(data.guests);
      };
      window.addEventListener('message', receive);
      frame = document.createElement('iframe');
      frame.onload = () => { frameLoads++; };
      frame.hidden = true;
      frame.title = 'Conexión de invitaciones';
      frame.src = url.href;
      document.body.append(frame);
    });
    return connection;
  }
  return async (action, code, guests) => {
    await connect();
    return new Promise((resolve, reject) => {
      // getRandomValues also works in browsers/local previews without randomUUID.
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(failure('REQUEST_TIMEOUT', action === 'save'
          ? 'No pudimos confirmar el guardado. Vuelve a abrir tu invitación para comprobar la respuesta.'
          : 'La conexión con Google se abrió, pero la consulta no respondió en 30 segundos. Vuelve a intentarlo.', action));
      }, 30000);
      pending.set(id, { resolve, reject, timer, action });
      peer.postMessage({ app: 'wedding-guests', channel, id, action, code, guests }, peerOrigin);
    });
  };
}

const requestGuests = createGuestsConnection((window.WEDDING || {}).guestsApiUrl);
const lookup = document.getElementById('guest-lookup');
const editor = document.getElementById('guest-editor');
const codeInput = document.getElementById('invitation-code');
const people = document.getElementById('guest-people');
const statusText = document.getElementById('guest-status');
let activeCode = '';
let currentGuests = [];

function status(message, state = '') {
  statusText.textContent = message;
  statusText.dataset.state = state;
}
function busy(value) {
  document.querySelectorAll('.guest-panel input, .guest-panel select, .guest-panel button')
    .forEach(element => element.disabled = value);
  document.querySelector('.guest-panel').setAttribute('aria-busy', String(value));
}
function addField(group, title, key, value, options) {
  const label = document.createElement('label');
  label.textContent = title;
  const input = document.createElement(options ? 'select' : 'input');
  input.dataset.key = key;
  if (options) {
    options.forEach(([value, text]) => input.add(new Option(text, value)));
    if (!options.some(([option]) => option === value)) value = options[0][0];
  } else {
    input.maxLength = 100;
    input.autocomplete = 'off';
  }
  input.value = value;
  label.append(input);
  group.append(label);
  return input;
}
function renderGuests(guests) {
  currentGuests = guests;
  people.replaceChildren();
  guests.forEach((guest, i) => {
    const group = document.createElement('fieldset');
    group.className = 'guest-person';
    const legend = document.createElement('legend');
    legend.textContent = guest.name || `Acompañante ${i + 1}`;
    group.append(legend);
    const name = addField(group, 'Nombre', 'name', guest.name);
    addField(group, 'Adulto o niño', 'type', guest.type, [['adulto', 'Adulto'], ['niño', 'Niño']]);
    const attendance = addField(group, '¿Nos acompañas?', 'attendance', guest.attendance,
      [['pendiente', 'Aún por confirmar'], ['sí', 'Sí, ¡allí estaré!'], ['no', 'No podré asistir']]);
    const allergens = addField(group, 'Alergias e intolerancias alimentarias (opcional)', 'allergens', guest.allergens || '');
    allergens.maxLength = 500;
    allergens.placeholder = 'Ej.: frutos secos, gluten, lactosa…';
    const requireName = () => { name.required = attendance.value === 'sí'; };
    attendance.addEventListener('change', requireName);
    requireName();
    people.append(group);
  });
  lookup.hidden = true;
  editor.hidden = false;
}
lookup.addEventListener('submit', async event => {
  event.preventDefault();
  codeInput.value = codeInput.value.trim().toUpperCase();
  activeCode = codeInput.value;
  busy(true);
  status('Abriendo tu invitación…');
  try {
    renderGuests(await requestGuests('read', activeCode));
    status('');
    document.getElementById('guest-heading').focus();
  } catch (error) {
    status(error.message, 'error');
  } finally { busy(false); }
});
editor.addEventListener('submit', async event => {
  event.preventDefault();
  const updates = Array.from(people.children, (group, i) => {
    const guest = { id: currentGuests[i].id };
    group.querySelectorAll('[data-key]').forEach(input => guest[input.dataset.key] = input.value.trim());
    return guest;
  });
  busy(true);
  status('Guardando vuestra respuesta…');
  try {
    const saved = await requestGuests('save', activeCode, updates);
    const allergensConfirmed = updates.every(guest => {
      const response = saved.find(person => person.id === guest.id);
      return response && typeof response.allergens === 'string' && response.allergens === guest.allergens;
    });
    if (!allergensConfirmed) {
      throw new Error('Google no confirmó el guardado de las alergias. Actualiza Code.gs en Apps Script y publica una nueva versión en Gestionar implementaciones → Editar → Nueva versión → Implementar. Comprueba que la columna G se llama allergens.');
    }
    renderGuests(saved);
    status('Vuestra respuesta está guardada. ¡Gracias por contárnoslo!', 'success');
    refreshBranch();
  } catch (error) {
    status(error.message, 'error');
  } finally { busy(false); }
});
document.getElementById('guest-exit').addEventListener('click', () => {
  activeCode = '';
  currentGuests = [];
  people.replaceChildren();
  editor.hidden = true;
  lookup.hidden = false;
  codeInput.value = '';
  status('');
  codeInput.focus();
});

let branchRequest = 0;
async function refreshBranch() {
  const version = ++branchRequest;
  const message = document.getElementById('branch-status');
  const retry = document.getElementById('branch-retry');
  retry.hidden = true;
  message.textContent = 'Actualizando los pétalos…';
  let stage = 'read';
  try {
    const branch = await requestGuests('petals');
    const petals = branch.petals;
    if (version !== branchRequest) return;
    stage = 'draw';
    window.renderWeddingBranch(petals, branch.total);
    message.textContent = petals.length === 0 ? 'El primer pétalo está por llegar.'
      : petals.length === 1 ? 'Un pétalo, una persona. Nuestra rama empieza a florecer.'
      : `${petals.length} pétalos, ${petals.length} personas para compartir este día.`;
  } catch (error) {
    if (version !== branchRequest) return;
    message.textContent = stage === 'draw'
      ? 'No se ha podido dibujar la rama. Recarga la página para obtener la última versión.'
      : `No hemos podido actualizar los pétalos: ${error.message || 'no se recibió respuesta'}. Puedes seguir confirmando tu asistencia.`;
    retry.hidden = false;
  }
}
document.getElementById('branch-retry').addEventListener('click', refreshBranch);
window.renderWeddingBranch([], 0);
refreshBranch();
