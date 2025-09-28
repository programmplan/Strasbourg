(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // schedule.json vom Repo lesen (Cache-Bust)
  const res = await fetch("./data/schedule.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();

  last.textContent = `Stand: ${data.lastUpdated}`;

  // Tabelle bauen
  const table = document.createElement("table");
  table.className = "table";

  // Kopfzeile
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th")).textContent = "Zeit";
  headRow.appendChild(document.createElement("th")).textContent = "Gebetszeiten";
  data.weekdays.forEach((d) => {
    const th = document.createElement("th");
    th.textContent = d;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Body
  const tbody = document.createElement("tbody");
  data.timeslots.forEach((slot) => {
    const tr = document.createElement("tr");

    // Zeitspalte
    const timeCell = document.createElement("td");
    timeCell.textContent = slot;
    tr.appendChild(timeCell);

    // Gebetszeiten-Spalte (neben Zeit)
    const prayerCell = document.createElement("td");
    const prayer = data.prayerTimes ? data.prayerTimes[slot] : "";
    if (prayer) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = prayer;
      prayerCell.appendChild(badge);
    } else {
      prayerCell.textContent = "—";
    }
    tr.appendChild(prayerCell);

    // Tagesspalten
    data.weekdays.forEach((day) => {
      const td = document.createElement("td");
      const entry = data.entries.find((e) => e.day === day && e.slot === slot);

      if (entry) {
        const titleText = entry.title || "";
        const metaParts = [];

        if (titleText) {
          const title = document.createElement("div");
          title.innerHTML = `<strong>${titleText}</strong>`;
          td.appendChild(title);
        }

        if (entry.room) metaParts.push(`<span class="badge">${entry.room}</span>`);
        if (entry.note) metaParts.push(entry.note);

        if (metaParts.length) {
          const meta = document.createElement("div");
          meta.innerHTML = metaParts.join(" · ");
          td.appendChild(meta);
        }

        if (!titleText && metaParts.length === 0) {
          td.textContent = "—";
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
