const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2");


const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "spotify_clone",
});

db.connect((err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données:", err);
    return;
  }
  console.log("Connecté à la base de données MySQL");
});

// Route d'inscription
app.post("/register", (req, res) => {
  const { email, password, name, day, month, year } = req.body;

  if (!email || !password || !name || !day || !month || !year) {
    return res.status(400).send("Tous les champs sont requis");
  }

  const date_of_birth = `${year}-${month}-${day}`;

  const query =
    "INSERT INTO users (email, password, name, date_of_birth) VALUES (?, ?, ?, ?)";
  db.query(query, [email, password, name, date_of_birth], (err, results) => {
    if (err) {
      return res.status(500).send("Erreur du serveur");
    }

    return res.status(201).send("Inscription réussie");
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email et mot de passe requis");
  }

  const query = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(query, [email, password], (err, results) => {
    if (err) {
      return res.status(500).send("Erreur du serveur");
    }

    if (results.length > 0) {
      const user = results[0];
      return res.status(200).json({ user });
    } else {
      return res.status(401).send("Email ou mot de passe incorrect");
    }
  });
});

app.post("/add-song", (req, res) => {
  const { title, duration, filePath, albumId, userId } = req.body;

  if (!title || !duration || !filePath || !userId) {
    return res.status(400).send("Tous les champs sont requis");
  }

  // Start a transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).send("Erreur lors de la transaction");
    }

    // Insert the song into the songs table
    const insertSongQuery = "INSERT INTO songs (title, duration, file_path, album_id) VALUES (?, ?, ?, ?)";
    db.query(insertSongQuery, [title, duration, filePath, albumId], (err, results) => {
      if (err) {
        return db.rollback(() => res.status(500).send("Erreur lors de l'ajout de la chanson"));
      }

      const songId = results.insertId;

      // Check if the default playlist exists for the user
      const checkPlaylistQuery = "SELECT playlist_id FROM playlists WHERE user_id = ? AND title = 'Default Playlist'";
      db.query(checkPlaylistQuery, [userId], (err, results) => {
        if (err) {
          return db.rollback(() => res.status(500).send("Erreur lors de la vérification de la playlist"));
        }

        let playlistId;
        if (results.length === 0) {
          // Create the default playlist
          const createPlaylistQuery = "INSERT INTO playlists (user_id, title) VALUES (?, 'Default Playlist')";
          db.query(createPlaylistQuery, [userId], (err, results) => {
            if (err) {
              return db.rollback(() => res.status(500).send("Erreur lors de la création de la playlist"));
            }
            playlistId = results.insertId;

            // Insert the song into the playlist_songs table
            const insertPlaylistSongQuery = "INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)";
            db.query(insertPlaylistSongQuery, [playlistId, songId], (err) => {
              if (err) {
                return db.rollback(() => res.status(500).send("Erreur lors de l'ajout de la chanson à la playlist"));
              }

              db.commit((err) => {
                if (err) {
                  return db.rollback(() => res.status(500).send("Erreur lors de la validation de la transaction"));
                }
                res.status(201).send("Chanson ajoutée avec succès à la playlist");
              });
            });
          });
        } else {
          playlistId = results[0].playlist_id;

          // Insert the song into the existing playlist
          const insertPlaylistSongQuery = "INSERT INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)";
          db.query(insertPlaylistSongQuery, [playlistId, songId], (err) => {
            if (err) {
              return db.rollback(() => res.status(500).send("Erreur lors de l'ajout de la chanson à la playlist"));
            }

            db.commit((err) => {
              if (err) {
                return db.rollback(() => res.status(500).send("Erreur lors de la validation de la transaction"));
              }
              res.status(201).send("Chanson ajoutée avec succès à la playlist");
            });
          });
        }
      });
    });
  });
});


app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});
