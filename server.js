const express = require('express');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';

// Variáveis do Render (Mantidas como você configurou)
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Configurações do Fechamento
const CONFIG_SENHA = '8745'; 
const LINK_FORMSPREEE = 'https://formspree.io/f/xaqkjkja'; 

// Autenticação Google
const auth = new JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ROTA 1: COMPUTAR CLIQUE INDIVIDUAL
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

// ROTA 2: PROCESSAR FECHAMENTO (EMAIL + RESET PLANILHA) - CONSERTADA!
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

      // Só processa se a linha tiver um colaborador preenchido
      if (colaborador && colaborador.trim() !== '') {
        if (cliques > 0) {
          relatorioTexto += `• Grupo/Colaborador: ${colaborador}\n  Desvio: ${desvio}\n  Quantidade: ${cliques}\n`;
          relatorioTexto += '-----------------------------------------\n';
          dadosEncontrados = true;
        }
        colC_Zeradada.push([0]); // Adiciona 0 para limpar a linha correspondente
      }
    }

    if (!dadosEncontrados) relatorioTexto += 'Nenhum desvio coletado neste período.\n';

    // 2. Dispara o relatório por E-mail via Formspree (Removida a trava antiga que causava erro 400)
    await fetch(LINK_FORMSPREEE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: 'Fechamento de Turno - Segurança do Trabalho',
        Relatorio: relatorioTexto
      })
    });

    // 3. Zera a coluna C na Planilha do Google Sheets
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
    --modal-overlay: rgba(0, 0, 0, 0.85);
    --modal-bg: #222222;
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

/* MODAIS PERSONALIZADOS */
.modal-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: var(--modal-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.25s ease;
}

.modal-overlay.active {
    opacity: 1;
    visibility: visible;
}

.modal-box {
    background: var(--modal-bg);
    width: 85%;
    max-width: 380px;
    padding: 25px 20px;
    border-radius: 18px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.7);
    text-align: center;
    transform: scale(0.85);
    transition: all 0.25s ease;
    box-sizing: border-box;
}

.modal-overlay.active .modal-box {
    transform: scale(1);
}

.modal-box h3 {
    margin-top: 0;
    font-size: 19px;
    color: #ffc107;
}

.modal-text {
    font-size: 14px;
    color: #e0e0e0;
    line-height: 1.5;
    margin-bottom: 22px;
}

.modal-input {
    width: 100%;
    padding: 14px;
    background: #111;
    border: 1px solid #444;
    border-radius: 10px;
    color: #fff;
    font-size: 20px;
    text-align: center;
    font-weight: bold;
    letter-spacing: 4px;
    margin-bottom: 20px;
    box-sizing: border-box;
    outline: none;
}

.modal-flex-btns {
    display: flex;
    justify-content: center;
    gap: 12px;
}

.m-btn {
    flex: 1;
    padding: 14px;
    font-size: 15px;
    font-weight: bold;
    border: none;
    border-radius: 10px;
    cursor: pointer;
}

.m-btn-confirm { background: #28a745; color: white; }
.m-btn-cancel { background: #dc3545; color: white; }
.m-btn-ok { background: var(--blue-accent); color: white; width: 60%; flex: none; }

.loading-spinner {
    border: 4px solid rgba(255,255,255,0.1);
    border-top: 4px solid #ffc107;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    animation: spin 0.9s linear infinite;
    margin: 15px auto;
}
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
</head>

<body>

<div class="header-container">
    <button class="logo-btn" onclick="abrirModalSenha()">
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
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Utilizar escada pelo lado errado')"><span>01.</span> Utilizar escada pelo lado errado</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Utilizar escada sem segurar no corrimão')"><span>02.</span> Utilizar escada sem segurar no corrimão</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Utilizar escada utilizando o celular')"><span>03.</span> Utilizar escada utilizando o celular</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Transitar com as mãos nos bolsos')"><span>04.</span> Transitar com as mãos nos bolsos</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Transitar fora da calçada')"><span>05.</span> Transitar fora da calçada</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Transitar fora da faixa de pedestre')"><span>06.</span> Transitar fora da faixa de pedestre</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Transitar utilizando o celular')"><span>07.</span> Transitar utilizando o celular</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Descarte inadequado de lixo')"><span>08.</span> Descarte inadequado de lixo</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Desvio comportamental')"><span>09.</span> Desvio comportamental</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Transitar se alimentando')"><span>10.</span> Transitar se alimentando</button>
        <button class="btn-caso" onclick="pedirConfirmacaoClique('Uso da escada simultâneo em paralelo')"><span>11.</span> Uso da escada simultâneo em paralelo</button>
    </div>

    <button class="btn-time back-btn" onclick="voltar()">
        ← Voltar
    </button>
</div>

<div id="m-confirm-clique" class="modal-overlay">
    <div class="modal-box">
        <h3>Confirmar Registro</h3>
        <div id="txt-confirm-clique" class="modal-text"></div>
        <div class="modal-flex-btns">
            <button class="m-btn m-btn-cancel" onclick="fecharModais()">Cancelar</button>
            <button class="m-btn m-btn-confirm" onclick="executarEnvioClique()">Confirmar</button>
        </div>
    </div>
</div>

<div id="m-senha-admin" class="modal-overlay">
    <div class="modal-box">
        <h3>Painel de Controle</h3>
        <div class="modal-text">Por favor, insira a senha administrativa de 4 dígitos:</div>
        <input type="password" id="campo-senha" class="modal-input" maxlength="4" placeholder="••••" inputmode="numeric">
        <div class="modal-flex-btns">
            <button class="m-btn m-btn-cancel" onclick="fecharModais()">Cancelar</button>
            <button class="m-btn m-btn-confirm" onclick="validarSenhaAdmin()">Acessar</button>
        </div>
    </div>
