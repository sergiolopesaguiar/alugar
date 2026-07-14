// Lógica específica da página de Clientes.
// Login, logout e supabaseClient ficam em auth.js (compartilhado).

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'clientes';

let editandoId = null; // null = modo "novo cadastro"; com valor = editando esse id
let dadosReceita = null; // guarda a resposta completa da BrasilAPI para o CNPJ em edição
let clientesCache = []; // última lista carregada, usada pelo modal de detalhes da Receita

// Nome de todas as colunas do cadastro que vieram da consulta de CNPJ (BrasilAPI),
// sem prefixo - usada para reconstruir dadosReceita ao editar um cliente já salvo.
const COLUNAS_RECEITA = [
    'pais','email_receita','porte','ddd_fax','cnae_fiscal','codigo_pais','complemento',
    'codigo_porte','razao_social','nome_fantasia','capital_social','ddd_telefone_1',
    'ddd_telefone_2','opcao_pelo_mei','codigo_municipio','cnaes_secundarios',
    'natureza_juridica','regime_tributario','situacao_especial','opcao_pelo_simples',
    'situacao_cadastral','data_opcao_pelo_mei','data_exclusao_do_mei','cnae_fiscal_descricao',
    'codigo_municipio_ibge','data_inicio_atividade','data_situacao_especial',
    'data_opcao_pelo_simples','data_situacao_cadastral','nome_cidade_no_exterior',
    'codigo_natureza_juridica','data_exclusao_do_simples','motivo_situacao_cadastral',
    'ente_federativo_responsavel','identificador_matriz_filial','qualificacao_do_responsavel',
    'descricao_situacao_cadastral','descricao_tipo_de_logradouro',
    'descricao_motivo_situacao_cadastral','descricao_identificador_matriz_filial','qsa'
];

async function carregar(){

    const {data,error}=await supabaseClient

    .from('clientes')

    .select('*')

    .order('id');

    if(error){

        alert(error.message);

        return;

    }

    clientesCache = data;

    let html='';

    data.forEach(c=>{

        // Botão "Receita" só aparece para CNPJ (14 dígitos) - é o único caso em que
        // existe dado da Receita Federal para mostrar; CPF nunca tem esse dado.
        const ehCnpj = (c.cpf_cnpj ?? '').replace(/\D/g,'').length === 14;
        const botaoReceita = ehCnpj
            ? `<button class="btn btn-sm btn-outline-secondary" title="Receita" onclick="verDetalhesReceita(${c.id})"><i class="bi bi-file-earmark-text"></i></button>`
            : '';

        html+=`

        <tr>

            <td>${c.id}</td>

            <td>${c.nome}</td>

            <td>${c.cpf_cnpj??''}</td>

            <td>${c.email??''}</td>

            <td>${c.telefone??''}</td>

            <td>${c.cep??''}</td>

            <td>${c.logradouro??''}</td>

            <td>${c.numero_endereco??''}</td>

            <td>${c.bairro??''}</td>

            <td>${c.uf??''}</td>

            <td>${c.cidade??''}</td>

            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline-primary" title="Editar" onclick="editar(${c.id})"><i class="bi bi-pencil-square"></i></button>
                    ${botaoReceita}
                    <button class="btn btn-sm btn-outline-danger" title="Excluir" onclick="excluir(${c.id})"><i class="bi bi-trash"></i></button>
                </div>
            </td>

        </tr>

        `;

    });

    document.getElementById("lista").innerHTML=html;

}

