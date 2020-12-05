/*

Owen Gallagher
29 Nov 2020

*/

game_log = new Logger('game')

class Game {
	/*
	Game class.
	*/
	
	constructor(canvas_el, username, state, num_teams=2, team=0, local=false) {
		/*
		Game constructor
		
		Instance vars:
			paper
			background
			cursor
		*/
		let ctx = 'constructor'
		
		this.paper = new paper.PaperScope()
		
		// customize canvas element
		canvas_el.show()
		canvas_el.prop('width', 600)
		canvas_el.prop('height', 600)
		canvas_el.css('cursor','none')
		canvas_el.css('background-color','#000')
		
		// enable this PaperScope
		paper = this.paper
		this.paper.setup(canvas_el[0])
		
		let view_size = paper.view.size
		game_log.debug(`view size = ${view_size}`, ctx)
		
		// set local vs online mode
		this.local = local
		
		// set username for current team
		this.username = username
		
		if (state == undefined) {
			// new game
			let uuidn = generate_uuid_nickname()
			this.id = uuidn.uuid
			this.nickname = uuidn.nickname
			this.frame_limit = Game.DEFAULT_FRAME_LIMIT
			this.team = team
			this.num_teams = num_teams
			this.scores = []
			this.match_limit = Game.DEFAULT_MATCH_LIMIT
			this.end_result = Game.RESULT_UNKNOWN
			
			this.usernames = [this.username]
			
			this.load_obstacles()
			this.load_bases()
			this.clip_obstacles()
			
			this.load_ghosts()
		}
		else {
			// saved game

			// zero-length arrays can become undefined in comms
			if (state.obstacles == undefined) {
				state.obstacles = []
			}
			
			game_log.debug(`loading saved game id=${state.id} frames=${state.frame_limit} obstacles=${state.obstacles.length}`, ctx)
			this.id = state.id
			
			this.nickname = state.nickname
			// backwards compat
			if (this.nickname == undefined) {
				this.nickname = generate_uuid_nickname().nickname
			}
			
			this.frame_limit = state.frame_limit
			this.team = state.team
			this.num_teams = state.num_teams
			this.scores = state.scores
			this.match_limit = state.match_limit
			this.end_result = state.end_result
			
			this.usernames = state.usernames
			
			if (this.usernames.length < this.num_teams) {
				// if current team not yet named, add to register
				this.usernames.push(this.username)
			}
			
			this.load_obstacles(state.obstacles)
			this.load_bases()
			this.clip_obstacles()
			
			this.load_ghosts(state.players)
		}
		
		// set current vs old mode
		this.old = (this.end_result != Game.RESULT_UNKNOWN)
		
		if (this.team < Game.TEAM_COLORS.length) {
			this.team_color = Game.TEAM_COLORS[this.team]
		}
		else {
			this.team_color = new paper.Color(
				Math.random() + 0.25,
				Math.random() + 0.25,
				Math.random() + 0.25)
			game_log.info('team color = ' + this.team_color, ctx)
		}
		
		this.bullets = []
		
		if (this.old) {
			// history cursor (play/pause) and central indicator
			this.cursor_play = new paper.Path({
				segments: [
					[-6,-8], [6,0], [-6,8]
				],
				closed: true,
				visible: true,
				fillColor: '#fff'
			})
			
			this.cursor_pause = new paper.CompoundPath({
				children: [
					new paper.Path.Rectangle({
						point: [-0.75,-4],
						size: [1.5,8],
						closed: true,
						position: [-2,0]
					}),
					new paper.Path.Rectangle({
						point: [-0.75,-4],
						size: [1.5,8],
						closed: true,
						position: [2,0]
					})
				],
				visible: false,
				fillColor: '#fff'
			})
			this.cursor_pause.scale(2)
			
			let len = 1.3 * Math.PI
			let rad = 10
			let arc = new paper.Path.Arc({
				from: [rad, 0],
				through: [rad * Math.cos(len/2), rad * Math.sin(len/2)],
				to: [rad * Math.cos(len), rad * Math.sin(len)],
				strokeWidth: 2,
				strokeColor: '#fff',
				closed: false
			})
			let arr = new paper.Path({
				segments: [
					[-rad/2,rad/3], [0,-rad/2], [rad/2,rad/3], 
				],
				position: [rad,0],
				closed: true,
				strokeWidth: 0,
				fillColor: '#fff'
			})
			arr.rotate(15)
			this.cursor_replay = new paper.Group({
				children: [
					arc,
					arr
				],
				visible: false
			})
			this.cursor_replay.rotate(240)
			
			this.cursor = new paper.Group({
				children: [
					this.cursor_play,
					this.cursor_pause,
					this.cursor_replay
				],
				position: paper.view.center
			})
			
			game_log.debug(`created playback cursor`, ctx)
		}
		else {
			// create player
			let bp = this.bases[this.team].position
		
			this.player = new Player(this, {
				position: [bp.x, bp.y], 
				team: this.team,
				frame_limit: this.frame_limit
			})
			
			// play cursor is shot sight
			this.cursor = new paper.Group({
				children: [
					new paper.Path({
						segments: [[0,-5], [0,5]]
					}),
					new paper.Path({
						segments: [[-5,0], [5,0]]
					})
				],
				strokeColor: '#f00',
				strokeWidth: 1,
				position: paper.view.center
			})
		}
		
		this.paused = true
		this.result = Game.RESULT_UNKNOWN
		
		this.on_finish = function() {
			game_log.debug('game.on_finish undefined')
		}
		
		// in event handlers, this references this.paper.view
		let self = this
		
		// add event handlers
		paper.view.onMouseMove = function(event) {
			//game_log.debug('mouse = ' + event.point, 'Game.onMouseMove')
			self.cursor.position = event.point
			
			if (!self.old) {
				self.player.mouse_move(event)
			}
		}
		paper.view.onMouseDown = function(event) {
			game_log.debug('mouse down = ' + event.point, 'onMouseDown')
			
			if (self.old) {
				self.paused = !self.paused
				
				if (self.cursor_replay.visible) {
					self.cursor_pause.visible = false
					self.cursor_play.visible = true
					self.reset()
				}
				else {
					self.cursor_pause.visible = !self.paused
					self.cursor_play.visible = self.paused
				}
				
				self.cursor_replay.visible = false
			}
			else if (self.paused) {
				self.paused = false
			}
			else {
				self.player.mouse_down(event)
			}
		}
		
		paper.view.onFrame = function(event) {
			let ctx = 'onFrame'
			
			if (!self.paused) {
				self.update()
			}
		}
		
		if (!self.old) {
			let tool = new paper.Tool()
			
			tool.onKeyDown = function(event) {
				// game_log.debug('key down = ' + event.key, 'Game.onKeyDown')
				self.player.key_down(event)
			}
			tool.onKeyUp = function(event) {
				// game_log.debug('key up = ' + event.key, 'Game.onKeyUp')
				self.player.key_up(event)
			}
		}
	}
	
