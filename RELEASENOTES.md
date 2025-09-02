<!--
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
-->
# Cordova-lib Release Notes

### 12.0.2 (Oct 29, 2024)

**Fixes:**

* [GH-935](https://github.com/apache/cordova-lib/pull/935) fix: platform & plugin prerelease package support
* [GH-933](https://github.com/apache/cordova-lib/pull/933) fix(ios): Prevent mix build phases
* [GH-913](https://github.com/apache/cordova-lib/pull/913) fix: uninstalling plugin with platform separated required variables

**Chores:**

* [GH-934](https://github.com/apache/cordova-lib/pull/934) chore(deps): bump cookie and express
* [GH-928](https://github.com/apache/cordova-lib/pull/928) chore(deps): bump micromatch from 4.0.5 to 4.0.8
* [GH-925](https://github.com/apache/cordova-lib/pull/925) chore(deps): bump braces from 3.0.2 to 3.0.3
* [GH-924](https://github.com/apache/cordova-lib/pull/924) chore(deps): Update some dependencies, add Node 20 to CI

**CI:**

* [GH-926](https://github.com/apache/cordova-lib/pull/926) ci(release-audit): add license header and dependency checker
* [GH-923](https://github.com/apache/cordova-lib/pull/923) ci: update codecov@v4 w/ token

### 12.0.1 (May 19, 2023)

* [GH-918](https://github.com/apache/cordova-lib/pull/918) fix: platform add with tarball & directory

### 12.0.0 (May 13, 2023)

**Features:**

* [GH-917](https://github.com/apache/cordova-lib/pull/917) feat!(`run`): call platform api to list targets
* [GH-894](https://github.com/apache/cordova-lib/pull/894) feat!: remove platform pinning
* [GH-896](https://github.com/apache/cordova-lib/pull/896) feat!: remove **OSX** & **Windows** platform

**Dependencies:**

* [GH-915](https://github.com/apache/cordova-lib/pull/915) dep!: bump `@cordova/eslint-config@latest@5.0.0` w/ automatic fix
* [GH-914](https://github.com/apache/cordova-lib/pull/914) dep!: packages upgrade & requirements
  * Bumped Packages
    * `cordova-common@5.0.0`
    * `cordova-fetch@4.0.0`
    * `cordova-serve@4.0.1`
    * `init-package-json@5.0.0`
    * `jasmine@4.6.0`
    * `semver@7.5.0`
  * Rebuilt `package-lock.json`
  * Bumped `node` engine requirement `>=16.13.0`
* [GH-910](https://github.com/apache/cordova-lib/pull/910) dep(npm): bump all dependencies to next major
  * `fs-extra@^11.1.0`
  * `write-file-atomic@^5.0.0`
  * `cordova-android@^11.0.0`
  * `jasmine@^4.5.0`
  * `jasmine-spec-reporter@^7.0.0`
  * `rewire@^6.0.0`
  * `init-package-json@^4.0.1`

**Others:**

* [GH-916](https://github.com/apache/cordova-lib/pull/916) fix(node-18): hook tests
* [GH-905](https://github.com/apache/cordova-lib/pull/905) ci(workflow): update codecov action usage
* [GH-903](https://github.com/apache/cordova-lib/pull/903) ci(workflow): update node support & action dependencies
* [GH-911](https://github.com/apache/cordova-lib/pull/911) test: temporary disable broken spec#012

### 11.1.0 (Dec 26, 2022)

* [GH-904](https://github.com/apache/cordova-lib/pull/904) dep(npm): bump `cordova-fetch@3.1.0` w/ package-lock rebuild
* [GH-901](https://github.com/apache/cordova-lib/pull/901) feat: bump dependencies to latest minor & patch revision
  * `fs-extra@^10.1.0`
  * `globby@^11.1.0`
  * `semver@^7.3.8`
  * `cordova-android@10.1.2`
  * `jasmine@^3.99.0`
* [GH-899](https://github.com/apache/cordova-lib/pull/899) feat: bump `cordova-common@4.1.0`
* [GH-852](https://github.com/apache/cordova-lib/pull/852) feat(windows): deprecate platform
* [GH-851](https://github.com/apache/cordova-lib/pull/851) feat(osx): deprecate platform

### 11.0.0 (Dec 14, 2021)

* [GH-889](https://github.com/apache/cordova-lib/pull/889) bump(platform): bump **Electron** & **Android** to latest release
* [GH-890](https://github.com/apache/cordova-lib/pull/890) chore: rebuild `package-lock`
* [GH-888](https://github.com/apache/cordova-lib/pull/888) dep(dev)!: bump `@cordova/eslint-config@^4.0.0` w/ fix
* [GH-887](https://github.com/apache/cordova-lib/pull/887) dep!: update dependencies
* [GH-873](https://github.com/apache/cordova-lib/pull/873) ci: switch to GitHub Actions
* [GH-884](https://github.com/apache/cordova-lib/pull/884) chore!: drop support for Node.js 10

### 10.1.0 (Sep 29, 2021)

**Features:**

* [GH-885](https://github.com/apache/cordova-lib/pull/885) feat: bump platform pinning
* [GH-860](https://github.com/apache/cordova-lib/pull/860) feat(`cordova/util`): support loading platform API from `node_modules`

**Fixes:**

* [GH-880](https://github.com/apache/cordova-lib/pull/880) fix(`restore-util`): properly support long and short platform names
* [GH-874](https://github.com/apache/cordova-lib/pull/874) fix: Platforms restored from both dev and normal dependencies.
* [GH-871](https://github.com/apache/cordova-lib/pull/871) fix: remove undeclared dependency on `underscore`
* [GH-856](https://github.com/apache/cordova-lib/pull/856) fix(`cordova/util`): version detection for legacy platforms

**Chores & Refactor Changes:**

* [GH-886](https://github.com/apache/cordova-lib/pull/886) chore: update dependencies w/ `package-lock` rebuild & test update
* [GH-881](https://github.com/apache/cordova-lib/pull/881) chore: `npmrc`
* [GH-879](https://github.com/apache/cordova-lib/pull/879) chore: `package-lock` update
* [GH-858](https://github.com/apache/cordova-lib/pull/858) chore: clean up `package.json`
* [GH-882](https://github.com/apache/cordova-lib/pull/882) refactor(`addHelper`): more concise `package.json` spec lookup

**CI, Test & Doc Changes:**

* [GH-862](https://github.com/apache/cordova-lib/pull/862) ci: add node-14.x to workflow
* [GH-870](https://github.com/apache/cordova-lib/pull/870) test(`plugin.spec`): fix version change in test fixture
* [GH-865](https://github.com/apache/cordova-lib/pull/865) test(`pkgJson`): make expectations work for npm 5 to 7
* [GH-864](https://github.com/apache/cordova-lib/pull/864) test(`pkgJson`): fix test after release of geolocation plugin v4.1.0
* [GH-855](https://github.com/apache/cordova-lib/pull/855) test: fix missing stack traces in jasmine output
* [GH-853](https://github.com/apache/cordova-lib/pull/853) test: unit test deprecated platforms
* [GH-877](https://github.com/apache/cordova-lib/pull/877) docs: correct linter command in `README`

### 10.0.0 (Jul 22, 2020)

* [GH-846](https://github.com/apache/cordova-lib/pull/846) breaking: remove `cordova info` logic from `lib`
* [GH-849](https://github.com/apache/cordova-lib/pull/849) breaking: bump dependencies
* [GH-847](https://github.com/apache/cordova-lib/pull/847) chore: update dev dependencies
* [GH-848](https://github.com/apache/cordova-lib/pull/848) chore: bump `cordova-eslint` w/ automatic fixes
* [GH-843](https://github.com/apache/cordova-lib/pull/843) test(`fixture-helper`): install **Android** platform by name again
* [GH-844](https://github.com/apache/cordova-lib/pull/844) fix: remove unused dependency on `cordova-create`
* [GH-841](https://github.com/apache/cordova-lib/pull/841) chore: add `package-lock.json`
* [GH-840](https://github.com/apache/cordova-lib/pull/840) chore: use short notation in `package.json`
* [GH-839](https://github.com/apache/cordova-lib/pull/839) chore: stop testing with nightly
* [GH-838](https://github.com/apache/cordova-lib/pull/838) chore: update **Android** platform pinning to 9.0.0
* [GH-837](https://github.com/apache/cordova-lib/pull/837) chore: update **OSX** platform pinning to 6.0.0
* [GH-836](https://github.com/apache/cordova-lib/pull/836) chore: update **iOS** platform pinning to 6.1.0
* [GH-835](https://github.com/apache/cordova-lib/pull/835) GH-832: Look at devDeps for restoring platforms
* [GH-833](https://github.com/apache/cordova-lib/pull/833) breaking: upgrade cordova dependencies for next major
* [GH-831](https://github.com/apache/cordova-lib/pull/831) test: use `expectAsync` for rejections
* [GH-825](https://github.com/apache/cordova-lib/pull/825) test(e2e): improve `HooksRunner.spec`
* [GH-828](https://github.com/apache/cordova-lib/pull/828) chore: consolidate eslint configs
* [GH-803](https://github.com/apache/cordova-lib/pull/803) test: move `cordova/platform/{platform => addHelper}`
* [GH-827](https://github.com/apache/cordova-lib/pull/827) fix: plugin installation from `git` url w/ `semver`
* [GH-826](https://github.com/apache/cordova-lib/pull/826) test: use `fs.copySync` for increased performance
* [GH-823](https://github.com/apache/cordova-lib/pull/823) test(e2e): re-enable HooksRunner#12 and move it to plugin#14
* [GH-824](https://github.com/apache/cordova-lib/pull/824) style: fix linting violations
* [GH-821](https://github.com/apache/cordova-lib/pull/821) feat: proper support for scoped plugins
* [GH-822](https://github.com/apache/cordova-lib/pull/822) refactor: `eslint` setup
* [GH-820](https://github.com/apache/cordova-lib/pull/820) refactor: remove stub interface to `cordova-create`
* [GH-819](https://github.com/apache/cordova-lib/pull/819) refactor: use `execa`'s cross-platform shebang support in `HooksRunner`
* [GH-812](https://github.com/apache/cordova-lib/pull/812) chore: replace `superspawn` with `execa`
* [GH-781](https://github.com/apache/cordova-lib/pull/781) chore: remove `plugin save`
* [GH-780](https://github.com/apache/cordova-lib/pull/780) chore: deprecate `plugin save` command
* [GH-818](https://github.com/apache/cordova-lib/pull/818) Extend and improve plugin tests in preparation of supporting scoped plugins
* [GH-810](https://github.com/apache/cordova-lib/pull/810) chore: bump production dependencies
* [GH-816](https://github.com/apache/cordova-lib/pull/816) Simplify `jasmine` configuration
* [GH-817](https://github.com/apache/cordova-lib/pull/817) Remove dead code in `integration-tests/plugin.spec`
* [GH-815](https://github.com/apache/cordova-lib/pull/815) Do not spawn child process to get platform version
* [GH-813](https://github.com/apache/cordova-lib/pull/813) `plugman_fetch.spec` cleanup
* [GH-814](https://github.com/apache/cordova-lib/pull/814) Remove obsolete and duplicate ignore entries
* [GH-809](https://github.com/apache/cordova-lib/pull/809) chore: improve npm ignore list
* [GH-811](https://github.com/apache/cordova-lib/pull/811) chore: update `jasmine` dependencies
* [GH-808](https://github.com/apache/cordova-lib/pull/808) Remove unused module plugman/platforms/common
* [GH-807](https://github.com/apache/cordova-lib/pull/807) Break dependency cycles
* [GH-804](https://github.com/apache/cordova-lib/pull/804) Fix `cordova/emulate.spec`
* [GH-806](https://github.com/apache/cordova-lib/pull/806) Remove unused exports from `cordova/util`
* [GH-805](https://github.com/apache/cordova-lib/pull/805) Remove support for obsolete `<project>/.cordova/config.json`
* [GH-802](https://github.com/apache/cordova-lib/pull/802) Minor code cleanup
* [GH-797](https://github.com/apache/cordova-lib/pull/797) Do not run legacy hooks from dirs anymore
* [GH-800](https://github.com/apache/cordova-lib/pull/800) Remove `platform.check`
* [GH-765](https://github.com/apache/cordova-lib/pull/765) Remove code to handle plugins that were added by cordova@<5.4.0
* [GH-766](https://github.com/apache/cordova-lib/pull/766) Remove parts of plugman that have been moved to the plugman repo
* [GH-772](https://github.com/apache/cordova-lib/pull/772) Replace underscore with modern JS
* [GH-799](https://github.com/apache/cordova-lib/pull/799) chore: drop node 6 and 8 support
* [GH-798](https://github.com/apache/cordova-lib/pull/798) chore: bump version to 10.0.0-dev
* [GH-770](https://github.com/apache/cordova-lib/pull/770) Use up-to-date fixtures in tests
* [GH-796](https://github.com/apache/cordova-lib/pull/796) HooksRunner code & spec cleanup
* [GH-791](https://github.com/apache/cordova-lib/pull/791) fix: error message during plugin installation w/ missing engine
* [GH-777](https://github.com/apache/cordova-lib/pull/777) chore: add Node.js 12 to CI services
* [GH-786](https://github.com/apache/cordova-lib/pull/786) Quick workaround for e2e failure on AppVeyor CI
* [GH-783](https://github.com/apache/cordova-lib/pull/783) `nyc@14` update in devDependencies
* [GH-775](https://github.com/apache/cordova-lib/pull/775) chore: cleanup `plugman.createPackageJson`
* [GH-767](https://github.com/apache/cordova-lib/pull/767) Simpler and better `cordova/util.getPlatformApiFunction`
* [GH-774](https://github.com/apache/cordova-lib/pull/774) Make `src/plugman/init-defaults.js` lintable
* [GH-773](https://github.com/apache/cordova-lib/pull/773) Have `plugman.createPackageJson` create file in plugin dir, not in cwd
* [GH-771](https://github.com/apache/cordova-lib/pull/771) Prevent masking of errors during testing
* [GH-768](https://github.com/apache/cordova-lib/pull/768) Proper async code in `src/plugman/createpackagejson.js`
* [GH-764](https://github.com/apache/cordova-lib/pull/764) chore: expressive `pkgJson.spec`
* [GH-763](https://github.com/apache/cordova-lib/pull/763) Remove unnecessary spy
* [GH-762](https://github.com/apache/cordova-lib/pull/762) Remove unused fixtures
* [GH-761](https://github.com/apache/cordova-lib/pull/761) chore: various test improvements
  * Fix some test descriptions in `cordova/util.spec`
  * Stop `cordova/util.spec` from messing with the user's home directory!
  * Proper temp folder usage in `cordova/util.spec`
  * Remove outdated test from `cordova/util.spec`
  * Remove `rewire`/`revert` anti-pattern
  * Remove `superspawn` faking from `HooksRunner.spec`
* [GH-760](https://github.com/apache/cordova-lib/pull/760) Minor cleanup of CI configs

### 9.0.1 (Mar 31, 2019)
* [GH-759](https://github.com/apache/cordova-lib/pull/759) Fix faulty Promise handling in plugman.uninstall
* [GH-752](https://github.com/apache/cordova-lib/pull/752) Fix restoring plugins from `package.json`
* [GH-754](https://github.com/apache/cordova-lib/issues/754) [GH-755](https://github.com/apache/cordova-lib/issues/755) Do not wrap engine script path in quotes

### 9.0.0 (Mar 15, 2019)

* [GH-750](https://github.com/apache/cordova-lib/pull/750) Remove saving platforms/plugins to `config.xml`
* [GH-751](https://github.com/apache/cordova-lib/pull/751) Pass project `config.xml` path to platform's prepare
* [GH-749](https://github.com/apache/cordova-lib/pull/749) Cordova Lib Release Preparation (Cordova 9)
  * Remove unused property `apiCompatibleSince` from `platformsConfig.json`
  * Fix plugin dependency tests when using `npm >= 5`
  * Bumped Platform Pinning and Support Minor SemVer
    * `cordova-android@^8.0.0`
    * `cordova-browser@^6.0.0`
    * `cordova-electron@^1.0.0`
    * `cordova-ios@^5.0.0`
    * `cordova-osx@^5.0.0`
    * `cordova-windows@^7.0.0`
  * Bumped dependencies
    * `jasmine@^3.3.1`
    * `globby@^9.1.0`
    * `underscore@^1.9.1`
    * `semver@^5.6.0`
    * `read-chunk@^3.1.0`
    * `init-package-json@^1.10.3`
    * `fs-extra@^7.0.1`
  * Dev Dependencies
    * Updated `nyc` Code Coverage
    * Updated ESlint with lint corrections
    * Added missing module `shelljs` to fix test failures
  * Updated Package Cordova Dependencies
    * `cordova-common@^3.1.0`
    * `cordova-create@^2.0.0`
    * `cordova-fetch@^2.0.0`
    * `cordova-serve@^3.0.0`
* [GH-748](https://github.com/apache/cordova-lib/pull/748) Remove handling of legacy `.fetch.json` files
* [GH-709](https://github.com/apache/cordova-lib/pull/709) `hooks/Context` Improvements
* [GH-622](https://github.com/apache/cordova-lib/pull/622) [CB-14166](https://issues.apache.org/jira/browse/CB-14166) (cli) Fixed issue when install plugins on **Windows**
* [GH-744](https://github.com/apache/cordova-lib/pull/744) Add **Electron** Platform
* [GH-743](https://github.com/apache/cordova-lib/pull/743) Updated Platform Config Git URL Paths
* [GH-742](https://github.com/apache/cordova-lib/pull/742) Cleanup indentation spacing in `*/jasmine.json`
* [GH-741](https://github.com/apache/cordova-lib/pull/741) Fix crash in `cordova requirements` due to an unbound function
* [GH-711](https://github.com/apache/cordova-lib/pull/711) Fix 2 integration tests failures on **macOS**
* [GH-710](https://github.com/apache/cordova-lib/pull/710) Drop `Q` Dependency and Use Native Promises
* [GH-687](https://github.com/apache/cordova-lib/pull/687) Test, Fix and Cleanup `cordova serve`
* [GH-707](https://github.com/apache/cordova-lib/pull/707) Deprecate `requireCordovaModule` for non-Cordova modules
* [GH-705](https://github.com/apache/cordova-lib/pull/705) Dereference possible symlinks when copying plugin
* [GH-699](https://github.com/apache/cordova-lib/pull/699) Increase timeout for `cordova.platform` e2e tests
* [GH-698](https://github.com/apache/cordova-lib/pull/698) Increase plugman install test timeout
* [GH-686](https://github.com/apache/cordova-lib/pull/686) Remove support for old option format
* [GH-685](https://github.com/apache/cordova-lib/pull/685) Remove unused dependency `properties-parser`
* [GH-677](https://github.com/apache/cordova-lib/pull/677) Fix `cordova/platform/addHelper` tests
* [GH-679](https://github.com/apache/cordova-lib/pull/679) `platform.spec` Cleanup
* [GH-684](https://github.com/apache/cordova-lib/pull/684) Code Cleanup and Refactor (Bits and pieces)
* [GH-683](https://github.com/apache/cordova-lib/pull/683) Remove unused npm utility functions
* [GH-682](https://github.com/apache/cordova-lib/pull/682) GH-676 Remove Browserify
* [GH-652](https://github.com/apache/cordova-lib/pull/652) Make `plugin.remove` more easily understandable
* [GH-650](https://github.com/apache/cordova-lib/pull/650) Make `cordova/platform/check` more approachable
* [GH-678](https://github.com/apache/cordova-lib/pull/678) Fix tests that are failing with npm config 'save-exact' set
* [GH-675](https://github.com/apache/cordova-lib/pull/675) One root `describe` per suite
* [GH-674](https://github.com/apache/cordova-lib/pull/674) `plugman/install.spec` Cleanup
* [GH-672](https://github.com/apache/cordova-lib/pull/672) `plugman_uninstall.spec` Cleanup
* [GH-613](https://github.com/apache/cordova-lib/pull/613) Switch to using `fs-extra` in favour of `shelljs`
* [GH-665](https://github.com/apache/cordova-lib/pull/665) Radically focused `restore.spec` finally fast and reliable
* [GH-671](https://github.com/apache/cordova-lib/pull/671) Remove `cordova plugin search` command
* [GH-670](https://github.com/apache/cordova-lib/pull/670) Various `spec` fixes and cleanup
* [GH-666](https://github.com/apache/cordova-lib/pull/666) Remove deprecated and unused content
* [GH-669](https://github.com/apache/cordova-lib/pull/669) Linting Improvements
* [GH-668](https://github.com/apache/cordova-lib/pull/668) Only upload coverage when tests succeed
* [GH-667](https://github.com/apache/cordova-lib/pull/667) Report Code Coverage to `codecov` on Travis CI
* [GH-664](https://github.com/apache/cordova-lib/pull/664) Move some cordova test fixtures into fixtures folder
* [GH-651](https://github.com/apache/cordova-lib/pull/651) Remove all usage of Q-specific methods on Promise instances
* [GH-662](https://github.com/apache/cordova-lib/pull/662) Remove unused content
* [GH-663](https://github.com/apache/cordova-lib/pull/663) Update `read-chunk` to properly close file descriptors on failure
* [GH-658](https://github.com/apache/cordova-lib/pull/658) Remove deprecated platform support files
* [GH-616](https://github.com/apache/cordova-lib/pull/616) Extend and improve `cordova info` output

### 8.0.0 (Dec 14, 2017)
* [CB-13057](https://issues.apache.org/jira/browse/CB-13057): removed `cordova save` command
* [CB-13056](https://issues.apache.org/jira/browse/CB-13056): removed support for **WebOS**, **BlackBerry10**, and **Ubuntu**
* [CB-13674](https://issues.apache.org/jira/browse/CB-13674): updated cordova dependencies
* [CB-13055](https://issues.apache.org/jira/browse/CB-13055): updated integration tests, removed `lazy_load.js`, removed `gitclone.js` and `--nofetch` flag. This removes the need for us to include an npm dependency.
* [CB-13532](https://issues.apache.org/jira/browse/CB-13532): updated to include a check for `package.json` `devDependencies`
* [CB-12361](https://issues.apache.org/jira/browse/CB-12361): added unit tests for `check.js`
* [CB-13501](https://issues.apache.org/jira/browse/CB-13501): added support for node 8 to tests
* [CB-13463](https://issues.apache.org/jira/browse/CB-13463): prevent `package.json` updating plugins with `--nosave`

### 7.1.0 (Oct 04, 2017)
* [CB-13303](https://issues.apache.org/jira/browse/CB-13303) added `--save_exact`, `--production` flags
* [CB-13288](https://issues.apache.org/jira/browse/CB-13288) updated `index.js` and test to fix `cordova plugin search`
* [CB-13206](https://issues.apache.org/jira/browse/CB-13206) fixed incorrect target being passed in to `plugin add` from `restore-util.js`
* [CB-13145](https://issues.apache.org/jira/browse/CB-13145) added `variable-merge.js` to deal with `plugin.xml` variables for uninstall
* [CB-12870](https://issues.apache.org/jira/browse/CB-12870) catch all use cases for `getPlatformApiFunction` and update tests accordingly
* [CB-12944](https://issues.apache.org/jira/browse/CB-12944) Platform's spec is ignored in `config.xml` if `package.json` doesn't contain dependency for platform
* [CB-12361](https://issues.apache.org/jira/browse/CB-12361) added new unit tests for plugin tests
* [CB-13020](https://issues.apache.org/jira/browse/CB-13020) (plugman) install filters out `nohooks`
* [CB-13056](https://issues.apache.org/jira/browse/CB-13056) added deprecation notice for **WebOS**
* [CB-13057](https://issues.apache.org/jira/browse/CB-13057) added deprecation warning for `cordova platform save`
* [CB-12361](https://issues.apache.org/jira/browse/CB-12361) added tests for `save.js` and rebased
* [CB-12895](https://issues.apache.org/jira/browse/CB-12895) switched from `jshint` to `eslint`
* [CB-12361](https://issues.apache.org/jira/browse/CB-12361) updated `addHelper` tests
* [CB-11980](https://issues.apache.org/jira/browse/CB-11980) Update `README` to reflect new repos
* [CB-6143](https://issues.apache.org/jira/browse/CB-6143) Change `plugman.emit()` to `events.emit()`
* Reorganized unit test directory. Changes include: - consolidate `spec-cordova/` and `spec-plugman/` into a single `spec/` dir. - put `jasmine config` and helper modules in top-level spec dir. - changed `package.json` npm run scripts to reflect purposes of tasks. remove `npm run ci`. Updated `README` to reflect `package.json` npm run script changes. 
* [CB-12361](https://issues.apache.org/jira/browse/CB-12361) added unit tests for `prepare.spec.js`
* Update cordova-lib api. Deprecate `raw` from api calls. 
* [CB-11980](https://issues.apache.org/jira/browse/CB-11980) moved `fetch`, `common` and `serve` into their own repos
* [CB-12786](https://issues.apache.org/jira/browse/CB-12786) Improve logic for searching plugin id in case of module already exists in `node_modules`
* [CB-12250](https://issues.apache.org/jira/browse/CB-12250) [CB-12409](https://issues.apache.org/jira/browse/CB-12409) **iOS**: Fix bug with escaping properties from plist file
* [CB-12762](https://issues.apache.org/jira/browse/CB-12762) point `package.json` repo items to github mirrors instead of apache repos site
* [CB-12777](https://issues.apache.org/jira/browse/CB-12777) removed **Android**, **iOS**, and **Windows** projects fixtures
* [CB-12787](https://issues.apache.org/jira/browse/CB-12787) Fix plugin installation with `--link` option
* [CB-12738](https://issues.apache.org/jira/browse/CB-12738) Cordova ignores plugin dependency version on **Windows** platform
* [CB-12766](https://issues.apache.org/jira/browse/CB-12766) Consistently write JSON with 2 spaces indentation

### 7.0.1 (May 08, 2017)
* [CB-12773](https://issues.apache.org/jira/browse/CB-12773): fixed incorrect plugin version fetching issue
* [CB-12769](https://issues.apache.org/jira/browse/CB-12769): updated `cordova-create` dependency to 1.1.1
* [CB-12757](https://issues.apache.org/jira/browse/CB-12757): if there's a plugin dependency in `package.json`, use that one for `config.xml`

### 7.0.0 (May 02, 2017)
* [CB-12747](https://issues.apache.org/jira/browse/CB-12747): updated pinned platforms
* [CB-12705](https://issues.apache.org/jira/browse/CB-12705): Modified `(before|after)_plugin_(uninstall|install)` to always expect existence of plugin field
* [CB-12705](https://issues.apache.org/jira/browse/CB-12705): Pass plugin info to project `*_plugin_install` hooks
* [CB-11242](https://issues.apache.org/jira/browse/CB-11242): removed support for platforms that don't have a `package.json`
* [CB-11242](https://issues.apache.org/jira/browse/CB-11242): updated tests and fixtures
* [CB-11242](https://issues.apache.org/jira/browse/CB-11242): refactored out `getPlatformApiFunction`
* [CB-11242](https://issues.apache.org/jira/browse/CB-11242): removed `parser` and `handler` files for deprecated versions of platforms
* [CB-12683](https://issues.apache.org/jira/browse/CB-12683): improved error messaging for when a plugin doesn't have `package.json`
* [CB-12674](https://issues.apache.org/jira/browse/CB-12674): Added deprecation notice for **blackberry10** and **ubuntu**
* [CB-11777](https://issues.apache.org/jira/browse/CB-11777): Restore plugins before preparing
* [CB-12643](https://issues.apache.org/jira/browse/CB-12643): removed references to **wp8**
* [CB-12645](https://issues.apache.org/jira/browse/CB-12645): removed references to **firefoxos**
* [CB-12665](https://issues.apache.org/jira/browse/CB-12665): removed `engineStrict` as it is no longer supported
* [CB-12612](https://issues.apache.org/jira/browse/CB-12612): removing old `amazon-fireos` code
* [CB-12425](https://issues.apache.org/jira/browse/CB-12425): autocreate a `package.json` if it doesn't exist during `cordova prepare` 
* [CB-12517](https://issues.apache.org/jira/browse/CB-12517): `package.json` `name` feild is `config.xml` `id` feild and `package.json` `displayName` feild is `config.xml` `name` feild
* [CB-12592](https://issues.apache.org/jira/browse/CB-12592): added `requireNoCache` function and replaced instances of `delete.require cache`
* [CB-12606](https://issues.apache.org/jira/browse/CB-12606): Fix plugin dependency installation. Now it respects the `spec` specified for dependencies of plugins in `plugin.xml`
* [CB-12016](https://issues.apache.org/jira/browse/CB-12016): removed `pluginMapper` code from uninstall
* [CB-12337](https://issues.apache.org/jira/browse/CB-12337): Resolve symbolic links in project root
* [CB-11346](https://issues.apache.org/jira/browse/CB-11346): Remove known platforms check
* [CB-11977](https://issues.apache.org/jira/browse/CB-11977): removed support for `node 0.x`
* [CB-12021](https://issues.apache.org/jira/browse/CB-12021): Added local path support to `--fetch` and fixed failing tests for adding a relative path
* [CB-11960](https://issues.apache.org/jira/browse/CB-11960): Added support to `package.json` for platform/plugin add/rm
* [CB-12001](https://issues.apache.org/jira/browse/CB-12001): Added support for platform/plugin & `spec` restore to sync `config.xml` and `package.json`

### 6.5.0 (Jan 17, 2017)
* [CB-12018](https://issues.apache.org/jira/browse/CB-12018): updated `jshint` and updated `jasmine` tests to work with `jasmine` instead of `jasmine-node`
* [CB-12314](https://issues.apache.org/jira/browse/CB-12314) updated pinned android to 6.1.1
* [CB-12261](https://issues.apache.org/jira/browse/CB-12261) fix subdirectories deprecated warning always shows and stop fetch caused by [CB-11979](https://issues.apache.org/jira/browse/CB-11979)
* [CB-12284](https://issues.apache.org/jira/browse/CB-12284) Include project root as additional root for static router
* [CB-12088](https://issues.apache.org/jira/browse/CB-12088) Fix misleading warning when adding platform without `Api.js`

### 6.4.0 (Oct 21, 2016)
* [CB-12039](https://issues.apache.org/jira/browse/CB-12039) updated pinned `Android` to 6.0.0 and `iOS` to 4.3.0
* [CB-11979](https://issues.apache.org/jira/browse/CB-11979) added deprecation warning for installing plugins via subdirectories
* [CB-11730](https://issues.apache.org/jira/browse/CB-11730) Modify condition of if clause to avoid similar project name with plugin name
* [CB-11985](https://issues.apache.org/jira/browse/CB-11985) Check if cached platform/plugin exists before `npm cache`
* [CB-11951](https://issues.apache.org/jira/browse/CB-11951) [CB-11967](https://issues.apache.org/jira/browse/CB-11967) Respect preference default values when installling plugins
* [CB-11771](https://issues.apache.org/jira/browse/CB-11771) Deep symlink directories to target project instead of linking the directory itself
* [CB-11908](https://issues.apache.org/jira/browse/CB-11908) Handle `edit-config` in `config.xml` on prepare
* Add github pull request template
* [CB-8320](https://issues.apache.org/jira/browse/CB-8320) We look for a `build.gradle` to make sure it's **Android**, not an `AndroidManifest`, because it moved
* [CB-11811](https://issues.apache.org/jira/browse/CB-11811) Moved **iOS** platform specific tests to `platform.spec.ios.js`, added `test-ios` npm run script.
* [CB-11811](https://issues.apache.org/jira/browse/CB-11811) disable `CocoaPods` e2e test temporarily since it is platform specific and requires cocoapods to be installed.
* updated `save.spec.js` to use latest **android** and newer fb plugin
* [CB-11607](https://issues.apache.org/jira/browse/CB-11607) breakout `cordova-create` from `cordova-lib`
* [CB-9825](https://issues.apache.org/jira/browse/CB-9825) framework tag spec parsing
* [CB-11698](https://issues.apache.org/jira/browse/CB-11698) Fix plugin installation when restoring platform
* [CB-11679](https://issues.apache.org/jira/browse/CB-11679) Speed up save/restore tests
* [CB-11205](https://issues.apache.org/jira/browse/CB-11205) Respect saved variables when installing plugin
* [CB-11589](https://issues.apache.org/jira/browse/CB-11589) Fix missing plugin files after restore

### 6.3.1 (Aug 08, 2016)
* [CB-11652](https://issues.apache.org/jira/browse/CB-11652) Update run and emulate to skip build
* [CB-11194](https://issues.apache.org/jira/browse/CB-11194) Defer creating of libDir folder until something actually requests it
* [CB-11493](https://issues.apache.org/jira/browse/CB-11493) Add cordova emulate option to skip prepare
* [CB-11205](https://issues.apache.org/jira/browse/CB-11205) Respect saved variables when installing plugin
* [CB-11589](https://issues.apache.org/jira/browse/CB-11589) Fix missing plugin files after restore

### 6.3.0 (Jul 12, 2016)
* [CB-11491](https://issues.apache.org/jira/browse/CB-11491) Introduce before_deploy hook
* [CB-11412](https://issues.apache.org/jira/browse/CB-11412) template support for www folders
* Fix config.xml path in PlatformApi.prepare
* [CB-11412](https://issues.apache.org/jira/browse/CB-11412) improve template implementation
* [CB-11164](https://issues.apache.org/jira/browse/CB-11164) Allow forced dependent plugin removal
* [CB-11339](https://issues.apache.org/jira/browse/CB-11339) Add a warning about prerelease platform usage
* [CB-11349](https://issues.apache.org/jira/browse/CB-11349) added --fetch and cordova fetch to create --template
* [CB-11337](https://issues.apache.org/jira/browse/CB-11337) Use latest released platform version in e2e tests
* [CB-11274](https://issues.apache.org/jira/browse/CB-11274) Platform browser: wrong path for config.xml
* [CB-11274](https://issues.apache.org/jira/browse/CB-11274) Make serve dashboard take config.xml -> content.src entry point into account
* [CB-11261](https://issues.apache.org/jira/browse/CB-11261) Cut out '-nightly' prerelease tag when checking plugin engines
* [CB-9858](https://issues.apache.org/jira/browse/CB-9858) added fetch tests to travis
* [CB-9858](https://issues.apache.org/jira/browse/CB-9858) fixed failing travis and appveyor tests

### 6.2.0 (May 12, 2016)
* [CB-11259](https://issues.apache.org/jira/browse/CB-11259) Improving prepare and build logging
* Resolve npm run jshint failure due to npm/npm#10343
* [CB-11200](https://issues.apache.org/jira/browse/CB-11200) Bump `node-xcode` dependency and update tests to pass
* [CB-11240](https://issues.apache.org/jira/browse/CB-11240) added `--fetch` support to `cordova prepare`
* [CB-9858](https://issues.apache.org/jira/browse/CB-9858) merging initial `--fetch` work for plugin and platform fetching
* [CB-11194](https://issues.apache.org/jira/browse/CB-11194) Improve cordova load time
* [CB-11174](https://issues.apache.org/jira/browse/CB-11174) Resolve `symlinked` path before getting `PlatformApi` instance
* [CB-11036](https://issues.apache.org/jira/browse/CB-11036) `args.slice is not a function` when building **Windows** with other platform
* [CB-10761](https://issues.apache.org/jira/browse/CB-10761) Resore plugins saved without spec attribute
* [CB-10981](https://issues.apache.org/jira/browse/CB-10981) Remove `cordova-common` from bundled dependencies
* [CB-11042](https://issues.apache.org/jira/browse/CB-11042) Add cordova run option to skip prepare
* [CB-11022](https://issues.apache.org/jira/browse/CB-11022) Respect result returned by plugin installation and skip prepare if it is truthy
* [CB-10975](https://issues.apache.org/jira/browse/CB-10975) Allow plugin path to be relative to current directory
* [CB-10986](https://issues.apache.org/jira/browse/CB-10986) Adding support for scoped npm package plugins
* [CB-10770](https://issues.apache.org/jira/browse/CB-10770) Remove `cache-min` when adding platforms
* [CB-10921](https://issues.apache.org/jira/browse/CB-10921) Emit warning in case of plugin restoration failure

### 6.1.1 (Mar 29, 2016)
* [CB-10961](https://issues.apache.org/jira/browse/CB-10961) Error no such file or directory adding ios platform when plugins present or required
* [CB-10908](https://issues.apache.org/jira/browse/CB-10908) Reload the config.xml before writing the saved plugin

### 6.1.0 (Mar 17, 2016)
* [CB-10902](https://issues.apache.org/jira/browse/CB-10902) updated pinned platforms
* [CB-10808](https://issues.apache.org/jira/browse/CB-10808) revert npm install for templates
* [CB-10808](https://issues.apache.org/jira/browse/CB-10808) CLI Support templates with subdirectory
* [CB-10880](https://issues.apache.org/jira/browse/CB-10880) Removed plugin pinning
* [CB-10679](https://issues.apache.org/jira/browse/CB-10679) Improving version choosing logic test coverage
* [CB-10673](https://issues.apache.org/jira/browse/CB-10673) add plugin `--force` option.
* [CB-10679](https://issues.apache.org/jira/browse/CB-10679) New version choosing logic for plugin add
* [CB-10328](https://issues.apache.org/jira/browse/CB-10328) set top-level property when adding new platforms
* [CB-10314](https://issues.apache.org/jira/browse/CB-10314) avoid fetching plugins when oldId is already fetched
* [CB-10708](https://issues.apache.org/jira/browse/CB-10708) Install/uninstall plugins correctly into CLI project using plugman
* [CB-10462](https://issues.apache.org/jira/browse/CB-10462) Get rid of npmconf in favor of npm.
* [CB-10662](https://issues.apache.org/jira/browse/CB-10662) Use project's `config.xml` as a fallback for package name
* [CB-10644](https://issues.apache.org/jira/browse/CB-10644) Adds deprecation message about old platforms support removal.
* [CB-10519](https://issues.apache.org/jira/browse/CB-10519) Wrap all sync calls inside of `cordova.raw` methods into promises
* [CB-10641](https://issues.apache.org/jira/browse/CB-10641) Adds tests for order of operations in platform add
* [CB-10641](https://issues.apache.org/jira/browse/CB-10641) Run prepare `_after_` plugins were installed
* [CB-10618](https://issues.apache.org/jira/browse/CB-10618) Do not call `prepBuildFiles` for `cordova-android@>=5.2.0`.
* [CB-10518](https://issues.apache.org/jira/browse/CB-10518) Correct log level and error messages for some cordova errors
* [CB-10550](https://issues.apache.org/jira/browse/CB-10550) Fix plugin id mapper not enforced when a version is specified
* [CB-10611](https://issues.apache.org/jira/browse/CB-10611) fix `before_plugin_install` hook not disabled with `--nohooks`
* [CB-10235](https://issues.apache.org/jira/browse/CB-10235) Added clearer error message for info command.
* [CB-10584](https://issues.apache.org/jira/browse/CB-10584) Splashscreen plugin crashes the app on windows 10 when built with browserify
* [CB-10592](https://issues.apache.org/jira/browse/CB-10592) Don't quote platform specific args values
* [CB-10482](https://issues.apache.org/jira/browse/CB-10482) Remove references to **windows8** from cordova-lib/cli
* [CB-10567](https://issues.apache.org/jira/browse/CB-10567) Bubble up `cordova.raw.run()` error to the caller
* [CB-10553](https://issues.apache.org/jira/browse/CB-10553) Fix framework tag handler for **Android**
* [CB-10461](https://issues.apache.org/jira/browse/CB-10461) `cordova platform ls` should list the versions of platforms pinned
* [CB-10531](https://issues.apache.org/jira/browse/CB-10531) Enable coverage reports for cordova-lib
* [CB-10465](https://issues.apache.org/jira/browse/CB-10465) Pass correct options to prepare from compile
* [CB-10459](https://issues.apache.org/jira/browse/CB-10459) cordova platform list should mark amazon-fireos and wp8 as deprecated
* [CB-10499](https://issues.apache.org/jira/browse/CB-10499) `--template` should pull the latest template from npm when version isn't specified
* [CB-10432](https://issues.apache.org/jira/browse/CB-10432) Adds e2e test to protect against future regressions.
* Added node versions matrix to `.travis.yml`.

### 6.0.0 (Jan 25, 2016)
* [CB-10432](https://issues.apache.org/jira/browse/CB-10432) Fix plugin installation for newly added platform
* [CB-10423](https://issues.apache.org/jira/browse/CB-10423) allow recursive folder copy skipping whatever .. was
* [CB-10394](https://issues.apache.org/jira/browse/CB-10394) updated pinned **Android** version to `~5.1.0`
* [CB-10299](https://issues.apache.org/jira/browse/CB-10299) updated pinned **windows** version to `~4.3.0`
* [CB-10274](https://issues.apache.org/jira/browse/CB-10274) Make www directory the default for plugman
* [CB-10121](https://issues.apache.org/jira/browse/CB-10121) added deprecation notice for **amazon-fireos** and **wp8**
* [CB-7183](https://issues.apache.org/jira/browse/CB-7183) prevent read/write/modify files outside project from plugins
* [CB-8455](https://issues.apache.org/jira/browse/CB-8455) Added `--nohooks` option.
* [CB-10193](https://issues.apache.org/jira/browse/CB-10193) Add deprecation notice about `pre_package` removal
* [CB-10147](https://issues.apache.org/jira/browse/CB-10147) updated pinned **iOS** to `~4.0.0`
* [CB-10125](https://issues.apache.org/jira/browse/CB-10125): Android build fails on read-only files.
* [CB-6698](https://issues.apache.org/jira/browse/CB-6698) Fix directory resolution of framework with parent.
* [CB-9653](https://issues.apache.org/jira/browse/CB-9653) Adds copying of **blackberry10** splashscreens
* **Ubuntu** support for the new plugin naming convention
* [CB-9957](https://issues.apache.org/jira/browse/CB-9957) removed support for fetching from Cordova Plugins Registry. Only fetch plugins from **npm** now.
* [CB-10108](https://issues.apache.org/jira/browse/CB-10108) Fixes **android** frameworks installation/removal
* [CB-9964](https://issues.apache.org/jira/browse/CB-9964) Added `--template` support to `cordova create`
* Removing the `--usegit` flag from `cordova platform`. Recommended method is to use `cordova platform add git_url#branch`
* [CB-10081](https://issues.apache.org/jira/browse/CB-10081) pinned plugin versions. These are default versions fetched when adding a plugin.
* add missing `package_suffix` function on **amazon-fireos** platform for plugman installations.
* [CB-10057](https://issues.apache.org/jira/browse/CB-10057) - removing `<access>` tag does not remove `ATS` entry
* [CB-10048](https://issues.apache.org/jira/browse/CB-10048) clobbering of `<access>` tags to `ATS` directives

### 5.4.1 (Nov 19, 2015)
* [CB-9976](https://issues.apache.org/jira/browse/CB-9976) Reinstall plugins for platform if they were installed with `cordova@<5.4.0`.
* [CB-9981](https://issues.apache.org/jira/browse/CB-9981) `path.parse` only available on `node 0.12+`.
* [CB-9987](https://issues.apache.org/jira/browse/CB-9987) Adds compatibility layer for `cordova.raw.*` methods
* [CB-9975](https://issues.apache.org/jira/browse/CB-9975) Fix issue with using `all" as orientation for **iOS**
* [CB-9984](https://issues.apache.org/jira/browse/CB-9984) Bumps `plist` version and fixes failing `cordova-common` test

### 5.4.0 (Oct 30, 2015)
* [CB-9935](https://issues.apache.org/jira/browse/CB-9935) Cordova CLI silently fails on node.js v5
* [CB-9834](https://issues.apache.org/jira/browse/CB-9834) Introduce compat map for hook requires
* [CB-9902](https://issues.apache.org/jira/browse/CB-9902) Fix broken `cordova run --list`
* [CB-9872](https://issues.apache.org/jira/browse/CB-9872) Fixed save.spec.11 failure
* [CB-9800](https://issues.apache.org/jira/browse/CB-9800) Fixing contribute link.
* [CB-9736](https://issues.apache.org/jira/browse/CB-9736) Extra main activity generated when an android package name is specified
* [CB-9675](https://issues.apache.org/jira/browse/CB-9675) OSX App Icons are not properly copied.
* [CB-9758](https://issues.apache.org/jira/browse/CB-9758) Mobilespec crashes adding plugins on OS X
* [CB-9782](https://issues.apache.org/jira/browse/CB-9782) Update create/update signatures for PlatformApi polyfill
* [CB-9815](https://issues.apache.org/jira/browse/CB-9815) Engine name="cordova" should check tools version, not platforms.
* [CB-9824](https://issues.apache.org/jira/browse/CB-9824) removed plugin download counter code from lib
* [CB-9821](https://issues.apache.org/jira/browse/CB-9821) Fix EventEmitter incorrect trace level usages
* [CB-9813](https://issues.apache.org/jira/browse/CB-9813) Keep module-to-plugin mapping at hand.
* [CB-9598](https://issues.apache.org/jira/browse/CB-9598) Fixes broken `require` for FFOS plugin handler
* Update 'serve' to use 'express' implementation of cordova-serve.
* [CB-9712](https://issues.apache.org/jira/browse/CB-9712) CLI 5.3 breaks with node 3.3.3
* [CB-9598](https://issues.apache.org/jira/browse/CB-9598) Fixies broken require calls that aren't covered by tests
* [CB-9589](https://issues.apache.org/jira/browse/CB-9589) added more warnings and added conversion step to fetch.js
* [CB-9589](https://issues.apache.org/jira/browse/CB-9589) auto convert old plugin ids to new npm ids using [registry-mapper](https://github.com/stevengill/cordova-registry-mapper)
* Pick ConfigParser changes from apache@0c3614e
* [CB-9743](https://issues.apache.org/jira/browse/CB-9743) Removes system frameworks handling from ConfigChanges
* [CB-9598](https://issues.apache.org/jira/browse/CB-9598) Cleans out code which has been moved to `cordova-common`
* [CB-9598](https://issues.apache.org/jira/browse/CB-9598) Switches LIB to use `cordova-common`
* [CB-9569](https://issues.apache.org/jira/browse/CB-9569) Support <access> and <allow-navigation> tag translation to Application Transport Security (ATS) Info.plist directives.
* [CB-9737](https://issues.apache.org/jira/browse/CB-9737) (save flag) unit test failures for spec.14
* [CB-8914](https://issues.apache.org/jira/browse/CB-8914) when project is renamed, remove userdata otherwise project is un-usable in xcode
* [CB-9665](https://issues.apache.org/jira/browse/CB-9665) Support .xcassets for icons and splashscreens in the CLI
* [CB-9407](https://issues.apache.org/jira/browse/CB-9407) Fixes incorrect applying of plugin-provided config changes.
* [CB-8198](https://issues.apache.org/jira/browse/CB-8198) Unified console output logic for core platforms
* [CB-9408](https://issues.apache.org/jira/browse/CB-9408) Added support for `windows-packageVersion` on `<widget>`
* [CB-9588](https://issues.apache.org/jira/browse/CB-9588) Plugman. Add support for <resource-file> on Windows
* [CB-8615](https://issues.apache.org/jira/browse/CB-8615) Improves plugman tests for Windows
* [CB-8615](https://issues.apache.org/jira/browse/CB-8615) **Windows** .winmd files with the same names are not added properly when using framework tag with target attribute
* [CB-9297](https://issues.apache.org/jira/browse/CB-9297) Parse xcode project syncronously to avoid issues with node v4
* [CB-9617](https://issues.apache.org/jira/browse/CB-9617) Do not restore plugins after plugin removal.
* [CB-9631](https://issues.apache.org/jira/browse/CB-9631) Save plugin to config.xml only if installation succeeds
* [CB-9601](https://issues.apache.org/jira/browse/CB-9601) Fix <framework>.versions support on Windows after semver update
* [CB-9617](https://issues.apache.org/jira/browse/CB-9617) Fixes incorrect project state after adding/removing plugins
* [CB-9560](https://issues.apache.org/jira/browse/CB-9560) Issue using plugin restore for plugins with common dependencies
* [CB-8993](https://issues.apache.org/jira/browse/CB-8993) Plugin restore ignores search path
* [CB-9587](https://issues.apache.org/jira/browse/CB-9587) Check if browser platform added properly before creating parser.
* [CB-9604](https://issues.apache.org/jira/browse/CB-9604) Fix error adding browser platform with PlatformApi polyfill.
* [CB-9597](https://issues.apache.org/jira/browse/CB-9597) Initial Implementation of PlatformApiPoly
* [CB-9354](https://issues.apache.org/jira/browse/CB-9354) Fix array merging with complex items
* [CB-9556](https://issues.apache.org/jira/browse/CB-9556) Don't uninstall dependent plugin if it was installed as a top-level after

### 5.3.2 (Sep 17, 2015)
* [CB-9297](https://issues.apache.org/jira/browse/CB-9297) Parse xcode project syncronously to avoid issues with node v4

### 5.3.1 (Aug 28, 2015)
* pinned blackberry@3.8.0 in prepartion for its release
* pinned browser@4.0.0 and windows@4.1.0
* [CB-9559](https://issues.apache.org/jira/browse/CB-9559) Adding a plugin with caret in version results in an error
* Update cordova-serve required version to 0.1.3.
* [CB-6506](https://issues.apache.org/jira/browse/CB-6506) RTC: Add support for OSX (closes #278)
* [CB-9517](https://issues.apache.org/jira/browse/CB-9517) Adding a plugin on iOS/OSX that uses a private framework does not work (closes #281)
* [CB-9549](https://issues.apache.org/jira/browse/CB-9549) Removes excess JS files from browserified app
* [CB-9505](https://issues.apache.org/jira/browse/CB-9505) Correct plugin modules loading within browserify flow
* [CB-8532](https://issues.apache.org/jira/browse/CB-8532) Adding Windows Plugin Failed with "Cannot read property 'text' of null" Updated elementtree API according 0.1.6 release. This closes #277

### 5.2.0 (Aug 06, 2015)
* [CB-9436](https://issues.apache.org/jira/browse/CB-9436) Removes `require-tr` bundle transformation
* updated pinned ios version to ~3.9.0
* [CB-9278](https://issues.apache.org/jira/browse/CB-9278): Restoring multiple platforms fails. This closes #266
* updated pinned android to ~4.1.0
* [CB-9421](https://issues.apache.org/jira/browse/CB-9421) Added a test for plugin fetch with searchpath parameter
* [CB-9421](https://issues.apache.org/jira/browse/CB-9421) Fixed searchpath parameter being ignored. This closes #269
* Update xcode dependency to latest stable version. This closes #272
* [CB-9420](https://issues.apache.org/jira/browse/CB-9420) Fixes malformed require calls in browserify bundle. This closes #270
* [CB-9405](https://issues.apache.org/jira/browse/CB-9405) limit author/description to 256 char per WMAppManifest schema
* [CB-9414](https://issues.apache.org/jira/browse/CB-9414) plugin fetching now defaults to npm, CPR fallback
* [CB-9384](https://issues.apache.org/jira/browse/CB-9384) Added tests that test plugin fetch from github branch|tag|sha
* added comment outlining the types of things git_ref can be : commit SHA | branch | tag
* actually checkout git_ref because it may be a branch OR a commit SHA
* [CB-9332](https://issues.apache.org/jira/browse/CB-9332) Upgrade npm and semver to actual versions
* [CB-9330](https://issues.apache.org/jira/browse/CB-9330) updated wording for warning messages for removal of publish/unpublish commands
* Adds stubs for `publish`/`unpublish` commands. This closes #254
* [CB-9330](https://issues.apache.org/jira/browse/CB-9330) Removes 'plugman publish' related functionality
* [CB-9335](https://issues.apache.org/jira/browse/CB-9335): Windows quality-of-life improvements.  To align with the change in Cordova-Windows which removes the Windows 8 project from the solution file used by Windows 8.1 and Windows 10, the same is done in the spec.
* Fix prepare to wait the promise from plugman prepare.
* [CB-9362](https://issues.apache.org/jira/browse/CB-9362) Don't fail if superspawn can't chmod a file
* [CB-9122](https://issues.apache.org/jira/browse/CB-9122) Added tests for platform/plugin add/rm/update with --save flag. This closes #246
* Fixed ios node-xcode related tests failing on Windows according to version update
* Added webOS parsers for project creation/manipulation
* [CB-8965](https://issues.apache.org/jira/browse/CB-8965) Prevent cli from copying cordova.js and cordova-js-src/ multiple times
* [CB-9114](https://issues.apache.org/jira/browse/CB-9114): Log deprecation message when --usegit flag is used. This closes #234
* [CB-9126](https://issues.apache.org/jira/browse/CB-9126) Fix ios pbxproj' resources paths when adding ios platform on non-OSX environment. This closes #237
* [CB-9221](https://issues.apache.org/jira/browse/CB-9221) Updates `cordova serve` command to use cordova-serve module.
* [CB-9225](https://issues.apache.org/jira/browse/CB-9225) Add windows platform support to `plugman platform add`
* [CB-9163](https://issues.apache.org/jira/browse/CB-9163) when engine check isn't satisfied, skip that plugin install
* [CB-9162](https://issues.apache.org/jira/browse/CB-9162) Adds support for default values for plugin variables.
* [CB-9188](https://issues.apache.org/jira/browse/CB-9188) Confusing error after delete plugin folder then prepare.
* [CB-9145](https://issues.apache.org/jira/browse/CB-9145) prepare can lose data during config munge
* [CB-9177](https://issues.apache.org/jira/browse/CB-9177) Use tilde instead of caret when save to config.xml.
* [CB-9147](https://issues.apache.org/jira/browse/CB-9147) Adding a platform via caret version adds latest rather than the latest matching.
* [CB-5578](https://issues.apache.org/jira/browse/CB-5578) Adds `clean` module to cordova. This closes #241
* [CB-9124](https://issues.apache.org/jira/browse/CB-9124) Makes network-related errors' messages more descriptive.
* [CB-9067](https://issues.apache.org/jira/browse/CB-9067) fixed plugman config set registry and adduser
* [CB-8993](https://issues.apache.org/jira/browse/CB-8993) Plugin restore ignores search path. This closes #224
* [CB-9087](https://issues.apache.org/jira/browse/CB-9087) updated pinned windows platform to 4.0.0
* [CB-9108](https://issues.apache.org/jira/browse/CB-9108) Handle version ranges when add platform with --usegit.
* [CB-8898](https://issues.apache.org/jira/browse/CB-8898) Makes error message descriptive when `requirements` is called outside of cordova project.
* [CB-8007](https://issues.apache.org/jira/browse/CB-8007) Two cordova plugins modifying “*-Info.plist” CFBundleURLTypes
* [CB-9065](https://issues.apache.org/jira/browse/CB-9065) Allow removing plugins by short name.
* [CB-9001](https://issues.apache.org/jira/browse/CB-9001) Set WMAppManifest.xml Author, Description and Publisher attributes based on config.xml
* [CB-9073](https://issues.apache.org/jira/browse/CB-9073) Allow to add platform if project path contains `&` symbol

### 5.1.1 (June 4, 2015)
* [CB-9087](https://issues.apache.org/jira/browse/CB-9087) Updated pinned version of cordova-windows to 4.0.0
* [CB-9108](https://issues.apache.org/jira/browse/CB-9108) Handle version ranges when add platform with --usegit.
* [CB-8898](https://issues.apache.org/jira/browse/CB-8898) Makes error message descriptive when `requirements` is called outside of cordova project.
* Fix four failing tests on Windows.
* [CB-8007](https://issues.apache.org/jira/browse/CB-8007) Two cordova plugins modifying “*-Info.plist” CFBundleURLTypes
* [CB-9065](https://issues.apache.org/jira/browse/CB-9065) Allow removing plugins by short name.
* [CB-9001](https://issues.apache.org/jira/browse/CB-9001) Set WMAppManifest.xml Author, Description and Publisher attributes based on config.xml
* [CB-9073](https://issues.apache.org/jira/browse/CB-9073) Allow to add platform if project path contains `&` symbol
* [CB-8783](https://issues.apache.org/jira/browse/CB-8783) - Revert 'all' as a global preference value for Orientation (specific to iOS for now)
* [CB-8783](https://issues.apache.org/jira/browse/CB-8783) - 'default' value for Orientation does not support both landscape and portrait orientations. (new 'all' value)
* [CB-9075](https://issues.apache.org/jira/browse/CB-9075) pinned platforms will include patch updates without new tools release
* [CB-9051](https://issues.apache.org/jira/browse/CB-9051) Plugins don't get re-added if platforms folder deleted.
* [CB-9025](https://issues.apache.org/jira/browse/CB-9025) Call windows `prepare` logic on as part of cordova-lib `prepare`. This closes #217
* [CB-9048](https://issues.apache.org/jira/browse/CB-9048) Clean up git cloned directories (close #222)
* [CB-8965](https://issues.apache.org/jira/browse/CB-8965) readded browserify transform
* [CB-8965](https://issues.apache.org/jira/browse/CB-8965) copy platform specific js into platform_www when adding new platforms for browserify workflow
* [CB-8965](https://issues.apache.org/jira/browse/CB-8965) passing platform as argument when getting symbolList
* [CB-8965](https://issues.apache.org/jira/browse/CB-8965) copy platform specific js into platform_www when adding new platforms for browserify workflow
* Add support to specify a build config file. If none is specified `build.json` in the project root is used as a default This closes #215
* [CB-9030](https://issues.apache.org/jira/browse/CB-9030): Modifies superspawn to support a "chmod" option. When truthy, attempts to set the target file mode to 755 before executing.  Specifies this argument as truthy for common CLI operations (compile, run, and steps in plugman).  Didn't add it for hooks runner since that particular mode is in legacy support.
* [CB-8989](https://issues.apache.org/jira/browse/CB-8989) - cordova-lib jasmine tests are failing on older hardware
* [CB-6462](https://issues.apache.org/jira/browse/CB-6462) [CB-6026](https://issues.apache.org/jira/browse/CB-6026) - Orientation preference now updates `UISupportedInterfaceOrientations~ipad` too.
* [CB-8898](https://issues.apache.org/jira/browse/CB-8898) Introduces `requirements` cordova module
* Update elementtree dependency to 0.1.6. Note it has a breaking API change. https://github.com/racker/node-elementtree/issues/24 (closes #209)
* [CB-8757](https://issues.apache.org/jira/browse/CB-8757) Resolve symlinks in order to avoid relative path issues (close #212)
* [CB-8956](https://issues.apache.org/jira/browse/CB-8956) Remove hardcoded reference to registry.npmjs.org
* [CB-8934](https://issues.apache.org/jira/browse/CB-8934) fixed regression with projects config.json not being used in cordova create
* [CB-8908](https://issues.apache.org/jira/browse/CB-8908) Make fetching via git faster via --depth=1
* [CB-8897](https://issues.apache.org/jira/browse/CB-8897) Make default icon/splash on Android map to mdpi

### 5.0.0 (Apr 16, 2015)
* [CB-8865](https://issues.apache.org/jira/browse/CB-8865) fixed plugman.help()
* Pinned Cordova-Android version 4.0.0
* [CB-8775](https://issues.apache.org/jira/browse/CB-8775) updated warning message to be more descriptive
* Fix getPlatformVersion fails for paths with spaces
* [CB-8799](https://issues.apache.org/jira/browse/CB-8799) Save plugin/platform src and version to 'spec' attribute.
* [CB-8807](https://issues.apache.org/jira/browse/CB-8807) Platform Add fails to add plugins with variables.
* [CB-8832](https://issues.apache.org/jira/browse/CB-8832) Fix iOS icon copying logic to not use default for every size
* Updated pinned versions of windows and wp8
* [CB-8775](https://issues.apache.org/jira/browse/CB-8775) adding a plugin will still copy it to plugins folder, except if the plugin's new or old id is already installed.
* [CB-8775](https://issues.apache.org/jira/browse/CB-8775) removed failing test
* Fix setGlobalPreference() in ConfigParser
* removed mostly unused relativePath checking and added missing cases for isAbsolutePath
* use string method for clarity
* [CB-8775](https://issues.apache.org/jira/browse/CB-8775) new style plugins won't install if same RDS plugin is installed and vice versa
* [CB-8791](https://issues.apache.org/jira/browse/CB-8791) Recognize UAP as a valid TargetPlatformIdentifier
* [CB-8784](https://issues.apache.org/jira/browse/CB-8784) Prepare with no platforms should restore all platforms.
* Fix plugman install failure on iOS containing &
* [CB-8703](https://issues.apache.org/jira/browse/CB-8703): Test failure after merge to head.
* [CB-8703](https://issues.apache.org/jira/browse/CB-8703): Add support for semver and device-specific targeting of config-file to Windows
* [CB-8596](https://issues.apache.org/jira/browse/CB-8596) Expose APIs to retrieve platforms and plugins saved in config.xml.
* [CB-8741](https://issues.apache.org/jira/browse/CB-8741) Make plugin --save work more like npm install
* [CB-8755](https://issues.apache.org/jira/browse/CB-8755) Plugin --save: Multiple config.xml entries don't get removed
* [CB-8754](https://issues.apache.org/jira/browse/CB-8754) Auto-restoring a plugin fails when adding a platform.
* [CB-8651](https://issues.apache.org/jira/browse/CB-8651) Restoring platforms causes plugin install to be triggered twice  (close #196)
* [CB-8731](https://issues.apache.org/jira/browse/CB-8731) updated app hello world dependency to 3.9.0
* [CB-8757](https://issues.apache.org/jira/browse/CB-8757) ios: Make paths with --link relative to the real project path (close #192)
* [CB-8286](https://issues.apache.org/jira/browse/CB-8286) Fix regression from e70432f2: Never want to link to app-hello-world
* [CB-8737](https://issues.apache.org/jira/browse/CB-8737) Available platforms list includes extraneous values
* Bugfix to json.parse before using cfg
* Add merges/ by default, now all tests pass
* Move cordova-app-hello-world dependency to cordova-lib
* Support the old 4-argument version of create again
* [CB-8286](https://issues.apache.org/jira/browse/CB-8286) Update create.js to always require passing in a www
* Show npm failure message when plugin fetch fails
* [CB-8725](https://issues.apache.org/jira/browse/CB-8725) Fix plugin add from npm when authenticated to CPR
* [CB-8499](https://issues.apache.org/jira/browse/CB-8499) Remove project_dir from (un)installers signature
* Add addElement() to ConfigParser
* [CB-8696](https://issues.apache.org/jira/browse/CB-8696) Fix fetching of dependencies with semver constraints rather than exact versions
* [CB-7747](https://issues.apache.org/jira/browse/CB-7747) Add `<allow-intent>` for App Store on iOS
* Export PlatformProjectAdapter from platforms.js
* Allow subdirs for icons on BB10
* [CB-8670](https://issues.apache.org/jira/browse/CB-8670) Error when set engine name to "cordova-windows" in plugin.xml
* Allow hyphen in platform name
* [CB-8521](https://issues.apache.org/jira/browse/CB-8521) Cleans up plugin metadata save method
* [CB-8521](https://issues.apache.org/jira/browse/CB-8521) Adds `cordova plugin save` which saves all installed plugins to config.xml
* [CB-7698](https://issues.apache.org/jira/browse/CB-7698) BugFix: For plugins which require variables, 'cordova plugin add FOO' should fail when no variables specified.
* Add setGlobalPreference() to ConfigParser
* [CB-8499](https://issues.apache.org/jira/browse/CB-8499) Merge platforms.js from cordova and plugman
* rename references to feature to plugin
* Deprecate the old feature syntax from config.xml
* [CB-8634](https://issues.apache.org/jira/browse/CB-8634) Fixes missed merge/rebase issue
* [CB-8634](https://issues.apache.org/jira/browse/CB-8634) Adds support for custom branches for `cordova platform add`
* [CB-8633](https://issues.apache.org/jira/browse/CB-8633) BugFix: Support for urls to tarballs was broken
* [CB-8499](https://issues.apache.org/jira/browse/CB-8499) `cordova platform save`: save installed platforms and their sources (versions/git_urls/folders) into config.xml
* [CB-8499](https://issues.apache.org/jira/browse/CB-8499) When deleting a platform, remove it from platforms.json
* [CB-8499](https://issues.apache.org/jira/browse/CB-8499) When adding a platform, capture version/folder/url being added to allow us to be able to save all installed platforms and their versions later on by doing 'cordova platform save'
* [CB-8602](https://issues.apache.org/jira/browse/CB-8602) plugman: publish fail early if unsupported npm is active
* [CB-7747](https://issues.apache.org/jira/browse/CB-7747) Add `<allow-intent>`s to default template
* [CB-8616](https://issues.apache.org/jira/browse/CB-8616) Support 9-patch images for default android splashscreen
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) fixed regex in isValidCprName
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) updated version of registry mapper and cordova plugin rm code
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) merged fetchNPM and fetchPlugReg into fetchPlugin
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) updated regex in isValidCprName to exclude matching @version
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) split up changePluginId into two functions
* [CB-8457](https://issues.apache.org/jira/browse/CB-8457) Ignore version specifier when running hooks (close #165)
* [CB-8578](https://issues.apache.org/jira/browse/CB-8578) `cordova plugin add <plugin>` should be able to restore urls and folders in addition to versions. (close #173)
* [CB-7827](https://issues.apache.org/jira/browse/CB-7827) Add support for `android-activityName` within `config.xml` (close #171)
* Add org.apache.cordova.test-framework to plugman publish whitelist
* [CB-8577](https://issues.apache.org/jira/browse/CB-8577) - Read plugin variables from correct tag
* [CB-8555](https://issues.apache.org/jira/browse/CB-8555) Incremented package version to -dev
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) added plugin-name support for removing plugins.
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) Skip CPR if pluginID isn't reverse domain name style
* [CB-8551](https://issues.apache.org/jira/browse/CB-8551) added npm fetching as fallback

### 4.3.0 (Feb 27, 2015)
* updated pinned versions of ios to 3.8.0 and android to 3.7.1
* [CB-8524](https://issues.apache.org/jira/browse/CB-8524) Switched to the latest Windows release
* changed createpackage.json keyword to ecosystem:cordova
* [CB-8448](https://issues.apache.org/jira/browse/CB-8448) add support for activities
* [CB-8482](https://issues.apache.org/jira/browse/CB-8482) rename: platformId -> platformName
* [CB-8482](https://issues.apache.org/jira/browse/CB-8482): Update engine syntax within config.xml
* Organize save logic some more
* --save flag for plugins
* fix for test after prepare changes
* restore plugins and platforms on prepare
* [CB-8472](https://issues.apache.org/jira/browse/CB-8472) Can't find config.xml error installing browser platform after plugin.  (close #167)
* [CB-8469](https://issues.apache.org/jira/browse/CB-8469) android: Call into platform's build.js after `plugin add` so that Android Studio will work without needing an explicit command-line build first
* [CB-8123](https://issues.apache.org/jira/browse/CB-8123) Fix JSHINT issue.
* [CB-8123](https://issues.apache.org/jira/browse/CB-8123) Fix path handling so tests work on any platform.
* [CB-8123](https://issues.apache.org/jira/browse/CB-8123) Rename further windows platform related files.
* [CB-8123](https://issues.apache.org/jira/browse/CB-8123) Rename windows platform related files.
* [CB-8123](https://issues.apache.org/jira/browse/CB-8123) Plugin references can target specific windows platforms.
* [CB-8420](https://issues.apache.org/jira/browse/CB-8420) Make `cordova plugin add FOO` use version from config.xml (close #162)
* [CB-8239](https://issues.apache.org/jira/browse/CB-8239) Fix `cordova platform add PATH` when PATH is relative and CWD != project root
* [CB-8227](https://issues.apache.org/jira/browse/CB-8227) CB8237 [CB-8238](https://issues.apache.org/jira/browse/CB-8238) Add --save flag and autosave to 'cordova platform add', 'cordova platform remove' and 'cordova platform update'
* [CB-8409](https://issues.apache.org/jira/browse/CB-8409) compile: bubble failures
* [CB-8239](https://issues.apache.org/jira/browse/CB-8239) Fix "platform update" should ignore `<cdv:engine>` (close #159)
* [CB-8390](https://issues.apache.org/jira/browse/CB-8390) android: Make `<framework custom=false>` work with Gradle
* [CB-8416](https://issues.apache.org/jira/browse/CB-8416) updated plugman publish to temporarily rename existing package.json files
* [CB-8416](https://issues.apache.org/jira/browse/CB-8416): added `plugman createpackagejson .` command to create a package.json from plugin.xml
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) add spec-plugman to npm run jshint
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) fix spec-plugman jshint failures
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) have base rules in jshintrc for spec-plugman
* [CB-8377](https://issues.apache.org/jira/browse/CB-8377) Fixed <runs> tag parsing (close #156)
* [CB-5696](https://issues.apache.org/jira/browse/CB-5696) find ios project directory using the xcode project file (close #151)
* [CB-8373](https://issues.apache.org/jira/browse/CB-8373) android: Add gradle references to project.properties rather than build.gradle
* [CB-8370](https://issues.apache.org/jira/browse/CB-8370) Make "plugman publish" without args default to CWD
* Fix publish type-error introduced in recent commit 15adc1b9fcc069438f5
* [CB-8366](https://issues.apache.org/jira/browse/CB-8366) android: Remove empty `<framework>` directory upon uninstall
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) Enable JSHint for spec-cordova
* [CB-8239](https://issues.apache.org/jira/browse/CB-8239) Add support for git urls to 'cordova platform add' (close #148)
* [CB-8358](https://issues.apache.org/jira/browse/CB-8358) Add `--link` for `platform add` and `platform update`
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) remove base rules from individual files in src
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973) have base rules in .jshintrc file
* Add shims to undo breaking change in a20b3ae3 (didn't realize PluginInfo was exported)
* [CB-8354](https://issues.apache.org/jira/browse/CB-8354) Add --link support for iOS source and header files
* Make all ad-hoc plugin.xml parsing use PluginInfo instead
* Make all usages of PluginInfo use PluginInfoProvider instead
* Add PluginInfoProvider for better caching of PluginInfo
* [CB-8284](https://issues.apache.org/jira/browse/CB-8284) revert npm dependency due to issues with registry
* [CB-8223](https://issues.apache.org/jira/browse/CB-8223) Expose config.xml in the Browser platform (close #149)
* [CB-8168](https://issues.apache.org/jira/browse/CB-8168) --list support for cordova-lib (close #145)
* [Amazon] Improve error message when `<source-file>` is missing `target-dir`
* refactor: Make addUninstalledPluginToPrepareQueue take pluginId rather than dirName
* Chnage plugman test plugins to have IDs as directory names
* Make all test plugin IDs unique
* Empty out contents of plugin test files (and delete some unused ones)
* [CB-4789](https://issues.apache.org/jira/browse/CB-4789) refactor: Remove config_changes.get/set_platform_json in favour of PlatformJson
* [CB-8319](https://issues.apache.org/jira/browse/CB-8319) Remove config_changes module from plugman's public API
* [CB-8314](https://issues.apache.org/jira/browse/CB-8314) Speed up Travis CI (close #150)
* refactor: Extract PlatformJson and munge-util into separate modules
* refactor: Move ConfigFile and ConfigKeeper into their own files
* [CB-8285](https://issues.apache.org/jira/browse/CB-8285) Fix regression caused by c49eaa86c92b (PluginInfo's are cached, don't change them)
* [CB-8208](https://issues.apache.org/jira/browse/CB-8208) Made CI systems to get cordova-js dependency from gihub (close #146)
* [CB-8285](https://issues.apache.org/jira/browse/CB-8285) Don't create .fetch.json files within plugin directories
* [CB-8286](https://issues.apache.org/jira/browse/CB-8286) Never persist value of create --link-to within .cordova/config.json
* [CB-8288](https://issues.apache.org/jira/browse/CB-8288) Don't set config.setAutoPersist() in cordova.create
* Fix create spec sometimes failing because it's deleted its own tmp directory
* [CB-8153](https://issues.apache.org/jira/browse/CB-8153) generate cordova_plugins.json for browserify based projects
* [CB-8043](https://issues.apache.org/jira/browse/CB-8043) [CB-6462](https://issues.apache.org/jira/browse/CB-6462) [CB-6105](https://issues.apache.org/jira/browse/CB-6105) Refactor orientation preference support (close #128)
* FirefoxOS parser: allow passing in a ConfigParser object
* Parsers: extend base parser with helper functions
* [CB-8244](https://issues.apache.org/jira/browse/CB-8244) android: Have `plugin add --link` create symlinks for `<source-file>`, `<framework>`, etc
* [CB-8244](https://issues.apache.org/jira/browse/CB-8244) Pass options object to platform handlers in plugman (commit attempt #2)
* [CB-8226](https://issues.apache.org/jira/browse/CB-8226) 'cordova platform add' : Look up version in config.xml if no version specified
* Delete root .npmignore, since there's no node module there

### 4.2.0 (Jan 06, 2015)
* `ConfigParser`: refactor `getPreference()`
* Parsers: add base parser (parser.js) and make platform parsers inherit from it
* Parsers: assign methods without overriding the prototype
* [CB-8225](https://issues.apache.org/jira/browse/CB-8225) Add Unit Tests for `platform.js/add` function (closes #138)
* [CB-8230](https://issues.apache.org/jira/browse/CB-8230) Make `project.properties` optional for Android sub-libraries
* [CB-8215](https://issues.apache.org/jira/browse/CB-8215) Improve error message when `<source-file>` is missing `target-dir` on android
* [CB-8217](https://issues.apache.org/jira/browse/CB-8217) Fix plugin add --link when plugin given as relative path
* [CB-8216](https://issues.apache.org/jira/browse/CB-8216) Resolve plugin paths relative to original CWD
* [CB-7311](https://issues.apache.org/jira/browse/CB-7311) Fix tests on windows for iOS parser
* [CB-7803](https://issues.apache.org/jira/browse/CB-7803) Allow adding any platform on any host OS (close #126)
* [CB-8155](https://issues.apache.org/jira/browse/CB-8155) Do not fail plugin installation from git url with --link (close #129)
* Updates README with description of npm commands for this package
* [CB-8129](https://issues.apache.org/jira/browse/CB-8129) Adds 'npm run cover' command to generate tests coverage report (close #131)
* [CB-8114](https://issues.apache.org/jira/browse/CB-8114) Specify a cache-min-time for plugins (closes #133)
* [CB-8190](https://issues.apache.org/jira/browse/CB-8190) Make plugman config/cache directory to be customizable via PLUGMAN_HOME (close #134)
* [CB-7863](https://issues.apache.org/jira/browse/CB-7863) Fixed broken test run on Windows 8.1 caused by incorrect use of promises (close #132, close #112)
* [CB-7610](https://issues.apache.org/jira/browse/CB-7610) Fix `cordova plugin add d:\path` (or any other non-c: path) (close #135)
* [CB-8179](https://issues.apache.org/jira/browse/CB-8179) Corrected latest wp8 version
* [CB-8158](https://issues.apache.org/jira/browse/CB-8158) added hasModule check to browserify code
* [CB-8173](https://issues.apache.org/jira/browse/CB-8173) Point to the latest ubuntu version
* [CB-8179](https://issues.apache.org/jira/browse/CB-8179) Point to the latest wp8 version
* [CB-8158](https://issues.apache.org/jira/browse/CB-8158) adding symbolList to cordova.js
* [CB-8154](https://issues.apache.org/jira/browse/CB-8154) Fix errors adding platforms or plugins
* browserify: updated require to use symbollist
* Amazon related changes. Added a type named "gradleReference" in framework according to https://git-wip-us.apache.org/repos/asf?p=cordova-lib.git;a=commit;h=02a96d757acc604610eb403cf11f79513ead4ac5
* [CB-7736](https://issues.apache.org/jira/browse/CB-7736) Update npm dep to promote qs module to 1.0
* Added a missing "else" keyword.
* [CB-8086](https://issues.apache.org/jira/browse/CB-8086) Fixed framework tests.
* [CB-8086](https://issues.apache.org/jira/browse/CB-8086) Added an explanatory comment.
* [CB-8086](https://issues.apache.org/jira/browse/CB-8086) Prefixed subprojects with package name.
* [CB-8067](https://issues.apache.org/jira/browse/CB-8067) externalized valid-identifier it is it's own module
* Added identifier checking for app id, searches for java+C# reserved words
* [CB-6472](https://issues.apache.org/jira/browse/CB-6472) Adding content to -Info.plist - Unexpected behaviour
* [CB-8053](https://issues.apache.org/jira/browse/CB-8053): Including a project reference in a plugin fails on Windows platform.
* Pass the searchpath when installing plugins
* Add a type named "gradleReference" in framework

### 4.1.2 (Nov 13, 2014)
* [CB-7079](https://issues.apache.org/jira/browse/CB-7079) Allow special characters and digits in id when publishing to plugins registry
* [CB-7988](https://issues.apache.org/jira/browse/CB-7988): Update platform versions for iOS, wp8 & Windows to 3.7.0
* [CB-7846](https://issues.apache.org/jira/browse/CB-7846) Fix plugin deletion when dependency plugin does not exist
* [CB-6992](https://issues.apache.org/jira/browse/CB-6992) Fix build issue on iOS when app name contains accented characters
* [CB-7890](https://issues.apache.org/jira/browse/CB-7890) validate file copy operations in plugman
* [CB-7884](https://issues.apache.org/jira/browse/CB-7884) moved platform metadata to platformsConfig.json
* Amazon Specific changes: Added support for SdkVersion
* Expose PluginInfo from cordova-lib
* [CB-7839](https://issues.apache.org/jira/browse/CB-7839) android: Fix versionCode logic when version is less than 3 digits
* [CB-7033](https://issues.apache.org/jira/browse/CB-7033) Improve cordova platform check
* [CB-7311](https://issues.apache.org/jira/browse/CB-7311) Fix xcode project manipulation on Windows host
* [CB-7820](https://issues.apache.org/jira/browse/CB-7820) Make cordova platform restore not stop if a platforms fails to restore
* [CB-7649](https://issues.apache.org/jira/browse/CB-7649) Support iPhone 6 Plus Icon in CLI config.xml
* [CB-7647](https://issues.apache.org/jira/browse/CB-7647) Support new iPhone 6 and 6 Plus Images in the CLI config.xml
* [CB-7909](https://issues.apache.org/jira/browse/CB-7909) "plugman platform add" fixes
* Enable platform-specific id for android and ios
* Check for a CORDOVA_HOME environment variable to create a global config path

### 4.0.0 (Oct 10, 2014)
* Bumped version to 4.0.0 to be semVer complient and to match cli version
* Pinned dependencies in package.json
* updated platforms.js for 3.6.4
* [CB-5390](https://issues.apache.org/jira/browse/CB-5390) Uninstall - recursively remove dependencies of dependencies
* fixes HooksRunner test - should run before_plugin_uninstall
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) getPluginsHookScripts to work if plugin platform not defined
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Context opts should copy not reference
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Fixed tests - removed output
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Fixed HooksRunner and tests Avoided issue with parallel tests running Added checks for handling mocked config.xml and package.json in HooksRunner and scriptsFinder Addressed jshint issues Renamed ScriptsFinder to scriptsFinder
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Addressed community review notes: Removed commonModules from Context Renamed Hooker and subclasses to HooksRunner and scriptsFinder Moved scriptsRunner code into HooksRunner
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Replaced CordovaError throwings with Error per @kamrik review Extracted prepareOptions Hooker method
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Docs: deprecated .cordova/hooks + other minor updates
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Updated hooks documentation
* [CB-6481](https://issues.apache.org/jira/browse/CB-6481) Added unified hooks support for cordova app and plugins
* [CB-7572](https://issues.apache.org/jira/browse/CB-7572) Serve - respond with 304 when resource not modified
* computeCommitId for browserify workflow fixed to handle cli and non cli workflows:q
* [CB-7219](https://issues.apache.org/jira/browse/CB-7219) prepare-browserify now supports commitId and platformVersion for cordovajs
* [CB-7219](https://issues.apache.org/jira/browse/CB-7219): initial work for cordova.js platformVersion
* [CB-7219](https://issues.apache.org/jira/browse/CB-7219) prepare-browserify now supports commitId and platformVersion for cordovajs
* [CB-7219](https://issues.apache.org/jira/browse/CB-7219): initial work for cordova.js platformVersion
* [CB-7383](https://issues.apache.org/jira/browse/CB-7383) Updated version and RELEASENOTES.md for release 0.21.13
* Fix [CB-7615](https://issues.apache.org/jira/browse/CB-7615) Read config.xml after pre-prepare hooks fire
* [CB-7578](https://issues.apache.org/jira/browse/CB-7578) Windows. Fix platform name reported by pre_package hook
* [CB-7576](https://issues.apache.org/jira/browse/CB-7576) Support 'windows' merges folder for Windows platform
* Revert "Merge branch 'browserPlatform' of https://github.com/surajpindoria/cordova-lib"
* Added tests for browser platform

### 0.21.13
* remove shrinkwrap

### 0.21.12
* [CB-7383](https://issues.apache.org/jira/browse/CB-7383): depend on a newer version of cordova-js, bump self version

### 0.21.11
* bump version numbers of platforms to 3.6.3

### 0.21.10 (Sep 05, 2014)
* [CB-7457](https://issues.apache.org/jira/browse/CB-7457) - cordova plugin add --searchpath does not recurse through subfolders when a plugin.xml is malformed in one of them
* [CB-7457](https://issues.apache.org/jira/browse/CB-7457) - Add malformed plugin for tests
* [Windows8] Fix failing test to match updated functionality
* [CB-7420](https://issues.apache.org/jira/browse/CB-7420) Windows. Plugin <resource-file>s are removed from platform during prepare
* Windows helper. Removes unnecessary $(MSBuildThisFileDirectory)
* updated Releasenotes.md
* updated version to 0.21.10-dev
* [CB-7457](https://issues.apache.org/jira/browse/CB-7457) - cordova plugin add --searchpath does not recurse through subfolders when a plugin.xml is malformed in one of them
* [CB-7457](https://issues.apache.org/jira/browse/CB-7457) - Add malformed plugin for tests
* [Windows8] Fix failing test to match updated functionality
* updated Releasenotes.md
* updated version to 0.21.10-dev
* updated version, updated ffos to use 3.6.1, updated cordova-js dependency to be strcit
* [CB-7383](https://issues.apache.org/jira/browse/CB-7383) Incremented package version to -dev
* updated platforms.js to use 3.6.0
*  Updated version and RELEASENOTES.md for release 0.21.8
* [CB-5535](https://issues.apache.org/jira/browse/CB-5535): Remove "--arc" from ios platform creation args
* Windows helper. Removes unnecessary $(MSBuildThisFileDirectory)
* [CB-7420](https://issues.apache.org/jira/browse/CB-7420) Windows. Plugin <resource-file>s are removed from platform during prepare
* [CB-7416](https://issues.apache.org/jira/browse/CB-7416) Fixes file path reference when adding new source file
* [CB-7416](https://issues.apache.org/jira/browse/CB-7416) handleInstall tests for null platformTag. removed uncalled 'hasPlatformSection' from PluginInfo.js
* Remove use of path.join for manifest.launch_path
* [CB-7347](https://issues.apache.org/jira/browse/CB-7347) Improve cordova platform add /path/to handling
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) (fix jshint warnings)
* [CB-7114](https://issues.apache.org/jira/browse/CB-7114) Android: add support of min/max/target SDK to config.xml
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) Use updated version of node-xcode
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) iOS: add target-device and MinimumOSVersion support to config.xml
* ubuntu: support incremental builds
* ubuntu: support target-dir for resource-file
* ubuntu: use common.copyFile
* ubuntu: check icon existence
* ffos: Make author url optional
* [CB-7142](https://issues.apache.org/jira/browse/CB-7142) Add <variable> to <feature> for "plugin restore" command
* Set git clone depth to 10 for Travis to make it faster
* windows: update as per changed manifest file names
* Don't spy and expect it to call the other spy ...
* Well that looks like an error
* Fixing failing tests: update_proj should be update_project
* Fix failing tests. update_jsproj and update_csproj are now just update_proj
* Fix jshint errors in amazon_fireos_parser : mixed single/double quotes
* [CB-6699](https://issues.apache.org/jira/browse/CB-6699) Include files from www folder via single element (use ** glob pattern)
* Taking care of dashes in amazon-fireos platform name.
* Upleveled amazon-fireos changes.
* Fix link/copy parent check for windows
* Style fixes - comments
* Fix error in comments for munge functions
* Add link to BuildBot at ci.cordova.io in README
* [CB-7255](https://issues.apache.org/jira/browse/CB-7255) Fixed writing plist unescaped
* Allow plugin modules to be .json files
* Style fixes - white space only
* Add JSCS config file
* [CB-7260](https://issues.apache.org/jira/browse/CB-7260) Get cordova-android 3.5.1 instead of 3.5.0
* [CB-7228](https://issues.apache.org/jira/browse/CB-7228): Fixed issue with "cordova prepare --browserify"
* [CB-7234](https://issues.apache.org/jira/browse/CB-7234) added better outputs for plugin registry workflows
* [CB-7100](https://issues.apache.org/jira/browse/CB-7100): Use npm based lazy-load by default
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Remove check_requirements() funcs from platform parsers
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Remove check_requirements() funcs from platform parsers
* [CB-7140](https://issues.apache.org/jira/browse/CB-7140) Check plugin versions in local search path
* [CB-7001](https://issues.apache.org/jira/browse/CB-7001): Create a --browserify option for run action
* [CB-7228](https://issues.apache.org/jira/browse/CB-7228): Cordova prepare --browserify runs on all installed plugins
* [CB-7190](https://issues.apache.org/jira/browse/CB-7190): Add browserify support in cordova-lib/cordova-cli
* Remove references to "firefoxos"
* Browser platform is now being created from cli
* Created new files for browser

### 0.21.8 (Aug 29, 2014)
* [CB-5535](https://issues.apache.org/jira/browse/CB-5535): Remove "--arc" from ios platform creation args
* [CB-7416](https://issues.apache.org/jira/browse/CB-7416) Fixes file path reference when adding new source file
* [CB-7416](https://issues.apache.org/jira/browse/CB-7416) handleInstall tests for null platformTag. removed uncalled 'hasPlatformSection' from PluginInfo.js
* Remove use of path.join for manifest.launch_path
* [CB-7347](https://issues.apache.org/jira/browse/CB-7347) Improve cordova platform add /path/to handling
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) (fix jshint warnings)
* [CB-7114](https://issues.apache.org/jira/browse/CB-7114) Android: add support of min/max/target SDK to config.xml
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) Use updated version of node-xcode
* [CB-7118](https://issues.apache.org/jira/browse/CB-7118) iOS: add target-device and MinimumOSVersion support to config.xml
* ubuntu: support incremental builds
* ubuntu: support target-dir for resource-file
* ubuntu: use common.copyFile
* ubuntu: check icon existence
* ffos: Make author url optional
* [CB-7142](https://issues.apache.org/jira/browse/CB-7142) Add <variable> to <feature> for "plugin restore" command
* Set git clone depth to 10 for Travis to make it faster
* windows: update as per changed manifest file names
* Don't spy and expect it to call the other spy ...
* Well that looks like an error
* Fixing failing tests: update_proj should be update_project
* Fix failing tests. update_jsproj and update_csproj are now just update_proj
* Fix jshint errors in amazon_fireos_parser : mixed single/double quotes
* [CB-6699](https://issues.apache.org/jira/browse/CB-6699) Include files from www folder via single element (use ** glob pattern)
* Allow plugin modules to be .json files
* Taking care of dashes in amazon-fireos platform name.
* Upleveled amazon-fireos changes.
* Fix link/copy parent check for windows
* Style fixes - comments
* Fix error in comments for munge functions
* Add link to BuildBot at ci.cordova.io in README
* [CB-7255](https://issues.apache.org/jira/browse/CB-7255) Fixed writing plist unescaped
* Style fixes - white space only
* Add JSCS config file
* [CB-7228](https://issues.apache.org/jira/browse/CB-7228): Fixed issue with "cordova prepare --browserify"
* [CB-7001](https://issues.apache.org/jira/browse/CB-7001): Create a --browserify option for run action
* [CB-7228](https://issues.apache.org/jira/browse/CB-7228): Cordova prepare --browserify runs on all installed plugins
* [CB-7190](https://issues.apache.org/jira/browse/CB-7190): Add browserify support in cordova-lib/cordova-cli
* [CB-7260](https://issues.apache.org/jira/browse/CB-7260) Get cordova-android 3.5.1 instead of 3.5.0
* [CB-7001](https://issues.apache.org/jira/browse/CB-7001): Create a --browserify option for run action
* [CB-7228](https://issues.apache.org/jira/browse/CB-7228): Cordova prepare --browserify runs on all installed plugins
* [CB-7190](https://issues.apache.org/jira/browse/CB-7190): Add browserify support in cordova-lib/cordova-cli
* [CB-7234](https://issues.apache.org/jira/browse/CB-7234) added better outputs for plugin registry workflows
* [CB-7100](https://issues.apache.org/jira/browse/CB-7100): Use npm based lazy-load by default
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Remove check_requirements() funcs from platform parsers
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Remove check_requirements() funcs from platform parsers
* [CB-7140](https://issues.apache.org/jira/browse/CB-7140) Check plugin versions in local search path
* small refactor for missing code block after conditional statement
* [CB-7203](https://issues.apache.org/jira/browse/CB-7203) isRelativePath needs to pass path through
* [CB-7199](https://issues.apache.org/jira/browse/CB-7199) control git/npm using platform.js
* [CB-7199](https://issues.apache.org/jira/browse/CB-7199) control git/npm using platform.js
* Fix style errors - make jshint happy
* [CB-6756](https://issues.apache.org/jira/browse/CB-6756) Adds save and restore command for platforms.
* Add VERSION files to fix failing tests (forgot to git add in b7781cb)
* [CB-7132](https://issues.apache.org/jira/browse/CB-7132) Fix regression regarding default resources
* [CB-7187](https://issues.apache.org/jira/browse/CB-7187) Make CoreLocation a required library only for cordova-ios < 3.6.0
* Add AppVeyor badge to README
* Add Travis and npm badges to README.md
* fix(tests): cordova/lazy_load spec on Windows
* Fix plugman/install spec
* build configuration for AppVeyor
* build configurations for Travis
* [CB-7124](https://issues.apache.org/jira/browse/CB-7124) Wrap the cordova platform string in Platform object
* [CB-7140](https://issues.apache.org/jira/browse/CB-7140): Switch to using PluginInfo in plugman/fetch.js
* Minor style fixes in fetch.js
* [CB-7078](https://issues.apache.org/jira/browse/CB-7078): Disable serve.spec.js
* [CB-6512](https://issues.apache.org/jira/browse/CB-6512): platform add <path> was using wrong www/cordova.js
* [CB-7083](https://issues.apache.org/jira/browse/CB-7083) Missing SDKReference support on Windows Phone
* [CB-6874](https://issues.apache.org/jira/browse/CB-6874) Consolidate <Content> tag additions into 1 ItemGroup
* [CB-7100](https://issues.apache.org/jira/browse/CB-7100): Use npm based lazy-load by default
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Remove check_requirements() funcs from platform parsers
* [CB-7091](https://issues.apache.org/jira/browse/CB-7091): Don't call check_requirements during platform add
* Fix typo in comment.
* [CB-7087](https://issues.apache.org/jira/browse/CB-7087) Retire blackberry10/ directory
* [CB-6776](https://issues.apache.org/jira/browse/CB-6776): Fix uri/url renaming bug
* Remove npm-shrinkwrap.json


### 0.21.4 (Jun 23, 2014)
* [CB-3571](https://issues.apache.org/jira/browse/CB-3571), [CB-2606](https://issues.apache.org/jira/browse/CB-2606): support for splashscreens
* [CB-6976](https://issues.apache.org/jira/browse/CB-6976) Add support for Windows Universal apps (Windows 8.1 and WP 8.1)
* Use Plugininfo module to determine plugin id and version
* Fix plugin check error, when plugin dependency with specific version is given
* [CB-6709](https://issues.apache.org/jira/browse/CB-6709) Do not create merges/ folder when adding a platform
* [CB-6140](https://issues.apache.org/jira/browse/CB-6140) Don't allow deletion of platform dependencies
* [CB-6698](https://issues.apache.org/jira/browse/CB-6698): Fix 'android update lib-project' to work with paths containing spaces
* [CB-6973](https://issues.apache.org/jira/browse/CB-6973): Run JSHint on all code in src/ via npm test
* [CB-6542](https://issues.apache.org/jira/browse/CB-6542): Delay creating project until there's some chance that it will succeed
* folder_contents() now ignores .svn folders
* [CB-6970](https://issues.apache.org/jira/browse/CB-6970) Share win project files manipulation code between cordova and plugman
* [CB-6954](https://issues.apache.org/jira/browse/CB-6954): Share events.js between cordova and plugman
* [CB-6698](https://issues.apache.org/jira/browse/CB-6698) Automatically copy sub-libraries to project's directory
* Revert "CB-6698 Resolve android <framework> relative to plugin_dir when custom=true"
* [CB-6942](https://issues.apache.org/jira/browse/CB-6942) Describe running hooks only in verbose mode.
* [CB-6512](https://issues.apache.org/jira/browse/CB-6512): Allow "cordova platform add /path/to/platform/files"
* Update hooks-README.md - shebang line in hooks on Windows.
* [CB-6895](https://issues.apache.org/jira/browse/CB-6895) Add more config properties into manifest
* Allow "cordova platform add platform@version"
* Add util func for chaining promises
* removing doWrap from prepare
* adding configurable attribute
* cleaning up plugman.js for uninstall
* adding param to uninstall
* adding support for prepare flag
* adding prepare-browserify
* adding options to prepare
* adding and freezing cordova-js
* [CB-6879](https://issues.apache.org/jira/browse/CB-6879) config parser breakout into a cordova level module
* [CB-6698](https://issues.apache.org/jira/browse/CB-6698) Resolve android <framework> relative to plugin_dir when custom=true
* Fix tests on node 0.11.x
* Fix android <framework> unit tests to not expect end of line.
* [CB-6024](https://issues.apache.org/jira/browse/CB-6024): Accept cli vars as part of opts param
* Refer properties-parser package from NPM.
* [CB-6859](https://issues.apache.org/jira/browse/CB-6859) Removed all wp7 references, tests still passing
* Extract AndroidProject class into a separate .js file
* [CB-6698](https://issues.apache.org/jira/browse/CB-6698): Support library references for Android via the framework tag
* [CB-6854](https://issues.apache.org/jira/browse/CB-6854) Strip BOM when adding cordova.define() to js-modules
* Add npm cache based downloading to lazy_load
* Use PluginInfo in plugman/install.js
* Extend PluginInfo to parse more of plugin.xml
* [CB-6772](https://issues.apache.org/jira/browse/CB-6772) Provide a default for AndroidLaunchMode
* [CB-6711](https://issues.apache.org/jira/browse/CB-6711): Use parseProjectFile when working with XCode projects.
* Start using PluginInfo object in plugman/install.js
* [CB-6709](https://issues.apache.org/jira/browse/CB-6709) Remove merges/ folder for default apps
* support for shrinkwrap flag
* Initial implementation for restore and save plugin
* [CB-6668](https://issues.apache.org/jira/browse/CB-6668): Use <description> for "plugin ls" when <name> is missing.
* Add --noregstry flag for disabling plugin lookup in the registry
* Remove --force from default npm settings for plugin registry
* Use "npm info" for fetching plugin metadata
* Use "npm cache add" for downloading plugins
* [CB-6691](https://issues.apache.org/jira/browse/CB-6691): Change some instances of Error() to CordovaError()


### 0.21.1
Initial release v0.21.1 (picks up from the same version number as plugman was).