// Mostra, num modal somente-leitura, todos os campos da Receita Federal
// gravados para este cliente (preenchidos automaticamente na consulta do CNPJ).
function verDetalhesReceita(id){

    const c = clientesCache.find(x => x.id === id);

    if(!c || !c.razao_social){
        alert('Nenhum dado da Receita associado a este cliente (o CNPJ ainda não foi consultado).');
        return;
    }

    // Endereço já aparece nos campos principais (Logradouro/Número/Bairro/UF/Cidade/CEP)
    // do próprio cadastro - não repetido aqui.
    const linhas = [
        ['Razão social', c.razao_social],
        ['Nome fantasia', c.nome_fantasia],
        ['Matriz/Filial', c.descricao_identificador_matriz_filial],
        ['Situação cadastral', [c.descricao_situacao_cadastral, c.data_situacao_cadastral].filter(Boolean).join(' - ')],
        ['Motivo situação cadastral', c.descricao_motivo_situacao_cadastral],
        ['Situação especial', [c.situacao_especial, c.data_situacao_especial].filter(Boolean).join(' - ')],
        ['Natureza jurídica', c.natureza_juridica],
        ['Porte', c.porte],
        ['Capital social', formatarMoeda(c.capital_social)],
        ['Data de início de atividade', c.data_inicio_atividade],
        ['CNAE fiscal (principal)', [c.cnae_fiscal_descricao, c.cnae_fiscal].filter(Boolean).join(' - ')],
        ['Optante pelo MEI', formatarSimNao(c.opcao_pelo_mei)],
        ['Data opção MEI', c.data_opcao_pelo_mei],
        ['Data exclusão MEI', c.data_exclusao_do_mei],
        ['Optante pelo Simples', formatarSimNao(c.opcao_pelo_simples)],
        ['Data opção Simples', c.data_opcao_pelo_simples],
        ['Data exclusão Simples', c.data_exclusao_do_simples],
        ['Telefone(s) Receita', [c.ddd_telefone_1, c.ddd_telefone_2].filter(Boolean).map(formatarTelefone).join(' / ')],
        ['Fax', c.ddd_fax],
        ['Email Receita', c.email_receita, true],
        ['País', c.pais],
        ['Cidade no exterior', c.nome_cidade_no_exterior],
        ['Ente federativo responsável', c.ente_federativo_responsavel],
        ['Qualificação do responsável', c.qualificacao_do_responsavel],
        ['Código natureza jurídica', c.codigo_natureza_juridica],
        ['Código município IBGE', c.codigo_municipio_ibge],
    ];

    let html = '<table class="table table-sm">';

    linhas.forEach(([campo, valor, sempreExibir]) => {
        const vazio = valor === null || valor === undefined || valor === '' || valor === ' - ';
        if(vazio && !sempreExibir){
            return;
        }
        html += `<tr><th style="width:220px">${campo}</th><td>${vazio ? '<span class="text-muted">(não informado)</span>' : valor}</td></tr>`;
    });

    html += '</table>';

    if(Array.isArray(c.qsa) && c.qsa.length){
        html += '<h6 class="mt-3">Sócios (QSA)</h6><ul>';
        c.qsa.forEach(s => {
            html += `<li>${s.nome_socio ?? ''} - ${s.qualificacao_socio ?? ''}</li>`;
        });
        html += '</ul>';
    }

    if(Array.isArray(c.cnaes_secundarios) && c.cnaes_secundarios.length){
        html += '<h6 class="mt-3">Atividades secundárias (CNAE)</h6><ul>';
        c.cnaes_secundarios.forEach(cn => {
            html += `<li>${cn.descricao ?? ''} (${cn.codigo ?? ''})</li>`;
        });
        html += '</ul>';
    }

    if(Array.isArray(c.regime_tributario) && c.regime_tributario.length){
        html += '<h6 class="mt-3">Regime tributário</h6><ul>';
        c.regime_tributario.forEach(rt => {
            html += `<li>${rt.ano ?? ''}: ${rt.forma_de_tributacao ?? JSON.stringify(rt)}</li>`;
        });
        html += '</ul>';
    }

    document.getElementById('modalReceitaCorpo').innerHTML = html;
    new bootstrap.Modal(document.getElementById('modalReceita')).show();

}

