import { Utility, PathSnapPoint } from "./util.js"
import { Graph } from './graph.js';
import { GraphPath } from "./graphPath.js";

var isDragging = false;
var dragTarget = -1;
var isDrawingCurve = false;
var pathId = -1;

var mainCanvas = document.getElementById("main-canvas");

const gridX = 31;
const gridY = 20;
const canvasX = document.getElementById("main-canvas").getAttribute("width");
const canvasY = document.getElementById("main-canvas").getAttribute("height");

const rectH = canvasY / gridY;
const rectW = canvasX / gridX;

mainCanvas.addEventListener("mousemove", e => {
    if (isDragging) {
        mainCanvas.style.cursor = "move";
        const snappedPos = calcSnappedPos(e.offsetX, e.offsetY);
        document.getElementById(dragTarget).setAttribute("x", snappedPos.x);
        document.getElementById(dragTarget).setAttribute("y", snappedPos.y);
    }
    else if (isDrawingCurve) {
        var path = document.getElementById(pathId);
        const d = path.getAttribute("d");
        const newD = calcPathD(d, { x: e.offsetX - 5, y: e.offsetY - 5} );
        path.setAttribute("d", newD);
    }
})

mainCanvas.addEventListener("mouseup", e => {
    if (e.button == 0) {
        mainCanvas.style.cursor = "initial";
        if (!isDragging) {
            addNewRect(e);
            return;
        }
        document.getElementById(dragTarget).style.opacity = "1";
        updateAllNodePaths(e.target);

        isDragging = false;
        dragTarget = -1;
    }
})

mainCanvas.addEventListener("mousedown", e => {
    if (!(e.target.tagName == "rect" || e.target.tagName == "path") || e.button != 2)
        return;
    e.preventDefault();
    isDrawingCurve = !isDrawingCurve;
    if (isDrawingCurve) {
        const path = createPath(e.target);
        mainCanvas.append(path);
        pathId = path.getAttribute("id");
    }
    else {
        // means the path is ending over this node
        // snap to the desired position
        var path = document.getElementById(pathId);
        const d = path.getAttribute("d");
        // parse string d to obj
        const dObj = parsePathD(d);
        // get the snapped endpoint
        var endPoint = calcPathSnapPoint(e.target, PathSnapPoint.LEFT)

        Graph.addPathToNode(e.target.getAttribute("id"), pathId);

        console.log(Graph.graph);

        dObj.taill.x = endPoint.x;
        dObj.taill.y = endPoint.y;
        // convert d back to string
        path.setAttribute("d", parsePathDToStr(dObj));
    }
})

mainCanvas.addEventListener("contextmenu", e => {
    e.preventDefault();
})

function addNewRect(e) {
    const pos = calcSnappedPos(e.offsetX, e.offsetY);
    const rect = createNode(pos.x, pos.y);
    mainCanvas.append(rect);
}

function createNode(x, y) {
    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const id = Utility.getId();

    rect.setAttribute("class", "rect");
    rect.setAttribute("id", id)
    rect.setAttribute("draggable", true);
    rect.setAttribute("width", rectW);
    rect.setAttribute("height", rectH);
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);

    // add the event listener to the element
    // is it necessary?
    rect.addEventListener("mousedown", e => {
        if (e.button != 0) return;
        isDragging = true;
        rect.style.opacity = "0.2";
        dragTarget = rect.getAttribute("id");
    })

    // Add new node to the graph
    Graph.addNode(id);

    return rect;
};

// path can only be extended from a node
function createPath(node) {
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    const coord = calcPathSnapPoint(node, PathSnapPoint.RIGHT);
    const id = Utility.getId();
    var d = `M${coord.x} ${coord.y} C${coord.x} ${coord.y} ${coord.x} ${coord.y} ${coord.x} ${coord.y}`;
    path.setAttribute("d", d);
    path.setAttribute("id", id);
    path.setAttribute("fill", "transparent");

    // register new path
    Graph.addPathToNode(node.getAttribute("id"), id);


    return path;
}

