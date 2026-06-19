/**
 * Agro-Rental Hub - Firebase Configuration Setup
 * Uses Firebase v10 CDN Modules for Authentication and Firestore
 */

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration credentials
const firebaseConfig = {
    apiKey: "AIzaSyCA1_9FcH_8fZavxw0I-QjznRVpf83FJGE",
    authDomain: "agro-rental-hub.firebaseapp.com",
    projectId: "agro-rental-hub",
    storageBucket: "agro-rental-hub.firebasestorage.app",
    messagingSenderId: "50290531729",
    appId: "1:50290531729:web:b5204271b5f334f6dd8e30",
    measurementId: "G-B7QZLLZPJ6"
};

// Initialize Firebase Application Instance
const app = initializeApp(firebaseConfig);

// Initialize and Export Core Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);