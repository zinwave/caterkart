// CloudFront viewer-request function for the CaterKart Celebrations SPA.
//
// WHY THIS EXISTS
//
// This is a plain Vite + react-router SPA — nothing is prerendered, so unlike
// the Zinwave site there is no clean-URL-to-.html mapping to do. But S3 behind
// Origin Access Control is still a key-value store, and `/invite/abc123` is not
// a key. Without a rewrite every deep link would miss.
//
// Deep links are not an edge case here: the whole guest flow is a link pasted
// into a group chat (`/invite/:token`, `/work/join/:token`), opened cold by
// someone who has never loaded the app. Those URLs must resolve on first hit.
//
// Rewriting here rather than relying only on the 403 → index.html error mapping
// means a genuinely missing asset still returns 404 instead of being handed to
// the browser as a 200 full of HTML.

function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var host = request.headers.host ? request.headers.host.value : '';

  // 1. One canonical host: www.caterkart.in → caterkart.in, permanently.
  if (host.indexOf('www.') === 0) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://' + host.substring(4) + uri + querystring(request) },
      },
    };
  }

  // 2. Trailing slashes: the router never emits them, so `/orders/` is `/orders`.
  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {
    uri = uri.substring(0, uri.length - 1);
  }

  // 3. A last segment with no dot is an application route — serve the shell and
  //    let react-router take it from there, with the browser's URL unchanged.
  //    Anything with an extension (`/assets/app-BGRIXqQa.js`, `/favicon.svg`)
  //    is a real object and is passed through untouched, so a missing one 404s
  //    honestly instead of resolving to the shell.
  if (uri === '' || uri === '/') {
    request.uri = '/index.html';
  } else if (uri.lastIndexOf('.') <= uri.lastIndexOf('/')) {
    request.uri = '/index.html';
  } else {
    request.uri = uri;
  }

  return request;
}

/** Rebuild the query string for the redirect above, preserving repeated keys. */
function querystring(request) {
  var qs = request.querystring;
  var keys = Object.keys(qs);
  if (keys.length === 0) return '';

  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = qs[key];
    if (value.multiValue) {
      for (var j = 0; j < value.multiValue.length; j++) {
        parts.push(pair(key, value.multiValue[j].value));
      }
    } else {
      parts.push(pair(key, value.value));
    }
  }
  return '?' + parts.join('&');
}

function pair(key, value) {
  return value === '' ? key : key + '=' + value;
}
