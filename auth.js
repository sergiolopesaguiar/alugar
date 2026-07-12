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

    // login_usuario retorna uma linha (ok, is_admin) só quando usuário/senha
    // conferem - nenhuma linha significa credenciais inválidas.
    const { data, error } = await supabaseClient.rpc('login_usuario', {
        p_usuario: usuario,
        p_senha: senha
    });

    if(error){
        alert('Erro ao entrar: ' + error.message);
        return;
    }

    const linha = (data || [])[0];

    if(!linha || !linha.ok){
        alert('Usuário ou senha inválidos.');
        return;
    }

    document.getElementById('loginSenha').value = '';
    localStorage.setItem('logado', 'sim');
    localStorage.setItem('usuarioLogado', usuario);
    localStorage.setItem('usuarioAdmin', linha.is_admin ? 'sim' : 'nao');

    mostrarDashboard();
    aplicarEstadoMenu();
    if(typeof carregar === 'function'){
        carregar();
    }
    aplicarPermissoes();
    aplicarRestricaoAdmin();
}

function logout(){
    localStorage.removeItem('logado');
    localStorage.removeItem('usuarioLogado');
    localStorage.removeItem('usuarioAdmin');
    mostrarLogin();
}

function checarLogin(){
    if(localStorage.getItem('logado') === 'sim'){
        mostrarDashboard();
        aplicarEstadoMenu();
        if(typeof carregar === 'function'){
            carregar();
        }
        aplicarPermissoes();
        aplicarRestricaoAdmin();
    } else {
        mostrarLogin();
    }
}

// Importante: checarLogin() é chamado no FINAL do script de cada página
// (app.js, veiculos.js), não aqui. Isso garante que a função carregar()
// daquela página já exista quando checarLogin tentar chamá-la (auth.js
// carrega antes do script da página, então "carregar" ainda não existiria
// se chamássemos checarLogin() diretamente aqui).

// ---------------------------------------------------------------------
// Splitter do menu lateral: esconder/mostrar a sidebar inteira (desktop).
// Estado gravado em localStorage para persistir entre páginas/recarregamentos.
// O estado também é aplicado bem cedo, num script inline no <head>/topo de
// cada página (antes dos CDNs carregarem), para não "piscar" a sidebar
// aberta e depois fechar - aqui só reaplicamos por garantia após o dashboard
// aparecer (ex: repovoado depois do login()).
// ---------------------------------------------------------------------
function aplicarEstadoMenu(){
    const colapsado = localStorage.getItem('menuColapsado') === 'sim';
    const sidebar = document.getElementById('sidebarMenu');
    const btnExpandir = document.getElementById('btnExpandirMenu');
    if(sidebar){
        sidebar.classList.toggle('colapsado', colapsado);
    }
    if(btnExpandir){
        btnExpandir.classList.toggle('mostrar', colapsado);
    }
}

function alternarMenu(){
    const colapsadoAtual = localStorage.getItem('menuColapsado') === 'sim';
    localStorage.setItem('menuColapsado', colapsadoAtual ? 'nao' : 'sim');
    aplicarEstadoMenu();
}

// ---------------------------------------------------------------------
// Permissões por rotina (tabela usuarios_rotinas). A ausência de uma linha
// para (usuario, rotina) significa "liberado" - só existe registro quando
// alguém explicitamente troca o padrão na tela Usuário > Rotina. Por isso,
// hoje (sem nenhuma linha na tabela ainda), tudo continua liberado para
// todo mundo, como pedido.
//
// Cada página define sua própria constante ROTINA_ATUAL (ex: 'clientes' em
// app.js, 'veiculos' em veiculos.js) para sabermos se a página corrente deve
// ser bloqueada. Links do menu com atributo data-rotina são escondidos
// automaticamente quando a rotina correspondente estiver negada.
// ---------------------------------------------------------------------
async function aplicarPermissoes(){

    const usuario = localStorage.getItem('usuarioLogado');
    if(!usuario){
        return;
    }

    const {data, error} = await supabaseClient.rpc('listar_permissoes_usuario', {p_usuario: usuario});

    if(error){
        console.error('Falha ao carregar permissões:', error.message);
        return;
    }

    const negadas = (data || [])
        .filter(linha => linha.liberado === false)
        .map(linha => linha.rotina);

    document.querySelectorAll('[data-rotina]').forEach(el => {
        if(negadas.includes(el.getAttribute('data-rotina'))){
            el.classList.add('d-none');
        } else {
            el.classList.remove('d-none');
        }
    });

    if(typeof ROTINA_ATUAL !== 'undefined' && negadas.includes(ROTINA_ATUAL)){
        bloquearAcessoRotina();
    }

}

function bloquearAcessoRotina(){
    const corpo = document.querySelector('#dashboard .card-body');
    if(corpo){
        corpo.innerHTML = '<div class="alert alert-danger mb-0">Você não tem permissão para acessar esta rotina. Fale com um administrador em Usuário &gt; Rotina.</div>';
    }
}

// ---------------------------------------------------------------------
// Restrição de administrador: independente do sistema de permissões por
// rotina acima (usuarios_rotinas), que é liberado por padrão para todo
// mundo. Isto aqui é uma trava à parte, fixa, só para as telas de Usuários
// e Permissões - controlada pela flag usuarios.is_admin, guardada em
// localStorage no momento do login (não é revalidada a cada página, então
// uma mudança de is_admin só tem efeito no próximo login do usuário).
//
// Páginas administrativas (usuarios.js, permissoes.js) declaram
// `const PAGINA_SOMENTE_ADMIN = true;`. Links de menu que só devem
// aparecer para administradores levam o atributo `data-admin-only`.
// ---------------------------------------------------------------------
function aplicarRestricaoAdmin(){

    const admin = localStorage.getItem('usuarioAdmin') === 'sim';

    document.querySelectorAll('[data-admin-only]').forEach(el => {
        el.classList.toggle('d-none', !admin);
    });

    if(typeof PAGINA_SOMENTE_ADMIN !== 'undefined' && PAGINA_SOMENTE_ADMIN && !admin){
        bloquearAcessoAdmin();
    }

}

function bloquearAcessoAdmin(){
    const corpo = document.querySelector('#dashboard .card-body');
    if(corpo){
        corpo.innerHTML = '<div class="alert alert-danger mb-0">Esta área é restrita a administradores.</div>';
    }
}
