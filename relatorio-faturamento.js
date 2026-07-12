// Lógica do Relatório de Faturamento (Relatórios > Faturamento).
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Fonte do faturamento: campo "valor" da tabela contratos (única informação
// financeira que existe hoje no sistema). Cada contrato pertence a um único
// cliente (cliente_id), então o agrupamento por cliente é direto. O
// agrupamento por mês usa a data_inicial do contrato (contratos sem
// data_inicial entram num grupo "Sem data").

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'relatorio_faturamento';

let todosContratos = []; // carregado uma vez; o filtro de cliente é aplicado em memória

async function carregar(){

    const {data, error} = await supabaseClient
        .from('contratos')
        .select('*, clientes(nome, cpf_cnpj)')
        .order('data_inicial', {ascending: false});

    if(error){
        alert(error.message);
        return;
    }

    todosContratos = data || [];

    popularFiltroCliente();
    aplicarFiltros();

}

// Preenche o combo de clientes só com quem já tem pelo menos 1 contrato -
// evita listar clientes sem nenhum faturamento associado.
function popularFiltroCliente(){

    const select = document.getElementById('filtroCliente');
    const valorAtual = select.value;

    const clientes = new Map();
    todosContratos.forEach(c => {
        if(c.cliente_id != null){
            clientes.set(c.cliente_id, c.clientes?.nome || `Cliente #${c.cliente_id}`);
        }
    });

    const ordenados = Array.from(clientes.entries()).sort((a, b) => a[1].localeCompare(b[1]));

    let html = '<option value="">Todos os clientes</option>';
    ordenados.forEach(([id, nome]) => {
        html += `<option value="${id}">${nome}</option>`;
    });

    select.innerHTML = html;
    select.value = valorAtual;

}

function aplicarFiltros(){

    const clienteId = document.getElementById('filtroCliente').value;

    const filtrados = clienteId
        ? todosContratos.filter(c => String(c.cliente_id) === clienteId)
        : todosContratos;

    renderizarResumoCliente(filtrados);
    renderizarResumoMes(filtrados);
    renderizarContratos(filtrados);

}

function limparFiltros(){
    document.getElementById('filtroCliente').value = '';
    aplicarFiltros();
}

function formatarMoeda(valor){
    return Number(valor || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

function renderizarResumoCliente(lista){

    const grupos = {};

    lista.forEach(c => {

        const nome = c.clientes?.nome || '(sem cliente)';
        const cnpj = c.clientes?.cpf_cnpj || '';
        const chave = c.cliente_id ?? nome;

        if(!grupos[chave]){
            grupos[chave] = {nome, cnpj, quantidade: 0, total: 0};
        }

        grupos[chave].quantidade++;
        grupos[chave].total += Number(c.valor || 0);

    });

    const linhas = Object.values(grupos).sort((a, b) => b.total - a.total);

    let html = '';

    if(linhas.length === 0){
        html = '<tr><td colspan="4" class="text-muted">Nenhum contrato cadastrado.</td></tr>';
    }

    linhas.forEach(l => {
        html += `<tr><td>${l.nome}</td><td>${l.cnpj}</td><td>${l.quantidade}</td><td>${formatarMoeda(l.total)}</td></tr>`;
    });

    document.getElementById('listaResumoCliente').innerHTML = html;

}

function renderizarResumoMes(lista){

    const grupos = {};

    lista.forEach(c => {

        const chave = c.data_inicial ? c.data_inicial.slice(0, 7) : 'sem-data'; // YYYY-MM

        if(!grupos[chave]){
            grupos[chave] = {chave, quantidade: 0, total: 0};
        }

        grupos[chave].quantidade++;
        grupos[chave].total += Number(c.valor || 0);

    });

    const linhas = Object.values(grupos).sort((a, b) => b.chave.localeCompare(a.chave));

    let html = '';

    if(linhas.length === 0){
        html = '<tr><td colspan="3" class="text-muted">Nenhum contrato cadastrado.</td></tr>';
    }

    linhas.forEach(l => {

        const rotuloMes = l.chave === 'sem-data'
            ? 'Sem data'
            : new Date(l.chave + '-01T00:00:00').toLocaleDateString('pt-BR', {month: '2-digit', year: 'numeric'});

        html += `<tr><td>${rotuloMes}</td><td>${l.quantidade}</td><td>${formatarMoeda(l.total)}</td></tr>`;

    });

    document.getElementById('listaResumoMes').innerHTML = html;

}

function renderizarContratos(lista){

    let html = '';
    let totalGeral = 0;

    if(lista.length === 0){
        html = '<tr><td colspan="7" class="text-muted">Nenhum contrato cadastrado.</td></tr>';
    }

    lista.forEach(c => {

        totalGeral += Number(c.valor || 0);

        const dataInicial = c.data_inicial ? new Date(c.data_inicial + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const dataFinal = c.data_final ? new Date(c.data_final + 'T00:00:00').toLocaleDateString('pt-BR') : '';

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.clientes?.nome ?? ''}</td>
            <td>${c.clientes?.cpf_cnpj ?? ''}</td>
            <td>${dataInicial}</td>
            <td>${dataFinal}</td>
            <td>${formatarMoeda(c.valor)}</td>
            <td>${c.observacao ?? ''}</td>
        </tr>
        `;

    });

    document.getElementById('listaContratos').innerHTML = html;
    document.getElementById('totalGeral').textContent = `Total geral: ${formatarMoeda(totalGeral)}`;

}

checarLogin();
