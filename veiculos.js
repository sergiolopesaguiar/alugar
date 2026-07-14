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

// Comprador/Data da venda só fazem sentido para um veículo Vendido - o
// bloco fica escondido por padrão e só aparece quando o Status selecionado
// é "Vendido". Ao sair de "Vendido" para "Ativo", limpa os dois campos para
// não deixar um comprador/data órfãos salvos junto de um veículo ativo.
function alternarCamposVenda(){

    const status = document.getElementById('status').value;
    const bloco = document.getElementById('camposVenda');

    if(status === 'Vendido'){
        bloco.classList.remove('d-none');
    } else {
        bloco.classList.add('d-none');
        document.getElementById('comprador').value = '';
        document.getElementById('data_venda').value = '';
    }

}

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
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${v.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${v.id})"><i class="bi bi-trash"></i></button>
                </div>
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
    document.getElementById("cod_fipe").value = data.cod_fipe ?? '';
    document.getElementById("km_compra").value = data.km_compra ?? '';
    document.getElementById("valor_compra").value = data.valor_compra ?? '';
    document.getElementById("data_compra").value = data.data_compra ?? '';
    document.getElementById("origem_compra").value = data.origem_compra ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';
    document.getElementById("comprador").value = data.comprador ?? '';
    document.getElementById("data_venda").value = data.data_venda ?? '';
    document.getElementById("status").value = data.status ?? 'Ativo';

    alternarCamposVenda();

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("placa").focus();

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
    document.getElementById("cod_fipe").value='';
    document.getElementById("km_compra").value='';
    document.getElementById("valor_compra").value='';
    document.getElementById("data_compra").value='';
    document.getElementById("origem_compra").value='';
    document.getElementById("observacao").value='';
    document.getElementById("comprador").value='';
    document.getElementById("data_venda").value='';
    document.getElementById("status").value='Ativo';

    alternarCamposVenda();

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
    const codFipe=document.getElementById("cod_fipe").value;
    const kmCompraValor=document.getElementById("km_compra").value;
    const valorCompraValor=document.getElementById("valor_compra").value;
    const dataCompra=document.getElementById("data_compra").value;
    const origemCompra=document.getElementById("origem_compra").value;
    const observacao=document.getElementById("observacao").value;
    const comprador=document.getElementById("comprador").value;
    const dataVenda=document.getElementById("data_venda").value;
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

        cod_fipe: codFipe || null,

        km_compra: kmCompraValor ? Number(kmCompraValor) : null,

        valor_compra: valorCompraValor ? Number(valorCompraValor) : null,

        data_compra: dataCompra || null,

        origem_compra: origemCompra || null,

        observacao: observacao || null,

        // Comprador/data da venda só ficam preenchidos quando Status =
        // Vendido (o bloco correspondente fica escondido e é limpo pelo
        // próprio alternarCamposVenda() quando o status muda para Ativo).
        comprador: status === 'Vendido' ? (comprador || null) : null,

        data_venda: status === 'Vendido' ? (dataVenda || null) : null,

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
