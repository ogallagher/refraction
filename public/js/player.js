/*

Owen Gallagher
29 Nov 2020

*/

player_log = new Logger('player')

class Player {
	/*
	Player class
	*/
	
	constructor(game, init={}, states=null) {
		/*
		Player constructor
		*/
		let ctx = 'constructor'
		player_log.debug('creating Player instance', ctx)
		
		this.game = game
		paper = this.game.paper
		
		// fill in defaults for missing attrs in init
		if (init.team === undefined) {
			init.team = 0
		}
		if (init.position === undefined) {
			init.position = [0,0]
		}
		if (init.velocity === undefined) {
			init.velocity = [0,0]
		}
		if (init.heading === undefined) {
			init.heading = 0
		}
		if (init.sight === undefined) {
			init.sight = [1,0]
		}
		if (init.mouse === undefined) {
			init.mouse = [1,0]
		}
		if (init.frame_limit == undefined) {
			init.frame_limit = Game.DEFAULT_FRAME_LIMIT
		}
		
		this.init = init
		player_log.debug(`init player from ${JSON.stringify(this.init)}`, ctx)
		
		this.team = init.team
		this.base = this.game.bases[Game.team_to_base(this.team)]
		
		if (this.team < Game.TEAM_COLORS.length) {
			this.color = new paper.Color(Game.TEAM_COLORS[this.team])
		}
		else {
			// random color
			this.color = new paper.Color(
				Math.random() + 0.25,
				Math.random() + 0.25,
				Math.random() + 0.25)
		}
		
		this.deleted = false // whether player has died
		this.radius = this.game.player_radius || Player.DEFAULT_RADIUS // body (hitbox) radius
		this.gun_radius = this.radius*1.5 // length of gun from player position
		this.speed = this.game.player_speed || Player.DEFAULT_SPEED	// walking speed
		
		this.prev_shot = 0					// frame number (state_i) of last shot
		this.ammo_capacity = 15				// total shots per match
		this.clip_capacity = 3				// total ammo is divided into clips to limit shot rate
		this.clip_recharge_speed = 0.01		// proportion of clip recharged in one frame
		this.ammo = this.ammo_capacity		// current remaining shots in current match
		this.clip = 1.0						// current fraction of remaining shots in clip
		
		this.position = new paper.Point(init.position)
		this.velocity = new paper.Point(init.velocity)
		this.heading = init.heading
		this.heading_v = 0
		this.sight = new paper.Point(init.sight)
		this.mouse = new paper.Point(init.mouse)
		
		this.up = false
		this.right = false
		this.down = false
		this.left = false
		this.shot = false
		this.state_changed = false
		
		this.frame_limit = init.frame_limit
		this.state_i = 0
		if (states == null) {
			this.is_ghost = false
			this.states = {}
		}
		else {
			this.is_ghost = true
			this.states = states
		}
		
		this.result = Game.RESULT_UNKNOWN
		
		this.set_graphic()
	}
	
	set_graphic() {
		let ctx = 'set_graphic'
		let paper = this.game.paper
		
		if (this.graphic) {
			this.graphic.remove()
			this.graphic = null
		}
		
		if (this.shot_indicator) {
			this.shot_indicator.remove()
			this.shot_indicator = null
		}
		
		let body = new paper.Path.Circle({
			center: [0,0],
			radius: this.radius,
			fillColor: this.color
		})
		this.body = body
		
		let gun = new paper.Path({
			segments: [[0,0], [this.radius*1.5,0]],
			strokeColor: this.color,
			strokeWidth: 2,
			strokeCap: 'round'
		})
		this.gun = gun
		
		this.shot_indicator_length = 100
		this.shot_indicator = new paper.Path({
			segments: [
				[0,0], [this.shot_indicator_length,0]
			],
			strokeColor: this.color,
			strokeWidth: 6,
			strokeCap: 'round',
			position: [paper.view.center.x,10],
			visible: !this.is_ghost
		})
		
		this.graphic = new paper.Group({
			children: [
				gun,
				body
			]
		})
		
		if (this.is_ghost) {
			// this.body.fillColor.alpha = 0.5
		}
		else {
			player_log.debug('marking live player', ctx)
			let x_l = new paper.Path({
				segments: [[-this.radius*0.5,-this.radius*0.5], [this.radius*0.5,this.radius*0.5]],
				strokeColor: '#000',
				strokeWidth: 1
			})
			let x_r = new paper.Path({
				segments: [[-this.radius*0.5,this.radius*0.5], [this.radius*0.5,-this.radius*0.5]],
				strokeColor: '#000',
				strokeWidth: 1
			})
		
			this.graphic.addChild(x_l)
			this.graphic.addChild(x_r)
		}
		
		this.graphic.position = this.position
		this.graphic.pivot = body.position
	}
	
	set_radius(radius) {
		this.radius = radius
		
		this.set_graphic()
	}
	
	set_speed(speed) {
		this.speed = speed
	}
	
	mouse_move(event) {
		this.mouse = event.point
		this.state_changed = true
	}
	
	mouse_down(event) {
		let shot_enabled = true
		
		// check ammo
		if (this.ammo <= 0) {
			shot_enabled = false
		}
		// check clip
		else if (this.clip * this.clip_capacity < 1) {
			shot_enabled = false
		}
		
		// attempt shot
		if (shot_enabled) {
			// deplete clip and ammo
			this.ammo -= 1
			this.clip -= (1/this.clip_capacity)
			if (this.clip < 0) {
				this.clip = 0
			}
			
			this.shot = true
			this.state_changed = true
			
			player_log.debug(`shot status: clip=${this.clip} ammo=${this.ammo/this.ammo_capacity}`)
		}
	}
	
