import { app } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    try {
        const userCred = await signInWithEmailAndPassword(auth, email, pass);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        
        if (userDoc.exists()) {
            localStorage.setItem('nivelAcesso', userDoc.data().nivelAcesso);
            window.location.href = "inicial.html"; // Vai para a inicial na mesma pasta
        }
    } catch (e) {
        alert("Falha no login!");
    }
});
