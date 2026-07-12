// Lógica da página de cadastro de Usuários.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Página restrita a administradores (flag usuarios.is_admin) - ver
// aplicarRestricaoAdmin() em auth.js. Diferente do sistema de permissões
// por rotina (usuarios_rotinas), que é liberado por padrão, esta trava é
// fixa e não pode ser reconfigurada por rotina.
const PAGINA_SOMENTE_ADMIN = true;
//
// A tabela "usuarios" (usuario, senha_hash) fica com RLS ligado e SEM
// nenhuma policy - inacessível direto por anon/authenticated. Todo acesso
// passa por funções security definer no Postgres: criar_usuario(),
// listar_usuarios(), atualizar_senha_usuario(), excluir_usuario(). Isso
// significa que esta página nunca lê nem grava senha_hash diretamente,
// só manda usuário/senha em texto puro pras funções, que fazem o hash
// (bcrypt via pgcrypto) dentro do banco.

let editandoId = null; // guarda o NOME do usuário em edição (não tem id exposto no form)
let usuariosCache = []; // última lista carregada, usada por editar() sem round-trip extra

async function carregar(){

    const {data, error} = await supabaseClient.rpc('listar_usuarios');

    if(error){
        alert(error.message);
        return;
    }

    usuariosCache = data || [];

    let html = '';

    usuariosCache.forEach(u => {

        const criadoEm = u.criado_em ? new Date(u.criado_em).toLocaleString('pt-BR') : '';

        html += `

        <tr>

            <td>${u.id}</td>

            <td>${u.usuario}</td>

            <td>${u.is_admin ? '<span class="text-success fw-semibold">Sim</span>' : 'Não'}</td>

            <td>${criadoEm}</td>

            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar('${u.usuario}')"><i class="bi bi-pencil-square"></i></button>
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

    const dados = usuariosCache.find(u => u.usuario === usuario);

    document.getElementById("usuario").value = usuario;
    document.getElementById("usuario").disabled = true;
    document.getElementById("senha").value = '';
    document.getElementById("senha").placeholder = 'Nova senha (deixe em branco para manter)';
    document.getElementById("isAdmin").checked = !!(dados && dados.is_admin);

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("usuario").value = '';
    document.getElementById("usuario").disabled = false;
    document.getElementById("senha").value = '';
    document.getElementById("senha").placeholder = 'Senha';
    document.getElementById("isAdmin").checked = false;

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
    const isAdmin = document.getElementById("isAdmin").checked;

    if(!usuario){
        alert('Preencha o usuário.');
        return;
    }

    // Na criação, senha é obrigatória. Na edição, o campo agora é opcional -
    // deixar em branco mantém a senha atual e só atualiza a flag de admin
    // (evita forçar troca de senha só para promover/rebaixar alguém).
    if(!editandoId && !senha){
        alert('Preencha a senha.');
        return;
    }

    let error;

    if(editandoId){

        if(senha){
            ({error} = await supabaseClient.rpc('atualizar_senha_usuario', {
                p_usuario: editandoId,
                p_senha_nova: senha
            }));
            if(error){
                alert(error.message);
                return;
            }
        }

        ({error} = await supabaseClient.rpc('atualizar_admin_usuario', {
            p_usuario: editandoId,
            p_is_admin: isAdmin
        }));

    } else {

        ({error} = await supabaseClient.rpc('criar_usuario', {
            p_usuario: usuario,
            p_senha: senha,
            p_is_admin: isAdmin
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
