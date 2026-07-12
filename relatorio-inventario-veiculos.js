// Lógica do Inventário de Veículos (Relatórios > Inventário de Veículos).
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Só leitura, sem filtro - é a contagem "de estoque" (quantos veículos por
// status, quantos por marca/modelo). Para o detalhe linha a linha (com
// filtros), ver Relatórios > Veículos.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'relatorio_inventario_veiculos';

async function carregar(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('fabricante, modelo, status');

    if(error){
        alert(error.message);
        return;
    }

    renderizarResumoStatus(data || []);
    renderizarResumoMarcaModelo(data || []);

}

function renderizarResumoStatus(lista){

    const grupos = {};

    lista.forEach(v => {
        const status = v.status || '(sem status)';
        grupos[status] = (grupos[status] || 0) + 1;
    });

    const linhas = Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));

    let html = '';

    if(linhas.length === 0){
        html = '<tr><td colspan="2" class="text-muted">Nenhum veículo cadastrado.</td></tr>';
    }

    linhas.forEach(([status, quantidade]) => {
        html += `<tr><td>${status}</td><td>${quantidade}</td></tr>`;
    });

    document.getElementById('listaResumoStatus').innerHTML = html;

}

function renderizarResumoMarcaModelo(lista){

    const grupos = {};

    lista.forEach(v => {

        const marca = v.fabricante || '(sem marca)';
        const modelo = v.modelo || '(sem modelo)';
        const chave = `${marca}||${modelo}`;

        if(!grupos[chave]){
            grupos[chave] = {marca, modelo, quantidade: 0};
        }

        grupos[chave].quantidade++;

    });

    const linhas = Object.values(grupos).sort((a, b) => {
        return a.marca.localeCompare(b.marca) || a.modelo.localeCompare(b.modelo);
    });

    let html = '';

    if(linhas.length === 0){
        html = '<tr><td colspan="3" class="text-muted">Nenhum veículo cadastrado.</td></tr>';
    }

    linhas.forEach(l => {
        html += `<tr><td>${l.marca}</td><td>${l.modelo}</td><td>${l.quantidade}</td></tr>`;
    });

    document.getElementById('listaResumoMarcaModelo').innerHTML = html;

}

checarLogin();
