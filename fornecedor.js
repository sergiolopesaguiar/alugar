// Lógica da página Financeiro > Fornecedor.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'fornecedor';

let editandoId = null;

// Máscara de CNPJ (00.000.000/0000-00) enquanto digita - fornecedor é
// sempre pessoa jurídica, diferente de Clientes (que aceita CPF ou CNPJ).
function formatarCnpj(valor){
    let d = valor.replace(/\D/g, '').slice(0, 14);
    return d
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

// Mesma máscara de telefone usada em Clientes/Motorista/Manutenção.
function formatarTelefone(valor){
    let d = valor.replace(/\D/g, '').slice(0, 11);
    if(d.length > 10){
        return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
    }
    if(d.length > 6){
        return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
    }
    if(d.length > 2){
        return d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    if(d.length > 0){
        return d.replace(/(\d{0,2})/, '($1');
    }
    return '';
}

// Máscara 00000-000 enquanto digita.
function formatarCEP(valor){
    let d = valor.replace(/\D/g, '').slice(0, 8);
    if(d.length > 5){
        return d.replace(/(\d{5})(\d{0,3})/, '$1-$2');
    }
    return d;
}

// BrasilAPI (dados públicos da Receita Federal, gratuita, sem chave) - mesma API
// já usada em app.js (Clientes) para consultarCNPJ(). Aqui preenche só os campos
// que existem na tabela fornecedores: Nome, CEP, Cidade, Bairro e Telefone (se a
// Receita tiver um telefone cadastrado). Só roda com os 14 dígitos completos.
async function consultarCNPJFornecedor(){

    const campoCnpj = document.getElementById('cnpj');
    const digitos = campoCnpj.value.replace(/\D/g, '');

    if(digitos.length !== 14){
        return;
    }

    try{

        const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
        const dados = await resp.json();

        if(!resp.ok){
            alert(dados.message || 'CNPJ não encontrado.');
            return;
        }

        document.getElementById('nome').value = dados.nome_fantasia || dados.razao_social || '';
        document.getElementById('cep').value = formatarCEP(dados.cep ?? '');
        document.getElementById('cidade').value = dados.municipio ?? '';
        document.getElementById('bairro').value = dados.bairro ?? '';

        if(dados.ddd_telefone_1){
            document.getElementById('telefone').value = formatarTelefone(dados.ddd_telefone_1);
        }

    } catch(e){
        alert('Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.');
    }

}

// ViaCEP (público, gratuito, sem chave) - preenche só Cidade/Bairro aqui
// (fornecedor não tem campos de Logradouro/Número/UF no cadastro).
async function consultarCEP(){

    const campoCep = document.getElementById('cep');
    const cepLimpo = campoCep.value.replace(/\D/g, '');

    if(cepLimpo.length !== 8){
        return;
    }

    try{

        const resp = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const dados = await resp.json();

        if(dados.erro){
            alert('CEP não encontrado.');
            return;
        }

        document.getElementById('bairro').value = dados.bairro ?? '';
        document.getElementById('cidade').value = dados.localidade ?? '';

    } catch(e){
        alert('Não foi possível consultar o CEP agora. Preencha Cidade/Bairro manualmente.');
    }

}

async function carregar(){

    const {data, error} = await supabaseClient
        .from('fornecedores')
        .select('*')
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(f => {

        html += `
        <tr>
            <td>${f.id}</td>
            <td>${f.cnpj ?? ''}</td>
            <td>${f.nome}</td>
            <td>${f.cidade ?? ''}</td>
            <td>${f.bairro ?? ''}</td>
            <td>${f.contato ?? ''}</td>
            <td>${f.telefone ?? ''}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${f.id})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${f.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>
        </tr>
        `;

    });

    document.getElementById("lista").innerHTML = html;

}

async function editar(id){

    const {data, error} = await supabaseClient
        .from('fornecedores')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("cnpj").value = data.cnpj ?? '';
    document.getElementById("nome").value = data.nome ?? '';
    document.getElementById("cep").value = data.cep ?? '';
    document.getElementById("cidade").value = data.cidade ?? '';
    document.getElementById("bairro").value = data.bairro ?? '';
    document.getElementById("contato").value = data.contato ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    document.getElementById("cnpj").focus();

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("cnpj").value = '';
    document.getElementById("nome").value = '';
    document.getElementById("cep").value = '';
    document.getElementById("cidade").value = '';
    document.getElementById("bairro").value = '';
    document.getElementById("contato").value = '';
    document.getElementById("telefone").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('fornecedores')
        .select('nome')
        .eq('id', id)
        .single();

    const nome = data?.nome || '(sem nome)';

    if(!confirm(`Excluir o fornecedor "${nome}"? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('fornecedores')
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

    const cnpj = document.getElementById("cnpj").value.trim();
    const nome = document.getElementById("nome").value.trim();
    const cep = document.getElementById("cep").value.trim();
    const cidade = document.getElementById("cidade").value.trim();
    const bairro = document.getElementById("bairro").value.trim();
    const contato = document.getElementById("contato").value.trim();
    const telefone = document.getElementById("telefone").value.trim();

    if(!nome){
        alert('Preencha o nome.');
        return;
    }

    const dados = {
        cnpj: cnpj || null,
        nome,
        cep: cep || null,
        cidade: cidade || null,
        bairro: bairro || null,
        contato: contato || null,
        telefone: telefone || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('fornecedores')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('fornecedores')
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

document.addEventListener('DOMContentLoaded', () => {

    const campoCnpj = document.getElementById('cnpj');
    if(campoCnpj){
        campoCnpj.addEventListener('input', (e) => {
            e.target.value = formatarCnpj(e.target.value);
        });
        campoCnpj.addEventListener('blur', consultarCNPJFornecedor);
    }

    const campoTelefone = document.getElementById('telefone');
    if(campoTelefone){
        campoTelefone.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }

    const campoCep = document.getElementById('cep');
    if(campoCep){
        campoCep.addEventListener('input', (e) => {
            e.target.value = formatarCEP(e.target.value);
        });
        campoCep.addEventListener('blur', consultarCEP);
    }

});

checarLogin();
