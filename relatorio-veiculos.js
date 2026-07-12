// Lógica do Relatório de Veículos (Relatórios > Veículos).
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Página só de leitura (sem criar/editar/excluir). Busca todos os veículos
// uma vez, com manutenção e contratos vinculados via embedding do
// PostgREST, guarda em memória (todosOsVeiculos) e os filtros de marca/
// status/período de compra são aplicados no próprio navegador (client-side)
// em cima dessa lista - suficiente para o volume de dados atual e evita ter
// que montar query dinâmica no Supabase.
//
// O resumo por marca/modelo (contagem "de estoque") virou uma página
// separada: Relatórios > Inventário de Veículos. Esta página aqui é só a
// listagem detalhada, linha a linha, com filtros.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'relatorio_veiculos';

let todosOsVeiculos = [];

async function carregar(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('*, manutencao(oficina, telefone, email, responsavel), contratos_veiculos(contratos(id, data_inicial, data_final, clientes(nome, cpf_cnpj)))')
        .order('placa');

    if(error){
        alert(error.message);
        return;
    }

    todosOsVeiculos = data || [];

    popularFiltroMarca();
    aplicarFiltros();

}

function popularFiltroMarca(){

    const marcas = Array.from(new Set(
        todosOsVeiculos
            .map(v => v.fabricante)
            .filter(Boolean)
    )).sort();

    const select = document.getElementById('filtroMarca');
    const valorAtual = select.value;

    let html = '<option value="">Todas as marcas</option>';

    marcas.forEach(m => {
        html += `<option value="${m}">${m}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

function aplicarFiltros(){

    const marca = document.getElementById('filtroMarca').value;
    const status = document.getElementById('filtroStatus').value;
    const dataDe = document.getElementById('filtroDataDe').value;
    const dataAte = document.getElementById('filtroDataAte').value;

    const filtrados = todosOsVeiculos.filter(v => {

        if(marca && v.fabricante !== marca){
            return false;
        }

        if(status && v.status !== status){
            return false;
        }

        if(dataDe && (!v.data_compra || v.data_compra < dataDe)){
            return false;
        }

        if(dataAte && (!v.data_compra || v.data_compra > dataAte)){
            return false;
        }

        return true;

    });

    renderizarVeiculos(filtrados);

}

function limparFiltros(){

    document.getElementById('filtroMarca').value = '';
    document.getElementById('filtroStatus').value = '';
    document.getElementById('filtroDataDe').value = '';
    document.getElementById('filtroDataAte').value = '';

    aplicarFiltros();

}

function renderizarVeiculos(lista){

    let html = '';

    if(lista.length === 0){
        html = '<tr><td colspan="15" class="text-muted">Nenhum veículo encontrado com esses filtros.</td></tr>';
    }

    lista.forEach(v => {

        const dataCompra = v.data_compra ? new Date(v.data_compra + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const valorCompra = v.valor_compra != null ? Number(v.valor_compra).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';

        const contratos = (v.contratos_veiculos || [])
            .map(cv => cv.contratos?.clientes?.cpf_cnpj || cv.contratos?.clientes?.nome)
            .filter(Boolean)
            .join(', ') || '';

        const manutencoes = (v.manutencao || []);
        const manutencao = manutencoes.length > 0
            ? manutencoes.map(m => m.oficina || m.responsavel || '(sem detalhe)').join(', ')
            : '';

        html += `
        <tr>
            <td>${v.placa}</td>
            <td>${v.fabricante ?? ''}</td>
            <td>${v.modelo ?? ''}</td>
            <td>${v.status ?? ''}</td>
            <td>${v.cor ?? ''}</td>
            <td>${v.ano ?? ''}</td>
            <td>${v.chassi ?? ''}</td>
            <td>${v.renavam ?? ''}</td>
            <td>${v.km_compra ?? ''}</td>
            <td>${valorCompra}</td>
            <td>${dataCompra}</td>
            <td>${v.origem_compra ?? ''}</td>
            <td>${v.observacao ?? ''}</td>
            <td>${contratos}</td>
            <td>${manutencao}</td>
        </tr>
        `;

    });

    document.getElementById('listaVeiculos').innerHTML = html;

}

checarLogin();