</div>

<div id="m-confirm-fechamento" class="modal-overlay">
    <div class="modal-box">
        <h3 style="color: #dc3545;">⚠️ Atenção! Fechamento</h3>
        <div class="modal-text">Você confirmou a senha administrativa.<br><br>Ao continuar, o sistema gerará o relatório para e-mail e <b style="color:#dc3545;">ZERARÁ COMPLETAMENTE</b> os registros da planilha. Quer continuar?</div>
        <div class="modal-flex-btns">
            <button class="m-btn m-btn-cancel" onclick="fecharModais()">Cancelar</button>
            <button class="m-btn m-btn-confirm" onclick="executarProcessoFechamento()">Sim, Resetar</button>
        </div>
    </div>
</div>

<div id="m-status" class="modal-overlay">
    <div class="modal-box">
        <h3 id="status-titulo">-</h3>
        <div id="status-corpo" class="modal-text">-</div>
        <div id="status-bloco-btn" class="hidden">
            <button class="m-btn m-btn-ok" onclick="fecharModaisEResetarInterface()">OK</button>
        </div>
    </div>
</div>

<script>
let timeSelecionado = '';
let casoSelecionado = '';
let senhaDigitadaValida = ''; 
let bloqueioEnvio = false; 

function selecionarTime(time){
    timeSelecionado = time;
    document.getElementById('titulo-time').innerText = 'GRUPO ' + time;
    document.getElementById('tela-times').classList.add('hidden');
    document.getElementById('tela-casos').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function voltar(){
    document.getElementById('tela-times').classList.remove('hidden');
    document.getElementById('tela-casos').classList.add('hidden');
}

function abrirModal(id) {
    document.getElementById(id).classList.add('active');
}

function fecharModais() {
    const modais = document.querySelectorAll('.modal-overlay');
    modais.forEach(m => m.classList.remove('active'));
    document.getElementById('campo-senha').value = '';
}

function fecharModaisEResetarInterface() {
    const t = document.getElementById('status-titulo').innerText;
    fecharModais();
    if(t.includes('Concluído') || t.includes('Sucesso')) {
        window.location.reload();
    }
}

function exibirStatusProcessando(titulo, mensagem) {
    document.getElementById('status-titulo').innerText = titulo;
    document.getElementById('status-corpo').innerHTML = '<div class="loading-spinner"></div>' + mensagem;
    document.getElementById('status-bloco-btn').classList.add('hidden');
    abrirModal('m-status');
}

function exibirStatusResultado(titulo, mensagem) {
    document.getElementById('status-titulo').innerText = titulo;
    document.getElementById('status-corpo').innerHTML = mensagem;
    document.getElementById('status-bloco-btn').classList.remove('hidden');
    abrirModal('m-status');
}

function pedirConfirmacaoClique(caso) {
    if (bloqueioEnvio) return;
    casoSelecionado = caso;
    document.getElementById('txt-confirm-clique').innerHTML = 'Deseja somar <b>+1</b> para o <b>GRUPO ' + timeSelecionado + '</b> no desvio:<br><br>"' + caso + '"?';
    abrirModal('m-confirm-clique');
}

async function executarEnvioClique() {
    fecharModais();
    bloqueioEnvio = true;
    exibirStatusProcessando('Gravando Dados', 'Comunicando com o robô da planilha. Por favor, aguarde...');

    try {
        const response = await fetch('/api/clique', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ time: timeSelecionado, caso: casoSelecionado })
        });

        const data = await response.json();
        bloqueioEnvio = false;

        if (response.ok && data.success) {
            exibirStatusResultado('Sucesso ✅', 'O desvio foi salvo na planilha!<br><br><b>Novo total do grupo: ' + data.novoTotal + '</b>');
        } else {
            exibirStatusResultado('Aviso do Sistema ❌', data.error || 'Não foi possível salvar.');
        }
    } catch(err) {
        bloqueioEnvio = false;
        exibirStatusResultado('Erro de Conexão 📡', 'Falha ao conectar ao servidor.');
    }
}

function abrirModalSenha() {
    if (bloqueioEnvio) return;
    fecharModais();
    abrirModal('m-senha-admin');
    setTimeout(() => document.getElementById('campo-senha').focus(), 350);
}

function validarSenhaAdmin() {
    const senha = document.getElementById('campo-senha').value;
    if (!senha) return;
    
    if (senha === '8745') { 
        senhaDigitadaValida = senha;
        fecharModais();
        // Delay minúsculo para a animação de transição dos modais ficar suave
        setTimeout(() => abrirModal('m-confirm-fechamento'), 100);
    } else {
        exibirStatusResultado('Senha Incorreta 🔒', 'A chave digitada não confere com o padrão administrativo.');
    }
}

async function executarProcessoFechamento() {
    fecharModais();
    bloqueioEnvio = true;
    exibirStatusProcessando('Processando Turno', 'Compilando desvios, disparando relatório por e-mail e limpando planilha. Aguarde...');

    try {
        const response = await fetch('/api/fechamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senha: senhaDigitadaValida })
        });

        bloqueioEnvio = false;

        if (response.ok) {
            exibirStatusResultado('Fechamento Concluído', '✅ O relatório foi enviado com sucesso e a planilha foi completamente resetada para o próximo turno.');
        } else {
            const data = await response.json();
            exibirStatusResultado('Falha no Fechamento', data.error || 'O robô recusou o comando de reset.');
        }
    } catch(err) {
        bloqueioEnvio = false;
        exibirStatusResultado('Erro de Rede 📡', 'Falha de comunicação durante o fechamento.');
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
