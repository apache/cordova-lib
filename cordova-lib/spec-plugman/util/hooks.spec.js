var hooks  = require('../../src/plugman/util/hooks'),
    path = require('path'),
    et = require('elementtree'),
    xml_helpers = require('../../src/util/xml-helpers');

var pluginId = 'id.sample.plugin',
    platform = 'ios',
    project_dir = path.join(__dirname, '..'),
    plugin_dir = path.join(project_dir, 'plugins', 'HooksTestPlugin'),
    samplePluginPath = path.join(plugin_dir, 'plugin.xml'),
    samplePluginXml = xml_helpers.parseElementtreeSync(samplePluginPath),
    hookFile = path.join(samplePluginPath, 'scripts/hook');


describe('plugin hooks', function() {

    it('fire method should exist', function() {
            expect(hooks.fire).toBeDefined();
    });

    it('should throw if passed in an invalid hook event', function() {
        expect(function() {
            hooks.fire('blahblah', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
        }).toThrow();
    });
    it('should support beforeinstall/afterinstall/uninstall hook types', function() {
        expect(function() {
            hooks.fire('beforeinstall', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
            hooks.fire('afterinstall', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
            hooks.fire('uninstall', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
        }).not.toThrow();
    });
    it('should return promise', function() {
        var res = hooks.fire('beforeinstall', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
        expect(typeof res).toEqual('object');
    });
    it('should correctly execute runScriptFile method', function() {
        var runScriptFile = spyOn(hooks, 'runScriptFile').andCallThrough();
        var promise = hooks.fire('afterinstall', pluginId, samplePluginXml, platform, project_dir, plugin_dir);
        var done = false;

        promise.then(function(){
            expect(runScriptFile.calls.length).toBeGreaterThan(0);
            var args = runScriptFile.mostRecentCall.args;
            
            // check args num
            expect(args.length).toEqual(2);

            // first arg is hook file location
            expect(args[0]).toEqual('scripts/hook.js');

            // second arg should correctly represent content information
            var ctx = args[1];
            expect(ctx.platform).toEqual(platform);
            expect(ctx.projectDir).toEqual(project_dir);
            expect(ctx.pluginDir).toEqual(plugin_dir);
            expect(ctx.pluginId).toEqual(pluginId);

            done = true;
        }).fail(function(ex){
            expect("fail callback should not be called: " + ex).not.toBeDefined();
            done = true;
        });
         waitsFor(function() { return done; }, 'promise never resolved', 3000);
    });
});
