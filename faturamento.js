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

    // O select além do nome/CPF-CNPJ do cliente, agora também traz o endereço
    // completo - não é usado aqui, mas é reaproveitado por gerarNotaLocacao()
    // (seção "Nota de Locação" no final deste arquivo) para montar o bloco
    // DESTINATÁRIO sem precisar de uma segunda consulta.
    const {data, error} = await supabaseClient
        .from('contratos')
        .select('id, valor, data_inicial, data_final, clientes(nome, cpf_cnpj, cep, logradouro, numero_endereco, bairro, uf, cidade)')
        .order('id');

    const select = document.getElementById('contratoId');
    const selectNota = document.getElementById('notaContratoId');

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar contratos</option>';
        if(selectNota) selectNota.innerHTML = '<option value="" selected disabled>Erro ao carregar contratos</option>';
        return;
    }

    todosContratos = data || [];

    let html = '<option value="" selected disabled>Selecione o contrato...</option>';

    todosContratos.forEach(c => {
        html += `<option value="${c.id}">${descricaoContrato(c)}</option>`;
    });

    select.innerHTML = html;
    if(selectNota) selectNota.innerHTML = html;

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

    // Nota de Locação: mês de referência e data de emissão começam
    // preenchidos (mês atual e hoje), por conveniência - ambos continuam
    // editáveis antes de gerar.
    const notaMes = document.getElementById('notaMesReferencia');
    if(notaMes){
        notaMes.value = new Date().toISOString().slice(0, 7);
    }

    const notaData = document.getElementById('notaDataEmissao');
    if(notaData){
        notaData.value = new Date().toISOString().slice(0, 10);
        notaData.addEventListener('change', atualizarNumeroNotaAuto);
    }

    const notaContratoSelect = document.getElementById('notaContratoId');
    if(notaContratoSelect){
        notaContratoSelect.addEventListener('change', atualizarNumeroNotaAuto);
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

// ---------------------------------------------------------------------
// Nota de Locação (pedido do Sérgio, com um PDF-modelo real como exemplo):
// monta uma "Nota de Locação" do contrato escolhido - veículos e valores,
// no mesmo layout do modelo em papel usado pela empresa - e abre pronta
// para impressão/PDF numa aba nova.
//
// Número da nota e vencimento têm campo próprio no formulário (#notaNumero,
// #notaVencimento - pedido do Sérgio). O número é sugerido automaticamente a
// partir do contrato + data de emissão (gerarNumeroNota/
// atualizarNumeroNotaAuto), mas pode ser digitado manualmente. Os demais
// dados que não existem no banco (inscrição estadual, condição de
// pagamento) continuam vindo com um valor padrão e ficam editáveis direto
// no documento (contenteditable), sem precisar de colunas novas no banco.
// ---------------------------------------------------------------------

const MESES_PT = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO',
    'AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

// Número da nota: AA (ano da emissão) + MM (mês da emissão) + ID do contrato
// (mínimo 2 dígitos) - mesmo padrão observado no modelo em papel do Sérgio
// (contrato #10, emitida em 10/2026 => nº 261010).
function gerarNumeroNota(contratoId, dataEmissaoIso){

    const d = new Date(dataEmissaoIso + 'T00:00:00');
    const ano2 = String(d.getFullYear()).slice(-2);
    const mes2 = String(d.getMonth() + 1).padStart(2, '0');
    const id2 = String(contratoId).padStart(2, '0');

    return `${ano2}${mes2}${id2}`;

}

// Preenche o campo "Número da nota" automaticamente a partir do contrato +
// data de emissão escolhidos, mas só quando o campo ainda está vazio ou
// contém o último valor que a própria função gerou - assim nunca sobrescreve
// um número digitado manualmente pelo usuário.
function atualizarNumeroNotaAuto(){

    const campoNumero = document.getElementById('notaNumero');
    if(!campoNumero) return;

    const contratoId = document.getElementById('notaContratoId').value;
    const dataEmissaoIso = document.getElementById('notaDataEmissao').value;

    if(!contratoId || !dataEmissaoIso) return;

    if(campoNumero.value && campoNumero.value !== campoNumero.dataset.auto) return;

    const numero = gerarNumeroNota(contratoId, dataEmissaoIso);
    campoNumero.value = numero;
    campoNumero.dataset.auto = numero;

}

function formatarEnderecoCliente(cliente){

    if(!cliente) return '';

    let endereco = cliente.logradouro || '';
    if(cliente.numero_endereco) endereco += (endereco ? ', ' : '') + cliente.numero_endereco;
    if(cliente.bairro) endereco += (endereco ? ' - ' : '') + cliente.bairro;

    return endereco;

}

function montarHtmlNotaLocacao(dados){

    const linhasVeiculos = dados.linhas.map(l => `
        <tr>
            <td contenteditable="true">${l.placa}${l.modelo ? ' - ' + l.modelo : ''}</td>
            <td class="valor" contenteditable="true">${l.valorFmt}</td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nota de Locação Nº ${dados.numero}</title>
<style>
    :root{ --azul:#1b3a6b; --azul-claro:#eaf0fa; }
    *{ box-sizing:border-box; }
    body{ font-family:Arial, Helvetica, sans-serif; background:#e9ecef; margin:0; padding:24px; color:#1a1a1a; }
    .toolbar{ max-width:800px; margin:0 auto 16px; display:flex; justify-content:flex-end; gap:8px; }
    .toolbar button{ padding:9px 18px; border:0; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; }
    .btn-imprimir{ background:var(--azul); color:#fff; }
    .btn-fechar{ background:#dee2e6; color:#333; }
    .folha{ max-width:800px; margin:0 auto; background:#fff; box-shadow:0 4px 18px rgba(0,0,0,.14); border-radius:10px; overflow:hidden; padding:26px; }
    .topo{ display:flex; gap:16px; margin-bottom:18px; align-items:stretch; }
    .caixa{ border:1px solid #c7cdd6; border-radius:8px; padding:12px 14px; }
    .caixa-empresa{ flex:1.15; }
    .caixa-nota{ flex:1; }
    .logo-alugar{ font-size:26px; font-weight:800; letter-spacing:.5px; line-height:1; color:var(--azul); }
    .logo-sub{ font-size:10px; letter-spacing:3px; color:#6c757d; margin-bottom:8px; }
    .caixa-empresa div.linha{ font-size:11px; line-height:1.55; }
    .nota-titulo{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:8px; }
    .nota-titulo h1{ font-size:18px; margin:0; color:var(--azul); letter-spacing:.3px; }
    .nota-numero{ background:var(--azul); color:#fff; font-size:12px; font-weight:700; padding:4px 10px; border-radius:5px; white-space:nowrap; }
    .nota-linha{ font-size:11px; margin-top:7px; }
    .nota-linha b{ font-weight:700; }
    .barra{ background:var(--azul); color:#fff; font-size:12px; font-weight:700; padding:7px 14px; letter-spacing:.5px; border-radius:7px 7px 0 0; }
    .box-dest{ border:1px solid #c7cdd6; border-top:0; border-radius:0 0 7px 7px; padding:10px 14px 12px; margin-bottom:18px; font-size:12px; }
    .dest-linha{ display:flex; gap:24px; padding:3px 0; flex-wrap:wrap; }
    .dest-linha > span{ flex:1; min-width:160px; }
    .dest-linha b{ font-weight:700; }
    table.itens{ width:100%; border-collapse:collapse; font-size:12px; margin-bottom:0; }
    table.itens thead th{ background:var(--azul); color:#fff; padding:8px 14px; text-align:left; font-size:12px; letter-spacing:.3px; }
    table.itens thead th:first-child{ border-radius:7px 0 0 0; }
    table.itens thead th.valor{ text-align:right; width:130px; border-radius:0 7px 0 0; }
    table.itens td{ padding:6px 14px; border-bottom:1px solid #e9ecef; }
    table.itens td.valor{ text-align:right; white-space:nowrap; }
    .subcab td{ background:var(--azul-claro); font-weight:700; }
    .linha-recibo{ text-align:center; font-size:11px; padding:9px; border:1px solid #c7cdd6; border-top:0; color:#444; }
    .barra-total{ display:flex; background:var(--azul); color:#fff; font-weight:700; font-size:12px; }
    .barra-total > div{ padding:9px 14px; }
    .barra-total .rotulo{ flex:1; }
    .barra-total .tag, .barra-total .val{ border-left:1px solid rgba(255,255,255,.35); }
    .barra-total .val{ min-width:140px; text-align:right; }
    .rodape-fiscal{ text-align:center; font-size:10px; font-style:italic; color:#555; padding:7px; border:1px solid #c7cdd6; border-top:0; border-radius:0 0 7px 7px; margin-bottom:18px; }
    .rodape{ display:flex; gap:0; border:1px solid #c7cdd6; border-radius:8px; overflow:hidden; }
    .rodape-selo{ background:var(--azul-claro); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; text-align:center; width:140px; padding:12px; color:var(--azul); }
    .rodape-texto{ flex:1; padding:14px 16px; font-size:11px; line-height:1.6; }
    .assinaturas{ display:flex; gap:40px; margin-top:26px; }
    .assinaturas .campo{ flex:1; border-top:1px solid #333; text-align:center; font-size:10px; padding-top:4px; letter-spacing:.5px; color:#444; }
    [contenteditable="true"]{ border-radius:3px; }
    [contenteditable="true"]:hover, [contenteditable="true"]:focus{ outline:1px dashed #9fb8e8; background:#f8fafd; }
    @media print{
        body{ background:#fff; padding:0; }
        .toolbar{ display:none; }
        .folha{ box-shadow:none; border-radius:0; max-width:none; }
        [contenteditable="true"]:hover, [contenteditable="true"]:focus{ outline:none; background:none; }
    }
</style>
</head>
<body>

    <div class="toolbar">
        <button class="btn-imprimir" onclick="window.print()">Imprimir / Salvar PDF</button>
        <button class="btn-fechar" onclick="window.close()">Fechar</button>
    </div>

    <div class="folha">

        <div class="topo">
            <div class="caixa caixa-empresa">
                <div class="logo-alugar">ALUGAR</div>
                <div class="logo-sub">RENT A CAR</div>
                <div class="linha"><b>SH SERVIÇOS DE TECNOLOGIA DA INFORMAÇÃO LTDA ME</b></div>
                <div class="linha">CNPJ: 01.181.453/0001-89</div>
                <div class="linha">Rua Celio Veiga, 510</div>
                <div class="linha">Barreiros: São José / SC - CEP: 88111-320</div>
            </div>
            <div class="caixa caixa-nota">
                <div class="nota-titulo">
                    <h1>NOTA DE LOCAÇÃO</h1>
                    <span class="nota-numero">Nº ${dados.numero}</span>
                </div>
                <div class="nota-linha"><b>NATUREZA DA OPERAÇÃO:</b> LOCAÇÃO DE VEÍCULOS</div>
                <div class="nota-linha"><b>DATA DA EMISSÃO:</b> ${dados.dataEmissaoFmt}</div>
            </div>
        </div>

        <div class="barra">DESTINATÁRIO</div>
        <div class="box-dest">
            <div class="dest-linha"><span><b>NOME:</b> <span contenteditable="true">${dados.nomeCliente}</span></span></div>
            <div class="dest-linha">
                <span><b>ENDEREÇO:</b> <span contenteditable="true">${dados.endereco}</span></span>
                <span><b>CEP:</b> <span contenteditable="true">${dados.cep}</span></span>
            </div>
            <div class="dest-linha">
                <span><b>MUNICÍPIO:</b> <span contenteditable="true">${dados.cidade}</span></span>
                <span><b>ESTADO:</b> <span contenteditable="true">${dados.uf}</span></span>
            </div>
            <div class="dest-linha">
                <span><b>CNPJ/CPF:</b> <span contenteditable="true">${dados.cnpj}</span></span>
                <span><b>INSCR. ESTADUAL:</b> <span contenteditable="true"></span></span>
            </div>
            <div class="dest-linha">
                <span><b>COND. PAGAMENTO:</b> <span contenteditable="true">BOLETO</span></span>
                <span><b>VENC.:</b> <span contenteditable="true">${dados.vencimentoFmt || ''}</span></span>
            </div>
        </div>

        <table class="itens">
            <thead>
                <tr><th>DISCRIMINAÇÃO</th><th class="valor">VALOR</th></tr>
            </thead>
            <tbody>
                <tr class="subcab"><td colspan="2">LOCAÇÃO DE VEÍCULOS - MÊS DE ${dados.mesRefLabel}</td></tr>
                ${linhasVeiculos}
            </tbody>
        </table>
        <div class="linha-recibo">Nota/Recibo de simples repasse de valores</div>
        <div class="barra-total">
            <div class="rotulo">NÃO TEM VALOR COMO RECIBO</div>
            <div class="tag">VALOR TOTAL</div>
            <div class="val">${dados.totalFmt}</div>
        </div>
        <div class="rodape-fiscal">NÃO TRIBUTADA POR ISS CONFORME LEI COMPLEMENTAR Nº 116 DE 31 DE JULHO DE 2003</div>

        <div class="rodape">
            <div class="rodape-selo">NOTA DE<br>LOCAÇÃO</div>
            <div class="rodape-texto">
                <div contenteditable="true">RECEBEMOS DA ALUGAR LOCADORA DE AUTOMÓVEIS LTDA, A NOTA DE LOCAÇÃO AO LADO NUMERADA, CORRESPONDENTE À LOCAÇÃO DE VEÍCULOS.</div>
                <div class="assinaturas">
                    <div class="campo">DATA</div>
                    <div class="campo">ASSINATURA</div>
                </div>
            </div>
        </div>

    </div>

</body>
</html>`;

}

async function gerarNotaLocacao(){

    const contratoId = document.getElementById('notaContratoId').value;

    if(!contratoId){
        alert('Selecione o contrato.');
        return;
    }

    const contrato = todosContratos.find(c => c.id === Number(contratoId));

    if(!contrato){
        alert('Contrato não encontrado - recarregue a página e tente de novo.');
        return;
    }

    const {data: vinculos, error} = await supabaseClient
        .from('contratos_veiculos')
        .select('valor, veiculos(placa, modelo)')
        .eq('contrato_id', Number(contratoId));

    if(error){
        alert('Erro ao carregar os veículos do contrato: ' + error.message);
        return;
    }

    if(!vinculos || vinculos.length === 0){
        alert('Este contrato não tem veículos vinculados.');
        return;
    }

    // Mesma regra de fallback usada na seção "Veículos e Contratos" acima:
    // usa o valor próprio do veículo (contratos_veiculos.valor) quando
    // preenchido, senão divide o valor total do contrato igualmente entre
    // os veículos vinculados.
    const linhas = vinculos.map(v => {
        const valor = v.valor != null ? Number(v.valor) : (Number(contrato.valor || 0) / vinculos.length);
        return {
            placa: v.veiculos?.placa || '',
            modelo: v.veiculos?.modelo || '',
            valor,
            valorFmt: valor.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
        };
    });

    const total = linhas.reduce((soma, l) => soma + l.valor, 0);

    const mesRefValor = document.getElementById('notaMesReferencia').value || new Date().toISOString().slice(0, 7);
    const mesRefLabel = MESES_PT[Number(mesRefValor.split('-')[1]) - 1] || '';

    const dataEmissaoIso = document.getElementById('notaDataEmissao').value || new Date().toISOString().slice(0, 10);
    const dataEmissaoFmt = new Date(dataEmissaoIso + 'T00:00:00').toLocaleDateString('pt-BR');

    const numeroInformado = (document.getElementById('notaNumero').value || '').trim();
    const numero = numeroInformado || gerarNumeroNota(contratoId, dataEmissaoIso);

    const vencimentoIso = document.getElementById('notaVencimento').value;
    const vencimentoFmt = vencimentoIso ? new Date(vencimentoIso + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    const cliente = contrato.clientes || {};

    const html = montarHtmlNotaLocacao({
        numero,
        dataEmissaoFmt,
        vencimentoFmt,
        mesRefLabel,
        nomeCliente: cliente.nome || '',
        endereco: formatarEnderecoCliente(cliente),
        cep: cliente.cep || '',
        cidade: cliente.cidade || '',
        uf: cliente.uf || '',
        cnpj: cliente.cpf_cnpj || '',
        linhas,
        totalFmt: total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
    });

    const janela = window.open('', '_blank');

    if(!janela){
        alert('O navegador bloqueou a abertura da nova aba. Permita pop-ups para este site e tente de novo.');
        return;
    }

    janela.document.write(html);
    janela.document.close();

}

checarLogin();
carregarContratosDisponiveis();
carregarVeiculosFaturamento();
