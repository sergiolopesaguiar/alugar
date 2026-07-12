// Lógica da página Veículos > Manutenção.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
// Tabela manutencao: veiculo_id (FK para veiculos.id), oficina, telefone, email, responsavel.

let editandoId = null;

// Aplica máscara (00) 00000-0000 / (00) 0000-0000 enquanto o usuário digita.
// Mesma lógica usada em app.js (Clientes) e motorista.js - cada página tem
// seu próprio JS, então a função é duplicada aqui.
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

// Mesma validação leve usada em app.js: aceita vazio, senão exige formato básico de email.
function emailValido(email){
    if(!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

async function carregar(){

    await carregarVeiculos();

    const {data,error} = await supabaseClient
        .from('manutencao')
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

        html += `

        <tr>

            <td>${m.id}</td>

            <td>${veiculo}</td>

            <td>${m.oficina ?? ''}</td>

            <td>${m.telefone ?? ''}</td>

            <td>${m.email ?? ''}</td>

            <td>${m.responsavel ?? ''}</td>

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
        .from('manutencao')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("veiculoId").value = data.veiculo_id;
    document.getElementById("oficina").value = data.oficina ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';
    document.getElementById("email").value = data.email ?? '';
    document.getElementById("responsavel").value = data.responsavel ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("veiculoId").value = '';
    document.getElementById("oficina").value = '';
    document.getElementById("telefone").value = '';
    document.getElementById("email").value = '';
    document.getElementById("responsavel").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('manutencao')
        .select('oficina, veiculos(placa)')
        .eq('id', id)
        .single();

    const oficina = data?.oficina || '(sem oficina)';
    const placa = data?.veiculos?.placa || '';

    if(!confirm(`Excluir o registro de manutenção #${id} - ${oficina}${placa ? ' (veículo ' + placa + ')' : ''}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('manutencao')
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
    const oficina = document.getElementById("oficina").value.trim();
    const telefone = document.getElementById("telefone").value.trim();
    const email = document.getElementById("email").value.trim();
    const responsavel = document.getElementById("responsavel").value.trim();

    if(!veiculoId){
        alert('Selecione o veículo.');
        return;
    }

    if(!emailValido(email)){
        alert('Email inválido.');
        return;
    }

    const dados = {
        veiculo_id: Number(veiculoId),
        oficina: oficina || null,
        telefone: telefone || null,
        email: email || null,
        responsavel: responsavel || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from("manutencao")
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from("manutencao")
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
