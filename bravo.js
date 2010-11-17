/**
 *  This file implements a CommonJS Modules/2.0 environment.
 *
 *  Copyright (c) 2010, Wes Garland, wes@page.ca
 *  MIT License
 */
var bravojs;			/**< Namespace object for this implementation */

if (!bravojs)
  bravojs = 
  {
    errorReporter: function bravojs_errorReporter(e)
    {
      alert(" * BravoJS: " + e + "\n" + e.stack);
      throw(e);
    }
  };

try { 

bravojs.reset = function bravojs_reset()
{
  bravojs.requireMemo 		= {};	/**< Module exports, indexed by canonical name */
  bravojs.moduleFactories	= {};	/**< Module factory functions, indexed by canonical name */
  bravojs.mainModuleDir = bravojs.dirname(bravojs.URL_toId(window.location.href));

  delete bravojs.Module.prototype.main;

  /** Extra-module environment */
  window.require = bravojs.requireFactory(bravojs.mainModuleDir);
  window.module  = new (bravojs.Module)(null);
}

/** Print to text to stdout */
bravojs.print = function bravojs_print()
{
  var output="";
  var i;
  var stdout;

  for (i=0; i < arguments.length; i++)
    output += arguments[i] + (i===arguments.length - 1 ? "" : " ");
  output.replace(/\t/, "        ");

  if ((stdout = document.getElementById('stdout')))
  {
    if (typeof stdout.value !== "undefined")
    {
      stdout.value += output + "\n";
      if (stdout.focus)
	stdout.focus();
    }

    if (stdout.tagName === "TEXTAREA")
      stdout.scrollTop = stdout.scrollHeight;
  }
  else if (console && console.print)
  {
    console.print(output);
  }
  else if (console && console.log)
  {
    console.log(output);
  }
  else 
    alert(" * BravoJS stdout: " + output);
}

/** Canonicalize path, compacting slashes and dots per basic UNIX rules.
 *  Treats paths with trailing slashes as though they end with INDEX instead.
 *  Not rigorous.
 */
bravojs.realpath = function bravojs_realpath(path)
{
  if (typeof path !== "string")
    path = path.toString();

  var oldPath = path.split('/');
  var newPath = [];
  var i;

  if (path[path.length - 1] === '/')
    oldPath.push("INDEX");

  for (i = 0; i < oldPath.length; i++)
  {
    if (oldPath[i] == '.' || !oldPath[i].length)
      continue;
    if (oldPath[i] == '..')
    {
      if (!newPath.length)
	throw new Error("Invalid module path: " + path);
      newPath.pop();
      continue;
    }
    newPath.push(oldPath[i]);
  }

  newPath.unshift('');
  return newPath.join('/');
}

/** Extract the non-directory portion of a path */
bravojs.basename = function bravojs_basename(path)
{
  if (typeof path !== "string")
    path = path.toString();

  var s = path.split('/').slice(-1).join('/');
  if (!s)
    return path;
  return s;
}

/** Extract the directory portion of a path */
bravojs.dirname = function bravojs_dirname(path)
{
  if (typeof path !== "string")
    path = path.toString();

  if (path[path.length - 1] === '/')
    return path.slice(0,-1);

  var s = path.split('/').slice(0,-1).join('/');
  if (!s)
    return ".";

  return s;
}

/** Turn a module identifier and module directory into a canonical
 *  module.id.
 */
bravojs.makeModuleId = function makeModuleId(relativeModuleDir, moduleIdentifier)
{
  var id;

  if (moduleIdentifier === null)	/* Special case for main module */
    return null;

  if (moduleIdentifier[0] === '/')
  {
    /* Absolute path. Not required by CommonJS but it makes dependency list optimization easier */
    id = moduleIdentifier
  }
  else
  if ((moduleIdentifier.indexOf("./") == 0) || (moduleIdentifier.indexOf("../") == 0))
  {
    /* Relative module path -- relative to relativeModuleDir */
    id = relativeModuleDir + "/" + moduleIdentifier;
  }
  else
  {
    /* Top-level module. Since we don't implement require.paths,
     *  make it relative to the main module.
     */
    id = bravojs.mainModuleDir + "/" + moduleIdentifier;
  }

  return bravojs.realpath(id);
}

/** Take a module index an turn it into a reference for the moduleFactories or requireMemo objects */
bravojs.makeModuleIndex = function makeModuleIndex(moduleId)
{
  if (moduleId === null)
    return '';

  return moduleId;
}

/** Turn a script URL into a canonical module.id */
bravojs.URL_toId = function URL_toId(moduleURL)
{
  var i;

  /* Treat the whole web as our module repository.
   * http://www.page.ca/a/b/module.js has id /www.page.ca/a/b/module.js. 
   */
  i = moduleURL.indexOf("://");
  if (i == -1)
    throw new Error("Invalid module URL: " + moduleURL);
  id = moduleURL.slice(i + 2);

  id = bravojs.realpath(id);
  if ((i = id.indexOf('?')) != -1)
    id = id.slice(0, i);
  if ((i = id.indexOf('#')) != -1)
    id = id.slice(0, i);

  return id;
}

/** Filter a dependency list so that only unique and previously unprovided 
 *  dependencies appear in the output list. The output list also canonicalizes
 *  the module names relative to the current require.
 */
bravojs.filterDependencies = function bravojs_filterDependencies(long)
{
  var short = [];
  var id, idx;

  for (i=0; i < long.length; i++)
  {
    if (short.indexOf(long[i]) !== -1)
      continue;
    id = require.id(long[i]);

    idx = bravojs.makeModuleIndex(id);

    if (bravojs.requireMemo[idx] || bravojs.moduleFactories[idx] || bravojs.moduleFactories[idx] === null)
      continue;

    short.push(id);
  }

  return short;
}

/** Provide a module to the environment 
 *  @param	dependencies		A dependency array
 *  @param	moduleFactoryFunction	The function which will eventually be invoked
 *					to decorate the module's exports. If not specified,
 *					we assume the factory has already been memoized in
 *					the bravojs.moduleFactories object.
 *  @param	id			The module.id of the module we're providing
 *  @param	callback		Optional function to run after the module has been
 *					provided to the environment
 */
bravojs.provideModule = function bravojs_provideModule(dependencies, moduleFactory, 
						       id, callback)
{
  if (moduleFactory)
    bravojs.moduleFactories[bravojs.makeModuleIndex(id)] = moduleFactory;

  if (dependencies)
  {
    module.provide(dependencies, callback);
  }
  else
  {
    if (callback)
      callback();
  }
}

/** Initialize a module. This makes the exports object available to require(),
 *  runs the module factory function, and removes the factory function from
 *  the moduleFactories object.
 */
bravojs.initializeModule = function bravojs_initializeModule(id)
{
  var moduleDir     = id ? bravojs.dirname(id) : bravojs.mainModuleDir;

  var idx	    = bravojs.makeModuleIndex(id);
  var moduleFactory = bravojs.moduleFactories[idx];

  delete bravojs.moduleFactories[idx];
  bravojs.requireMemo[idx] = {};

  moduleFactory(bravojs.requireFactory(moduleDir), 	/* require */
		bravojs.requireMemo[idx],		/* exports */
		new bravojs.Module(id));		/* module */
}

/** Search the module memo and return the correct module's exports, or throw.
 *  Searching the module memo will initialize a matching pending module factory.
 */
bravojs.requireModule = function bravojs_requireModule(parentModuleDir, moduleIdentifier)
{
  var id;
  var idx;

  try 
  {
    id = bravojs.makeModuleId(parentModuleDir, moduleIdentifier);
    idx = bravojs.makeModuleIndex(id);

    if (!bravojs.requireMemo[idx] && bravojs.moduleFactories[idx])
      bravojs.initializeModule(id);
  } 
  catch(e) 
  { 
    bravojs.errorReporter(e); 
  };
  
  if (!bravojs.requireMemo[idx])
    throw new Error("Module " + id + " is not available.");

  return bravojs.requireMemo[idx];
}

/** Create a new require function, closing over it's path so that relative
 *  modules work as expected.
 */
bravojs.requireFactory = function bravojs_requireFactory(moduleDir)
{
  var newRequire = function require(moduleIdentifier) 
  {
    return bravojs.requireModule(moduleDir, moduleIdentifier);
  }

  newRequire.id = function require_id(moduleIdentifier)
  {
    return bravojs.makeModuleId(moduleDir, moduleIdentifier);
  }

  newRequire.canonicalize = function require_canonicalize(moduleIdentifier)
  {
    var id = bravojs.makeModuleId(moduleDir, moduleIdentifier);

    if (id === null)
      throw new Error("Cannot canonically name the resource bearing this main module");

    return window.location.protocol + "/" + id + ".js";
  }

  return newRequire;
}

/** Module object constructor */
bravojs.Module = function bravojs_Module(id)
{
  this.id   	 = id;
  this.protected = void 0;
}

/** A module.declare suitable for use during DOM SCRIPT-tag insertion.
 * 
 *  The general technique described below was invented by Kris Zyp.
 *
 *  In non-IE browsers, the script's onload event fires as soon as the 
 *  script finishes running, so we just memoize the declaration without
 *  doing anything. After the script is loaded, we do the "real" work
 *  as the onload event also supplies the script's URI, which we use
 *  to generate the canonical module id.
 * 
 *  In IE browsers, the event can fire when the tag is being inserted
 *  in the DOM, or sometime thereafter. In the first case, we read a 
 *  memo we left behind when we started inserting the tag; in the latter,
 *  we look for interactive scripts.
 *
 *  Event			Action		
 *  -------------------------   ------------------------------------------------------------------------------------
 *  Inject Script Tag		onload event populated with URI
 *				scriptTagMemo populated with URI
 *  IE pulls from cache		cname derived in module.declare from scriptTagMemo, invoke provideModule
 *  IE pulls from http		cname derived in module.declare from script.src, invoke provideModule
 *  Non-IE loads script		onload event triggered, most recent incomplete module.declare is completed, 
 *				deriving the cname from the onload event.
 */
bravojs.Module.prototype.declare = function bravojs_Module_declare(dependencies, moduleFactory)
{
  if (typeof dependencies === "function")
  {
    moduleFactory = dependencies;
    dependencies = null;
  }

  if (document.addEventListener)	/* non-IE, defer work to script's onload event which will happen immediately */
  {
    bravojs.scriptTagMemo = { dependencies: dependencies, moduleFactory: moduleFactory };
    return;
  }

  if (bravojs.scriptTagMemo.cname) 	/* IE, pulling from cache */
  {
    bravojs.provideModule(dependencies, moduleFactory, bravojs.scriptTagMemo.id);
    return;
  }

  /* Assume IE fetching from remote */
  var scripts = document.getElementsByTagName("SCRIPT");
  var i;

  for (i = 0; i < scripts.length; i++)
  {
    if (scripts[i].readyState == "interactive")
    {
      bravojs.provideModule(dependencies, moduleFactory, bravojs.URL_toId(scripts[i].src));
      return;
    }
  }

  throw new Error("Could not determine module's canonical name from script-tag loader");
}

/** A module.provide suitable for a generic web-server back end.  Loads one module at
 *  a time in continuation-passing style, eventually invoking the passed callback.
 * 
 *  A more effecient function could be written to take advantage of a web server
 *  which might aggregate and transport more than one module per HTTP request.
 *
 *  @param	dependencies	A dependency array
 *  @param	callback	The callback to invoke once all dependencies have been
 *				provided to the environment.
 */
bravojs.Module.prototype.provide = function bravojs_Module_provide(dependencies, callback)
{
  var self = arguments.callee;
  if ((typeof dependencies !== "object") || (dependencies.length !== 0 && !dependencies.length))
    throw new Error("Invalid dependency array: " + dependencies.toSource());

  dependencies = bravojs.filterDependencies(dependencies);

  if (dependencies.length === 0)
  {
    callback();
    return;
  }

  module.load(dependencies[0], function bravojs_lambda_provideNextDep() { self(dependencies.slice(1), callback) });
}

/** A module.load suitable for a generic web-server back end. The module is
 *  loaded by injecting a SCRIPT tag into the DOM.
 *
 *  @param	moduleIdentifier	Module to load
 *  @param	callback		Callback to invoke when the module has loaded.
 *
 *  @see	bravojs_Module_declare
 */
bravojs.Module.prototype.load = function bravojs_Module_load(moduleIdentifier, callback)
{
  var script = document.createElement('SCRIPT');
  script.setAttribute("type","text/javascript");
  script.setAttribute("src", require.canonicalize(moduleIdentifier) + "?1" + Date.now());

  if (document.addEventListener)	/* Non-IE; see bravojs_Module_declare */
  {
    script.onerror = function bravojs_lambda_script_onerror(e) 
    { 
      var id, idx, scripts

      id = require.id(moduleIdentifier);
      idx = bravojs.makeModuleIndex(id);
      bravojs.moduleFactories[idx] = null;	/* Mark null so we don't try to run, but also don't try to reload */
      callback();
    }

    script.onload = function bravojs_lambda_script_onload()
    {
      /* stm contains info from recently-run module.declare() */
      var stm = bravojs.scriptTagMemo;
      if (typeof stm === "undefined")
	throw new Error("Module '" + moduleIdentifier + "' did not invoke module.declare!");

      delete bravojs.scriptTagMemo;
      bravojs.provideModule(stm.dependencies, stm.moduleFactory, require.id(moduleIdentifier), callback);
    }
  }
  else
  {
    alert('XXX NOT YET IMPLEMENTED');
  }

  document.getElementsByTagName("HEAD")[0].appendChild(script);
}

/** Main module bootstrap */
bravojs.initializeMainModule = function bravojs_initializeMainModule(dependencies, moduleFactory, moduleIdentifier)
{
  if (module.hasOwnProperty("declare"))		/* special extra-module environment bootstrap declare needs to go */
    delete module.declare;

  if (module.constructor.prototype.main)
    throw new Error("Main module has already been initialized!");

  module.constructor.prototype.main = module;

  bravojs.provideModule(dependencies, moduleFactory, moduleIdentifier, function bravojs_lambda_requireMain() { require(moduleIdentifier) });
}

/** Run a module which is not declared in the HTML document and make it the program module.
 *  @param	dependencies		[optional]	A list of dependencies to sastify before running the mdoule
 *  @param	moduleIdentifier	moduleIdentifier, relative to dirname(window.location.href). This function
 *					adjusts the module path such that the program module's directory is the
 *					top-level module directory before the dependencies are resolved.
 *  @param	callback		[optional]	Callback to invoke once the main module has been initialized
 */
bravojs.runExternalMainModule = function bravojs_runExternalProgram(dependencies, moduleIdentifier, callback)
{
  if (arguments.length === 1 || typeof moduleIdentifier === "function")
  {
    callback = moduleIdentifier;
    moduleIdentifier = dependencies;
    dependencies = [];
  }

  delete module.declare;

  if (moduleIdentifier[0] === '/')
    bravojs.mainModuleDir = bravojs.dirname(moduleIdentifier);
  else
    bravojs.mainModuleDir = bravojs.dirname(bravojs.URL_toId(window.location.href)) + "/" + bravojs.dirname(moduleIdentifier);

  moduleIdentifier = bravojs.basename(moduleIdentifier);
  module.provide(dependencies.concat([moduleIdentifier]), 
		 function bravojs_runMainModule() 
		 {
		   bravojs.initializeMainModule(dependencies, null, moduleIdentifier);
		   if (callback)
		     callback();
		 });
}

bravojs.reset();

(function bravojs_setURL()
{
  var i;
  var script;

  script = document.getElementById("BravoJS");
  if (!script)
    script = document.getElementsByTagName("SCRIPT")[0];

  bravojs.url = script.src;
  i = bravojs.url.indexOf("?");
  if (i !== -1)
    bravojs.url = bravojs.url.slice(0,i);
  i = bravojs.url.indexOf("#");
  if (i !== -1)
    bravojs.url = bravojs.url.slice(0,i);

  if (bravojs.basename(bravojs.url) !== "bravo.js")
    throw new Error("Could not determine BravoJS URL. BravoJS must be the first script, or have id='BravoJS'");
})();

/** Diagnostic Aids */
var print   = bravojs.print;
if (!window.onerror)
{
  window.onerror = function window_onerror(message, url, line) 
  { 
    var scripts, i;
    var id, idx;

    print("\n * Error: " + message + "\n" + 
          "      in: " + url + "\n" + 
          "    line: " + line);  
  }
}

/* Module.declare function which handles main modules inline SCRIPT tags.
 * This function gets deleted as soon as it runs, allowing the module.declare
 * from the prototype take over.
 */
module.declare = function main_module_declare(dependencies, moduleFactory)
{
  if (typeof dependencies === "function")
  {
    moduleFactory = dependencies;
    dependencies = null;
  }

  bravojs.initializeMainModule(dependencies, moduleFactory, null);
}

} catch(e) { bravojs.errorReporter(e); }







