
/**
 * Module dependencies
 */

var debug = require('debug')('pepper');
var jsonp = require('jsonp');
var querystring = require('querystring');
var url = require('url');
var request = require('superagent');

var utils = require('./utils');
var isNode = typeof window !== 'object';


module.exports = Pepper;


function Pepper(options) {
  if (!(this instanceof Pepper)) return new Pepper(options || {});

  if (typeof options.querystring === 'string') {
    this.querystring = options.querystring;
  } else {
    this.querystring = !isNode ? window.location.search.slice(1) : null;
  }

  this.data = utils.parseQS(this.querystring);
  debug('Extracted Query String from parsed url: %s',JSON.stringify(this.data));

  this.status = {};

  if (options.host && /^http/gi.test(options.host)) {
    throw new Error('option `host` must not contain protocol');
  }

  this.host = options.host || this.data.uamip;
  this.port = +(options.port || this.data.uamport);

  this.interval = options.interval ?
    parseInt(options.interval, 10) :
    null;

  if (typeof options.ssl === 'boolean') {
    this.ssl = !!options.ssl;
  } else {
    this.ssl = !isNode ? window.location.protocol === 'https:' : false;
  }

  this.uamservice = options.uamservice ? url.parse(options.uamservice) : 'https://app.paywifigo.me/chilli-uamservice-pap-chap.php';

  this._refreshInterval = null;

  this._jsonpOptions = {
    timeout: +options.timeout || 5000,
    prefix: '__Pepper'
  };

  // calculate API base url (or throw)

  this._baseUrl = utils.getBaseUrl(this.host, this.port, this.ssl);

  if (!this._baseUrl) {
    throw new Error('Cannot determine CoovaChilli JSON API base url');
  }

  // check if uamservice uri is secure

  if (this.uamservice && this.uamservice.protocol !== 'https:') {
    var message = 'warning: uamservice uri is insecure - Password will be sent in cleartext';

    if (console) {
      console.log(message);
    } else {
      alert(message);
    }
  }

  debug('computed CoovaChilli JSON interface baseUrl: %s', this._baseUrl);
}


/**
 * CoovaChilli clientState codes
 *
 * @type {Object}
 */

Pepper.stateCodes = {
  UNKNOWN: -1,
  NOT_AUTH: 0,
  AUTH: 1,
  AUTH_PENDING: 2,
  AUTH_SPLASH: 3
};


/**
 * Pepper supported authentication protocols
 *
 * @type {Array}
 */

Pepper.authProtocols = ['pap', 'chap'];


/**
 * Performs a 'logon' action on CoovaChilli
 *
 * @param  {String} username
 * @param  {String} password
 * @param  {Object} password
 */

Pepper.prototype.logon = function(username, password, options, callback) {

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (typeof callback !== 'function') {
    throw new Error('callback function is required on logon');
  }

  if (typeof options !== 'object') {
    throw new Error('options must be an object');
  }

  if (typeof username !== 'string' || username.length === 0) {
    return callback(new TypeError('username must be a string'));
  }

  if (typeof password !== 'string' || password.length === 0) {
    return callback(new TypeError('password must be a string'));
  }

  if (this.status.clientState === Pepper.stateCodes.AUTH) {
    return callback(new Error('Current clientState is already ' + Pepper.stateCodes.AUTH));
  }

  // check / set authentication protocol

  if (options.protocol) {

    var valid = ~Pepper.authProtocols.indexOf(options.protocol.toLowerCase());

    if (!valid) {
      return callback(new Error('Invalid or unsupported authentication protocol'));
    }

  }

  var protocol = options.protocol ? options.protocol.toLowerCase() : 'chap';

  debug('starting logon for %s - %s - protocol: %s', username, password, protocol);

  // 1. check current status on CoovaChilli

  var self = this;
  debug('starting logon for %s - %s - protocol: %s',this._baseUrl, password, protocol);

  this._api(this._baseUrl + 'status', function(err, data) {

    if (err) return callback(err);

    if (!data.challenge) {
      return callback(new Error('Cannot find a challenge'));
    }

    if (data.clientState === Pepper.stateCodes.AUTH) {
      return callback(new Error('Current clientState is already %s', Pepper.stateCodes.AUTH));
    }

    self.status = data;

    if (self.uamservice && protocol === 'chap') {

      // 2-A. Handle uamservice

      debug('calling uamservice uri: %s', self.uamservice.href);

      self._callUamservice(password, data.challenge, function(err, response) {
        if (err) return callback(err);

        if (!response || !response.chap) {
          return callback(new Error('uamservice response is invalid (missing "chap" field)'));
        }

        debug('obtained uamservice response', response);

        // 3-A. Call logon API

        self._callLogon({
          username: username,
          response: response.chap
        }, callback);

      });

    }
    else if(self.uamservice && protocol === 'pap')
    {
      // 2-B. Handle uamservice pap

      debug('calling uamservice uri: %s', self.uamservice.href);

      self._callUamservice(password, data.challenge, function(err, papPassword) {
        if (err) return callback(err);

        if (!papPassword || !papPassword.pap) {
          return callback(new Error('uamservice response is invalid (missing "pap" field)'));
        }

        debug('obtained uamservice response', papPassword);

        // 3-A. Call logon API

        self._callLogon({
          username: username,
          password: papPassword.pap
        }, callback);

      });
    }

  });

};


