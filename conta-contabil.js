// Lógica da página Financeiro > Conta Contábil.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Cadastro simples de plano de contas: nome livre, tipo livre (categoria,
// ex: "Despesa Operacional", "Receita de Serviço" - não virou lista fixa
// porque o Sérgio não definiu um conjunto fechado de tipos), e natureza
// fixa (Débito/Crédito), usada por Contas a Pagar para classificar cada
// lançamento.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'conta_contabil';

let editandoId = null;

async function carregar(){

    const {data, error} = await supabaseClient
        .from('conta_contabil')
        .select('*')
        .order('nome');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(c => {

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.nome}</td>
            <td>${c.tipo ?? ''}</td>
            <td>${c.natureza ?? ''}</td>
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
        .from('conta_contabil')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("nome").value = data.nome ?? '';
    document.getElementById("tipo").value = data.tipo ?? '';
    document.getElementById("natureza").value = data.natureza ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("nome").value = '';
    document.getElementById("tipo").value = '';
    document.getElementById("natureza").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('conta_contabil')
        .select('nome')
        .eq('id', id)
        .single();

    const nome = data?.nome || '(sem nome)';

    if(!confirm(`Excluir a conta contábil "${nome}"? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('conta_contabil')
        .delete()
        .eq('id', id);

    if(error){
        alert('Não foi possível excluir: ' + error.message);
        return;
    }

    if(editandoId === id){
        cancelarEdicao();
    }

    carregar();

}

async function salvar(){

    const nome = document.getElementById("nome").value.trim();
    const tipo = document.getElementById("tipo").value.trim();
    const natureza = document.getElementById("natureza").value;

    if(!nome){
        alert('Preencha o nome da conta.');
        return;
    }

    const dados = {
        nome,
        tipo: tipo || null,
        natureza: natureza || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('conta_contabil')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('conta_contabil')
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
