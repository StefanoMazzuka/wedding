const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

test('Sheet updates stay within the invitation and validate before writing', () => {
  const rows = [['code','id','name','type','attendance','position'],
    ['LOTO-ABC','1','Ana','adulto','pendiente','1'],
    ['LOTO-ABC','2','','adulto','pendiente','2'],
    ['LOTO-XYZ','3','Luis','adulto','pendiente','3']];
  let writes = 0;
  const sheet = { getDataRange: () => ({ getDisplayValues: () => rows.map(r => r.slice()) }),
    getRange: (row, col) => ({ setValues: ([values]) => { writes++; rows[row-1].splice(col-1, values.length, ...values); } }) };
  const ctx = vm.createContext({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }), flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) } });
  vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), ctx);
  assert.equal(ctx.getGuests(' loto-abc ').length, 2);
  assert.throws(() => ctx.getGuests('LOTO-BAD'));
  const updates = [{ id:'1', name:'Ana', type:'adulto', attendance:'sí' },
    { id:'2', name:'', type:'niño', attendance:'sí' }];
  assert.throws(() => ctx.saveGuests('LOTO-ABC', updates));
  updates[1].name = 'Eva'; updates[1].id = '3';
  assert.throws(() => ctx.saveGuests('LOTO-ABC', updates));
  updates[1].id = '1';
  assert.throws(() => ctx.saveGuests('LOTO-ABC', updates));
  updates[1].id = '2'; updates[1].name = '=1+1';
  assert.throws(() => ctx.saveGuests('LOTO-ABC', updates));
  assert.equal(writes, 0);
  updates[1].name = 'Eva';
  ctx.saveGuests('LOTO-ABC', updates);
  assert.equal(writes, 2);
  assert.deepEqual(rows[2], ['LOTO-ABC','2','Eva','niño','sí','2']);
  assert.equal(rows[3][4], 'pendiente');
});

test('transport validates origin/channel/source and waits for server acknowledgement', async () => {
  let receive, frame, sent;
  const peer = { postMessage: (data, origin) => { sent = { data, origin }; } };
  const ctx = vm.createContext({ URL, crypto: { getRandomValues: values => webcrypto.getRandomValues(values) }, Uint8Array, setTimeout, clearTimeout,
    location: { origin:'https://marialeystefano.com' },
    window: { addEventListener: (_, fn) => { receive = fn; }, removeEventListener() {} },
    document: { createElement: () => ({ remove() {} }), body: { append: el => { frame = el; } } } });
  vm.runInContext(fs.readFileSync('guests.js','utf8').split('const requestGuests =')[0], ctx);
  const request = ctx.createGuestsConnection('https://script.google.com/macros/s/test/exec');
  const promise = request('read','LOTO-ABC');
  const channel = new URL(frame.src).searchParams.get('channel');
  assert.ok(!frame.src.includes('LOTO-ABC'));
  const origin = 'https://test-script.googleusercontent.com';
  const ready = { app:'wedding-guests', channel, ready:true };
  receive({ origin:'https://evil.example', source:peer, data:ready });
  await Promise.resolve();
  assert.equal(sent, undefined);
  receive({ origin, source:peer, data:{ ...ready, channel:'wrong' } });
  await Promise.resolve();
  assert.equal(sent, undefined);
  receive({ origin, source:peer, data:ready });
  await Promise.resolve();
  assert.equal(sent.data.code, 'LOTO-ABC');
  assert.equal(sent.origin, origin);
  let completed = false;
  promise.then(() => { completed = true; });
  const data = { app:'wedding-guests', channel, id:sent.data.id, guests:[{ id:'1' }] };
  receive({ origin, source:{}, data });
  await Promise.resolve();
  assert.equal(completed, false);
  receive({ origin, source:peer, data });
  assert.equal((await promise)[0].id, '1');
  const save = request('save','LOTO-ABC',[]);
  await Promise.resolve();
  receive({ origin, source:peer, data:{ ...data, id:sent.data.id, error:'Nombre obligatorio' } });
  await assert.rejects(save, /Nombre obligatorio/);
});

