// Lógica da página "Usuário > Rotina" (matriz de permissões).
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Página restrita a administradores (flag usuarios.is_admin) - ver
// aplicarRestricaoAdmin() em auth.js.
const PAGINA_SOMENTE_ADMIN = true;
//
// Regra da tabela usuarios_rotinas: a AUSÊNCIA de uma linha para
// (usuario, rotina) significa liberado. Só existe linha quando alguém já
// mexeu no padrão por aqui. Por isso hoje, com a tabela vazia, todo mundo
// tem acesso a tudo - exatamente o pedido inicial.
//
// Lista fixa das rotinas que podem ser controladas por usuário. Precisa
// bater com os valores usados em data-rotina no menu e na constante
// ROTINA_ATUAL de cada página (app.js, veiculos.js, atividades.js,
// manutencao.js). As páginas de administração (Usuários/Permissões) não
// entram nessa lista de propósito, pra evitar alguém se trancar fora
// delas sem querer.
const ROTINAS = [
    {codigo: 'clientes', label: 'Clientes'},
    {codigo: 'veiculos', label: 'Veículos'},
    {codigo: 'atividades', label: 'Atividades'},
    {codigo: 'condutor', label: 'Condutor'},
    {codigo: 'contratos', label: 'Contratos'},
    {codigo: 'manutencao', label: 'Manutenção'},
    {codigo: 'relatorio_inventario_veiculos', label: 'Relatórios > Inventário de Veículos'},
    {codigo: 'relatorio_veiculos', label: 'Relatórios > Veículos'},
    {codigo: 'relatorio_faturamento', label: 'Relatórios > Faturamento'},
    {codigo: 'faturamento', label: 'Financeiro > Faturamento'},
    {codigo: 'fornecedor', label: 'Financeiro > Fornecedor'},
    {codigo: 'conta_contabil', label: 'Financeiro > Conta Contábil'},
    {codigo: 'contas_pagar', label: 'Financeiro > Contas a Pagar'}
];

async function carregar(){

    const {data, error} = await supabaseClient.rpc('listar_usuarios');

    if(error){
        alert(error.message);
        return;
    }

    const select = document.getElementById('usuarioSelecionado');
    const valorAtual = select.value;

    let html = '<option value="" selected disabled>Selecione o usuário</option>';

    (data || []).forEach(u => {
        html += `<option value="${u.usuario}">${u.usuario}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

    document.getElementById('listaPermissoes').classList.add('d-none');
    document.getElementById('mensagemSemUsuario').classList.remove('d-none');

}

async function carregarPermissoesDoUsuario(){

    const usuario = document.getElementById('usuarioSelecionado').value;

    if(!usuario){
        return;
    }

    const {data, error} = await supabaseClient.rpc('listar_permissoes_usuario', {p_usuario: usuario});

    if(error){
        alert(error.message);
        return;
    }

    // Mapa rotina -> liberado, só com o que já foi explicitamente definido.
    const overrides = {};
    (data || []).forEach(linha => {
        overrides[linha.rotina] = linha.liberado;
    });

    let html = '';

    ROTINAS.forEach(r => {
        // Sem override cadastrado = liberado por padrão.
        const liberado = overrides.hasOwnProperty(r.codigo) ? overrides[r.codigo] : true;

        html += `
        <tr>
            <td>${r.label}</td>
            <td>
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" role="switch"
                        id="permissao_${r.codigo}"
                        ${liberado ? 'checked' : ''}
                        onchange="alterarPermissao('${r.codigo}', this.checked)">
                </div>
            </td>
        </tr>
        `;
    });

    document.getElementById('corpoPermissoes').innerHTML = html;
    document.getElementById('listaPermissoes').classList.remove('d-none');
    document.getElementById('mensagemSemUsuario').classList.add('d-none');

}

async function alterarPermissao(rotina, liberado){

    const usuario = document.getElementById('usuarioSelecionado').value;

    if(!usuario){
        return;
    }

    const {error} = await supabaseClient.rpc('definir_permissao', {
        p_usuario: usuario,
        p_rotina: rotina,
        p_liberado: liberado
    });

    if(error){
        alert('Não foi possível salvar: ' + error.message);
    }

}

checarLogin();
