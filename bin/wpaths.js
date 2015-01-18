#!/usr/bin/env node

var paths = require('path');
var util = require('util');
var os = require('os');
var minimist = require('minimist');
var modDir = __dirname + paths.sep + '..';
var hasOwn = {}.hasOwnProperty;
var slice = [].slice;

var console = {};
var doInspect = function(data) {
  return util.inspect(data, {
    colors: true,
    customInspect: false
  });
};

Object.keys(global.console).forEach(function(key) {
  console[key] = function(data) {
    var method = global.console[key];
    var args = arguments;

    if (!args.length) {
      method.call(global.console);
      return;
    }

    if (args.length === 1) {
      method.call(global.console, doInspect(args[0]));
      return;
    }

    if (args.length === 2) {
      method.call(global.console, doInspect(args[0]), doInspect(args[1]));
      return;
    }

    args = slice.call(arguments).map(function(arg) {
      return doInspect(arg);
    });

    method.apply(global.console, args);
  };
});


var defaultArgs = {
  domain: null,
  root: process.cwd(),
  host: '*',
  port: 8080
};

var argsAliases = {
  c: 'config',
  h: 'host',
  p: 'port',
  r: 'root',
  d: 'domain'
};

var wpaths = require(modDir);
var slicedArgs = process.argv.slice(process.argv[0] === 'node' ? 2 : 1);

var args = minimist(slicedArgs, {
  default: defaultArgs,
  alias: argsAliases
});

var config = {
  hosts: [],
  domains: []
};

var mapPairs = function(pairs) {
  var arr = [];
  var keys = Object.keys(pairs);
  var pairsSize = keys.map(function(key) {
    var item = pairs[key];

    if (!Array.isArray(item)) {
      item = pairs[key] = [item];
    }

    return item.length;
  });

  var i = 0;
  var len = Math.max.apply(null, pairsSize);
  for (; i < len; i++) {
    var obj = keys.reduce(function(result, key) {
      result[key] = pairs[key][i];

      return result;
    }, {});

    arr.push(obj);
  }

  return arr;
};

if (args.host === '*') {
  var port = [].concat(args.port)[0];
  var interfaces = os.networkInterfaces();

  Object.keys(interfaces).forEach(function(name) {
    var intr = interfaces[name].filter(function(obj) {
      return obj.family === 'IPv4';
    })[0];

    if (intr) {
      var host = intr.address;

      config.hosts.push({
        name: name,
        host: host,
        port: port
      });
    }
  });
} else {
  config.hosts = mapPairs({
    port: args.port,
    host: args.host
  });
}

config.domains = mapPairs({
  root: args.root,
  domain: args.domain
});

console.log('--SERVERS--');
config.hosts.forEach(function(serverData) {
  var server = new wpaths.Server(serverData);
  var defaultRoot;
  var gotDefaultDomain;

  console.log(serverData);

  config.domains.concat().forEach(function(domain) {
    if (!domain.domain) {
      if (gotDefaultDomain) {
        throw new Error('Cannot make more than one default domain', serverData, domain);
      }

      delete domain.domain;
      gotDefaultDomain = true;
      defaultRoot = domain.root;
    }

    server.addHost(domain);
  });

  if (serverData.host === '127.0.0.1' && defaultRoot) {
    server.addHost({
      domain: 'localhost',
      root: defaultRoot
    });
  }
});
console.log('--DOMAINS--');
console.log(config.domains);


