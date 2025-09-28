(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // schedule.json lesen (Cache-Bust)
  const res = await fetch("./data/schedule.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  last.textContent = `Stand: ${data.lastUpdated}`;

  const timeslots = data.timeslots;
  const days = data.weekdays;

  // Hilfen
  const findEntry = (day, slot) => data.entries.find(e => e.day === day && e.slot === slot);
  const signature = (e) => {
    if (!e) return "";
    const t = (e.title || "").trim();
    const r = (e.room || "").trim();
    const n = (e.note || "").trim();
    return (t || r || n) ? `${t}|${r}|${n}` : ""; // nur nicht-leere Einträge mergen
  };

  // Für jedes Day die Run-Längen über die Timeslots vorberechnen
  // runs[day][i] = Anzahl zusammenhängender Slots ab i (wenn Start), -1 (wenn innerhalb eines Runs), 0 (leer/kein Merge)
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

    // Gebetszeiten-Spalte
    const prayerCell = document.createElement("td");
    const prayer = data.prayerTimes ? data.prayerTimes[slot] : "";
    prayerCell.textContent = prayer ? "" : "—";
    if (prayer) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = prayer;
      prayerCell.appendChild(badge);
    }
    tr.appendChild(prayerCell);

    // Tagesspalten mit Rowspan-Merge
    days.forEach(day => {
      const run = runs[day][rowIdx];

      if (run === -1) {
        // Innerhalb eines zusammengefassten Blocks -> KEINE Zelle hier einfügen
        return;
      }

      const td = document.createElement("td");

      if (run > 1) {
        td.rowSpan = run; // vertikal zusammenfassen
      }

      const entry = findEntry(day, slot);
      if (entry && signature(entry)) {
        // Titel
        if (entry.title && entry.title.trim()) {
          const title = document.createElement("div");
          title.innerHTML = `<strong>${entry.title.trim()}</strong>`;
          td.appendChild(title);
        }

        // Meta (nur wenn vorhanden)
        const metaParts = [];
        if (entry.room && entry.room.trim()) metaParts.push(`<span class="badge">${entry.room.trim()}</span>`);
        if (entry.note && entry.note.trim()) metaParts.push(entry.note.trim());
        if (metaParts.length) {
          const meta = document.createElement("div");
          meta.innerHTML = metaParts.join(" · ");
          td.appendChild(meta);
        }
      } else {
        td.textContent = "—";
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
})();
