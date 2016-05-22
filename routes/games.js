var express = require('express');
var router = express.Router()

// Game statuses.
var STATUS_WAITINGP2 = 0;
var STATUS_ONGOING = 1;
var STATUS_FINISHED = 2;

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/mastermind';
var db;
var game;

/* Connect to database. */
router.use(function(req, res, next) {
  MongoClient.connect(url, function(err, database) {
    if (err) { res.status(500).send(err.message) ; return }
    
    db = database;
    next();
  });
});

/* Get games list. */
router.get('/', function(req, res) {
  db.collection("games").find({}).toArray(function (err, docs){
    for (var i = 0; i < docs.length; i++) {
      delete docs[i].secret; // Don't disclose secret.
    }
  
    db.close();

    // Avoid HTTP caching.
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
    res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
    res.setHeader("Expires", "0"); // Proxies.
  
    res.send(docs);
  });
});

/* Create game. */
router.put('/', function(req, res) {
  // Check request data for errors.
  if (
    (typeof req.body.user != 'string') ||
    (!(/^\w+$/.test(req.body.user)))
  ) {
    res.status(400).send('Bad Request\nBad user name ' + req.body.user);
    return;
  }

  // New game.
  game = {
    created: new Date(),
    creator: req.body.user,
    colors: 8,
    slots: 8,
    players: [req.body.user],
    secret: [],
    status: STATUS_WAITINGP2,
    turn: 0,
    guesses: [],
    winner: ""
  };
  for (var i = 0; i < game.slots; i++) {
    game.secret[i] = Math.floor(Math.random() * game.colors);
  }

  // Insert data in database.
  db.collection('games').insertOne(
    game,
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message) ; return }
      
      // Return game data.
      game = r.ops[0];
      delete game.secret; // Don't disclose secret.
      res.send(game);
      db.close();
    }
  );
});

/* Find game specified in URL. */
router.use(/^\/([a-f0-9]{24})(\/.*)?$/, function(req, res, next) {
  db.collection('games').findOne({_id: new ObjectID(req.params[0])}, function(err, doc) {
    if (err) { db.close(); console.log(err.message); res.status(500).send(err.message) ; return }
    if (!doc) { res.status(404).send(); return }

    game = doc;
    next();
  })
});

/* Get game data. */
router.get('/:_id', function(req, res) {
  db.close();
  delete game.secret; // Don't disclose secret.
  
  // Avoid HTTP caching.
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.
  
  res.send(game);
});

/* Join Player 2, start game. */
router.put('/:_id/players', function(req, res) {
  // Check request data for errors.
  if (
    (typeof req.body.user != 'string') ||
    (!(/^\w+$/.test(req.body.user)))
  ) {
    db.close();
    res.status(400).send('Bad Request\nBad user name ' + req.body.user);
    return;
  }
  
  // Player 2 can only join before the game starts.
  if (game.status != STATUS_WAITINGP2) {
    db.close();
    res.status(403).send('Forbidden\nGame already started.');
    return;
  }
  
  // A player cannot join twice.
  if (game.players.indexOf(req.body.user) != -1) {
    db.close();
    res.status(403).send('Forbidden\n' + req.body.user + ' already joined.');
    return;
  }
  
  // Add player to game.
  game.players.push(req.body.user);
  
  // Start game.
  game.status = STATUS_ONGOING;
  game.turn = 1;
  
  // Update game in database.
  db.collection('games').updateOne(
    { _id: new ObjectID(game._id) },
    { $set: { players: game.players, status: game.status, turn: game.turn } },
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message) ; return; }
      if (!r.result.ok) { db.close(); res.status(500).send('Update error') ; return }
      
      // Return game data.
      delete game.secret; // Don't disclose secret.
      res.send(game);
      db.close();
    }
  );
});

/* Receive guesses. */
router.put('/:_id/guesses', function(req, res) {
  // Check request data for errors.
  if (
    (typeof req.body.user != 'string') ||
    (!(/^\w+$/.test(req.body.user)))
  ) {
    db.close();
    res.status(400).send('Bad Request\nBad user name ' + req.body.user);
    return;
  }
  
  if (
    (typeof req.body.guess != 'object') ||
    (req.body.guess.constructor != Array) ||
    (req.body.guess.length != game.slots) ||
    (!req.body.guess.every(function(color) {
      return (color == Math.floor(color)) && (color >= 0) && (color < game.colors)
    }))
  ) {
    db.close();
    res.status(400).send('Bad Request\nBad guess ' + req.body.guess);
    return;
  }

  // Players can only guess while the game is ongoing.
  if (game.status != STATUS_ONGOING) {
    db.close();
    res.status(403).send('Forbidden\nGame is not ongoing.');
    return;
  }

  // Only previously joined players can guess.
  if (game.players.indexOf(req.body.user) == -1) {
    db.close();
    res.status(403).send('Forbidden\n' + req.body.user + ' not joined.');
    return;
  }

  // A player can only guess in his own turn.
  if (req.body.user != game.players[game.turn - 1]) {
    db.close();
    res.status(403).send('Forbidden\nNot ' + req.body.user + '\'s turn.');
    return;
  }

  // Calculate feedback.
  var feedback = { correct: 0, misplaced: 0 };
  var analysis = new Array(game.slots);
  for (var i = 0; i < game.slots; i++) {
    if (req.body.guess[i] == game.secret[i]) {
      feedback.correct++;
      analysis[i] = 1;
    } else {
      analysis[i] = 0;
    }
  }
  for (var i = 0; i < game.slots; i++) {
    if (analysis[i] != 1) {
      for (var j = 0; j < game.slots; j++) {
        if ((analysis[j] == 0) && (req.body.guess[i] == game.secret[j])) {
          feedback.misplaced++;
          analysis[j] = 2;
          break;
        }
      }
    }
  }
  
  // Record guess.
  game.guesses.push({
    player: req.body.user,
    guess: req.body.guess,
    feedback: feedback
  });
  
  // Check for victory.
  if (feedback.correct == game.slots) {
    game.status = STATUS_FINISHED;
    game.winner = req.body.user;
  } else {
    game.turn = (game.turn == 1 ? 2 : 1);
  }

  // Update game in database.
  db.collection('games').updateOne(
    { _id: new ObjectID(game._id) },
    { $set: { guesses: game.guesses, status: game.status, winner: game.winner, turn: game.turn } },
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message) ; return; }
      if (!r.result.ok) { db.close(); res.status(500).send('Update error') ; return; }
      
      // Return game data.
      db.close();
      delete game.secret; // Don't disclose secret.
      res.send(game);
    }
  );
});

module.exports = router;