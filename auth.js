/**
 * Agro-Rental Hub - Authentication & User Registration Logic
 * Integrates Firebase Auth and Firestore Database
 */

import { auth, db } from "./config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. USER REGISTRATION (SIGN UP) LOGIC ---
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Fetch inputs from the registration form fields
        const name = document.getElementById("regName").value;
        const phone = document.getElementById("regPhone").value;
        const email = document.getElementById("regEmail").value;
        const password = document.getElementById("regPassword").value;
        const role = document.querySelector('input[name="userRole"]:checked').value;

        try {
            // Register user in Firebase Authentication database
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save extended profile data (Name, Phone, Role) to Firestore users collection
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                phone: phone,
                email: email,
                role: role,
                createdAt: new Date()
            });

            alert("Account created successfully! Redirecting...");
            
            // Send user to their corresponding panel workspace
            redirectUserBasedOnRole(role);

        } catch (error) {
            console.error("Registration Error:", error.message);
            alert("Error creating account: " + error.message);
        }
    });
}

// --- 2. USER LOGIN (SIGN IN) LOGIC ---
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Fetch input credentials from the login form fields
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        try {
            // Validate credentials against Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Fetch the assigned workspace role from Cloud Firestore DB document
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const userData = docSnap.data();
                // Dynamically route the user depending on recorded role string
                redirectUserBasedOnRole(userData.role);
            } else {
                alert("No profile data found for this user inside Firestore!");
            }

        } catch (error) {
            console.error("Login Error:", error.message);
            alert("Invalid credentials or login error: " + error.message);
        }
    });
}

/**
 * Utility function to handle role-based application routing redirects
 * @param {string} role - The explicit role string fetched ('Farmer' or 'Vendor')
 */
function redirectUserBasedOnRole(role) {
    if (role === "Farmer") {
        window.location.href = "farmer-dashboard.html";
    } else if (role === "Vendor") {
        window.location.href = "vendor-dashboard.html";
    }
}