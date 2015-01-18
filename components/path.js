var EventEmitter = require('events').EventEmitter,
  urls = require('url');


var COOKIE_PARAMS = {
    domain: 1,
    path: 1,
    expires: 1
  };

var WebPath = module.exports = function WebPath(req, res, options) {
  var self = this;

  EventEmitter.call(this);

  req.on('close', function() {
    // self.close();
  });

  this.request = req;
  this.response = res;
  this.socket = req.socket;
  this[req.method] = true;
  this.url = urls.parse(req.url, true);
  this.cookie = parseCookie(req.headers.cookie);
  this.sendCookie = [];
  this.buffer = [];
  this.data = [];
  this.name = decodeURIComponent(this.url.pathname);
};

WebPath.encodings = {
  utf8: 1,
  'utf-8': 1,
  binary: 1
};

WebPath.prototype = Object.defineProperties({
  _contentType: '',
  _encoding: 'utf-8',
  _bufferLength: 0,
  _contentLength: 0
}, {
  //http://javascript.ru/unsorted/top-10-functions#3-2-i-1-getcookie-setcookie-deletecookie
  setCookie: {
    value: function setCookie(name, value, props) {
      props || (props = {});
      value = encodeURIComponent(value || '');

      var exp,
        cookie = [name + '=' + value],
        httpOnly;

      if (typeof exp == 'number' && exp) {
        var date = new Date();
        date.setTime(date.getTime() + exp);
        exp = props.expires = date
      }

      if (exp && exp.toUTCString) {
        props.expires = exp.toUTCString();
      }

      Object.keys(props).forEach(function(key) {
        if (key.toLowerCase() === 'httponly' && props[key]) {
          httpOnly = true;
          return;
        }

        COOKIE_PARAMS[key] && cookie.push(key + '=' + props[key]);
      });

      httpOnly && cookie.push('HttpOnly');
      this.sendCookie.push(cookie.join('; '));
    }
  },
  send: {
    value: function sendPath(buffer) {
      if (this._firstPackageSent || this.closed) return;

      if (buffer) {
        this.write(buffer);
      }

      this.close(200);
    }
  },
  statusCode: {
    set: function(code) {
      this.response.statusCode = code;
    },
    get: function() {
      return this.response.statusCode;
    }
  },
  contentType: {
    set: function(type) {
      if (this._firstPackageSent) return;
      this._contentType = type;
    },
    get: function() {
      return this._contentType;
    }
  },
  contentLength: {
    set: function(length) {
      if (this._contentLength ||
          this._firstPackageSent ||
          typeof length !== 'number' || !length) return;

      this._contentLength = length;
    },
    get: function() {
      return this._contentLength;
    }
  },
  encoding: {
    get: function() {
      return this._encoding;
    },
    set: function(encoding) {
      if (!(encoding in WebPath.encodings) ||
          this._firstPackageSent) return;

      this._encoding = encoding;
    }
  },
  write: {
    value: function writePathData(buffer) {
      if (!buffer) {
        // console.log('no buffer');
        return;
      }

      if (this.contentLength) {
        // console.log('cont length');
        this._bufferLength += buffer.length;
        this.buffer.push(buffer);
      } else if (!this._firstPackageSent) {
        // console.log('not first package');
        this._bufferLength += buffer.length;
        this.buffer.push(buffer);
        this.sendHeaders(null);
      } else {
        // console.log('write buffer');
        this.response.write(buffer, this.encoding);
      }
    }
  },
  headers: {
    get: function() {
      return this._headers || (this._headers = {});
    }
  },
  sendHeaders: {
    value: function sendHeaders(headers) {
      if (this.closed || this._firstPackageSent) return;

      var response = this.response,
        needClose;

      if (this.headers) {
        Object.keys(this.headers).forEach(function(key) {
          response.setHeader(key, this[key]);
        }, this.headers);
      }

      if (headers) {
        Object.keys(headers).forEach(function(key) {
          response.setHeader(key, this[key]);
        }, headers);
      }

      if (this.sendCookie.length) {
        response.setHeader('Set-Cookie', this.sendCookie);
      }

      if (this.contentType) {
        response.setHeader('Content-Type', this.contentType +
          (this.encoding && this.encoding !== 'binary' ?
           '; charset="' + this.encoding + '"' : ''));
      }

      if (this._bufferLength) {
        // this.contentLength = this._bufferLength;

        if (!this.blocked) {
          needClose = true;
        }
      }

      if (this.contentLength) {
        response.setHeader('Content-Length', this.contentLength);
      }

      response.write(Buffer.concat(this.buffer, this._bufferLength),
                     this.encoding);

      this._firstPackageSent = true;

      if (needClose) {
        this.close();
      }
    }
  },
  close: {
    value: function closePath(code) {
      var force;

      if (this.closed) {
        return;
      }
      
      if (!this._firstPackageSent) {
        if (code) {
          this.statusCode = code;
          this.sendHeaders();
        } else {
          force = true;
        }
      }

      this.closed = true;
      this.response.end();
      this.emit('close', force);
    }
  },
  allow: {
    value: function(data) {
      if (this.blocked) {
        this.blocked = false;
        this.data.unshift(data);
        this.emit('allow', data);
      }
    }
  },
  block: {
    value: function(data) {
      if (!this.blocked) {
        this.blocked = true;
        this.emit('block', data);
      }
    }
  }
});

WebPath.prototype.__proto__ = EventEmitter.prototype;

function parseCookie(string) {
  if (string) {
    string = (string + '').split('; ');

    if (string.length) {
      return string.reduce(function(result, key) {
        key = key.split('=');

        if (key.length) {
          result[decodeURIComponent(key[0])] = decodeURIComponent(key[1]);
        }

        return result;
      }, {});
    }
  }
  return {};
}