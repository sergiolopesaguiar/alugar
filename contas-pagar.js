// Lógica da página Financeiro > Contas a Pagar.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Cada lançamento referencia um fornecedor e uma conta contábil (ambos
// combobox alimentados pelas respectivas tabelas). Status Pendente/Pago
// controla o que já foi quitado - adicionado além dos campos originalmente
// pedidos, a pedido do Sérgio, porque sem isso não daria pra saber o que
// já foi pago.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'contas_pagar';

let editandoId = null;

async function carregarFornecedoresDisponiveis(){

    const {data, error} = await supabaseClient
        .from('fornecedores')
        .select('id, nome')
        .order('nome');

    const select = document.getElementById('fornecedorId');

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar fornecedores</option>';
        return;
    }

    let html = '<option value="" selected disabled>Selecione o fornecedor...</option>';
    (data || []).forEach(f => {
        html += `<option value="${f.id}">${f.nome}</option>`;
    });
    select.innerHTML = html;

}

async function carregarContasDisponiveis(){

    const {data, error} = await supabaseClient
        .from('conta_contabil')
        .select('id, nome, natureza')
        .order('nome');

    const select = document.getElementById('contaId');

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar contas</option>';
        return;
    }

    let html = '<option value="" selected disabled>Selecione a conta...</option>';
    (data || []).forEach(c => {
        const rotulo = c.natureza ? `${c.nome} (${c.natureza})` : c.nome;
        html += `<option value="${c.id}">${rotulo}</option>`;
    });
    select.innerHTML = html;

}

