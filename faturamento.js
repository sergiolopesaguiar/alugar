// Lógica da página Financeiro > Faturamento.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Cada linha de faturamento representa uma fatura emitida para um contrato
// já cadastrado. O valor é auto-preenchido a partir do contrato ao
// selecioná-lo (contratos.valor), mas fica editável - pode haver reajuste ou
// cobrança parcial, diferente do valor "padrão" do contrato.
//
// Pedido do Sérgio: removido o campo "competência" (coluna comp, dropada do
// banco) - a tela agora tem um gerador de faturamento mensal em massa (ver
// gerarFaturamentoMes() no final deste arquivo) em vez de depender de
// competência digitada manualmente linha a linha.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'faturamento';

let editandoId = null;
let todosContratos = []; // {id, valor, data_inicial, data_final, clientes:{nome,cpf_cnpj}} - carregado uma vez

function descricaoContrato(c){
    const cliente = c.clientes?.nome || '(sem cliente)';
    const valor = c.valor != null ? Number(c.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';
    return `#${c.id} - ${cliente}${valor ? ' - ' + valor : ''}`;
}

async function carregarContratosDisponiveis(){

    const {data, error} = await supabaseClient
        .from('contratos')
        .select('id, valor, data_inicial, data_final, clientes(nome, cpf_cnpj)')
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
        const valor = f.valor != null ? Number(f.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';

        html += `
        <tr>
            <td>${f.id}</td>
            <td>${dataFmt}</td>
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
    document.getElementById("contratoId").value = data.contrato_id ?? '';
    document.getElementById("valor").value = data.valor ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("data").value = '';
    document.getElementById("contratoId").value = '';
    document.getElementById("valor").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('faturamento')
        .select('data, contratos(clientes(nome))')
        .eq('id', id)
        .single();

    const cliente = data?.contratos?.clientes?.nome || '(sem cliente)';
    const dataFmt = data?.data ? new Date(data.data + 'T00:00:00').toLocaleDateString('pt-BR') : '(sem data)';

    if(!confirm(`Excluir a fatura #${id} - ${cliente} - ${dataFmt}? Essa ação não pode ser desfeita.`)){
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
    const contratoId = document.getElementById("contratoId").value;
    const valorValor = document.getElementById("valor").value;

    if(!contratoId){
        alert('Selecione o contrato.');
        return;
    }

    const dados = {
        data: dataValor || null,
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

    // Mês de geração começa preenchido com o mês atual, por conveniência.
    const campoMes = document.getElementById('mesGeracao');
    if(campoMes){
        campoMes.value = new Date().toISOString().slice(0, 7);
    }
});

// ---------------------------------------------------------------------
// Geração em massa: "Gerar faturamento do mês" (pedido do Sérgio, substitui
// o antigo campo de competência digitado linha a linha). Um contrato é
// considerado ativo NUM MÊS quando o período do contrato (data_inicial até
// data_final) tem qualquer sobreposição com aquele mês - contrato sem
// data_final é tratado como "em aberto" (segue ativo indefinidamente),
// contrato sem data_inicial é tratado como já ativo desde sempre.
//
// Decisão do Sérgio: sem checagem de duplicidade - rodar de novo no mesmo
// mês gera lançamentos duplicados de propósito, controle fica manual (por
// isso o aviso no confirm() abaixo).
// ---------------------------------------------------------------------

function contratosAtivosNoMes(anoMes){

    const [ano, mes] = anoMes.split('-').map(Number);
    const inicioMes = `${anoMes}-01`;
    const fimMes = new Date(ano, mes, 0).toISOString().slice(0, 10); // último dia do mês

    return todosContratos.filter(c => {
        const comecouAntesDoFimDoMes = !c.data_inicial || c.data_inicial <= fimMes;
        const naoTerminouAntesDoMes = !c.data_final || c.data_final >= inicioMes;
        return comecouAntesDoFimDoMes && naoTerminouAntesDoMes;
    });

}

async function gerarFaturamentoMes(){

    const mes = document.getElementById('mesGeracao').value;

    if(!mes){
        alert('Selecione o mês.');
        return;
    }

    const contratos = contratosAtivosNoMes(mes);

    if(contratos.length === 0){
        alert('Nenhum contrato ativo encontrado para este mês.');
        return;
    }

    const descricoes = contratos.map(descricaoContrato).join('\n');

    if(!confirm(`Gerar faturamento de ${contratos.length} contrato(s) ativo(s) em ${mes}?\n\n${descricoes}\n\nAtenção: rodar a geração de novo no mesmo mês cria lançamentos duplicados - não há checagem automática.`)){
        return;
    }

    const dataLancamento = `${mes}-01`;

    const linhas = contratos.map(c => ({
        data: dataLancamento,
        contrato_id: c.id,
        valor: c.valor ?? null
    }));

    const {error} = await supabaseClient
        .from('faturamento')
        .insert(linhas);

    if(error){
        alert('Erro ao gerar faturamento: ' + error.message);
        return;
    }

    alert(`${linhas.length} lançamento(s) de faturamento gerado(s) para ${mes}.`);

    carregar();

}

checarLogin();
carregarContratosDisponiveis();
