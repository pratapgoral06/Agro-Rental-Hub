/**
 * Agro-Rental Hub - Farmer Dashboard Logic
 */

import { db, auth } from "./config.js";
import { collection, onSnapshot, addDoc, doc, query, where, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentFarmerUid = null;
let currentFarmerName = "Farmer";
let activeMachinePricePerHour = 0; // सिलेक्ट केलेल्या यंत्राची प्रति तास किंमत साठवण्यासाठी
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
    } else {
        window.location.href = "login.html";
    }
});

// --- 1. LOGOUT LOGIC ---
document.getElementById("btnLogout").addEventListener("click", () => {
    signOut(auth).then(() => window.location.href = "login.html");
});

// --- 2. MACHINERY LISTING WITH STATUS ---
function listenToAvailableMachinery() {
    const grid = document.getElementById("machineryGrid");
    onSnapshot(collection(db, "machinery"), (mSnap) => {
        onSnapshot(collection(db, "bookings"), (bSnap) => {
            grid.innerHTML = "";
            mSnap.forEach(m => {
                const machine = m.data();
                const booking = bSnap.docs.find(b => b.data().machineId === m.id && b.data().status === "Accepted");
                const isBooked = !!booking;
                const bDate = isBooked ? booking.data().date : "";

                const card = document.createElement("div");
                card.className = "col-md-6 col-lg-4";
                card.innerHTML = `
                    <div class="card machine-card-dash h-100 shadow-sm">
                        <div class="img-placeholder"><i class="fa-solid fa-tractor fa-3x text-success"></i></div>
                        <div class="card-body">
                            <h5 class="fw-bold">${machine.machineName}</h5>
                            <div class="d-flex justify-content-between align-items-center my-2">
                                <span class="fw-bold text-success">₹${machine.pricePerHour} / तास</span>
                                <span class="badge ${isBooked ? 'bg-danger' : 'bg-success'}">${isBooked ? 'Booked: ' + bDate : 'Available'}</span>
                            </div>
                            <button class="btn btn-success w-100" ${isBooked ? 'disabled' : ''} onclick="openBookingModal('${m.id}', '${machine.machineName}', ${machine.pricePerHour})">
                                ${isBooked ? 'उपलब्ध नाही' : 'बुक करा'}
                            </button>
                        </div>
                    </div>`;
                grid.appendChild(card);
            });
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
window.openBookingModal = (id, name, price) => {
    activeMachineId = id;
    activeMachineName = name;
    activeMachinePricePerHour = Number(price); // भाडे नंबर फॉरमॅट मध्ये सेट केले

    // मॉडेल ओपन होताना इनपुट १ वर सेट करणे जेणेकरून सुरुवातीलाच भाडे दिसेल
    const hoursInput = document.getElementById("bookingHours");
    const totalDisplay = document.getElementById("estimatedCost");
    
    if (hoursInput) hoursInput.value = "1"; 
    if (totalDisplay) totalDisplay.textContent = "₹" + activeMachinePricePerHour;

    new bootstrap.Modal(document.getElementById("bookingModal")).show();
};

// शेतकरी जेव्हा तासांचे इनपुट बदलेल (टाईप करेल) तेव्हा रिअल-टाईम कॅल्क्युलेशन
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

            // मॉडEL ऑटोमॅटिक क्लोज करणे
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