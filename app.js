if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
}
// Petit programme d'exemple (tu pourras le changer)
const program = [
    "Jour OFF 😴",
    "3 × 10 pompes",
    "3 × 10 pompes",
    "Jour OFF 😴",
    "4 × 10 pompes",
    "4 × 10 pompes",
    "Jour OFF 😴",
    "5 × 10 pompes",
    "5 × 10 pompes"
];

// Si c'est la première fois
if (!localStorage.getItem("dayIndex")) {
    localStorage.setItem("dayIndex", "0");
}

function updateUI() {
    const index = parseInt(localStorage.getItem("dayIndex"));
    const exercise = program[index] || "Programme terminé 🎉";

    document.getElementById("exerciseBox").textContent = exercise;
}

document.getElementById("finishBtn").onclick = () => {
    let index = parseInt(localStorage.getItem("dayIndex"));
    index++;

    if (index < program.length) {
        localStorage.setItem("dayIndex", index.toString());
    }

    updateUI();
};

// Mise à jour de l’écran au démarrage
updateUI();
