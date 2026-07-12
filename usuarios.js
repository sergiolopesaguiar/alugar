// Lógica da página de cadastro de Usuários.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// A tabela "usuarios" (usuario, senha_hash) fica com RLS ligado e SEM
// nenhuma policy - inacessível direto por anon/authenticated. Todo acesso
// passa por funções security definer no Postgres: criar_usuario(),
// listar_usuarios(), atualizar_senha_usuario(), excluir_usuario(). Isso
// significa que esta página nunca lê nem grava senha_hash diretamente,
// só manda usuário/senha em texto puro pras funções, que fazem o hash
// (bcrypt via pgcrypto) dentro do banco.

let editandoId = null; // guarda o NOME do usuário em edição (não tem id exposto no form)

async function carregar(){

    const {data, error} = await supabaseClient.rpc('listar_usuarios');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    (data || []).forEach(u => {

        const criadoEm = u.criado_em ? new Date(u.criado_em).toLocaleString('pt-BR') : '';

        html += `

        <tr>

            <td>${u.id}</td>

            <td>${u.usuario}</td>

            <td>${criadoEm}</td>

            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Trocar senha" onclick="editar('${u.usuario}')"><i class="bi bi-key"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir('${u.usuario}')"><i class="bi bi-trash"></i></button>
                </div>
            </td>

        </tr>

        `;

    });

    document.getElementById("lista").innerHTML = html;

}

function editar(usuario){

    editandoId = usuario;

    document.getElementById("usuario").value = usuario;
    document.getElementById("usuario").disabled = true;
    document.getElementById("senha").value = '';
    document.getElementById("senha").placeholder = 'Nova senha';

    document.getElementById("btnSalvar").textContent = 'Atualizar senha';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("usuario").value = '';
    document.getElementById("usuario").disabled = false;
    document.getElementById("senha").value = '';
    document.getElementById("senha").placeholder = 'Senha';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(usuario){

    if(!confirm(`Excluir o usuário "${usuario}"? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient.rpc('excluir_usuario', {p_usuario: usuario});

    if(error){
        alert(error.message);
        return;
    }

    if(editandoId === usuario){
        cancelarEdicao();
    }

    carregar();

}

async function salvar(){

    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value;

    if(!usuario){
        alert('Preencha o usuário.');
        return;
    }

    if(!senha){
        alert(editandoId ? 'Preencha a nova senha.' : 'Preencha a senha.');
        return;
    }

    let error;

    if(editandoId){

        ({error} = await supabaseClient.rpc('atualizar_senha_usuario', {
            p_usuario: editandoId,
            p_senha_nova: senha
        }));

    } else {

        ({error} = await supabaseClient.rpc('criar_usuario', {
            p_usuario: usuario,
            p_senha: senha
        }));

    }

    if(error){
        // erro típico aqui: usuário já existe (constraint unique em "usuario").
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

checarLogin();
