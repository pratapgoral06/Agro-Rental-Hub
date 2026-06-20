/**
 * Agro-Rental Hub - Authentication & User Registration Logic
 * Integrates Firebase Auth and Firestore Database with explicit client-side validation setup
 */

import { auth, db } from "./config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. USER REGISTRATION (SIGN UP) LOGIC WITH CLIENT-SIDE VALIDATION ---
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Stop default form redirection

        // Fetch inputs from the registration form fields
        const name = document.getElementById("regName").value.trim();
        const phone = document.getElementById("regPhone").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPassword").value;
        const roleElement = document.querySelector('input[name="userRole"]:checked');

        // --- STAGE 1: LOGICAL CLIENT VALIDATION RUNS ---

        if (name === "") {
            alert("कृपया तुमचे पूर्ण नाव टाका!");
            return;
        }

        // 1. Precise Email layout structural verification rules
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert("कृपया एक वैध ईमेल आयडी प्रविष्ट करा! (उदा. pratap@gmail.com)");
            document.getElementById("regEmail").focus();
            return;
        }

        // 2. Strict 10-digit numeric digits length limits enforcement
        const mobileRegex = /^[0-9]{10}$/;
        if (!mobileRegex.test(phone)) {
            alert("कृपया वैध १० अंकी मोबाईल नंबर टाका! अक्षरे किंवा स्पेस चालणार नाहीत.");
            document.getElementById("regPhone").focus();
            return;
        }

        // 3. Mandatory password character length check
        if (password.length < 6) {
            alert("सुरक्षेसाठी पासवर्ड किमान ६ अक्षरे किंवा अंकांचा असावा!");
            document.getElementById("regPassword").focus();
            return;
        }

        if (!roleElement) {
            alert("कृपया तुमचा रोल निवडा!");
            return;
        }
        const role = roleElement.value;

        // --- STAGE 2: EXECUTE FIREBASE WRITES AND PROFILE STORAGE ---
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

            alert("खाते यशस्वीरित्या तयार झाले आहे! डॅशबोर्डवर रीडायरेक्ट करत आहोत...");
            
            // Send user to their corresponding panel workspace
            redirectUserBasedOnRole(role);

        } catch (error) {
            console.error("Registration Error:", error.message);
            if (error.code === "auth/email-already-in-use") {
                alert("हा ईमेल आयडी आधीच नोंदणीकृत आहे! कृपया दुसरा ईमेल वापरा.");
            } else {
                alert("नोंदणी अयशस्वी झाली: " + error.message);
            }
        }
    });
}

// --- 2. USER LOGIN (SIGN IN) LOGIC ---
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Fetch input credentials from the login form fields
        const email = document.getElementById("loginEmail").value.trim();
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
                alert("फायरस्टोअरमध्ये या प्रोफाइलचा कोणताही डेटा सापडला नाही!");
            }

        } catch (error) {
            console.error("Login Error:", error.message);
            alert("अवैध क्रेडेंशियल्स किंवा लॉगिन त्रुटी: " + error.message);
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