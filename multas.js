// Lógica da página Cadastros > Multas.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Controle do histórico de multas de trânsito por veículo (placa), a partir
// da planilha "CADASTRO DE MULTAS" enviada pelo usuário. Cada linha guarda:
// Infração, Valor, Data da Infração, Data Limite pra Defesa, Data Email,
// Indicada (SIM/NÃO/RECORREU), Registro Pg Detran e Cobrança de Terceiro.
//
// Observação sobre a tabela "multas": ela já existia no banco (criada antes,
// vazia, sem nenhuma tela usando) com colunas pensadas para uma futura
// consulta automática de multas (numero_auto, orgao_autuador, etc). Em vez de
// apagar e recriar, esta tela reaproveita as colunas que já serviam para os
// mesmos dados - o campo "Infração" da planilha (um código, ex: P09NP001PF)
// é gravado na coluna existente numero_auto - e só foram adicionadas as
// colunas que faltavam: data_limite_defesa, data_email, indicada,
// registro_pg_detran, cobranca_terceiro e observacao.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'multas';

let editandoId = null;

// Preenche o <select> de veículos, mostrando Placa - Fabricante Modelo.
// (mesma função usada em atividades.js)
async function carregarVeiculos(){

    const {data, error} = await supabaseClient
        .from('veiculos')
        .select('id, placa, fabricante, modelo')
        .order('placa');

    const select = document.getElementById('veiculoId');
    const valorAtual = select.value;

    if(error){
        select.innerHTML = '<option value="" selected disabled>Erro ao carregar veículos</option>';
        return;
    }

    let html = '<option value="" selected disabled>Selecione o veículo</option>';

    (data || []).forEach(v => {
        const rotulo = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        html += `<option value="${v.id}">${rotulo}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

async function carregar(){

    await carregarVeiculos();

    const {data, error} = await supabaseClient
        .from('multas')
        .select('*, veiculos(placa, fabricante, modelo)')
        .order('data_infracao', {ascending: false});

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    (data || []).forEach(m => {

        const veiculo = m.veiculos
            ? [m.veiculos.placa, [m.veiculos.fabricante, m.veiculos.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
            : '<span class="text-danger">(sem veículo)</span>';

        const valorFmt = m.valor != null ? Number(m.valor).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '';
        const dataInfracaoFmt = m.data_infracao ? new Date(m.data_infracao + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const dataLimiteFmt = m.data_limite_defesa ? new Date(m.data_limite_defesa + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const dataEmailFmt = m.data_email ? new Date(m.data_email + 'T00:00:00').toLocaleDateString('pt-BR') : '';

        const indicadaCor = m.indicada === 'SIM' ? 'bg-success' : (m.indicada === 'RECORREU' ? 'bg-warning text-dark' : 'bg-secondary');
        const indicadaBadge = m.indicada ? `<span class="badge ${indicadaCor}">${m.indicada}</span>` : '';

        html += `
        <tr>
            <td>${m.id}</td>
            <td>${veiculo}</td>
            <td>${m.numero_auto ?? ''}</td>
            <td>${valorFmt}</td>
            <td>${dataInfracaoFmt}</td>
            <td>${dataLimiteFmt}</td>
            <td>${dataEmailFmt}</td>
            <td>${indicadaBadge}</td>
            <td>${m.registro_pg_detran ?? ''}</td>
            <td>${m.cobranca_terceiro ?? ''}</td>
            <td>${m.observacao ?? ''}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${m.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${m.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
        `;

    });

    document.getElementById("lista").innerHTML = html;

}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('multas')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("veiculoId").value = data.veiculo_id ?? '';
    document.getElementById("infracao").value = data.numero_auto ?? '';
    document.getElementById("valor").value = data.valor ?? '';
    document.getElementById("dataInfracao").value = data.data_infracao ?? '';
    document.getElementById("dataLimiteDefesa").value = data.data_limite_defesa ?? '';
    document.getElementById("dataEmail").value = data.data_email ?? '';
    document.getElementById("indicada").value = data.indicada ?? '';
    document.getElementById("registroPgDetran").value = data.registro_pg_detran ?? '';
    document.getElementById("cobrancaTerceiro").value = data.cobranca_terceiro ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("veiculoId").focus();

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("veiculoId").value = '';
    document.getElementById("infracao").value = '';
    document.getElementById("valor").value = '';
    document.getElementById("dataInfracao").value = '';
    document.getElementById("dataLimiteDefesa").value = '';
    document.getElementById("dataEmail").value = '';
    document.getElementById("indicada").value = '';
    document.getElementById("registroPgDetran").value = '';
    document.getElementById("cobrancaTerceiro").value = '';
    document.getElementById("observacao").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('multas')
        .select('numero_auto, veiculos(placa)')
        .eq('id', id)
        .single();

    const infracao = data?.numero_auto || '(sem código)';
    const placa = data?.veiculos?.placa || '';

    if(!confirm(`Excluir a multa #${id} - ${infracao}${placa ? ' (veículo ' + placa + ')' : ''}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('multas')
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

    const veiculoId = document.getElementById("veiculoId").value;
    const infracao = document.getElementById("infracao").value.trim();
    const valor = document.getElementById("valor").value;
    const dataInfracao = document.getElementById("dataInfracao").value;
    const dataLimiteDefesa = document.getElementById("dataLimiteDefesa").value;
    const dataEmail = document.getElementById("dataEmail").value;
    const indicada = document.getElementById("indicada").value;
    const registroPgDetran = document.getElementById("registroPgDetran").value.trim();
    const cobrancaTerceiro = document.getElementById("cobrancaTerceiro").value.trim();
    const observacao = document.getElementById("observacao").value.trim();

    if(!veiculoId){
        alert('Selecione o veículo (placa).');
        return;
    }

    const dados = {
        veiculo_id: Number(veiculoId),
        numero_auto: infracao || null,
        valor: valor ? Number(valor) : null,
        data_infracao: dataInfracao || null,
        data_limite_defesa: dataLimiteDefesa || null,
        data_email: dataEmail || null,
        indicada: indicada || null,
        registro_pg_detran: registroPgDetran || null,
        cobranca_terceiro: cobrancaTerceiro || null,
        observacao: observacao || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('multas')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('multas')
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
