// Lógica da página Dashboard (tela de fundo do sistema, exibida logo após o
// logon). Mostra um resumo (cards) e uma lista somente leitura das
// atividades - edição, exclusão e criação continuam exclusivamente na tela
// Atividades (atividades.html/atividades.js).
//
// Login, logout e supabaseClient ficam em auth.js (compartilhado).

// Identifica esta página para o sistema de permissões (usuarios_rotinas) em auth.js.
const ROTINA_ATUAL = 'dashboard';

async function carregar(){

    const {data, error} = await supabaseClient
        .from('atividades')
        .select('*, veiculos(placa, fabricante, modelo), condutores(nome)')
        .order('data_previsao', {ascending: false});

    if(error){
        alert(error.message);
        return;
    }

    const hojeStr = new Date().toISOString().slice(0, 10);

    let total = 0;
    let pendentes = 0;
    let concluidas = 0;
    let atrasadas = 0;

    // A lista abaixo dos cards é somente leitura e serve para dar visibilidade
    // rápida do que ainda precisa de atenção - por isso só mostra atividades
    // não concluídas. Os cards (Total, Pendentes, Concluídas, Atrasadas)
    // continuam contando TODAS as atividades, concluídas inclusive.
    let html = '';

    (data || []).forEach(a => {

        total++;

        const status = a.status ?? 'Pendente';
        const concluida = status === 'Concluída';

        if(concluida){
            concluidas++;
        } else {
            pendentes++;
            if(a.data_previsao && a.data_previsao < hojeStr){
                atrasadas++;
            }
        }

        if(concluida){
            return;
        }

        const veiculo = a.veiculos
            ? [a.veiculos.placa, [a.veiculos.fabricante, a.veiculos.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' - ')
            : '<span class="text-danger">(sem veículo)</span>';

        const condutor = a.condutores?.nome ?? '';
        const dataFmt = a.data_previsao ? new Date(a.data_previsao + 'T00:00:00').toLocaleDateString('pt-BR') : '';
        const statusCor = 'bg-warning text-dark';

        html += `
        <tr>
            <td>${a.id}</td>
            <td>${veiculo}</td>
            <td>${condutor}</td>
            <td>${a.tipo_atividade ?? ''}</td>
            <td>${dataFmt}</td>
            <td><span class="badge ${statusCor}">${status}</span></td>
            <td>${a.km ?? ''}</td>
            <td>${a.observacao ?? ''}</td>
        </tr>
        `;

    });

    document.getElementById('cardTotal').textContent = total;
    document.getElementById('cardPendentes').textContent = pendentes;
    document.getElementById('cardConcluidas').textContent = concluidas;
    document.getElementById('cardAtrasadas').textContent = atrasadas;

    document.getElementById('lista').innerHTML = html;

}

checarLogin();
