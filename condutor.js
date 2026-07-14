// Lógica da página de Condutor.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).
//
// Condutor tem um período (data_inicio/data_fim) e agora é
// SEMPRE amarrado a um veículo (veiculo_id) - exigido na validação do
// formulário. A coluna em si ficou nullable no banco porque já existiam
// ~39 condutores cadastrados sem veículo antes desta mudança; forçar
// NOT NULL quebraria esses registros. Editar qualquer condutor antigo
// agora exige escolher um veículo antes de salvar de novo.

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'condutor';

let editandoId = null;
let condutorDocumentosAtual = null; // id do condutor com o modal de documentos aberto

// Únicos tipos de documento aceitos hoje (mesma lista das <option> do select
// #docTipo em condutor.html). Usada para saber quais documentos "contam"
// no controle de pendências da grid principal - documentos com um tipo
// fora desta lista (ex: registros antigos digitados livremente antes desta
// mudança) continuam existindo e aparecem no modal, mas não zeram a
// pendência de CNH/Termo se o tipo não bater exatamente. Para expandir os
// tipos aceitos no futuro, adicionar aqui E nas <option> do HTML.
const TIPOS_DOCUMENTO_OBRIGATORIOS = ['CNH', 'Termo de Responsabilidade'];

// Aplica máscara (00) 00000-0000 / (00) 0000-0000 enquanto o usuário digita.
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

