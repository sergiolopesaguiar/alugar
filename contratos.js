// Lógica da página de Contratos.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Um contrato pode ter vários veículos vinculados. Por isso não existe um
// campo único "veiculo" na tabela contratos - em vez disso, a tabela
// contratos_veiculos guarda a relação N-N (contrato_id, veiculo_id). Ao
// salvar, sempre apagamos e recriamos as linhas de contratos_veiculos do
// contrato atual a partir dos checkboxes marcados - é a forma mais simples
// de manter a lista de veículos em dia tanto na criação quanto na edição.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'contratos';

let editandoId = null;

async function carregarVeiculosDisponiveis(veiculosMarcados){

    const marcados = veiculosMarcados || [];

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('id, placa, modelo')
        .order('placa');

    const container = document.getElementById('listaVeiculosContrato');

    if(error){
        container.innerHTML = `<p class="text-danger mb-0">Erro ao carregar veículos: ${error.message}</p>`;
        return;
    }

    if(!data || data.length === 0){
        container.innerHTML = '<p class="text-muted mb-0">Nenhum veículo cadastrado ainda.</p>';
        return;
    }

    let html = '';

    data.forEach(v => {
        const marcado = marcados.includes(v.id) ? 'checked' : '';
        const descricao = v.modelo ? `${v.placa} - ${v.modelo}` : v.placa;
        html += `
        <div class="form-check">
            <input class="form-check-input" type="checkbox" value="${v.id}" id="veiculo_${v.id}" ${marcado}>
            <label class="form-check-label" for="veiculo_${v.id}">${descricao}</label>
        </div>
        `;
    });

    container.innerHTML = html;

}

function veiculosSelecionados(){

    return Array.from(document.querySelectorAll('#listaVeiculosContrato input[type="checkbox"]:checked'))
        .map(el => Number(el.value));

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

    const veiculoIds = (data.contratos_veiculos || []).map(cv => cv.veiculo_id);

    await carregarVeiculosDisponiveis(veiculoIds);

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

    await carregarVeiculosDisponiveis([]);

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

    // Recria a lista de veículos vinculados a partir dos checkboxes marcados.
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
carregarVeiculosDisponiveis([]);
