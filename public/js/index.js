/*

Owen Gallagher
2020-11-28

*/

// from index_logger.js
index_log = new Logger('index', Logger.LEVEL_DEBUG)

let test = false
let game = null
let account = {
	username: random_string(),
	current_games: [],
	old_games: [],
	pending_games: []
}

let ACCOUNT_URL = '/account'
let LOGIN_URL = `${ACCOUNT_URL}/login`
let CURR_GAMES_URL = `${ACCOUNT_URL}/current_games`
let OLD_GAMES_URL = `${ACCOUNT_URL}/old_games`
let CURR_GAME_URL = '/current_game'
let UPDATE_GAME_URL = '/update_game'
let AVAILABLE_GAMES_URL = '/available_games'
let GAME_SUMMARIES_URL = '/game_summaries'

let pending_game_template = `
<div class="border-top">
	<div class="row">
		<div class="col text-secondary">game id</div>
		<div class="pending-game-id col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">usernames</div>
		<div class="pending-game-usernames col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">round</div>
		<div class="pending-game-round col"></div>
	</div>		
	<div class="row">
		<div class="col text-secondary">scores</div>
		<div class="pending-game-scores col"></div>
	</div>
</div>`

let game_summary_template = `
<div class="border-top">
	<div class="row">
		<div class="col text-secondary">game id</div>
		<div class="history-game-id col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">winner</div>
		<div class="history-game-winner col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">frame limit</div>
		<div class="history-game-frame-limit col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">teams</div>
		<div class="history-game-num-teams col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">usernames</div>
		<div class="history-game-usernames col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">scores</div>
		<div class="history-game-scores col"></div>
	</div>
	<div class="row">
		<div class="col text-secondary">rounds</div>
		<div class="history-game-rounds col"></div>
	</div>
</div>`

let game_over_template = `
	<div id="game-over" class="d-flex flex-column justify-content-center h-100">
		<button id="next-game" class="btn btn-info">next game</button>
	</div>`

$(document).ready(function() {
	let ctx = 'window.onload'
	
	index_log.debug('window loaded',ctx)
	
	if (test) {
		$('#login-form').hide()
		test_game()
	}
	else {
		index_log.debug('loading account', ctx)
		load_account()
		.then((res_account) => {
			account = res_account
		})
		.catch(() => {
			// fail quietly
		})
		.finally(() => {
			index_log.info('username = ' + account.username, ctx)
			
			index_log.debug('requesting current games from server', ctx)
			
			load_current_games()
			.then((games) => {
				account.current_games = games
			})
			.catch((games) => {
				// fail quietly
			})
			.finally(() => {
				index_log.info('selecting a game', ctx)
				
				load_current_game()
				.then((current_game) => {
					if (current_game == null) {
						// check available games
						load_available_games()
						.then((available_games) => {
							if (available_games.length > 0) {
								index_log.info(
									`${available_games.length} games available; selecting first`,
									ctx
								)
								
								let game_id = available_games[0]
								fetch_current_game(game_id)
								.then((available_game) => {
									saved_game(available_game)
								})
								.catch((err) => {
									if (err) {
										console.log(err)
									}
									
									index_log.error('failed to fetch available game',ctx)
									new_game()
								})
							}
							else {
								new_game()
							}
 						})
					}
					else {
						saved_game(current_game)
					}
					
					if (account.pending_games.length > 0) {
						load_game_summaries(account.pending_games)
						.then(function(pending_summaries) {
							for (let pending of pending_summaries) {
								pending_game_stats(pending)
							}
						})
						.catch(() => {
							index_log.error('failed to load pending games', ctx)
						})
					}
				})
				.catch((err) => {
					index_log.error('failed to load game: ' + err.message, ctx)
				})
			})
			
			index_log.debug('loading old games', ctx)
			load_old_games()
			.then(() => {
				index_log.debug('old games loaded', ctx)
			})
			.catch(() => {
				index_log.debug('old games load failed', ctx)
			})
		})
	}
})

function test_game(game_state) {
	if (game == undefined) {
		game = new Game($('#game-canvas'), random_string(), null, 2)
	}
	else {
		let game_state = game.save_state()
		game.remove()
	
		game = new Game($('#game-canvas'), random_string(), game_state, 2)
	}

	game.on_finish = test_game

	game_stats()
}

