// Lógica da página Veículos > Histórico de Manutenções.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
// Tabela manutencao_historico: veiculo_id (FK para veiculos.id), data, local,
// servico, km, valor, forma_pagamento, observacao, troca_oleo_km,
// troca_correia_km, reembolso, a_cobrar.
//
// Alerta "A COBRAR": agora é um campo manual (checkbox "A cobrar" no
// formulário), não é mais calculado automaticamente a partir de valor x
// reembolso. Ao criar um lançamento novo o checkbox já vem marcado (mesmo
// critério de antes, como sugestão), mas o usuário pode marcar ou
// desmarcar livremente, tanto ao criar quanto ao editar.
//
// Ao lado do combo de veículo (placa), mostramos Renavam/Ano/Motor do
// veículo selecionado (tabela veiculos - motor é um campo de texto livre,
// preenchido em Veículos). São só exibição aqui, não fazem parte do
// lançamento de manutenção.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'historico_manutencoes';

let editandoId = null;
let veiculoSelecionadoId = null;

// Dados (renavam/ano/motor) de cada veículo, indexados por id, para exibir
// ao lado da placa sem precisar buscar de novo a cada troca de veículo.
let veiculosInfo = {};

// Preenche o <select> de veículos, mostrando Placa - Fabricante Modelo
// (mesmo padrão de atividades.js/manutencao.js).
async function carregarVeiculos(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('id,placa,fabricante,modelo,renavam,ano,motor')
        .order('placa');

    if(error){
        alert(error.message);
        return;
    }

    const select = document.getElementById('veiculoId');
    const valorAtual = select.value;

    let html = '<option value="" selected disabled>Selecione o veículo</option>';

    veiculosInfo = {};

    (data || []).forEach(v => {
        const rotulo = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        html += `<option value="${v.id}">${rotulo}</option>`;
        veiculosInfo[v.id] = {renavam: v.renavam, ano: v.ano, motor: v.motor};
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

// Mostra Renavam/Ano/Motor do veículo selecionado ao lado da placa.
function atualizarInfoVeiculo(veiculoId){
    const info = veiculosInfo[veiculoId] || {};
    document.getElementById('infoRenavam').textContent = info.renavam || '-';
    document.getElementById('infoAno').textContent = info.ano || '-';
    document.getElementById('infoMotor').textContent = info.motor || '-';
}

function formatarMoeda(valor){
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

// Um lançamento fica "A COBRAR" quando o campo manual a_cobrar está marcado.
function estaACobrar(m){
    return m.a_cobrar === true;
}

async function carregar(){

    await carregarVeiculos();

    if(veiculoSelecionadoId){
        document.getElementById('veiculoId').value = veiculoSelecionadoId;
    }

    await carregarHistorico();

}

// Chamado ao trocar o veículo selecionado no combo.
async function aoTrocarVeiculo(){
    veiculoSelecionadoId = document.getElementById('veiculoId').value;
    cancelarEdicao();
    await carregarHistorico();
}

async function carregarHistorico(){

    const veiculoId = document.getElementById('veiculoId').value;
    veiculoSelecionadoId = veiculoId || null;

    atualizarInfoVeiculo(veiculoId);

    const resumo = document.getElementById('resumoVeiculo');

    if(!veiculoId){
        document.getElementById('lista').innerHTML = '';
        resumo.classList.add('d-none');
        return;
    }

    const {data, error} = await supabaseClient
        .from('manutencao_historico')
        .select('*')
        .eq('veiculo_id', veiculoId)
        .order('data', {ascending: true});

    if(error){
        alert(error.message);
        return;
    }

    let totalGasto = 0;
    let totalPendente = 0;
    let html = '';

    (data || []).forEach(m => {

        const valor = Number(m.valor) || 0;
        totalGasto += valor;

        const aCobrar = estaACobrar(m);
        if(aCobrar){
            totalPendente += valor;
        }

        const dataFmt = m.data ? new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const alertaHtml = aCobrar
            ? '<span class="badge text-bg-danger">&#9888; A COBRAR</span>'
            : '';

        html += `

        <tr class="${aCobrar ? 'table-danger' : ''}">

            <td>${dataFmt}</td>
            <td>${m.local ?? ''}</td>
            <td>${m.servico ?? ''}</td>
            <td>${m.km ?? ''}</td>
            <td>${m.valor !== null && m.valor !== undefined ? formatarMoeda(m.valor) : ''}</td>
            <td>${m.forma_pagamento ?? ''}</td>
            <td>${m.observacao ?? ''}</td>
            <td>${m.troca_oleo_km ?? ''}</td>
            <td>${m.troca_correia_km ?? ''}</td>
            <td>${m.reembolso !== null && m.reembolso !== undefined ? formatarMoeda(m.reembolso) : ''}</td>
            <td>${alertaHtml}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${m.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${m.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>

        </tr>

        `;

    });

    document.getElementById('lista').innerHTML = html;

    document.getElementById('totalGasto').textContent = formatarMoeda(totalGasto);
    document.getElementById('totalPendente').textContent = formatarMoeda(totalPendente);
    resumo.classList.remove('d-none');

}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('manutencao_historico')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById('data').value = data.data ?? '';
    document.getElementById('local').value = data.local ?? '';
    document.getElementById('servico').value = data.servico ?? '';
    document.getElementById('km').value = data.km ?? '';
    document.getElementById('valor').value = data.valor ?? '';
    document.getElementById('formaPagamento').value = data.forma_pagamento ?? '';
    document.getElementById('observacao').value = data.observacao ?? '';
    document.getElementById('trocaOleoKm').value = data.troca_oleo_km ?? '';
    document.getElementById('trocaCorreiaKm').value = data.troca_correia_km ?? '';
    document.getElementById('reembolso').value = data.reembolso ?? '';
    document.getElementById('aCobrar').checked = data.a_cobrar === true;

    document.getElementById('btnSalvar').textContent = 'Atualizar';
    document.getElementById('btnCancelar').classList.remove('d-none');

    document.getElementById('data').focus();

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById('data').value = '';
    document.getElementById('local').value = '';
    document.getElementById('servico').value = '';
    document.getElementById('km').value = '';
    document.getElementById('valor').value = '';
    document.getElementById('formaPagamento').value = '';
    document.getElementById('observacao').value = '';
    document.getElementById('trocaOleoKm').value = '';
    document.getElementById('trocaCorreiaKm').value = '';
    document.getElementById('reembolso').value = '';
    document.getElementById('aCobrar').checked = true;

    document.getElementById('btnSalvar').textContent = 'Salvar';
    document.getElementById('btnCancelar').classList.add('d-none');

}

async function excluir(id){

    if(!confirm(`Excluir este lançamento de manutenção #${id}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('manutencao_historico')
        .delete()
        .eq('id', id);

    if(error){
        alert(error.message);
        return;
    }

    if(editandoId === id){
        cancelarEdicao();
    }

    carregarHistorico();

}

async function salvar(){

    const veiculoId = document.getElementById('veiculoId').value;

    if(!veiculoId){
        alert('Selecione o veículo.');
        return;
    }

    const data_ = document.getElementById('data').value;
    const local = document.getElementById('local').value.trim();
    const servico = document.getElementById('servico').value.trim();
    const km = document.getElementById('km').value;
    const valor = document.getElementById('valor').value;
    const formaPagamento = document.getElementById('formaPagamento').value.trim();
    const observacao = document.getElementById('observacao').value.trim();
    const trocaOleoKm = document.getElementById('trocaOleoKm').value;
    const trocaCorreiaKm = document.getElementById('trocaCorreiaKm').value;
    const reembolso = document.getElementById('reembolso').value;
    const aCobrar = document.getElementById('aCobrar').checked;

    const dados = {
        veiculo_id: Number(veiculoId),
        data: data_ || null,
        local: local || null,
        servico: servico || null,
        km: km ? Number(km) : null,
        valor: valor !== '' ? Number(valor) : null,
        forma_pagamento: formaPagamento || null,
        observacao: observacao || null,
        troca_oleo_km: trocaOleoKm ? Number(trocaOleoKm) : null,
        troca_correia_km: trocaCorreiaKm ? Number(trocaCorreiaKm) : null,
        reembolso: reembolso !== '' ? Number(reembolso) : null,
        a_cobrar: aCobrar
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('manutencao_historico')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('manutencao_historico')
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregarHistorico();

}

checarLogin();
