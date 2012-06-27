const EventEmitter = require('events').EventEmitter,
  urls = require('url');


var WebPath = module.exports = function WebPath(req, res, options) {
  EventEmitter.call(this);
  var self = this;

  req.on('close', function() {
    self.close();
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
};

WebPath.prototype = Object.defineProperties({
  contentType: 'text/plain'
}, {
  //http://javascript.ru/unsorted/top-10-functions#3-2-i-1-getcookie-setcookie-deletecookie
  setCookie: {
    value: function setCookie(name, value, props) {
      props || (props = {});

      value = encodeURIComponent(value || '');

      var exp,
        cookie = [name + '=' + value];

      if (typeof exp == "number" && exp) {
        var d = new Date();
        d.setTime(d.getTime() + exp);
        exp = props.expires = d
      }

      if(exp && exp.toUTCString) {
        props.expires = exp.toUTCString();
      }

      Object.keys(props, function(key) {
        cookie.push(key + '=' + props[key]);
      });

      this.sendCookie.push(cookie.join('; '));

    }
  },
  send: {
    value: function sendPath(buffer) {

      this.write(buffer);

      this.close(200);

    }
  },
  write: {
    value: function writePathData(buffer) {
      if (buffer) {
        this.buffer.push(buffer.toString(this.encoding));
      }
    }
  },
  close: {
    value: function closePath(code) {

      if (this.closed) {
        return;
      }

      var force;

      if (code) {
        this.response.statusCode = code;

        if (this.sendCookie.length) {
          this.response.setHeader('Set-Cookie', this.sendCookie);
        }

        this.response.setHeader('Content-Type', this.contentType);

        this.response.write(this.buffer.join(''));
      } else {
        force = true;
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
  var cookie = {};
  if (string) {
    string = (string + '').split('; ');

    if (string.length) {

      string.forEach(function(key) {
        key = key.split('=');

        if (key.length) {
          cookie[key[0]] = decodeURIComponent(key[1]);
        }

      });

      return cookie;

    }

  }

  return cookie;
}