	key_down(event) {
		let key = event.key
		// player_log.debug('key down = ' + key, 'Player.key_down')
		
		if (key == 'w' || key == 'up') {
			this.up = true
		}
		else if (key == 'd' || key == 'right') {
			this.right = true
		}
		else if (key == 's' || key == 'down') {
			this.down = true
		}
		else if (key == 'a' || key == 'left') {
			this.left = true
		}
		
		this.state_changed = true
	}
	
	key_up(event) {
		let key = event.key
		// player_log.debug('key up = ' + key, 'Player.key_up')
		
		if (key == 'w' || key == 'up') {
			this.up = false
		}
		else if (key == 'd' || key == 'right') {
			this.right = false
		}
		else if (key == 's' || key == 'down') {
			this.down = false
		}
		else if (key == 'a' || key == 'left') {
			this.left = false
		}
		
		this.state_changed = true
	}
	
	move() {
		this.velocity = new paper.Point(0,0)
		if (this.up) {
			this.velocity.y -= this.speed
		}
		if (this.right) {
			this.velocity.x += this.speed
		}
		if (this.down) {
			this.velocity.y += this.speed
		}
		if (this.left) {
			this.velocity.x -= this.speed
		}
		
		this.position = this.position.add(this.velocity)
		
		this.sight = this.mouse.subtract(this.position)
		let new_heading = this.sight.angle
		this.heading_v = new_heading - this.heading
		this.heading = new_heading
	}
	
	collide() {
		paper = this.game.paper
		
		// with bullets
		for (let bullet of this.game.bullets) {
			if (bullet.owner != this && !bullet.deleted && bullet.spine.intersects(this.body)) {
				player_log.debug('player-bullet collision at ' + this.position)
				bullet.deleted = true
				bullet.remove()
				this.deleted = true
				this.result = Game.RESULT_LOSS
				
				if (!this.is_ghost) {
					this.state_changed = true
					this.save_state()
				}
				
				break
			}
		}
		
		if (!this.deleted) {
			// with viewport
			let view = this.game.paper.view.size
			if (this.position.x - this.radius < 0) {
				this.position.x = this.radius
			}
			else if (this.position.x + this.radius > view.width) {
				this.position.x = view.width - this.radius
			}
			if (this.position.y - this.radius < 0) {
				this.position.y = this.radius
			}
			else if (this.position.y + this.radius > view.height) {
				this.position.y = view.height - this.radius
			}
		
			// with obstacles
			for (let obstacle of this.game.obstacles) {
				if (this.body.intersects(obstacle)) {
					// get intersect point
					let p = obstacle.getNearestPoint(this.position)
			
					// move out from intersect point
					let out = this.position.subtract(p)
				
					if (out.length < this.radius) {
						let collided = true
						let collisions = 1
					
						while (collided && collisions < Player.MAX_COLLISIONS_PER_OBSTACLE) {
							let overlap = this.radius - out.length
							out = out.normalize().multiply(overlap)
				
							this.position = this.position.add(out)
						
							// in case of multiple collisions, recalculate
							p = obstacle.getNearestPoint(this.position)
							out = this.position.subtract(p)
						
							collided = out.length < this.radius
							collisions++
						}
					}
				}
			}
			
			// with target base
			if (this.base.intersects(this.body)) {
				this.result = Game.RESULT_WIN
				this.state_changed = true
				player_log.info(`player from team ${this.team} reached base`)
			}
		}
	}
	
	move_graphic() {
		// update graphics
		this.graphic.position = this.position
		this.graphic.rotation = this.heading_v
		
		if (this.result == Game.RESULT_LOSS) {
			this.body.fillColor.alpha = 0.5
		}
		
		this.shot_indicator.lastSegment.point.x = 
			this.shot_indicator.position.x + 
			this.clip * (this.ammo/this.ammo_capacity) * this.shot_indicator_length
	}
	
	shoot() {
		let bullet_p = this.position.add(this.sight.normalize(this.gun_radius))
		
		let bullet = new Bullet(this.game, this, bullet_p, this.heading)
		
		this.game.bullets.push(bullet)
		
		this.shot = false
	}
	
	update() {
		// recharge clip
		this.clip += this.clip_recharge_speed // fraction of shots in clip
		if (this.clip > 1) {
			this.clip = 1
		}
		
		if (this.state_i > this.frame_limit) {
			this.result = Game.RESULT_LOSS
			this.state_changed = true
		}
		
		if (this.is_ghost) {
			this.load_state()
		}
		else {
			this.save_state()
		}
		
		this.move()
		this.collide()
		
		if (!this.deleted) {
			this.move_graphic()
		
			if (this.shot) {
				this.shoot()
			}
		}
		else {
			this.remove()
		}
	}
	
	save_state() {
		if (this.state_changed) {
			let state = {
				up: this.up,
				right: this.right,
				down: this.down,
				left: this.left,
				heading: this.heading,
				mouse: [this.mouse.x,this.mouse.y],
				shot: this.shot,
				result: this.result
			}
			
			this.states['s' + this.state_i.toString()] = state
			
			this.state_changed = false
		}
		
		this.state_i++
	}
	
	load_state() {
		let state = this.states['s' + this.state_i.toString()]
		
		if (state != null) {
			this.up = state.up
			this.right = state.right
			this.down = state.down
			this.left = state.left
			this.heading = state.heading
			this.mouse.set(state.mouse)
			this.shot = state.shot
			this.result = state.result
		}
		
		this.state_i++
	}
	
	save_states() {
		return {
			init: this.init,
			states: this.states
		}
	}
	
	remove() {
		this.graphic.remove()
		this.shot_indicator.remove()
	}
}

Player.DEFAULT_RADIUS = 10
Player.DEFAULT_SPEED = 2
Player.MAX_COLLISIONS_PER_OBSTACLE = 3