function new_game() {
	let ctx = 'new_game'
	
	// initialize new game
	game = new Game($('#game-canvas'), account.username, null, 2)
	game.on_finish = on_game_finish
	game_stats()
	
	// add new game to current_games
	account.current_games.push(game.id)
	
	index_log.info(`began match ${game.scores.length+1} for new game ${game.id}`, ctx)
}

function saved_game(game_state) {
	let ctx = 'saved_game'
	
	// initialize new game
	game = new Game($('#game-canvas'), account.username, game_state)
	game.on_finish = on_game_finish
	game_stats()
	
	// ensure saved game is in account.current_games
	if (account.current_games.indexOf(game.id) == -1) {
		account.current_games.push(game.id)
	}
	
	index_log.info(`began match ${game.scores.length+1} for saved game ${game.id}`, ctx)
}

function game_stats() {
	$('#game-id').html(game.id)
	
	let teams = []
	
	let un = game.usernames.length
	for (let i=0; i<game.num_teams; i++) {
		let t_color = Game.team_to_color_str(i)
		
		if (i < un) {
			teams.push(`<span style="color: ${t_color}">${game.usernames[i]}</span>`)
		}
		else {
			teams.push(`<span style="color: ${t_color}">?</span>`)
		}
	}
	
	$('#teams').html(teams.join('<br>'))
	
	let scores = []
	let totals = Array(game.num_teams).fill(0)
	let match = 1
	for (let scoreboard of game.scores) {
		let color_scores = []
		for (let i=0; i<scoreboard.length; i++) {
			color_scores.push(
				`<span style="color: ${Game.team_to_color_str(i)}">${scoreboard[i]}</span>`
			)
			
			totals[i] += scoreboard[i]
		}
		
		scores.push(`${match}: ${color_scores.join(' ')}`)
		match++
	}
	
	let color_totals = []
	for (let i=0; i<totals.length; i++) {
		color_totals.push(
			`<span style="color: ${Game.team_to_color_str(i)}">${totals[i]}</span>`
		)
	}
	scores.push(`totals: ${color_totals.join(' ')}`)
	
	$('#scores').html(scores.join('<br>'))
	
	$('#frame-limit').html(game.frame_limit)
}

function pending_game_stats(game_summary) {
	let ctx = 'pending_game_stats'
	
	let pending_game = $(pending_game_template)
	
	pending_game.find('.pending-game-id').html(
		game_summary.id
	)
	
	pending_game.find('.pending-game-usernames').html(
		game_summary.usernames.join(', ')
	)
	
	pending_game.find('.pending-game-round').html(
		`${game_summary.scores.length} / ${game_summary.match_limit/2}`
	)	
	
	let totals = Array(game_summary.num_teams).fill(0)
	for (let scoreboard of game_summary.scores) {
		for (let i=0; i<scoreboard.length; i++) {
			totals[i] += scoreboard[i]
		}
	}
	
	pending_game.find('.pending-game-scores').html(
		totals.join(', ')
	)
	
	$('#pending-games').append(pending_game)
}

function old_game_stats(game) {
	let game_summary = $(game_summary_template)
	
	game_summary.find('.history-game-id')
	.html(game.id)
	
	let totals = Array(game.num_teams).fill(0)
	for (let scoreboard of game.scores) {
		for (let i=0; i<scoreboard.length; i++) {
			totals[i] += scoreboard[i]
		}
	}
	
	let winner_team = -1
	let winner_score = 0
	let winner_username = 'TIE'
	
	if (game.end_result != Game.RESULT_TIE) {
		for (let i=0; i<totals.length; i++) {
			if (totals[i] > winner_score) {
				winner_score = totals[i]
				winner_team = i
			}
		}
		
		winner_username = game.usernames[winner_team]
	}
	
	game_summary.find('.history-game-winner')
	.html(winner_username)
	
	game_summary.find('.history-game-usernames')
	.html(game.usernames.join(', '))
	
	game_summary.find('.history-game-num-teams')
	.html(game.num_teams)
	
	game_summary.find('.history-game-scores')
	.html(totals.join(' '))
	
	game_summary.find('.history-game-rounds')
	.html(game.match_limit/2)
	
	game_summary.find('.history-game-frame-limit')
	.html(game.frame_limit)
	
	$('#history-games').append(game_summary)
}

