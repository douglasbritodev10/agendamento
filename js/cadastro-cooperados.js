// Importando as configurações do Firebase (ajuste o caminho se necessário)
import { db } from './firebase-config.js'; 
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referências das coleções
const colRef = collection(db, "cooperados");
const histRef = collection(db, "historico");

let cooperadosAtuais = [];

document.addEventListener('DOMContentLoaded', () => {
    verificarAcesso();
    configurarMascaraCpf();
    ouvirDadosEmTempoReal();
    
    // Nome do usuário logado para o cabeçalho
    const userLogado = localStorage.getItem('usuarioNome') || "USUÁRIO";
    document.getElementById('userNameDisplay').innerText = userLogado;
});

// 1. VERIFICAR SE É ADM (Seguindo sua lógica de segurança)
function verificarAcesso() {
    const nivel = localStorage.getItem('usuarioNivel');
    if (nivel !== 'ADM') {
        alert("Acesso negado! Apenas administradores podem acessar esta página.");
        window.location.href = 'inicial.html';
    }
}

// 2. ESCUTAR DADOS DO FIRESTORE (Tempo Real + Ordenação A-Z)
function ouvirDadosEmTempoReal() {
    // Já traz do Firebase ordenado por nome em ordem alfabética
    const q = query(colRef, orderBy("nome", "asc"));

    onSnapshot(q, (snapshot) => {
        cooperadosAtuais = [];
        snapshot.forEach((doc) => {
            cooperadosAtuais.push({ id: doc.id, ...doc.data() });
        });
        renderizarTabela(cooperadosAtuais);
    });
}

// 3. SALVAR NO FIREBASE E HISTÓRICO
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
        btn.innerText = "SALVANDO...";

        // Dados do cooperado
        const dadosCooperado = {
            nome: nome,
            cpf: cpf,
            dataCadastro: new Date().toISOString(),
            cadastradoPor: localStorage.getItem('usuarioNome')
        };

        // Salva na coleção 'cooperados'
        await addDoc(colRef, dadosCooperado);

        // Salva na coleção 'historico' (como você pediu)
        await addDoc(histRef, {
            acao: "CADASTRO DE COOPERADO",
            detalhe: `Cooperado ${nome} (CPF: ${cpf}) foi cadastrado.`,
            usuario: localStorage.getItem('usuarioNome'),
            data: new Date().toISOString()
        });

        limparCampos();
        alert("Cooperado cadastrado com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar no banco de dados.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-user-plus"></i> CADASTRAR COOPERADO';
    }
};

// 4. EXCLUIR DO FIREBASE
window.excluir = async function(id, nome) {
    if (confirm(`Deseja realmente excluir o cooperado ${nome}?`)) {
        try {
            await deleteDoc(doc(db, "cooperados", id));

            // Log no histórico
            await addDoc(histRef, {
                acao: "EXCLUSÃO DE COOPERADO",
                detalhe: `Cooperado ${nome} foi removido do sistema.`,
                usuario: localStorage.getItem('usuarioNome'),
                data: new Date().toISOString()
            });

        } catch (error) {
            alert("Erro ao excluir.");
        }
    }
};

// 5. RENDERIZAR TABELA (Responsiva)
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

// 6. BUSCA LOCAL (Filtra o que já está carregado)
window.filtrarTabela = function() {
    const termo = document.getElementById('inputBusca').value.toUpperCase();
    const filtrados = cooperadosAtuais.filter(c => 
        c.nome.includes(termo) || c.cpf.includes(termo)
    );
    renderizarTabela(filtrados);
};

// MÁSCARA E AUXILIARES
function configurarMascaraCpf() {
    const inputCpf = document.getElementById('cpfCooperado');
    inputCpf.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
        e.target.value = v;
    });
}

function limparCampos() {
    document.getElementById('nomeCooperado').value = "";
    document.getElementById('cpfCooperado').value = "";
}

window.prepararEdicao = function(id, nome, cpf) {
    document.getElementById('nomeCooperado').value = nome;
    document.getElementById('cpfCooperado').value = cpf;
    document.getElementById('nomeCooperado').focus();
    alert("Altere os dados e clique em cadastrar (Lógica de update pode ser adicionada aqui)");
};
