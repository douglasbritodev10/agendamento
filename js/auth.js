import { app } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (!email || !pass) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        const userCred = await signInWithEmailAndPassword(auth, email, pass);
        const uid = userCred.user.uid;

        // Busca o perfil no banco
        const userDoc = await getDoc(doc(db, "users", uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            // Salva sessão
            localStorage.setItem('nivelAcesso', userData.nivelAcesso);
            localStorage.setItem('usuarioEmail', email);
            localStorage.setItem('usuarioNome', userData.nome || email);
            
            window.location.href = "inicial.html";
        } else {
            // Se o login deu certo mas não tem documento no Firestore, é o primeiro acesso
            window.location.href = "primeiro-acesso.html";
        }

    } catch (error) {
        console.error("Erro no login:", error.code);
        alert("E-mail ou senha inválidos.");
    }
});