	reset() {
		// currently only supports old games (player not handled)
		let ctx = 'reset'
		
		game_log.debug(`resetting saved game id=${this.id}`, ctx)
		
		// reset players
		for (let ghost of this.ghosts) {
			ghost.remove()
		}
		this.load_ghosts(this.ghosts)
		
		// clear bullets
		this.bullets = []
		
		// paused and unknown result
		this.paused = true
		this.result = Game.RESULT_UNKNOWN
	}
	
	update() {
		let ctx = 'update'
		
		if (!this.old) {
			if (this.player.result == Game.RESULT_UNKNOWN) {
				this.player.update()
			
				$('#frame').html(game.player.state_i)
			}
		}
		
		for (let ghost of this.ghosts) {
			if (ghost.result == Game.RESULT_UNKNOWN) {
				ghost.update()
			}
		}
		
		for (let i=this.bullets.length-1; i>=0; i--) {
			let bullet = this.bullets[i]
			
			if (!bullet.deleted) {
				bullet.update()
				
				if (bullet.deleted) {
					// this.bullets.splice(i,1)
				}
			}
		}
		
		if (this.result == Game.RESULT_UNKNOWN) {
			// check end of this match
			let finished = true
			
			if (!this.old && this.player.result == Game.RESULT_UNKNOWN) {
				finished = false
			}
			
			for (let g=0; g<this.ghosts.length; g++) {
				let ghost = this.ghosts[g]
				
				if (ghost.result == Game.RESULT_UNKNOWN) {
					finished = false
				}
			}
			
			if (finished) {
				if (this.old) {
					// enable replay cursor
					this.cursor_play.visible = false
					this.cursor_pause.visible = false
					this.cursor_replay.visible = true
				}
				else {
					// finish current game
					let scores = Array(this.num_teams).fill(0)
			
					if (this.player.result == Game.RESULT_WIN) {
						game_log.debug(`point to team ${this.team}`, ctx)
						scores[this.team] = scores[this.team]+1
					}
			
					for (let ghost of this.ghosts) {
						if (!ghost.deleted && ghost.result == Game.RESULT_WIN) {
							game_log.debug(`point to team ${ghost.team}`, ctx)
							scores[ghost.team] = scores[ghost.team]+1
						}
					}
			
					let high_score = 0
					let high_team = -1
					let tie = 1
					for (let t=0; t<scores.length; t++) {
						if (scores[t] == high_score) {
							tie++
						}
						else if (scores[t] > high_score) {
							tie = 1
							high_score = scores[t]
							high_team = t
						}
					}
				
					game_log.info(`high score = ${high_score}\nscores = ${JSON.stringify(scores)}`, ctx)
					this.scores.push(scores)
			
					if (tie > 1) {
						game_log.info(`tie for high score between ${tie} teams`)
						this.result = Game.RESULT_TIE
					}
					else if (high_team == this.team) {
						game_log.info('current team won')
						this.result = Game.RESULT_WIN
					}
					else {
						game_log.info('current team lost')
						this.result = Game.RESULT_LOSS
					}
			
					if (this.ghosts.length + 1 >= this.match_limit) {
						// if number of total players = number of matches, game over
				
						// determine overall result
						let totals = Array(this.num_teams).fill(0)
						for (let scoreboard of this.scores) {
							for (let s=0; s<this.num_teams; s++) {
								totals[s] += scoreboard[s]
							}
						}
				
						let win_score = -1
						let win_team = -1
						let tie = 1
						for (let t=0; t<totals.length; t++) {
							if (totals[t] > win_score) {
								win_score = totals[t]
								win_team = t
								tie = 1
							}
							else if (totals[t] == win_score) {
								tie++
							}
						}
				
						if (tie > 1) {
							// tie between teams
							this.end_result = Game.RESULT_TIE
						}
						else {
							// there is a winner
							this.end_result = Game.RESULT_WIN
						}
					}
				
					this.finish()
				}
			}
		}
	}
	
