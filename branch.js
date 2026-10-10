"use strict";

const SHOOT_SPACING = 72;
const PETAL_LEVEL_SPACING = 17;

// Fuller shoots at the base taper in pairs towards the couple at the tip.
function shootCapacity(shoot) {
  return Math.max(6, 16 - 2 * Math.ceil(shoot / 2));
}

function shootCounts(total) {
  const counts = [];
  let remaining = Math.max(0, total - 2);
  while (remaining > 0) {
    const count = Math.min(shootCapacity(counts.length), remaining);
    counts.push(count);
    remaining -= count;
  }
  return counts;
}
function petalPlacement(position, shoots, total) {
  if (position === 1 || position === 2) {
    return {
      x: 140 + shoots * SHOOT_SPACING,
      y: 220 - (shoots % 8) * 8,
      scale: 1.45,
      angle: position === 1 ? 55 : 125
    };
  }
  let slot = position - 3;
  let shoot = 0;
  while (slot >= shootCapacity(shoot)) {
    slot -= shootCapacity(shoot);
    shoot++;
  }
  const side = shoot % 2 === 0 ? -1 : 1;
  const level = Math.floor(slot / 2);
  const flank = slot % 2 === 0 ? -1 : 1;
  const baseX = 140 + shoot * SHOOT_SPACING;
  const baseY = 220 - (shoot % 8) * 8;
  return {
    x: baseX + 8 + level * 7 + flank * 5,
    y: baseY + side * (22 + level * PETAL_LEVEL_SPACING),
    // Stable variation keeps each petal the same size after a refresh.
    scale: 0.84 + ((position * 7) % 11) * 0.03,
    angle: flank * (48 + level * 2) + (side === 1 ? 180 : 0)
  };
}

const branchMobile = window.matchMedia('(max-width: 600px)');
let lastBranch;
const updateBranchLayout = () => {
  if (lastBranch) window.renderWeddingBranch(lastBranch.entries, lastBranch.total);
};
if (branchMobile.addEventListener) branchMobile.addEventListener('change', updateBranchLayout);
else branchMobile.addListener(updateBranchLayout);

window.renderWeddingBranch = function (entries, total) {
  lastBranch = { entries, total };
  const svg = document.getElementById('guest-branch');
  const ns = 'http://www.w3.org/2000/svg';
  const node = (tag, attributes) => {
    const element = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  };
  const valid = entries.filter(p => Number.isSafeInteger(p.position) && p.position > 0 && p.position <= total);
  const previous = new Set(Array.from(svg.querySelectorAll('[data-position]'), el => Number(el.dataset.position)));
  const counts = shootCounts(total);
  const shoots = counts.length;
  const width = Math.max(360, 200 + shoots * SHOOT_SPACING);
  const vertical = branchMobile.matches;
  svg.setAttribute('viewBox', vertical ? `0 0 380 ${width}` : `0 0 ${width} 380`);
  // Keep tall guest lists legible: extend horizontally rather than shrinking petals.
  svg.style.minWidth = vertical ? '0' : `${Math.min(width, Math.max(360, width * .85))}px`;
  const title = node('title', { id: 'branch-description' });
  title.textContent = valid.length ? `Rama con ${valid.length} pétalos de asistencia confirmada` : 'Rama todavía sin pétalos';
  const wood = node('g', { class: 'branch-wood', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  // Each shoot ends just beyond its outermost pair of petals.
  let path = 'M 30 300 Q 68 260 140 220';
  for (let i = 1; i <= shoots; i++) {
    const x = 140 + i * SHOOT_SPACING;
    const y = 220 - (i % 8) * 8;
    path += ` Q ${x - 55} ${y + 5} ${x} ${y}`;
  }
  wood.append(node('path', { d: path, 'stroke-width': 4 }));
  for (let i = 0; i < shoots; i++) {
    const x = 140 + i * SHOOT_SPACING;
    const y = 220 - (i % 8) * 8;
    const side = i % 2 === 0 ? -1 : 1;
    const count = counts[i];
    const levels = Math.ceil(count / 2);
    const length = 22 + (levels - 1) * PETAL_LEVEL_SPACING + 9;
    const tipX = 8 + (levels - 1) * 7 + 4;
    wood.append(node('path', { d: `M ${x} ${y} Q ${x + tipX * .7} ${y + side * length * .45} ${x + tipX} ${y + side * length}`, 'stroke-width': 1.8 }));
    for (let j = 0; j < levels; j++) {
      const py = y + side * (22 + j * PETAL_LEVEL_SPACING);
      const px = x + 8 + j * 7;
      wood.append(node('path', { d: `M ${px - 9} ${py + side * 7} Q ${px} ${py + side * 2} ${px + 9} ${py - side * 6}`, 'stroke-width': .8 }));
    }
  }
  const petals = node('g', { class: 'branch-petals' });
  valid.forEach(({ position, name }) => {
    const place = petalPlacement(position, shoots, total);
    const group = node('g', { transform: `translate(${place.x} ${place.y}) rotate(${place.angle}) scale(${place.scale})`, 'data-position': position, tabindex: '0', role: 'button', 'aria-label': name || 'Invitado confirmado' });
    const label = node('title', {});
    label.textContent = name || 'Invitado confirmado';
    group.append(label);
    const showName = () => {
      const tooltip = document.getElementById('petal-name');
      tooltip.textContent = name || 'Invitado confirmado';
    };
    const hideName = () => { document.getElementById('petal-name').textContent = ''; };
    group.addEventListener('mouseenter', showName);
    group.addEventListener('mouseleave', hideName);
    group.addEventListener('focus', showName);
    group.addEventListener('blur', hideName);
    group.addEventListener('click', showName);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showName(); }
      if (event.key === 'Escape') hideName();
    });
    group.append(node('path', { d: 'M 0 0 C -16 -10 -15 -27 0 -39 C 15 -27 16 -10 0 0 Z', class: previous.has(position) ? 'branch-petal' : 'branch-petal blooming' }));
    group.append(node('path', { d: 'M 0 -3 Q -2 -18 0 -32', class: 'petal-vein', fill: 'none' }));
    petals.append(group);
  });
  document.getElementById('petal-name').textContent = '';
  const drawing = node('g', vertical ? { transform: `translate(0 ${width}) rotate(-90)` } : {});
  drawing.append(wood, petals);
  svg.replaceChildren(title, drawing);
};