// Formata um número (ex: 70000000) como valor monetário BR (ex: 70.000.000,00),
// sem o "R$" na frente - usado só para exibição no modal, não altera o dado salvo.
function formatarMoeda(valor){
    if(valor === null || valor === undefined || valor === ''){
        return valor;
    }
    const numero = Number(valor);
    if(isNaN(numero)){
        return valor;
    }
    return numero.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function formatarSimNao(valor){
    if(valor === true || valor === 'true') return 'Sim';
    if(valor === false || valor === 'false') return 'Não';
    return valor ?? '';
}

// Campos da resposta da BrasilAPI que NÃO viram coluna própria porque já são
// cobertos pelos campos operacionais do cadastro (preenchidos por consultarCNPJ()
// diretamente nos inputs de endereço) - evita duplicar a mesma informação.
const CAMPOS_RECEITA_IGNORADOS = ['uf','cep','cnpj','bairro','numero','municipio','logradouro'];

// Converte a resposta da BrasilAPI (chaves em português, snake_case) para o
// formato das colunas no banco. A maioria mantém o mesmo nome; "email" vira
// "email_receita" para não sobrescrever o campo de contato do próprio cadastro.
function mapearDadosReceita(dados){
    const resultado = {};
    for(const chave in dados){
        if(CAMPOS_RECEITA_IGNORADOS.includes(chave)){
            continue;
        }
        const coluna = chave === 'email' ? 'email_receita' : chave;
        resultado[coluna] = dados[chave];
    }
    return resultado;
}

// Aplica máscara (00) 00000-0000 / (00) 0000-0000 enquanto o usuário digita.
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

// Aplica máscara 00000-000 enquanto o usuário digita.
function formatarCEP(valor){

    let d = valor.replace(/\D/g,'').slice(0,8);

    if(d.length > 5){
        return d.replace(/(\d{5})(\d{0,3})/, '$1-$2');
    }
    return d;

}

// Consulta o ViaCEP (API pública, gratuita, sem chave) e preenche Logradouro/Bairro/UF/Cidade.
async function consultarCEP(){

    const campoCep = document.getElementById('cep');
    const cepLimpo = campoCep.value.replace(/\D/g,'');

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

        document.getElementById('logradouro').value = dados.logradouro ?? '';
        document.getElementById('bairro').value = dados.bairro ?? '';
        document.getElementById('uf').value = dados.uf ?? '';
        document.getElementById('cidade').value = dados.localidade ?? '';

    } catch(e){
        alert('Não foi possível consultar o CEP agora. Preencha Logradouro/Bairro/UF/Cidade manualmente.');
    }

}

// Detecta CPF (11 dígitos) ou CNPJ (12+ dígitos) e aplica a máscara correspondente
// enquanto o usuário digita: 000.000.000-00 ou 00.000.000/0000-00.
function formatarCpfCnpj(valor){

    let d = valor.replace(/\D/g,'').slice(0,14);

    if(d.length <= 11){
        // CPF
        return d
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }

    // CNPJ
    return d
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');

}

// Validação leve: só aceita vazio, ou exatamente 11 dígitos (CPF) ou 14 dígitos (CNPJ).
function cpfCnpjValido(valor){
    const d = valor.replace(/\D/g,'');
    return d.length === 0 || d.length === 11 || d.length === 14;
}

