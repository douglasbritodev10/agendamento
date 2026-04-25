import { app } from './firebase-config.js';
import { getAuth, updatePassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById('btnFinalizarCadastro').addEventListener('click', async () => {
    const nome = document.getElementById('novoNome').value;
    const senha = document.getElementById('novaSenha').value;
    const confirma = document.getElementById('confirmaSenha').value;
    const user = auth.currentUser;

    if (!nome || senha.length < 6) {
        alert("O nome é obrigatório e a senha deve ter no mínimo 6 caracteres.");
        return;
    }

    if (senha !== confirma) {
        alert("As senhas não coincidem!");
        return;
    }

    try {
        // 1. Atualiza a senha no Auth
        await updatePassword(user, senha);

        // 2. Cria o registro no Firestore como LEITOR
        await setDoc(doc(db, "users", user.uid), {
            nome: nome,
            email: user.email,
            nivelAcesso: "LEITOR",
            dataCadastro: new Date().toISOString()
        });

        // 3. Prepara a sessão local
        localStorage.setItem('nivelAcesso', 'LEITOR');
        localStorage.setItem('usuarioEmail', user.email);
        localStorage.setItem('usuarioNome', nome);

        alert("Perfil configurado com sucesso! Bem-vindo.");
        window.location.href = "inicial.html";

    } catch (error) {
        console.error("Erro ao configurar:", error);
        alert("Erro ao salvar perfil. Tente novamente.");
    }
});
