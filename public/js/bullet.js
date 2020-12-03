/*

Owen Gallagher
29 Nov 2020

*/

let bullet_log = new Logger('bullet')

class Bullet {
	/*
	Bullet class
	*/
	
	constructor(game, owner, position=[0,0], heading=0) {
		/*
		Bullet constructor
		*/
		
		let ctx = 'constructor'
		bullet_log.debug('creating Bullet instance')
		
		this.game = game
		paper = this.game.paper
		
		this.owner = owner
		
		// config
		this.radius = 5
		this.length = 50
		this.speed = 10
		this.deleted = false
		
		// state
		this.origin = new paper.Point(position)
		
		this.velocity = new paper.Point(this.speed,0)
			.rotate(heading, new paper.Point(0,0))
		
		this.position = new paper.Point(this.origin)
			.add(this.velocity)
		
		// geometry
		let spine = new paper.Path({
			segments: [this.origin, this.position],
			strokeColor: new paper.Color(1,0,0),
			strokeWidth: 1,
		})
		this.spine = spine
		let body = new paper.Path({
			segments: [this.origin, this.position],
			strokeColor: new paper.Color(1,0,0,0.3),
			strokeWidth: this.radius * 2,
			strokeCap: 'round'
		})
		this.graphic = new paper.Group({
			children: [
				body,
				spine
			]
		})
		this.graphic.sendToBack()
	}
	
	move() {
		this.position = this.position.add(this.velocity)
	}
	
	collide() {
		let ctx = 'collide'
		
		// with viewport
		let view_rect = this.game.paper.view.bounds
		if (!view_rect.contains(this.position)) {
			bullet_log.debug('removed bullet out of view at ' + this.position, ctx)
			this.deleted = true
			return true
		}
		
		// with obstacls
		for (let obstacle of this.game.obstacles) {
			if (obstacle.intersects(this.spine)) {
				bullet_log.debug('removed bullet in obstacle at ' + this.position, ctx)
				this.deleted = true
				return true
			}
		}
		
		return false
	}
	
	move_graphic() {
		// stretch terminal points to current position
		for (let child of this.graphic.children) {
			child.lastSegment.point = this.position
			
			let tracer = this.origin.subtract(this.position)
			if (tracer.length > this.length) {
				tracer = tracer.normalize(this.length)
			}
			child.firstSegment.point = this.position.add(tracer)
		}
	}
	
	update() {
		this.move()
		
		if (!this.collide()) {
			this.move_graphic()
		}
		
		if (this.deleted) {
			this.remove()
		}
	}
	
	remove() {
		this.graphic.remove()
	}
}
