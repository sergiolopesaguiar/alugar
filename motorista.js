// Lógica da página Veículos > Motorista.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
// Tabela veiculos_motorista: veiculo_id (FK para veiculos.id), nome_motorista,
// telefone, cnh, vencimento_cnh, regiao_motorista, observacao (memo).

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'motorista';

let editandoId = null;

// Aplica máscara (00) 00000-0000 / (00) 0000-0000 enquanto o usuário digita.
// Mesma lógica usada em app.js (Clientes) - cada página tem seu próprio JS,
// então a função é duplicada aqui em vez de compartilhada.
function formatarTelefone(valor){

    let d = valor.replace(/\D/g,'').slice(0,11);

    if(d.length > 10){
        return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/,'');
    }
    if(d.length > 6){
        return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/,'');
    }
    if(d.length > 2){
        return d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    if(d.length > 0){
        return d.replace(/(\d{0,2})/, '($1');
    }
    return '';

}

// Preenche o <select> de veículos com todos os cadastrados em "veiculos",
// mostrando Placa - Fabricante Modelo para facilitar a escolha.
async function carregarVeiculos(){

    const {data,error} = await supabaseClient
        .from('veiculos')
        .select('id,placa,fabricante,modelo')
        .order('placa');

    if(error){
        alert(error.message);
        return;
    }

    const select = document.getElementById('veiculoId');
    const valorAtual = select.value;

    let html = '<option value="" selected disabled>Veículo</option>';

    data.forEach(v => {
        const rotulo = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        html += `<option value="${v.id}">${rotulo}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

function formatarDataBR(dataIso){
    if(!dataIso) return '';
    const [ano,mes,dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
}

async function carregar(){

    await carregarVeiculos();

    const {data,error} = await supabaseClient
        .from('veiculos_motorista')
        .select('*, veiculos(placa,fabricante,modelo)')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(m => {

        const veiculo = m.veiculos
            ? [m.veiculos.placa, [m.veiculos.fabricante, m.veiculos.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
            : '(veículo não encontrado)';

        const observacao = m.observacao ?? '';
        const observacaoResumida = observacao.length > 40 ? observacao.slice(0,40) + '…' : observacao;

        html += `

        <tr>

            <td>${m.id}</td>

            <td>${veiculo}</td>

            <td>${m.nome_motorista}</td>

            <td>${m.telefone ?? ''}</td>

            <td>${m.cnh ?? ''}</td>

            <td>${formatarDataBR(m.vencimento_cnh)}</td>

            <td>${m.regiao_motorista ?? ''}</td>

            <td title="${observacao.replace(/"/g,'&quot;')}">${observacaoResumida}</td>

            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editar(${m.id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluir(${m.id})">Excluir</button>
            </td>

        </tr>

        `;

    });

    document.getElementById("lista").innerHTML = html;

}

async function editar(id){

    const {data,error} = await supabaseClient
        .from('veiculos_motorista')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("veiculoId").value = data.veiculo_id;
    document.getElementById("nomeMotorista").value = data.nome_motorista ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';
    document.getElementById("cnh").value = data.cnh ?? '';
    document.getElementById("vencimentoCnh").value = data.vencimento_cnh ?? '';
    document.getElementById("regiaoMotorista").value = data.regiao_motorista ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("veiculoId").value = '';
    document.getElementById("nomeMotorista").value = '';
    document.getElementById("telefone").value = '';
    document.getElementById("cnh").value = '';
    document.getElementById("vencimentoCnh").value = '';
    document.getElementById("regiaoMotorista").value = '';
    document.getElementById("observacao").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('veiculos_motorista')
        .select('nome_motorista, veiculos(placa)')
        .eq('id', id)
        .single();

    const nome = data?.nome_motorista || '(sem nome)';
    const placa = data?.veiculos?.placa || '';

    if(!confirm(`Excluir o motorista #${id} - ${nome}${placa ? ' (veículo ' + placa + ')' : ''}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('veiculos_motorista')
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
    const nomeMotorista = document.getElementById("nomeMotorista").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const cnh = document.getElementById("cnh").value.trim();
    const vencimentoCnh = document.getElementById("vencimentoCnh").value;
    const regiaoMotorista = document.getElementById("regiaoMotorista").value.trim();
    const observacao = document.getElementById("observacao").value.trim();

    if(!veiculoId){
        alert('Selecione o veículo.');
        return;
    }

    if(!nomeMotorista){
        alert('Preencha o nome do motorista.');
        return;
    }

    const dados = {
        veiculo_id: Number(veiculoId),
        nome_motorista: nomeMotorista,
        telefone: telefone || null,
        cnh: cnh || null,
        vencimento_cnh: vencimentoCnh || null,
        regiao_motorista: regiaoMotorista || null,
        observacao: observacao || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from("veiculos_motorista")
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from("veiculos_motorista")
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

// Máscara de telefone em tempo real.
document.addEventListener('DOMContentLoaded', () => {

    const campoTelefone = document.getElementById('telefone');
    if(campoTelefone){
        campoTelefone.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }

});

checarLogin();
