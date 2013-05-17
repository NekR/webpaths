#!/usr/bin/env node

var wpaths = require('.'),
  args = process.argv.slice(1),
  argsMap = {};

// -c config
// -h host
// -p port 
// -r root [next domain, repeat this]
// -d domain 