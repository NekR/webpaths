"use strict";

var EventEmitter = require('events').EventEmitter,
  pathmod = require('path'),
  fs = require('fs'),
  web = require('../'),
  isArray = Array.isArray;

var DEFAULT_CONFIG = {
    encoding: 'utf8',
    root: null
  };

var VirtualHost = module.exports = function VirtualHost(config, server) {
  var self = this,
    domain,
    root,
    stat;

  EventEmitter.call(this);

  this.server = server;

  this.config = {};

  Object.keys(DEFAULT_CONFIG).forEach(function(key) {
    this.config[key] = config[key] || DEFAULT_CONFIG[key];
  }, this);

  config = this.config;
  domain = config.domain || server.config.host;

  if (domain.length > 2 &&
      domain[0] === '/' &&
      domain[domain.length - 1] === '/') {
    this.checkDomain =
      new Function('input', 'return ' + domain + '.test(input);');
  } else {
    this.checkDomain = function(input) {
      return input === domain;
    };
  }

  if (config.root && typeof config.root === 'string') {
    root = pathmod.resolve(process.cwd(), config.root);
    stat = fs.statSync(root);
    if (stat && stat.isDirectory()) {
      this.fsLoader = new web.FsLoader(root, this);
    }
  }

  this.on('path', function(path) {
    var paths = [],
      cursor = 0;

    var execPath = function() {
      if (cursor >= paths.length) {
        path.close();
        return;
      }

      if (path.closed) return;

      var listeners = self.paths[paths[cursor]];

      if (isArray(listeners) && listeners.length) {
        listeners.forEach(function(listener) {
          listener.call(this, path);
        }, this);
      }

      cursor++;

      if (!path.blocked) {
        execPath();
      } else if (!path.closed) {
        var clean = function() {
            path.removeListener('allow', allowAgain);
            path.removeListener('close', clean);
          },
          allowAgain = function() {
            clean();
            execPath();
          };

        path.on('allow', allowAgain);
        path.on('close', clean);
      }
    };

    if (this.paths) {
      Object.keys(this.paths).forEach(function(pathname) {
        var pathReg = new RegExp(pathname);
        if (pathReg.test(path.name)) {
          paths.push(pathname);
        }
      });
    }

    if (paths.length) {
      paths.sort(function(first, second) {
        first = first.split('/');
        second = second.split('/');
        return first < second ? -1 : first > second ? 1 : 0;
      });

      execPath();
    } else if (this.fsLoader) {
      this.fsLoader.handle(path);
    } else {
      path.close();
    }

  }.bind(this));

};

VirtualHost.prototype.__proto__ = EventEmitter.prototype;

Object.defineProperties(VirtualHost.prototype, {
  path: {
    value: function listenWebPath(pathname, callback) {
      var paths = this.paths || (this.paths = {});

      pathname = '^' + pathmod.normalize(pathname)
        .replace(new RegExp('\\' + pathmod.sep, 'g'), '/')
        .replace(/\*/g, '(.*)') + '$';
      paths = paths[pathname] || (paths[pathname] = []);
      paths.push(callback);

      return this;
    }
  }
});