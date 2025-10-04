(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // schedule.json lesen (Cache-Bust)
  const res = await fetch("./data/schedule.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  last.textContent = `Stand: ${data.lastUpdated}`;

  const timeslots = data.timeslots;
  const days = data.weekdays;

  // ----- Modal-Helper (Popup) -----
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

  function openModal({ title, day, slot, room, note, prayer, size = "md" }) {
    if (!backdrop) return;
    setModalSize(size);
    modalTitle.textContent = title && title.trim() ? title.trim() : "Details";

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
    addRow("Raum", room && room?.trim());
    addRow("Notiz", note && note?.trim());

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

  // ----- Helfer -----
  // Türkische Sonderzeichen -> ASCII, dann normalisieren
  const TR_MAP = { "ç":"c", "ğ":"g", "ı":"i", "ö":"o", "ş":"s", "ü":"u" };
  const norm = (s) => (s || "")
    .toString()
    .toLowerCase()
    .replace(/[çğışöü]/g, ch => TR_MAP[ch])   // TR letters
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")         // Diakritika
    .replace(/[’'“”"()?\-–,.:;!]/g, "")      // Interpunkt.
    .replace(/\s+/g, " ")
    .trim();

  // Slug für Spaltenklassen (funktioniert für DE & TR)
  const daySlug = (s) => norm(s).replace(/\s+/g, "-");

  const isEmptyTitle = (t) => {
    const n = norm(t);
    return !n || n === "-" || n === "";
  };

  // FARBREGELN (Titel -> Klasse)  DE + TR
// FARBREGELN (Titel -> Klasse)  DE + TR
function colorClassFor(titleRaw) {
  const t = norm(titleRaw);
  if (!t || isEmptyTitle(t)) return "";

  // GOLD (Abfahrt/Check-in + Abschluss)
  if (/(abfahrt.*fajr|einchecken|check ?in|sabah.*fecir.*hareket|varis.*check ?in|kapanis quiz.*(vedalas|degerlendirme|ausblick)?)/i.test(t)) {
    return "cell-gold";
  }

  // SPEZIELLER MATCH für:
  // - "Wege der (Un)Gerechtigkeit entgegenzuwirken (Batu)"
  // - "Haksızlığa karşı koyma yolları (Batu)"
  //   (nach Normalisierung: haksizliga / haksizlik ... karsi ... koyma ... yollar)
  if (/(wege.*(un)?gerechtigkeit.*entgegenzuwirken(\s*batu)?|haksizl\w*.*karsi.*koyma.*yollar\w*(\s*batu)?)/i.test(t)) {
    return "cell-blue";
  }

  // HELLBLAU (Vorträge & Rezitationen allgemein)
  if (/(koranrezitation|kuran tilaveti|vortrag|konferans|rechtsschulen|dort mezhep|sira|siyer|beweise des islams|islamin delilleri|fiqh|fikih|wer ist al amin|el emin kimdir|karriere als muslim|musluman olarak kariyer|wie gehen wir mit dem anderen geschlecht um)/i.test(t)) {
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


  const findEntry = (day, slot) =>
  data.entries.find(e => daySlug(e.day) === daySlug(day) && e.slot === slot);


  // gleiche Einträge mergen (nur nicht-leere)
  const signature = (e) => {
    if (!e || (isEmptyTitle(e.title) && isEmptyTitle(e.room) && isEmptyTitle(e.note))) return "";
    const t = norm(e.title);
    const r = norm(e.room);
    const n = norm(e.note);
    return `${t}|${r}|${n}`;
  };

  // Runs je Tag vorberechnen
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

  // Tabelle bauen
  const table = document.createElement("table");
  table.className = "table";

  // Kopfzeile
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th")).textContent = "Zeit";
  headRow.appendChild(document.createElement("th")).textContent = "Gebetszeiten";
  days.forEach(d => {
    const th = document.createElement("th");
    th.textContent = d;
    th.classList.add(`col-${daySlug(d)}`); // Spaltenklasse (slug)
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Body
  const tbody = document.createElement("tbody");
  timeslots.forEach((slot, rowIdx) => {
    const tr = document.createElement("tr");

    // Zeitspalte
    const timeCell = document.createElement("td");
    timeCell.textContent = slot;
    tr.appendChild(timeCell);

    // Gebetszeiten-Spalte (leer wenn nichts)
    const prayerCell = document.createElement("td");
    const prayer = data.prayerTimes ? data.prayerTimes[slot] : "";
    if (prayer) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = prayer;
      prayerCell.appendChild(badge);
    }
    tr.appendChild(prayerCell);

    // Tagesspalten mit Rowspan-Merge + Farblogik
    days.forEach(day => {
      const run = runs[day][rowIdx];
      if (run === -1) return; // innerhalb eines Blocks -> keine Zelle rendern

      const td = document.createElement("td");
      td.classList.add(`col-${daySlug(day)}`); // Spaltenklasse (slug)

      if (run > 1) td.rowSpan = run; // vertikal zusammenfassen

      const entry = findEntry(day, slot);

      if (entry && signature(entry)) {
        // Farbe vergeben (nach Titel)
        const cls = colorClassFor(entry.title);
        if (cls) td.classList.add(cls);

        // Titel
        if (!isEmptyTitle(entry.title)) {
          const title = document.createElement("div");
          title.innerHTML = `<strong>${entry.title.trim()}</strong>`;
          td.appendChild(title);
        }

        // Meta (nur wenn vorhanden)
        const metaParts = [];
        if (!isEmptyTitle(entry.room)) metaParts.push(`<span class="badge">${entry.room.trim()}</span>`);
        if (!isEmptyTitle(entry.note)) metaParts.push(entry.note.trim());
        if (metaParts.length) {
          const meta = document.createElement("div");
          meta.innerHTML = metaParts.join(" · ");
          td.appendChild(meta);
        }

        // Klick für Modal (falls genutzt)
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

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
})();
