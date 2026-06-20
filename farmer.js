/**
 * Agro-Rental Hub - Farmer Dashboard Logic
 * Fetches available machinery and manages dynamic user bookings in real-time
 * Includes real-time weather feeds and automatic digital invoice generation logic
 */

import { db, auth } from "./config.js";
import { collection, onSnapshot, addDoc, getDoc, doc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
                workStatus: "Pending Work", // Initialize default operational state
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

// --- 5. LOAD FARMER'S OWN BOOKINGS FROM FIRESTORE (WITH DYNAMIC DATE-BASED WORK STATUS) ---
function loadFarmerBookings() {
    const farmerBookingsTable = document.getElementById("farmerBookingsTable");
    if (!farmerBookingsTable) return;

    // Filter cloud bookings collection context exclusively for the active farmer session
    const q = query(collection(db, "bookings"), where("farmerUid", "==", currentFarmerUid));

    onSnapshot(q, (snapshot) => {
        // CRITICAL: Clear out the existing loading spinner before rendering rows
        farmerBookingsTable.innerHTML = "";

        if (snapshot.empty) {
            farmerBookingsTable.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">तुम्ही अजून एकही बुकिंग केलेले नाही.</td></tr>`;
            return;
        }

        // Fetch current system date and format as YYYY-MM-DD for precise string comparison
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${yyyy}-${mm}-${dd}`;

        snapshot.forEach((docSnap) => {
            const booking = docSnap.data();
            const bookingId = docSnap.id;
            
            // Map the booking approval status badges
            let badgeClass = "bg-warning text-dark"; // Pending
            if (booking.status === "Accepted") badgeClass = "bg-success";
            if (booking.status === "Rejected") badgeClass = "bg-danger";

            // DYNAMIC DATE LOGIC: Determine work status based on selected booking date milestones
            let workBadgeClass = "bg-secondary";
            let workStatusText = "काम प्रलंबित";

            if (booking.date < formattedToday) {
                // If the booking date has already passed
                workBadgeClass = "bg-info text-dark";
                workStatusText = "काम पूर्ण झाले";
            } else if (booking.date === formattedToday) {
                // If the booking date is precisely today
                workBadgeClass = "bg-primary";
                workStatusText = "काम चालू आहे";
            }

            // Contextual processing for interactive buttons layout
            let actionButtonHtml = "";
            if (booking.status === "Accepted") {
                actionButtonHtml = `
                    <button class="btn btn-outline-dark btn-xs fw-bold py-1 px-2 btn-view-invoice" 
                        data-farmer="${booking.farmerName}"
                        data-machine="${booking.machineName}"
                        data-date="${booking.date}"
                        data-hours="${booking.hours}"
                        data-total="${booking.totalEstimatedRent}"
                        style="font-size: 11px;">
                        <i class="fa-solid fa-receipt me-1"></i>पावती पहा
                    </button>
                `;
            } else if (booking.status === "Pending") {
                actionButtonHtml = `
                    <button class="btn btn-danger btn-xs fw-bold py-1 px-2 btn-cancel-booking" 
                        data-booking-id="${bookingId}"
                        style="font-size: 11px;">
                        <i class="fa-solid fa-trash-can me-1"></i>रद्द करा
                    </button>
                `;
            } else {
                actionButtonHtml = `<span class="text-muted small">-</span>`;
            }

            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="fw-semibold">${booking.machineName}</td>
                <td>${booking.date}</td>
                <td>${booking.hours} Hrs</td>
                <td class="text-success fw-bold">₹${booking.totalEstimatedRent}</td>
                <td><span class="badge ${badgeClass}">${booking.status}</span></td>
                <td><span class="badge ${workBadgeClass}">${workStatusText}</span></td>
                <td>${actionButtonHtml}</td>
            `;
            farmerBookingsTable.appendChild(row);
        });

        // Initialize click handling attachments for invoice layouts
        setupInvoiceButtons();

        // Initialize click handling attachments for booking cancel triggers
        setupCancelButtons();
    });
}

// --- 5.1. CANCEL INTERACTIVE EVENT ATTACHMENTS FOR FIRESTORE REMOVAL ---
function setupCancelButtons() {
    document.querySelectorAll(".btn-cancel-booking").forEach(button => {
        button.addEventListener("click", async (e) => {
            const bookingId = e.currentTarget.getAttribute("data-booking-id");
            
            if (confirm("तुम्हाला हे बुकिंग खरोखर रद्द करायचे आहे का?")) {
                try {
                    await deleteDoc(doc(db, "bookings", bookingId));
                    alert("बुकिंग यशस्वीरित्या रद्द करण्यात आले आहे!");
                } catch (error) {
                    console.error("Error cancelling booking:", error);
                    alert("बुकिंग रद्द करता आले नाही: " + error.message);
                }
            }
        });
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