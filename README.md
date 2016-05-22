# mastermind
RESTful Mastermind as part 1 of Axion-Zen's challenge at VanHackathon May 2016

## Create a game

### Request

> PUT /games
> {"user":"ensjo"}

No logging-in/authentication method was implemented in this prototype.

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo",null],"colors":8,"slots":8,"status":0,"round":null,"guessed":null,"winners":null}

Status = 0 means the game is still waiting for players to join.

The secret code is created randomly. It's kept in the database, but is not disclosed.

## Get an array of games from the database

So another player can find existing games to join.

### Request

> GET /games

### Response

> [
>   {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo",null],"colors":8,"slots":8,"status":0,"round":null,"guessed":null,"winners":null}
> ]

## Join an existing game

### Request

> PUT /games/57421b518f1f81a401f753f8/players
> {"user":"zjan"}

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo","zjan"],"colors":8,"slots":8,"status":1,"round":1,"guesses":{"zjan":[]},"guessed":{"ensjo":false,"zjan":false},"winners":null}

When all players have joined, the game begins automatically (status = 1) and are allowed to guess.

While the game is ongoing, a player can only see his own guesses.

## Get a game from the database

Players may check this URL periodically to check the game status and if they are allowed to guess.

### Request

> GET /games/57421b518f1f81a401f753f8

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo","zjan"],"colors":8,"slots":8,"status":1,"round":1,"guessed":{"ensjo":false,"zjan":false},"winners":null}

While the game is ongoing, no guesses are not disclosed.

## Make a guess

A guess is provided as an array with integer numbers (0, 1, 2...) representing the different colors.

### Request

> PUT /games/5740bfd93e8709ac800687a7/guesses
> {"user":"ensjo","guess":[0,1,2,3,4,5,6,7]}

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo","zjan"],"colors":8,"slots":8,"status":1,"round":1,"guesses":{"ensjo":[{"guess":[0,1,2,3,4,5,6,7],"feedback":{"correct":2,"misplaced":3}}]},"guessed":{"ensjo":true,"zjan":false},"winners":null}

The user guess is recorded, feedback is calculated. 

## Make a guess (end of round)

When all players have guessed and nobody found the secret code, a new round begins.

### Request

> PUT /games/5740bfd93e8709ac800687a7/guesses
> {"user":"zjan","guess":[7,6,5,4,3,2,1,0]}

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo","zjan"],"colors":8,"slots":8,"status":1,"round":2,"guesses":{"zjan":[{"guess":[7,6,5,4,3,2,1,0],"feedback":{"correct":1,"misplaced":4}}]},"guessed":{"ensjo":false,"zjan":false},"winners":null}

The game proceeds with the players making guesses until one or both of them makes a correct guess.

## Make a guess (end of game)

### Request

> PUT /games/5740bfd93e8709ac800687a7/guesses
> {"user":"zjan","guess":[5,0,1,2,5,0,1,2]}

### Response

> {"_id":"57422c6568c8bba318626b1d","created":"2016-05-22T22:02:13.141Z","creator":"ensjo","players":["ensjo","zjan"],"colors":8,"slots":8,"status":2,"round":3,"guesses":{"ensjo":[{"guess":[0,1,2,3,4,5,6,7],"feedback":{"correct":2,"misplaced":3}},{"guess":[4,5,6,7,4,5,6,7],"feedback":{"correct":0,"misplaced":2}},{"guess":[5,0,2,3,5,0,1,2],"feedback":{"correct":8,"misplaced":0}}],"zjan":[{"guess":[7,6,5,4,3,2,1,0],"feedback":{"correct":1,"misplaced":4}},{"guess":[0,1,2,3,0,1,2,3],"feedback":{"correct":2,"misplaced":4}},{"guess":[5,0,1,2,5,0,1,2],"feedback":{"correct":6,"misplaced":1}}]},"guessed":{"ensjo":true,"zjan":true},"winners":["ensjo"]}

The game ends (status = 2), the winner(s) is announced and all the guesses are disclosed.
