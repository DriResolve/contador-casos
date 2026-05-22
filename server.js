const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const path = require('path');
const creds = require('./credentials.json');

const app = express();
app.use(express.json());

// SUBSTITUA AQUI PELO ID DA SUA PLANILHA:
const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';

// Configuração de acesso ao Google
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

// Rota que recebe o clique do telemóvel e soma na planilha
app.post('/api/clique', async (req, res) => {
  try {
    const { time, caso } = req.body;
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // Pega a primeira aba
    const rows = await sheet.getRows();

    // Procura a linha que tem o Time E o Caso certos
    const rowToUpdate = rows.find(row => 
      row.get('TIMES') === time && row.get('CASOS') === caso
    );

    if (rowToUpdate) {
      const cliquesAtuais = parseInt(rowToUpdate.get('CLICKS') || 0);
      rowToUpdate.set('CLICKS', cliquesAtuais + 1);
      await rowToUpdate.save(); // Salva no Google Sheets
      return res.json({ success: true, novoTotal: cliquesAtuais + 1 });
    }

    res.status(404).json({ success: false, error: 'Linha não encontrada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Página Web (Interface para o Telemóvel)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contador de Casos</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f4f4f9; text-align: center; }
            h1 { color: #333; }
            .btn-time { background: #007bff; color: white; padding: 15px; margin: 10px; border: none; border-radius: 8px; width: 80%; font-size: 18px; cursor: pointer; }
            .btn-caso { background: #28a745; color: white; padding: 12px; margin: 5px; border: none; border-radius: 6px; width: 90%; font-size: 14px; cursor: pointer; }
            .back-btn { background: #6c757d; margin-top: 20px; }
            .hidden { display: none; }
            #casos-container { max-width: 400px; margin: 0 auto; }
        </style>
    </head>
    <body>

        <div id="tela-times">
            <h1>Selecione o Nome</h1>
            <button class="btn-time" onclick="selecionarTime('BIGCODES')">BIGCODES</button>
            <button class="btn-time" onclick="selecionarTime('GABRIEL')">GABRIEL</button>
            <button class="btn-time" onclick="selecionarTime('LAURA')">LAURA</button>
            <button class="btn-time" onclick="selecionarTime('ADRIELE')">ADRIELE</button>
        </div>

        <div id="tela-casos" class="hidden">
            <h1 id="titulo-time">Casos</h1>
            <div id="casos-container">
                <button class="btn-caso" onclick="computar('Utilizar escada pelo lado errado')">Utilizar escada pelo lado errado</button>
                <button class="btn-caso" onclick="computar('Utilizar escada sem segurar no corrimão')">Utilizar escada sem segurar no corrimão</button>
                <button class="btn-caso" onclick="computar('Utilizar escada utilizando o celular')">Utilizar escada utilizando o celular</button>
                <button class="btn-caso" onclick="computar('Transitar com as mãos nos bolsos')">Transitar com as mãos nos bolsos</button>
                <button class="btn-caso" onclick="computar('Transitar fora da calçada')">Transitar fora da calçada</button>
                <button class="btn-caso" onclick="computar('Transitar fora da faixa de pedestre')">Transitar fora da faixa de pedestre</button>
                <button class="btn-caso" onclick="computar('Transitar utilizando o celular')">Transitar utilizando o celular</button>
                <button class="btn-caso" onclick="computar('Descarte inadequado de lixo')">Descarte inadequado de lixo</button>
                <button class="btn-caso" onclick="computar('Desvio comportamental')">Desvio comportamental</button>
                <button class="btn-caso" onclick="computar('Transitar se alimentando')">Transitar se alimentando</button>
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
                if(!confirm(\`Somar +1 em "\${caso}" para \${timeSelecionado}?\`)) return;
                
                try {
                    const response = await fetch('/api/clique', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ time: timeSelecionado, caso: caso })
                    });
                    const data = await response.json();
                    if(data.success) {
                        alert('Sucesso! Registado na planilha.');
                    } else {
                        alert('Erro ao salvar: ' + data.error);
                    }
                } catch (err) {
                    alert('Erro de conexão.');
                }
            }
        </script>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));