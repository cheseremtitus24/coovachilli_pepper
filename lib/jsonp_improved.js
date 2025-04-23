/**
 * Module dependencies
 */

var debug = require('debug')('jsonp');

/**
 * Module exports.
 */

module.exports = jsonp;

/**
 * Callback index.
 */

var count = 0;

/**
 * Noop function.
 */

function noop(){}

/**
 * JSONP handler
 *
 * Options:
 *  - param {String} qs parameter (`callback`)
 *  - timeout {Number} how long after a timeout error is emitted (`60000`)
 *
 * @param {String} url
 * @param {Object|Function} optional options / callback
 * @param {Function} optional callback
 */

// Redone jsonp so that it handles CORS during cross domain logon
function jsonp(url, opts, fn){
    if ('function' == typeof opts) {
        fn = opts;
        opts = {};
    }
    if (!opts) opts = {};

    var prefix = opts.prefix || '__jp';
    var param = opts.param || 'callback';
    var timeout = null != opts.timeout ? opts.timeout : 60000;
    var enc = encodeURIComponent;
    var target = document.getElementsByTagName('script')[0] || document.head;
    var script;
    var timer;

    // generate a unique id for this request
    var id = prefix + (count++);

    if (timeout) {
        timer = setTimeout(function(){
            cleanup();
            // check if url contains logon string.
            if(url.includes('json/logon?'))
            {
                data = {
                    "version": "1.0",
                    "clientState": 1,
                    "nasid": "roamnas01",
                    "message": "You alloted time has expired Please TopUp",
                    "challenge": "3caf546abed65785cfafdb33ac9416ac",
                    "redir": {
                        "originalURL": "http://www.msftconnecttest.com/connecttest.txt",
                        "redirectionURL": "",
                        "logoutURL": "http://10.1.0.1:3990/logoff",
                        "ipAddress": "10.1.0.3",
                        "macAddress": "48-45-20-EF-AD-67"
                    }
                };
                fn(null, data);
            }else{
                if (fn) fn(new Error('Timeout'));
            }
        }, timeout);
    }

    function cleanup(){
        if (script.parentNode) script.parentNode.removeChild(script);
        window[id] = noop;
        if (timer) clearTimeout(timer);
    }

    function cancel(){
        if (window[id]) {
            cleanup();
        }
    }

    window[id] = function(data){
        debug('jsonp got', data);
        cleanup();
        if (fn) fn(null, data);
    };

    // add qs component
    url += (~url.indexOf('?') ? '&' : '?') + param + '=' + enc(id);
    url = url.replace('?&', '?');

    debug('jsonp req "%s"', url);

    // create script
    script = document.createElement('script');
    script.src = url;
    target.parentNode.insertBefore(script, target);

    return cancel;
}
