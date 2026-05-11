import { app } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const colRef = collection(db, "cooperados");
const histRef = collection(db, "historico");

let cooperadosAtuais = [];
let idEdicao = null; // Controle para saber se estamos editando

document.addEventListener('DOMContentLoaded', () => {
    verificarAcesso();
    configurarMascaraCpf();
    ouvirDadosEmTempoReal();
    
    const userLogado = localStorage.getItem('usuarioNome') || "USUÁRIO";
    document.getElementById('userNameDisplay').innerText = userLogado;
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

// --- MELHORIA NA MÁSCARA DE CPF ---
function configurarMascaraCpf() {
    const inputCpf = document.getElementById('cpfCooperado');
    
    inputCpf.addEventListener('input', (e) => {
        // Remove tudo o que não é dígito
        let v = e.target.value.replace(/\D/g, "");
        
        // Limita a 11 caracteres
        if (v.length > 11) v = v.slice(0, 11);
        
        // Aplica a formatação progressivamente
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

// --- FUNÇÃO SALVAR (CRIAR OU EDITAR) ---
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
            // MODO EDIÇÃO
            await updateDoc(doc(db, "cooperados", idEdicao), dados);
            
            await addDoc(histRef, {
                acao: "EDIÇÃO DE COOPERADO",
                detalhe: `Cooperado ${nome} foi atualizado.`,
                usuario: localStorage.getItem('usuarioNome'),
                data: new Date().toISOString()
            });
            
            idEdicao = null;
            btn.innerHTML = '<i class="fas fa-user-plus"></i> CADASTRAR COOPERADO';
            btn.style.background = ""; // Volta para a cor original
        } else {
            // MODO NOVO CADASTRO
            dados.dataCadastro = new Date().toISOString();
            await addDoc(colRef, dados);

            await addDoc(histRef, {
                acao: "CADASTRO DE COOPERADO",
                detalhe: `Cooperado ${nome} (CPF: ${cpf}) cadastrado.`,
                usuario: localStorage.getItem('usuarioNome'),
                data: new Date().toISOString()
            });
        }

        limparCampos();
        alert("Operação realizada com sucesso!");

    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        btn.disabled = false;
    }
};

window.excluir = async function(id, nome) {
    if (confirm(`Excluir ${nome}?`)) {
        await deleteDoc(doc(db, "cooperados", id));
        await addDoc(histRef, {
            acao: "EXCLUSÃO",
            detalhe: `Excluiu cooperado: ${nome}`,
            usuario: localStorage.getItem('usuarioNome'),
            data: new Date().toISOString()
        });
    }
};

function renderizarTabela(dados) {
    const tbody = document.getElementById('tabelaCooperados');
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

window.filtrarTabela = function() {
    const termo = document.getElementById('inputBusca').value.toUpperCase();
    const filtrados = cooperadosAtuais.filter(c => 
        c.nome.includes(termo) || c.cpf.includes(termo)
    );
    renderizarTabela(filtrados);
};

// --- PREPARAR EDIÇÃO ---
window.prepararEdicao = function(id, nome, cpf) {
    idEdicao = id;
    document.getElementById('nomeCooperado').value = nome;
    document.getElementById('cpfCooperado').value = cpf;
    
    const btn = document.getElementById('btnSalvar');
    btn.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÕES';
    btn.style.background = "#1976D2"; // Cor azul para indicar edição
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('nomeCooperado').focus();
};

function limparCampos() {
    document.getElementById('nomeCooperado').value = "";
    document.getElementById('cpfCooperado').value = "";
    idEdicao = null;
    document.getElementById('btnSalvar').innerHTML = '<i class="fas fa-user-plus"></i> CADASTRAR COOPERADO';
    document.getElementById('btnSalvar').style.background = "";
}
