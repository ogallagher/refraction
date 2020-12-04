/*

Owen Gallagher
28 Nov 2020

*/

class Logger {
	/*
	Logging class.
	*/
	
	static level_name(level) {
		if (level == Logger.LEVEL_DEBUG) {
			return 'debug'
		}
		else if (level == Logger.LEVEL_INFO) {
			return 'info'
		}
		else if (level == Logger.LEVEL_WARNING) {
			return 'warning'
		}
		else if (level == Logger.LEVEL_ERROR) {
			return 'error'
		}
		else if (level == Logger.LEVEL_CRITICAL) {
			return 'critical'
		}
		else {
			return 'unknown'
		}
	}
	
	static set_root(new_root) {
		if (Logger.root != undefined) {
			// move current root children to new root
			new_root.children = new_root.children.concat(Logger.root.children)
		}
		
		for (let c=new_root.children.length-1; c>=0; c--) {
			if (new_root.children[c] == new_root) {
				new_root.children.splice(c,1)
			}
		}
		
		// set new_root.children.level
		new_root.set_level(new_root.level)
		
		// assign new_root to root reference
		Logger.root = new_root
	}
	
	static get_caller_line() {
		try {
			throw new Error('')
		}
		catch (err) {
			let call_stack = err.stack.split('\n')
			let caller_info = call_stack[4]
			
			if (caller_info.indexOf(':') == -1) {
				caller_info = call_stack[3]
			}
			
			caller_info = caller_info.split(':')
			
			// line number is second to last item in colon-separated list
			let line = caller_info[caller_info.length-2]
			
			return line
		}
	}
	
	constructor(name, level) {
		/*
		Logger constructor.
		*/
		
		this.name = name
		
		// reference to sub-loggers
		this.children = []
		
		// add as child to root logger
		if (Logger.root != undefined) {
			Logger.root.children.push(this)
			
			if (level != undefined) {
				this.level = level
			}
			else {
				this.level = Logger.root.level
			}
		}
		else if (level != undefined) {
			this.level = level
		}
		else {
			this.level = Logger.LEVEL_INFO
		}
	}
	
	set_level(level) {
		this.level = level
		
		for (let child of this.children) {
			child.set_level(level)
		}
	}
	
	log(message, level=Logger.LEVEL_DEBUG, context='main') {
		if (level >= this.level) {
			if ((typeof message) != 'string') {
				message = JSON.stringify(message)
			}
			
			let line = Logger.get_caller_line()
			
			console.log(`${this.name}.${context}.${line}.${Logger.level_name(level)}: ${message}`)
		}
	}
	
	debug(message, context='main') {
		this.log(message, Logger.LEVEL_DEBUG, context)
	}
	
	info(message, context='main') {
		if (this.level <= Logger.LEVEL_INFO) {
			this.log(message, Logger.LEVEL_INFO, context)
		}
	}
	
 	warning(message, context='main') {
		if (this.level <= Logger.LEVEL_WARNING) {
			this.log(message, Logger.LEVEL_WARNING, context)
		}
	}
	
	error(message, context='main') {
		if (this.level <= Logger.LEVEL_ERROR) {
			this.log(message, Logger.LEVEL_ERROR, context)
		}
	}
	
	critical(message, context='main') {
		if (this.level <= Logger.LEVEL_CRITICAL) {
			this.log(message, Logger.LEVEL_CRITICAL, context)
		}
	}
}

Logger.LEVEL_DEBUG = 0
Logger.LEVEL_INFO = 1
Logger.LEVEL_WARNING = 2
Logger.LEVEL_ERROR = 3
Logger.LEVEL_CRITICAL = 4

// create root logger
Logger.root = new Logger('root', Logger.LEVEL_DEBUG)

if (typeof exports != 'undefined') {
	exports.Logger = Logger
}