// Tabela III - Qualificação (Receita Federal, Anexo V da IN RFB 1.863/2018) - usada
// para traduzir o código numérico de qualificacao_do_responsavel em texto legível.
// Fonte: https://www38.receita.fazenda.gov.br/cadsincnac/jsp/coleta/ajuda/topicos/Tabela_III_-_Qualificacao.htm
const QUALIFICACAO_RESPONSAVEL = {
    '05':'Administrador','08':'Conselheiro de Administração','09':'Curador','10':'Diretor',
    '11':'Interventor','12':'Inventariante','13':'Liquidante','14':'Mãe','15':'Pai',
    '16':'Presidente','17':'Procurador','19':'Síndico (Condomínio)','20':'Sociedade Consorciada',
    '21':'Sociedade Filiada','22':'Sócio','23':'Sócio Capitalista','24':'Sócio Comanditado',
    '25':'Sócio Comanditário','26':'Sócio de Indústria','28':'Sócio-Gerente',
    '29':'Sócio ou Acionista Incapaz ou Relativamente Incapaz (exceto menor)',
    '30':'Sócio ou Acionista Menor (Assistido/Representado)','31':'Sócio Ostensivo','32':'Tabelião',
    '34':'Titular de Empresa Individual Imobiliária','35':'Tutor',
    '37':'Sócio Pessoa Jurídica Domiciliado no Exterior',
    '38':'Sócio Pessoa Física Residente ou Domiciliado no Exterior','39':'Diplomata','40':'Cônsul',
    '41':'Representante de Organização Internacional','42':'Oficial de Registro','43':'Responsável',
    '46':'Ministro de Estado das Relações Exteriores','47':'Sócio Pessoa Física Residente no Brasil',
    '48':'Sócio Pessoa Jurídica Domiciliado no Brasil','49':'Sócio-Administrador','50':'Empresário',
    '51':'Candidato a Cargo Político Eletivo','52':'Sócio com Capital','53':'Sócio sem Capital',
    '54':'Fundador','55':'Sócio Comanditado Residente no Exterior',
    '56':'Sócio Comanditário Pessoa Física Residente no Exterior',
    '57':'Sócio Comanditário Pessoa Jurídica Domiciliado no Exterior','58':'Sócio Comanditário Incapaz',
    '59':'Produtor Rural','60':'Cônsul Honorário','61':'Responsável Indígena',
    '62':'Representante das Instituições Extraterritoriais','63':'Cotas em Tesouraria',
    '64':'Administrador Judicial','65':'Titular Pessoa Física Residente ou Domiciliado no Brasil',
    '66':'Titular Pessoa Física Residente ou Domiciliado no Exterior',
    '67':'Titular Pessoa Física Incapaz ou Relativamente Incapaz (exceto menor)',
    '68':'Titular Pessoa Física Menor (Assistido/Representado)',
    '70':'Administrador Residente ou Domiciliado no Exterior',
    '71':'Conselheiro de Administração Residente ou Domiciliado no Exterior',
    '72':'Diretor Residente ou Domiciliado no Exterior','73':'Presidente Residente ou Domiciliado no Exterior',
    '74':'Sócio-Administrador Residente ou Domiciliado no Exterior',
    '75':'Fundador Residente ou Domiciliado no Exterior','78':'Titular Pessoa Jurídica Domiciliada no Brasil',
    '79':'Titular Pessoa Jurídica Domiciliada no Exterior'
};

