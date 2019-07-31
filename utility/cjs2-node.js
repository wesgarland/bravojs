/**
 *  @file       cjs2-node.js            Compatibility layer for Node.js which allows
 *                                      us to execute basic CommonJS Modules/2.0-d8
 *                                      modules within the Node environment.
 *  Usage:  require("./cjs2-node")
 *          in the main program as early as possible (before any calls to
 *          module.declare or require) OR
 *
 *          node -r /path/to/cjs2-node myprogram.js
 *
 *  @author     Wes Garland, wgarland@sparc.network
 *  @date       May 2018
 */
const fs = require('fs')
const path = require('path')
const process = require('process')
const requirePaths = []
const internalModules =
{
  system:
  {
    stdio:
    {
      print: console.log
    }
  }
}

if (process.env.NODE_PATH)
{
  process.env.NODE_PATH.split(path.delimiter).forEach(function(path)
  {
    requirePaths.push(path)
  })
}

function resolveModule(moduleName)
{
  for (let i = 0; i < requirePaths.length; i++)
  {
    let dir  = requirePaths[i];
    let full = path.resolve(dir, moduleName);

    if (!requirePaths.hasOwnProperty(i))
      continue;

    if (dir[0] !== '/')
      throw new Error(`require paths must begin with /`);

    if (fs.existsSync(full + '.js'))
    {
      return full;
    }
  }
}

/** Module.declare de-sugar for any modules which are CommonJS Modules/2.0 */
module.constructor.prototype.declare = function cjs2_moduleDeclare(deps, cjs1_moduleFun)
{
  let module = this

  if (arguments.length === 1)
  {
    cjs1_moduleFun = deps;
    deps = undefined;
  }

  /* require() which is injected into module.declare modules. Conforms more closely
   * to CommonJS than Node's require.
   */
  function newRequire(moduleName)
  {
    if (require('module').builtinModules.indexOf(moduleName) !== -1)
      return require(moduleName)

    if (moduleName.match(/^\.\//) || moduleName.match(/^\.\.\//) || moduleName.match(/^\//))
      return require(path.join(path.dirname(module.filename), moduleName))

    if (internalModules[moduleName])
      return internalModules[moduleName]

    let res = resolveModule(moduleName)
    if (res)
      return require(res)

    return require(moduleName)
  }
  newRequire.paths = requirePaths;

  cjs1_moduleFun(newRequire, this.exports, this);
}

