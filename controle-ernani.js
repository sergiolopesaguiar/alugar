// Lógica da página Financeiro > Controle Ernani Veículos.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Controle de débitos e pagamentos com terceiros (ex.: ERNANI / MICHELLY),
// no mesmo formato da planilha "PENDENCIAS - 2026" do usuário: uma lista
// única por terceiro com DESCRIÇÃO, DATA, VALOR, VALOR PAGO e FORMA DE PAG,
// separada por mês, com os totais no topo.
//
// Tabelas (criadas em 2026-11-22):
//  - ernani_lancamentos: cada linha da planilha. "valor" = débito (parcela,
//    OS, multa/juros) e "valor_pago" = pagamento/crédito. Uma linha pode ter
//    os dois (linhas importadas da planilha original ficaram exatamente como
//    estavam). "mes" (AAAA-MM) define em qual bloco mensal a linha aparece,
//    inclusive quando não há data.
//  - ernani_servicos: serviços de oficina pendentes (OS). O "já pago" de uma
//    OS = valor_pago_inicial + soma dos lançamentos tipo 'os' ligados a ela
//    (servico_id). A OS sai da lista quando o saldo chega a zero.
//  - ernani_historico: registro de inclusões, alterações e exclusões.
//
// Regras de cálculo:
//  - Total débitos = soma de "valor" dos meses até o mês atual.
//  - Total pago    = soma de "valor_pago" (todas as linhas).
//  - Saldo a pagar = total débitos - total pago.
//  - Parcelas de meses futuros não entram no saldo; aparecem em "A vencer".
//  - Um pagamento vinculado a uma parcela/OS (campo vinculo) é só uma
//    referência: entra uma única vez no total pago.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'controle_ernani';

const MESES_NOME = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TAGS = {parcela: 'PARC', os: 'OS', debito: 'DÉB', pagamento: 'PGTO', credito: 'CRÉD'};

let fornecedores = [];
let fornecedorId = null;
let veiculos = [];
let lancamentos = [];
let servicos = [];
let editandoId = null;
let editandoServicoId = null;
let linhasVisiveis = [];

// ---------------------------------------------------------------------
// Utilidades

