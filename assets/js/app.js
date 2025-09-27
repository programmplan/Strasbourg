(async function () {
  const container = document.getElementById("timetable");
  const last = document.getElementById("last-updated");

  // schedule.json vom Repo lesen
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
  data.weekdays.forEach(d => {
    const th = document.createElement("th");
    th.textContent = d;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Body
  const tbody = document.createElement("tbody");
  data.timeslots.forEach(slot => {
    const tr = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.textContent = slot;
    tr.appendChild(timeCell);

    data.weekdays.forEach(day => {
      const td = document.createElement("td");
      const entry = data.entries.find(e => e.day === day && e.slot === slot);
      if (entry) {
        const title = document.createElement("div");
        title.innerHTML = `<strong>${entry.title}</strong>`;
        const meta = document.createElement("div");
        meta.innerHTML = `<span class="badge">${entry.room}</span>${entry.note ? " · " + entry.note : ""}`;
        td.appendChild(title);
        td.appendChild(meta);
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