	load_obstacles(obstacles) {
		let ctx = 'load_obstacles'
		paper = this.paper
		
		this.obstacles = []
		
		if (obstacles == undefined) {
			// generate random obstacles
			let v = this.paper.view.size
			let n = Math.round(
				Math.random() *
				(Game.OBSTACLES_MAX - Game.OBSTACLES_MIN) +
				Game.OBSTACLES_MIN
			)
			game_log.debug(`generating ${n} obstacles`, ctx)
			
			for (let i=0; i<n; i++) {
				// pick bounds
				let cw = Math.round(
					(Math.random() * 
					((v.width * Game.OBSTACLE_SIZE_MAX_PROP) - Game.OBSTACLE_SIZE_MIN) + 
					Game.OBSTACLE_SIZE_MIN) / Game.OBSTACLE_SIZE_MIN
				)
				let ch = Math.round(
					(Math.random() * 
					((v.width * Game.OBSTACLE_SIZE_MAX_PROP) - Game.OBSTACLE_SIZE_MIN) + 
					Game.OBSTACLE_SIZE_MIN) / Game.OBSTACLE_SIZE_MIN
				)
				
				// create cells of width Game.OBSTACLE_SIZE_MIN
				let cr_max = new paper.Point(cw/2,ch/2).length
				let obstacle = new paper.Path()
				
				for (let cy = -ch/2; cy < ch/2; cy++) {
					for (let cx = -cw/2; cx < cw/2; cx++) {
						let cr = new paper.Point(cy,cx).length
						let grow_prob = Game.OBSTACLE_PROB_GROW * (1 - (cr/cr_max))
						if (Math.random() < grow_prob) {
							game_log.debug(`create cell ${cx},${cy} for obstacle ${i}`, ctx)
							
							let x = cx * Game.OBSTACLE_SIZE_MIN - Game.OBSTACLE_RAD_MIN
							let y = cy * Game.OBSTACLE_SIZE_MIN - Game.OBSTACLE_RAD_MIN
							obstacle = obstacle.unite(new paper.Path.Rectangle(
								[x,y],
								[Game.OBSTACLE_SIZE_MIN*1.1,Game.OBSTACLE_SIZE_MIN*1.1]
							))
						}
					}
				}
				
				obstacle.fillColor = '#aaa'
				obstacle.position.set(Math.random() * (v.width),Math.random() * (v.height))
				
				// constrain obstacle position to be within viewport
				let ob = obstacle.bounds
				
				if (ob.width > 0) {
					if (ob.left < 0) {
						obstacle.position.x -= ob.left
					}
					if (ob.right > v.width) {
						obstacle.position.x -= ob.right - v.width
					}
					if (ob.top < 0) {
						obstacle.position.y -= ob.top
					}
					if (ob.bottom > v.height) {
						obstacle.position.y -= ob.bottom - v.height
					}
				
					this.obstacles.push(obstacle)
				
					/* debug obstacle bounds
					ob = obstacle.bounds
					new paper.Path({
						segments: [
							[ob.left,ob.top], [ob.right,ob.top], 
							[ob.right,ob.bottom], [ob.left,ob.bottom]
						],
						strokeColor: '#0f0',
						strokeWidth: 1,
						closed: true
					})
					*/
				}
			}
		}
		else {
			// load obstacles from state
			for (let o_path_str of obstacles) {
				this.obstacles.push(new paper.CompoundPath({
					pathData: o_path_str,
					fillColor: '#aaa',
					closed: true
				}))
			}
		}
	}
	