function load_current_game() {
	return new Promise(function(resolve,reject) {
		let ctx = 'load_current_game'
		
		if (account.current_games.length == 0) {
			index_log.info('no current games to play',ctx)
			resolve(null)
		}
		else {
			let g = 0
			let game_id = account.current_games[g]
			let game_state = null
			
			function loop() {
				index_log.info(`fetching game ${game_id} from the server`,ctx)
				
				return fetch_current_game(game_id)
				.then((res_game) => {
					index_log.debug(`fetched game ${game_id}; loading state`,ctx)
					
					if (res_game.usernames.length > res_game.team && 
						res_game.usernames[res_game.team] == account.username) {
						index_log.debug(`${game_id} is open for a turn from ${account.username}`,ctx)
						game_state = res_game
						return Promise.resolve()
					}
					else {
						index_log.debug(`${game_id} is pending a turn from team ${res_game.team}`,ctx)
						account.pending_games.push(game_id)
						
						g++
						if (g < account.current_games.length) {
							game_id = account.current_games[g]
							return loop()
						}
						else {
							return Promise.resolve()
						}
					}
				})
				.catch(() => {
					index_log.warning('failed to fetch chosen game',ctx)
					
					g++
					if (g < account.current_games.length) {
						game_id = account.current_games[g]
						return loop()
					}
					else {
						return Promise.resolve()
					}
				})
			}
			
			loop().then(() => {
				// remove pending games from current games
				for (let pending of account.pending_games) {
					let ci = account.current_games.indexOf(pending)
					
					if (ci != -1) {
						index_log.debug(`remove ${pending} from current_games`)
						account.current_games.splice(ci,1)
					}
				}
				
				resolve(game_state)
			})
		}
	})
}

function random_string(len) {
	if (len == undefined) {
		len = Math.random() * (12-4) + 4
	}
	
	let vowels = 'aeiouy'
	let consonants = 'bcdfghjklmnpqrstvwxz'
	
	let str = []
	let s = Math.round(Math.random())
	for (let i=0; i<len; i++) {
		if (s == 0) {
			str.push(vowels.charAt(Math.floor(Math.random()*vowels.length)))
		}
		else if (s == 1) {
			str.push(consonants.charAt(Math.floor(Math.random()*consonants.length)))
		}
		
		s = 1-s
	}
	
	return str.join('')
}

function load_account() {
	return new Promise(function(resolve,reject) {
		new Promise(function(resolve) {
			let username = cookies_get('username')
			let username_el = $('#username')
			
			if (username == null) {
				username_el
				.prop('disabled',false)
				.prop('placeholder',random_string())
			
				$('#directions').html('Pick a username.')
			
				$('#login').on('click', (e) => {
					console.log('login')
				
					let username = username_el.val()
					if (username == '') {
						username = username_el.prop('placeholder')
					}
					
					cookies_set('username', username)
					
					$(e.target)
					.off('click')
					.hide()
					
					username_el.prop('disabled',true)
					
					$('#directions').html('')
					
					resolve(username)
				})
			}
			else {
				username_el
				.val(username)
				.prop('disabled',true)
			
				$('#login').hide()
				resolve(username)
			}
		})
		.then((username) => {
			account.username = username
			
			index_log.debug('fetching account info from server')
			
			$.ajax({
				dataType: 'json',
				url: LOGIN_URL,
				data: account,
				success: function(res) {
					index_log.debug(res,LOGIN_URL)
					
					if (res.result == 'pass') {
						if (res.action == 'login') {
							account = res.account
						}
						
						// add client-only attributes
						account.pending_games = []
						
						resolve(account)
					}
					else {
						reject()
					}
				},
				error: function(err) {
					index_log.error('failed to fetch account info from server',LOGIN_URL)
					reject()
				}
			})
		})
	})
}

function load_current_games() {
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: CURR_GAMES_URL,
			data: {
				username: account.username
			},
			success: function(res) {				
				if (res.result == 'pass') {
					index_log.debug(
						`fetched ${res.games.length} current games from server`,
						CURR_GAMES_URL
					)
					resolve(res.games)
				}
				else {
					reject([])
				}
			},
			error: function(err) {
				index_log.error('failed to fetch current games from server',CURR_GAMES_URL)
				reject([])
			}
		})
	})
}

