const express = require('express')
const axios = require('axios')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
require ('dotenv').config()

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const {DB_USER, DB_PASSWORD, DB_HOST, DB_DATABASE} = process.env

const connection = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    database: DB_DATABASE,
    password: DB_PASSWORD
})


app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const accessToken = 'frJtfwENcaspvK4tGQapRVAg6oL6RLsBej2iP7D5ndXmBRtlLe';

axios.get('https://api.deezer.com/user/me/tracks', {
  headers: {
    Authorization: `Bearer ${accessToken}`
  }
})
  .then(response => {
    const favoritos = response.data.data;
    // Faça o processamento necessário com os favoritos do usuário
  })
  .catch(error => {
    console.error('Erro ao buscar os favoritos:', error);
    // Lide com o erro adequadamente
  });



const deezerClientId = process.env.DEEZER_CLIENT_ID;
const deezerClientSecret = process.env.DEEZER_CLIENT_SECRET;
const deezerRedirectUri = process.env.DEEZER_REDIRECT_URI;

app.post('/favoritos', async (req, res) => {
  const { musicaId, usuarioId } = req.body;

  // Verifica se o ID da música e do usuário são fornecidos
  if (!musicaId || !usuarioId) {
    res.status(400).json({ error: 'ID da música ou ID do usuário inválidos' });
    return;
  }

  // Insere a música nos favoritos do usuário
  connection.query('INSERT INTO favoritos (usuario_id, musicaId) VALUES (?, ?)', [usuarioId, musicaId], (error, results) => {
    if (error) {
      console.error('Erro ao inserir no banco de dados:', error);
      res.status(500).json({ error: 'Erro ao adicionar aos favoritos' });
    } else {
      res.status(200).json({ message: 'Música adicionada aos favoritos com sucesso' });
    }
  });
});

app.get('/favoritos/:user', async (req, res) => {
  const user = req.params.user;

  // Execute uma consulta SQL para buscar os favoritos do usuário no banco de dados
  connection.query('SELECT * FROM favoritos WHERE usuario_id = (SELECT id FROM usuarios WHERE user = ?)', [user], async (error, results) => {
    if (error) {
      console.error('Erro ao consultar o banco de dados:', error);
      res.status(500).json({ error: 'Erro ao buscar os favoritos' });
      return;
    }

    const musicas = [];

    for (const row of results) {
      const musicaId = row.musicaId;

      // Faz uma solicitação GET para buscar os detalhes da música na API do Deezer
      const response = await axios.get(`https://api.deezer.com/track/${musicaId}`);
      musicas.push(response.data);
    }

    res.status(200).json(musicas);
  });
});



app.get('/favoritos', (req, res) => {
  // Execute uma consulta SQL para buscar os favoritos no banco de dados
  connection.query('SELECT * FROM favoritos', (error, results) => {
    if (error) {
      console.error('Erro ao consultar o banco de dados:', error);
      res.status(500).json({ error: 'Erro ao buscar os favoritos' });
    } else {
      res.status(200).json(results);
    }
  });
});


app.get('/usuarios/:user', (req, res) => {
  const user = req.params.user;

  // Execute uma consulta SQL para obter o ID do usuário do banco de dados
  connection.query('SELECT id FROM usuarios WHERE user = ?', [user], (error, results) => {
    if (error) {
      console.error('Erro ao consultar o banco de dados:', error);
      res.status(500).json({ error: 'Erro ao buscar o ID do usuário' });
    } else {
      if (results.length > 0) {
        const usuarioId = results[0].id;
        res.status(200).json({ usuarioId });
      } else {
        res.status(404).json({ error: 'Usuário não encontrado' });
      }
    }
  });
});


/* app.get('/favoritos/deezer', async (req, res) => {
    try {
      const { user } = req.query; // Obtém o parâmetro de consulta "user" da URL
  
      // Verifica se o parâmetro "user" foi fornecido
      if (!user) {
        res.status(400).json({ error: 'Parâmetro "user" inválido' });
        return;
      }
  
      const resultados = [];
      for (const usuario of bd) {
        if (usuario.user === user) {
          for (const musica of usuario.favoritos) {
            const musicaId = musica.id;
            const response = await axios.get(`https://api.deezer.com/track/${musicaId}`);
            const musicaDetalhes = response.data;
            resultados.push(musicaDetalhes);
          }
        }
      }
      res.status(200).json(resultados);
    } catch (error) {
      console.error('Erro ao pesquisar músicas na API da Deezer:', error);
      res.status(500).json({ error: 'Erro ao pesquisar músicas na API da Deezer' });
    }
}); */


