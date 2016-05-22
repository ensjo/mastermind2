var express = require('express');
var router = express.Router()

// Game fixed setup. (May eventually be configurable.)
var NUMBER_OF_PLAYERS = 2;
var NUMBER_OF_COLORS = 8;
var NUMBER_OF_SLOTS = 8;

// Game statuses.
var STATUS_WAITINGP2 = 0;
var STATUS_ONGOING = 1;
var STATUS_FINISHED = 2;

var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/mastermind2';
var db;
var game;

function newFilledArray(length, value) {
  var arr = new Array(length);
  for (var i = 0; i < length; i++) {
    arr[i] = value;
  }
  return arr;
}

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
    if (err) { db.close(); console.log(err.message); res.status(500).send(err.message); return }
    
    for (var i = 0; i < docs.length; i++) {
      delete docs[i].secret; // Don't disclose secret.
      delete docs[i].guesses; // Don't disclose guesses.
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
    res.status(400).send('Bad Request\nBad user name ' + req.body.user + '.');
    return;
  }

  // New game.
  game = {
    created: new Date(),
    creator: req.body.user,
    players: newFilledArray(NUMBER_OF_PLAYERS, null),
    colors: NUMBER_OF_COLORS,
    slots: NUMBER_OF_SLOTS,
    secret: new Array(NUMBER_OF_SLOTS),
    status: STATUS_WAITINGP2,
    round: null,
    guesses: null,
    guessed: null,
    winners: null
  };
  
  game.players[0] = req.body.user;
  
  // Generate secret.
  for (var i = 0; i < game.slots; i++) {
    game.secret[i] = Math.floor(Math.random() * game.colors);
  }

  // Insert data in database.
  db.collection('games').insertOne(
    game,
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message); return }
      
      db.close();
      // Return game data.
      game = r.ops[0];
      delete game.secret; // Don't disclose secret.
      delete game.guesses; // Don't disclose guesses.
      res.send(game);
    }
  );
});

/* Find game specified in URL. */
router.use(/^\/([a-f0-9]{24})(\/.*)?$/, function(req, res, next) {
  db.collection('games').findOne({_id: new ObjectID(req.params[0])}, function(err, doc) {
    if (err) { db.close(); console.log(err.message); res.status(500).send(err.message) ; return }
    if (!doc) { res.status(404).send('Game not found.'); return }

    game = doc;
    next();
  })
});

/* Get game data. */
router.get('/:_id', function(req, res) {
  db.close();
  delete game.secret; // Don't disclose secret.
  if (game.status == STATUS_ONGOING) {
    delete game.guesses; // Don't disclose guesses while game is ongoing.
  }
  
  // Avoid HTTP caching.
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
  res.setHeader("Pragma", "no-cache"); // HTTP 1.0.
  res.setHeader("Expires", "0"); // Proxies.
  
  res.send(game);
});

/* Join player, start game. */
router.put('/:_id/players', function(req, res) {
  // Check request data for errors.
  if (
    (typeof req.body.user != 'string') ||
    (!(/^\w+$/.test(req.body.user)))
  ) {
    db.close(); res.status(400).send('Bad Request\nBad user name ' + req.body.user + '.'); return;
  }
  
  // Player 2 can only join before the game starts.
  if (game.status != STATUS_WAITINGP2) {
    db.close(); res.status(403).send('Forbidden\nGame already started.'); return;
  }
  
  // A player cannot join twice.
  if (game.players.indexOf(req.body.user) != -1) {
    db.close(); res.status(403).send('Forbidden\n' + req.body.user + ' already joined.'); return;
  }
  
  // Add player to game.
  game.players[game.players.indexOf(null)] = req.body.user;
  
  // Start game if all players joined.
  if (game.players.indexOf(null) == -1) {
    game.status = STATUS_ONGOING;
    game.round = 1; // First round.
    game.guesses = {};
    game.guessed = {};
    for (var i = 0; i < game.players.length; i++) {
      var player = game.players[i];
      game.guesses[player] = [];
      game.guessed[player] = false;
    }
  }
  
  // Update game in database.
  db.collection('games').updateOne(
    { _id: new ObjectID(game._id) },
    { $set: {
      players: game.players,
      status: game.status,
      round: game.round,
      guesses: game.guesses,
      guessed: game.guessed
    }},
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message); return }
      if (!r.result.ok) { db.close(); res.status(500).send('Update error.') ; return }
      
      db.close();
      // Return game data.
      delete game.secret; // Don't disclose secret.
      if (game.status == STATUS_ONGOING) { // If game is ongoing, don't disclose other players' guesses.
        for (var player in game.guesses) {
          if (player != req.body.user) {
            delete game.guesses[player];
          }
        }
      }
      res.send(game);
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
    db.close(); res.status(400).send('Bad Request\nBad user name ' + req.body.user + '.'); return;
  }
  
  if (
    (typeof req.body.guess != 'object') ||
    (req.body.guess.constructor != Array) ||
    (req.body.guess.length != game.slots) ||
    (!req.body.guess.every(function(color) {
      return (typeof color == 'number') && (color == Math.floor(color)) && (color >= 0) && (color < game.colors)
    }))
  ) {
    db.close(); res.status(400).send('Bad Request\nBad guess ' + req.body.guess + '.'); return;
  }

  // Players can only guess while the game is ongoing.
  if (game.status != STATUS_ONGOING) {
    db.close(); res.status(403).send('Forbidden\nGame is not ongoing.'); return;
  }

  // Only previously joined players can guess.
  if (game.players.indexOf(req.body.user) == -1) {
    db.close(); res.status(403).send('Forbidden\n' + req.body.user + ' not joined.'); return;
  }

  // A player can only guess once per round.
  if (game.guessed[req.body.user]) {
    db.close(); res.status(403).send('Forbidden\n' + req.body.user + ' has already guessed in the current round.'); return;
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
  game.guesses[req.body.user][game.round - 1] = {
    guess: req.body.guess,
    feedback: feedback
  };
  game.guessed[req.body.user] = true;
  
  // End of round if all players have guessed.
  if (game.players.every(function(player) { return game.guessed[player] })) {
    // Check for winning players.
    for (var i = 0; i < game.players.length; i++) {
      var player = game.players[i];
      if (game.guesses[player][game.round - 1].feedback.correct == game.slots) {
        game.status = STATUS_FINISHED;
        (game.winners = game.winners || []).push(player);
      }
    }
    // No victory yet, set up next round.
    if (game.status != STATUS_FINISHED) {
      game.round++;
      for (var player in game.guessed) {
        game.guessed[player] = false;
      }
    }
  }

  // Update game in database.
  db.collection('games').updateOne(
    { _id: new ObjectID(game._id) },
    { $set: {
      status: game.status,
      round: game.round,
      guesses: game.guesses,
      guessed: game.guessed,
      winners: game.winners
    }},
    function(err, r) {
      if (err) { db.close(); console.log(err.message); res.status(500).send(err.message); return }
      if (!r.result.ok) { db.close(); res.status(500).send('Update error.'); return }
      
      // Return game data.
      db.close();
      delete game.secret; // Don't disclose secret.
      if (game.status == STATUS_ONGOING) { // If game is ongoing, don't disclose other players' guesses.
        for (var player in game.guesses) {
          if (player != req.body.user) {
            delete game.guesses[player];
          }
        }
      }
      res.send(game);
    }
  );
});

module.exports = router;