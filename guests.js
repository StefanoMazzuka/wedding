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
  function connect() {
    if (connection) return connection;
    connection = new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      if (url.origin !== 'https://script.google.com' || !url.pathname.endsWith('/exec')) {
        throw new Error('La conexión con las invitaciones no está configurada.');
      }
      channel = Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
      url.searchParams.set('origin', location.origin);
      url.searchParams.set('channel', channel);
      const timer = setTimeout(() => {
        window.removeEventListener('message', receive);
        frame.remove();
        connection = null;
        reject(new Error('No se pudo conectar. Inténtalo de nuevo en unos momentos.'));
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
        if (data.error) request.reject(new Error(data.error));
        else if (request.action === 'petals' ? (!data.guests || !Number.isSafeInteger(data.guests.total) || data.guests.total < 0 || !Array.isArray(data.guests.petals)) : !Array.isArray(data.guests)) request.reject(new Error('Respuesta no válida. Vuelve a intentarlo.'));
        else request.resolve(data.guests);
      };
      window.addEventListener('message', receive);
      frame = document.createElement('iframe');
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
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(action === 'save'
          ? 'No pudimos confirmar el guardado. Vuelve a abrir tu invitación para comprobar la respuesta.'
          : 'La consulta está tardando demasiado. Vuelve a intentarlo.'));
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
    renderGuests(await requestGuests('save', activeCode, updates));
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
  try {
    const branch = await requestGuests('petals');
    const petals = branch.petals;
    if (version !== branchRequest) return;
    window.renderWeddingBranch(petals, branch.total);
    message.textContent = petals.length === 0 ? 'El primer pétalo está por llegar.'
      : petals.length === 1 ? 'Un pétalo, una persona. Nuestra rama empieza a florecer.'
      : `${petals.length} pétalos, ${petals.length} personas para compartir este día.`;
  } catch {
    if (version !== branchRequest) return;
    message.textContent = 'No hemos podido actualizar los pétalos. Puedes seguir confirmando tu asistencia.';
    retry.hidden = false;
  }
}
document.getElementById('branch-retry').addEventListener('click', refreshBranch);
window.renderWeddingBranch([], 0);
refreshBranch();
