/**
 * Agro-Rental Hub - Vendor Dashboard Logic
 * Handles adding new machinery and updating incoming booking requests status inside Firestore
 * Includes interactive digital invoice preview logs for accepted rental actions
 * Automatically computes contextual work operational status based on date tracking configurations
 */

import { db, auth } from "./config.js";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentVendorUid = null;

// Check user login state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentVendorUid = user.uid;
        // Load data specific to this vendor once authenticated
        listenToIncomingBookings();
    } else {
        // If not logged in, redirect back to login page
        window.location.href = "login.html";
    }
});

// --- 1. ADD NEW MACHINERY LOGIC ---
const addMachineForm = document.getElementById("addMachineForm");

if (addMachineForm) {
    addMachineForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("machineName").value;
        const category = document.getElementById("machineCategory").value;
        const price = document.getElementById("machinePrice").value;

        try {
            // Save machinery details into 'machinery' collection
            await addDoc(collection(db, "machinery"), {
                vendorUid: currentVendorUid,
                machineName: name,
                category: category,
                pricePerHour: Number(price),
                status: "Available",
                createdAt: new Date()
            });

            alert("Machinery added successfully!");
            addMachineForm.reset();
            
            // Close the Bootstrap Modal automatically
            const modalElement = document.getElementById("addMachineModal");
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();

        } catch (error) {
            console.error("Error adding machine:", error);
            alert("Failed to add machinery: " + error.message);
        }
    });
}

// --- 2. LOAD INCOMING BOOKINGS REAL-TIME (WITH AUTOMATIC WORK STATUS RESOLUTION) ---
function listenToIncomingBookings() {
    const bookingsTableBody = document.getElementById("vendorBookingsTable");
    const q = collection(db, "bookings");

    onSnapshot(q, (snapshot) => {
        if (!bookingsTableBody) return;
        bookingsTableBody.innerHTML = ""; // Clear placeholder rows

        if (snapshot.empty) {
            bookingsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No booking requests found.</td></tr>`;
            return;
        }

        // Fetch current system date and format it as YYYY-MM-DD for precise string evaluation
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedToday = `${yyyy}-${mm}-${dd}`;

        snapshot.forEach((docSnap) => {
            const booking = docSnap.data();
            const bookingId = docSnap.id;

            const row = document.createElement("tr");
            
            // Set badge color style depending on internal status strings
            let badgeClass = "bg-warning text-dark"; // Pending
            if (booking.status === "Accepted") badgeClass = "bg-success";
            if (booking.status === "Rejected") badgeClass = "bg-danger";

            // EVALUATE OPERATIONAL WORK STATUS BASED ON DATE MILISTONES
            let workBadgeClass = "bg-secondary";
            let workStatusText = "काम प्रलंबित";

            if (booking.status === "Accepted") {
                if (booking.date < formattedToday) {
                    workBadgeClass = "bg-info text-dark";
                    workStatusText = "काम पूर्ण झाले";
                } else if (booking.date === formattedToday) {
                    workBadgeClass = "bg-primary";
                    workStatusText = "काम चालू आहे";
                }
            } else {
                // Non-accepted transactions retain a completely blank or generic hyphen state
                workStatusText = "-";
            }

            // Interface routing rules based on active authorization profiles
            let actionHtml = `<span class="text-muted small">-</span>`;
            if (booking.status === 'Pending') {
                actionHtml = `
                    <button class="btn btn-success btn-sm fw-bold me-1" onclick="updateBookingStatus('${bookingId}', 'Accepted')"><i class="fa-solid fa-check"></i></button>
                    <button class="btn btn-danger btn-sm fw-bold" onclick="updateBookingStatus('${bookingId}', 'Rejected')"><i class="fa-solid fa-xmark"></i></button>
                `;
            } else if (booking.status === 'Accepted') {
                actionHtml = `
                    <button class="btn btn-outline-dark btn-xs fw-bold py-0 px-2 btn-view-v-invoice" 
                        data-farmer="${booking.farmerName || 'Farmer'}"
                        data-machine="${booking.machineName}"
                        data-date="${booking.date}"
                        data-hours="${booking.hours}"
                        data-total="${booking.totalEstimatedRent}"
                        style="font-size: 11px;">
                        <i class="fa-solid fa-receipt me-1"></i>पावती पहा
                    </button>
                `;
            }

            row.innerHTML = `
                <td class="fw-semibold">${booking.farmerName || 'Farmer'}</td>
                <td>${booking.machineName}</td>
                <td>${booking.date}</td>
                <td>${booking.hours} Hrs</td>
                <td><span class="badge ${badgeClass}">${booking.status}</span></td>
                <td><span class="badge ${workBadgeClass}">${workStatusText}</span></td>
                <td>${actionHtml}</td>
            `;
            bookingsTableBody.appendChild(row);
        });

        // Setup click event binding for newly generated vendor invoice buttons
        setupVendorInvoiceButtons();
    });
}

// --- 3. DIGITAL INVOICE DATA INJECTION HANDLER FOR VENDOR REVIEWS ---
function setupVendorInvoiceButtons() {
    document.querySelectorAll(".btn-view-v-invoice").forEach(button => {
        button.addEventListener("click", (e) => {
            const btn = e.currentTarget;
            document.getElementById("vInvFarmerName").textContent = btn.getAttribute("data-farmer");
            document.getElementById("vInvMachineName").textContent = btn.getAttribute("data-machine");
            document.getElementById("vInvMachineDetail").textContent = btn.getAttribute("data-machine") + " (Rental)";
            document.getElementById("vInvDate").textContent = btn.getAttribute("data-date");
            document.getElementById("vInvHours").textContent = btn.getAttribute("data-hours") + " Hrs";
            document.getElementById("vInvTotal").textContent = "₹" + btn.getAttribute("data-total");

            // Trigger Bootstrap Interactive Modal Instance
            const vInvoiceModal = new bootstrap.Modal(document.getElementById("vendorInvoiceModal"));
            vInvoiceModal.show();
        });
    });
}

// --- 4. UPDATE BOOKING STATUS (ACCEPT / REJECT) LOGIC ---
window.updateBookingStatus = async function(bookingId, newStatus) {
    try {
        const bookingDocRef = doc(db, "bookings", bookingId);
        
        // Update the explicit status field inside Firestore database document
        await updateDoc(bookingDocRef, {
            status: newStatus
        });

        alert(`Booking successfully ${newStatus}!`);
    } catch (error) {
        console.error("Error updating booking status:", error);
        alert("Failed to update status: " + error.message);
    }
};

// --- 5. LOGOUT LOGIC ---
const btnVendorLogout = document.getElementById("btnVendorLogout");
if (btnVendorLogout) {
    btnVendorLogout.addEventListener("click", () => {
        auth.signOut().then(() => {
            window.location.href = "login.html";
        });
    });
}