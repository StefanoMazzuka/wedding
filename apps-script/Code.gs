// Copiar en el proyecto de Apps Script vinculado a la hoja.
// El ID está entre /d/ y /edit en la URL de Google Sheets.
const SPREADSHEET_ID = 'PASTE_YOUR_SPREADSHEET_ID';
const SHEET_NAME = 'guests';

// El puente no muestra un formulario: la interfaz vive en GitHub Pages.
function doGet(e) {
  const origin = String(e && e.parameter.origin || '');
  const channel = String(e && e.parameter.channel || '');
  const allowed = ['https://marialeystefano.com', 'https://www.marialeystefano.com',
    'https://stefanomazzuka.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];
  if (!allowed.includes(origin) || !/^[a-f0-9]{32}$/.test(channel)) {
    return HtmlService.createHtmlOutput('Abre tu invitación desde la web de la boda.');
  }
  const template = HtmlService.createTemplateFromFile('Bridge');
  template.origin = origin;
  template.channel = channel;
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function invitation_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!/^LOTO-[A-Z0-9]{3,32}$/.test(code)) throw new Error('Código no válido.');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No se encuentra la pestaña guests.');
  const data = sheet.getDataRange().getDisplayValues();
  const headers = ['code', 'id', 'name', 'type', 'attendance', 'position'];
  if (!headers.every((key, i) => data[0][i] === key)) {
    throw new Error('Revisa los encabezados de las columnas A–F.');
  }
  const rows = data.slice(1).map((values, i) => ({ values, row: i + 2 }))
    .filter(entry => entry.values[0].trim().toUpperCase() === code);
  if (!rows.length) throw new Error('Código no encontrado.');
  const ids = rows.map(entry => entry.values[1]);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new Error('Revisa los ID de esta invitación.');
  }
  return { sheet, rows };
}

function guests_(rows) {
  return rows.map(({ values: v }) => ({
    id: v[1], name: v[2], type: v[3], attendance: v[4], position: v[5]
  }));
}

function getGuests(code) {
  return guests_(invitation_(code).rows);
}

// Public branch: confirmed names and positions only; never IDs or codes.
function getPetals() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No se encuentra la pestaña guests.');
  const data = sheet.getDataRange().getDisplayValues();
  if (data[0][4] !== 'attendance' || data[0][5] !== 'position') {
    throw new Error('Revisa las columnas attendance y position.');
  }
  const positions = new Set();
  const petals = [];
  const rows = data.slice(1).filter(row => row.some(value => value.trim()));
  rows.forEach(row => {
    const position = Number(row[5]);
    if (!Number.isSafeInteger(position) || position < 1 || position > rows.length || positions.has(position)) {
      throw new Error('Cada persona necesita una posición única entre 1 y ' + rows.length + '.');
    }
    positions.add(position);
    if (row[4].trim().toLowerCase() === 'sí') petals.push({ position, name: row[2].trim() });
  });
  return { total: rows.length, petals: petals.sort((a, b) => a.position - b.position) };
}

function saveGuests(code, guests) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const { sheet, rows } = invitation_(code);
    if (!Array.isArray(guests) || guests.length !== rows.length) {
      throw new Error('Envía todas las personas de la invitación.');
    }
    const seen = new Set();
    // Validar todo antes de escribir. Nunca aceptar número de fila del navegador.
    const changes = guests.map(guest => {
      if (!guest || typeof guest.id !== 'string') throw new Error('Persona no válida.');
      const entry = rows.find(item => item.values[1] === guest.id);
      if (!entry || seen.has(guest.id)) throw new Error('Persona no válida.');
      seen.add(guest.id);
      const name = typeof guest.name === 'string' ? guest.name.trim() : '';
      if (name.length > 100 || /^[=+@-]/.test(name) || /[\r\n\t]/.test(name)) {
        throw new Error('Revisa el nombre.');
      }
      if (!['adulto', 'niño'].includes(guest.type) ||
          !['pendiente', 'sí', 'no'].includes(guest.attendance)) {
        throw new Error('Revisa el tipo y la asistencia.');
      }
      if (!name && guest.attendance === 'sí') {
        throw new Error('Completa el nombre de quienes asistirán.');
      }
      return { entry, values: [name, guest.type, guest.attendance] };
    });
    changes.forEach(({ entry, values }) => {
      sheet.getRange(entry.row, 3, 1, 3).setValues([values]);
      entry.values.splice(2, 3, ...values);
    });
    SpreadsheetApp.flush();
    return guests_(rows);
  } finally {
    lock.releaseLock();
  }
}
