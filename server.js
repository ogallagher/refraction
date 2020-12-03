/*

Owen Gallagher
28 Nov 2020

*/

// external imports

const express = require('express')
const fs = require('fs')
const bodyparser = require('body-parser')

// frontend imports

const Logger = require('./public/js/logger.js').Logger

// constants

const DB_DIR_PATH = 'db'
const CURR_GAMES_DIR_PATH = `${DB_DIR_PATH}/current_games`
const OLD_GAMES_DIR_PATH = `${DB_DIR_PATH}/old_games`
const ACCOUNTS_DIR_PATH = `${DB_DIR_PATH}/accounts`

const GAME_RESULT_UNKNOWN = 0
const GAME_RESULT_WIN = 1
const GAME_RESULT_LOSS = 2
const GAME_RESULT_TIE = 3

// create logger

log = new Logger('server', Logger.LEVEL_DEBUG)

// configure environment variables
process.env.PORT = 80
process.env.PUBLIC_DIR_PATH = 'public'

if (require('dotenv').config().error) {
	log.warning('environment variables not loaded from .env; using defaults')
}
else {
	log.info('environment variables loaded from .env')
}

log.debug(`PORT = ${process.env.PORT}`)
log.debug(`PUBLIC_DIR_PATH = ${process.env.PUBLIC_DIR_PATH}`)

// configure web server

const server = express()
server.set('port', process.env.PORT)

server.use(bodyparser.json({
	limit: '500mb'
}))
server.use(bodyparser.urlencoded({
	limit: '500mb',
	extended: true,
	parameterLimit: 1000000
}))

server.use(express.static(process.env.PUBLIC_DIR_PATH))

// init filesystem

if (!fs.existsSync(DB_DIR_PATH)) {
	log.warning(`db folder ${DB_DIR_PATH} not found`)
	
	// create db dir
	fs.mkdirSync(DB_DIR_PATH)
	log.info('created empty db folder')
}
else {
	log.debug(`found db folder`)
}

if (!fs.existsSync(CURR_GAMES_DIR_PATH)) {
	log.warning(`current games folder ${CURR_GAMES_DIR_PATH} not found`)
	
	// create current_games dir
	fs.mkdirSync(CURR_GAMES_DIR_PATH)
	log.info('created empty current games folder')
}

if (!fs.existsSync(OLD_GAMES_DIR_PATH)) {
	log.warning(`old games folder ${OLD_GAMES_DIR_PATH} not found`)
	
	// create old_games dir
	fs.mkdirSync(OLD_GAMES_DIR_PATH)
	log.info('created empty old games folder')
}

if (!fs.existsSync(ACCOUNTS_DIR_PATH)) {
	log.warning(`accounts folder ${ACCOUNTS_DIR_PATH} not found`)
	
	// create accounts dir
	fs.mkdirSync(ACCOUNTS_DIR_PATH)
	log.info('created empty accounts folder')
}

// launch web server

server.listen(server.get('port'), function() {
	log.info(`server listening on port ${server.get('port')}`,'on_start')
})

server.all('/account', function(req,res,next) {
	let ctx = 'account'
	log.debug(`account action for ${req.query.username}`, ctx)
	next()
})

server.route('/account/login')
.get(function(req,res) {
	let ctx = 'account.login'
	let username = req.query.username
	
	log.info(`logging in ${username}`,ctx)
	
	let account_f = `${ACCOUNTS_DIR_PATH}/${username}.json`
	
	if (fs.existsSync(account_f)) {
		// login
		fs.readFile(account_f, function(err,account_str) {
			let result = {
				action: 'login',
				account: null,
				result: null
			}
			
			if (err) {
				result.result = 'fail'
			}
			else {
				result.account = JSON.parse(account_str)
				result.result = 'pass'
			}
			
			res.json(result)
		})
	}
	else {
		// register
		log.info(`creating new user ${username}`,ctx)
		
		let account = {
			username: username,
			password: 'password',
			current_games: [],
			old_games: []
		}
		fs.writeFile(account_f, JSON.stringify(account), function(err) {
			let result = {
				action: 'register',
				result: null
			}
			
			if (err) {
				log.error(`failed to create new user ${username}`,ctx)
				log.error(err.message)
				result.result = 'fail'
			}
			else {
				log.info(`new user ${username} creation success`,ctx)
				result.result = 'pass'
			}
			
			res.json(result)
		})
	}
})

