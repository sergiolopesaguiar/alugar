// Lógica da página de Atividades.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Veículo e condutor são ambos opcionais - uma atividade pode ser registrada
// sem vínculo com nenhum veículo específico. Registra tipo de atividade,
// data prevista, status, km no momento e observação.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'atividades';

let editandoId = null;

// Preenche o <select> de veículos, mostrando Placa - Fabricante Modelo.
async function carregarVeiculos(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('id, placa, fabricante, modelo')
        .order('placa');

    const select = document.getElementById('veiculoId');
    const valorAtual = select.value;

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar veículos</option>';
        return;
    }

    let html = '<option value="">(sem veículo)</option>';

    (data || []).forEach(v => {
        const rotulo = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        html += `<option value="${v.id}">${rotulo}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

// Preenche o <select> de condutores (campo opcional).
async function carregarCondutores(){

    const {data, error} = await supabaseClient
        .from('condutores')
        .select('id, nome')
        .order('nome');

    const select = document.getElementById('condutorId');
    const valorAtual = select.value;

    if(error){
        select.innerHTML = '<option value="">Erro ao carregar condutores</option>';
        return;
    }

    let html = '<option value="">(sem condutor)</option>';

    (data || []).forEach(c => {
        html += `<option value="${c.id}">${c.nome}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

async function carregar(){

    await carregarVeiculos();
    await carregarCondutores();

    const {data, error} = await supabaseClient
        .from('atividades')
        .select('*, veiculos(placa, fabricante, modelo), condutores(nome)')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(a => {

        const veiculo = a.veiculos
            ? [a.veiculos.placa, [a.veiculos.fabricante, a.veiculos.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
            : '<span class="text-danger">(sem veículo)</span>';

        const condutor = a.condutores?.nome ?? '';
        const dataFmt = a.data_previsao ? new Date(a.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const statusCor = a.status === 'Concluída' ? 'bg-success' : 'bg-warning text-dark';

        html += `
        <tr>
            <td>${a.id}</td>
            <td>${veiculo}</td>
            <td>${condutor}</td>
            <td>${a.tipo_atividade ?? ''}</td>
            <td>${dataFmt}</td>
            <td><span class="badge ${statusCor}">${a.status ?? 'Pendente'}</span></td>
            <td>${a.km ?? ''}</td>
            <td>${a.observacao ?? ''}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${a.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${a.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
        `;

    });

    document.getElementById("lista").innerHTML = html;

}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('atividades')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("veiculoId").value = data.veiculo_id ?? '';
    document.getElementById("condutorId").value = data.condutor_id ?? '';
    document.getElementById("tipoAtividade").value = data.tipo_atividade ?? '';
    document.getElementById("dataPrevisao").value = data.data_previsao ?? '';
    document.getElementById("status").value = data.status ?? 'Pendente';
    document.getElementById("km").value = data.km ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("veiculoId").focus();

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("veiculoId").value = '';
    document.getElementById("condutorId").value = '';
    document.getElementById("tipoAtividade").value = '';
    document.getElementById("dataPrevisao").value = '';
    document.getElementById("status").value = 'Pendente';
    document.getElementById("km").value = '';
    document.getElementById("observacao").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('atividades')
        .select('tipo_atividade, veiculos(placa)')
        .eq('id', id)
        .single();

    const tipo = data?.tipo_atividade || '(sem tipo)';
    const placa = data?.veiculos?.placa || '';

    if(!confirm(`Excluir a atividade #${id} - ${tipo}${placa ? ' (veículo ' + placa + ')' : ''}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('atividades')
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

    const veiculoId = document.getElementById("veiculoId").value;
    const condutorId = document.getElementById("condutorId").value;
    const tipoAtividade = document.getElementById("tipoAtividade").value.trim();
    const dataValor = document.getElementById("dataPrevisao").value;
    const status = document.getElementById("status").value;
    const km = document.getElementById("km").value;
    const observacao = document.getElementById("observacao").value;

    const dados = {
        veiculo_id: veiculoId ? Number(veiculoId) : null,
        condutor_id: condutorId ? Number(condutorId) : null,
        tipo_atividade: tipoAtividade || null,
        data_previsao: dataValor || null,
        status: status || 'Pendente',
        km: km ? Number(km) : null,
        observacao: observacao || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('atividades')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('atividades')
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

checarLogin();
