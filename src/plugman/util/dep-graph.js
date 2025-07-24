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

module.exports = class DepGraph {
    constructor () {
        this.graph = new Map();
    }

    add (id, dep) {
        if (!this.graph.has(id)) {
            this.graph.set(id, new Set());
        }
        this.graph.get(id).add(dep);

        if (!this.graph.has(dep)) {
            this.graph.set(dep, new Set());
        }
    }

    getChain (id) {
        const visited = new Set();
        const stack = new Set();
        const result = [];

        const traverse = (node, parent = null) => {
            if (stack.has(node)) {
                throw new Error(`Cyclic dependency from ${parent} to ${node}`);
            }

            if (!this.graph.has(node)) return;

            stack.add(node);
            for (const dep of this.graph.get(node)) {
                if (!visited.has(dep)) {
                    traverse(dep, node);
                    result.push(dep);
                    visited.add(dep);
                }
            }
            stack.delete(node);
        };

        traverse(id);
        return result;
    }
};
