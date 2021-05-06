class Node {
    constructor(id, paths) {
        this.id = id;
        this.paths = paths;
        if (this.paths == null)
            this.paths = new Set();
    }
}

class Path {
    constructor(id, origin, end) {
        this.id = id;
        this.origin = origin;
        this.end = end;
    }
    
    addNode(node) {
        if (this.origin == null) {
            this.origin = node;
            return true;
        }
        else if (this.end == null) {
            this.end = node;
            return true;
        }

        return false;
    }
}

export { Node, Path };