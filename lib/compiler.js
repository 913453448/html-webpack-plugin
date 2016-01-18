/*
 * This file uses webpack to compile a template with a child compiler.
 *
 * [TEMPLATE] -> [JAVASCRIPT]
 *
 */
'use strict';
var Promise = require('bluebird');
var path = require('path');
var NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin');
var NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin');
var LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
var LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin');
var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

/**
 * Compiles the template into a nodejs factory, adds its to the compilation.assets
 * and returns a promise of the result asset object.
 *
 * @param template relative path to the template file
 * @param context path context
 * @param outputFilename the file name
 * @param compilation The webpack compilation object
 *
 * Returns an object:
 * {
 *  hash: {String} - Base64 hash of the file
 *  content: {String} - Javascript executable code of the template
 * }
 *
 */
module.exports.compileTemplate = function compileTemplate(template, context, outputFilename, compilation) {
  // The entry file is just an empty helper as the dynamic template
  // require is added in "loader.js"
  var outputOptions = {
    filename: outputFilename,
    publicPath: compilation.outputOptions.publicPath
  };
  var cachedAsset = compilation.assets[outputOptions.filename];
  // Create an additional child compiler which takes the template
  // and turns it into an Node.JS html factory.
  // This allows us to use loaders during the compilation
  var compilerName = getCompilerName(context, outputFilename);
  var childCompiler = compilation.createChildCompiler(compilerName, outputOptions);
  childCompiler.context = context;
  childCompiler.apply(
    new NodeTemplatePlugin(outputOptions),
    new NodeTargetPlugin(),
    new LibraryTemplatePlugin('HTML_WEBPACK_PLUGIN_RESULT', 'var'),
    new SingleEntryPlugin(this.context, template),
    new LoaderTargetPlugin('node')
  );

  // Compile and return a promise
  return new Promise(function (resolve, reject) {
    childCompiler.runAsChild(function(err, entries, childCompilation) {
      compilation.assets[outputOptions.filename] = cachedAsset;
      if (cachedAsset === undefined) {
        delete compilation.assets[outputOptions.filename];
      }
      // Resolve / reject the promise
      if (childCompilation.errors && childCompilation.errors.length) {
        var errorDetails = childCompilation.errors.map(function(error) {
            return error.message + (error.error ? ':\n' + error.error: '');
          }).join('\n');
        reject(new Error('Child compilation failed:\n' + errorDetails));
      } else {
        resolve({
          // Hash of the template entry point
          hash: entries[0].hash,
          // Compiled code
          content: childCompilation.assets[outputOptions.filename].source()
        });
      }
    });
  });
};


/**
 * Returns the child compiler name e.g. 'html-webpack-plugin for "index.html"'
 */
function getCompilerName (context, filename) {
  var absolutePath = path.resolve(context, filename);
  var relativePath = path.relative(context, absolutePath);
  return 'html-webpack-plugin for "' + (absolutePath.length < relativePath.length ? absolutePath : relativePath) + '"';
}