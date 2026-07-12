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

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.fornecedores?.nome ?? ''}</td>
            <td>${c.conta_contabil?.nome ?? ''}</td>
            <td>${dataFmt}</td>
            <td>${formatarMoeda(c.valor_total)}</td>
            <td>${formatarMoeda(c.valor_parcela)}</td>
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
