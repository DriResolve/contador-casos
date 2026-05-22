const express = require('express');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';

// Pega os dados diretamente do sistema do Render (Sem quebrar linhas)
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

// Configuração de autenticação direta com o Google
const auth = new JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.post('/api/clique', async (req, res) => {
  try {
    const { time, caso } = req.body;

    if (!privateKey || !clientEmail) {
      return res.status(500).json({ success: false, error: 'Configuracao incompleta no Render: Variaveis GOOGLE_CLIENT_EMAIL ou GOOGLE_PRIVATE_KEY estao faltando.' });
    }

    const authHeaders = await auth.getRequestHeaders();
    const token = authHeaders.Authorization;

    // 1. Busca os dados da planilha
    const urlBusca = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/A1:C100`;
    const responseBusca = await fetch(urlBusca, { headers: { 'Authorization': token } });
    
    if (!responseBusca.ok) {
      const errData = await responseBusca.json().catch(() => ({}));
      return res.status(responseBusca.status).json({ success: false, error: `Erro Google Busca: ${errData.error?.message || responseBusca.statusText}` });
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
      return res.status(404).json({ success: false, error: `Nao encontrei na planilha a linha para: ${time} - ${caso}` });
    }

    // 2. Salva o novo valor somando +1
    const novoTotal = cliquesAtuais + 1;
    const urlSalvar = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/C${linhaIndex}?valueInputOption=USER_ENTERED`;
    
    const responseSalvar = await fetch(urlSalvar, {
      method: 'PUT',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[novoTotal]] })
    });

    if (!responseSalvar.ok) {
      const errData = await responseSalvar.json().catch(() => ({}));
      return res.status(responseSalvar.status).json({ success: false, error: `Erro Google Salvar: ${errData.error?.message || responseSalvar.statusText}` });
    }

    return res.json({ success: true, novoTotal: novoTotal });

  } catch (error) {
    console.error('Erro no servidor:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erro interno desconhecido' });
  }
});

// Página Web (Interface do Celular)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contador de Casos</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #222; color: #fff; text-align: center; }
            h1 { font-size: 24px; margin-bottom: 20px; color: #ffc107; }
            .btn-time { background: #007bff; color: white; padding: 15px; margin: 10px; border: none; border-radius: 8px; width: 85%; font-size: 18px; font-weight: bold; cursor: pointer; }
            .btn-caso { background: #28a745; color: white; padding: 14px; margin: 8px; border: none; border-radius: 6px; width: 90%; font-size: 14px; text-align: left; cursor: pointer; display: block; margin-left: auto; margin-right: auto; }
            .back-btn { background: #6c757d; margin-top: 20px; width: 50%; }
            .hidden { display: none; }
            #casos-container { max-width: 400px; margin: 0 auto; }
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
            <h1 id="titulo-time">Casos</h1>
            <div id="casos-container">
                <button class="btn-caso" onclick="computar('Utilizar escada pelo lado errado')">1. Utilizar escada pelo lado errado</button>
                <button class="btn-caso" onclick="computar('Utilizar escada sem segurar no corrimão')">2. Utilizar escada sem segurar no corrimão</button>
                <button class="btn-caso" onclick="computar('Utilizar escada utilizando o celular')">3. Utilizar escada utilizando o celular</button>
                <button class="btn-caso" onclick="computar('Transitar com as mãos nos bolsos')">4. Transitar com as mãos nos bolsos</button>
                <button class="btn-caso" onclick="computar('Transitar fora da calçada')">5. Transitar fora da calçada</button>
                <button class="btn-caso" onclick="computar('Transitar fora da faixa de pedestre')">6. Transitar fora da faixa de pedestre</button>
                <button class="btn-caso" onclick="computar('Transitar utilizando o celular')">7. Transitar utilizando o celular</button>
                <button class="btn-caso" onclick="computar('Descarte inadequado de lixo')">8. Descarte inadequado de lixo</button>
                <button class="btn-caso" onclick="computar('Desvio comportamental')">9. Desvio comportamental</button>
                <button class="btn-caso" onclick="computar('Transitar se alimentando')">10. Transitar se alimentando</button>
            </div>
            <button class="btn-time back-btn" onclick="voltar()">← Voltar</button>
        </div>

        <script>
            let timeSelecionado = '';

            function selecionarTime(time) {
                timeSelecionado = time;
                document.getElementById('titulo-time').innerText = time;
                document.getElementById('tela-times').classList.add('hidden');
                document.getElementById('tela-casos').classList.remove('hidden');
            }

            function voltar() {
                document.getElementById('tela-times').classList.remove('hidden');
                document.getElementById('tela-casos').classList.add('hidden');
            }

            async function computar(caso) {
                if(!confirm('Confirmar +1 para ' + timeSelecionado + '?')) return;
                
                try {
                    const response = await fetch('/api/clique', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ time: timeSelecionado, caso: caso })
                    });
                    
                    const data = await response.json();
                    if(response.ok && data.success) {
                        alert('Sucesso! Registrado. Novo total: ' + data.novoTotal);
                    } else {
                        alert('Erro indicado pelo servidor: ' + (data.error || 'Erro desconhecido'));
                    }
                } catch (err) {
                    alert('Erro de rede ou conexao com o servidor.');
                }
            }
        </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
