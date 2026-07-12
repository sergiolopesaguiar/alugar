// Lógica específica da página de Veículos.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).

// Cadastro 100% manual por enquanto (fabricante/modelo/cor/ano digitados
// à mão). Avaliamos preencher automaticamente pela placa usando uma API
// de consulta veicular, mas nenhuma opção confiável e realmente gratuita
// foi encontrada - as gratuitas quebraram (Sinesp exige login gov.br
// desde que adicionou autenticação) e as pagas cobram por consulta e/ou
// exigem CNPJ. Ver memória do projeto para detalhes caso isso mude no
// futuro.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'veiculos';

let editandoId = null;

async function carregar(){

    const {data,error}=await supabaseClient

    .from('veiculos')

    .select('*')

    .order('id');

    if(error){

        alert(error.message);

        return;

    }

    let html='';

    data.forEach(v=>{

        html+=`

        <tr>

            <td>${v.id}</td>

            <td>${v.placa}</td>

            <td>${v.fabricante??''}</td>

            <td>${v.modelo??''}</td>

            <td>${v.cor??''}</td>

            <td>${v.ano??''}</td>

            <td>${v.status??''}</td>

            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editar(${v.id})">Editar</button>
                <button class="btn btn-sm btn-outline-danger" onclick="excluir(${v.id})">Excluir</button>
            </td>

        </tr>

        `;

    });

    document.getElementById("lista").innerHTML=html;

}

async function editar(id){

    const {data,error} = await supabaseClient
        .from('veiculos')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("placa").value = data.placa ?? '';
    document.getElementById("fabricante").value = data.fabricante ?? '';
    document.getElementById("modelo").value = data.modelo ?? '';
    document.getElementById("cor").value = data.cor ?? '';
    document.getElementById("ano").value = data.ano ?? '';
    document.getElementById("chassi").value = data.chassi ?? '';
    document.getElementById("renavam").value = data.renavam ?? '';
    document.getElementById("km_compra").value = data.km_compra ?? '';
    document.getElementById("valor_compra").value = data.valor_compra ?? '';
    document.getElementById("data_compra").value = data.data_compra ?? '';
    document.getElementById("origem_compra").value = data.origem_compra ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';
    document.getElementById("status").value = data.status ?? 'Ativo';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("placa").value='';
    document.getElementById("fabricante").value='';
    document.getElementById("modelo").value='';
    document.getElementById("cor").value='';
    document.getElementById("ano").value='';
    document.getElementById("chassi").value='';
    document.getElementById("renavam").value='';
    document.getElementById("km_compra").value='';
    document.getElementById("valor_compra").value='';
    document.getElementById("data_compra").value='';
    document.getElementById("origem_compra").value='';
    document.getElementById("observacao").value='';
    document.getElementById("status").value='Ativo';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('veiculos')
        .select('placa')
        .eq('id', id)
        .single();

    const placa = data?.placa || '(sem placa)';

    if(!confirm(`Excluir o veículo #${id} - ${placa}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('veiculos')
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

    const placa=document.getElementById("placa").value;

    const fabricante=document.getElementById("fabricante").value;

    const modelo=document.getElementById("modelo").value;

    const cor=document.getElementById("cor").value;

    const anoValor=document.getElementById("ano").value;

    const chassi=document.getElementById("chassi").value;
    const renavam=document.getElementById("renavam").value;
    const kmCompraValor=document.getElementById("km_compra").value;
    const valorCompraValor=document.getElementById("valor_compra").value;
    const dataCompra=document.getElementById("data_compra").value;
    const origemCompra=document.getElementById("origem_compra").value;
    const observacao=document.getElementById("observacao").value;
    const status=document.getElementById("status").value;

    if(!placa){
        alert('Preencha a placa.');
        return;
    }

    const dados = {

        placa,

        fabricante,

        modelo,

        cor,

        ano: anoValor ? Number(anoValor) : null,

        chassi: chassi || null,

        renavam: renavam || null,

        km_compra: kmCompraValor ? Number(kmCompraValor) : null,

        valor_compra: valorCompraValor ? Number(valorCompraValor) : null,

        data_compra: dataCompra || null,

        origem_compra: origemCompra || null,

        observacao: observacao || null,

        status: status || 'Ativo'

    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from("veiculos")
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from("veiculos")
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
