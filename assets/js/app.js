(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // schedule.json lesen (Cache-Bust)
  const res = await fetch("./data/schedule.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  last.textContent = `Stand: ${data.lastUpdated}`;

  // ---- Türkisch-Popup Button ----
const trBtn = document.getElementById("btn-tr");

// Hilfsrenderer: einfache Tabelle ohne Merges (nur fürs Popup)
function renderSimpleTableHTML(d) {
  let html = '<table class="table"><thead><tr><th>Zaman</th>';
  d.weekdays.forEach(w => { html += `<th>${w}</th>`; });
  html += '</tr></thead><tbody>';

  d.timeslots.forEach(slot => {
    html += `<tr><td>${slot}</td>`;
    d.weekdays.forEach(day => {
      const e = d.entries.find(x => x.day === day && x.slot === slot);
      html += `<td>${e && e.title ? `<strong>${e.title}</strong>` : ""}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

async function openTurkishPopup() {
  try {
    // Türkische Version laden (siehe Ordnerstruktur unten)
    const res = await fetch("./tr/data/schedule.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("TR schedule nicht gefunden");
    const trData = await res.json();

    // Modal öffnen + HTML einsetzen
    openModal({ title: "Türkçe Program" });
    const body = document.getElementById("modal-body");
    body.innerHTML = renderSimpleTableHTML(trData) +
      `<div style="margin-top:12px;">
         <a class="btn" href="tr/">Vollständige türkische Seite →</a>
       </div>`;
  } catch (e) {
    openModal({ title: "Türkçe Program", note: "Türkische Daten nicht gefunden." });
  }
}

if (trBtn) trBtn.addEventListener("click", openTurkishPopup);


  const timeslots = data.timeslots;
  const days = data.weekdays;

  // ----- Modal-Helper (Popup) -----
  const backdrop   = document.getElementById("modal-backdrop");
  const modalTitle = document.getElementById("modal-title");
  const modalBody  = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  function openModal({ title, day, slot, room, note, prayer }) {
    if (!backdrop) return; // falls kein Modal-Markup existiert
    modalTitle.textContent = title && title.trim() ? title.trim() : "Details";

    // Body-Inhalt sicher aufbauen
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
    addRow("Raum", room && room.trim());
    addRow("Notiz", note && note.trim());

    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", escToClose);
    if (modalClose) modalClose.focus();
  }
  function closeModal() {
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", escToClose);
  }
  function escToClose(e) {
    if (e.key === "Escape") closeModal();
  }
  if (backdrop) {
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  }
  if (modalClose) {
    modalClose.addEventListener("click", closeModal);
  }

  // ----- Helfer -----
  const norm = (s) => (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’'“”"()?\-–,.:;!]/g, "") // Klammern/Anführungszeichen/Interpunktion raus
    .replace(/\s+/g, " ")
    .trim();

  const isEmptyTitle = (t) => {
    const n = norm(t);
    return !n || n === "-" || n === "";
  };

  // FARBREGELN (Titel -> Klasse)
  function colorClassFor(titleRaw) {
    const t = norm(titleRaw);

    if (!t || isEmptyTitle(t)) return ""; // nichts färben

    // GOLD
    if (/(abfahrt.*fajr|einchecken|abschluss quiz.*ausblick)/i.test(t)) return "cell-gold";

    // HELLBLAU (Vorträge allgemein + spezielle)
    // Deckt u.a. ab:
    //  - "Wie gehen wir mit dem anderen Geschlecht um?"
    //  - "Wege, der Ungerechtigkeit entgegenzuwirken (Batu)"
    if (/(koranrezitation|vortrag|rechtsschulen|sira|beweise des islams|fiqh|wer ist al amin|karriere als muslim|wege der ungerechtigkeit entgegenzuwirken batu|wie gehen wir mit dem anderen geschlecht um)/i.test(t)) {
      return "cell-blue";
    }

    // GRAU/WEISS (Mahlzeiten & Pausen)
    if (/(mittagessen|abendessen|\bpause\b|kurze pause)/i.test(t)) return "cell-gray";

    // ORANGE (reine Freizeit)
    if (/\bfreizeit\b/i.test(t)) return "cell-orange";

    // GRÜN (Freizeitaktivitäten)
    if (/(gemeinsames.*ilahi|wanderung|stadtbesichtigung|soccerhalle|workshop|gemeinsames.*(kuran|koran)\s*lesen)/i.test(t)) {
      return "cell-green";
    }

    // Fallback: nichts
    return "";
  }

  const findEntry = (day, slot) => data.entries.find(e => e.day === day && e.slot === slot);

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
    th.classList.add(`col-${d.toLowerCase()}`); // Spaltenklasse
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
      td.classList.add(`col-${day.toLowerCase()}`); // Spaltenklasse

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

        // ---- Klick für Modal aktivieren ----
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

      } // sonst leer lassen

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
})();
