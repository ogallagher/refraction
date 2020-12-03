/*

Owen Gallagher
2020-11-28

*/

// from index_logger.js
index_log = new Logger('index', Logger.LEVEL_INFO)
Logger.set_root(index_log)

let editing = false
let local = false
let game = null
let account = {
	username: random_string(),
	current_games: [],
	old_games: [],
	pending_games: []
}

let ACCOUNT_URL = '/account'
let LOGIN_URL = `${ACCOUNT_URL}/login`
let OLD_GAMES_URL = `${ACCOUNT_URL}/old_games`
let CURR_GAME_URL = '/current_game'
let UPDATE_GAME_URL = '/update_game'
let AVAILABLE_GAMES_URL = '/available_games'
let GAME_SUMMARY_URL = '/game_summary'

$(document).ready(function() {
	let ctx = 'window.onload'
	
	index_log.debug('window loaded',ctx)
	
	// init local-online switch
	let mode = cookies_get('local_online_mode')
	if (mode == null || mode == 'local') {
		cookies_set('local_online_mode','local')
		local = true
		$('#local-online').html('local')
	}
	else {
		cookies_set('local_online_mode','online')
		local = false
		$('#local-online').html('online')
	}
	
	$('#local-online-switch')
	.prop('checked', !local)
	.change(on_local_online_switch)
	
	if (editing) {
		let pending_game = $(pending_game_cmp)
		let pending_games = $('#pending-games')
		
		for (let i=0; i<5; i++) {
			pending_games.append(pending_game)
		}
		
		let history_game = $(history_game_cmp)
		let history_games = $('#history-games')
		for (let i=0; i<10; i++) {
			history_games.append(history_game)
		}
		
		$('#directions').html('\
		Here are some directions.<br>\
		You are currently in editing mode.')
		
		$('#game-canvas')
		.prop('width', 600)
		.prop('height', 600)
		.addClass('bg-dark')
		.show()
	}
	else if (local) {
		$('#login-form').hide()
		local_game()
	}
	else {
		index_log.debug('loading account', ctx)
		load_account()
		.then(function(res_account) {
			account = res_account
		})
		.catch(() => {
			$('#directions').html('Failed to register/login. Try again later.')
		})
		.finally(() => {
			index_log.info('username = ' + account.username, ctx)
			
			index_log.info('selecting a game', ctx)
			next_game()
			
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

function on_local_online_switch() {
	let ctx = 'on_local_online_switch'
	let los = $('#local-online-switch')
	
	if (los.prop('checked')) {
		local = false
		$('#local-online').html('online')
		
		// define account
		load_account()
		.then(function(res_account) {
			account = res_account
		})
		.catch(() => {
			// fail silently
		})
		.finally(() => {
			// create game-over screen
			$('#game-canvas').hide()
			$('#center').append($(game_over_cmp))
			$('#next-game').click(next_game)
			
			$('#directions')
			.html('\
			Switched to online mode; refreshed game to fetch latest available online match.')
		
			cookies_set('local_online_mode','online')
			
			if ($('.history-game').length == 0) {
				// define old games
				load_old_games()
				.then(() => {
					index_log.debug('old games loaded', ctx)
				})
				.catch(() => {
					index_log.debug('old games load failed', ctx)
				})
			}
		})
	}
	else {
		local = true
		$('#local-online').html('local')
		
		$('#game-over').remove()
		$('#game-canvas').show()
		
		$('#directions')
		.html('\
		Switched to local mode. This game will not be sent to the server \
		and will not be playable on other computers.')
		
		cookies_set('local_online_mode','local')
		
		if (game != null) {
			game.local = true
			game.on_finish = local_game
		}
	}
	
	los.prop('checked', !local)
}

function next_game() {
	let ctx = 'next_game'
	
	if (game != null) {
		// clear current game
		game.on_finish = null
		game.finish()
		
		// move current game to pending
		if (!game.local) {
			move_to_pending()
		}
	}
	
	load_current_game()
	.then(saved_game)
	.catch(() => {
		// load next available game
		load_available_games()
		.then(function(available_games) {
			if (available_games.length > 0) {
				fetch_current_game(available_games[0])
				.then(saved_game)
				.catch(() => {
					index_log.error(`failed to fetch available game ${available_games[0]}`, ctx)
					$('#directions').html('Failed to fetch next gamefrom server. Try again later.')
				})
			}
			else {
				// generate new game
				new_game()
			}
		})
	})
}

function local_game(game_state) {
	if (game == undefined) {
		game = new Game($('#game-canvas'), random_string(), null, 2, 0, true)
	}
	else {
		let game_state = game.save_state()
		game.remove()
	
		game = new Game($('#game-canvas'), random_string(), game_state, null, null, true)
	}
	
	game.on_finish = local_game

	game_stats()
}

function new_game() {
	let ctx = 'new_game'
	
	// hide game-over screen
	$('#game-over').remove()
	
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
	
	// hide game-over screen
	$('#game-over').remove()
	
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

function pending_game_stats(game) {
	/*
	Add a pending game summary to the gui.
	*/
	let ctx = 'pending_game_stats'
	
	let existing = $(`.pending-game[data-game-id="${game.id}"]`)
	
	if (existing.length == 0) {
		let pending_game = $(pending_game_cmp)
		.attr('data-game-id', game.id)
	
		pending_game.find('.pending-game-id').html(
			game.id
		)
	
		pending_game.find('.pending-game-usernames').html(
			game.usernames.join(', ')
		)
	
		pending_game.find('.pending-game-round').html(
			`${game.scores.length} / ${game.match_limit/2}`
		)	
	
		let totals = Array(game.num_teams).fill(0)
		for (let scoreboard of game.scores) {
			for (let i=0; i<scoreboard.length; i++) {
				totals[i] += scoreboard[i]
			}
		}
	
		pending_game.find('.pending-game-scores').html(
			totals.join(', ')
		)
	
		$('#pending-games').append(pending_game)
		index_log.debug(`added ${game.id} to pending section`, ctx)
	}
	else {
		index_log.debug(`pending ${game.id} already loaded in page`, ctx)
	}
}

function old_game_stats(game) {
	let history_game = $(history_game_cmp)
	.attr('data-game-id', game.id)
	
	history_game.find('.history-game-id')
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
	
	history_game.find('.history-game-winner')
	.html(winner_username)
	
	history_game.find('.history-game-usernames')
	.html(game.usernames.join(', '))
	
	history_game.find('.history-game-num-teams')
	.html(game.num_teams)
	
	history_game.find('.history-game-scores')
	.html(totals.join(' '))
	
	history_game.find('.history-game-rounds')
	.html(game.match_limit/2)
	
	history_game.find('.history-game-frame-limit')
	.html(game.frame_limit)
	
	$('#history-games').append(history_game)
}

function load_current_game() {
	let ctx = 'load_current_game'
	
	return new Promise(function(resolve,reject) {		
		if (account.current_games.length == 0) {
			index_log.info('no current games to play',ctx)
			reject()
		}
		else {
			let g = 0
			let game_id = account.current_games[g]
			
			function loop() {
				index_log.info(`fetching game ${game_id} from the server`,ctx)
				
				return fetch_current_game(game_id)
				.then((res_game) => {
					index_log.debug(`fetched game ${game_id}; loading state`,ctx)
					
					return Promise.resolve(res_game)
				})
				.catch(function(why) {
					if (why == 'pending') {
						index_log.warning(`${game_id} is pending turn from another team`)
						move_to_pending(game_id)
						g--
					}
					else {
						index_log.warning('failed to fetch chosen game',ctx)
					}
					
					g++
					if (g < account.current_games.length) {
						game_id = account.current_games[g]
						return loop()
					}
					else {
						return Promise.resolve(null)
					}
				})
			}
			
			loop().then(function(game_state) {
				if (game_state == null) {
					reject()
				}
				else {
					resolve(game_state)
				}
			})
		}
	})
}

function load_account() {
	return new Promise(function(resolve,reject) {
		new Promise(function(resolve) {
			$('#login-form').show()
			
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
	let ctx = 'load_available_games'
	
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
					index_log.debug(`fetched ${res.games.length} available games`, ctx)
					resolve(res.games)
				}
				else {
					index_log.error(`failed to fetch available games: ${res.why}`, ctx)
					resolve([])
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch available games: ${err.message}`, ctx)
				resolve([])
			}
		})
	})
}

function load_game_summary(game_id) {
	let ctx = 'load_game_summary'
	
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: GAME_SUMMARY_URL,
			data: {
				game: game_id
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`fetched pending game summary ${res.game.id}`,ctx)
					resolve(res.game)
				}
				else {
					index_log.error(`failed to fetch pending games: ${res.why}`,ctx)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch pending games: ${err.message}`,ctx)
				reject()
			}
		})
	})
}

function fetch_current_game(game_id) {
	let ctx = 'fetch_current_game'
	
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: CURR_GAME_URL,
			data: {
				game_id: game_id
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`game ${game_id} loaded; checking if ready or pending`, ctx)
					
					if (is_pending(res.game)) {
						reject('pending')
					}
					else {
						resolve(res.game)
					}
				}
				else {
					index_log.error(`failed to fetch game ${game_id}: ${res.why}`, ctx)
					reject('no game')
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch game ${game_id}: ${err.message}`, ctx)
				reject('no game')
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
	$('#center').append($(game_over_cmp))
	$('#next-game').click(next_game)
}

function is_pending(game) {
	/*
	Return true if teams are assigned and current team is not account.username (waiting for 
	someone else's turn).
	
	Side-effects: if pending, the game is removed from account.current_games and 
	account_available_games.
	*/
	let ctx = 'is_pending'
	let pending = false
	
	if (game.usernames.length == game.num_teams) {
		// is full
		pending = (game.usernames[game.team] != account.username)
	}
	else {
		// waiting for more players
		pending = (game.usernames.indexOf(account.username) != -1)
	}
	
	if (pending) {
		index_log.debug(`${game.id} is pending turn from ${game.usernames[game.team]}`,ctx)
	}
	
	return pending
}

function move_to_pending(game_id) {
	let ctx = 'move_to_pending'
	
	// load pending game into section
	if (game_id != undefined) {
		// use game id to load game summary
		load_game_summary(game_id)
		.then(pending_game_stats)
		.catch(() => {
			index_log.error(`failed to load pending game ${game_id}`, ctx)
		})
	}
	else {
		// use last game
		pending_game_stats(game)
	}
	
	// remove pending game from current games
	let ci = account.current_games.indexOf(game_id)
	if (ci != -1) {
		index_log.debug(`remove ${game_id} from current_games`, ctx)
		account.current_games.splice(ci,1)
	}
	
	// add to account.pending_games
	let pi = account.pending_games.indexOf(game_id)
	if (ci == -1) {
		index_log.debug(`add ${game_id} to pending_games`, ctx)
		account.pending_games.push(game_id)
	}
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
