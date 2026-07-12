// Lógica da página de Contratos.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Um contrato pode ter vários veículos vinculados. Por isso não existe um
// campo único "veiculo" na tabela contratos - em vez disso, a tabela
// contratos_veiculos guarda a relação N-N (contrato_id, veiculo_id). Ao
// salvar, sempre apagamos e recriamos as linhas de contratos_veiculos do
// contrato atual a partir da lista de veículos adicionados - é a forma mais
// simples de manter a lista em dia tanto na criação quanto na edição.
//
// Seleção dos veículos: um combobox (select) + botão "Adicionar", em vez de
// checkboxes - com muitos veículos cadastrados, uma lista de checkbox longa
// fica ruim de usar. Cada veículo adicionado aparece como uma linha com um
// botão de remover, e some do combobox pra não deixar adicionar duplicado.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'contratos';

let editandoId = null;
let todosVeiculos = []; // {id, placa, modelo} - carregado uma vez
let veiculosDoContrato = []; // ids dos veículos já adicionados ao contrato em edição/criação

async function carregarVeiculosDisponiveis(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('id, placa, modelo')
        .order('placa');

    if(error){
        document.getElementById('comboVeiculos').innerHTML = `<option value="" selected disabled>Erro ao carregar veículos</option>`;
        return;
    }

    todosVeiculos = data || [];

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

}

function descricaoVeiculo(v){
    return v.modelo ? `${v.placa} - ${v.modelo}` : v.placa;
}

function atualizarComboVeiculos(){

    const combo = document.getElementById('comboVeiculos');

    const disponiveis = todosVeiculos.filter(v => !veiculosDoContrato.includes(v.id));

    if(disponiveis.length === 0){
        combo.innerHTML = '<option value="" selected disabled>Nenhum veículo disponível</option>';
        return;
    }

    let html = '<option value="" selected disabled>Selecione um veículo...</option>';

    disponiveis.forEach(v => {
        html += `<option value="${v.id}">${descricaoVeiculo(v)}</option>`;
    });

    combo.innerHTML = html;

}

function renderizarVeiculosDoContrato(){

    const container = document.getElementById('listaVeiculosContrato');

    if(veiculosDoContrato.length === 0){
        container.innerHTML = '<p class="text-muted mb-0" id="mensagemSemVeiculos">Nenhum veículo adicionado ainda.</p>';
        return;
    }

    let html = '';

    veiculosDoContrato.forEach(id => {
        const v = todosVeiculos.find(item => item.id === id);
        const descricao = v ? descricaoVeiculo(v) : `#${id}`;
        html += `
        <div class="d-flex justify-content-between align-items-center py-1">
            <span>${descricao}</span>
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="removerVeiculoDoContrato(${id})">Remover</button>
        </div>
        `;
    });

    container.innerHTML = html;

}

function adicionarVeiculoAoContrato(){

    const combo = document.getElementById('comboVeiculos');
    const id = Number(combo.value);

    if(!id){
        return;
    }

    if(!veiculosDoContrato.includes(id)){
        veiculosDoContrato.push(id);
    }

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

}

function removerVeiculoDoContrato(id){

    veiculosDoContrato = veiculosDoContrato.filter(item => item !== id);

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

}

function veiculosSelecionados(){

    return veiculosDoContrato;

}

async function carregar(){

    const {data, error} = await supabaseClient
        .from('contratos')
        .select('*, contratos_veiculos(veiculo_id, veiculos(placa))')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(c => {

        const placas = (c.contratos_veiculos || [])
            .map(cv => cv.veiculos?.placa)
            .filter(Boolean)
            .join(', ') || '(nenhum)';

        const dataInicial = c.data_inicial ? new Date(c.data_inicial + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const dataFinal = c.data_final ? new Date(c.data_final + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const valor = c.valor != null ? Number(c.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.cnpj}</td>
            <td>${dataInicial}</td>
            <td>${dataFinal}</td>
            <td>${valor}</td>
            <td>${placas}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editar(${c.id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluir(${c.id})">Excluir</button>
            </td>
        </tr>
        `;

    });

    document.getElementById("lista").innerHTML = html;

}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('contratos')
        .select('*, contratos_veiculos(veiculo_id)')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("cnpj").value = data.cnpj ?? '';
    document.getElementById("data_inicial").value = data.data_inicial ?? '';
    document.getElementById("data_final").value = data.data_final ?? '';
    document.getElementById("valor").value = data.valor ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    veiculosDoContrato = (data.contratos_veiculos || []).map(cv => cv.veiculo_id);

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

async function cancelarEdicao(){

    editandoId = null;

    document.getElementById("cnpj").value = '';
    document.getElementById("data_inicial").value = '';
    document.getElementById("data_final").value = '';
    document.getElementById("valor").value = '';
    document.getElementById("observacao").value = '';

    veiculosDoContrato = [];

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('contratos')
        .select('cnpj')
        .eq('id', id)
        .single();

    const cnpj = data?.cnpj || '(sem CNPJ)';

    if(!confirm(`Excluir o contrato #${id} - ${cnpj}? Essa ação não pode ser desfeita.`)){
        return;
    }

    // A exclusão de contratos_veiculos acontece automaticamente (on delete cascade).
    const {error} = await supabaseClient
        .from('contratos')
        .delete()
        .eq('id', id);

    if(error){
        alert(error.message);
        return;
    }

    if(editandoId === id){
        await cancelarEdicao();
    }

    carregar();

}

async function salvar(){

    const cnpj = document.getElementById("cnpj").value.trim();
    const dataInicial = document.getElementById("data_inicial").value;
    const dataFinal = document.getElementById("data_final").value;
    const valorValor = document.getElementById("valor").value;
    const observacao = document.getElementById("observacao").value;

    if(!cnpj){
        alert('Preencha o CNPJ.');
        return;
    }

    const dados = {
        cnpj,
        data_inicial: dataInicial || null,
        data_final: dataFinal || null,
        valor: valorValor ? Number(valorValor) : null,
        observacao: observacao || null
    };

    let contratoId = editandoId;
    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('contratos')
            .update(dados)
            .eq('id', editandoId));

    } else {

        const resposta = await supabaseClient
            .from('contratos')
            .insert(dados)
            .select('id')
            .single();

        error = resposta.error;
        contratoId = resposta.data?.id;

    }

    if(error){
        alert(error.message);
        return;
    }

    // Recria a lista de veículos vinculados a partir dos veículos adicionados na tela.
    const idsSelecionados = veiculosSelecionados();

    const {error: erroLimpeza} = await supabaseClient
        .from('contratos_veiculos')
        .delete()
        .eq('contrato_id', contratoId);

    if(erroLimpeza){
        alert('Contrato salvo, mas houve erro ao atualizar os veículos vinculados: ' + erroLimpeza.message);
        cancelarEdicao();
        carregar();
        return;
    }

    if(idsSelecionados.length > 0){

        const linhas = idsSelecionados.map(veiculo_id => ({contrato_id: contratoId, veiculo_id}));

        const {error: erroVinculo} = await supabaseClient
            .from('contratos_veiculos')
            .insert(linhas);

        if(erroVinculo){
            alert('Contrato salvo, mas houve erro ao vincular os veículos: ' + erroVinculo.message);
        }

    }

    await cancelarEdicao();

    carregar();

}

checarLogin();
carregarVeiculosDisponiveis();
