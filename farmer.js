/**
 * Agro-Rental Hub - Farmer Dashboard Logic
 */

import { db, auth } from "./config.js";
import { collection, onSnapshot, addDoc, doc, query, where, getDoc, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentFarmerUid = null;
let currentFarmerName = "Farmer";
let activeMachinePricePerHour = 0; 
let activeMachineId = null;
let activeMachineName = "";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentFarmerUid = user.uid;
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentFarmerName = userDoc.data().name;
            document.getElementById("welcomeUser").textContent = `रामराम, ${currentFarmerName}!`;
        }
        listenToAvailableMachinery();
        fetchLiveAgriWeather(); // Initiates real-time weather analytics engine for Kolhapur
    } else {
        window.location.href = "login.html";
    }
});

// --- 1. LOGOUT LOGIC ---
document.getElementById("btnLogout").addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "login.html");
});

// --- 2. MACHINERY LISTING (Always open for non-conflicting booking slots) ---
function listenToAvailableMachinery() {
    const grid = document.getElementById("machineryGrid");
    onSnapshot(collection(db, "machinery"), (mSnap) => {
        grid.innerHTML = "";
        mSnap.forEach(m => {
            const machine = m.data();

            const card = document.createElement("div");
            card.className = "col-md-6 col-lg-4";
            card.innerHTML = `
                <div class="card machine-card-dash h-100 shadow-sm">
                    <div class="img-placeholder"><i class="fa-solid fa-tractor fa-3x text-success"></i></div>
                    <div class="card-body">
                        <h5 class="fw-bold">${machine.machineName}</h5>
                        <div class="d-flex justify-content-between align-items-center my-2">
                            <span class="fw-bold text-success">₹${machine.pricePerHour} / तास</span>
                            <span class="badge bg-success">Available</span>
                        </div>
                        <button class="btn btn-success w-100" onclick="openBookingModal('${m.id}', '${machine.machineName}', ${machine.pricePerHour})">
                            बुक करा
                        </button>
                    </div>
                </div>`;
            grid.appendChild(card);
        });
    });
}

// --- 3. BOOKING TABLE & STATUS LOGIC ---
function loadFarmerBookings() {
    const tbody = document.getElementById("farmerBookingsTable");
    const today = new Date().toISOString().split('T')[0];
    
    onSnapshot(query(collection(db, "bookings"), where("farmerUid", "==", currentFarmerUid)), (snap) => {
        tbody.innerHTML = "";
        snap.forEach(docSnap => {
            const b = docSnap.data();
            const bId = docSnap.id;
            
            let statusText = "प्रलंबित", statusBadge = "bg-warning";
            if (b.status === "Accepted") {
                if (b.date > today) { statusText = "आगामी"; statusBadge = "bg-info"; }
                else if (b.date === today) { statusText = "चालू काम"; statusBadge = "bg-primary"; }
                else { statusText = "पूर्ण झाले"; statusBadge = "bg-success"; }
            } else if (b.status === "Rejected") {
                statusText = "रद्द केले"; statusBadge = "bg-danger";
            }

            tbody.innerHTML += `<tr>
                <td>${b.machineName}</td>
                <td>${b.date}</td>
                <td>${b.hours} Hrs</td>
                <td>₹${b.totalEstimatedRent}</td>
                <td><span class="badge ${statusBadge}">${statusText}</span></td>
                <td>${statusText}</td>
                <td>
                    ${b.status === "Accepted" ? `<button class="btn btn-sm btn-outline-dark" onclick="showInvoice('${b.machineName}','${b.date}','${b.hours}','${b.totalEstimatedRent}')">पावती</button>` : ''}
                    ${b.status === "Pending" ? `<button class="btn btn-sm btn-danger" onclick="deleteBooking('${bId}')">रद्द</button>` : ''}
                </td>
            </tr>`;
        });
    });
}

// --- 4. GLOBAL FUNCTIONS FOR UI & DYNAMIC CALCULATION ---
window.openBookingModal = async (id, name, price) => {
    activeMachineId = id;
    activeMachineName = name;
    activeMachinePricePerHour = Number(price);

    const dateInput = document.getElementById("bookingDate");
    const hoursInput = document.getElementById("bookingHours");
    const totalDisplay = document.getElementById("estimatedCost");
    const errorMsg = document.getElementById("bookingDateError");
    const confirmBtn = document.getElementById("btnConfirmBooking");

    if (dateInput) dateInput.value = "";
    if (errorMsg) errorMsg.classList.add("d-none");
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.classList.replace("btn-secondary", "btn-success");
    }
    if (hoursInput) hoursInput.value = "1"; 
    if (totalDisplay) totalDisplay.textContent = "₹" + activeMachinePricePerHour;

    window.currentSelectedMachineBookedDates = [];
    try {
        const q = query(collection(db, "bookings"), where("machineId", "==", id), where("status", "==", "Accepted"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            window.currentSelectedMachineBookedDates.push(doc.data().date);
        });
    } catch (err) {
        console.error("Error fetching historical calendar registries:", err);
    }

    new bootstrap.Modal(document.getElementById("bookingModal")).show();
};