function hojeISO(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function mesAtual(){
    return hojeISO().slice(0, 7);
}

function brl(n){
    return (Number(n) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function lerValor(texto){
    const t = String(texto || '').trim();
    if(!t){ return 0; }
    // Aceita "1.234,56", "1234,56" e "1234.56"
    const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
    const n = parseFloat(normal);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function dataBR(iso){
    if(!iso){ return ''; }
    const p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
}

function rotuloMes(mes){
    const p = mes.split('-');
    return MESES_NOME[parseInt(p[1], 10) - 1] + ' / ' + p[0];
}

function rotuloMesCurto(mes){
    const p = mes.split('-');
    return MESES_CURTO[parseInt(p[1], 10) - 1] + '/' + p[0];
}

function somarMes(mes, n){
    const p = mes.split('-');
    const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
}

function usuarioAtual(){
    return localStorage.getItem('usuarioLogado') || '';
}

function mostrarAviso(texto, tipo){
    const el = document.getElementById('aviso');
    el.className = 'alert py-1 px-2 small mb-2 alert-' + (tipo || 'info');
    el.textContent = texto;
    clearTimeout(mostrarAviso._t);
    mostrarAviso._t = setTimeout(() => el.classList.add('d-none'), 8000);
}

function abrirModal(id){
    bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}

function fecharModal(id){
    bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).hide();
}

async function registrarHistorico(acao, lancamentoId, servicoId, antes, depois){
    // Falha no histórico não deve impedir o lançamento; só avisa no console.
    const {error} = await supabaseClient.from('ernani_historico').insert({
        lancamento_id: lancamentoId || null,
        servico_id: servicoId || null,
        fornecedor_id: String(fornecedorId),
        acao,
        usuario: usuarioAtual(),
        antes: antes || null,
        depois: depois || null
    });
    if(error){ console.warn('Histórico não gravado:', error.message); }
}

// ---------------------------------------------------------------------
// Carga de dados

async function carregar(){

    document.getElementById('dataAtual').textContent = dataBR(hojeISO());

    const [rf, rv] = await Promise.all([
        supabaseClient.from('fornecedores').select('id, nome').order('nome'),
        supabaseClient.from('veiculos').select('id, placa, fabricante, modelo').order('placa')
    ]);

    if(rf.error){ alert(rf.error.message); return; }

    fornecedores = rf.data || [];
    veiculos = rv.data || [];

    // Terceiro padrão: o último usado neste navegador; senão ERNANI / MICHELLY.
    const salvo = localStorage.getItem('controleErnaniFornecedor');
    const ernani = fornecedores.find(f => (f.nome || '').toUpperCase().includes('ERNANI'));
    if(salvo && fornecedores.some(f => String(f.id) === salvo)){
        fornecedorId = salvo;
    } else if(ernani){
        fornecedorId = String(ernani.id);
    } else if(fornecedores.length){
        fornecedorId = String(fornecedores[0].id);
    }

    preencherFornecedores();
    preencherVeiculosModais();
    ajustarBarra();
    document.getElementById('qData').value = hojeISO();

    await carregarDados();
}

function preencherFornecedores(){
    const sel = document.getElementById('fornecedorSel');
    let html = fornecedores.map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');
    html += '<option value="__novo">+ Cadastrar novo terceiro…</option>';
    sel.innerHTML = html;
    if(fornecedorId){ sel.value = fornecedorId; }
}

async function trocarFornecedor(){
    const sel = document.getElementById('fornecedorSel');
    if(sel.value === '__novo'){
        const nome = (prompt('Nome do novo terceiro (ficará também no cadastro de Fornecedores):') || '').trim();
        if(!nome){ sel.value = fornecedorId || ''; return; }
        const {data, error} = await supabaseClient.from('fornecedores').insert({nome}).select('id, nome').single();
        if(error){ alert(error.message); sel.value = fornecedorId || ''; return; }
        fornecedores.push(data);
        fornecedores.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        fornecedorId = String(data.id);
        preencherFornecedores();
    } else {
        fornecedorId = sel.value;
    }
    localStorage.setItem('controleErnaniFornecedor', fornecedorId);
    cancelarEdicao();
    await carregarDados();
}

async function carregarDados(){

    if(!fornecedorId){
        document.getElementById('lista').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Cadastre um terceiro para começar.</td></tr>';
        return;
    }

    const [rl, rs] = await Promise.all([
        supabaseClient.from('ernani_lancamentos').select('*').eq('fornecedor_id', fornecedorId).order('id'),
        supabaseClient.from('ernani_servicos').select('*').eq('fornecedor_id', fornecedorId).order('id')
    ]);

    if(rl.error){ alert(rl.error.message); return; }
    if(rs.error){ alert(rs.error.message); return; }

    lancamentos = (rl.data || []).map(l => ({...l, valor: Number(l.valor) || 0, valor_pago: Number(l.valor_pago) || 0}));
    servicos = (rs.data || []).map(s => ({...s, valor_total: Number(s.valor_total) || 0, valor_pago_inicial: Number(s.valor_pago_inicial) || 0}));

    preencherFiltros();
    preencherMesesBarra();
    preencherVinculos();
    render();
    atualizarContadorPendentes();
}

function preencherFiltros(){

    const mesesSet = new Set(lancamentos.map(l => l.mes));
    const meses = [...mesesSet].sort().reverse();
    const anos = [...new Set(meses.map(m => m.slice(0, 4)))].sort().reverse();

    const fMes = document.getElementById('filtroMes');
    const fAno = document.getElementById('filtroAno');
    const fVei = document.getElementById('filtroVeiculo');
    const vMes = fMes.value, vAno = fAno.value, vVei = fVei.value;

    fMes.innerHTML = '<option value="">Mês: todos</option>' + meses.map(m => `<option value="${m}">${rotuloMesCurto(m)}</option>`).join('');
    fAno.innerHTML = '<option value="">Ano: todos</option>' + anos.map(a => `<option value="${a}">${a}</option>`).join('');

    // Veículos: primeira palavra das descrições de parcelas (YARIS, HILUX…)
    const nomes = new Set();
    lancamentos.forEach(l => {
        if(l.tipo === 'parcela' && l.descricao){ nomes.add(l.descricao.split(' ')[0]); }
    });
    servicos.forEach(s => { if(s.veiculo){ nomes.add(s.veiculo.split(' ')[0]); } });
    fVei.innerHTML = '<option value="">Veículo: todos</option>' + [...nomes].sort((a, b) => a.localeCompare(b)).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');

    fMes.value = meses.includes(vMes) ? vMes : '';
    fAno.value = anos.includes(vAno) ? vAno : '';
    fVei.value = nomes.has(vVei) ? vVei : '';
}

function listaMesesEscolha(){
    // Do mês mais antigo com lançamento até 12 meses à frente.
    const atual = mesAtual();
    const existentes = lancamentos.map(l => l.mes).sort();
    let inicio = existentes.length && existentes[0] < somarMes(atual, -3) ? existentes[0] : somarMes(atual, -3);
    const fim = somarMes(atual, 12);
    const out = [];
    for(let m = inicio; m <= fim; m = somarMes(m, 1)){ out.push(m); }
    return out.reverse();
}

function preencherMesesBarra(){
    const sel = document.getElementById('qMes');
    const v = sel.value;
    sel.innerHTML = '<option value="">Pela data</option>' + listaMesesEscolha().map(m => `<option value="${m}">${rotuloMesCurto(m)}</option>`).join('');
    sel.value = v;
}

function preencherVinculos(){
    const sel = document.getElementById('qVinc');
    const v = sel.value;
    const opcoes = [];
    const limite = somarMes(mesAtual(), -4);
    servicos.forEach(s => {
        if(saldoServico(s) > 0.004){ opcoes.push('OS ' + s.numero_os); }
    });
    lancamentos
        .filter(l => (l.tipo === 'parcela' || l.tipo === 'os' || l.tipo === 'debito') && l.valor > 0 && l.mes >= limite && l.mes <= somarMes(mesAtual(), 1))
        .sort((a, b) => b.mes.localeCompare(a.mes) || a.id - b.id)
        .forEach(l => { if(l.descricao){ opcoes.push(l.descricao); } });
    const unicas = [...new Set(opcoes)];
    sel.innerHTML = '<option value="">— saldo geral —</option>' + unicas.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    if(v && unicas.includes(v)){ sel.value = v; }
}

function preencherVeiculosModais(){
    const sel = document.getElementById('sVeiculo');
    sel.innerHTML = '<option value="">Selecione…</option>' + veiculos.map(v => {
        const rot = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        return `<option value="${v.id}">${esc(rot)}</option>`;
    }).join('');

    const nomes = new Set();
    veiculos.forEach(v => { if(v.modelo){ nomes.add(v.modelo.toUpperCase()); } });
    lancamentos.forEach(l => { if(l.tipo === 'parcela' && l.descricao){ nomes.add(l.descricao.split(' ')[0]); } });
    document.getElementById('listaVeiculosCarro').innerHTML = [...nomes].sort().map(n => `<option value="${esc(n)}"></option>`).join('');
}

// ---------------------------------------------------------------------
// Planilha

function filtrar(){
    const busca = document.getElementById('busca').value.trim().toLowerCase();
    const fMes = document.getElementById('filtroMes').value;
    const fAno = document.getElementById('filtroAno').value;
    const fVei = document.getElementById('filtroVeiculo').value;
    const mostrarFuturo = document.getElementById('mostrarFuturo').checked;
    const atual = mesAtual();

    return lancamentos.filter(l => {
        if(fMes && l.mes !== fMes){ return false; }
        if(fAno && l.mes.slice(0, 4) !== fAno){ return false; }
        if(!fMes && !mostrarFuturo && l.mes > atual){ return false; }
        if(fVei && !(l.descricao || '').toUpperCase().includes(fVei.toUpperCase())){ return false; }
        if(busca){
            const alvo = [l.descricao, l.forma_pagamento, l.vinculo, dataBR(l.data)].join(' ').toLowerCase();
            if(!alvo.includes(busca)){ return false; }
        }
        return true;
    });
}

function ordenarMes(linhas){
    // Data decrescente; linhas sem data ficam no fim do mês, na ordem em que
    // foram lançadas (igual à planilha original).
    return linhas.slice().sort((a, b) => {
        if(a.data && b.data && a.data !== b.data){ return a.data < b.data ? 1 : -1; }
        if(a.data && !b.data){ return -1; }
        if(!a.data && b.data){ return 1; }
        return a.id - b.id;
    });
}

function agrupar(linhas){
    const meses = [...new Set(linhas.map(l => l.mes))].sort().reverse();
    return meses.map(m => ({mes: m, linhas: ordenarMes(linhas.filter(l => l.mes === m))}));
}

function render(){

    const atual = mesAtual();
    let totD = 0, totP = 0, totF = 0;
    lancamentos.forEach(l => {
        if(l.mes > atual){ totF += l.valor; } else { totD += l.valor; }
        totP += l.valor_pago;
    });
    document.getElementById('totDebitos').textContent = 'R$ ' + brl(totD);
    document.getElementById('totPago').textContent = 'R$ ' + brl(totP);
    document.getElementById('totSaldo').textContent = 'R$ ' + brl(totD - totP);
    document.getElementById('totFuturo').textContent = 'R$ ' + brl(totF);

    linhasVisiveis = filtrar();
    const grupos = agrupar(linhasVisiveis);
    let html = '', fD = 0, fP = 0;

    grupos.forEach(g => {
        let gv = 0, gp = 0;
        g.linhas.forEach(l => { gv += l.valor; gp += l.valor_pago; });
        fD += gv; fP += gp;
        html += `<tr class="ce-mes"><td>${rotuloMes(g.mes)}${g.mes > atual ? ' <span class="badge bg-secondary">a vencer</span>' : ''}</td><td></td><td class="ce-num">${brl(gv)}</td><td class="ce-num">${brl(gp)}</td><td class="small fw-normal">${g.linhas.length} lançamentos</td><td class="no-print"></td></tr>`;
        g.linhas.forEach(l => {
            html += `<tr${l.id === editandoId ? ' class="ce-editando"' : ''}>
                <td class="ce-desc" title="${esc(l.descricao)}"><span class="ce-tag ce-tag-${l.tipo}">${TAGS[l.tipo] || ''}</span>${esc(l.descricao)}${l.vinculo ? `<span class="ce-vinc">→ ${esc(l.vinculo)}</span>` : ''}</td>
                <td>${dataBR(l.data)}</td>
                <td class="ce-num">${l.valor ? brl(l.valor) : ''}</td>
                <td class="ce-num ce-pago">${l.valor_pago ? brl(l.valor_pago) : ''}</td>
                <td>${esc(l.forma_pagamento)}</td>
                <td class="text-center no-print">
                    <button class="ce-acao" title="Editar" aria-label="Editar lançamento" onclick="editar(${l.id})"><i class="bi bi-pencil"></i></button>
                    <button class="ce-acao" title="Histórico" aria-label="Histórico do lançamento" onclick="abrirHistorico(${l.id})"><i class="bi bi-clock-history"></i></button>
                    <button class="ce-acao text-danger" title="Excluir" aria-label="Excluir lançamento" onclick="excluir(${l.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        });
    });

    if(!grupos.length){
        html = '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum lançamento encontrado.</td></tr>';
    }

    document.getElementById('lista').innerHTML = html;
    document.getElementById('rodape').innerHTML = `<tr><td>TOTAL (filtro atual)</td><td></td><td class="ce-num">${brl(fD)}</td><td class="ce-num">${brl(fP)}</td><td>Saldo: R$ ${brl(fD - fP)}</td><td class="no-print"></td></tr>`;
}

// ---------------------------------------------------------------------
// Lançamento rápido (incluir / editar)

function ajustarBarra(){
    const tipo = document.getElementById('qTipo').value;
    const desc = document.getElementById('qDesc');
    const editando = lancamentos.find(l => l.id === editandoId);
    const ambos = editando && editando.valor && editando.valor_pago;
    const ehPago = tipo === 'pagamento' || tipo === 'credito';
    document.getElementById('boxValor').classList.toggle('d-none', ehPago && !ambos);
    document.getElementById('boxPago').classList.toggle('d-none', !ehPago && !ambos);
    desc.placeholder = {
        pagamento: 'Pix (opcional)',
        parcela: 'YARIS 27/36',
        os: 'OS 3140',
        debito: 'Juros boleto / multa',
        credito: 'Abatimento compra 7852'
    }[tipo];
}

function montarDados(){
    const tipo = document.getElementById('qTipo').value;
    const data = document.getElementById('qData').value || null;
    const mesEscolhido = document.getElementById('qMes').value;
    const editando = lancamentos.find(l => l.id === editandoId);
    const ambos = editando && editando.valor && editando.valor_pago;
    const ehPago = tipo === 'pagamento' || tipo === 'credito';
    let valor = lerValor(document.getElementById('qValor').value);
    let valorPago = lerValor(document.getElementById('qPago').value);
    if(!ambos){
        if(ehPago){ valor = 0; } else { valorPago = 0; }
    }
    let descricao = document.getElementById('qDesc').value.trim();
    if(!descricao && tipo === 'pagamento'){ descricao = 'Pagamento'; }
    if(!descricao && tipo === 'credito'){ descricao = 'Crédito'; }
    const mes = mesEscolhido || (data ? data.slice(0, 7) : (editando ? editando.mes : mesAtual()));
    return {
        fornecedor_id: fornecedorId,
        tipo,
        descricao,
        data,
        mes,
        valor,
        valor_pago: valorPago,
        forma_pagamento: document.getElementById('qForma').value.trim() || null,
        vinculo: document.getElementById('qVinc').value || null
    };
}

async function lancar(){

    if(!fornecedorId){ alert('Selecione o terceiro.'); return; }

    const dados = montarDados();

    if(!dados.valor && !dados.valor_pago){
        alert('Informe o valor.');
        return;
    }

    const btn = document.getElementById('btnLancar');

    if(editandoId){

        const antes = lancamentos.find(l => l.id === editandoId);
        btn.disabled = true;
        const {error} = await supabaseClient.from('ernani_lancamentos').update(dados).eq('id', editandoId);
        btn.disabled = false;
        if(error){ alert(error.message); return; }
        await registrarHistorico('alterou', editandoId, antes.servico_id, resumoLinha(antes), resumoLinha({...antes, ...dados}));
        mostrarAviso('Lançamento alterado: ' + (dados.descricao || '') + '. Totais atualizados.', 'success');

    } else {

        // Evita pagamento duplicado: mesmo valor pago, mesma data e mesma forma.
        if(dados.valor_pago){
            const dup = lancamentos.find(l =>
                Math.abs(l.valor_pago - dados.valor_pago) < 0.005 &&
                (l.data || '') === (dados.data || '') &&
                (l.forma_pagamento || '').toLowerCase() === (dados.forma_pagamento || '').toLowerCase());
            if(dup && !confirm(`Já existe um pagamento de R$ ${brl(dados.valor_pago)} em ${dataBR(dados.data) || '(sem data)'} (${dup.forma_pagamento || 'sem forma'}).\n\nLançar mesmo assim?`)){
                return;
            }
        }

        dados.criado_por = usuarioAtual();
        btn.disabled = true;
        const {data, error} = await supabaseClient.from('ernani_lancamentos').insert(dados).select('id').single();
        btn.disabled = false;
        if(error){ alert(error.message); return; }
        await registrarHistorico('incluiu', data.id, null, null, resumoLinha(dados));
        mostrarAviso('Lançado: ' + (dados.descricao || '') + ' — R$ ' + brl(dados.valor || dados.valor_pago) + '. Totais atualizados.', 'success');
    }

    cancelarEdicao();
    await carregarDados();
}

function resumoLinha(l){
    return {
        tipo: l.tipo, descricao: l.descricao, data: l.data, mes: l.mes,
        valor: l.valor, valor_pago: l.valor_pago, forma_pagamento: l.forma_pagamento, vinculo: l.vinculo
    };
}

function editar(id){
    const l = lancamentos.find(x => x.id === id);
    if(!l){ return; }
    editandoId = id;
    document.getElementById('qTipo').value = l.tipo;
    document.getElementById('qDesc').value = l.descricao || '';
    document.getElementById('qData').value = l.data ? String(l.data).slice(0, 10) : '';
    document.getElementById('qValor').value = l.valor ? brl(l.valor) : '';
    document.getElementById('qPago').value = l.valor_pago ? brl(l.valor_pago) : '';
    document.getElementById('qForma').value = l.forma_pagamento || '';
    const vinc = document.getElementById('qVinc');
    if(l.vinculo && ![...vinc.options].some(o => o.value === l.vinculo)){
        vinc.insertAdjacentHTML('beforeend', `<option value="${esc(l.vinculo)}">${esc(l.vinculo)}</option>`);
    }
    vinc.value = l.vinculo || '';
    // Linha sem data (ou com data fora do mês do bloco) mantém o mês atual do bloco.
    const qMes = document.getElementById('qMes');
    if(!l.data || String(l.data).slice(0, 7) !== l.mes){
        if(![...qMes.options].some(o => o.value === l.mes)){
            qMes.insertAdjacentHTML('beforeend', `<option value="${l.mes}">${rotuloMesCurto(l.mes)}</option>`);
        }
        qMes.value = l.mes;
    } else {
        qMes.value = '';
    }
    document.getElementById('btnLancar').textContent = 'Salvar alteração';
    document.getElementById('btnCancelarEdicao').classList.remove('d-none');
    document.getElementById('barraRapida').classList.add('editando');
    ajustarBarra();
    render();
    document.getElementById('barraRapida').scrollIntoView({behavior: 'smooth', block: 'center'});
}

function cancelarEdicao(){
    editandoId = null;
    document.getElementById('qTipo').value = 'pagamento';
    document.getElementById('qDesc').value = '';
    document.getElementById('qData').value = hojeISO();
    document.getElementById('qValor').value = '';
    document.getElementById('qPago').value = '';
    document.getElementById('qForma').value = '';
    document.getElementById('qVinc').value = '';
    document.getElementById('qMes').value = '';
    document.getElementById('btnLancar').textContent = 'Lançar';
    document.getElementById('btnCancelarEdicao').classList.add('d-none');
    document.getElementById('barraRapida').classList.remove('editando');
    ajustarBarra();
    render();
}

async function excluir(id){
    const l = lancamentos.find(x => x.id === id);
    if(!l){ return; }
    const texto = [l.descricao || TAGS[l.tipo], dataBR(l.data), l.valor ? 'Valor R$ ' + brl(l.valor) : '', l.valor_pago ? 'Pago R$ ' + brl(l.valor_pago) : ''].filter(Boolean).join(' · ');
    if(!confirm('Excluir este lançamento?\n\n' + texto + '\n\nA exclusão fica registrada no histórico.')){
        return;
    }
    const {error} = await supabaseClient.from('ernani_lancamentos').delete().eq('id', id);
    if(error){ alert(error.message); return; }
    await registrarHistorico('excluiu', id, l.servico_id, resumoLinha(l), null);
    if(editandoId === id){ cancelarEdicao(); }
    mostrarAviso('Lançamento excluído (registrado no histórico).', 'warning');
    await carregarDados();
}

// ---------------------------------------------------------------------
// Serviços pendentes

function pagoServico(s){
    const lancado = lancamentos.filter(l => l.servico_id === s.id).reduce((t, l) => t + l.valor, 0);
    return Math.round((s.valor_pago_inicial + lancado) * 100) / 100;
}

function saldoServico(s){
    return Math.round((s.valor_total - pagoServico(s)) * 100) / 100;
}

function atualizarContadorPendentes(){
    document.getElementById('qtdPendentes').textContent = servicos.filter(s => saldoServico(s) > 0.004).length;
}

function abrirPendentes(){
    limparServico();
    renderServicos();
    abrirModal('modalPendentes');
}

function renderServicos(){
    const mostrarQuitadas = document.getElementById('mostrarQuitadas').checked;
    const lista = servicos.filter(s => mostrarQuitadas || saldoServico(s) > 0.004)
        .sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.id - a.id);
    let tt = 0, tp = 0;
    const html = lista.map(s => {
        const pago = pagoServico(s), saldo = saldoServico(s);
        tt += s.valor_total; tp += pago;
        const quit = saldo <= 0.004;
        const status = quit ? '<span class="badge bg-success">QUITADA</span>' : (pago ? '<span class="badge bg-warning text-dark">PARCIAL</span>' : '<span class="badge bg-danger">PENDENTE</span>');
        return `<tr>
            <td class="fw-bold">${esc(s.numero_os)}</td>
            <td>${dataBR(s.data)}</td>
            <td>${esc([s.veiculo, s.placa].filter(Boolean).join(' · ')) || '—'}</td>
            <td class="ce-desc" title="${esc(s.descricao)}">${esc(s.descricao)}</td>
            <td class="ce-num">${brl(s.valor_total)}</td>
            <td class="ce-num ce-pago">${pago ? brl(pago) : ''}</td>
            <td class="ce-num fw-bold text-danger">${brl(saldo)}</td>
            <td>${status}</td>
            <td class="text-center">
                <button class="ce-acao" title="Editar" aria-label="Editar OS" onclick="editarServico(${s.id})"><i class="bi bi-pencil"></i></button>
                <button class="ce-acao text-danger" title="Excluir" aria-label="Excluir OS" onclick="excluirServico(${s.id})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
    document.getElementById('listaServicos').innerHTML = html || '<tr><td colspan="9" class="text-center text-muted py-3">Nenhum serviço pendente.</td></tr>';
    document.getElementById('rodapeServicos').innerHTML = `<tr><td colspan="4">TOTAL</td><td class="ce-num">${brl(tt)}</td><td class="ce-num">${brl(tp)}</td><td class="ce-num">${brl(tt - tp)}</td><td colspan="2"></td></tr>`;
}

function preencherPlacaServico(){
    const id = document.getElementById('sVeiculo').value;
    const v = veiculos.find(x => String(x.id) === id);
    if(v){ document.getElementById('sPlaca').value = v.placa || ''; }
}

function limparServico(){
    editandoServicoId = null;
    ['sNum', 'sData', 'sPlaca', 'sDesc', 'sTotal', 'sPago'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('sVeiculo').value = '';
    document.getElementById('btnSalvarServico').textContent = 'Cadastrar OS';
    document.getElementById('btnCancelarServico').classList.add('d-none');
}

function editarServico(id){
    const s = servicos.find(x => x.id === id);
    if(!s){ return; }
    editandoServicoId = id;
    document.getElementById('sNum').value = s.numero_os || '';
    document.getElementById('sData').value = s.data ? String(s.data).slice(0, 10) : '';
    document.getElementById('sVeiculo').value = s.veiculo_id || '';
    document.getElementById('sPlaca').value = s.placa || '';
    document.getElementById('sDesc').value = s.descricao || '';
    document.getElementById('sTotal').value = brl(s.valor_total);
    document.getElementById('sPago').value = s.valor_pago_inicial ? brl(s.valor_pago_inicial) : '';
    document.getElementById('btnSalvarServico').textContent = 'Salvar alteração';
    document.getElementById('btnCancelarServico').classList.remove('d-none');
}

async function salvarServico(){
    const numero = document.getElementById('sNum').value.trim();
    const total = lerValor(document.getElementById('sTotal').value);
    if(!numero || !total){ alert('Informe o nº da OS e o valor total.'); return; }
    if(servicos.some(s => s.numero_os === numero && s.id !== editandoServicoId)){
        alert('A OS ' + numero + ' já está cadastrada para este terceiro.');
        return;
    }
    const veiculoId = document.getElementById('sVeiculo').value;
    const v = veiculos.find(x => String(x.id) === veiculoId);
    const dados = {
        fornecedor_id: fornecedorId,
        numero_os: numero,
        data: document.getElementById('sData').value || null,
        veiculo_id: veiculoId || null,
        veiculo: v ? ([v.modelo, v.fabricante].filter(Boolean).join(' ') || v.placa) : null,
        placa: document.getElementById('sPlaca').value.trim().toUpperCase() || null,
        descricao: document.getElementById('sDesc').value.trim() || null,
        valor_total: total,
        valor_pago_inicial: lerValor(document.getElementById('sPago').value)
    };
    let error, novoId = editandoServicoId;
    if(editandoServicoId){
        const antes = servicos.find(s => s.id === editandoServicoId);
        ({error} = await supabaseClient.from('ernani_servicos').update(dados).eq('id', editandoServicoId));
        if(!error){ await registrarHistorico('alterou OS', null, editandoServicoId, antes, dados); }
    } else {
        dados.criado_por = usuarioAtual();
        let r;
        ({data: r, error} = await supabaseClient.from('ernani_servicos').insert(dados).select('id').single());
        if(!error){ novoId = r.id; await registrarHistorico('cadastrou OS', null, novoId, null, dados); }
    }
    if(error){ alert(error.message); return; }
    mostrarAviso('OS ' + numero + (editandoServicoId ? ' alterada.' : ' cadastrada em Serviços Pendentes.'), 'success');
    limparServico();
    await carregarDados();
    renderServicos();
}

async function excluirServico(id){
    const s = servicos.find(x => x.id === id);
    if(!s){ return; }
    const ligados = lancamentos.filter(l => l.servico_id === id).length;
    const extra = ligados ? `\n\nEla já tem ${ligados} lançamento(s) na planilha, que continuam lá (só perdem o vínculo).` : '';
    if(!confirm('Excluir a OS ' + s.numero_os + ' da lista de serviços pendentes?' + extra)){ return; }
    const {error} = await supabaseClient.from('ernani_servicos').delete().eq('id', id);
    if(error){ alert(error.message); return; }
    await registrarHistorico('excluiu OS', null, id, s, null);
    await carregarDados();
    renderServicos();
}

// ---------------------------------------------------------------------
// + Adicionar serviço na planilha

let selecionadosAdd = {};

function abrirAdicionarServico(){
    selecionadosAdd = {};
    const sel = document.getElementById('mesAlvo');
    sel.innerHTML = listaMesesEscolha().filter(m => m >= somarMes(mesAtual(), -3)).map(m => `<option value="${m}">${rotuloMes(m)}</option>`).join('');
    sel.value = mesAtual();
    const abertas = servicos.filter(s => saldoServico(s) > 0.004);
    document.getElementById('listaAdicionar').innerHTML = abertas.length ? abertas.map(s => `<tr>
        <td class="text-center"><input type="checkbox" class="form-check-input" aria-label="Selecionar OS ${esc(s.numero_os)}" id="add_${s.id}" onchange="marcarAdd(${s.id}, this.checked)"></td>
        <td class="fw-bold">${esc(s.numero_os)}</td>
        <td>${esc([s.veiculo, s.placa].filter(Boolean).join(' · ')) || '—'}</td>
        <td class="ce-desc" title="${esc(s.descricao)}">${esc(s.descricao)}</td>
        <td class="ce-num">${brl(saldoServico(s))}</td>
        <td><input class="form-control form-control-sm text-end" id="addv_${s.id}" aria-label="Valor a lançar da OS ${esc(s.numero_os)}" inputmode="decimal" value="${brl(saldoServico(s))}" oninput="marcarAdd(${s.id}, true)"></td>
    </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-3">Nenhum serviço pendente. Cadastre em SERVIÇOS PENDENTES.</td></tr>';
    atualizarResumoAdicionar();
    abrirModal('modalAdicionar');
}

function marcarAdd(id, marcado){
    selecionadosAdd[id] = marcado;
    const chk = document.getElementById('add_' + id);
    if(chk){ chk.checked = marcado; }
    atualizarResumoAdicionar();
}

function valorAdd(s){
    const saldo = saldoServico(s);
    const v = lerValor(document.getElementById('addv_' + s.id)?.value);
    return Math.min(Math.max(v, 0), saldo);
}

function atualizarResumoAdicionar(){
    const escolhidas = servicos.filter(s => selecionadosAdd[s.id]);
    const soma = escolhidas.reduce((t, s) => t + valorAdd(s), 0);
    document.getElementById('resumoAdicionar').textContent = escolhidas.length ? escolhidas.length + ' OS selecionada(s) · R$ ' + brl(soma) : 'Nenhuma OS selecionada';
    const mes = document.getElementById('mesAlvo').value;
    document.getElementById('btnLancarServicos').textContent = 'Lançar em ' + (mes ? rotuloMes(mes) : '');
}

async function lancarServicos(){
    const escolhidas = servicos.filter(s => selecionadosAdd[s.id]);
    if(!escolhidas.length){ alert('Selecione pelo menos uma OS.'); return; }
    const mes = document.getElementById('mesAlvo').value;
    const linhas = [];
    escolhidas.forEach(s => {
        const v = valorAdd(s);
        if(!v){ return; }
        const parcial = v < saldoServico(s) - 0.004;
        linhas.push({
            fornecedor_id: fornecedorId,
            mes,
            data: s.data || null,
            tipo: 'os',
            descricao: 'OS ' + s.numero_os + (s.veiculo ? ' — ' + s.veiculo : '') + (parcial ? ' (parcial)' : ''),
            valor: v,
            valor_pago: 0,
            servico_id: s.id,
            criado_por: usuarioAtual()
        });
    });
    if(!linhas.length){ alert('Informe um valor maior que zero.'); return; }
    const btn = document.getElementById('btnLancarServicos');
    btn.disabled = true;
    const {data, error} = await supabaseClient.from('ernani_lancamentos').insert(linhas).select('id, servico_id');
    btn.disabled = false;
    if(error){ alert(error.message); return; }
    for(const r of data){
        await registrarHistorico('incluiu (serviço)', r.id, r.servico_id, null, linhas.find(l => l.servico_id === r.servico_id));
    }
    fecharModal('modalAdicionar');
    const soma = linhas.reduce((t, l) => t + l.valor, 0);
    mostrarAviso(linhas.length + ' serviço(s) lançado(s) em ' + rotuloMes(mes) + ' — R$ ' + brl(soma) + '. Saldo das OS atualizado.', 'success');
    await carregarDados();
}

// ---------------------------------------------------------------------
// + Carro / parcelas

function abrirCarro(){
    ['cVeiculo', 'cPlaca', 'cValor', 'cQtd', 'cVenc'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cIni').value = '1';
    previaCarro();
    abrirModal('modalCarro');
}

function parcelasCarro(){
    const veic = document.getElementById('cVeiculo').value.trim();
    const placa = document.getElementById('cPlaca').value.trim().toUpperCase();
    const valor = lerValor(document.getElementById('cValor').value);
    const qtd = parseInt(document.getElementById('cQtd').value, 10);
    const ini = parseInt(document.getElementById('cIni').value, 10) || 1;
    const venc = document.getElementById('cVenc').value;
    if(!veic || !valor || !qtd || !venc || ini > qtd || qtd > 120){ return []; }
    const p = venc.split('-');
    const ano = parseInt(p[0], 10), mes0 = parseInt(p[1], 10) - 1, dia = parseInt(p[2], 10);
    const out = [];
    for(let k = ini; k <= qtd; k++){
        const m = mes0 + (k - ini);
        const a = ano + Math.floor(m / 12), mm = (m % 12) + 1;
        const d = Math.min(dia, new Date(a, mm, 0).getDate());
        const iso = a + '-' + String(mm).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        out.push({descricao: veic + ' ' + k + '/' + qtd + (placa ? ' · ' + placa : ''), data: iso, mes: iso.slice(0, 7), valor});
    }
    return out;
}

function previaCarro(){
    const ps = parcelasCarro();
    const mostrar = ps.length > 6 ? ps.slice(0, 3).concat([null], ps.slice(-1)) : ps;
    document.getElementById('previaParcelas').innerHTML = mostrar.map(p => p
        ? `<tr><td>${esc(p.descricao)}</td><td>${dataBR(p.data)}</td><td class="ce-num">${brl(p.valor)}</td></tr>`
        : '<tr><td colspan="3" class="text-muted">…</td></tr>').join('') || '<tr><td colspan="3" class="text-muted text-center">—</td></tr>';
    document.getElementById('tituloPrevia').textContent = ps.length
        ? 'Prévia — ' + ps.length + ' parcelas (' + dataBR(ps[0].data) + ' a ' + dataBR(ps[ps.length - 1].data) + ')'
        : 'Prévia — preencha veículo, valor, quantidade e 1º vencimento';
    document.getElementById('btnGerarParcelas').textContent = ps.length ? 'Gerar ' + ps.length + ' parcelas' : 'Gerar parcelas';
}

async function gerarParcelas(){
    const ps = parcelasCarro();
    if(!ps.length){ alert('Preencha veículo, valor da parcela, quantidade e 1º vencimento.'); return; }
    // Evita gerar duas vezes as mesmas parcelas.
    const repetidas = ps.filter(p => lancamentos.some(l => l.tipo === 'parcela' && l.descricao === p.descricao));
    if(repetidas.length && !confirm(repetidas.length + ' dessas parcelas já existem na planilha (ex.: ' + repetidas[0].descricao + ').\n\nGerar mesmo assim?')){
        return;
    }
    const linhas = ps.map(p => ({
        fornecedor_id: fornecedorId, mes: p.mes, data: p.data, tipo: 'parcela',
        descricao: p.descricao, valor: p.valor, valor_pago: 0, criado_por: usuarioAtual()
    }));
    const btn = document.getElementById('btnGerarParcelas');
    btn.disabled = true;
    const {error} = await supabaseClient.from('ernani_lancamentos').insert(linhas);
    btn.disabled = false;
    if(error){ alert(error.message); return; }
    await registrarHistorico('gerou parcelas', null, null, null, {veiculo: document.getElementById('cVeiculo').value.trim(), parcelas: ps.length, de: ps[0].descricao, ate: ps[ps.length - 1].descricao, valor: ps[0].valor});
    fecharModal('modalCarro');
    mostrarAviso(ps.length + ' parcelas geradas (' + dataBR(ps[0].data) + ' a ' + dataBR(ps[ps.length - 1].data) + '). As futuras ficam em "A vencer".', 'success');
    await carregarDados();
}

// ---------------------------------------------------------------------
// Histórico

function descreverValores(o){
    if(!o){ return ''; }
    const partes = [];
    if(o.descricao){ partes.push(esc(o.descricao)); }
    if(o.numero_os){ partes.push('OS ' + esc(o.numero_os)); }
    if(o.data){ partes.push(dataBR(o.data)); }
    if(Number(o.valor)){ partes.push('valor R$ ' + brl(o.valor)); }
    if(Number(o.valor_total)){ partes.push('total R$ ' + brl(o.valor_total)); }
    if(Number(o.valor_pago)){ partes.push('pago R$ ' + brl(o.valor_pago)); }
    if(o.forma_pagamento){ partes.push(esc(o.forma_pagamento)); }
    if(o.vinculo){ partes.push('→ ' + esc(o.vinculo)); }
    if(o.parcelas){ partes.push(o.parcelas + ' parcelas de R$ ' + brl(o.valor) + ' (' + esc(o.de) + ' a ' + esc(o.ate) + ')'); }
    return partes.join(' · ');
}

async function abrirHistorico(lancamentoId){
    const corpo = document.getElementById('corpoHistorico');
    const titulo = document.getElementById('tituloHistorico');
    corpo.innerHTML = '<p class="text-muted">Carregando…</p>';
    abrirModal('modalHistorico');

    let consulta = supabaseClient.from('ernani_historico').select('*').order('created_at', {ascending: false}).limit(300);
    if(lancamentoId){
        const l = lancamentos.find(x => x.id === lancamentoId);
        titulo.textContent = 'Histórico — ' + (l ? (l.descricao || TAGS[l.tipo]) + (l.data ? ' · ' + dataBR(l.data) : '') : 'lançamento');
        consulta = consulta.eq('lancamento_id', lancamentoId);
    } else {
        const f = fornecedores.find(x => String(x.id) === String(fornecedorId));
        titulo.textContent = 'Histórico de alterações — ' + (f ? f.nome : '');
        consulta = consulta.eq('fornecedor_id', String(fornecedorId));
    }

    const {data, error} = await consulta;
    if(error){ corpo.innerHTML = '<p class="text-danger">' + esc(error.message) + '</p>'; return; }

    let html = '';
    if(lancamentoId){
        const l = lancamentos.find(x => x.id === lancamentoId);
        if(l && l.criado_por === 'importação planilha'){
            html += '<div class="small text-muted mb-2">Linha importada da planilha PENDENCIAS - 2026.</div>';
        }
    }
    if(!data.length){
        corpo.innerHTML = html + '<p class="text-muted mb-0">Nenhuma alteração registrada ainda.</p>';
        return;
    }
    html += '<table class="table table-sm small mb-0"><thead><tr><th style="width:130px">Quando</th><th style="width:110px">Usuário</th><th>O que foi feito</th></tr></thead><tbody>';
    data.forEach(h => {
        const d = new Date(h.created_at);
        const quando = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        let oque = '<strong>' + esc(h.acao) + '</strong>';
        if(h.antes && h.depois){
            oque += '<div class="text-muted"><s>' + descreverValores(h.antes) + '</s></div><div>' + descreverValores(h.depois) + '</div>';
        } else {
            oque += '<div>' + descreverValores(h.depois || h.antes) + '</div>';
        }
        html += `<tr><td>${quando}</td><td>${esc(h.usuario)}</td><td>${oque}</td></tr>`;
    });
    html += '</tbody></table>';
    corpo.innerHTML = html;
}

// ---------------------------------------------------------------------
// Exportar

function nomeFornecedor(){
    const f = fornecedores.find(x => String(x.id) === String(fornecedorId));
    return f ? f.nome : '';
}

function linhasExportacao(){
    const out = [];
    agrupar(linhasVisiveis).forEach(g => {
        let gv = 0, gp = 0;
        g.linhas.forEach(l => { gv += l.valor; gp += l.valor_pago; });
        out.push({mes: true, descricao: rotuloMes(g.mes), data: '', valor: gv, pago: gp, forma: ''});
        g.linhas.forEach(l => out.push({mes: false, descricao: l.descricao || '', data: dataBR(l.data), valor: l.valor, pago: l.valor_pago, forma: [l.forma_pagamento, l.vinculo ? '→ ' + l.vinculo : ''].filter(Boolean).join(' ')}));
    });
    return out;
}

function carregarScript(src){
    return new Promise((ok, falha) => {
        const s = document.createElement('script');
        s.src = src; s.onload = ok; s.onerror = falha;
        document.head.appendChild(s);
    });
}

async function exportarExcel(){
    try{
        if(!window.XLSX){ await carregarScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); }
    } catch(e){
        alert('Não foi possível carregar o gerador de Excel. Verifique a internet e tente de novo.');
        return;
    }
    const aoa = [
        [nomeFornecedor(), '', 'SALDO A PAGAR', document.getElementById('totSaldo').textContent],
        ['TOTAL DÉBITOS', document.getElementById('totDebitos').textContent, 'DATA ATUAL', dataBR(hojeISO())],
        ['TOTAL PAGO', document.getElementById('totPago').textContent],
        [],
        ['DESCRIÇÃO', 'DATA', 'VALOR', 'VALOR PAGO', 'FORMA DE PAG']
    ];
    linhasExportacao().forEach(r => aoa.push([r.descricao, r.data, r.valor || null, r.pago || null, r.forma]));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch: 34}, {wch: 12}, {wch: 14}, {wch: 14}, {wch: 26}];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for(let r = 5; r <= range.e.r; r++){
        ['C', 'D'].forEach(c => { const cel = ws[c + (r + 1)]; if(cel && typeof cel.v === 'number'){ cel.z = '#,##0.00'; } });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    XLSX.writeFile(wb, 'controle-' + nomeFornecedor().replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() + '-' + hojeISO() + '.xlsx');
}

function exportarPdf(){
    const linhas = linhasExportacao().map(r => r.mes
        ? `<tr class="m"><td>${esc(r.descricao)}</td><td></td><td class="n">${brl(r.valor)}</td><td class="n">${brl(r.pago)}</td><td></td></tr>`
        : `<tr><td>${esc(r.descricao)}</td><td>${r.data}</td><td class="n">${r.valor ? brl(r.valor) : ''}</td><td class="n">${r.pago ? brl(r.pago) : ''}</td><td>${esc(r.forma)}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if(!w){ alert('Libere as janelas pop-up deste site para gerar o PDF.'); return; }
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Controle ${esc(nomeFornecedor())}</title>
<style>
body{font-family:Calibri,Carlito,Arial,sans-serif;font-size:11px;margin:16px;color:#111}
.cab{display:grid;grid-template-columns:120px 1fr 130px 1fr;max-width:640px;margin-bottom:10px;font-size:12px}
.cab div{padding:3px 6px}.o{background:#c99a2e;font-weight:700}.c{background:#ececec}
h2{font-size:14px;margin:0 0 6px;color:#0b57d0}
table{border-collapse:collapse;width:100%}th{background:#1f1f1f;color:#fff;text-align:left;padding:3px 6px}
td{padding:2px 6px;border-bottom:1px solid #ddd}.n{text-align:right;font-variant-numeric:tabular-nums}
tr.m td{background:#dde3ea;font-weight:700;border-top:2px solid #8a96a3}
.np{margin-bottom:10px}@media print{.np{display:none}}
</style></head><body>
<div class="np"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
<h2>${esc(nomeFornecedor())}</h2>
<div class="cab">
<div class="o">TOTAL DÉBITOS</div><div class="c">${document.getElementById('totDebitos').textContent}</div>
<div class="o">SALDO A PAGAR</div><div class="c"><b>${document.getElementById('totSaldo').textContent}</b></div>
<div class="o">TOTAL PAGO</div><div class="c">${document.getElementById('totPago').textContent}</div>
<div class="o">DATA ATUAL</div><div class="c">${dataBR(hojeISO())}</div>
</div>
<table><thead><tr><th>DESCRIÇÃO</th><th>DATA</th><th class="n">VALOR</th><th class="n">VALOR PAGO</th><th>FORMA DE PAG</th></tr></thead><tbody>${linhas}</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => { try{ w.print(); } catch(e){} }, 400);
}

checarLogin();
