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

// Um contrato só pode ser feito para um cliente já cadastrado - por isso o
// campo de cliente é um combobox (select) alimentado pela tabela clientes,
// gravando cliente_id (FK) em vez de digitar o CNPJ à mão. O CNPJ exibido
// na listagem vem do embedding do PostgREST (clientes.cpf_cnpj).

let editandoId = null;
let todosVeiculos = []; // {id, placa, modelo} - carregado uma vez
let veiculosDoContrato = []; // ids dos veículos já adicionados ao contrato em edição/criação

// Um veículo não pode estar em dois contratos ativos ao mesmo tempo. Contrato
// ativo = data_final vazia OU data_final ainda não vencida (>= hoje). Este
// Set guarda os ids de veículos já presos a um contrato ativo QUALQUER,
// exceto o próprio contrato em edição (senão o veículo sumiria do combo ao
// tentar editar o contrato que já o contém). Recalculado sempre que
// editandoId muda (editar/cancelarEdicao) e no carregamento inicial.
let veiculosBloqueados = new Set();

async function carregarVeiculosBloqueados(excluirContratoId){

    const {data, error} = await supabaseClient
        .from('contratos_veiculos')
        .select('veiculo_id, contrato_id, contratos(data_final)');

    if(error){
        veiculosBloqueados = new Set();
        return;
    }

    const hoje = new Date().toISOString().slice(0,10);

    veiculosBloqueados = new Set(
        (data || [])
            .filter(cv => cv.contrato_id !== excluirContratoId)
            .filter(cv => {
                const dataFinal = cv.contratos?.data_final;
                return !dataFinal || dataFinal >= hoje;
            })
            .map(cv => cv.veiculo_id)
    );

}

async function carregarClientesDisponiveis(){

    const {data, error} = await supabaseClient
        .from('clientes')
        .select('id, nome, cpf_cnpj')
        .order('nome');

    const select = document.getElementById('cliente_id');

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar clientes</option>';
        return;
    }

    let html = '<option value="" selected disabled>Selecione o cliente...</option>';

    (data || []).forEach(c => {
        const rotulo = c.cpf_cnpj ? `${c.nome} - ${c.cpf_cnpj}` : c.nome;
        html += `<option value="${c.id}">${rotulo}</option>`;
    });

    select.innerHTML = html;

}

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

    await carregarVeiculosBloqueados(editandoId);

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

}

function descricaoVeiculo(v){
    return v.modelo ? `${v.placa} - ${v.modelo}` : v.placa;
}

function atualizarComboVeiculos(){

    const combo = document.getElementById('comboVeiculos');

    const disponiveis = todosVeiculos.filter(v => !veiculosDoContrato.includes(v.id) && !veiculosBloqueados.has(v.id));

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
        .select('*, clientes(nome, cpf_cnpj), contratos_veiculos(veiculo_id, veiculos(placa))')
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
            <td>${c.clientes?.nome ?? ''}</td>
            <td>${c.clientes?.cpf_cnpj ?? ''}</td>
            <td>${dataInicial}</td>
            <td>${dataFinal}</td>
            <td>${valor}</td>
            <td>${placas}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${c.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${c.id})"><i class="bi bi-trash"></i></button>
                </div>
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

    document.getElementById("cliente_id").value = data.cliente_id ?? '';
    document.getElementById("data_inicial").value = data.data_inicial ?? '';
    document.getElementById("data_final").value = data.data_final ?? '';
    document.getElementById("valor").value = data.valor ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    veiculosDoContrato = (data.contratos_veiculos || []).map(cv => cv.veiculo_id);

    await carregarVeiculosBloqueados(editandoId);

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("cliente_id").focus();

}

async function cancelarEdicao(){

    editandoId = null;

    document.getElementById("cliente_id").value = '';
    document.getElementById("data_inicial").value = '';
    document.getElementById("data_final").value = '';
    document.getElementById("valor").value = '';
    document.getElementById("observacao").value = '';

    veiculosDoContrato = [];

    await carregarVeiculosBloqueados(null);

    atualizarComboVeiculos();
    renderizarVeiculosDoContrato();

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('contratos')
        .select('clientes(nome)')
        .eq('id', id)
        .single();

    const nomeCliente = data?.clientes?.nome || '(sem cliente)';

    if(!confirm(`Excluir o contrato #${id} - ${nomeCliente}? Essa ação não pode ser desfeita.`)){
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

    const clienteId = document.getElementById("cliente_id").value;
    const dataInicial = document.getElementById("data_inicial").value;
    const dataFinal = document.getElementById("data_final").value;
    const valorValor = document.getElementById("valor").value;
    const observacao = document.getElementById("observacao").value;

    if(!clienteId){
        alert('Selecione o cliente.');
        return;
    }

    // Revalida no banco, na hora de salvar, que nenhum veículo selecionado está
    // em outro contrato ativo (data_final vazia ou não vencida). O combo já
    // esconde esses veículos, mas esta checagem cobre o caso de duas abas
    // editando ao mesmo tempo.
    const idsSelecionados = veiculosSelecionados();

    if(idsSelecionados.length > 0){

        const {data: vinculos, error: erroValidacao} = await supabaseClient
            .from('contratos_veiculos')
            .select('veiculo_id, contrato_id, contratos(data_final)')
            .in('veiculo_id', idsSelecionados);

        if(erroValidacao){
            alert('Erro ao validar veículos: ' + erroValidacao.message);
            return;
        }

        const hoje = new Date().toISOString().slice(0,10);

        const conflitos = (vinculos || []).filter(v => {
            if(editandoId && v.contrato_id === editandoId) return false;
            const dataFinal = v.contratos?.data_final;
            return !dataFinal || dataFinal >= hoje;
        });

        if(conflitos.length > 0){
            const descricoes = conflitos
                .map(c => todosVeiculos.find(v => v.id === c.veiculo_id))
                .filter(Boolean)
                .map(descricaoVeiculo)
                .join(', ');
            alert(`Não é possível salvar: o(s) veículo(s) ${descricoes || 'selecionado(s)'} já está(ão) em um contrato ativo.`);
            return;
        }

    }

    const dados = {
        cliente_id: Number(clienteId),
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

    // Recria a lista de veículos vinculados a partir dos veículos adicionados na tela
    // (idsSelecionados já validado acima, contra conflito de contrato ativo).
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
carregarClientesDisponiveis();
carregarVeiculosDisponiveis();