server.route('/account/old_games')
.get(function(req,res) {
	let ctx = 'account.old_games'
	let username = req.query.username
	
	// get all old games involving this user
	let account_f = `${ACCOUNTS_DIR_PATH}/${username}.json`
	
	let result = {
		action: 'old_games',
		result: null,
		games: []
	}
	
	fs.promises.readFile(account_f)
	.then(function(account_str) {
		let game_ids = JSON.parse(account_str).old_games
		let promises = []
		
		for (let game_id of game_ids) {
			promises.push(
				game_summary(game_id)
				.then(function(summary) {
					result.games.push(summary)
				})
				.catch(function() {
					log.error(`failed to fetch summary for game ${game_id}`)
				})
			)
		}
		
		return Promise.all(promises)
		.then(() => {
			log.debug(`sending ${result.games.length} summaries to ${username}`)
			result.result = 'pass'
		})
	})
	.catch(function(err) {
		result.result = 'fail'
		result.why = 'fs read file'
	})
	.finally(() => {
		res.json(result)
	})
})

server.route('/current_game')
.get(function(req,res) {
	let ctx = 'game'
	let game_id = req.query.game_id
	
	// get full game state for given game id
	let game_f = `${CURR_GAMES_DIR_PATH}/${game_id}.json`
	
	let result = {
		result: null,
		action: 'fetch_current_game',
		game: null
	}
	
	fs.readFile(game_f, function(err, game_str) {
		if (err) {
			log.error(`failed to load current game ${game_id}: ${err.message}`,ctx)
			result.result = 'fail'
			result.why = 'not found'
		}
		else {
			result.result = 'pass'
			result.game = JSON.parse(game_str)
		}
		
		res.json(result)
	})
})

server.route('/update_game')
.post(function(req,res) {
	let ctx = 'update_game'
	
	let game = convert_json_strings_to_values(req.body.game)
	
	let username = req.body.username
	
	log.debug(`updating game ${game.id} with turn from ${username}`)
	
	let result = {
		result: null,
		action: null,
		game_id: game.id
	}
	
	let game_f = `${CURR_GAMES_DIR_PATH}/${game.id}.json`
	
	if (game.end_result == GAME_RESULT_UNKNOWN) {
		/*
		If game still incomplete, write to new/existing file in current_games/, and ensure
		game is associated with the latest player account.
		*/
		
		result.action = 'match_over'
		
		fs.writeFile(game_f, JSON.stringify(game), function(err) {
			if (err) {
				result.result = 'fail'
				result.why = 'update game file'
				log.error(`update to game ${game.id} failed`)
			}
			else {
				result.result = 'pass'
				log.info(`updated game ${game.id} with turn from ${username}`)
			}
			
			res.json(result)
		})
		
		new_game_in_account(game.id, username)
	}
	else {
		/* 
		If game complete, delete from current_games/ and write to old_games/, also updating
		the associated player accounts.
		*/
		
		result.action = 'game_over'
		
		let passed = true
		let promises = []
		
		// remove current game
		promises.push(
			new Promise(function(resolve) {
				fs.unlink(game_f, function(err) {
					if (err) {
						result.why = 'delete incomplete game file'
						passed = false
					}
					resolve()
				})
			})
		)
		
		// add old game
		promises.push(
			new Promise(function(resolve) {
				game_f = `${OLD_GAMES_DIR_PATH}/${game.id}.json`
				
				fs.writeFile(game_f, JSON.stringify(game), function(err) {
					if (err) {
						result.why = 'add complete game file'
						passed = false
					}
					resolve()
				})
			})
		)
		
		// update players' account files
		age_game_in_accounts(game.id, game.usernames)
		
		Promise.all(promises)
		.then(() => {
			if (passed) {
				result.result = 'pass'
			}
			else {
				result.result = 'fail'
			}
			
			res.json(result)
		})
	}
})

