// Importa a inicialização do app que criamos no firebase-config.js
import { app } from './firebase-config.js';

// Importa os módulos específicos necessários para esta página
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Inicializa os serviços
const auth = getAuth(app);
const db = getFirestore(app);

const btnLogin = document.getElementById('btnLogin');

// Lógica de Login
btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        // 1. Tenta autenticar no Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Busca os dados de nível de acesso no Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists()) {
            const dadosUsuario = userDoc.data();
            
            // Salva o nível de acesso no localStorage para conferência rápida nas páginas
            localStorage.setItem('nivelAcesso', dadosUsuario.nivelAcesso);
            localStorage.setItem('usuarioEmail', dadosUsuario.email);

            // Redireciona para a Dashboard (Página Inicial)
            window.location.href = "pages/dashboard.html"; 
        } else {
            // Se o usuário existe no Auth mas não tem perfil no Firestore
            alert("Erro crítico: Nível de acesso não configurado. Contate o ADM.");
        }

    } catch (error) {
        console.error("Erro ao autenticar:", error.code);
        
        // Mensagens amigáveis para erros comuns
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            alert("E-mail ou senha incorretos.");
        } else if (error.code === 'auth/invalid-email') {
            alert("E-mail inválido.");
        } else {
            alert("Erro ao realizar login. Tente novamente.");
        }
    }
});

// (Opcional) Verifica se já está logado e redireciona
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Se já houver uma sessão ativa, pula o login
        // window.location.href = "pages/dashboard.html";
    }
});
