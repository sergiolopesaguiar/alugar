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
            <td>${f.id_contrato ? '#' + f.id_contrato : ''}</td>
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
    document.getElementById("contratoId").value = data.id_contrato ?? '';
    document.getElementById("valor").value = data.valor ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("contratoId").focus();

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
        id_contrato: Number(contratoId),
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

    const filtroPlaca = document.getElementById('filtroVeiculoPlaca');
    if(filtroPlaca){
        filtroPlaca.addEventListener('input', renderizarVeiculosFaturamento);
    }

    const filtroSituacao = document.getElementById('filtroVeiculoSituacao');
    if(filtroSituacao){
        filtroSituacao.addEventListener('change', renderizarVeiculosFaturamento);
    }
});

// ---------------------------------------------------------------------
// Seção "Veículos e Contratos" (pedido do Sérgio, baseado na planilha
// CARROS_FATURAR.pdf): mostra TODOS os veículos da frota e, para cada um,
// se está "Locado" (vinculado a um contrato vigente - sem data_final, ou
// com data_final ainda não vencida) ou "Disponível". Serve para visualizar
// de forma rápida quais veículos devem compor o faturamento do mês.
// ---------------------------------------------------------------------

let todosVeiculosFaturamento = []; // cache local para os filtros de placa/situação

async function carregarVeiculosFaturamento(){

    const {data: veiculos, error: errV} = await supabaseClient
        .from('veiculos')
        .select('id, placa, fabricante, modelo, status')
        .order('placa');

    if(errV){
        document.getElementById('listaVeiculosFaturamento').innerHTML =
            `<tr><td colspan="6" class="text-danger">Erro ao carregar veículos: ${errV.message}</td></tr>`;
        return;
    }

    const {data: vinculos, error: errVinc} = await supabaseClient
        .from('contratos_veiculos')
        .select('veiculo_id, valor, contratos(id, valor, data_inicial, data_final, clientes(nome))');

    if(errVinc){
        document.getElementById('listaVeiculosFaturamento').innerHTML =
            `<tr><td colspan="6" class="text-danger">Erro ao carregar contratos: ${errVinc.message}</td></tr>`;
        return;
    }

    const hojeStr = new Date().toISOString().slice(0, 10);

    // Para cada veículo, guarda o contrato vigente (sem data_final, ou com
    // data_final ainda não vencida) e o valor mensal daquele veículo
    // específico dentro do vínculo (contratos_veiculos.valor). Se por algum
    // motivo houver mais de um vínculo vigente para o mesmo veículo, fica com
    // o contrato de id mais alto (o mais recente) - cenário que não deveria
    // ocorrer em uso normal.
    const contratoPorVeiculo = {};
    const valorVinculoPorVeiculo = {};

    (vinculos || []).forEach(v => {
        const c = v.contratos;
        if(!c) return;
        const vigente = !c.data_final || c.data_final >= hojeStr;
        if(!vigente) return;
        const atual = contratoPorVeiculo[v.veiculo_id];
        if(!atual || c.id > atual.id){
            contratoPorVeiculo[v.veiculo_id] = c;
            valorVinculoPorVeiculo[v.veiculo_id] = v.valor;
        }
    });

    // Cada veículo de um contrato pode ter seu próprio valor mensal, gravado
    // na própria linha de contratos_veiculos (tela de Contratos). Usa esse
    // valor quando preenchido. Só para contratos antigos/ainda não migrados
    // (contratos_veiculos.valor vazio) é que cai de volta para dividir o
    // valor TOTAL do contrato igualmente entre os veículos vinculados a ele.
    const contagemPorContrato = {};
    Object.values(contratoPorVeiculo).forEach(c => {
        contagemPorContrato[c.id] = (contagemPorContrato[c.id] || 0) + 1;
    });

    todosVeiculosFaturamento = (veiculos || []).map(vei => {
        const contrato = contratoPorVeiculo[vei.id] || null;
        const valorVinculo = valorVinculoPorVeiculo[vei.id];
        let valorMensal = null;
        if(valorVinculo != null){
            valorMensal = Number(valorVinculo);
        } else if(contrato && contrato.valor != null){
            valorMensal = Number(contrato.valor) / (contagemPorContrato[contrato.id] || 1);
        }
        return {...vei, contrato, locado: !!contrato, valorMensal};
    });

    renderizarVeiculosFaturamento();

}

function renderizarVeiculosFaturamento(){

    const filtroPlaca = (document.getElementById('filtroVeiculoPlaca')?.value || '').trim().toUpperCase();
    const filtroSituacao = document.getElementById('filtroVeiculoSituacao')?.value || '';

    let lista = todosVeiculosFaturamento;

    if(filtroPlaca){
        lista = lista.filter(v => v.placa?.toUpperCase().includes(filtroPlaca));
    }

    if(filtroSituacao === 'locado'){
        lista = lista.filter(v => v.locado);
    } else if(filtroSituacao === 'disponivel'){
        lista = lista.filter(v => !v.locado);
    }

    let html = '';

    lista.forEach(v => {

        const veiculoDesc = [v.fabricante, v.modelo].filter(Boolean).join(' ') || '-';
        const situacaoBadge = v.locado
            ? '<span class="badge bg-success">Locado</span>'
            : '<span class="badge bg-secondary">Disponível</span>';
        const cliente = v.contrato?.clientes?.nome ?? '';
        const contratoTxt = v.contrato ? `#${v.contrato.id}` : '';
        const valor = v.valorMensal != null
            ? v.valorMensal.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
            : '';

        html += `
        <tr>
            <td>${v.placa}</td>
            <td>${veiculoDesc}</td>
            <td>${situacaoBadge}</td>
            <td>${cliente}</td>
            <td>${contratoTxt}</td>
            <td>${valor}</td>
        </tr>
        `;

    });

    document.getElementById('listaVeiculosFaturamento').innerHTML =
        html || '<tr><td colspan="6" class="text-muted">Nenhum veículo encontrado.</td></tr>';

    document.getElementById('cardTotalVeiculos').textContent = todosVeiculosFaturamento.length;
    document.getElementById('cardVeiculosLocados').textContent = todosVeiculosFaturamento.filter(v => v.locado).length;
    document.getElementById('cardVeiculosDisponiveis').textContent = todosVeiculosFaturamento.filter(v => !v.locado).length;

    const totalFaturar = todosVeiculosFaturamento
        .filter(v => v.locado)
        .reduce((soma, v) => soma + (Number(v.valorMensal) || 0), 0);

    document.getElementById('cardValorFaturar').textContent =
        totalFaturar.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

}

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
        id_contrato: c.id,
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
carregarVeiculosFaturamento();