	load_ghosts(ghosts) {
		let ctx = 'load_ghosts'
		paper = this.paper
		
		this.ghosts = []
		
		if (ghosts != undefined) {
			for (let g of ghosts) {
				let ghost = new Player(this, g.init, g.states)
				this.ghosts.push(ghost)
			}
		}
	}
	
	clip_obstacles() {
		let ctx = 'clip_obstacles'
		paper = this.paper
		
		game_log.debug('clipping obstacles around bases', ctx)
		
		for (let base of this.bases) {
			let zone = new paper.Path.Circle({
				center: base.position,
				radius: Game.BASE_SIZE * 5,
				fillColor: '#88888855'
			})
			
			for (let o=0; o<this.obstacles.length; o++) {
				let obstacle = this.obstacles[o]
				this.obstacles[o] = obstacle.subtract(zone)
				obstacle.remove()
			}
			
			zone.remove()
		}
	}
	
	load_bases() {
		paper = this.paper
		
		this.bases = []
		
		// generate bases
		let i = 0
		let view = this.paper.view.size
		
		if (i < this.num_teams) {
			let color = new paper.Color(Game.TEAM_COLORS[i])
			color.alpha = 0.5
			let base = new paper.Path.Rectangle({
				point: [-Game.BASE_RAD,-Game.BASE_RAD],
				size: [Game.BASE_SIZE, Game.BASE_SIZE],
				position: [Game.BASE_RAD, Game.BASE_RAD],
				fillColor: color
			})
			this.bases.push(base)
			i++
		}
		if (i < this.num_teams) {
			let color = new paper.Color(Game.TEAM_COLORS[i])
			color.alpha = 0.5
			let base = new paper.Path.Rectangle({
				point: [-Game.BASE_RAD,-Game.BASE_RAD],
				size: [Game.BASE_SIZE, Game.BASE_SIZE],
				position: [view.width-Game.BASE_RAD, view.height-Game.BASE_RAD],
				fillColor: color
			})
			this.bases.push(base)
			i++
		}
		if (i < this.num_teams) {
			let color = new paper.Color(Game.TEAM_COLORS[i])
			color.alpha = 0.5
			let base = new paper.Path.Rectangle({
				point: [-Game.BASE_RAD,-Game.BASE_RAD],
				size: [Game.BASE_SIZE, Game.BASE_SIZE],
				position: [view.width-Game.BASE_RAD, Game.BASE_RAD],
				fillColor: color
			})
			this.bases.push(base)
			i++
		}
		if (i < this.num_teams) {
			let color = new paper.Color(Game.TEAM_COLORS[i])
			color.alpha = 0.5
			let base = new paper.Path.Rectangle({
				point: [-Game.BASE_RAD,-Game.BASE_RAD],
				size: [Game.BASE_SIZE, Game.BASE_SIZE],
				position: [Game.BASE_RAD, view.height-Game.BASE_RAD],
				fillColor: color
			})
			this.bases.push(base)
			i++
		}
	}
	