const hoursInputField = document.getElementById("bookingHours");
if (hoursInputField) {
    hoursInputField.addEventListener("input", () => {
        const hours = Number(hoursInputField.value) || 0;
        const total = hours * activeMachinePricePerHour;
        
        const totalDisplay = document.getElementById("estimatedCost");
        if (totalDisplay) {
            totalDisplay.textContent = "₹" + total;
        }
    });
}

// --- 5. BOOKING FORM SUBMISSION TO FIRESTORE ---
const confirmBookingForm = document.getElementById("bookingForm");
if (confirmBookingForm) {
    confirmBookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const bookingDate = document.getElementById("bookingDate").value;
        const bookingHours = Number(document.getElementById("bookingHours").value) || 0;
        const finalCalculatedRent = bookingHours * activeMachinePricePerHour;

        if (bookingHours <= 0 || !bookingDate) {
            alert("कृपया तारीख आणि अचूक तास भरा!");
            return;
        }

        try {
            await addDoc(collection(db, "bookings"), {
                farmerUid: currentFarmerUid,
                farmerName: currentFarmerName,
                machineId: activeMachineId,
                machineName: activeMachineName,
                date: bookingDate,
                hours: bookingHours,
                totalEstimatedRent: finalCalculatedRent,
                status: "Pending",
                createdAt: new Date()
            });

            alert("बुकिंग रिक्वेस्ट व्हेंडरकडे यशस्वीरित्या पाठवली आहे!");
            confirmBookingForm.reset();

            const modalElement = document.getElementById("bookingModal");
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();

        } catch (error) {
            console.error("Booking Submission Error:", error);
            alert("बुकिंग सबमिट करताना अडचण आली: " + error.message);
        }
    });
}

window.showInvoice = (name, date, hours, total) => {
    document.getElementById("invMachineName").textContent = name;
    document.getElementById("invDate").textContent = date;
    document.getElementById("invHours").textContent = hours + " Hrs";
    document.getElementById("invTotal").textContent = "₹" + total;
    new bootstrap.Modal(document.getElementById("invoiceModal")).show();
};

window.deleteBooking = async (bId) => {
    if (confirm("बुकिंग रद्द करायचे?")) await deleteDoc(doc(db, "bookings", bId));
};

// --- 6. NAVIGATION PANEL LOGIC ---
document.getElementById("linkMyBookings").addEventListener("click", () => {
    document.getElementById("machineryGrid").classList.add("d-none");
    document.getElementById("myBookingsSection").classList.remove("d-none");
    loadFarmerBookings();
});

document.getElementById("linkBrowse").addEventListener("click", () => {
    document.getElementById("machineryGrid").classList.remove("d-none");
    document.getElementById("myBookingsSection").classList.add("d-none");
});

// --- 7. LIVE AGRI WEATHER FEED LOGIC (KOLHAPUR REGION) ---
async function fetchLiveAgriWeather() {
    const tempDisplay = document.getElementById("weatherTemp");
    const statusDisplay = document.getElementById("weatherStatus");
    const iconDisplay = document.getElementById("weatherIcon");

    // Geographic geo-coordinates parameters assigned for Kolhapur region
    const lat = "16.7050";
    const lon = "74.2433";
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Weather API pipeline connectivity hold");
        
        const data = await response.json();
        const current = data.current_weather;
        
        if (tempDisplay) {
            tempDisplay.textContent = `${Math.round(current.temperature)}°C`;
        }

        let weatherText = "स्वच्छ आकाश";
        let weatherIconHtml = `<i class="fa-solid fa-sun text-warning"></i>`;
        const code = current.weathercode;

        // Map standard meteorology codes to regional vernacular string layouts
        if (code === 0) {
            weatherText = "स्वच्छ आकाश";
            weatherIconHtml = `<i class="fa-solid fa-sun text-warning"></i>`;
        } else if ([1, 2, 3].includes(code)) {
            weatherText = "आंशिक ढगाळ";
            weatherIconHtml = `<i class="fa-solid fa-cloud-sun text-light"></i>`;
        } else if ([45, 48].includes(code)) {
            weatherText = "धुके आहे";
            weatherIconHtml = `<i class="fa-solid fa-smog text-secondary"></i>`;
        } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
            weatherText = "पाऊस पडत आहे 🌧️";
            weatherIconHtml = `<i class="fa-solid fa-cloud-showers-heavy text-info"></i>`;
        } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
            weatherText = "बर्फवृष्टी (गारपीट)";
            weatherIconHtml = `<i class="fa-solid fa-snowflake text-light"></i>`;
        } else if ([95, 96, 99].includes(code)) {
            weatherText = "वादळी पाऊस ⛈️";
            weatherIconHtml = `<i class="fa-solid fa-cloud-bolt text-danger"></i>`;
        }

        if (statusDisplay) {
            statusDisplay.textContent = weatherText;
        }
        if (iconDisplay) {
            iconDisplay.innerHTML = weatherIconHtml;
        }

    } catch (error) {
        console.error("Agri-weather telemetry initialization crash:", error);
        if (statusDisplay) {
            statusDisplay.textContent = "हवामान ऑफलाइन आहे";
        }
    }
}