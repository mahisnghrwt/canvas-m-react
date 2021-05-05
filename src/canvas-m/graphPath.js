class Path {
    constructor(id, origin, end) {
        this.id = id;
        this.origin = origin;
        this.end = end;
    }

    getAnotherEnd(localId) {
        if (localId == this.origin) return this.end;
        if (localId == this.end) return this.origin;
        return null;
    }
}

class GraphPath {
    // this pathDir object will have pathId as key, and Path object as value
    static pathDir = {}

    static addNewPath(pathId, nodeId) {
        // if the path is new or the origin is missing then assign the endpoint as origin
        if (this.pathDir[pathId] == null || this.pathDir[pathId] == undefined || this.pathDir[pathId].origin == null) {
            this.pathDir[pathId] = new Path(pathId, nodeId, null);
            return;
        }
        
        this.pathDir[pathId].end = nodeId;
    }

    static getPathInfo(pathId) {
        return this.pathDir[`${pathId}`];
    }
};

export { GraphPath, Path };