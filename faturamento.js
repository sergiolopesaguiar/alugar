// Lógica da página Financeiro > Faturamento.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Cada linha de faturamento representa uma fatura emitida para um contrato
// já cadastrado, numa competência (mês/ano) específica. O valor é
// auto-preenchido a partir do contrato ao selecioná-lo (contratos.valor),
// mas fica editável - pode haver reajuste ou cobrança parcial num mês
// específico, diferente do valor "padrão" do contrato.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'faturamento';

let editandoId = null;
let todosContratos = []; // {id, valor, clientes:{nome,cpf_cnpj}} - carregado uma vez

function descricaoContrato(c){
    const cliente = c.clientes?.nome || '(sem cliente)';
    const valor = c.valor != null ? Number(c.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';
    return `#${c.id} - ${cliente}${valor ? ' - ' + valor : ''}`;
}

async function carregarContratosDisponiveis(){

    const {data, error} = await supabaseClient
        .from('contratos')
        .select('id, valor, clientes(nome, cpf_cnpj)')
        .order('id');

    const select = document.getElementById('contratoId');

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar contratos</option>';
        return;
    }

    todosContratos = data || [];

    let html = '<option value="" selected disabled>Selecione o contrato...</option>';

    todosContratos.forEach(c => {
        html += `<option value="${c.id}">${descricaoContrato(c)}</option>`;
    });

    select.innerHTML = html;

}

// Ao trocar o contrato selecionado, preenche o campo Valor com o valor do
// contrato - mas o usuário pode editar depois de preenchido.
function preencherValorDoContrato(){

    const id = Number(document.getElementById('contratoId').value);
    const contrato = todosContratos.find(c => c.id === id);

    if(contrato && contrato.valor != null){
        document.getElementById('valor').value = contrato.valor;
    }

}

async function carregar(){

    const {data, error} = await supabaseClient
        .from('faturamento')
        .select('*, contratos(id, valor, clientes(nome, cpf_cnpj))')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(f => {

        const cliente = f.contratos?.clientes?.nome ?? '';
        const dataFmt = f.data ? new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const compFmt = formatarComp(f.comp);
        const valor = f.valor != null ? Number(f.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';

        html += `
        <tr>
            <td>${f.id}</td>
            <td>${dataFmt}</td>
            <td>${compFmt}</td>
            <td>${f.contrato_id ? '#' + f.contrato_id : ''}</td>
            <td>${cliente}</td>
            <td>${valor}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${f.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${f.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
        `;

    });

    document.getElementById("lista").innerHTML = html;

}

// O campo <input type="month"> grava/lê no formato "AAAA-MM" - convertido
// aqui só para exibição na listagem ("MM/AAAA").
function formatarComp(comp){
    if(!comp) return '';
    const partes = comp.split('-');
    if(partes.length !== 2) return comp;
    return `${partes[1]}/${partes[0]}`;
}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('faturamento')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("data").value = data.data ?? '';
    document.getElementById("comp").value = data.comp ?? '';
    document.getElementById("contratoId").value = data.contrato_id ?? '';
    document.getElementById("valor").value = data.valor ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("data").value = '';
    document.getElementById("comp").value = '';
    document.getElementById("contratoId").value = '';
    document.getElementById("valor").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('faturamento')
        .select('comp, contratos(clientes(nome))')
        .eq('id', id)
        .single();

    const cliente = data?.contratos?.clientes?.nome || '(sem cliente)';
    const comp = formatarComp(data?.comp) || '(sem competência)';

    if(!confirm(`Excluir a fatura #${id} - ${cliente} - ${comp}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('faturamento')
        .delete()
        .eq('id', id);

    if(error){
        alert(error.message);
        return;
    }

    if(editandoId === id){
        cancelarEdicao();
    }

    carregar();

}

async function salvar(){

    const dataValor = document.getElementById("data").value;
    const comp = document.getElementById("comp").value;
    const contratoId = document.getElementById("contratoId").value;
    const valorValor = document.getElementById("valor").value;

    if(!contratoId){
        alert('Selecione o contrato.');
        return;
    }

    const dados = {
        data: dataValor || null,
        comp: comp || null,
        contrato_id: Number(contratoId),
        valor: valorValor ? Number(valorValor) : null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('faturamento')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('faturamento')
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

document.addEventListener('DOMContentLoaded', () => {
    const comboContrato = document.getElementById('contratoId');
    if(comboContrato){
        comboContrato.addEventListener('change', preencherValorDoContrato);
    }
});

checarLogin();
carregarContratosDisponiveis();