app.get('/favoritos/deezer', async (req, res) => {
  try {
    const { user } = req.query;

    if (!user) {
      res.status(400).json({ error: 'Parâmetro "user" inválido' });
      return;
    }

    connection.query('SELECT id, accessToken FROM usuarios WHERE user = ?', [user], async (error, results) => {
      if (error) {
        console.error('Erro ao consultar o banco de dados:', error);
        res.status(500).json({ error: 'Erro ao buscar o ID do usuário' });
        return;
      }

      if (results.length === 0) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      const usuarioId = results[0].id;
      const accessToken = results[0].accessToken;

      connection.query('SELECT musicaId FROM favoritos WHERE usuario_id = ?', [usuarioId], async (error, results) => {
        if (error) {
          console.error('Erro ao consultar o banco de dados:', error);
          res.status(500).json({ error: 'Erro ao buscar as músicas favoritas' });
          return;
        }

        const musicas = [];

        for (const row of results) {
          const musicaId = row.musicaId;

          const response = await axios.get(`https://api.deezer.com/track/${musicaId}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          musicas.push(response.data);
        }

        res.status(200).json(musicas);
      });
    });
  } catch (error) {
    console.error('Erro ao pesquisar músicas na API da Deezer:', error);
    res.status(500).json({ error: 'Erro ao pesquisar músicas na API da Deezer' });
  }
});



app.get('/auth', (req, res) => {
  const scopes = 'offline_access';
  res.redirect(`http://localhost:3000/favoritos?code=fr92f0a1cdc4e7c297adf0b1a5affeab`);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const response = await axios.get(`https://connect.deezer.com/oauth/access_token.php?app_id=${deezerClientId}&secret=${deezerClientSecret}&code=${code}`);
    const accessToken = response.data.replace('access_token=', '').split('&')[0];
    res.send(`Access Token: ${accessToken}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error getting access token');
  }
});


app.get('/favoritos/deezer', async (req, res) => {
  try {
    const { user } = req.query; // Obtém o parâmetro de consulta "user" da URL

    // Verifica se o parâmetro "user" foi fornecido
    if (!user) {
      res.status(400).json({ error: 'Parâmetro "user" inválido' });
      return;
    }

    // Execute uma consulta SQL para buscar o ID do usuário no banco de dados
    connection.query('SELECT id, accessToken FROM usuarios WHERE user = ?', [user], async (error, results) => {
      if (error) {
        console.error('Erro ao consultar o banco de dados:', error);
        res.status(500).json({ error: 'Erro ao buscar o ID do usuário' });
        return;
      }

      if (results.length === 0) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      const usuarioId = results[0].id;
      const accessToken = results[0].accessToken;

      // Execute uma consulta SQL para buscar os IDs das músicas favoritas do usuário
      connection.query('SELECT musicaId FROM favoritos WHERE usuario_id = ?', [usuarioId], async (error, results) => {
        if (error) {
          console.error('Erro ao consultar o banco de dados:', error);
          res.status(500).json({ error: 'Erro ao buscar as músicas favoritas' });
          return;
        }

        const musicas = [];

        for (const row of results) {
          const musicaId = row.musicaId;

          // Faz uma solicitação GET para buscar os detalhes da música na API do Deezer, incluindo o token de acesso nos cabeçalhos
          const response = await axios.get(`https://api.deezer.com/track/${musicaId}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          musicas.push(response.data);
        }

        res.status(200).json(musicas);
      });
    });
  } catch (error) {
    console.error('Erro ao pesquisar músicas na API da Deezer:', error);
    res.status(500).json({ error: 'Erro ao pesquisar músicas na API da Deezer' });
  }
});




app.listen(4000, ()=>{
    console.log("Favoritos. Porta 4000")
})