function calcSnappedPos(x, y) {
    const tempX = (x / canvasX) * gridX;
    const tempY = (y / canvasY) * gridY;

    x = parseInt(tempX);
    y = parseInt(tempY);

    return {
        x: (x * canvasX) / gridX,
        y: (y * canvasY) / gridY
    }
}

function calcPathD(d, endPos) {

    // get the starting point first
    const split = String(d).split(" ");
    const startPos = {
        x: parseInt(split[0].substr(1)),
        y: parseInt(split[1])
    }

    const c1 = {
        x: startPos.x + (rectW * 2),
        y: startPos.y
    }

    const c2 = {
        x: endPos.x - (rectW * 2),
        y: endPos.y
    }

    return `M${startPos.x} ${startPos.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${endPos.x} ${endPos.y}`;
}

function calcControlPoints(startPos, endPos) {
    const c1 = {
        x: startPos.x + (rectW * 2),
        y: startPos.y
    }

    const c2 = {
        x: endPos.x - (rectW * 2),
        y: endPos.y
    }

    return {
        head: startPos,
        c1: c1,
        c2: c2,
        taill: endPos
    }
}



function calcPathSnapPoint(node, pathSnapPoint) {
    var tail = {x: 0, y: 0};
    // get the x, y attribute of the node
    const nodeX =  parseInt(node.getAttribute("x"));
    const nodeY = parseInt(node.getAttribute("y"));
    // We will also get the height and width of the node, since the width can be changed at runtime.
    const nodeH = parseInt(node.getAttribute("height"));
    const nodeW = parseInt(node.getAttribute("width"));

    if (pathSnapPoint == PathSnapPoint.RIGHT) {
        tail.x += nodeW;
        tail.y += nodeH / 2;
    }
    else if (pathSnapPoint == PathSnapPoint.LEFT) {
        tail.y += nodeH / 2;
    }
    else if (pathSnapPoint == PathSnapPoint.TOP) {
        tail.x += nodeW / 2;
    }
    else if (pathSnapPoint == PathSnapPoint.BOTTOM) {
        tail.x += nodeW / 2;
        tail.y += nodeH;
    }

    tail.x += nodeX;
    tail.y += nodeY;
    return tail;
}

// ### PATH PARSING FUNCTIONS ###

function parsePathD(d) {
    const obj = {head: {}, c1: {}, c2: {}, taill: {}};

    // parse d to string
    // split on space
    const tokenized = String(d).split(" ");

    // we get 8 elements inside the "tokenized" array
    // substring element at index 0 and 2
    obj.head.x = parseInt(tokenized[0].substr(1));
    obj.head.y = parseInt(tokenized[1]);

    obj.c1.x = parseInt(tokenized[2].substr(1));
    obj.c1.y = parseInt(tokenized[3]);

    obj.c2.x = parseInt(tokenized[4]);
    obj.c2.y = parseInt(tokenized[5]);

    obj.taill.x = parseInt(tokenized[6]);
    obj.taill.y = parseInt(tokenized[7]);

    return obj;
}

function parsePathDToStr(d) {
    return `M${d.head.x} ${d.head.y} C${d.c1.x} ${d.c1.y} ${d.c2.x} ${d.c2.y} ${d.taill.x} ${d.taill.y}`;
}

function updateAllNodePaths(node) {
    const id = node.getAttribute("id");
    const nodeInfo = Graph.getNodeInfo(id);
    if (nodeInfo == null || nodeInfo == undefined) return;

    const leftSnapPoint = calcPathSnapPoint(node, PathSnapPoint.LEFT);
    const rightSnapPoint = calcPathSnapPoint(node, PathSnapPoint.RIGHT);

    for (const pathId in nodeInfo.paths) {
        const pathInfo = GraphPath.getPathInfo(pathId);
        const path = document.getElementById(pathId);

        const pathD = parsePathD(path.getAttribute("d"));
        var updatedPath = null;
        if (pathInfo.origin == id) {
            updatedPath = calcControlPoints(rightSnapPoint, pathD.taill);
        }
        else {
            updatedPath = calcControlPoints(pathD.head, leftSnapPoint);
        }

        path.setAttribute("d", parsePathDToStr(updatedPath));
    }
}