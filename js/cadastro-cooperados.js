// Simulação de banco de dados e histórico
let cooperados = JSON.parse(localStorage.getItem('db_cooperados')) || [];

document.addEventListener('DOMContentLoaded', () => {
    configurarCpf();
    renderizarTabela();
    
    // Nome do usuário logado (puxando do seu sistema)
    const userLogado = localStorage.getItem('usuarioNome') || "ADMINISTRADOR";
    document.getElementById('userNameDisplay').innerText = userLogado;
});

// Máscara de CPF
function configurarCpf() {
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

// Salvar no Banco e Histórico
window.salvarCooperado = function() {
    const nome = document.getElementById('nomeCooperado').value.trim().toUpperCase();
    const cpf = document.getElementById('cpfCooperado').value;

    if (nome.length < 5 || cpf.length < 14) {
        alert("Por favor, preencha o nome completo e o CPF corretamente.");
        return;
    }

    // Verifica se já existe
    if (cooperados.some(c => c.cpf === cpf)) {
        alert("Este CPF já está cadastrado!");
        return;
    }

    const novo = { 
        nome, 
        cpf, 
        dataCadastro: new Date().toLocaleString('pt-BR') 
    };

    cooperados.push(novo);
    salvarDados();
    
    // Registrar na sua coleção de HISTÓRICO (Simulação)
    console.log(`HISTÓRICO: Cooperado ${nome} cadastrado por ${document.getElementById('userNameDisplay').innerText}`);

    limparCampos();
    renderizarTabela();
    alert("Cooperado cadastrado com sucesso!");
};

// Renderizar com Ordenação Alfabética
window.renderizarTabela = function(dados = cooperados) {
    const tbody = document.getElementById('tabelaCooperados');
    
    // Ordenação A-Z
    const listaOrdenada = [...dados].sort((a, b) => a.nome.localeCompare(b.nome));

    tbody.innerHTML = listaOrdenada.map(c => `
        <tr>
            <td data-label="Nome"><b>${c.nome}</b></td>
            <td data-label="CPF">${c.cpf}</td>
            <td class="actions">
                <button class="btn-action btn-edit" onclick="editar('${c.cpf}')"><i class="fas fa-edit"></i></button>
                <button class="btn-action btn-delete" onclick="excluir('${c.cpf}')"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
};

// Busca em Tempo Real
window.filtrarTabela = function() {
    const termo = document.getElementById('inputBusca').value.toUpperCase();
    const filtrados = cooperados.filter(c => 
        c.nome.includes(termo) || c.cpf.includes(termo)
    );
    renderizarTabela(filtrados);
};

window.excluir = function(cpf) {
    if (confirm("Tem certeza que deseja excluir este cooperado?")) {
        const index = cooperados.findIndex(c => c.cpf === cpf);
        const nomeExcluido = cooperados[index].nome;
        
        cooperados.splice(index, 1);
        salvarDados();
        
        // Log de Histórico
        console.log(`HISTÓRICO: Cooperado ${nomeExcluido} removido.`);
        
        renderizarTabela();
    }
};

window.editar = function(cpf) {
    const c = cooperados.find(coop => coop.cpf === cpf);
    document.getElementById('nomeCooperado').value = c.nome;
    document.getElementById('cpfCooperado').value = c.cpf;
    document.getElementById('nomeCooperado').focus();
    // Aqui você pode mudar o texto do botão para "ATUALIZAR" se desejar
};

function salvarDados() {
    localStorage.setItem('db_cooperados', JSON.stringify(cooperados));
}

function limparCampos() {
    document.getElementById('nomeCooperado').value = "";
    document.getElementById('cpfCooperado').value = "";
}
