const express = require('express');
const { JWT } = require('google-auth-library');

const app = express();
app.use(express.json());

const SPREADSHEET_ID = '1JUJ-Kl-SSVtFf0Nj8OrQv90eJjc-wvxJGSeowXr2B5E';
const CLIENT_EMAIL = 'robo-contador@contador-render.iam.gserviceaccount.com';

// Montando a chave como uma array para garantir que as quebras de linha funcionem perfeitamente em qualquer servidor
const PRIVATE_KEY = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDInI56R26o3M5Z',
  'aGkSF+cH5a1LOboWR4AMBEG4tWyzjOxvSQ95oUWJw2vSa4+rp/UBJ8Op7JB6xd9Z',
  'YyxdMVm160LTPQ6En+vZabIDMWEQbzmNh1RE8OjGO57MX5NV4CPyr6DGN6w+lFw8',
  'Sz96EUAzWj4pMJ3sy8+b3o1L+YVfRU1ZX5wjOKmsY9pLV9vKz+8dkuLRjLFlQuo+',
  'TP1iQp3V5ZQ8wQ4/derWO74/A7tfJnIZ0Av54+7T2QjOnYEw9Wz0u6ueeCbjcV09',
  'z+PEk54xZJweIZfTurmFrcfSl77j6sa8pYhHaLKfbooL4klpWOzcoUwaOGz6exuE',
  'rwUscZ45AgMBAAECggEAAMJ4VvsymT4YzprdcahDLjL5ndl5RxX8j08W0Um9QHgj',
  'Tw/nmJjP6BkkLTb4uM2D2SjFjhJWFmOYbcC5OB3J5AKg4qbjtASHrUTqsSYR4tuL',
  'oWm78R+OahhrXgUV9uhzNRCNhc1L1YLUpJUjsjp4KURJYaOMUuC6B7I8i7yapi/d',
  'xp5FhZePwql5GrSyDSXBCLxhhMwDI89bHZAiBsahcQsz+QcPBgKlGbdpAAkbvRwl',
  'JY4RdmnJjmeYUUAZ00IGetQE/W2DiZ5VvJsSBoM9/9nTIEtXPCd/gIPBUeDVi2Bn',
  'HIPYBVszQ9MSTKSzbccdAif21zU4EoHdryu34VLEmQKBgQDvDS9mh0jGotlpyvpb',
  'pFveHxJDj8xcQ9dJuwo/YMrgKbmwl4nOdTSFIghup8G0LqSTW9j2n9Kochh3ibWo',
  'S3hcn6EIr7cmcLXNq+RIAxokXbSWIb/+pqGMvTVGF9WEqnVKQwwoEpl+N+VldrhG',
  'x+w8jE25HP/kKtmp2rhBkT8PZQKBgQDW1a5ufGNnBNRv+RfGzWx8dZBZRVRtYj3M',
  'nnBsbSNPXdCVWxVV0rCqWrJ/q5beD9J/dVQomOEiqwug5vuL0jO2aXo+QEzLafNYD',
  '2qw0K3MaI6SzKn3vqSlYyIye/dLP7YV851XFb+VuJYMraPp73IYuvxNy1UWn3k7k',
  'pUAf420YRQKBgQDZH0uvPy79o8n/CepNNEJwxB3tmX1PTBsNj8HmAL8jzSIoX+s9',
  'xzy1s0yfXOVWB4tZgHHWxyEp9797S2vgePPQhPhZkGe0lWi7buW/9nlXEHlGZ08g',
  'Ny7CStRJXrqDbeNsWOuAtiwN9Sz49FS5jTpnYDPz74AIOFdMrCjw/MCe9QKBgQCu',
  'tg3qGkx4biwZd7iHW24bdTxT7Rbw8dESQe2lbb+h2vm2rDqH7K+h43cV/4UT0e/k',
  'fpEHbgRioqlatMs7WBSu0rHr2EEmABnH/qDGuIMdwdjiP+805RwT8NyzO/aiVCaX',
  '4kYVj59EyUr4FaKG8ltJTukRHTJNh3Qfa+hPRpPlBQKBgBlYCy+uhfHDBMyy69VX',
  '3HtqLkzmkJN1DqjGnreMn5JVCoWLeRhyLlOpfUv/PaUVy+uYwWhfpQ4tQa/Yi5kL',
  '4YUNBjBnV+1UllJ+YQBBDKW8mcq7ptyHMKeCIQU5xiE2XfMAnYjdFCLJMYoBKIY9',
  'BKWqX8rJBNE7qtOOoom0umFZ',
  '-----END PRIVATE KEY-----'
].join('\n');

// Configuração de autenticação direta com o Google
const auth = new JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.post('/api/clique', async (req, res) => {
  try {
    const { time, caso } = req.body;

    const authHeaders = await auth.getRequestHeaders();
    const token = authHeaders.Authorization;

    // 1. Busca os dados da planilha via API do Google
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

    // 2. Salva o novo valor somando +1 na coluna C
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
