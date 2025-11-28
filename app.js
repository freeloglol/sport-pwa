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

function isVacationDate(index) {
    const vac = load("vacances", []);
    return vac.includes(index);
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

    // S'il existe une modification manuelle pour cette semaine/exo
    const manual = load("manual-" + exerciseName + "-week-" + week);
    if (manual) {
        return manual;
    }

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

    // KM
    let km;
    if (week <= 6) {
        km = BASE.km + (week - 1) * 2;
    } else {
        km = 14 + Math.floor((week - 6) / 2) * 2;
    }
    km = Math.min(km, MAX_KM);

    // Volume check
    let total = series * reps;
    if (total > MAX_VOLUME) {
        reps = Math.floor(MAX_VOLUME / series);
    }

    return { series, reps, km };
}

//---------------------------------------------
// GENERER UNE JOURNÉE
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

//---------------------------------------------
// GENERER LE PROGRAMME COMPLET
//---------------------------------------------
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
// SÉANCE DU JOUR
//---------------------------------------------
function getCurrentDay() {
    let dayIndex = load("programDay", 0);
    return parseInt(dayIndex);
}

function markDone(index) {
    save("done-" + index, true);
}

//---------------------------------------------
// AFFICHAGE PAGE AUJOURD’HUI
//---------------------------------------------
function renderToday() {
    const container = document.getElementById("todayContent");
    container.innerHTML = "";

    const dayIndex = getCurrentDay();

    // Sauter les vacances si le jour actuel est marqué
    let tempIndex = dayIndex;
    while (isVacationDate(tempIndex)) {
        tempIndex++;
    }
    const realIndex = tempIndex;

    const week = Math.floor(realIndex / 7) + 1;
    const day = (realIndex % 7) + 1;

    const data = PROGRAM[week - 1][day - 1];

    if (data.type === "rest") {
        container.innerHTML = `
            <p>Jour de repos 😴</p>
        `;
        return;
    }

    data.exercises.forEach((exo, i) => {
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

    const done = load("done-" + realIndex, false);

    container.innerHTML += `
        <button class="finish-btn" id="finishBtn" ${done ? "disabled" : ""}>
            ${done ? "Déjà validé ✔" : "Terminer la séance"}
        </button>
    `;

    if (!done) {
        document.getElementById("finishBtn").onclick = () => {
            markDone(realIndex);
            save("programDay", realIndex + 1);
            renderToday();
            renderCalendar();
        };
    }
}

//---------------------------------------------
// POPUP MODIFICATION D’UN EXERCICE
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
// PAGE CALENDRIER
//---------------------------------------------
function renderCalendar() {
    const container = document.getElementById("calendarContent");
    container.innerHTML = "";

    const currentDay = getCurrentDay();

    for (let i = 0; i < 21; i++) {
        const w = Math.floor(i / 7) + 1;
        const d = (i % 7) + 1;
        const data = PROGRAM[w - 1][d - 1];

        let css = "calendar-day";

        if (isVacationDate(i)) css += " vac";
        else if (load("done-" + i)) css += " completed";
        else if (data.type === "rest") css += " rest";
        else if (i === currentDay) css += " current";

        container.innerHTML += `
            <div class="${css}" onclick="openDayPopup(${i})">
                S${w}J${d}
            </div>
        `;
    }
}

//---------------------------------------------
// POPUP JOUR DU CALENDRIER
//---------------------------------------------
function openDayPopup(index) {
    const w = Math.floor(index / 7) + 1;
    const d = (index % 7) + 1;
    const data = PROGRAM[w - 1][d - 1];

    document.getElementById("popupDayTitle").textContent = `Semaine ${w} - Jour ${d}`;

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
// VACATION POPUP
//---------------------------------------------
document.getElementById("cancelVacation").onclick = () => {
    document.getElementById("popupVacation").classList.add("hidden");
};

document.getElementById("saveVacation").onclick = () => {
    const s = parseInt(document.getElementById("vacStart").value);
    const e = parseInt(document.getElementById("vacEnd").value);
    addVacationRange(s, e);
    renderCalendar();
    document.getElementById("popupVacation").classList.add("hidden");
};

//---------------------------------------------
// NAVIGATION
//---------------------------------------------
document.querySelectorAll("#bottomNav button").forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.page;

        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(target).classList.add("active");

        document.querySelectorAll("#bottomNav button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
});

//---------------------------------------------
// INIT
//---------------------------------------------
renderToday();
renderCalendar();
