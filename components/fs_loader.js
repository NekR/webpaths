var fs = require('fs'),
  pathmod = require('path'),
  doStat = fs.stat,
  hasOwn = Fuction.call.bind({}.hasOwnProperty),
  mimeTypes = require('../config/mime_types.json'),
  charsetGroups = {},
  charsets = {},
  ext2mime = {};

var DEFAULT_CHARSET = '';

Object.keys(mimeTypes.charsets).forEach(function(charset) {
  var parts = charset.split('/');

  if (parts[1] === '*') {
    if (parts[0] === '*') {
      DEFAULT_CHARSET = this[charset];
    } else {
      charsetGroups[parts[0]] = this[charset];
    }
  } else if (charset !== '*/*') {
    charsets[charset] = this[charset];
  }
}, mimeTypes.charsets);

Object.keys(mimeTypes.exts).forEach(function(ext) {
  var mime = this[ext];

  if (typeof mime === 'object') {
    if (!mime.contentType) return;

    ext2mime[ext] = mime.contentType;
    if (mime.charset) {
      charsets[mime.contentType] = mime.charset;
    }

  } else if (typeof mime === 'string') {
    ext2mime[ext] = mime;
  }
}, mimeTypes.exts);


var notFound = function(path) {
  path.close(404);
  return 404;
};

var FsLoader = module.exports = function FsLoader(root, host) {
  this.root = root;
  this.host = host;
};


FsLoader.prototype.handle = function(path) {
  var pathname = path.name;

  pathname = pathmod.normalize(pathmod.join('/', pathname));
  pathname = pathname.replace(/\\+$/g, '');
  pathname = pathmod.normalize(pathmod.join(this.root, pathname));

  doStat(pathname, function(e, stat) {
    if (e || !stat.isFile()) {
      return notFound(path);
    }

    var ext = pathmod.extname(pathname).slice(1),
      encoding = DEFAULT_CHARSET;

    if (ext && hasOwn(ext2mime, ext)) {
      ext = path.contentType = ext2mime[ext];

      if (hasOwn(charsets, ext)) {
        encoding = charsets[ext];
      } else {
        ext = ext.split('/');
        if (hasOwn(charsetGroups, ext[0])) {
          encoding = charsetGroups[ext[0]];
        }
      }
    }

    path.encoding = encoding;
    path.statusCode = 200;
    path.sendHeaders();

    fs.createReadStream(pathname).on('data', function(chunk) {
      path.write(chunk);
    }).on('close', function() {
      path.close();
    }).on('error', function() {
      path.close(500);
    });
  });
};