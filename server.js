const express = require('express');
const { JWT } = require('google-auth-library');

const app = express();

app.use(express.json());

const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';

// Variáveis do Render
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Autenticação Google
const auth = new JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.post('/api/clique', async (req, res) => {
  try {
    const { time, caso } = req.body;

    if (!time || !caso) {
      return res.status(400).json({
        success: false,
        error: 'Time ou caso nao enviado'
      });
    }

    // Token Google
    const authHeaders = await auth.getRequestHeaders();
    const token = authHeaders.Authorization;

    // Buscar dados da planilha
    const urlBusca =
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:C100`;

    const responseBusca = await fetch(urlBusca, {
      headers: {
        Authorization: token
      }
    });

    if (!responseBusca.ok) {
      const erroTexto = await responseBusca.text();

      return res.status(responseBusca.status).json({
        success: false,
        error: erroTexto
      });
    }

    const dataBusca = await responseBusca.json();

    const linhas = dataBusca.values || [];

    let linhaIndex = -1;
    let cliquesAtuais = 0;

    for (let i = 1; i < linhas.length; i++) {
      const rowTime = (linhas[i][0] || '')
        .toString()
        .trim()
        .toUpperCase();

      const rowCaso = (linhas[i][1] || '')
        .toString()
        .trim()
        .toUpperCase();

      if (
        rowTime === time.toUpperCase() &&
        rowCaso === caso.toUpperCase()
      ) {
        linhaIndex = i + 1;
        cliquesAtuais = parseInt(linhas[i][2] || 0);
        break;
      }
    }

    if (linhaIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Nao encontrei: ${time} - ${caso}`
      });
    }

    // Somar +1
    const novoTotal = cliquesAtuais + 1;

    const urlSalvar =
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/C${linhaIndex}?valueInputOption=USER_ENTERED`;

    const responseSalvar = await fetch(urlSalvar, {
      method: 'PUT',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[novoTotal]]
      })
    });

    if (!responseSalvar.ok) {
      const erroTexto = await responseSalvar.text();

      return res.status(responseSalvar.status).json({
        success: false,
        error: erroTexto
      });
    }

    return res.json({
      success: true,
      novoTotal
    });

  } catch (error) {
    console.error('ERRO SERVIDOR:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Contador</title>

<style>
body{
    font-family: Arial;
    background:#111;
    color:white;
    text-align:center;
    margin:20px;
}

h1{
    color:#ffc107;
}

.btn-time{
    width:85%;
    padding:15px;
    margin:10px;
    border:none;
    border-radius:8px;
    background:#007bff;
    color:white;
    font-size:18px;
    font-weight:bold;
}

.btn-caso{
    width:90%;
    padding:14px;
    margin:8px auto;
    border:none;
    border-radius:6px;
    background:#28a745;
    color:white;
    display:block;
    text-align:left;
}

.back-btn{
    background:#6c757d;
    width:50%;
    margin-top:20px;
}

.hidden{
    display:none;
}
</style>
</head>

<body>

<div id="tela-times">

<h1>Selecione o Nome</h1>

<button class="btn-time" onclick="selecionarTime('BIGODES')">BIGODES</button>

<button class="btn-time" onclick="selecionarTime('GABRIEL')">GABRIEL</button>

<button class="btn-time" onclick="selecionarTime('LAURA')">LAURA</button>

<button class="btn-time" onclick="selecionarTime('ADRIELE')">ADRIELE</button>

</div>

<div id="tela-casos" class="hidden">

<h1 id="titulo-time">CASOS</h1>

<button class="btn-caso" onclick="computar('Utilizar escada pelo lado errado')">
1. Utilizar escada pelo lado errado
</button>

<button class="btn-caso" onclick="computar('Utilizar escada sem segurar no corrimão')">
2. Utilizar escada sem segurar no corrimão
</button>

<button class="btn-caso" onclick="computar('Utilizar escada utilizando o celular')">
3. Utilizar escada utilizando o celular
</button>

<button class="btn-caso" onclick="computar('Transitar com as mãos nos bolsos')">
4. Transitar com as mãos nos bolsos
</button>

<button class="btn-caso" onclick="computar('Transitar fora da calçada')">
5. Transitar fora da calçada
</button>

<button class="btn-caso" onclick="computar('Transitar fora da faixa de pedestre')">
6. Transitar fora da faixa de pedestre
</button>

<button class="btn-caso" onclick="computar('Transitar utilizando o celular')">
7. Transitar utilizando o celular
</button>

<button class="btn-caso" onclick="computar('Descarte inadequado de lixo')">
8. Descarte inadequado de lixo
</button>

<button class="btn-caso" onclick="computar('Desvio comportamental')">
9. Desvio comportamental
</button>

<button class="btn-caso" onclick="computar('Transitar se alimentando')">
10. Transitar se alimentando
</button>

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
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify({
                time:timeSelecionado,
                caso:caso
            })
        });

        const data = await response.json();

        if(response.ok && data.success){

            alert('Registrado! Novo total: ' + data.novoTotal);

        }else{

            alert(data.error || 'Erro desconhecido');
        }

    }catch(err){

        alert('Erro de conexao');
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