// Tabela de Natureza Jurídica (Receita Federal/DREI) - usada para traduzir o
// código numérico de codigo_natureza_juridica em texto legível.
// Fonte: https://www38.receita.fazenda.gov.br/cadsincnac/jsp/coleta/ajuda/topicos/Tabela_II_-_Natureza_Juridica_e_Qualificacao_do_Responsavel.htm
const NATUREZA_JURIDICA = {
    '1015':'Órgão Público do Poder Executivo Federal',
    '1023':'Órgão Público do Poder Executivo Estadual ou do Distrito Federal',
    '1031':'Órgão Público do Poder Executivo Municipal',
    '1040':'Órgão Público do Poder Legislativo Federal',
    '1058':'Órgão Público do Poder Legislativo Estadual ou do Distrito Federal',
    '1066':'Órgão Público do Poder Legislativo Municipal',
    '1074':'Órgão Público do Poder Judiciário Federal',
    '1082':'Órgão Público do Poder Judiciário Estadual',
    '1104':'Autarquia Federal',
    '1112':'Autarquia Estadual ou do Distrito Federal',
    '1120':'Autarquia Municipal',
    '1139':'Fundação Pública de Direito Público Federal',
    '1147':'Fundação Pública de Direito Público Estadual ou do Distrito Federal',
    '1155':'Fundação Pública de Direito Público Municipal',
    '1163':'Órgão Público Autônomo Federal',
    '1171':'Órgão Público Autônomo Estadual ou do Distrito Federal',
    '1180':'Órgão Público Autônomo Municipal',
    '1198':'Comissão Polinacional',
    '1201':'Fundo Público',
    '1210':'Consórcio Público de Direito Público (Associação Pública)',
    '1228':'Consórcio Público de Direito Privado',
    '1236':'Estado ou Distrito Federal',
    '1244':'Município',
    '1252':'Fundação Pública de Direito Privado Federal',
    '1260':'Fundação Pública de Direito Privado Estadual ou do Distrito Federal',
    '1279':'Fundação Pública de Direito Privado Municipal',
    '1287':'Fundo Público da Administração Indireta Federal',
    '1295':'Fundo Público da Administração Indireta Estadual ou do Distrito Federal',
    '1309':'Fundo Público da Administração Indireta Municipal',
    '1317':'Fundo Público da Administração Direta Federal',
    '1325':'Fundo Público da Administração Direta Estadual ou do Distrito Federal',
    '1333':'Fundo Público da Administração Direta Municipal',
    '2011':'Empresa Pública',
    '2038':'Sociedade de Economia Mista',
    '2046':'Sociedade Anônima Aberta',
    '2054':'Sociedade Anônima Fechada',
    '2062':'Sociedade Empresária Limitada',
    '2070':'Sociedade Empresária em Nome Coletivo',
    '2089':'Sociedade Empresária em Comandita Simples',
    '2097':'Sociedade Empresária em Comandita por Ações',
    '2127':'Sociedade em Conta de Participação',
    '2135':'Empresário (Individual)',
    '2143':'Cooperativa',
    '2151':'Consórcio de Sociedades',
    '2160':'Grupo de Sociedades',
    '2178':'Estabelecimento, no Brasil, de Sociedade Estrangeira',
    '2194':'Estabelecimento de Empresa Binacional Argentino-Brasileira',
    '2216':'Empresa Domiciliada no Exterior',
    '2224':'Clube/Fundo de Investimento',
    '2232':'Sociedade Simples Pura',
    '2240':'Sociedade Simples Limitada',
    '2259':'Sociedade Simples em Nome Coletivo',
    '2267':'Sociedade Simples em Comandita Simples',
    '2275':'Empresa Binacional',
    '2283':'Consórcio de Empregadores',
    '2291':'Consórcio Simples',
    '2321':'Sociedade Unipessoal de Advocacia',
    '2330':'Cooperativas de Consumo',
    '3034':'Serviço Notarial e Registral (Cartório)',
    '3069':'Fundação Privada',
    '3077':'Serviço Social Autônomo',
    '3085':'Condomínio Edilício',
    '3107':'Comissão de Conciliação Prévia',
    '3115':'Entidade de Mediação e Arbitragem',
    '3131':'Entidade Sindical',
    '3204':'Estabelecimento, no Brasil, de Fundação ou Associação Estrangeiras',
    '3212':'Fundação ou Associação domiciliada no exterior',
    '3220':'Organização Religiosa',
    '3239':'Comunidade Indígena',
    '3247':'Fundo Privado',
    '3255':'Órgão de Direção Nacional de Partido Político',
    '3263':'Órgão de Direção Regional de Partido Político',
    '3271':'Órgão de Direção Local de Partido Político',
    '3301':'Organização Social (OS)',
    '3999':'Associação Privada',
    '4014':'Empresa Individual Imobiliária',
    '4090':'Candidato a Cargo Político Eletivo',
    '4120':'Produtor Rural (Pessoa Física)',
    '5010':'Organização Internacional',
    '5029':'Representação Diplomática Estrangeira',
    '5037':'Outras Instituições Extraterritoriais'
};

