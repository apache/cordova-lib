/* jshint laxcomma:true */
/* original license: MIT
 * this is based on jasmine-node@1.14.3 lib/jasmine-node/cli.js
 */
var path = require('path')
  , fs = require('fs')
  , Q = require('q')
  , superspawn = require('./src/cordova/superspawn')
  , jasmine = require('jasmine-node')
  , specs = require('jasmine-node/lib/jasmine-node/spec-collection')
  , scheduled = Q.defer()
  , jobs = [scheduled.promise]
  , terminalReporter
  , specFolders = []
  , showColors = true
  , fileMatcher = regExpSpec || new RegExp(".(js)$", "i")
  , specList
  , finished = /^Finished in ([0-9.]+) seconds/
  , summary = /^(\d+) tests?, (\d+) assertions?, (\d+) failures?, (\d+) skipped/
  , result = /^([.F-]+)$/
  , stats = {
        '.': 0
      , 'F': 0
      , '-': 0
      , '@': 0
      , 't': 0
      , 'a': 0
      , 'f': 0
      , 's': 0
    }
  , colors
  , cargs = ['node_modules/jasmine-node/bin/jasmine-node']
  , failureLine = /^(\s+)\d+(\).*)/
  , failureNumber = 0
  , failures = []
  ;

// Disable if we're not on a TTY
if (!process.stdout.isTTY) {
    showColors = false;
}

var extensions = "js"
  , match = '.'
  , matchall = false
  , forceExit = false
  , args = process.argv.slice(2)
  , existsSync = fs.existsSync || path.existsSync
  , j = 1
  ;

while(args.length) {
  var arg = args.shift();

  switch(arg)
  {
    case '-j':
        j = args.shift();
        break;
    case '--version':
        printVersion();
        break;
    case '--color':
        showColors = true;
        break;
    case '--noColor':
    case '--nocolor':
        showColors = false;
        break;
    case '--verbose':
        throw "not supported";
    case '--coffee':
    case '--teamcity':
        cargs.push(arg);
        break;
    case '-m':
    case '--match':
        match = args.shift();
        break;
    case '--matchall':
        matchall = true;
        break;
    case '--junitreport':
    case '--output':
        throw "not supported";
    case '--requireJsSetup':
        var setup = args.shift();

        if(!existsSync(setup))
            throw new Error("RequireJS setup '" + setup + "' doesn't exist!");

        cargs.push(arg);
        break;
    case '--runWithRequireJs':
    case '--nohelpers':
        cargs.push(arg);
        break;
    case '--test-dir':
        var dir = args.shift();

        if(!existsSync(dir))
          throw new Error("Test root path '" + dir + "' doesn't exist!");

        specFolders.push(dir); // NOTE: Does not look from current working directory.
        break;
    case '--autotest':
    case '--watch':
        throw "not supported";
    case '--forceexit':
    case '--captureExceptions':
    case '--noStack':
    case '--growl':
        cargs.push(arg);
        break;
    case '--config':
        var configKey = args.shift();
        var configValue = args.shift();
        process.env[configKey]=configValue;
        cargs.push(arg, configKey, configValue);
        break;
    case '-h':
        help();
        break;
    default:
      if (arg.match(/^--params=.*/)) {
        break;
      }
      if (arg.match(/^--/)) help();
      if (arg.match(/^\/.*/)) {
        specFolders.push(arg);
      } else {
        specFolders.push(path.join(process.cwd(), arg));
      }
      break;
  }
}

if (specFolders.length === 0) {
    help();
} else {
    // Check to see if all our files exist
    for (var idx = 0; idx < specFolders.length; idx++) {
        if (!existsSync(specFolders[idx])) {
            console.log("File: " + specFolders[idx] + " is missing.");
            process.exit(-1);
        }
    }
}

try {
    var regExpSpec = new RegExp(match + (matchall ? "" : "spec\\.") + "(" + extensions + ")$", 'i');
} catch (error) {
    console.error("Failed to build spec-matching regex: " + error);
    process.exit(2);
}


