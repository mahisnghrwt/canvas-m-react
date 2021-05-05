import { GraphPath } from './graphPath.js';
import { copy } from './util.js';

class Node {
    constructor(id, paths) {
        this.id = id;
        this.paths = paths;
        if (this.paths == null)
            this.paths = {};
    }
}

class Graph {
    static graph = {};
    static addNode(nodeId) {
        this.graph[nodeId] = new Node(nodeId, null);
    }

    static addPathToNode(nodeId, pathId) {
        // add new connection to current node
        if (this.graph[nodeId] == null || this.graph[nodeId] == undefined) {
            this.addNode(nodeId);
        }

        this.graph[nodeId].paths[pathId] = 1;
        GraphPath.addNewPath(pathId, nodeId);

        // register the path of current node using addNewPath function.

    }

    static getNodeInfo(nodeId) {
        return this.graph[nodeId];
    }
}

export { Graph };