// Preenche o <select> de veículos, mostrando Placa - Fabricante Modelo.
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

    let html = '<option value="" selected disabled>Selecione o veículo...</option>';

    (data || []).forEach(v => {
        const rotulo = [v.placa, [v.fabricante, v.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ');
        html += `<option value="${v.id}">${rotulo}</option>`;
    });

    select.innerHTML = html;

    if(valorAtual){
        select.value = valorAtual;
    }

}

// Busca todos os documentos de todos os condutores numa única query (em vez
// de uma query por linha da grid) e devolve um Map condutor_id -> Set dos
// tipos de documento presentes, já restrito a TIPOS_DOCUMENTO_OBRIGATORIOS.
async function carregarMapaDocumentos(){

    const {data, error} = await supabaseClient
        .from('condutor_documentos')
        .select('condutor_id, tipo_documento');

    const mapa = new Map();

    if(error || !data){
        return mapa;
    }

    data.forEach(doc => {
        if(!TIPOS_DOCUMENTO_OBRIGATORIOS.includes(doc.tipo_documento)){
            return;
        }
        if(!mapa.has(doc.condutor_id)){
            mapa.set(doc.condutor_id, new Set());
        }
        mapa.get(doc.condutor_id).add(doc.tipo_documento);
    });

    return mapa;

}

// Monta os badges de controle (verde = enviado, vermelho = pendente) para
// os tipos obrigatórios de um condutor específico.
function montarBadgesDocumentos(tiposPresentes){

    return TIPOS_DOCUMENTO_OBRIGATORIOS.map(tipo => {
        const enviado = tiposPresentes && tiposPresentes.has(tipo);
        const cor = enviado ? 'bg-success' : 'bg-danger';
        const icone = enviado ? 'bi-check-lg' : 'bi-x-lg';
        return `<span class="badge ${cor} me-1" title="${tipo}${enviado ? ' - enviado' : ' - pendente'}"><i class="bi ${icone}"></i> ${tipo}</span>`;
    }).join('');

}

async function carregar(){

    await carregarVeiculos();

    const [{data, error}, mapaDocumentos] = await Promise.all([
        supabaseClient
            .from('condutores')
            .select('*, veiculos(placa, fabricante, modelo)')
            .order('id'),
        carregarMapaDocumentos()
    ]);

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    data.forEach(c => {

        const inicio = c.data_inicio ? new Date(c.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const fim = c.data_fim ? new Date(c.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const veiculo = c.veiculos
            ? [c.veiculos.placa, [c.veiculos.fabricante, c.veiculos.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
            : '<span class="text-danger">(sem veículo)</span>';
        const badgesDocumentos = montarBadgesDocumentos(mapaDocumentos.get(c.id));

        html += `
        <tr>
            <td>${c.id}</td>
            <td>${c.nome}</td>
            <td>${veiculo}</td>
            <td>${c.telefone ?? ''}</td>
            <td>${c.regiao ?? ''}</td>
            <td>${inicio}</td>
            <td>${fim}</td>
            <td>${c.observacao ?? ''}</td>
            <td>${badgesDocumentos}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-secondary" title="Documentos" onclick="abrirDocumentos(${c.id}, '${c.nome.replace(/'/g, "\\'")}')"><i class="bi bi-folder2-open"></i></button>
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
        .from('condutores')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    editandoId = id;

    document.getElementById("nome").value = data.nome ?? '';
    document.getElementById("veiculoId").value = data.veiculo_id ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';
    document.getElementById("regiao").value = data.regiao ?? '';
    document.getElementById("data_inicio").value = data.data_inicio ?? '';
    document.getElementById("data_fim").value = data.data_fim ?? '';
    document.getElementById("observacao").value = data.observacao ?? '';

    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

}

function cancelarEdicao(){

    editandoId = null;

    document.getElementById("nome").value = '';
    document.getElementById("veiculoId").value = '';
    document.getElementById("telefone").value = '';
    document.getElementById("regiao").value = '';
    document.getElementById("data_inicio").value = '';
    document.getElementById("data_fim").value = '';
    document.getElementById("observacao").value = '';

    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');

}

async function excluir(id){

    const {data} = await supabaseClient
        .from('condutores')
        .select('nome')
        .eq('id', id)
        .single();

    const nome = data?.nome || '(sem nome)';

    if(!confirm(`Excluir o condutor "${nome}"? Essa ação não pode ser desfeita. Os documentos anexados também serão apagados.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('condutores')
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

    const nome = document.getElementById("nome").value.trim();
    const veiculoId = document.getElementById("veiculoId").value;
    const telefone = document.getElementById("telefone").value;
    const regiao = document.getElementById("regiao").value.trim();
    const dataInicio = document.getElementById("data_inicio").value;
    const dataFim = document.getElementById("data_fim").value;
    const observacao = document.getElementById("observacao").value;

    if(!nome){
        alert('Preencha o nome.');
        return;
    }

    // Regra pedida pelo Sérgio: condutor sempre amarrado a um veículo.
    if(!veiculoId){
        alert('Selecione o veículo. Todo condutor precisa estar vinculado a um veículo.');
        return;
    }

    const dados = {
        nome,
        veiculo_id: Number(veiculoId),
        telefone: telefone || null,
        regiao: regiao || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        observacao: observacao || null
    };

    let error;

    if(editandoId){

        ({error} = await supabaseClient
            .from('condutores')
            .update(dados)
            .eq('id', editandoId));

    } else {

        ({error} = await supabaseClient
            .from('condutores')
            .insert(dados));

    }

    if(error){
        alert(error.message);
        return;
    }

    cancelarEdicao();

    carregar();

}

// ---------------------------------------------------------------------
// Documentos do condutor (modal). A partir de 2026-07-13, novos arquivos
// vão para a pasta "condutor-documentos/" do repositório GitHub "alugar"
// (não mais para o Supabase Storage) - pedido do Sérgio para economizar
// espaço no Supabase. O upload/exclusão passa pela Edge Function
// "github-documento", que guarda um GITHUB_TOKEN como secret do lado do
// servidor (nunca no código do site) e fala com a API do GitHub.
// Registros antigos (enviados antes desta mudança) continuam apontando
// para o bucket "condutor-documentos" do Supabase Storage - por isso
// carregarDocumentos() e excluirDocumento() tratam os dois casos,
// diferenciando pela presença da coluna arquivo_url (só preenchida para
// arquivos hospedados no GitHub).
// Metadados (tipo, nome, caminho/URL) ficam na tabela condutor_documentos.
// ---------------------------------------------------------------------

// Converte um File em base64 puro (sem o prefixo "data:...;base64,"),
// formato que a API de Contents do GitHub espera no campo "content".
function arquivoParaBase64(arquivo){
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result.split(',')[1]);
        leitor.onerror = reject;
        leitor.readAsDataURL(arquivo);
    });
}

async function abrirDocumentos(condutorId, nomeCondutor){

    condutorDocumentosAtual = condutorId;

    document.getElementById('modalDocumentosTitulo').textContent = `Documentos - ${nomeCondutor}`;
    document.getElementById('docTipo').value = '';
    document.getElementById('docArquivo').value = '';

    await carregarDocumentos();

    new bootstrap.Modal(document.getElementById('modalDocumentos')).show();

}

async function carregarDocumentos(){

    if(!condutorDocumentosAtual){
        return;
    }

    const {data, error} = await supabaseClient
        .from('condutor_documentos')
        .select('*')
        .eq('condutor_id', condutorDocumentosAtual)
        .order('id');

    if(error){
        alert(error.message);
        return;
    }

    let html = '';

    if(!data || data.length === 0){
        html = '<tr><td colspan="4" class="text-muted">Nenhum documento anexado ainda.</td></tr>';
    }

    (data || []).forEach(doc => {

        // arquivo_url só existe para documentos novos (hospedados no
        // GitHub) - registros antigos (Supabase Storage) reconstroem a URL
        // pública a partir do bucket, como sempre foi feito.
        const url = doc.arquivo_url || supabaseClient.storage
            .from('condutor-documentos')
            .getPublicUrl(doc.arquivo_path).data.publicUrl;

        const enviadoEm = doc.criado_em ? new Date(doc.criado_em).toLocaleString('pt-BR') : '';
        const urlParaOnclick = doc.arquivo_url ? `'${doc.arquivo_url}'` : 'null';

        html += `
        <tr>
            <td>${doc.tipo_documento ?? '(sem tipo)'}</td>
            <td><a href="${url}" target="_blank" rel="noopener">${doc.arquivo_nome ?? 'Abrir'}</a></td>
            <td>${enviadoEm}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="excluirDocumento(${doc.id}, '${doc.arquivo_path}', ${urlParaOnclick})"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
        `;

    });

    document.getElementById('listaDocumentos').innerHTML = html;

}

async function enviarDocumento(){

    const tipo = document.getElementById('docTipo').value;
    const campoArquivo = document.getElementById('docArquivo');
    const arquivo = campoArquivo.files[0];

    if(!tipo){
        alert('Selecione o tipo do documento.');
        return;
    }

    if(!arquivo){
        alert('Selecione um arquivo.');
        return;
    }

    if(!condutorDocumentosAtual){
        return;
    }

    const caminho = `condutor-documentos/${condutorDocumentosAtual}/${Date.now()}_${arquivo.name}`;

    let contentBase64;
    try {
        contentBase64 = await arquivoParaBase64(arquivo);
    } catch(e){
        alert('Erro ao ler o arquivo: ' + e.message);
        return;
    }

    const {data: dadosGithub, error: erroUpload} = await supabaseClient.functions.invoke('github-documento', {
        body: {
            action: 'upload',
            path: caminho,
            contentBase64,
            mensagem: `Documento (${tipo}) - condutor #${condutorDocumentosAtual}`
        }
    });

    if(erroUpload){
        alert('Erro ao enviar o arquivo para o GitHub: ' + erroUpload.message);
        return;
    }

    const {error: erroInsert} = await supabaseClient
        .from('condutor_documentos')
        .insert({
            condutor_id: condutorDocumentosAtual,
            tipo_documento: tipo,
            arquivo_nome: arquivo.name,
            arquivo_path: caminho,
            arquivo_url: dadosGithub.url
        });

    if(erroInsert){
        alert('Arquivo enviado, mas houve erro ao registrar: ' + erroInsert.message);
    }

    document.getElementById('docTipo').value = '';
    campoArquivo.value = '';

    // Atualiza a lista dentro do modal E a grid principal por trás dele,
    // já que a coluna "Documentos" da grid depende do que acabou de mudar.
    carregarDocumentos();
    carregar();

}

async function excluirDocumento(id, caminho, url){

    if(!confirm('Excluir este documento? Essa ação não pode ser desfeita.')){
        return;
    }

    if(url){

        // Documento novo, hospedado no GitHub - exclui via Edge Function.
        const {error: erroGithub} = await supabaseClient.functions.invoke('github-documento', {
            body: {
                action: 'delete',
                path: caminho,
                mensagem: `Excluir documento (registro #${id})`
            }
        });

        if(erroGithub){
            alert('Erro ao excluir o arquivo no GitHub: ' + erroGithub.message);
            return;
        }

    } else {

        // Documento antigo, ainda no Supabase Storage.
        const {error: erroStorage} = await supabaseClient.storage
            .from('condutor-documentos')
            .remove([caminho]);

        if(erroStorage){
            alert('Erro ao excluir o arquivo: ' + erroStorage.message);
            return;
        }

    }

    const {error: erroDelete} = await supabaseClient
        .from('condutor_documentos')
        .delete()
        .eq('id', id);

    if(erroDelete){
        alert(erroDelete.message);
        return;
    }

    carregarDocumentos();
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