// Consulta a BrasilAPI (dados públicos da Receita Federal, gratuita, sem chave) e
// preenche Nome/Logradouro/Número/Bairro/CEP/UF/Cidade a partir do CNPJ.
// Só roda para CNPJ (14 dígitos) - CPF não tem base pública equivalente (sigilo fiscal).
async function consultarCNPJ(){

    const campoCpfCnpj = document.getElementById('cpfCnpj');
    const digitos = campoCpfCnpj.value.replace(/\D/g,'');

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

        // A API só devolve o código numérico da qualificação (ex: 49) - troca pelo
        // texto oficial da Receita ("49 - Sócio-Administrador") antes de guardar.
        if(dados.qualificacao_do_responsavel !== undefined && dados.qualificacao_do_responsavel !== null){
            const codigo = String(dados.qualificacao_do_responsavel);
            const descricao = QUALIFICACAO_RESPONSAVEL[codigo];
            dados.qualificacao_do_responsavel = descricao ? `${codigo} - ${descricao}` : codigo;
        }

        // Mesma lógica para o código de natureza jurídica (ex: 2062 -> "2062 -
        // Sociedade Empresária Limitada").
        if(dados.codigo_natureza_juridica !== undefined && dados.codigo_natureza_juridica !== null){
            const codigo = String(dados.codigo_natureza_juridica);
            const descricao = NATUREZA_JURIDICA[codigo];
            dados.codigo_natureza_juridica = descricao ? `${codigo} - ${descricao}` : codigo;
        }

        dadosReceita = dados;

        document.getElementById('nome').value = dados.nome_fantasia || dados.razao_social || '';
        document.getElementById('logradouro').value = dados.logradouro ?? '';
        document.getElementById('numeroEndereco').value = dados.numero ?? '';
        document.getElementById('bairro').value = dados.bairro ?? '';
        document.getElementById('cep').value = formatarCEP(dados.cep ?? '');
        document.getElementById('uf').value = dados.uf ?? '';
        document.getElementById('cidade').value = dados.municipio ?? '';

    } catch(e){
        alert('Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.');
    }

}

