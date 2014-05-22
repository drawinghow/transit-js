// Copyright (c) Cognitect, Inc.
// All rights reserved.

"use strict";

goog.provide("com.cognitect.transit.decoder");
goog.require("com.cognitect.transit.delimiters");
goog.require("com.cognitect.transit.caching");
goog.require("com.cognitect.transit.types");

goog.scope(function() {

var decoder = com.cognitect.transit.decoder,
    d       = com.cognitect.transit.delimiters,
    caching = com.cognitect.transit.caching,
    types   = com.cognitect.transit.types;

// =============================================================================
// Decoder

/**
 * A transit decoder
 * @constructor
 */
decoder.Decoder = function(options) {
    this.options = options || {};
    this.decoders = {};
    for(var decoder in this.defaults.decoders) {
        this.decoders[decoder] = this.defaults.decoders[decoder];
    }
    for(var decoder in this.options.decoders) {
        this.decoders[decoder] = this.options.decoders[decoder];
    }
    this.defaultStringDecoder = this.options.defaultStringDecoder || this.defaults.defaultStringDecoder;
    this.defaultMapBuilder = this.options.defaultMapBuilder || this.defaults.defaultMapBuilder;
};


decoder.Decoder.prototype.defaults = {
    decoders: {
        "_": function(v) { return types.nullValue(); },
        "?": function(v) { return types.boolValue(v); },
        "b": function(v) { return types.binary(v); },
        "i": function(v) { return types.intValue(v); },
        "d": function(v) { return types.floatValue(v); },
        "f": function(v) { return types.bigDecimalValue(v); },
        "c": function(v) { return types.charValue(v); },
        ":": function(v) { return types.keyword(v); },
        "$": function(v) { return types.symbol(v); },
        "r": function(v) { return types.uri(v); },

        // tagged
        "'": function(v) { return v; },
        "t": function(v) { return types.date(v); },
        "u": function(v) { return types.uuid(v); },
        "set": function(v) { return types.set(v); },
        "list": function(v) { return types.list(v); },
        "ints": function(v) { return types.ints(v); },
        "longs": function(v) { return types.longs(v); },
        "floats": function(v) { return types.floats(v); },
        "doubles": function(v) { return types.doubles(v); },
        "bools": function(v) { return types.bools(v); },
        "cmap": function(v) { return types.cmap(v); }
    },
    defaultStringDecoder: function(v) {
        return d.RES+v;
    },
    defaultMapBuilder: {
        init: function() { return {}; },
        add: function(m, k, v) { m[k] = v; return m; }
    },
    prefersStrings: true
};

decoder.Decoder.prototype.decode = function(node, cache, asMapKey) {
    cache = cache || new caching.ReadCache();
    asMapKey = asMapKey || false;

    if(node == null) return null;

    var t = typeof node;

    switch(t) {
    case "string":
        return this.decodeString(node, cache, asMapKey);
        break;
    case "object":
        if(Array.isArray(node)) {
            return this.decodeArray(node, cache);
        } else {
            return this.decodeHash(node, cache, asMapKey);
        }
        break;
    }

    return node;
};

decoder.Decoder.prototype.decodeString = function(string, cache, asMapKey) {
    if(caching.isCacheable(string, asMapKey)) {
        var val    = this.parseString(string, cache, asMapKey),
            mapKey = this.parseString(string, cache, true);
        cache.write(val, mapKey);
        return val;
    } else if(caching.isCacheCode(string)) {
        return cache.read(string, asMapKey);
    } else {
        return this.parseString(string, cache, asMapKey);
    }
};

decoder.Decoder.prototype.decodeHash = function(hash, cache, asMapKey) {
    var ks     = Object.keys(hash),
        key    = ks[0],
        tagKey = ks.length == 1 ? this.decode(key, cache, false) : null;

    if((tagKey != null) &&
       (tagKey[0] === d.ESC) &&
       (tagKey[1] === d.TAG)) {
        var val     = hash[key],
            decoder = this.decoders[tagKey.substring(2)];
        if(decoder != null) {
            return decoder(this.decode(val, cache, false));
        } else {
            return types.taggedValue(tagKey.substring(2), this.decode(val, cache, false));
        }
    } else {
        var ret = this.defaultMapBuilder.init();
        for(var i = 0; i < ks.length; i++) {
            var key  = ks[i],
                skey = this.decode(key, cache, true);
            ret = this.defaultMapBuilder.add(ret, skey, this.decode(hash[key], cache, false));
        }
        if(this.defaultMapBuilder.finalize != null) {
            return this.defaultMapBuilder.finalize(ret);            
        } else {
            return ret;
        }
    }
};

decoder.Decoder.prototype.decodeArray = function(node, cache, asMapKey) {
    var res = [];
    for(var i = 0; i < node.length; i++) {
        res.push(this.decode(node[i], cache, asMapKey));
    }
    return res;
},

decoder.Decoder.prototype.parseString = function(string, cache, asMapKey) {
    if(string[0] === d.ESC) {
        var c = string[1];
        if(c === d.ESC || c === d.SUB || c === d.RES) {
            return string.substring(1);
        } else if (c === d.TAG) {
            return string;
        } else {
            var decoder = this.decoders[c];
            if(asMapKey == true || decoder == null) {
                return this.defaultStringDecoder(string);
            } else {
                return decoder(string.substring(2));
            }
        }
    } else {
        return string;
    }
};

});
