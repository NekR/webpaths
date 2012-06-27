const net = require('net'),
  EventEmitter = require('events').EventEmitter,
  FreeList = require('freelist').FreeList,
  HTTPParser = process.binding('http_parser').HTTPParser,
  STATUS_CODE = require('http').STATUS_CODES;



