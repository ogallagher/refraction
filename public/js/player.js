/*

Owen Gallagher
29 Nov 2020

*/

player_log = new Logger('player', Logger.LEVEL_DEBUG)

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
		player_log.debug(`init player from ${JSON.stringify(this.init)}`)
		
		this.team = init.team
		this.base = this.game.bases[Game.team_to_base(this.team)]
		console.log('base: ' + JSON.stringify(this.base))
		
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
		
		this.deleted = false
		this.radius = 10
		this.gun_radius = this.radius*1.5
		this.speed = 2
		
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
		
		// graphics
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
	
	mouse_move(event) {
		this.mouse = event.point
		this.state_changed = true
	}
	
	mouse_down(event) {
		this.shot = true
		this.state_changed = true
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
		this.graphic.position = this.position
		this.graphic.rotation = this.heading_v
		
		if (this.result == Game.RESULT_LOSS) {
			this.body.fillColor.alpha = 0.5
		}
	}
	
	shoot() {
		let bullet_p = this.position.add(this.sight.normalize(this.gun_radius))
		
		let bullet = new Bullet(this.game, this, bullet_p, this.heading)
		
		this.game.bullets.push(bullet)
		
		this.shot = false
	}
	
	update() {
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
	}
}

Player.MAX_COLLISIONS_PER_OBSTACLE = 3
