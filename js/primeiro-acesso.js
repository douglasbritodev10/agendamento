import { app } from './firebase-config.js';
import { getAuth, updatePassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

// Proteção: Se não estiver logado, volta pro login
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "index.html";
});

async function finalizarCadastro() {
    const nome = document.getElementById('novoNome').value.trim();
    const username = document.getElementById('novoUsername').value.trim().toUpperCase();
    const senha = document.getElementById('novaSenha').value;
    const confirma = document.getElementById('confirmaSenha').value;
    const user = auth.currentUser;

    if (!nome || !username || !senha) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    if (senha.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    if (senha !== confirma) {
        alert("As senhas não coincidem.");
        return;
    }

    const btn = document.getElementById('btnFinalizar');
    btn.innerText = "SALVANDO...";
    btn.disabled = true;

    try {
        // 1. Verifica se o Username já está em uso por outro UID
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            alert("Este nome de usuário já está em uso. Escolha outro.");
            btn.innerText = "FINALIZAR E ENTRAR";
            btn.disabled = false;
            return;
        }

        // 2. Atualiza a senha no Firebase Auth
        await updatePassword(user, senha);

        // 3. Cria o documento do usuário no Firestore
        // Por padrão, novos usuários entram como "LEITOR" até um ADM alterar
        const dadosUsuario = {
            nome: nome,
            username: username,
            email: user.email,
            nivelAcesso: "LEITOR", 
            dataCadastro: new Date().toISOString()
        };

        await setDoc(doc(db, "users", user.uid), dadosUsuario);

        // 4. Salva sessão local
        localStorage.setItem('nivelAcesso', dadosUsuario.nivelAcesso);
        localStorage.setItem('usuarioNome', dadosUsuario.nome);
        localStorage.setItem('username', dadosUsuario.username);
        localStorage.setItem('usuarioEmail', dadosUsuario.email);

        alert("Perfil configurado! Bem-vindo ao sistema.");
        window.location.href = "inicial.html";

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar perfil. Tente novamente.");
        btn.innerText = "FINALIZAR E ENTRAR";
        btn.disabled = false;
    }
}

document.getElementById('btnFinalizar').addEventListener('click', finalizarCadastro);

// Suporte ao Enter no campo de confirmação de senha
document.getElementById('confirmaSenha').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') finalizarCadastro();
});
