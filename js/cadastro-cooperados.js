import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Inicializa o banco de dados localmente neste arquivo
const db = getFirestore(app);

// --- VERIFICAÇÃO DE USUÁRIO SEM BLOQUEIO ---
onAuthStateChanged(auth, (user) => {
    const display = document.getElementById('userNameDisplay');
    
    if (user) {
        // Se houver usuário, exibe o nome no canto superior
        // Usando o e-mail como fallback caso o displayName não esteja preenchido
        const nomeUsuario = user.displayName || user.email.split('@')[0];
        display.textContent = nomeUsuario.toUpperCase();
        
        // Aqui você chama sua função de carregar dados que já existe
        if (typeof carregarCooperados === "function") {
            carregarCooperados();
        }
    } else {
        // APENAS redireciona se tiver certeza absoluta que não há ninguém logado
        // Se você estiver testando localmente e ainda não fez login na index, ele vai voltar
        console.log("Nenhum usuário detectado. Verifique o login na página inicial.");
        // window.location.href = 'index.html'; // Comente esta linha se quiser testar sem ser expulso
    }
});

const colRef = collection(db, "cooperados");
const histRef = collection(db, "historico");

let cooperadosAtuais = [];
let idEdicao = null;

document.addEventListener('DOMContentLoaded', () => {
    verificarAcesso();
    configurarMascaraCpf();
    ouvirDadosEmTempoReal();
    
    const userLogado = localStorage.getItem('usuarioNome') || "USUÁRIO";
    const display = document.getElementById('userNameDisplay');
    if(display) display.innerText = userLogado.toUpperCase();
});

function verificarAcesso() {
    const nivel = localStorage.getItem('usuarioNivel');
    if (nivel !== 'ADM') {
        alert("Acesso negado!");
        window.location.href = 'inicial.html';
    }
}

function ouvirDadosEmTempoReal() {
    const q = query(colRef, orderBy("nome", "asc"));
    onSnapshot(q, (snapshot) => {
        cooperadosAtuais = [];
        snapshot.forEach((doc) => {
            cooperadosAtuais.push({ id: doc.id, ...doc.data() });
        });
        renderizarTabela(cooperadosAtuais);
    });
}

function configurarMascaraCpf() {
    const inputCpf = document.getElementById('cpfCooperado');
    inputCpf.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length >= 10) {
            v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2}).*/, "$1.$2.$3-$4");
        } else if (v.length >= 7) {
            v = v.replace(/^(\d{3})(\d{3})(\d{1,3}).*/, "$1.$2.$3");
        } else if (v.length >= 4) {
            v = v.replace(/^(\d{3})(\d{1,3}).*/, "$1.$2");
        }
        e.target.value = v;
    });
}

window.salvarCooperado = async function() {
    const nome = document.getElementById('nomeCooperado').value.trim().toUpperCase();
    const cpf = document.getElementById('cpfCooperado').value;
    const btn = document.getElementById('btnSalvar');

    if (nome.length < 5 || cpf.length < 14) {
        alert("Preencha o nome completo e o CPF corretamente.");
        return;
    }

    try {
        btn.disabled = true;
        btn.innerText = "PROCESSANDO...";

        const dados = {
            nome: nome,
            cpf: cpf,
            ultimaAlteracao: new Date().toISOString(),
            usuarioAcao: localStorage.getItem('usuarioNome')
        };

        if (idEdicao) {
            await updateDoc(doc(db, "cooperados", idEdicao), dados);
            await addDoc(histRef, {
                acao: "EDIÇÃO",
                detalhe: `Cooperado ${nome} atualizado.`,
                usuario: localStorage.getItem('usuarioNome'),
                data: new Date().toISOString()
            });
            idEdicao = null;
        } else {
            dados.dataCadastro = new Date().toISOString();
            await addDoc(colRef, dados);
            await addDoc(histRef, {
                acao: "CADASTRO",
                detalhe: `Novo cooperado: ${nome}`,
                usuario: localStorage.getItem('usuarioNome'),
                data: new Date().toISOString()
            });
        }

        limparCampos();
        alert("Sucesso!");
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> CADASTRAR COOPERADO';
        btn.style.background = "";
    }
};

window.excluir = async function(id, nome) {
    if (confirm(`Excluir ${nome}?`)) {
        await deleteDoc(doc(db, "cooperados", id));
    }
};

window.prepararEdicao = function(id, nome, cpf) {
    idEdicao = id;
    document.getElementById('nomeCooperado').value = nome;
    document.getElementById('cpfCooperado').value = cpf;
    const btn = document.getElementById('btnSalvar');
    btn.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÕES';
    btn.style.background = "#1976D2";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.filtrarTabela = function() {
    const termo = document.getElementById('inputBusca').value.toUpperCase();
    const filtrados = cooperadosAtuais.filter(c => 
        c.nome.includes(termo) || c.cpf.includes(termo)
    );
    renderizarTabela(filtrados);
};

function renderizarTabela(dados) {
    const tbody = document.getElementById('tabelaCooperados');
    if(!tbody) return;
    tbody.innerHTML = dados.map(c => `
        <tr>
            <td data-label="Nome"><b>${c.nome}</b></td>
            <td data-label="CPF">${c.cpf}</td>
            <td class="actions">
                <button class="btn-action btn-edit" onclick="prepararEdicao('${c.id}', '${c.nome}', '${c.cpf}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action btn-delete" onclick="excluir('${c.id}', '${c.nome}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function limparCampos() {
    document.getElementById('nomeCooperado').value = "";
    document.getElementById('cpfCooperado').value = "";
    idEdicao = null;
}
