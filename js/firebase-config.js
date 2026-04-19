import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyB8XbEwWWUV8Qm5-TghdTzFGgwHCsouTMI",
    authDomain: "agendamento-ebe81.firebaseapp.com",
    projectId: "agendamento-ebe81",
    storageBucket: "agendamento-ebe81.firebasestorage.app",
    messagingSenderId: "779314983745",
    appId: "1:779314983745:web:2391f6e8f6e663559667c0"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

export { app, firebaseConfig };
