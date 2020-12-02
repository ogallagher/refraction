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
	
	constructor(name, level=Logger.LEVEL_DEBUG) {
		/*
		Logger constructor.
		*/
		
		this.name = name
		this.level = level
	}
	
	log(message, level=Logger.LEVEL_DEBUG, context='main') {
		if (level >= this.level) {
			if ((typeof message) != 'string') {
				message = JSON.stringify(message)
			}
			
			console.log(`${this.name}.${context}.${Logger.level_name(level)}: ${message}`)
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

if (typeof exports != 'undefined') {
	exports.Logger = Logger
}
