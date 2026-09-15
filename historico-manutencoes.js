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
//
// Botão principal do formulário: "Incluir Serviço" quando não está
// editando (insere um lançamento novo) e "Atualizar" quando está editando
// um lançamento existente (editandoId preenchido).
//
// Confirmações de segurança:
// - Atualizar (editar um lançamento existente): pede confirmação simples
//   antes de gravar, para evitar atualização/perda de dados sem querer.
// - Excluir: pede uma senha (0777) antes de apagar - não é criptografia
//   nem controle de acesso real, só uma trava extra contra clique
//   acidental no ícone de lixeira.

//
// Alerta automático de manutenção (verificarNecessidadeManutencao):
// logo após INSERIR um lançamento novo com KM informado, comparamos esse
// KM com o maior troca_oleo_km já registrado para o veículo (excluindo o
// próprio lançamento recém-inserido). Se a diferença passar de 9000km, o
// veículo precisa de manutenção: criamos automaticamente uma atividade
// "AGENDAR OFICINA" (status "Pendente", data_previsao = hoje) na tabela
// atividades, vinculada ao veículo e ao condutor atual (condutores.veiculo_id
// com data_fim nula). Não dispara ao editar um lançamento existente, só ao
// incluir um novo, e não duplica se já existir uma atividade "AGENDAR
// OFICINA" pendente para o veículo.

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
        .order('data', {ascending: false});

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

    document.getElementById('btnSalvar').textContent = 'Incluir Serviço';
    document.getElementById('btnCancelar').classList.add('d-none');

}

// Exclusão exige a senha "0777" digitada na hora, além da confirmação -
// evita apagar um lançamento sem querer ao clicar no ícone de lixeira.
async function excluir(id){

    const senha = prompt(`Para excluir o lançamento de manutenção #${id}, digite a senha de confirmação:`);

    if(senha === null){
        return;
    }

    if(senha !== '0777'){
        alert('Senha incorreta. Exclusão cancelada.');
        return;
    }

    if(!confirm(`Confirma a exclusão deste lançamento de manutenção #${id}? Essa ação não pode ser desfeita.`)){
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

// Após inserir um novo lançamento de manutenção com KM informado, verifica
// se esse KM já passou de 9000km em relação à última troca de óleo
// (troca_oleo_km) já registrada para o veículo. Se sim, o veículo precisa
// de manutenção: criamos automaticamente uma atividade "AGENDAR OFICINA"
// pendente na tabela atividades, vinculada ao veículo e ao condutor atual.
async function verificarNecessidadeManutencao(veiculoId, kmAtual, idInserido){

    if(!kmAtual){
        return;
    }

    // Maior troca_oleo_km já registrada para o veículo, excluindo o
    // lançamento que acabou de ser inserido (para não comparar uma troca
    // de óleo feita agora contra o próprio KM atual).
    const {data: historico, error: erroHistorico} = await supabaseClient
        .from('manutencao_historico')
        .select('troca_oleo_km')
        .eq('veiculo_id', veiculoId)
        .not('troca_oleo_km', 'is', null)
        .neq('id', idInserido)
        .order('troca_oleo_km', {ascending: false})
        .limit(1);

    if(erroHistorico || !historico || !historico.length){
        return;
    }

    const ultimaTrocaOleoKm = historico[0].troca_oleo_km;

    if((kmAtual - ultimaTrocaOleoKm) <= 9000){
        return;
    }

    // Evita duplicar: se já existe uma atividade "AGENDAR OFICINA"
    // pendente para este veículo, não cria outra a cada novo lançamento.
    const {data: pendentes} = await supabaseClient
        .from('atividades')
        .select('id')
        .eq('veiculo_id', veiculoId)
        .eq('tipo_atividade', 'AGENDAR OFICINA')
        .eq('status', 'Pendente')
        .limit(1);

    if(pendentes && pendentes.length){
        return;
    }

    // Condutor atual do veículo: registro em condutores sem data_fim
    // preenchida (o mais recente pela data_inicio, caso haja mais de um).
    const {data: condutorAtual} = await supabaseClient
        .from('condutores')
        .select('id')
        .eq('veiculo_id', veiculoId)
        .is('data_fim', null)
        .order('data_inicio', {ascending: false})
        .limit(1);

    const condutorId = (condutorAtual && condutorAtual.length) ? condutorAtual[0].id : null;

    const hoje = new Date().toISOString().slice(0, 10);

    const {error: erroAtividade} = await supabaseClient
        .from('atividades')
        .insert({
            veiculo_id: Number(veiculoId),
            condutor_id: condutorId,
            tipo_atividade: 'AGENDAR OFICINA',
            data_previsao: hoje,
            status: 'Pendente',
            km: kmAtual,
            observacao: 'TROCA DE OLEO'
        });

    if(erroAtividade){
        alert('Este veículo precisa de manutenção (mais de 9.000km desde a última troca de óleo), mas houve um erro ao criar a atividade automática: ' + erroAtividade.message);
        return;
    }

    alert('Atenção: este veículo já rodou mais de 9.000km desde a última troca de óleo. Uma atividade "AGENDAR OFICINA" foi criada automaticamente na tela de Atividades.');

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

        if(!confirm('Confirma a atualização deste lançamento de manutenção?')){
            return;
        }

        ({error} = await supabaseClient
            .from('manutencao_historico')
            .update(dados)
            .eq('id', editandoId));

    } else {

        const resultado = await supabaseClient
            .from('manutencao_historico')
            .insert(dados)
            .select('id')
            .single();

        error = resultado.error;

        if(!error && dados.km && resultado.data){
            await verificarNecessidadeManutencao(dados.veiculo_id, dados.km, resultado.data.id);
        }

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregarHistorico();

}

checarLogin();