function load_old_games() {
	let ctx = 'load_old_games'
	
	return new Promise(function(resolve,reject) {
		// get old games list
		$.ajax({
			dataType: 'json',
			url: OLD_GAMES_URL,
			data: {
				username: account.username
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`fetched ${res.games.length} old games; loading history`)
					
					for (let game of res.games) {
						old_game_stats(game)
					}
					
					resolve()
				}
				else {
					index_log.error('failed to fetch old games: ' + res.why, ctx)
					reject()
				}
			},
			error: function(err) {
				index_log.error('failed to fetch old games: ' + err.message, ctx)
				reject()
			}
		})
	})
}

function load_available_games() {
	return new Promise(function(resolve) {
		$.ajax({
			dataType: 'json',
			url: AVAILABLE_GAMES_URL,
			data: {
				excludes: account.current_games,
				username: account.username
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`fetched ${res.games.length} available games`)
					resolve(res.games)
				}
				else {
					index_log.error(`failed to fetch available games: ${res.why}`)
					resolve([])
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch available games: ${err.message}`, AVAILABLE_GAMES_URL)
				resolve([])
			}
		})
	})
}

function load_game_summaries(game_ids) {
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: GAME_SUMMARIES_URL,
			data: {
				games: game_ids
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(
						`fetched ${res.games.length} pending game summaries from server`,
						CURR_GAMES_URL
					)
					resolve(res.games)
				}
				else {
					index_log.error(`failed to fetch pending games: ${res.why}`,CURR_GAMES_URL)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch pending games: ${err.message}`,CURR_GAMES_URL)
				reject()
			}
		})
	})
}

function fetch_current_game(game_id) {
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: CURR_GAME_URL,
			data: {
				game_id: game_id
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`game load ${game_id} passed`)
					resolve(res.game)
				}
				else {
					index_log.error(`failed to fetch game ${game_id}: ${res.why}`)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch game ${game_id}: ${err.message}`, CURR_GAME_URL)
				reject()
			}
		})
	})
}

function on_game_finish(game) {
	let ctx = 'on_game_finish'
	
	// update current game stats
	game_stats()
	
	$('#game-canvas').hide()
	
	// move from current_games to pending_games
	let ci = account.current_games.indexOf(game.id)
	if (ci != -1) {
		account.current_games.splice(ci,1)
	}
	
	account.pending_games.push(game.id)
	
	// load pending game stats
	pending_game_stats(game)
	
	// save new game state
	index_log.debug('match complete; sending new state to server', ctx)
	new Promise(function(resolve,reject) {
		index_log.debug('saving game')
		
		let game_state = game.save_state()
		game.remove()
		
		$.ajax({
			method: 'POST',
			dataType: 'json',
			url: UPDATE_GAME_URL,
			data: {
				username: account.username,
				game: game_state
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.info(
						`saved new state of game ${game.id}`, 
						UPDATE_GAME_URL
					)
					resolve()
				}
				else {
					index_log.error(
						`failed to save new state of game ${game.id}: ${res.why}`, 
						UPDATE_GAME_URL
					)
					reject()
				}
			},
			error: function(err) {
				index_log.error(
					`failed to save new state of game ${game.id}: ${err.message}`, 
					UPDATE_GAME_URL
				)
				reject()
			}
		})
	})
	.catch((err) => {
		// save game in client cookies for submission later
		index_log.info('saving the game to cookies for submission to server later (disabled)')
		// cookies_set(game.id, JSON.stringify(game_state))
		
		if (err) {
			index_log.error(err.message,UPDATE_GAME_URL)
		}
	})
	
	// create game-over screen
	$('#center').append($(game_over_template))
	$('#next-game').click(next_game)
}

function next_game() {
	let ctx = 'next_game'
	
	if (account.current_games.length > 0) {
		// load next current game
		fetch_current_game(account.current_games[0])
		.then(function(game_state) {
			saved_game(game_state)
			$('#game-over').remove()
		})
		.catch(() => {
			index_log.error(`failed to fetch current game ${account.current_games[0]}`, ctx)
			
			$('#directions').html('Failed to fetch your next game from server. Try again later.')
		})
	}
	else {
		// load next available game
		load_available_games()
		.then(function(available_games) {
			if (available_games.length > 0) {
				fetch_current_game(available_games[0])
				.then(function(game_state) {
					saved_game(game_state)
					$('#game-over').remove()
				})
				.catch(() => {
					index_log.error(`failed to fetch available game ${available_games[0]}`, ctx)
					$('#directions').html('Failed to fetch next gamefrom server. Try again later.')
				})
			}
			else {
				// generate new game
				new_game()
				$('#game-over').remove()
			}
		})
	}
}