function emailValido(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function limparFormulario(){
    dadosReceita = null;
    document.getElementById("nome").value='';
    document.getElementById("cpfCnpj").value='';
    document.getElementById("email").value='';
    document.getElementById("telefone").value='';
    document.getElementById("cep").value='';
    document.getElementById("logradouro").value='';
    document.getElementById("numeroEndereco").value='';
    document.getElementById("bairro").value='';
    document.getElementById("uf").value='';
    document.getElementById("cidade").value='';
}

function cancelarEdicao(){
    editandoId = null;
    limparFormulario();
    document.getElementById("btnSalvar").textContent = 'Salvar';
    document.getElementById("btnCancelar").classList.add('d-none');
}

async function editar(id){

    const {data,error} = await supabaseClient
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

    if(error){
        alert(error.message);
        return;
    }

    // Reconstrói dadosReceita a partir das colunas da Receita já salvas, para que
    // salvar novamente (sem re-digitar o CNPJ) não apague esses dados.
    dadosReceita = null;
    const receitaParcial = {};
    for(const coluna of COLUNAS_RECEITA){
        if(data[coluna] !== null && data[coluna] !== undefined){
            receitaParcial[coluna] = data[coluna];
        }
    }
    if(Object.keys(receitaParcial).length){
        dadosReceita = receitaParcial;
    }

    document.getElementById("cpfCnpj").focus();

    document.getElementById("nome").value = data.nome ?? '';
    document.getElementById("cpfCnpj").value = data.cpf_cnpj ?? '';
    document.getElementById("email").value = data.email ?? '';
    document.getElementById("telefone").value = data.telefone ?? '';
    document.getElementById("cep").value = data.cep ?? '';
    document.getElementById("logradouro").value = data.logradouro ?? '';
    document.getElementById("numeroEndereco").value = data.numero_endereco ?? '';
    document.getElementById("bairro").value = data.bairro ?? '';
    document.getElementById("uf").value = data.uf ?? '';
    document.getElementById("cidade").value = data.cidade ?? '';

    editandoId = id;
    document.getElementById("btnSalvar").textContent = 'Atualizar';
    document.getElementById("btnCancelar").classList.remove('d-none');

    window.scrollTo({top:0, behavior:'smooth'});

}

async function excluir(id){

    const {data,error:erroConsulta} = await supabaseClient
        .from('clientes')
        .select('nome')
        .eq('id', id)
        .single();

    if(erroConsulta){
        alert(erroConsulta.message);
        return;
    }

    const nome = data?.nome || '(sem nome)';

    if(!confirm(`Excluir o cliente #${id} - ${nome}? Essa ação não pode ser desfeita.`)){
        return;
    }

    const {error} = await supabaseClient
        .from('clientes')
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

    const nome=document.getElementById("nome").value.trim();

    const cpfCnpj=document.getElementById("cpfCnpj").value.trim();

    const email=document.getElementById("email").value.trim();

    const telefone=document.getElementById("telefone").value.trim();

    const cep=document.getElementById("cep").value.trim();

    const logradouro=document.getElementById("logradouro").value.trim();

    const numeroEndereco=document.getElementById("numeroEndereco").value.trim();

    const bairro=document.getElementById("bairro").value.trim();

    const uf=document.getElementById("uf").value;

    const cidade=document.getElementById("cidade").value.trim();

    if(!nome){
        alert('Preencha o nome.');
        return;
    }

    if(email && !emailValido(email)){
        alert('Email inválido. Confira o endereço digitado.');
        return;
    }

    if(!cpfCnpjValido(cpfCnpj)){
        alert('CPF/CNPJ incompleto. Digite os 11 dígitos do CPF ou os 14 do CNPJ.');
        return;
    }

    const extrasReceita = dadosReceita ? mapearDadosReceita(dadosReceita) : {};

    const dados = {nome, cpf_cnpj: cpfCnpj || null, email, telefone, cep: cep || null, logradouro, numero_endereco: numeroEndereco || null, bairro, uf: uf || null, cidade, ...extrasReceita};

    let error;

    if(editandoId){
        ({error} = await supabaseClient.from("clientes").update(dados).eq('id', editandoId));
    } else {
        ({error} = await supabaseClient.from("clientes").insert(dados));
    }

    if(error){

        alert(error.message);

        return;

    }

    cancelarEdicao();

    carregar();

}

// Máscaras e auto-preenchimento em tempo real.
document.addEventListener('DOMContentLoaded', () => {

    const campoTelefone = document.getElementById('telefone');
    if(campoTelefone){
        campoTelefone.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }

    const campoCpfCnpj = document.getElementById('cpfCnpj');
    if(campoCpfCnpj){
        campoCpfCnpj.addEventListener('input', (e) => {
            e.target.value = formatarCpfCnpj(e.target.value);
        });
        campoCpfCnpj.addEventListener('blur', consultarCNPJ);
    }

    const campoCep = document.getElementById('cep');
    if(campoCep){
        campoCep.addEventListener('input', (e) => {
            e.target.value = formatarCEP(e.target.value);
        });
        // Ao sair do campo CEP, consulta o ViaCEP e leva o cursor direto para o
        // Número (único dado do endereço que a API não devolve e precisa ser
        // digitado manualmente).
        campoCep.addEventListener('blur', async () => {
            await consultarCEP();
            document.getElementById('numeroEndereco').focus();
        });
    }

});

checarLogin();