function formatarMoeda(valor){
    return valor != null ? Number(valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';
}

function formatarDataBR(dataStr){
    return dataStr ? new Date(dataStr + 'T00:00:00').toLocaleDateString('pt-BR') : '';
}

// Soma N meses a uma data 'YYYY-MM-DD', preservando o dia quando possível e
// ajustando (clamp) para o último dia do mês de destino quando o mês de
// destino tem menos dias (ex: 31/01 + 1 mês -> 28/02 ou 29/02, nunca 03/03).
function addMonths(dataStr, n){
    const [y, m, d] = dataStr.split('-').map(Number);
    const totalMeses = (m - 1) + n;
    const anoAlvo = y + Math.floor(totalMeses / 12);
    const mesAlvo = ((totalMeses % 12) + 12) % 12; // 0-indexado
    const ultimoDiaDoMes = new Date(anoAlvo, mesAlvo + 1, 0).getDate();
    const diaAlvo = Math.min(d, ultimoDiaDoMes);
    const mm = String(mesAlvo + 1).padStart(2, '0');
    const dd = String(diaAlvo).padStart(2, '0');
    return `${anoAlvo}-${mm}-${dd}`;
}

// Distribui o valor_total em parcelas mensais de valor_parcela, com a
// última parcela cobrindo o resto (ex: 22.000 / 4.000 -> 5 parcelas de
// 4.000 + 1 de 2.000). Se a divisão for exata, todas as parcelas ficam
// com o mesmo valor (ex: 40.000 / 4.000 -> 10 parcelas de 4.000).
function calcularParcelas(valorTotal, valorParcela, vencimentoBase){
    const qtdCheia = Math.floor(valorTotal / valorParcela);
    const resto = Math.round((valorTotal - qtdCheia * valorParcela) * 100) / 100;
    const parcelas = [];
    for(let i = 0; i < qtdCheia; i++){
        parcelas.push({numero: i + 1, valor: valorParcela, vencimento: addMonths(vencimentoBase, i)});
    }
    if(resto > 0.009){
        parcelas.push({numero: qtdCheia + 1, valor: resto, vencimento: addMonths(vencimentoBase, qtdCheia)});
    }
    return parcelas;
}

// Guarda o estado entre abrir a prévia (abrirPreviaParcelamento) e confirmar
// a geração das linhas (confirmarParcelamento) - o usuário vê a tabela e
// decide aprovar ou cancelar antes de qualquer insert acontecer.
let parcelasPendentes = null;
let dadosComunsPendentes = null;

function abrirPreviaParcelamento(dadosComuns, parcelas){

    parcelasPendentes = parcelas;
    dadosComunsPendentes = dadosComuns;

    let html = '';
    parcelas.forEach(p => {
        html += `<tr><td>${p.numero}/${parcelas.length}</td><td>${formatarDataBR(p.vencimento)}</td><td>${formatarMoeda(p.valor)}</td></tr>`;
    });
    document.getElementById('corpoPreviaParcelas').innerHTML = html;

    const total = parcelas.reduce((soma, p) => soma + p.valor, 0);
    document.getElementById('totalPreviaParcelas').textContent = formatarMoeda(total);
    document.getElementById('tituloModalParcelamento').textContent = `Confirmar geração de ${parcelas.length} parcelas`;

    const modal = new bootstrap.Modal(document.getElementById('modalParcelamento'));
    modal.show();

}

async function confirmarParcelamento(){

    if(!parcelasPendentes || !dadosComunsPendentes){
        return;
    }

    const grupo = crypto.randomUUID();

    const linhas = parcelasPendentes.map(p => ({
        fornecedor_id: dadosComunsPendentes.fornecedorId,
        conta_id: dadosComunsPendentes.contaId,
        status: dadosComunsPendentes.status,
        data: dadosComunsPendentes.data,
        valor_total: dadosComunsPendentes.valorTotal,
        valor_parcela: p.valor,
        data_vencimento: p.vencimento,
        grupo_parcelamento: grupo,
        numero_parcela: p.numero,
        total_parcelas: parcelasPendentes.length
    }));

    const {error} = await supabaseClient
        .from('contas_pagar')
        .insert(linhas);

    if(error){
        alert('Erro ao gerar as parcelas: ' + error.message);
        return;
    }

    const modalEl = document.getElementById('modalParcelamento');
    bootstrap.Modal.getInstance(modalEl)?.hide();

    parcelasPendentes = null;
    dadosComunsPendentes = null;

    cancelarEdicao();
    carregar();

}

async function carregar(){

    const {data, error} = await supabaseClient
        .from('contas_pagar')
        .select('*, fornecedores(nome), conta_contabil(nome)')
        .order('data_vencimento');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(c => {

        const dataFmt = c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const vencimentoFmt = c.data_vencimento ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const corStatus = c.status === 'Pago' ? 'text-success' : 'text-danger';
        const parcelaFmt = c.total_parcelas ? `${c.numero_parcela}/${c.total_parcelas}` : '';

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.fornecedores?.nome ?? ''}</td>
            <td>${c.conta_contabil?.nome ?? ''}</td>
            <td>${dataFmt}</td>
            <td>${formatarMoeda(c.valor_total)}</td>
            <td>${formatarMoeda(c.valor_parcela)}</td>
            <td>${parcelaFmt}</td>
            <td>${vencimentoFmt}</td>
            <td class="${corStatus} fw-semibold">${c.status}</td>
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
        .from('contas_pagar')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("fornecedorId").value = data.fornecedor_id ?? '';
    document.getElementById("contaId").value = data.conta_id ?? '';
    document.getElementById("status").value = data.status ?? 'Pendente';
    document.getElementById("data").value = data.data ?? '';
    document.getElementById("valor_total").value = data.valor_total ?? '';
    document.getElementById("valor_parcela").value = data.valor_parcela ?? '';
    document.getElementById("data_vencimento").value = data.data_vencimento ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("fornecedorId").value = '';
    document.getElementById("contaId").value = '';
    document.getElementById("status").value = 'Pendente';
    document.getElementById("data").value = '';
    document.getElementById("valor_total").value = '';
    document.getElementById("valor_parcela").value = '';
    document.getElementById("data_vencimento").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('contas_pagar')
        .select('fornecedores(nome)')
        .eq('id', id)
        .single();

    const fornecedor = data?.fornecedores?.nome || '(sem fornecedor)';

    if(!confirm(`Excluir a conta a pagar #${id} - ${fornecedor}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('contas_pagar')
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

    const fornecedorId = document.getElementById("fornecedorId").value;
    const contaId = document.getElementById("contaId").value;
    const status = document.getElementById("status").value;
    const dataValor = document.getElementById("data").value;
    const valorTotal = document.getElementById("valor_total").value;
    const valorParcela = document.getElementById("valor_parcela").value;
    const dataVencimento = document.getElementById("data_vencimento").value;

    if(!fornecedorId){
        alert('Selecione o fornecedor.');
        return;
    }

    // Parcelamento automático: só dispara para lançamento novo (não em
    // edição de uma parcela já existente - ver AskUserQuestion respondida
    // por Sérgio) e quando o valor total informado é maior que o valor da
    // parcela. Em vez de salvar direto, mostra a prévia das parcelas para
    // aprovação antes de gravar qualquer coisa no banco.
    const valorTotalNum = valorTotal ? Number(valorTotal) : 0;
    const valorParcelaNum = valorParcela ? Number(valorParcela) : 0;

    if(!editandoId && valorTotalNum > 0 && valorParcelaNum > 0 && valorTotalNum > valorParcelaNum + 0.009){

        if(!dataVencimento){
            alert('Informe o vencimento da primeira parcela para gerar o parcelamento.');
            return;
        }

        const parcelas = calcularParcelas(valorTotalNum, valorParcelaNum, dataVencimento);

        abrirPreviaParcelamento({
            fornecedorId: Number(fornecedorId),
            contaId: contaId ? Number(contaId) : null,
            status: status || 'Pendente',
            data: dataValor || null,
            valorTotal: valorTotalNum
        }, parcelas);

        return;

    }

    const dados = {
        fornecedor_id: Number(fornecedorId),
        conta_id: contaId ? Number(contaId) : null,
        status: status || 'Pendente',
        data: dataValor || null,
        valor_total: valorTotal ? Number(valorTotal) : null,
        valor_parcela: valorParcela ? Number(valorParcela) : null,
        data_vencimento: dataVencimento || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('contas_pagar')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('contas_pagar')
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
carregarFornecedoresDisponiveis();
carregarContasDisponiveis();
