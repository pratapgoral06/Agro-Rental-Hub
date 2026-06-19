/**
 * Agro-Rental Hub - Farmer Dashboard Logic
 * Fetches available machinery and manages dynamic user bookings in real-time
 * Includes real-time weather feeds and automatic digital invoice generation logic
 */

import { db, auth } from "./config.js";
import { collection, onSnapshot, addDoc, getDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentFarmerUid = null;
let currentFarmerName = "Farmer";
let selectedMachineId = null;
let selectedMachineName = "";
let selectedMachinePrice = 0;

// Check user authentication state and load active data profile
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentFarmerUid = user.uid;
        
        // Fetch current farmer's explicit name token from user profiles collection
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentFarmerName = userDoc.data().name;
            const welcomeElem = document.getElementById("welcomeUser");
            if (welcomeElem) welcomeElem.textContent = `रामराम, ${currentFarmerName}!`;
        }

        // Initialize real-time tracking for available marketplace assets
        listenToAvailableMachinery();
        
        // Trigger live agriculture weather updates
        fetchAgriWeather();
    } else {
        // Enforce session access control safety redirects
        window.location.href = "login.html";
    }
});

// --- 1. FETCH MACHINERY AND DISPLAY IN GRID REAL-TIME ---
function listenToAvailableMachinery() {
    const machineryGrid = document.getElementById("machineryGrid");
    const q = collection(db, "machinery");

    onSnapshot(q, (snapshot) => {
        if (!machineryGrid) return;
        machineryGrid.innerHTML = ""; // Clear out default HTML placeholder contents

        if (snapshot.empty) {
            machineryGrid.innerHTML = `<div class="col-12 text-center text-muted py-5"><h5>सध्या कोणतेही यंत्र भाड्याने उपलब्ध नाही.</h5></div>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const machine = docSnap.data();
            const machineId = docSnap.id;

            // Display active available machinery items inside the marketplace feed
            if (machine.status === "Available") {
                const cardCol = document.createElement("div");
                cardCol.className = "col-md-6 col-lg-4";
                
                let iconClass = "fa-tractor";
                if (machine.category === "Drone") iconClass = "fa-helicopter";
                if (machine.category === "Rotavator") iconClass = "fa-gears";

                cardCol.innerHTML = `
                    <div class="card machine-card-dash h-100 shadow-sm">
                        <div class="img-placeholder"><i class="fa-solid ${iconClass} fa-3x text-success"></i></div>
                        <div class="card-body">
                            <h5 class="card-title fw-bold">${machine.machineName}</h5>
                            <p class="text-muted small mb-2"><i class="fa-solid fa-tags me-1"></i> ${machine.category}</p>
                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                <span class="fw-bold text-success">₹${machine.pricePerHour} / तास</span>
                                <button class="btn btn-success btn-sm px-3 fw-bold btn-book-trigger" 
                                    data-id="${machineId}" 
                                    data-name="${machine.machineName}" 
                                    data-price="${machine.pricePerHour}">
                                    बुक करा
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                machineryGrid.appendChild(cardCol);
            }
        });

        // Re-bind click listeners to contextually generated buttons
        setupBookingButtons();
    });
}

// --- 2. SETUP BOOKING MODAL VALUES AND TOTAL RENT CALCULATION ---
function setupBookingButtons() {
    document.querySelectorAll(".btn-book-trigger").forEach(button => {
        button.addEventListener("click", (e) => {
            selectedMachineId = e.target.getAttribute("data-id");
            selectedMachineName = e.target.getAttribute("data-name");
            selectedMachinePrice = Number(e.target.getAttribute("data-price"));

            // Initialize bootstrap interactive modal component sequence
            const bookingModal = new bootstrap.Modal(document.getElementById("bookingModal"));
            bookingModal.show();
        });
    });
}

// Dynamically handle cost estimation arithmetic triggers
const bookingHoursInput = document.getElementById("bookingHours");
if (bookingHoursInput) {
    bookingHoursInput.addEventListener("input", (e) => {
        const hours = Number(e.target.value);
        const total = hours * selectedMachinePrice;
        document.getElementById("estimatedCost").textContent = `₹${total}`;
    });
}

