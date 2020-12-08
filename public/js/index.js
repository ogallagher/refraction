/*

Owen Gallagher
2020-11-28

*/

// from index_logger.js
index_log = new Logger('index', Logger.LEVEL_DEBUG)
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
let GAME_URL = '/game'
let UPDATE_GAME_URL = '/update_game'
let AVAILABLE_GAME_URL = '/available_game'
let GAME_SUMMARY_URL = '/game_summary'

$(document).ready(function() {
	let ctx = 'window.onload'
	
	index_log.debug('window loaded',ctx)
	
	// init game config pane
	$('#config-body input').prop('disabled',true)
	
	// init local-online switch
	let mode = cookies_get('local_online_mode')
	if (mode == null || mode == 'local') {
		cookies_set('local_online_mode','local')
		local = true
		$('#local-online').html('local')
		$('#refresh-current').hide()
	}
	else {
		cookies_set('local_online_mode','online')
		local = false
		$('#local-online').html('online')
	}
	
	$('#local-online-switch')
	.prop('checked', !local)
	.change(on_local_online_switch)
	
	// bind game config inputs with labels and enable
	$('#config-num-teams').change(function(e) {
		$('#config-num-teams-out').html(e.target.value)
	})
	$('#config-match-limit').change(function(e) {
		$('#config-match-limit-out').html(e.target.value)
	})
	$('#config-frame-limit').change(function(e) {
		$('#config-frame-limit-out').html(e.target.value)
	})
	$('#config-player-radius').change(function(e) {
		$('#config-player-radius-out').html(e.target.value)
	})
	$('#config-player-speed').change(function(e) {
		$('#config-player-speed-out').html(e.target.value)
	})
	$('#config-bullet-length').change(function(e) {
		$('#config-bullet-length-out').html(e.target.value)
	})
	
	if (editing) {
		// tests
		index_log.debug(
			'random uuid and nickname: ' + 
			JSON.stringify(generate_uuid_nickname()), 
			ctx
		)
		
		// example current games
		let current_game = $(current_game_cmp)
		let current_games = $('#current-games')
		
		for (let i=0; i<5; i++) {
			current_games.append(current_game)
		}
		
		// example pending games
		let pending_game = $(pending_game_cmp)
		let pending_games = $('#pending-games')
		
		for (let i=0; i<5; i++) {
			pending_games.append(pending_game)
		}
		
		// example history games
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
		$('#center').append($(game_over_local_cmp))
		local_game()
	}
	else {
		index_log.debug('loading account', ctx)
		login()
		.then(fetch_account)
		.then(() => {
			index_log.info('username = ' + account.username, ctx)
			
			let promises = []
			index_log.debug('loading current and pending games', ctx)
			promises.push(load_current_games())
			
			index_log.debug('loading old games', ctx)
			promises.push(load_old_games())
			
			Promise.all(promises)
			.then(enable_game_selection)
		})
		.catch(() => {
			$('#directions').html('Failed to load account info. Try again later.')
		})
		.finally(on_game_finish)
	}
})

