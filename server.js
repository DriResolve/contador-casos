const express = require('express');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';

// Variáveis do Render (Mantidas como você configurou)
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Configurações do Fechamento
const CONFIG_SENHA = '8745'; // Mude aqui para a senha de 4 dígitos que desejar
const LINK_FORMSPREEE = 'https://formspree.io/f/xaqkjkja'; // Crie um form gratuito no formspree.io e cole o link aqui

// Autenticação Google
const auth = new JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ROTA 1: COMPUTAR CLIQUE INDIVIDUAL (Mantida sua lógica funcional)
app.post('/api/clique', async (req, res) => {
  try {
    const { time, caso } = req.body;

    if (!time || !caso) {
      return res.status(400).json({ success: false, error: 'Time ou caso nao enviado' });
    }

    const authHeaders = await auth.getRequestHeaders();
    const token = authHeaders.Authorization;

    const urlBusca = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:C100`;
    const responseBusca = await fetch(urlBusca, { headers: { Authorization: token } });

    if (!responseBusca.ok) {
      const erroTexto = await responseBusca.text();
      return res.status(responseBusca.status).json({ success: false, error: erroTexto });
    }

    const dataBusca = await responseBusca.json();
    const linhas = dataBusca.values || [];

    let linhaIndex = -1;
    let cliquesAtuais = 0;

    for (let i = 1; i < linhas.length; i++) {
      const rowTime = (linhas[i][0] || '').toString().trim().toUpperCase();
      const rowCaso = (linhas[i][1] || '').toString().trim().toUpperCase();

      if (rowTime === time.toUpperCase() && rowCaso === caso.toUpperCase()) {
        linhaIndex = i + 1;
        cliquesAtuais = parseInt(linhas[i][2] || 0);
        break;
      }
    }

    if (linhaIndex === -1) {
      return res.status(404).json({ success: false, error: `Nao encontrei: ${time} - ${caso}` });
    }

    const novoTotal = cliquesAtuais + 1;
    const urlSalvar = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/C${linhaIndex}?valueInputOption=USER_ENTERED`;

    const responseSalvar = await fetch(urlSalvar, {
      method: 'PUT',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[novoTotal]] })
    });

    if (!responseSalvar.ok) {
      const erroTexto = await responseSalvar.text();
      return res.status(responseSalvar.status).json({ success: false, error: erroTexto });
    }

    return res.json({ success: true, novoTotal });

  } catch (error) {
    console.error('ERRO SERVIDOR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ROTA 2: PROCESSAR FECHAMENTO (EMAIL + RESET PLANILHA)
app.post('/api/fechamento', async (req, res) => {
  try {
    const { senha } = req.body;
    if (senha !== CONFIG_SENHA) {
      return res.status(403).json({ success: false, error: 'Senha incorreta!' });
    }

    const authHeaders = await auth.getRequestHeaders();
    const token = authHeaders.Authorization;

    // 1. Busca dados atuais para montar o relatório
    const urlBusca = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:C100`;
    const responseBusca = await fetch(urlBusca, { headers: { Authorization: token } });
    const dataBusca = await responseBusca.json();
    const linhas = dataBusca.values || [];

    let relatorioTexto = 'RELATÓRIO DE DESVIOS COMPORTAMENTAIS\n';
    relatorioTexto += '=========================================\n\n';
    
    let dadosEncontrados = false;
    let colC_Zeradada = [];

    for (let i = 1; i < linhas.length; i++) {
      const colaborador = linhas[i][0];
      const desvio = linhas[i][1];
      const cliques = parseInt(linhas[i][2] || 0);

      if (cliques > 0) {
        relatorioTexto += `• Colaborador: ${colaborador}\n  Desvio: ${desvio}\n  Quantidade: ${cliques}\n`;
        relatorioTexto += '-----------------------------------------\n';
        dadosEncontrados = true;
      }
      colC_Zeradada.push([0]); // Prepara a zeragem da linha
    }

    if (!dadosEncontrados) relatorioTexto += 'Nenhum desvio coletado neste período.\n';

    // 2. Dispara o relatório por E-mail via Formspree
    if (LINK_FORMSPREEE.includes('https://formspree.io/f/xaqkjkja')) {
      return res.status(400).json({ success: false, error: 'Configure o link do Formspree na linha 14 do código.' });
    }

    await fetch(LINK_FORMSPREEE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: 'Fechamento de Turno - Segurança do Trabalho',
        Relatorio: relatorioTexto
      })
    });

    // 3. Zera a coluna C na Planilha
    if (colC_Zeradada.length > 0) {
      const urlReset = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/C2:C${colC_Zeradada.length + 1}?valueInputOption=USER_ENTERED`;
      await fetch(urlReset, {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: colC_Zeradada })
      });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error('ERRO NO FECHAMENTO:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Interface Gráfica Premium Atualizada
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Contador - Segurança</title>
<style>
:root {
    --bg-main: #121212;
    --bg-card: #1e1e1e;
    --green-safety: #1b4d3e;
    --green-active: #2d8a68;
    --blue-accent: #007bff;
    --text-white: #ffffff;
    --text-muted: #b3b3b3;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    background: var(--bg-main);
    color: var(--text-white);
    text-align: center;
    margin: 0;
    padding: 15px;
    box-sizing: border-box;
}

.header-container {
    margin: 15px auto 25px auto;
    max-width: 400px;
}

.logo-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    outline: none;
    -webkit-tap-highlight-color: transparent;
}

.logo-img {
    width: 300px;
    height: auto;
    filter: drop-shadow(0px 4px 10px rgba(0,0,0,0.6));
}

.app-title {
    font-size: 22px;
    font-weight: bold;
    margin-top: 12px;
    color: var(--text-white);
    letter-spacing: 0.5px;
}

.subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 4px;
}

.card {
    background: var(--bg-card);
    padding: 20px 15px;
    border-radius: 14px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    max-width: 420px;
    margin: 0 auto;
}

h2 {
    font-size: 18px;
    margin-top: 0;
    margin-bottom: 20px;
    color: #ffc107;
}

.btn-time {
    width: 95%;
    padding: 16px;
    margin: 10px auto;
    border: none;
    border-radius: 10px;
    background: var(--blue-accent);
    color: white;
    font-size: 17px;
    font-weight: bold;
    display: block;
    cursor: pointer;
    box-shadow: 0 3px 6px rgba(0,123,255,0.2);
    -webkit-tap-highlight-color: transparent;
}

.btn-time:active {
    background: #0056b3;
}

.btn-caso {
    width: 95%;
    padding: 14px;
    margin: 10px auto;
    border: 1px solid rgba(255,255,255,0.03);
    border-radius: 8px;
    background: var(--green-safety);
    color: white;
    display: flex;
    align-items: center;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    box-sizing: border-box;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    -webkit-tap-highlight-color: transparent;
}

.btn-caso:active {
    background: var(--green-active);
}

.btn-caso span {
    font-weight: bold;
    color: #ffc107;
    margin-right: 10px;
}

.back-btn {
    background: #495057;
    width: 50%;
    margin-top: 20px;
    padding: 12px;
    font-size: 15px;
    box-shadow: none;
}

.back-btn:active {
    background: #343a40;
}

.hidden {
    display: none !important;
}
</style>
</head>

<body>

<div class="header-container">
    <button class="logo-btn" onclick="solicitarFechamento()">
        <img class="logo-img" src="https://i.postimg.cc/d003T7kJ/Seguranca.png" alt="Segurança do Trabalho">
    </button>
</div>

<div id="tela-times" class="card">
    <h2>Selecione o Grupo</h2>
    <button class="btn-time" onclick="selecionarTime('A')">GRUPO A</button>
    <button class="btn-time" onclick="selecionarTime('B')">GRUPO B</button>
    <button class="btn-time" onclick="selecionarTime('C')">GRUPO C</button>
    <button class="btn-time" onclick="selecionarTime('D')">GRUPO D</button>
</div>

<div id="tela-casos" class="card hidden">
    <h2>GRUPO: <span id="titulo-time" style="color: #fff;">-</span></h2>
    
    <div id="casos-container">
        <button class="btn-caso" onclick="computar('Utilizar escada pelo lado errado')"><span>01.</span> Utilizar escada pelo lado errado</button>
        <button class="btn-caso" onclick="computar('Utilizar escada sem segurar no corrimão')"><span>02.</span> Utilizar escada sem segurar no corrimão</button>
        <button class="btn-caso" onclick="computar('Utilizar escada utilizando o celular')"><span>03.</span> Utilizar escada utilizando o celular</button>
        <button class="btn-caso" onclick="computar('Transitar com as mãos nos bolsos')"><span>04.</span> Transitar com as mãos nos bolsos</button>
        <button class="btn-caso" onclick="computar('Transitar fora da calçada')"><span>05.</span> Transitar fora da calçada</button>
        <button class="btn-caso" onclick="computar('Transitar fora da faixa de pedestre')"><span>06.</span> Transitar fora da faixa de pedestre</button>
        <button class="btn-caso" onclick="computar('Transitar utilizando o celular')"><span>07.</span> Transitar utilizando o celular</button>
        <button class="btn-caso" onclick="computar('Descarte inadequado de lixo')"><span>08.</span> Descarte inadequado de lixo</button>
        <button class="btn-caso" onclick="computar('Desvio comportamental')"><span>09.</span> Desvio comportamental</button>
        <button class="btn-caso" onclick="computar('Transitar se alimentando')"><span>10.</span> Transitar se alimentando</button>
        <button class="btn-caso" onclick="computar('Uso da escada simultâneo em paralelo')"><span>11.</span> Uso da escada simultâneo em paralelo</button>
    </div>

    <button class="btn-time back-btn" onclick="voltar()">
        ← Voltar
    </button>
</div>

<script>
let timeSelecionado = '';

function selecionarTime(time){
    timeSelecionado = time;
    document.getElementById('titulo-time').innerText = time;
    document.getElementById('tela-times').classList.add('hidden');
    document.getElementById('tela-casos').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltar(){
    document.getElementById('tela-times').classList.remove('hidden');
    document.getElementById('tela-casos').classList.add('hidden');
}

async function computar(caso){
    if(!confirm('Confirmar +1 para ' + timeSelecionado + '?')){
        return;
    }

    try{
        const response = await fetch('/api/clique',{
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body:JSON.stringify({ time:timeSelecionado, caso:caso })
        });

        const data = await response.json();
        if(response.ok && data.success){
            alert('Registrado! Novo total: ' + data.novoTotal);
        }else{
            alert(data.error || 'Erro desconhecido');
        }
    }catch(err){
        alert('Erro de conexão');
    }
}

async function solicitarFechamento() {
    const senha = prompt('Digite a senha de 4 dígitos para fazer o fechamento:');
    if (!senha) return;

    if (!confirm('Isto irá disparar o relatório por e-mail e ZERAR a planilha. Confirma?')) return;

    try {
        const response = await fetch('/api/fechamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senha: senha })
        });

        if (response.ok) {
            alert('Fechamento realizado! Relatório enviado e dados zerados.');
            window.location.reload();
        } else {
            const data = await response.json();
            alert('Erro: ' + (data.error || 'Não foi possível fechar.'));
        }
    } catch(err) {
        alert('Erro de rede ao processar fechamento.');
    }
}
</script>

</body>
</html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