function help(){
  process.stdout.write([
    'USAGE: jasmine-node [--color|--noColor] [--verbose] [--coffee] directory'
  , ''
  , 'Options:'
  , '  --autotest         - rerun automatically the specs when a file changes'
  , '  --watch PATH       - when used with --autotest, watches the given path(s) and runs all tests if a change is detected'
  , '  --color            - use color coding for output'
  , '  --noColor          - do not use color coding for output'
  , '  -m, --match REGEXP - load only specs containing "REGEXPspec"'
  , '  --matchall         - relax requirement of "spec" in spec file names'
  , '  --verbose          - print extra information per each test run'
  , '  --coffee           - load coffee-script which allows execution .coffee files'
  , '  --junitreport      - export tests results as junitreport xml format'
  , '  --output           - defines the output folder for junitreport files'
  , '  --teamcity         - converts all console output to teamcity custom test runner commands. (Normally auto detected.)'
  , '  --growl            - display test run summary in a growl notification (in addition to other outputs)'
  , '  --runWithRequireJs - loads all specs using requirejs instead of node\'s native require method'
  , '  --requireJsSetup   - file run before specs to include and configure RequireJS'
  , '  --test-dir         - the absolute root directory path where tests are located'
  , '  --nohelpers        - does not load helpers.'
  , '  --forceexit        - force exit once tests complete.'
  , '  --captureExceptions- listen to global exceptions, report them and exit (interferes with Domains)'
  , '  --config NAME VALUE- set a global variable in process.env'
  , '  --noStack          - suppress the stack trace generated from a test failure'
  , '  --version          - show the current version'
  , '  -j JOBLIMIT        - like make -j JOBLIMIT'
  , '  -h, --help         - display this help and exit'
  , ''
  ].join("\n"));

  process.exit(-1);
}

function printVersion(){
  console.log("0.1");
  process.exit(0);
}

specs.load(specFolders, fileMatcher);
specList = specs.getSpecs();
terminalReporter = new jasmine.TerminalReporter({color:showColors});
colors = {
    '.': terminalReporter.color_.pass()
  , 'F': terminalReporter.color_.fail()
  , '-': terminalReporter.color_.ignore()
  , '@': terminalReporter.color_.suiteTiming()
  , ' ': terminalReporter.color_.neutral()
};

function prettyPrint(data) {
    terminalReporter.print_(terminalReporter.stringWithColor_(data, colors[data]));
}

function count(data) {
    switch (data) {
    case '.':
    case 'F':
    case '-':
        stats[data]++;
        prettyPrint(data);
        break;
    case '':
        break;
    default:
        var time = data.match(finished);
        var notes = data.match(summary);
        if (time) {
            stats['@'] += +time[1] * 1000;
        } else if (notes) {
            stats.t += +notes[1];
            stats.a += +notes[2];
            stats.f += +notes[3];
            stats.s += +notes[4];
        }
    }
}

function run(s){
    var args = cargs.concat(s.path())
      , capturingFailures = false
      , opts = {
            onstdout: function (data) {
                data.split(/\n/).forEach(function (data) {
                    results = data.match(result);
                    if (results) {
                        results[1].split('').forEach(count);
                    } else if (data.match(finished) || data.match(summary)) {
                        capturingFailures = false;
                        count(data);
                    } else if (capturingFailures) {
                        data = data.replace(failureLine, function (
                            ignored,
                            whitespace,
                            remainder) {
                            return "\n" + whitespace + (++failureNumber) + remainder;
                        });
                        if (data !== "") {
                            failures.push(data);
                        }
                    } else if (data === 'Failures:') {
                        capturingFailures = true;
                        if (!failures.length) {
                            failures.push(data);
                        }
                    } else {
                        count(data);
                    }
                });
                return true;
            }
          , onstderr: function (data) {
                process.stderr.write(data);
                return true;
            }
          , printCommand: true
        };
    var child = superspawn.spawn(
        process.argv[0],
        args,
        opts);
    return child;
}

scheduled.promise.then(function () {
    Q.allSettled(jobs)
    .finally(report);
});

function addOne() {
    var task = specList.pop();
    if (!task) {
        scheduled.resolve();
        return;
    }
    var d = run(task);
    jobs.push(d);
    d.finally(addOne);
}

function work() {
    var jobs = [];
    for (var i = 0; i < j; i++) {
        addOne();
    }
}

function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
}

function report() {
    var time = 'Finished in ' + stats['@'] / 1000 + ' seconds\n'
      , summary = [ plural(stats.t, 'test')
                  , plural(stats.a, 'assertion')
                  , plural(stats.f, 'failure')
                  , stats.s + ' skipped\n'].join(', ');
    process.stdout.write('\n\n');
    process.stdout.write(failures.join('\n'));
    process.stdout.write('\n\n');
    terminalReporter.print_(terminalReporter.stringWithColor_(time,
                                                              colors['@']));
    terminalReporter.print_(terminalReporter.stringWithColor_(summary,
        stats.f ? colors.F
        : stats.a ? colors['.']
        : colors[' ']));
    process.stdout.write('\n\n');
}

work();
