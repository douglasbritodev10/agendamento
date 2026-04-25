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
        // 1. Tenta autenticar o usuário
        const userCred = await signInWithEmailAndPassword(auth, email, pass);
        const uid = userCred.user.uid;

        // 2. Busca o nível de acesso no Firestore
        const userDoc = await getDoc(doc(db, "users", uid));

        if (userDoc.exists()) {
            const userData = userDoc.data();

            // 3. Salva os dados localmente para uso na inicial.html
            localStorage.setItem('nivelAcesso', userData.nivelAcesso);
            localStorage.setItem('usuarioEmail', email);
            localStorage.setItem('usuarioNome', userData.nome || email); // Caso tenha o campo 'nome'

            // 4. Redireciona
            window.location.href = "inicial.html";
        } else {
            console.error("Erro: Documento do usuário não encontrado no Firestore (coleção 'users').");
            alert("Erro interno: Perfil de usuário não configurado.");
        }

    } catch (error) {
        console.error("Erro detalhado:", error.code, error.message);
        
        // Mensagens amigáveis para erros comuns
        switch (error.code) {
            case 'auth/user-not-found':
                alert("E-mail não cadastrado.");
                break;
            case 'auth/wrong-password':
                alert("Senha incorreta.");
                break;
            case 'auth/invalid-email':
                alert("E-mail inválido.");
                break;
            default:
                alert("Falha no login! Verifique suas credenciais.");
        }
    }
});
