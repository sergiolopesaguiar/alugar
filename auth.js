const supabaseClient = window.supabase.createClient(
    'https://lagejrgzmhdtlnapnrxb.supabase.co',
    'sb_publishable_9M1vQvsoSsijoGS-nKshow_OV2ocWVw'
);

// Compartilhado por todas as páginas do sistema (Clientes, Veículos, etc.).
// Cada página só precisa definir sua própria função carregar() com os
// dados daquela tela; este arquivo cuida só do login/logout/exibição.

// Usa classe (d-none) em vez de style.display direto, para não atropelar
// as classes responsivas do Bootstrap (ex: d-md-flex) que controlam o
// layout do menu lateral em telas grandes x pequenas.
function mostrarDashboard(){
    document.getElementById('loginBox').classList.add('d-none');
    document.getElementById('dashboard').classList.remove('d-none');
}

function mostrarLogin(){
    document.getElementById('loginBox').classList.remove('d-none');
    document.getElementById('dashboard').classList.add('d-none');
}

// Login contra a tabela própria "usuarios". A verificação de senha roda
// inteira dentro do Postgres (função login_usuario), o app só recebe
// true/false. Isso NÃO gera uma sessão reconhecida pelo Supabase: é só
// uma trava de tela, guardada no localStorage deste navegador. As
// tabelas de dados (clientes, veiculos) continuam acessíveis pela API
// para quem tiver a URL/chave, com ou sem login feito aqui.
async function login(){

    const usuario = document.getElementById('loginUsuario').value;
    const senha = document.getElementById('loginSenha').value;

    if(!usuario || !senha){
        alert('Preencha usuário e senha.');
        return;
    }

    const { data: ok, error } = await supabaseClient.rpc('login_usuario', {
        p_usuario: usuario,
        p_senha: senha
    });

    if(error){
        alert('Erro ao entrar: ' + error.message);
        return;
    }

    if(!ok){
        alert('Usuário ou senha inválidos.');
        return;
    }

    document.getElementById('loginSenha').value = '';
    localStorage.setItem('logado', 'sim');
    localStorage.setItem('usuarioLogado', usuario);

    mostrarDashboard();
    if(typeof carregar === 'function'){
        carregar();
    }
}

function logout(){
    localStorage.removeItem('logado');
    localStorage.removeItem('usuarioLogado');
    mostrarLogin();
}

function checarLogin(){
    if(localStorage.getItem('logado') === 'sim'){
        mostrarDashboard();
        if(typeof carregar === 'function'){
            carregar();
        }
    } else {
        mostrarLogin();
    }
}

// Importante: checarLogin() é chamado no FINAL do script de cada página
// (app.js, veiculos.js), não aqui. Isso garante que a função carregar()
// daquela página já exista quando checarLogin tentar chamá-la (auth.js
// carrega antes do script da página, então "carregar" ainda não existiria
// se chamássemos checarLogin() diretamente aqui).
