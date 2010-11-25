/**
 *  This file implements an alternate module loader for an arbitrary
 *  CommonJS Modules/2.0 environment.
 *
 *  This loader implements file-at-a-time loading against a standard web 
 *  server via Ryan Grove's LazyLoad.js library rather than the environment's
 *  native module loader.
 *
 *  Copyright (c) 2010, PageMail, Inc.
 *  Wes Garland, wes@page.ca
 *  MIT License
 *
 *  To use: Load the lazy load library and BravoJS, then layer this loader in
 *  by loading it into the extra-module environment.
 */

(function wonkoll() {

var loading;

if (module.constructor.prototype.load === null)
  throw new Error("Sorry, your CommonJS environment does not support alternate module loaders");

module.constructor.prototype.load = function wonko_load(moduleIdentifier, callback)
{
  var URL = require.canonicalize(moduleIdentifier) + "?1";

  if (loading)
    throw new Error("Bug");

  loading = { id: require.id(moduleIdentifier), callback: callback };

  LazyLoad.js(URL);
}

module.constructor.prototype.declare = function wonko_declare(dependencies, moduleFactory)
{
  var id = loading.id;
  var callback = loading.callback;
  loading = void 0;

  if (typeof dependencies === "function")
  {
    moduleFactory = dependencies;
    dependencies = [];
  }

  require.memoize(id, dependencies, moduleFactory);
  module.provide(dependencies, callback);
}

})();
