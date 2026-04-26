import { app } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById('btnLogin');
const loginInput = document.getElementById('loginField');
const passInput = document.getElementById('passwordField');

async function realizarLogin() {
    let usernameOrEmail = loginInput.value.trim();
    const password = passInput.value;

    if (!usernameOrEmail || !password) {
        alert("Por favor, preencha as credenciais.");
        return;
    }

    // Feedback visual no botão
    loginBtn.innerText = "AUTENTICANDO...";
    loginBtn.disabled = true;

    try {
        let emailFinal = usernameOrEmail;

        // Se NÃO for um e-mail (não tem @), buscamos o e-mail pelo username no Firestore
        if (!usernameOrEmail.includes("@")) {
            const q = query(collection(db, "users"), where("username", "==", usernameOrEmail.toUpperCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("Usuário não encontrado.");
            }
            emailFinal = querySnapshot.docs[0].data().email;
        }

        // Login no Firebase Auth
        const userCred = await signInWithEmailAndPassword(auth, emailFinal, password);
        const uid = userCred.user.uid;

        // Busca dados do perfil
        const userDoc = await getDoc(doc(db, "users", uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            // Salva sessão local de forma organizada
            localStorage.setItem('nivelAcesso', data.nivelAcesso);
            localStorage.setItem('usuarioNome', data.nome);
            localStorage.setItem('username', data.username);
            localStorage.setItem('usuarioEmail', data.email);
            
            window.location.href = "inicial.html";
        } else {
            // Se logou mas não tem documento, vai para o primeiro acesso
            window.location.href = "primeiro-acesso.html";
        }

    } catch (error) {
        console.error("Erro no login:", error);
        alert(error.message === "Usuário não encontrado." ? error.message : "E-mail/Usuário ou senha incorretos.");
        loginBtn.innerText = "ENTRAR NO SISTEMA";
        loginBtn.disabled = false;
    }
}

// Evento de clique
loginBtn.addEventListener('click', realizarLogin);

// Suporte ao ENTER em ambos os campos
[loginInput, passInput].forEach(field => {
    field.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') realizarLogin();
    });
});