server.route('/available_games')
.get(function(req,res) {
	let ctx = 'available_games'
	let excludes = req.query.excludes
	if (excludes == undefined) {
		excludes = []
	}
	let username = req.query.username
	
	let result = {
		result: null,
		action: 'available_games',
		games: []
	}
	
	// get list of game ids
	fs.promises.readdir(CURR_GAMES_DIR_PATH)
	.then((files) => {
		let promises = []
		
		function check_available(f) {
			return new Promise(function(resolve) {
				let game_id = f.replace('.json','')
				
				if (excludes.indexOf(game_id) == -1) {
					fs.promises.readFile(`${CURR_GAMES_DIR_PATH}/${f}`)
					.then((game_str) => {
						let game = JSON.parse(game_str)
						
						if (game.usernames.length < game.num_teams && 
							game.usernames.indexOf(username) == -1) {
							result.games.push(game_id)
							log.debug(`${game_id} is available`,ctx)
						}
						else {
							log.debug(`${game_id} is full`,ctx)
						}
					})
					.catch((err) => {
						log.error(`failed to read available game ${game_id}`,ctx)
					})
					.finally(() => {
						resolve()
					})
				}
				else {
					resolve()
				}
			})
		}
		
		for (let file of files) {
			promises.push(check_available(file))
		}
		
		return Promise.allSettled(promises).then(() => {
			log.debug(`found ${result.games.length} available games for ${username}`,ctx)
			result.result = 'pass'
		})
	})
	.catch((err) => {
		log.debug(`failed to list available games: ${err.message}`,ctx)
		result.result = 'fail'
		result.why = 'readdir current_games/'
	})
	.finally(() => {
		log.debug(`sending result to client`,ctx)
		res.json(result)
	})
})

server.route('/game_summary')
.get(function(req,res) {
	let ctx = 'game_summary'
	
	game_summary(req.query.game, true)
	.then(function(summary) {
		res.json({
			result: 'pass',
			game: summary
		})
	})
	.catch(() => {
		log.error(`failed to fetch summary for ${game_id}`, ctx)
		res.json({
			result: 'fail',
			why: 'no summary',
			game: null
		})
	})
})

function new_game_in_account(game_id, username) {
	let ctx = 'new_game_in_account'
	
	// check if game is already associated with user
	let account_f = `${ACCOUNTS_DIR_PATH}/${username}.json`
	fs.readFile(account_f, function(err, account_str) {
		if (err) {
			log.error(
				`failed to check if game ${game_id} already associated with user ${username}`, 
				ctx
			)
		}
		else {
			let account = JSON.parse(account_str)
			
			if (account.current_games.indexOf(game_id) == -1) {
				// game is new; add to account.current_games
				account.current_games.push(game_id)
				
				// save account
				fs.writeFile(account_f, JSON.stringify(account), function(err) {
					if (err) {
						log.error(`failed to add ${game_id} to ${username} current_games`, ctx)
					}
					else {
						log.info(`assigned ${game_id} to ${username}`)
					}
				})
			}
			else {
				log.debug(`game already associated with ${username}`)
			}
		}
	})
}

function age_game_in_accounts(game_id, game_usernames) {
	let ctx = 'age_game_in_accounts'
	
	for (let username of game_usernames) {
		let account_f = `${ACCOUNTS_DIR_PATH}/${username}.json`
		
		fs.readFile(account_f, function(err, account_str) {
			if (err) {
				log.error(`failed to remove complete ${game_id} from ${username} current_games `, ctx)
			}
			else {
				// move game from account.current_games to account.old_games
				let account = JSON.parse(account_str)
				
				// delete from current_games
				let ci = account.current_games.indexOf(game_id)
				if (ci > -1) {
					account.current_games.splice(ci,1)
				}
				
				// add to old_games
				account.old_games.push(game_id)
				
				//save account
				fs.writeFile(account_f, JSON.stringify(account), function(err) {
					if (err) {
						log.error(`failed to add ${game_id} to ${username} old_games`, ctx)
					}
					else {
						log.debug(`marked ${game_id} as complete for ${username}`)
					}
				})
			}
		})
	}
}

function game_summary(game_id, current=false) {
	return new Promise(function(resolve,reject) {
		let game_d = OLD_GAMES_DIR_PATH
		if (current) {
			game_d = CURR_GAMES_DIR_PATH
		}
		
		let game_f = `${game_d}/${game_id}.json`
		
		fs.promises.readFile(game_f)
		.then(function(game_str) {
			let summary = JSON.parse(game_str)
			
			delete summary.obstacles
			delete summary.players
			
			resolve(summary)
		})
		.catch(function(err) {
			reject(null)
		})
	})
}

// adapted from https://stackoverflow.com/a/34502964/10200417
function convert_json_strings_to_values(obj) {
	for (var index in obj) {
		// if object property value *is* a number, like 1 or "500"
		if (!isNaN(obj[index])) {
			// convert it to 1 or 500
			obj[index] = Number(obj[index]);
		}
		else if (obj[index] === 'true' || obj[index] === 'false') {
			obj[index] = (obj[index] === 'true')
		}
		else if (typeof obj === 'object') {
			convert_json_strings_to_values(obj[index]);
		}
	}
	
	return obj
}
