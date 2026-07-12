// Lógica da página de Condutor.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Cadastro simples e independente (sem FK pra veiculos) - diferente de
// veiculos_motorista, que vincula um motorista a um veículo específico.
// Condutor aqui é um cadastro geral de pessoas com um período
// (data_inicio/data_fim), útil por exemplo pra quem dirige por um contrato
// ou período sem estar preso a um veículo fixo.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'condutor';

let editandoId = null;

async function carregar(){

    const {data, error} = await supabaseClient
        .from('condutores')
        .select('*')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(c => {

        const inicio = c.data_inicio ? new Date(c.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const fim = c.data_fim ? new Date(c.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '';

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.nome}</td>
            <td>${c.telefone ?? ''}</td>
            <td>${inicio}</td>
            <td>${fim}</td>
            <td>${c.observacao ?? ''}</td>
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
        .from('condutores')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("nome").value = data.nome ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';
    document.getElementById("data_inicio").value = data.data_inicio ?? '';
    document.getElementById("data_fim").value = data.data_fim ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("nome").value = '';
    document.getElementById("telefone").value = '';
    document.getElementById("data_inicio").value = '';
    document.getElementById("data_fim").value = '';
    document.getElementById("observacao").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('condutores')
        .select('nome')
        .eq('id', id)
        .single();

    const nome = data?.nome || '(sem nome)';

    if(!confirm(`Excluir o condutor "${nome}"? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('condutores')
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

    const nome = document.getElementById("nome").value.trim();
    const telefone = document.getElementById("telefone").value;
    const dataInicio = document.getElementById("data_inicio").value;
    const dataFim = document.getElementById("data_fim").value;
    const observacao = document.getElementById("observacao").value;

    if(!nome){
        alert('Preencha o nome.');
        return;
    }

    const dados = {
        nome,
        telefone: telefone || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        observacao: observacao || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('condutores')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('condutores')
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
