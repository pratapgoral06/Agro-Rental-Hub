/**
 * Agro-Rental Hub - Language Translation Dictionary
 * Contains text configurations for both English and Marathi languages
 */
const translations = {
    en: {
        navHome: "Home",
        navBrowse: "Browse Machinery",
        navLogin: "Login / Register",
        heroTitle: "Modern Farming, Machinery Rental Made Easy!",
        heroDesc: "No need for heavy investments. Rent tractors, rotavators, and modern drones directly from your mobile at very affordable rates.",
        btnFind: "Find Machinery",
        btnRentOut: "Rent Out My Machinery",
        sectionTitle: "Available Featured Machinery",
        sectionSubtitle: "Choose the best options for your farming needs",
        statusAvailable: "Available",
        btnBookNow: "Book Now",
        footerText: "Agro-Rental Hub - Digital platform connecting farmers and machinery owners.",
        footerCopy: "© 2026 All Rights Reserved. Kolhapur, Maharashtra."
    },
    mr: {
        navHome: "होम",
        navBrowse: "यंत्रे पहा",
        navLogin: "लॉगिन / रजिस्टर",
        heroTitle: "आधुनिक शेती, आता सोपे झाले भाडे!",
        heroDesc: "लाखोंची गुंतवणूक करण्याची गरज नाही. ट्रॅक्टर्स, रोटाव्हेटर्स आणि आधुनिक ड्रोन्स भाड्याने मिळवा थेटतुमच्या मोबाईलवरून, अगदी वाजवी दरात.",
        btnFind: "यंत्रे शोधा",
        btnRentOut: "माझे अवजार भाड्याने द्या",
        sectionTitle: "उपलब्ध प्रमुख यंत्रे",
        sectionSubtitle: "तुमच्या शेतीसाठी लागणारे सर्वोत्तम पर्याय निवडा",
        statusAvailable: "उपलब्ध",
        btnBookNow: "Book Now",
        footerText: "Agro-Rental Hub - शेतकरी आणि यंत्रधारकांना जोडणारा डिजिटल प्लॅटफॉर्म",
        footerCopy: "© 2026 सर्व हक्क सुरक्षित. कोल्हापूर, महाराष्ट्र."
    }
};

/**
 * Function to switch website language dynamically
 * @param {string} lang - Selected language token ('en' or 'mr')
 */
window.changeLanguage = function(lang) {
    // Save user preference in LocalStorage so it persists on page reload
    localStorage.setItem("selectedLang", lang);

    // Loop through all HTML elements that have the data-lang-key attribute
    document.querySelectorAll("[data-lang-key]").forEach(element => {
        const key = element.getAttribute("data-lang-key");
        if (translations[lang] && translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
};

// Initialize language settings when document loads
document.addEventListener("DOMContentLoaded", () => {
    // Check if user has a previously saved language preference, default to Marathi ('mr')
    const savedLang = localStorage.getItem("selectedLang") || "mr";
    changeLanguage(savedLang);
});