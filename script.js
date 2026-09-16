"use strict";
const config = window.WEDDING || {};
const setText = (id, value) => {
  if (!value) return;
  const element = document.getElementById(id);
  element.textContent = value;
  element.hidden = false;
};
const safeUrl = (value) => {
  try {
    const url = new URL(value, document.baseURI);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
};
const setLink = (id, value) => {
  if (!value) return;
  const url = safeUrl(value);
  if (!url) return;
  const element = document.getElementById(id);
  element.href = url;
  element.target = "_blank";
  element.rel = "noopener noreferrer";
  element.hidden = false;
};
setText("couple", config.names);
setText("ceremony", config.ceremony);
setText("party", config.party);
setText("location-info", config.locationInfo);
setText("rsvp-info", config.rsvpInfo);
setText("dress-code", config.dressCode);
setText("travel-info", config.travelInfo);
setText("countdown-message", config.countdownNote);
setLink("ceremony-map", config.ceremonyMap);
setLink("party-map", config.partyMap);
setLink("rsvp-link", config.rsvpUrl);
if (config.names) document.querySelector("footer small").textContent = `${config.names} · 10.04.2027`;
if (config.names) document.title = `${config.names} · Nuestra boda · 10 abril 2027`;
if (config.cover && safeUrl(config.cover)) {
  const img = new Image();
  img.alt = config.coverAlt || "Nuestra boda";
  img.className = "cover-photo";
  img.onload = () => {
    const cover = document.getElementById("cover");
    cover.replaceChildren(img);
    cover.hidden = false;
  };
  img.src = config.cover;
}
if (Array.isArray(config.photos) && config.photos.length) {
  const gallery = document.getElementById("gallery");
  gallery.replaceChildren();
  config.photos.forEach((photo) => {
    if (!photo.src || !safeUrl(photo.src)) return;
    const figure = document.createElement("figure");
    const img = document.createElement("img");
    img.alt = photo.alt || photo.caption || "Un recuerdo juntos";
    img.loading = "lazy";
    img.src = photo.src;
    img.addEventListener("error", () => {
      const placeholder = document.createElement("div");
      placeholder.className = "photo-placeholder";
      placeholder.textContent = "Un recuerdo por llegar";
      img.replaceWith(placeholder);
    });
    figure.append(img);
    if (photo.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = photo.caption;
      figure.append(caption);
    }
    gallery.append(figure);
  });
}
const target = new Date(config.date || "2027-04-10T00:00:00+02:00").getTime();
function updateCountdown() {
  if (!Number.isFinite(target)) {
    setText("countdown-message", "Nos vemos el 10 de abril de 2027.");
    return;
  }
  const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const values = [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24, Math.floor(remaining / 60) % 60, remaining % 60];
  ["days", "hours", "minutes", "seconds"].forEach((id, i) => setText(id, String(values[i]).padStart(2, "0")));
  if (!remaining) setText("countdown-message", "¡Ha llegado la fecha! Gracias por formar parte de nuestra historia.");
}
updateCountdown();
setInterval(updateCountdown, 1000);