// --- 3. SUBMIT BOOKING REQUEST TO FIRESTORE ---
const bookingForm = document.getElementById("bookingForm");
if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const date = document.getElementById("bookingDate").value;
        const hours = document.getElementById("bookingHours").value;

        try {
            // Write structured log record entries directly into 'bookings' collections
            await addDoc(collection(db, "bookings"), {
                farmerUid: currentFarmerUid,
                farmerName: currentFarmerName,
                machineId: selectedMachineId,
                machineName: selectedMachineName,
                date: date,
                hours: Number(hours),
                totalEstimatedRent: Number(hours) * selectedMachinePrice,
                status: "Pending",
                createdAt: new Date()
            });

            alert("Booking request submitted successfully to the owner!");
            bookingForm.reset();
            document.getElementById("estimatedCost").textContent = "₹0";

            // Dismiss active modal layout elements post transaction safety
            const modalElement = document.getElementById("bookingModal");
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();

        } catch (error) {
            console.error("Booking Error:", error);
            alert("Booking submission failed: " + error.message);
        }
    });
}

// --- 4. SIDEBAR SECTIONS TOGGLING INTERNALS ---
const linkBrowse = document.getElementById("linkBrowse");
const linkMyBookings = document.getElementById("linkMyBookings");
const machineryGrid = document.getElementById("machineryGrid");
const myBookingsSection = document.getElementById("myBookingsSection");
const dashTitle = document.getElementById("dashTitle");

if (linkBrowse && linkMyBookings) {
    linkBrowse.addEventListener("click", (e) => {
        e.preventDefault();
        linkBrowse.classList.add("active");
        linkMyBookings.classList.remove("active");
        if (machineryGrid) machineryGrid.classList.remove("d-none");
        if (myBookingsSection) myBookingsSection.classList.add("d-none");
        
        const currentLang = localStorage.getItem("selectedLang") || "mr";
        if (dashTitle) dashTitle.textContent = currentLang === "en" ? "Available Agri Machinery" : "उपलब्ध शेती अवजारे";
    });

    linkMyBookings.addEventListener("click", (e) => {
        e.preventDefault();
        linkMyBookings.classList.add("active");
        linkBrowse.classList.remove("active");
        if (machineryGrid) machineryGrid.classList.add("d-none");
        if (myBookingsSection) myBookingsSection.classList.remove("d-none");
        
        const currentLang = localStorage.getItem("selectedLang") || "mr";
        if (dashTitle) dashTitle.textContent = currentLang === "en" ? "My Bookings Record" : "माझे बुकिंग्स रेकॉर्ड";
        
        // Execute data extraction logic for this specific active farmer session
        loadFarmerBookings();
    });
}