/**
 * Performs a 'logoff' action on CoovaChilli
 *
 * @callback {Pepper~onSuccess}
 */

Pepper.prototype.logoff = function(callback) {
  clearInterval(this._refreshInterval);

  var self = this;

  this._api(this._baseUrl + 'logoff', function(err, data) {
    if (data) self.status = data;
    if (callback) callback(err, data);
  });
};


/**
 * Performs a 'refresh' action on CoovaChilli
 *
 * @callback {Pepper~onSuccess}
 */

Pepper.prototype.refresh = function(callback) {
  var self = this;

  this._api(this._baseUrl + 'status', function(err, data) {
    if (data) self.status = data;
    if (callback) callback(err, data);
  });
};


/**
 * Start auto-refresh routine
 * (will update accounting status every {interval}s)
 */

Pepper.prototype.startAutoRefresh = function(interval) {
  if (!interval && !this.interval) return;

  var i = interval || this.interval, self = this;
  clearInterval(this._refreshInterval);

  this._refreshInterval = setInterval(function() {
    self.refresh();
  }, i);

  debug('Auto-refreshing status every %s ms', i);
};


/**
 * Stop auto-refresh routine
 */

Pepper.prototype.stopAutoRefresh = function() {
  clearInterval(this._refreshInterval);
  debug('Stop Auto-refreshing status');
};


/**
 * call logon API
 *
 * @param  {Object}   payload
 * @callback {Pepper~onSuccess}
 */

Pepper.prototype._callLogon = function(payload, callback) {
  var self = this;

  this._api(this._baseUrl + 'logon', payload, function(err, data) {
    if (err) return callback(err);
    if (data) {
      self.status = data;

      if (data.clientState === Pepper.stateCodes.AUTH) {
        self.startAutoRefresh();
      }
    }

    callback(err, data);
  });
};

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

var genQueryString = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).map(function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (Array.isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
      encodeURIComponent(stringifyPrimitive(obj));
};

/**
 * Call uamservice API
 *
 * @param  {String}   username
 * @param  {String}   password
 * @param  {String}   challenge
 * @callback {Pepper~onSuccess}
 */

Pepper.prototype._callUamservice = function(password, challenge, callback) {
  var payload = {
    // username: username, // Not necessary to send the username over the wire only the password + challenge
    password: password,
    challenge: challenge,
    userurl: this.data.userurl //"https://google.com"
  };

  var qs = this.uamservice.query+'&' + querystring.stringify(payload);
  // var qs = this.uamservice.query ? this.uamservice.query + genQueryString(payload) : this.uamservice.query;

  debug('obtained uamservice query String from stringify is: ', qs);
  // null&password=testdev&challenge=4672d2ff0d9c3feb1f2643aa0a5acc81&userurl=

  var uri = this.uamservice.href + '?' + qs;
  debug('obtained uamservice in this.uamservice.href: ', this.uamservice.href);
  // app.paywifigo.me/chilli-uamservice-pap-chap.php
  // uri = app.paywifigo.me/chilli-uamservice-pap-chap.php?null&password=testdev&challenge=4672d2ff0d9c3feb1f2643aa0a5acc81&userurl=
  this._api(uri, this._jsonpOptions, callback);
};


/**
 * Call a JSON API
 *
 * @param  {String} uri
 * @param  {String|Object|null} qs
 * @callback {Pepper~onSuccess}
 */

Pepper.prototype._api = function(uri, qs, callback) {
  if (typeof qs === 'function') {
    callback = qs;
    qs = null;
  } else {
    uri += '?';
  }

  uri += typeof qs === 'string' ? qs : querystring.stringify(qs);

  if (isNode) {
    request
      .get(uri)
      .timeout(this._jsonpOptions.timeout)
      .end(function(err, res) {
        if (err) return callback(err);

        // We have to force JSON.parse on text response here.
        // Why? superagent expect an 'application/json' Content-Type,
        // but CoovaChilli responds with 'text/javascript'

        var data = res.header['content-type'] === 'text/javascript' ?
          JSON.parse(res.text) :
          res.body;

        debug('superagent got', data);
        callback(null, data);
      });
  }
  else {
    debug('non node api orig_uri for uam service: ', uri);
    jsonp(uri, this._jsonpOptions, callback);
  }
};
