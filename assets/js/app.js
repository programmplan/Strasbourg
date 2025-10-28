(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // ---- Daten laden (Cache-Bust) ----
  const res = await fetch("./data/schedule.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  last.textContent = `Stand: ${data.lastUpdated}`;

  const timeslots = data.timeslots || [];
  const days = data.weekdays || [];

  // -------------------------------------------------
  // Modal-Helfer (Popup für Zellen-Details – optional)
  // -------------------------------------------------
  const backdrop   = document.getElementById("modal-backdrop");
  const modalTitle = document.getElementById("modal-title");
  const modalBody  = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");
  const modalEl    = document.querySelector("#modal-backdrop .modal");

  function setModalSize(preset = "md") {
    if (!modalEl) return;
    modalEl.classList.remove("modal--full");
    if (preset === "full") modalEl.classList.add("modal--full");
  }

  // "Sa, 20.12.2025" -> { day: "Sa", date: "20.12.2025" }
function splitDayAndDate(s) {
  const raw = String(s || "");
  // 1) Wenn ein Komma drin ist, trenne daran
  if (raw.includes(",")) {
    const [day, ...rest] = raw.split(",");
    return { day: day.trim(), date: rest.join(",").trim() };
  }
  // 2) Sonst Datum per Regex finden
  const m = raw.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
  if (m) {
    const date = m[1];
    const day = raw.replace(date, "").replace(",", "").trim();
    return { day, date };
  }
  // 3) Fallback: nur Tag anzeigen
  return { day: raw.trim(), date: "" };
}


  function openModal({ title, day, slot, room, note, prayer, size = "md" }) {
    if (!backdrop) return; // Wenn kein Modal in der Seite ist, einfach nichts tun
    setModalSize(size);
    modalTitle.textContent = title && String(title).trim() ? String(title).trim() : "Details";

    modalBody.innerHTML = "";
    const addRow = (label, value) => {
      if (!value) return;
      const row = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      const span = document.createElement("span");
      span.textContent = value;
      row.appendChild(strong);
      row.appendChild(span);
      modalBody.appendChild(row);
    };
    addRow("Tag", day);
    addRow("Zeit", slot);
    addRow("Gebet", prayer);
    addRow("Raum", room && String(room).trim());
    addRow("Notiz", note && String(note).trim());

    document.body.classList.add("modal-open");
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", escToClose);
    if (modalClose) modalClose.focus();
  }
  function closeModal() {
    if (!backdrop) return;
    document.body.classList.remove("modal-open");
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", escToClose);
  }
  function escToClose(e) { if (e.key === "Escape") closeModal(); }
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  if (modalClose) modalClose.addEventListener("click", closeModal);

  // ---------------------------
  // Normalisierung & Keys
  // ---------------------------
  // Türkische Sonderzeichen -> ASCII und generelle Bereinigung
  const TR_MAP = { "ç":"c", "ğ":"g", "ı":"i", "ö":"o", "ş":"s", "ü":"u" };
  const norm = (s) => (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/[çğışöü]/g, ch => TR_MAP[ch])    // TR Zeichen ersetzen
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")          // Diakritika entfernen
    .replace(/[’'“”"()?\-–,.:;!]/g, " ")      // Interpunktion -> Leerzeichen
    .replace(/\s+/g, " ")
    .trim();

  // Sprach-/format-unabhängiger Day-Key (DE/TR, mit/ohne Datum)
  // Mapped alles auf: sat, sun, mon, tue, wed
  function dayKey(s) {
    const n = norm(s || "");
    // Falls "Sa, 20.12.2025" → nur Teil vor erstem Komma/Datum nehmen
    const first = n.split(" ")[0]; // nach Norm sind Kommas entfernt → Datum steht als eigener Token, wir nehmen den 1. Token
    // Deutsche Varianten (abgekürzt & ausgeschrieben)
    if (/^(sa|samstag)$/.test(first)) return "sat";
    if (/^(so|sonntag)$/.test(first)) return "sun";
    if (/^(mo|montag)$/.test(first)) return "mon";
    if (/^(di|dienstag)$/.test(first)) return "tue";
    if (/^(mi|mittwoch)$/.test(first)) return "wed";
    // Türkische Varianten
    if (/^(cumartesi)$/.test(first)) return "sat";
    if (/^(pazar)$/.test(first)) return "sun";
    if (/^(pazartesi)$/.test(first)) return "mon";
    if (/^(sali)$/.test(first)) return "tue";       // Salı
    if (/^(carsamba)$/.test(first)) return "wed";   // Çarşamba
    return first || n; // Fallback
  }

  // Für CSS-Spaltenklasse stabil (gleich für DE & TR & mit Datum)
  const colClass = (d) => `col-${dayKey(d)}`;

  const isEmpty = (x) => !x || !String(x).trim();
  const isEmptyTitle = (t) => {
    const n = norm(t);
    return !n || n === "-" || n === "";
  };

  // -----------------------------------------
  // Farben / Kategorien (DE + TR Begriffe)
  // -----------------------------------------
  function colorClassFor(titleRaw) {
    const t = norm(titleRaw);
    if (!t || isEmptyTitle(t)) return "";

    // GOLD (Abfahrt/Check-in + Abschluss)
    if (/(abfahrt.*fajr|einchecken|check ?in|sabah.*fecir.*hareket|varis.*check ?in|kapanis quiz.*(vedalas|degerlendirme|ausblick)?)/i.test(t)) {
      return "cell-gold";
    }

    // SPEZIFISCH: Wege der (Un)Gerechtigkeit / Haksızlığa karşı koyma yolları
    if (/(wege.*(un)?gerechtigkeit.*entgegenzuwirken(\s*batu)?|haksizl\w*.*karsi.*koyma.*yollar\w*(\s*batu)?)/i.test(t)) {
      return "cell-blue";
    }

    // HELLBLAU (Vorträge & Rezitationen allgemein)
    if (/(koranrezitation|kuran tilaveti|vortrag|konferans|rechtsschulen|dort mezhep|sira|siyer|beweise des islams|islamin delilleri|fiqh|fikih|wer ist al amin|el emin kimdir|karriere als muslim|musluman olarak kariyer|wie gehen wir mit dem anderen geschlecht um|karsi cinsle nasil iletisim kurariz)/i.test(t)) {
      return "cell-blue";
    }

    // GRAU/WEISS (Mahlzeiten & Pausen)
    if (/(mittagessen|ogle yemegi|abendessen|aksam yemegi|\bpause\b|\bmola\b|kurze pause|kisa mola)/i.test(t)) {
      return "cell-gray";
    }

    // ORANGE (Freizeit)
    if (/(\bfreizeit\b|serbest zaman)/i.test(t)) {
      return "cell-orange";
    }

    // GRÜN (Aktivitäten)
    if (/(gemeinsames.*ilahi|birlikte.*ilahi|wanderung|yuruyus|stadtbesichtigung|sehir turu|soccerhalle|hali saha|workshop|atolye|gemeinsames.*(kuran|koran).*lesen|birlikte.*(kuran|koran).*okuma)/i.test(t)) {
      return "cell-green";
    }

    return "";
  }

  // -----------------------------------------
  // Daten-Zugriff
  // -----------------------------------------
  const findEntry = (day, slot) =>
    (data.entries || []).find(e => dayKey(e.day) === dayKey(day) && e.slot === slot);

  // gleiche Einträge mergen (nur nicht-leere)
  const signature = (e) => {
    if (!e || (isEmptyTitle(e.title) && isEmptyTitle(e.room) && isEmptyTitle(e.note))) return "";
    const t = norm(e.title);
    const r = norm(e.room);
    const n = norm(e.note);
    return `${t}|${r}|${n}`;
  };

  // Runs je Tag vorberechnen (für Rowspan)
  const runs = {};
  days.forEach(day => {
    const arr = new Array(timeslots.length).fill(0);
    let i = 0;
    while (i < timeslots.length) {
      const e = findEntry(day, timeslots[i]);
      const sig = signature(e);
      if (!sig) { i++; continue; }
      let len = 1;
      while (i + len < timeslots.length) {
        const e2 = findEntry(day, timeslots[i + len]);
        if (signature(e2) !== sig) break;
        len++;
      }
      arr[i] = len;
      for (let k = 1; k < len; k++) arr[i + k] = -1;
      i += len;
    }
    runs[day] = arr;
  });

  // -----------------------
  // Tabelle rendern
  // -----------------------
  const table = document.createElement("table");
  table.className = "table";

// Kopfzeile
const thead = document.createElement("thead");
const headRow = document.createElement("tr");
headRow.appendChild(document.createElement("th")).textContent = "Zeit";
headRow.appendChild(document.createElement("th")).textContent = "Gebetszeiten";

days.forEach(d => {
  const th = document.createElement("th");
  const { day: wd, date } = splitDayAndDate(d);
  th.innerHTML = `<div class="day-top">${wd}</div>${date ? `<div class="day-bottom">${date}</div>` : ""}`;
  th.classList.add(colClass(d)); // deine bestehende Spaltenklasse
  headRow.appendChild(th);
});

thead.appendChild(headRow);


  // Body
  const tbody = document.createElement("tbody");
  timeslots.forEach((slot, rowIdx) => {
    const tr = document.createElement("tr");

    // Zeit
    const timeCell = document.createElement("td");
    timeCell.textContent = slot;
    tr.appendChild(timeCell);

    // Gebetszeiten (nur anzeigen, wenn vorhanden)
    const prayerCell = document.createElement("td");
    const prayer = data.prayerTimes ? data.prayerTimes[slot] : "";
    if (!isEmpty(prayer)) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = prayer;
      prayerCell.appendChild(badge);
    }
    tr.appendChild(prayerCell);

    // Tagesspalten
    days.forEach(day => {
      const run = runs[day][rowIdx];
      if (run === -1) return; // innerhalb eines Merges → keine zusätzliche Zelle

      const td = document.createElement("td");
      td.classList.add(colClass(day)); // stabile Spaltenklasse

      if (run > 1) td.rowSpan = run;

      const entry = findEntry(day, slot);

      if (entry && signature(entry)) {
        // Farbe vergeben
        const cls = colorClassFor(entry.title);
        if (cls) td.classList.add(cls);

        // Titel (nur wenn nicht leer)
        if (!isEmptyTitle(entry.title)) {
          const titleEl = document.createElement("div");
          titleEl.innerHTML = `<strong>${String(entry.title).trim()}</strong>`;
          td.appendChild(titleEl);
        }

        // Meta (Raum/Notiz) nur wenn vorhanden
        const metaParts = [];
        if (!isEmpty(entry.room)) metaParts.push(`<span class="badge">${String(entry.room).trim()}</span>`);
        if (!isEmpty(entry.note)) metaParts.push(String(entry.note).trim());
        if (metaParts.length) {
          const meta = document.createElement("div");
          meta.innerHTML = metaParts.join(" · ");
          td.appendChild(meta);
        }

        // Optional: Klick → Modal öffnen
        if (backdrop) {
          td.classList.add("is-clickable");
          td.tabIndex = 0;
          const prayerText = data.prayerTimes ? data.prayerTimes[slot] : "";
          const open = () => openModal({
            title: entry.title,
            day,
            slot,
            room: entry.room,
            note: entry.note,
            prayer: prayerText
          });
          td.addEventListener("click", open);
          td.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); }
          });
        }
      }
      // else: Zelle bleibt leer (kein "—")

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
})();