// --- 5. LOAD FARMER'S OWN BOOKINGS FROM FIRESTORE ---
function loadFarmerBookings() {
    const farmerBookingsTable = document.getElementById("farmerBookingsTable");
    if (!farmerBookingsTable) return;

    // Filter cloud bookings collection context exclusively for the active farmer session
    const q = query(collection(db, "bookings"), where("farmerUid", "==", currentFarmerUid));

    onSnapshot(q, (snapshot) => {
        farmerBookingsTable.innerHTML = "";

        if (snapshot.empty) {
            farmerBookingsTable.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">तुम्ही अजून एकही बुकिंग केलेले नाही.</td></tr>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const booking = docSnap.data();
            
            let badgeClass = "bg-warning text-dark"; // Pending
            if (booking.status === "Accepted") badgeClass = "bg-success";
            if (booking.status === "Rejected") badgeClass = "bg-danger";

            // Conditional template block generation for invoice display permissions
            let actionButtonHtml = `<span class="badge ${badgeClass}">${booking.status}</span>`;
            if (booking.status === "Accepted") {
                actionButtonHtml = `
                    <span class="badge ${badgeClass} mb-1 d-block">${booking.status}</span>
                    <button class="btn btn-outline-dark btn-xs fw-bold py-0 px-2 btn-view-invoice" 
                        data-farmer="${booking.farmerName}"
                        data-machine="${booking.machineName}"
                        data-date="${booking.date}"
                        data-hours="${booking.hours}"
                        data-total="${booking.totalEstimatedRent}"
                        style="font-size: 11px;">
                        <i class="fa-solid fa-receipt me-1"></i>पावती पहा
                    </button>
                `;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="fw-semibold">${booking.machineName}</td>
                <td>${booking.date}</td>
                <td>${booking.hours} Hrs</td>
                <td class="text-success fw-bold">₹${booking.totalEstimatedRent}</td>
                <td>${actionButtonHtml}</td>
            `;
            farmerBookingsTable.appendChild(row);
        });

        // Initialize click handling attachments for invoice layouts
        setupInvoiceButtons();
    });
}

// --- 6. DIGITAL INVOICE MODAL DATA INJECTION HANDLER ---
function setupInvoiceButtons() {
    document.querySelectorAll(".btn-view-invoice").forEach(button => {
        button.addEventListener("click", (e) => {
            const btn = e.currentTarget;
            document.getElementById("invFarmerName").textContent = btn.getAttribute("data-farmer");
            document.getElementById("invMachineName").textContent = btn.getAttribute("data-machine");
            document.getElementById("invMachineDetail").textContent = btn.getAttribute("data-machine") + " (Rent)";
            document.getElementById("invDate").textContent = btn.getAttribute("data-date");
            document.getElementById("invHours").textContent = btn.getAttribute("data-hours") + " Hrs";
            document.getElementById("invTotal").textContent = "₹" + btn.getAttribute("data-total");

            const invoiceModal = new bootstrap.Modal(document.getElementById("invoiceModal"));
            invoiceModal.show();
        });
    });
}

// --- 7. LIVE AGRI WEATHER FETCH FUNCTION (KOLHAPUR REGION) ---
async function fetchAgriWeather() {
    const tempElem = document.getElementById("weatherTemp");
    const statusElem = document.getElementById("weatherStatus");
    const iconElem = document.getElementById("weatherIcon");

    if (!tempElem || !statusElem || !iconElem) return;

    try {
        // Fetching live data for Kolhapur coordinates via Open-Meteo free endpoints
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=16.7049&longitude=74.2433&current_weather=true");
        const data = await response.json();
        
        if (data && data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const weatherCode = data.current_weather.weathercode;

            tempElem.textContent = `${temp}°C`;

            let statusText = "स्वच्छ आकाश";
            let iconHtml = '<i class="fa-solid fa-sun text-warning"></i>';

            // Interpret WMO weather codes accurately into user preferences
            if (weatherCode >= 1 && weatherCode <= 3) {
                statusText = "अंशतः ढगाळ";
                iconHtml = '<i class="fa-solid fa-cloud-sun text-light"></i>';
            } else if (weatherCode >= 45 && weatherCode <= 48) {
                statusText = "धुके";
                iconHtml = '<i class="fa-solid fa-smog text-light"></i>';
            } else if (weatherCode >= 51 && weatherCode <= 67) {
                statusText = "रिमझिम पाऊस";
                iconHtml = '<i class="fa-solid fa-cloud-rain text-info"></i>';
            } else if (weatherCode >= 80 && weatherCode <= 82) {
                statusText = "मुसळधार पाऊस";
                iconHtml = '<i class="fa-solid fa-cloud-showers-heavy text-info"></i>';
            } else if (weatherCode >= 95 && weatherCode <= 99) {
                statusText = "गाजणारा पाऊस / वादळ";
                iconHtml = '<i class="fa-solid fa-cloud-bolt text-warning"></i>';
            }

            statusElem.textContent = statusText;
            iconElem.innerHTML = iconHtml;
        }
    } catch (error) {
        console.error("Weather API Error:", error);
        statusElem.textContent = "हवामान उपलब्ध नाही";
    }
}

// --- 8. LOGOUT LOGIC ---
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    });
}