test('bridge only calls read/write for the configured parent and channel', () => {
  let receive, called = 0;
  const top = { postMessage() {} };
  const runner = { withSuccessHandler() { return this; }, withFailureHandler() { return this; },
    getGuests() { called++; }, saveGuests() { called++; } };
  const ctx = vm.createContext({ window:{ top, addEventListener: (_, fn) => { receive = fn; } }, google:{ script:{ run:runner } } });
  const script = fs.readFileSync('apps-script/Bridge.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace('<?= origin ?>','https://marialeystefano.com').replace('<?= channel ?>','abc');
  vm.runInContext(script, ctx);
  const event = { source:top, origin:'https://marialeystefano.com',
    data:{ app:'wedding-guests', channel:'abc', id:'1', action:'read', code:'LOTO-ABC' } };
  receive({ ...event, origin:'https://evil.example' });
  receive({ ...event, source:{} });
  receive({ ...event, data:{ ...event.data, channel:'wrong' } });
  assert.equal(called, 0);
  receive(event);
  assert.equal(called, 1);
});

test('public petals expose confirmed names and sheet-sized capacity, never codes', () => {
  const rows = [['code','id','name','type','attendance','position'],
    ['LOTO-ABC','1','Ana','adulto','sí','1'],
    ['LOTO-ABC','2','Eva','niño','pendiente','2'],
    ['LOTO-XYZ','3','Luis','adulto','no','3']];
  const ctx = vm.createContext({ SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({
    getDataRange: () => ({ getDisplayValues: () => rows })
  }) }) } });
  vm.runInContext(fs.readFileSync('apps-script/Code.gs','utf8'), ctx);
  const result = () => JSON.parse(JSON.stringify(ctx.getPetals()));
  assert.deepEqual(result(), {total:3,petals:[{position:1,name:'Ana'}]});
  rows[1][4] = 'no';
  assert.deepEqual(result(), {total:3,petals:[]});
  rows[2][4] = 'sí';
  assert.deepEqual(result(), {total:3,petals:[{position:2,name:'Eva'}]});
  rows[3][5] = '4';
  assert.throws(result, /posición única/);
  rows[3][5] = '2';
  assert.throws(result, /posición única/);
});

test('branch adds and removes petals without moving existing positions', () => {
  class Element {
    constructor() { this.children=[]; this.dataset={}; this.style={}; this.attrs={}; }
    setAttribute(key,value) { this.attrs[key]=value; if(key==='data-position')this.dataset.position=value; }
    addEventListener() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children=children; }
    querySelectorAll() { return this.children.flatMap(c => [...(c.dataset.position ? [c] : []), ...c.querySelectorAll()]); }
  }
  const svg=new Element();
  let change;
  const media = {matches:false, addEventListener: (_, fn) => { change=fn; }};
  const ctx=vm.createContext({window:{matchMedia:()=>media}, document:{getElementById:()=>svg,createElementNS:()=>new Element()}});
  vm.runInContext(fs.readFileSync('branch.js','utf8'),ctx);
  const draw=(positions, total=77)=>ctx.window.renderWeddingBranch(positions.map(position=>({position,name:'Guest '+position})),total);
  draw([]); assert.equal(svg.querySelectorAll().length,0);
  draw([1,2,77]);
  const original=svg.querySelectorAll().find(el=>el.dataset.position===77).attrs.transform;
  draw([2,77]);
  assert.deepEqual(svg.querySelectorAll().map(el=>el.dataset.position),[2,77]);
  assert.equal(svg.querySelectorAll().find(el=>el.dataset.position===77).attrs.transform,original);
  media.matches=true;
  change();
  assert.equal(svg.attrs.viewBox, '0 0 380 774');
  assert.equal(svg.style.minWidth, '0');
  assert.equal(svg.querySelectorAll().find(el=>el.dataset.position===77).attrs.transform,original);
  media.matches=false;
  change();
  assert.equal(svg.attrs.viewBox, '0 0 774 380');
  const legacyMedia = { matches: true, addListener(fn) { change = fn; } };
  const legacy = vm.createContext({window:{matchMedia:()=>legacyMedia}, document:{getElementById:()=>svg,createElementNS:()=>new Element()}});
  vm.runInContext(fs.readFileSync('branch.js','utf8'), legacy);
  legacy.window.renderWeddingBranch([],77);
  assert.equal(svg.attrs.viewBox, '0 0 380 774');
  draw([77,120],120);
  assert.equal(svg.querySelectorAll().find(el=>el.dataset.position===77).attrs.transform,original);
});
