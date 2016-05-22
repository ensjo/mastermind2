# mastermind
RESTful Mastermind as part 1 of Axion-Zen's challenge at VanHackathon May 2016

## Create a game

### Request

> PUT /games
> {"user":"ensjo"}

No logging-in/authentication method was implemented in this prototype.

### Response

> {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo"],"status":0,"turn":0,"guesses":[],"winner":""}

Status = 0 means the game is still waiting for Player 2.

The secret code is created randomly. It's kept in the database, but is not disclosed.

## Get an array of games from the database

So another player can find existing games to join.

### Request

> GET /games

### Response

> [
>  {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo"],"status":0,"turn":0,"guesses":[],"winner":""}
> ]

## Join a game as Player 2

### Request

> PUT /games/5740bfd93e8709ac800687a7/players
> {"user":"zjan"}

### Response

> {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo","zjan"],"status":1,"turn":1,"guesses":[],"winner":""}

Game begins automatically (status = 1), and it's Player 1's turn (turn = 1).

## Get a game from the database

Player 1 must check this periodically to know when his game has started (status = 1). Both players can know when their turn has arrived.

### Request

> GET /games/5740bfd93e8709ac800687a7

### Response

> {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo","zjan"],"status":1,"turn":1,"guesses":[],"winner":""}

## Make a guess

A guess is provided as an array with integer numbers (0, 1, 2...) representing the different colors.

### Request

> PUT /games/5740bfd93e8709ac800687a7/guesses
> {"user":"ensjo","guess":[0,1,2,3,4,5,6,7]}

### Response

> {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo","zjan"],"status":1,"turn":2,"guesses":[{"player":"ensjo","guess":[0,1,2,3,4,5,6,7],"feedback":{"correct":3,"misplaced":3}}],"winner":""}

The user guess is recorded, feedback is calculated (correct = 3, misplaced = 3). Since the secret wasn't found yet, the turn passes to the other player (turn = 2).

The game proceeds with the players making guesses and switching turns until one of them makes a correct guess.

## Make a (correct) guess

### Request

> PUT /games/5740bfd93e8709ac800687a7/guesses
> {"user":"zjan","guess":[5,1,6,7,2,4,6,7]}

### Response

> {"_id":"5740bfd93e8709ac800687a7","created":"2016-05-21T20:06:49.184Z","creator":"ensjo","colors":8,"slots":8,"players":["ensjo","zjan"],"status":2,"turn":2,"guesses":[{"player":"ensjo","guess":[0,1,2,3,4,5,6,7],"feedback":{"correct":3,"misplaced":3}},{"player":"zjan","guess":[7,6,5,4,3,2,1,0],"feedback":{"correct":0,"misplaced":6}},{"player":"ensjo","guess":[0,1,2,3,0,1,2,3],"feedback":{"correct":1,"misplaced":1}},{"player":"zjan","guess":[4,5,6,7,4,5,6,7],"feedback":{"correct":4,"misplaced":2}},{"player":"ensjo","guess":[4,5,6,7,0,1,2,3],"feedback":{"correct":2,"misplaced":4}},{"player":"zjan","guess":[0,5,6,7,4,5,6,7],"feedback":{"correct":4,"misplaced":2}},{"player":"ensjo","guess":[4,1,6,7,4,5,6,7],"feedback":{"correct":5,"misplaced":2}},{"player":"zjan","guess":[4,1,2,7,4,5,6,7],"feedback":{"correct":4,"misplaced":3}},{"player":"ensjo","guess":[4,1,6,3,4,5,6,7],"feedback":{"correct":4,"misplaced":2}},{"player":"zjan","guess":[2,1,6,7,4,5,6,7],"feedback":{"correct":5,"misplaced":3}},{"player":"ensjo","guess":[4,1,6,7,5,2,6,7],"feedback":{"correct":5,"misplaced":3}},{"player":"zjan","guess":[5,1,6,7,2,4,6,7],"feedback":{"correct":8,"misplaced":0}}],"winner":"zjan"}

The game ends (status = 2), the winner is set.
