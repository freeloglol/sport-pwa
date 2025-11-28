//---------------------------------------------
// SERVICE WORKER
//---------------------------------------------
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}

//---------------------------------------------
// CONFIG DU PROGRAMME
//---------------------------------------------

const MAX_SERIES = 20;
const MAX_REPS = 30;
const MAX_VOLUME = 300;
const MAX_KM = 30;

const BASE = {
    series: 3,
    reps: 10,
    km: 4
};

const EXERCISES = [
    "Pompes inclinées",
    "Crunchs croisés",
    "Gainage dynamique (sec)",
    "Dips",
    "Russian twist"
];

//---------------------------------------------
// LOCAL STORAGE HELPERS
//---------------------------------------------
function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback = null) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
}

//---------------------------------------------
// VACANCES SYSTEM
//---------------------------------------------
function isVacationDate(dayIndex) {
    const vac = load("vacances", []);
    return vac.includes(dayIndex);
}

function addVacationRange(start, end) {
    let vac = load("vacances", []);
    for (let i = start; i <= end; i++) {
        vac.push(i);
    }
    vac = [...new Set(vac)];
    save("vacances", vac);
}

//---------------------------------------------
// PROGRESSION AUTO
//---------------------------------------------
function getWeekData(week, exerciseName) {

    // Vérifie si modif manuelle
    const manual = load("manual-" + exerciseName + "-week-" + week);
    if (manual) return manual;

    // SERIES (+2 par semaine)
    let series = BASE.series + (week - 1) * 2;
    series = Math.min(series, MAX_SERIES);

    // REPS progression
    let reps;
    if (week <= 6) {
        reps = BASE.reps + (week - 1) * 2;
    } else {
        reps = (BASE.reps + 10) + (week - 7);
    }
    reps = Math.min(reps, MAX_REPS);

    // KM progression
    let km;
    if (week <= 6) {
        km = BASE.km + (week - 1) * 2;
    } else {
        km = 14 + Math.floor((week - 6) / 2) * 2;
    }
    km = Math.min(km, MAX_KM);

    // Volume max
    if (series * reps > MAX_VOLUME) {
        reps = Math.floor(MAX_VOLUME / series);
    }

    return { series, reps, km };
}

//---------------------------------------------
// PROGRAMME COMPLET
//---------------------------------------------
function generateDay(week, day) {
    const restDays = [3, 6];
    if (restDays.includes(day)) {
        return { type: "rest" };
    }

    const exercises = EXERCISES.map(name => {
        const d = getWeekData(week, name);
        return {
            name,
            series: d.series,
            reps: d.reps
        };
    });

    const km = getWeekData(week, "km").km;

    return {
        type: "train",
        exercises,
        km
    };
}

function generateProgram(weeks = 52) {
    const program = [];
    for (let w = 1; w <= weeks; w++) {
        const week = [];
        for (let d = 1; d <= 7; d++) {
            week.push(generateDay(w, d));
        }
        program.push(week);
    }
    return program;
}

const PROGRAM = generateProgram();

//---------------------------------------------
// JOUR ACTUEL DU PROGRAMME
//---------------------------------------------
function getCurrentDay() {
    return load("programDay", 0);
}

function markDone(index) {
    save("done-" + index, true);
}

//---------------------------------------------
// PAGE AUJOURD’HUI
//---------------------------------------------
function renderToday() {
    const container = document.getElementById("todayContent");
    container.innerHTML = "";

    let dayIndex = getCurrentDay();

    // Skip vacances
    while (isVacationDate(dayIndex)) {
        dayIndex++;
    }

    const week = Math.floor(dayIndex / 7) + 1;
    const day = (dayIndex % 7) + 1;

    const data = PROGRAM[week - 1][day - 1];

    if (data.type === "rest") {
        container.innerHTML = `<p>Jour de repos 😴</p>`;
        return;
    }

    data.exercises.forEach(exo => {
        container.innerHTML += `
            <div class="exercise-card">
                <h3>${exo.name}</h3>
                <p>${exo.series} séries × ${exo.reps} reps</p>
                <button class="btn-secondary" onclick="openEdit('${exo.name}', ${week})">Modifier</button>
            </div>
        `;
    });

    container.innerHTML += `
        <div class="exercise-card">
            <h3>Course / Marche</h3>
            <p>${data.km} km</p>
        </div>
    `;

    const done = load("done-" + dayIndex, false);

    container.innerHTML += `
        <button class="finish-btn" id="finishBtn" ${done ? "disabled" : ""}>
            ${done ? "Déjà validé ✔" : "Terminer la séance"}
        </button>
    `;

    if (!done) {
        document.getElementById("finishBtn").onclick = () => {
            markDone(dayIndex);
            save("programDay", dayIndex + 1);
            renderToday();
            renderCalendar();
        };
    }
}

//---------------------------------------------
// POPUP MODIFICATION
//---------------------------------------------
let currentEditExercise = null;
let currentEditWeek = null;