function login() {
	/*
	Returns resolved promise with a chosen username.
	*/
	return new Promise(function(resolve) {
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
}

function refresh_games(current_regardless=true) {
	let ctx = 'refresh_games'
	
	return new Promise(function(resolve,reject) {
		index_log.debug('refreshing games', ctx)
		
		if (current_regardless || account.current_games.length == 0) {
			// reload account current games and history
			fetch_account(account.username)
			.then(load_current_games)
			.then(load_old_games)
			.then(enable_game_selection)
			.then(resolve)
		}
		else {
			// continue using existing current games list
			enable_game_selection()
			resolve()
		}
	})
}

function fetch_account(username) {
	let ctx = 'fetch_account'
	
	return new Promise(function(resolve,reject) {
		account.username = username
		
		index_log.debug('fetching account info from server')
		
		$.ajax({
			dataType: 'json',
			url: LOGIN_URL,
			data: account,
			success: function(res) {
				index_log.debug(res, ctx)
				
				if (res.result == 'pass') {
					if (res.action == 'login') { // vs register
						// refresh current games
						account.current_games = res.account.current_games
						$('#current-games').empty()
						
						// clear pending games (will be refreshed when loading current games)
						account.pending_games = []
						$('#pending-games').empty()
						
						// refresh history games
						account.old_games = res.account.old_games
						$('#history-games').empty()
					}
					else {
						$('#directions').html(`Registered a new account for ${username}`)
					}
					
					resolve()
				}
				else {
					reject()
				}
			},
			error: function(err) {
				index_log.error('failed to fetch account info from server', ctx)
				reject()
			}
		})
	})
}

function on_local_online_switch() {
	let ctx = 'on_local_online_switch'
	let los = $('#local-online-switch')
	
	if (los.prop('checked')) {
		local = false
		$('#local-online').html('online')
		
		// remove game over (local/online) before adding it back with next_game
		$('#game-over').remove()
		
		$('#refresh-current').show()
		
		// define account
		login()
		.then(function(username) {
			account.username = username
			
			// move to next game, which also refreshes account data
			if (game) {
				game.remove()
			}
			on_game_finish()
			
			$('#directions')
			.html('\
			Switched to online mode; refresh games to fetch latest available online match.')
		
			cookies_set('local_online_mode','online')
		})
	}
	else {
		local = true
		$('#local-online').html('local')
		
		// clear current, pending, old games
		account.current_games = []
		$('#current-games').empty()
		account.pending_games = []
		$('#pending-games').empty()
		account.old_games = []
		$('#history-games').empty()
		
		// hide games refresh
		$('#refresh-current').hide()
		
		// show local game over
		$('#game-over').remove()
		$('#game-canvas').show()
		$('#center').append($(game_over_local_cmp))
		
		$('#directions')
		.html('\
		Switched to local mode. This game will not be sent to the server \
		and will not be playable on other computers.')
		
		cookies_set('local_online_mode','local')
		
		// switch to local game
		if (game != null) {
			game.on_finish = null
			game.finish()
			game.remove()
			game = null
		}
		
		local_game()
	}
	
	los.prop('checked', !local)
}

function next_game() {
	let ctx = 'next_game'
	
	// $('#game-canvas').hide()
	
	$('#game-over').remove()
	$('#center').append($(game_over_cmp))
	
	if (game != null) {
		// clear current game
		// game.finish()
		
		// move current game to pending or history
		if (!game.local && game.result != Game.RESULT_UNKNOWN) {
			if (is_old(game)) {
				move_to_history(game)
			}
			else {
				move_to_pending(game)
			}
		}
	}
	
	return new Promise(function(resolve) {
		refresh_games(false)
		.then(() => {
			// account.current_games is updated
			if (account.current_games.length == 0) {
				// confirmed no current games; try random available game
				fetch_available_game()
				.then(saved_game)
				.catch(() => {
					index_log.error(`failed to fetch any available games`, ctx)
					$('#directions').html('No existing games currently available.')
					
					new_game()
				})
				.finally(() => {
					resolve()
				})
			}
			else {
				// select next current game
				fetch_game(account.current_games[0])
				.then(function(game_state) {
					$('#directions').html('Selected next ready game.')
					saved_game(game_state)
				})
				.catch(() => {
					$('#directions').html('No more current games ready. Generated new game.')
					new_game()
					resolve()
				})
			}
		})
	})
}

function enable_game_selection() {
	$('.current-game')
	.addClass('selectable')
	.click(function() {
		let game_id = this.dataset.gameId
		
		fetch_game(game_id, true)
		.then(function(game_state) {
			if (game) {
				game.remove()
				$('#game-over').remove()
				$('#center').append($(game_over_cmp))
			}
			
			saved_game(game_state)
			$('#directions').html(`selected ${game_id}`)
			
			$('#game-canvas')[0].scrollIntoView()
		})
		.catch((err) => {
			index_log.error(`failed to load ${game_id}`)

			if (err) {
				console.log(err)
			}
		})
	})
	
	$('.history-game')
	.addClass('selectable')
	.click(function(e) {
		let game_id = this.dataset.gameId
		
		fetch_game(game_id, false)
		.then(function(game_state) {
			if (game) {
				console.log('remove current game')
				game.remove()
				$('#game-over').remove()
				$('#center').append($(game_over_cmp))
			}
			
			console.log('load saved game')
			saved_game(game_state)
			$('#directions').html(`selected ${game_id} for playback`)
		
			$('#game-canvas')[0].scrollIntoView()
		})
		.catch(function(err) {
			index_log.error(`failed to load ${game_id}`)
			
			if (err) {
				console.log(err)
			}
		})
		
	})
}

function local_game(game_state) {
	let ctx = 'local_game'
	
	if (game == null) {
		index_log.debug('loading new local game', ctx)
		game = new Game($('#game-canvas'), random_string(), null, 2, 0, true)
	}
	else if (game.result != Game.RESULT_UNKNOWN) {
		let game_state = game.save_state()
		game.remove()
		game = new Game($('#game-canvas'), random_string(), game_state, null, null, true)
	}
	else {
		game.remove()
		game = new Game($('#game-canvas'), random_string(), null, 2, 0, true)
	}
	
	game.on_finish = local_game

	game_stats()
	return Promise.resolve()
}

function new_game() {
	let ctx = 'new_game'
	
	if (game != null) {
		game.remove()
		game = null
	}
	
	// hide game-over screen
	$('#game-over').remove()
	
	// initialize new game
	game = new Game($('#game-canvas'), account.username, null)
	game.on_finish = on_game_finish
	game_stats()
	
	// add new game to current_games
	account.current_games.push(game.id)
	
	$('#directions').html(`began new game ${game.id}`)
	return Promise.resolve()
}

function saved_game(game_state) {
	let ctx = 'saved_game'
	
	// initialize new game
	game = new Game($('#game-canvas'), account.username, game_state)
	game_stats()
	
	if (!game.old) {
		game.on_finish = on_game_finish
		
		// hide game-over screen
		$('#game-over').remove()
		
		// ensure saved game is in account.current_games
		if (account.current_games.indexOf(game.id) == -1) {
			account.current_games.push(game.id)
		}
		
		index_log.info(`began match ${game.scores.length+1} for saved game ${game.id}`, ctx)
	}
	else {
		index_log.info(`began playback of old game ${game.id}`, ctx)
	}
}

function find_game() {
	let ctx = 'find_game'
	
	index_log.info(`finding next available game`)
	fetch_available_game()
	.then(function(available_game) {
		if (game) {
			index_log.debug('finishing game before loading available game')
			game.finish()
			game.remove()
		}
		
		saved_game(available_game)
	})
	.catch(() => {
		if (game) {
			index_log.debug('finishing game before loading new game')
			game.finish()
			game.remove()
		}
		
		index_log.error(`no games available`)
		$('#directions').html('No games available; generated new game.')
		new_game()
	})
}

function game_stats() {
	let ctx = 'game_stats'
	game_arg = game
	
	// read-only attributes
	$('#game-id').html(game_arg.id)
	$('#game-nickname').html(game_arg.nickname)
	
	let teams = []
	
	let un = game.usernames.length
	for (let i=0; i<game_arg.num_teams; i++) {
		let t_color = Game.team_to_color_str(i)
		
		if (i < un) {
			teams.push(`<span style="color: ${t_color}">${game_arg.usernames[i]}</span>`)
		}
		else {
			teams.push(`<span style="color: ${t_color}">?</span>`)
		}
	}
	
	$('#teams').html(teams.join('<br>'))
	
	let scores = []
	let totals = Array(game.num_teams).fill(0)
	let match = 1
	for (let scoreboard of game_arg.scores) {
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
	
	$('#frame-limit').html(game_arg.frame_limit)
	
	index_log.debug(`updated stats for ${game.id}`)
	
	// writable settings
	game_config()
}

function game_config() {
	let ctx = 'game_config'
	game_arg = game
	
	if (game_arg.ghosts.length == 0 && game_arg.result == Game.RESULT_UNKNOWN) {
		index_log.debug('game result = ' + game_arg.result, ctx)
		// reset to defaults as customizable
		$('#config-num-teams')
		.val(Game.DEFAULT_NUM_TEAMS)
		.change()
		.change(function(e) {
			game_arg.set_num_teams(parseInt(e.target.value))
		})
		
		$('#config-match-limit')
		.val(Game.DEFAULT_MATCH_LIMIT)
		.change()
		.change(function(e) {
			game_arg.match_limit = parseInt(e.target.value)
		})
		
		$('#config-frame-limit')
		.val(Game.DEFAULT_FRAME_LIMIT)
		.change()
		.change(function(e) {
			game_arg.set_frame_limit(parseInt(e.target.value))
		})
		
		$('#config-player-radius')
		.val(Player.DEFAULT_RADIUS)
		.change()
		.change(function(e) {
			game_arg.set_player_radius(parseInt(e.target.value))
		})
		
		$('#config-player-speed')
		.val(Player.DEFAULT_SPEED)
		.change()
		.change(function(e) {
			game_arg.set_player_speed(parseFloat(e.target.value))
		})
		
		$('#config-bullet-length')
		.val(Bullet.DEFAULT_LENGTH)
		.change()
		.change(function(e) {
			game_arg.set_bullet_length(parseInt(e.target.value))
		})
		
		$('#config-body input').prop('disabled',false)
	}
	else {
		// set to game settings as final
		$('#config-num-teams').val(game_arg.num_teams).change()
		$('#config-match-limit').val(game_arg.match_limit).change()
		$('#config-frame-limit').val(game_arg.frame_limit).change()
		
		let game_player
		if (game_arg.old) {
			game_player = game_arg.ghosts[game_arg.ghosts.length-1]
		}
		else {
			game_player = game_arg.player
		}
		$('#config-player-radius').val(game_player.radius).change()
		$('#config-player-speed').val(game_player.speed).change()
		$('#config-bullet-length').val(game_arg.bullet_length || Bullet.DEFAULT_LENGTH).change()
		
		$('#config-body input').prop('disabled',true)
	}
}

function current_game_stats(game) {
	/*
	Add a current game summary to the gui.
	*/
	let ctx = 'current_game_stats'
	
	let current_game = $(current_game_cmp)
	.attr('data-game-id', game.id)
	
	current_game.find('.current-game-nickname').html(game.nickname)
	
	current_game.find('.current-game-id').html(game.id)
	
	current_game.find('.current-game-usernames').html(game.usernames.join(', '))
	
	current_game.find('.current-game-round').html(`${game.scores.length} / ${game.match_limit}`)	

	let totals = Array(game.num_teams).fill(0)
	for (let scoreboard of game.scores) {
		for (let i=0; i<scoreboard.length; i++) {
			totals[i] += scoreboard[i]
		}
	}
	
	current_game.find('.current-game-scores').html(
		totals.join(', ')
	)
	
	$('#current-games').append(current_game)
	index_log.debug(`added ${game.id} to current section`, ctx)
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
		
		pending_game.find('.pending-game-nickname').html(game.nickname)
	
		pending_game.find('.pending-game-id').html(game.id)
	
		pending_game.find('.pending-game-usernames').html(game.usernames.join(', '))
	
		pending_game.find('.pending-game-round').html(
			`${game.scores.length} / ${game.match_limit}`
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
	let ctx = 'old_game_stats'
	let history_game = $(history_game_cmp)
	.attr('data-game-id', game.id)
	
	history_game.find('.history-game-nickname').html(game.nickname)
	
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
	.html(game.match_limit)
	
	history_game.find('.history-game-frame-limit')
	.html(game.frame_limit)
	
	$('#history-games').append(history_game)
	index_log.debug(`added ${game.id} to history games`, ctx)
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
					index_log.debug(`fetched ${res.games.length} old games; loading history`, ctx)
					
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

function load_current_games() {
	/*
	Loads current and pending games from account.current_games.
	*/
	let ctx = 'load_current_games'
	
	let promises = []
	
	return new Promise(function(resolve) {
		for (let game_id of account.current_games) {
			promises.push(
				fetch_game_summary(game_id)
				.then(function(game_state) {
					if (is_pending(game_state)) {
						move_to_pending(game_state)
					}
					else {
						index_log.debug(`fetched current game ${game_id}`, ctx)
						current_game_stats(game_state)
					}
				})
				.catch((err) => {
					index_log.warning(`failed to fetch ${game_id}`,ctx)
					
					if (err) {
						console.log(err)
					}
				})
			)
		}
		
		Promise.allSettled(promises)
		.then(resolve)
	})
}

function fetch_available_game() {
	let ctx = 'load_available_game'
	
	return new Promise(function(resolve, reject) {
		$.ajax({
			dataType: 'json',
			url: AVAILABLE_GAME_URL,
			data: {
				excludes: account.current_games.concat(account.pending_games),
				username: account.username
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`fetched available game ${res.game.id}`, ctx)
					resolve(res.game)
				}
				else {
					index_log.error(`failed to fetch available games: ${res.why}`, ctx)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch available games: ${err.message}`, ctx)
				reject()
			}
		})
	})
}

function fetch_game_summary(game_id) {
	let ctx = 'fetch_game_summary'
	
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: GAME_SUMMARY_URL,
			data: {
				game: game_id
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`fetched game summary ${res.game.id}`,ctx)
					resolve(res.game)
				}
				else {
					index_log.error(`failed to fetch summary: ${res.why}`,ctx)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch summary: ${err.message}`,ctx)
				reject()
			}
		})
	})
}

function fetch_game(game_id, current=true) {
	let ctx = 'fetch_game'
	
	return new Promise(function(resolve,reject) {
		$.ajax({
			dataType: 'json',
			url: GAME_URL,
			data: {
				game_id: game_id,
				current: current
			},
			success: function(res) {
				if (res.result == 'pass') {
					index_log.debug(`game ${game_id} fetched`, ctx)
					
					if (current && is_pending(res.game)) {
						reject(res.game)
					}
					else {
						resolve(res.game)
					}
				}
				else {
					index_log.error(`failed to fetch game ${game_id}: ${res.why}`, ctx)
					reject()
				}
			},
			error: function(err) {
				index_log.error(`failed to fetch game ${game_id}: ${err.message}`, ctx)
				reject()
			}
		})
	})
}

function on_game_finish(game) {
	let ctx = 'on_game_finish'
	
	return new Promise(function(resolve) {
		if (game != undefined) {
			// update current game stats
			game_stats()
			
			if (!game.local && game.result != Game.RESULT_UNKNOWN) {
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
			}
		}
		
		next_game()
		.then(resolve)
	})
}

function is_pending(game) {
	/*
	Return true if teams are assigned and current team is not account.username (waiting for 
	someone else's turn).
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

function is_old(game) {
	/*
	Return true if scores.length >= match_limit.
	*/
	let ctx = 'is_old'
	let old = false
	
	if (game.scores.length >= game.match_limit) {
		old = true
	}
	
	return old
}

function move_to_pending(game) {
	let ctx = 'move_to_pending'
	
	// add to pending games section
	pending_game_stats(game)
	
	// remove from current games section
	$(`.current-game[data-game-id="${game.id}"]`).remove()
	
	// remove pending game from current games
	let ci = account.current_games.indexOf(game.id)
	if (ci != -1) {
		index_log.debug(`remove ${game.id} from current_games`, ctx)
		account.current_games.splice(ci,1)
	}
	
	// add to account.pending_games
	let pi = account.pending_games.indexOf(game.id)
	if (pi == -1) {
		index_log.debug(`add ${game.id} to pending_games`, ctx)
		account.pending_games.push(game.id)
	}
}

function move_to_history(game) {
	let ctx = 'move_to_history'
	
	// use last game
	old_game_stats(game)
	
	// remove old game from current games
	let ci = account.current_games.indexOf(game.id)
	if (ci != -1) {
		index_log.debug(`remove ${game.id} from current games`, ctx)
		account.current_games.splice(ci,1)
	}
	
	// remove from current games section
	$(`.current-game[data-game-id="${game.id}"]`).remove()
	
	// add to account.old_games
	let oi = account.old_games.indexOf(game.id)
	if (oi == -1) {
		index_log.debug(`add ${game.id} to old_games`)
		account.old_games.push(game.id)
	}
}

function random_string(len) {
	if (len == undefined) {
		len = Math.random() * (12-4) + 4
	}
	
	let vowels = 'aaeeiioouuy'
	let consonants = 'bbccddffgghhjjkkllmmnnppqrrssttvwxz'
	
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
