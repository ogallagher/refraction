/*

cookies.js
Owen Gallagher
29 April 2020

*/

//config
const COOKIE_EXPIRATION = 24 * 60 * 60 * 1000
const COOKIE_MAX_BYTES = 4096 //max number of bytes in a cookie
const COOKIE_MAX_CHARS = COOKIE_MAX_BYTES / 2

cookies_log = new Logger('cookies')

//if cookie is too large, cookie_key --> [cookie_key[0], cookie_key[1], ...]
function cookies_set(key,val) {
	let ctx = 'cookies_set'
    var date = new Date();
    date.setTime(date.getTime() + COOKIE_EXPIRATION);
	
	if (val.length > COOKIE_MAX_BYTES) {
		let i=0
		while (i < val.length) {
			document.cookie = key + '[' + i + ']=' + val.substring(i,COOKIE_MAX_CHARS) + '; expires=' + date.toUTCString() + '; path=/'
			i += COOKIE_MAX_CHARS
		}
	}
	else {
		document.cookie = key + '=' + val + '; expires=' + date.toUTCString() + '; SameSite=LAX; path=/'
	}
	
	cookies_log.debug(`set cookie ${key}=${val}`,ctx)
}

function cookies_get(key) {
	let ctx = 'cookies_get'
    let key_eq = key + '='
    let ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i]
        while (c.charAt(0) == ' ') {
            c = c.substring(1, c.length)
        }
        if (c.indexOf(key_eq) == 0) {
			let val = c.substring(key_eq.length, c.length)
			cookies_log.debug(`cookie ${key} is ${val}`)
            return val
        }
    }
    //no cookie found
	cookies_log.debug(`cookie ${key} not found`,ctx)
    return null
}

function cookies_delete(key) {
	let ctx = 'cookies_delete'
    document.cookie = key + '=; expires=-1; SameSite=LAX; path=/'
	cookies_log.debug(`deleted cookie ${key}`,ctx)
}

function cookies_update(key,val) {
	let ctx = 'cookies_update'
    if (val != null) {
        cookies_set(key,val)
		return val
    }
    else {
        return cookie_get(key)
    }
}
