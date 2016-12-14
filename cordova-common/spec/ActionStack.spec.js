/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var path = require('path');
var action_stack = require('../src/ActionStack');
var android_one_project = path.join(__dirname, '..', 'projects', 'android_one');

describe('action-stack', function() {
    var stack;
    beforeEach(function() {
        stack = new action_stack();
    });
    describe('processing of actions', function() {
        it('should process actions one at a time until all are done', function() {
            var first_spy = jasmine.createSpy();
            var first_args = [1];
            var second_spy = jasmine.createSpy();
            var second_args = [2];
            var third_spy = jasmine.createSpy();
            var third_args = [3];
            stack.push(stack.createAction(first_spy, first_args, function(){}, []));
            stack.push(stack.createAction(second_spy, second_args, function(){}, []));
            stack.push(stack.createAction(third_spy, third_args, function(){}, []));
            stack.process('android', android_one_project);
            expect(first_spy).toHaveBeenCalledWith(first_args[0]);
            expect(second_spy).toHaveBeenCalledWith(second_args[0]);
            expect(third_spy).toHaveBeenCalledWith(third_args[0]);
        });
        it('should revert processed actions if an exception occurs', function() {
            spyOn(console, 'log');
            var first_spy = jasmine.createSpy();
            var first_args = [1];
            var first_reverter = jasmine.createSpy();
            var first_reverter_args = [true];
            var process_err = new Error('process_err');
            var second_spy = jasmine.createSpy().and.callFake(function() {
                throw process_err;
            });
            var second_args = [2];
            var third_spy = jasmine.createSpy();
            var third_args = [3];
            stack.push(stack.createAction(first_spy, first_args, first_reverter, first_reverter_args));
            stack.push(stack.createAction(second_spy, second_args, function(){}, []));
            stack.push(stack.createAction(third_spy, third_args, function(){}, []));
            // process should throw
            var error;
            runs(function() {
                stack.process('android', android_one_project).fail(function(err) { error = err; });
            });
            waitsFor(function(){ return error; }, 'process promise never resolved', 500);
            runs(function() {
                expect(error).toEqual(process_err);
                // first two actions should have been called, but not the third
                expect(first_spy).toHaveBeenCalledWith(first_args[0]);
                expect(second_spy).toHaveBeenCalledWith(second_args[0]);
                expect(third_spy).not.toHaveBeenCalledWith(third_args[0]);
                // first reverter should have been called after second action exploded
                expect(first_reverter).toHaveBeenCalledWith(first_reverter_args[0]);
            });
        });
    });
});
