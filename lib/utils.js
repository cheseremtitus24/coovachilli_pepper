
/**
 * Module dependencies
 */

var querystring = require('querystring');

/**
 * Get CoovaChilli JSON interface base url
 *
 * @param  {String} host
 * @param  {Number} port
 * @param  {Boolean} ssl
 *
 * @returns {String|null}
 */


var getBaseUrl = exports.getBaseUrl = function(host, port, ssl) {
  var base = null;

  if (host) {
    var protocol = 'http:';
    if (ssl){
      protocol = 'https:';
      port = port ? port : '4990';
    }
    else{
      port = port ? port : '3990';
    }
    base = protocol + '//' + host + ':' +port + '/json/';
  }

  return base;
};

/**
 * Parse CoovaChilli querystring and extract key:value pairs
 *
 * @param  {String} qs
 * @return {Object|null}
 */

var parseQS = exports.parseQS = function(qs) {
  // if (!qs) return {};
  // return querystring.decode(qs);

  if (!qs) return {};

  var data = querystring.parse(qs.slice(1));
  if (!data.loginurl) return {};

  return querystring.parse(data.loginurl);

};