	save_state() {
		let state = {
			id: this.id,
			nickname: this.nickname,
			frame_limit: this.frame_limit,
			num_teams: this.num_teams,
			usernames: this.usernames,
			team: this.other_team(),
			obstacles: [],
			players: [],
			scores: this.scores,
			match_limit: this.match_limit,
			end_result: this.end_result
		}
		
		for (let o of this.obstacles) {
			let path_str = $(o.exportSVG({
				precision: 4
			})).attr('d')
			
			state.obstacles.push(path_str)
		}
		
		for (let ghost of this.ghosts) {
			state.players.push(ghost.save_states())
		}
		state.players.push(this.player.save_states())
		
		return state
	}
	
	finish() {
		if (this.paper != null) {
			// remove event handlers
			this.paper.view.onFrame = null
		}
		
		this.remove()
		
		if (this.on_finish != null) {
			this.on_finish(this)
		}
	}
	
	remove() {
		// deactivate PaperScope
		if (this.paper != null) {
			this.paper.remove()
			this.paper = null
		}
	}
	
	other_team() {
		let other = this.team + 1
		
		if (other >= this.num_teams) {
			other = 0
		}
		
		return other
	}
	
	static team_to_base(team) {
		switch (team) {
			case 0:
				return 1
		
			case 1:
				return 0
			
			case 2:
				return 3
		
			case 3:
				return 2
		}
	}
	
	static team_to_color_str(team) {
		if (team < Game.TEAM_COLORS.length) {
			return Game.TEAM_COLORS[team].toCSS()
		}
		else {
			return new paper.Color(
				Math.random() + 0.25,
				Math.random() + 0.25,
				Math.random() + 0.25
			).toCSS()
		}
	}
}

Game.OBSTACLES_MIN = 2
Game.OBSTACLES_MAX = 5
Game.OBSTACLE_SIZE_MIN = 40
Game.OBSTACLE_RAD_MIN = Game.OBSTACLE_SIZE_MIN / 2
Game.OBSTACLE_SIZE_MAX_PROP = 0.6
Game.OBSTACLE_PROB_GROW = 0.5
Game.OBSTACLE_PROB_ATTEN = 0.9

Game.BASE_SIZE = 30
Game.BASE_RAD = Game.BASE_SIZE/2

Game.TEAM_COLORS = [
	new paper.Color('#37f'),
	new paper.Color('#f73'),
	new paper.Color('#3f7'),
	new paper.Color('#f3f')
]

Game.RESULT_UNKNOWN = 0
Game.RESULT_WIN = 1
Game.RESULT_LOSS = 2
Game.RESULT_TIE = 3

Game.DEFAULT_FRAME_LIMIT = 1000
Game.DEFAULT_MATCH_LIMIT = 8 // 4 per team if 2 teams, 2 per team if 4 teams