function openEdit(name, week) {
    currentEditExercise = name;
    currentEditWeek = week;

    const base = getWeekData(week, name);

    document.getElementById("popupEditTitle").textContent = name;
    document.getElementById("editSeries").value = base.series;
    document.getElementById("editReps").value = base.reps;

    document.getElementById("popupEdit").classList.remove("hidden");
}

document.getElementById("cancelEdit").onclick = () => {
    document.getElementById("popupEdit").classList.add("hidden");
};

document.getElementById("saveEdit").onclick = () => {
    const s = parseInt(document.getElementById("editSeries").value);
    const r = parseInt(document.getElementById("editReps").value);

    const manual = { series: s, reps: r, km: getWeekData(currentEditWeek, "km").km };
    save("manual-" + currentEditExercise + "-week-" + currentEditWeek, manual);

    document.getElementById("popupEdit").classList.add("hidden");
    renderToday();
    renderCalendar();
};

//---------------------------------------------
// NOUVEAU CALENDRIER (VRAI MOIS + RONDS)
//---------------------------------------------

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0=janvier

const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];
//---------------------------------------------
// RENDER CALENDAR MONTH VIEW
//---------------------------------------------
function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay(); // 0=dimanche
}

// Convertit dimanche→7 pour aligner lundi=1
function correctDay(d) {
    return d === 0 ? 7 : d;
}

function renderCalendar() {
    const container = document.getElementById("calendarContent");
    container.innerHTML = "";

    const totalDays = daysInMonth(currentYear, currentMonth);
    const startDay = correctDay(firstDayOfMonth(currentYear, currentMonth)); // 1 à 7

    // Header mois
    document.querySelector("#page-calendar h1").innerHTML = `
        <button class="monthBtn" onclick="prevMonth()">◀</button>
        ${monthNames[currentMonth]} ${currentYear}
        <button class="monthBtn" onclick="nextMonth()">▶</button>
    `;

    // Ligne des jours
    const daysHeader = `
        <div class="calendar-row header">
            <div>L</div><div>M</div><div>M</div><div>J</div>
            <div>V</div><div>S</div><div>D</div>
        </div>
    `;
    container.innerHTML += daysHeader;

    // Grille du mois
    let html = '<div class="calendar-grid">';

    // Cases vides avant le 1
    for (let i = 1; i < startDay; i++) {
        html += `<div class="day empty"></div>`;
    }

    const today = new Date();

    for (let day = 1; day <= totalDays; day++) {
        let css = "day bubble";

        // Convertit ce jour du mois en index du programme
        let globalIndex = getGlobalDayIndex(currentYear, currentMonth, day);

        // JOUR ACTUEL
        if (
            currentYear === today.getFullYear() &&
            currentMonth === today.getMonth() &&
            day === today.getDate()
        ) {
            css += " currentDay";
        }

        // Séance terminée
        if (load("done-" + globalIndex)) css += " doneDay";

        // Vacances
        if (isVacationDate(globalIndex)) css += " vacDay";

        // Repos
        const w = Math.floor(globalIndex / 7) + 1;
        const d = (globalIndex % 7) + 1;
        if (PROGRAM[w - 1][d - 1].type === "rest") css += " restDay";

        html += `
        <div class="${css}" onclick="openDayPopup(${globalIndex})">
            ${day}
        </div>`;
    }

    html += "</div>";
    container.innerHTML += html;
}

//---------------------------------------------
// MATH POUR LIER CALENDRIER ↔ PROGRAMME
//---------------------------------------------
function getGlobalDayIndex(year, month, day) {
    const now = new Date(year, month, day);
    const start = new Date(currentYear, currentMonth, 1);

    const diff = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);

    return diff;
}

//---------------------------------------------
// CHANGER DE MOIS
//---------------------------------------------
function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
}

function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

//---------------------------------------------
// POPUP JOUR
//---------------------------------------------
function openDayPopup(index) {
    const w = Math.floor(index / 7) + 1;
    const d = (index % 7) + 1;
    const data = PROGRAM[w - 1][d - 1];

    document.getElementById("popupDayTitle").textContent = `Jour du programme : S${w}J${d}`;

    if (data.type === "rest") {
        document.getElementById("popupDayContent").innerHTML = "<p>Repos</p>";
    } else {
        let html = "";
        data.exercises.forEach(e => {
            html += `<p>${e.name} : ${e.series} x ${e.reps}</p>`;
        });
        html += `<p>Course : ${data.km} km</p>`;
        document.getElementById("popupDayContent").innerHTML = html;
    }

    document.getElementById("setVacation").onclick = () => {
        addVacationRange(index, index);
        renderCalendar();
        document.getElementById("popupDay").classList.add("hidden");
    };

    document.getElementById("popupDay").classList.remove("hidden");
}

document.getElementById("closeDay").onclick = () => {
    document.getElementById("popupDay").classList.add("hidden");
};

//---------------------------------------------
// NAVIGATION ENTRE LES PAGES
//---------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#bottomNav button").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.page;

            // Changer la page active
            document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
            document.getElementById(target).classList.add("active");

            // Boutons actifs
            document.querySelectorAll("#bottomNav button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });
});


//---------------------------------------------
// INIT
//---------------------------------------------
renderToday();
renderCalendar();
