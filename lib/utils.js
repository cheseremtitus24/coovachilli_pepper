
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

// var parseQS = exports.parseQS = function (qs, options) {
//   // if (!qs) return {};
//   // return querystring.decode(qs);
//
//   if (!qs) return {};
//
//   var data = querystring.parse(qs.slice(1));
//   if (!data.loginurl) return {};
//
//   return querystring.parse(data.loginurl);
//
// };



exports.parseQS = async function parseQS(qs,options) {
    console.log("Parsing - Reconstructing the Query String.")
  if (!qs) {
    // If empty, fallback to JSONP
    console.log("Falling Back to Jsonp to reconstruct the query string from json/status");
    return await getStatusFromJSONP(options);
  }

  const data = querystring.parse(qs.startsWith('?') ? qs.slice(1) : qs);
  if (!data.loginurl) return {};

  return querystring.parse(data.loginurl);
};

/**
 * JSONP handler that loads status from CoovaChilli and returns a parsed query object.
 * Works in the browser environment only.
 */
function getStatusFromJSONP(options) {
  return new Promise((resolve, reject) => {
    const CALLBACK_NAME = 'handleStatusResponse_' + Date.now();
    const SCRIPT_ID = 'jsonp-script-' + Date.now();
    const TIMEOUT_MS = 5000;

    window[CALLBACK_NAME] = function (data) {
      clearTimeout(timeoutHandle);
      cleanup();

      if (!data || typeof data !== 'object') {
        resolve({});
        return;
      }

      const query = convertJSONPResponseToQuery(data);
      resolve(query);
    };

    function cleanup() {
      const script = document.getElementById(SCRIPT_ID);
      if (script) script.remove();
      delete window[CALLBACK_NAME];
    }

    const timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, TIMEOUT_MS);

    const scheme = options.ssl ? 'https' : 'http';
    const script = document.createElement('script');
    script.src = `${scheme}://${options.host}:${options.port}/json/status?callback=${CALLBACK_NAME}`;
    script.id = SCRIPT_ID;
    script.onerror = () => {
      clearTimeout(timeoutHandle);
      cleanup();
      reject(new Error('JSONP request failed to load'));
    };

    document.body.appendChild(script);
  });
}

/**
 * Converts CoovaChilli JSONP response into a flattened query object.
 */

function convertJSONPResponseToQuery(response) {
  return `nasid=${response.nasid || ''}&&challenge=${response.challenge || ''}&&userurl=${response.redir && response.redir.originalURL ? response.redir.originalURL : ''}&&logouturl=${response.redir && response.redir.logoutURL ? response.redir.logoutURL : ''}&&uamip=${response.redir && response.redir.ipAddress ? response.redir.ipAddress : ''}&&mac=${response.redir && response.redir.macAddress ? response.redir.macAddress : ''}`;
  return {
    version: response.version || '',
    clientState: response.clientState || '',
    nasid: response.nasid || '',
    challenge: response.challenge || '',
    location: response.location && response.location.name ? response.location.name : '',
    userurl: response.redir && response.redir.originalURL ? response.redir.originalURL : '',
    logouturl: response.redir && response.redir.logoutURL ? response.redir.logoutURL : '',
    uamip: response.redir && response.redir.ipAddress ? response.redir.ipAddress : '',
    mac: response.redir && response.redir.macAddress ? response.redir.macAddress : ''
  };
}



