import React, { useEffect, useRef, useReducer, useState } from 'react';
import { Utility, PathSnapPoint } from './util.js';
import { Node, Path } from './graph.js';

const reducer = (state, action) => {
	switch(action.type) {
		case 'addNewNode':
			return {
				paths: state.paths,
				nodes: {
					...state.nodes,
					[action.node.id]: action.node
				}
			}
		case 'updateNode':
			return {
				paths: state.paths,
				nodes: {
					...state.nodes,
					[action.target]: {
						...state.nodes[action.target],
						...action.update
					}
				}
			}
		case 'addNewPath':
			return {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.path.id]: action.path
				}
			}
		case 'updatePath':
			return {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.target]: {
						...state.paths[action.target],
						...action.update
					}
				}
			}
	}
}

const gridlinesReducer = (state, action) => {
	switch(action.type) {
		case 'addGridlines':
			return {
				...action.gridlines
			}
		default:
			throw new Error(`Unknown action type: ${action.type} for gridlineReducer!`);
	}
}

const CanvasM = props => {
	const IDCOUNTER = useRef(0);

	const nodeDimensions = { x: 40, y: 25};
	const grid = useRef({ x: 200, y: 1 });
	// calculate the dimensions of the canvas based on the number of rows and columns and the node dimensions
	const [canvasDimensions, setCanvasDimensions] = useState({height: nodeDimensions.y * grid.current.y, width: nodeDimensions.x * grid.current.x});

	const isDraggingNode = useRef(false);
	const dragNode = useRef(-1);
	const isDrawingPath = useRef(false);
	const pathId = useRef(-1);

	const gridLabels = useRef([]);
	const horizontalGridLabels = useRef([]);

	const [svgContent, dispatch] = useReducer(reducer, {
		nodes: {},
		paths: {}
	})

	const graph = useRef({
		nodes: {},
		paths: {}
	})

	const [gridlines, dispatchForGridlines] = useReducer(gridlinesReducer, {
		horizontal: [],
		vertical: []
	})

	useEffect(() => {
		// updateGridSize(1);
	}, [])


	const mainCanvasMouseMoveH = e => {
		if (isDraggingNode.current === true) {
			// document.style.cursor = "move";
			const pos = getGridBasedPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
			dispatch({type: 'updateNode', target: dragNode.current, update: {x: pos.x, y: pos.y}});
		}
		else if (isDrawingPath.current === true) {
			const d = svgContent.paths[pathId.current].d;
			const newD = calcPathD(d, { x: e.nativeEvent.offsetX - 5, y: e.nativeEvent.offsetY - 5} );
			dispatch({type: 'updatePath', target: pathId.current, update: {d: newD}})
		}
	}

	const mainCanvasMouseUpH = e => {
		if (e.button === 0) {
			// if in middle of drawing path, then dont trigger events for left mouse button
			if (isDrawingPath.current) return

			// in case was dragging a node
			if (isDraggingNode.current) {
				updateAllNodePaths(e.target);
				isDraggingNode.current = false;
				dragNode.current = -1;
				return;
			}

			// create a new node
			const pos = getGridBasedPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
			const node = createNewNode(pos);

			// add new node to the graph
			useGraph.addNode(node.id);

			dispatch({type: 'addNewNode', node});
		}
	}

	const mainCanvasMouseDownH = e => {
		// we are only listeneing for "node" events, atleast atm
		if (e.target.tagName !== 'rect')
			return;	

		// starting to drag the node
		if (e.button === 0) {
			// if drawing paht, then cant drag a node at the same time
			if (isDrawingPath.current) return

			dragNode.current = e.target.getAttribute("id");
			isDraggingNode.current = true;
			return;
		}

		// either beginning to draw path or end it
		if (e.button === 2) {
			e.preventDefault();
			if (isDrawingPath.current) {
				// means the path is ending over this node
				// snap to the desired position
				// -- get the path object from svgContent state
				console.log("path id", pathId.current);
				// -- get its d attribute
				const d = svgContent.paths[pathId.current].d;
				// parse string d to obj
				const dObj = parsePathD(d);
				// get the snapped endpoint
				var endPoint = calcPathSnapPoint(e.target, PathSnapPoint.LEFT)
				// -- this needs to be fixed
				// -- Graph.addPathToNode(e.target.getAttribute("id"), pathId);

				// -- console.log(Graph.graph);
				// -- update the endpoint of path, in the d object
				dObj.taill.x = endPoint.x;
				dObj.taill.y = endPoint.y;

				useGraph.addPathToNode(e.target.getAttribute("id"), pathId.current);

				// convert d back to string
				// -- parse back to string and update the svgContent state
				dispatch({ type: 'updatePath', target: pathId.current, update: { d: parsePathDToStr(dObj) }})
			}
			else {
				// get the paths as JS object
				const path = createNewPath(e.target);
				pathId.current = path.id;

				useGraph.addPathToNode(e.target.getAttribute("id"), path.id);
				// add path to the svgContent state
				dispatch({ type: 'addNewPath', path})
			}

			isDrawingPath.current = !isDrawingPath.current;
		}
	}

	// ### SOME USEFUL FUNCTIONS

	const createNewNode = (coordinates) => {
		const id = IDCOUNTER.current++;
	
		return {
			className: "rect",
			id: id,
			width: nodeDimensions.x,
			height: nodeDimensions.y,
			x: coordinates.x,
			y: coordinates.y
		}

		// Add new node to the graph
		// --Graph.addNode(id);
	};

	const createNewPath = (node) => {
		const coord = calcPathSnapPoint(node, PathSnapPoint.RIGHT);
		const id = IDCOUNTER.current++;
		var d = `M${coord.x} ${coord.y} C${coord.x} ${coord.y} ${coord.x} ${coord.y} ${coord.x} ${coord.y}`;
		return {
			d: d,
			id: id,
			key: id,
			fill: "transparent"
		}
			
		// register new path
		// -- fix this
		// Graph.addPathToNode(node.getAttribute("id"), id);
	}

	function calcPathD(d, endPos) {
		// get the starting point first
		const split = String(d).split(" ");
		const startPos = {
			x: parseInt(split[0].substr(1)),
			y: parseInt(split[1])
		}
	
		const c1 = {
			x: startPos.x + (nodeDimensions.x * 2),
			y: startPos.y
		}
	
		const c2 = {
			x: endPos.x - (nodeDimensions.x * 2),
			y: endPos.y
		}
	
		return `M${startPos.x} ${startPos.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${endPos.x} ${endPos.y}`;
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

	const getGridBasedPos = (coordinates) => {
		var tempX = (coordinates.x / canvasDimensions.width) * grid.current.x;
		var tempY = (coordinates.y / canvasDimensions.height) * grid.current.y;
	
		tempX = parseInt(tempX);
		tempY = parseInt(tempY);

		return {
			x: (tempX * canvasDimensions.width) / grid.current.x,
			y: (tempY * canvasDimensions.height) / grid.current.y
		}
	};

	// PARSING FUNCTIONS
	function parsePathD(d) {
		// parse d to string
		// split on space
		const tokenized = String(d).split(" ");
		// we get 8 elements inside the "tokenized" array
		// substring element at index 0 and 2
		const obj = {
			head: {
				x: parseInt(tokenized[0].substr(1)),
				y: parseInt(tokenized[1])
			},
			c1: {
				x: parseInt(tokenized[2].substr(1)),
				y: parseInt(tokenized[3])
			},
			c2: {
				x: parseInt(tokenized[4]),
				y: parseInt(tokenized[5])
			},
			taill: {
				x: parseInt(tokenized[6]),
				y: parseInt(tokenized[7])		
			}
		};
	
		return obj;
	}
	
	function parsePathDToStr(d) {
		return `M${d.head.x} ${d.head.y} C${d.c1.x} ${d.c1.y} ${d.c2.x} ${d.c2.y} ${d.taill.x} ${d.taill.y}`;
	}

	function updateAllNodePaths(node) {
		// get the id of target node
		const id = node.getAttribute("id");
		const nodeWidth = svgContent.nodes[id].width;
	
		// returns {id: nodeId, paths: { [pathId]: 1}}
		// -- we are already storing the information in the JSObj, soo, we dont necessarily need another class to store this information, :P kill this source of redundancy
		// -- instead store the information in the stateonly
		// -- that means, new paths obj need to be appended to the node object in the state
		// -- but create "reducer" like functions for help!
		const nodeInfo = useGraph.getNodeInfo(id);
		if (nodeInfo == null || nodeInfo == undefined) return;
	
		// where to latch the path on this node
		// -- can we rename this to something better??
		const leftSnapPoint = calcPathSnapPoint(node, PathSnapPoint.LEFT);
		const rightSnapPoint = calcPathSnapPoint(node, PathSnapPoint.RIGHT);
	
		// for every single path latched to this node
		for (const pathId of nodeInfo.paths) {
			// returns path obj, {id: number, origin: number, end: number}
			// -- maybeee, retain the "Path" class
			// -- store the "path" objects in the "state.paths", but this would cause bunch of unnecessary nested objects inside the "path" dom element
			const pathInfo = useGraph.getPathInfo(pathId);
	
			// get the path element from the dom
			// -- instead update the state
			// const path = document.getElementById(pathId);
	
			// parse the path.d string to obj
			const pathD = parsePathD(svgContent.paths[pathId].d);
			var updatedPath = null;
	
			// if the current node is the origin of path
			//    then we latch the path to the right side of the node
			// else
			//      latch to the left side of the node
			if (pathInfo.origin == id) {
				// -- appropriately rename this 'calcControlPoints' function
				updatedPath = calcControlPoints(rightSnapPoint, pathD.taill, nodeWidth);
			}
			else {
				updatedPath = calcControlPoints(pathD.head, leftSnapPoint, nodeWidth);
			}

			// update the "d" attribuite of the Path
			// -- update the "d" property of path in state
			dispatch({ type: "updatePath", target: pathId, update: { d: parsePathDToStr(updatedPath) }});
			// path.setAttribute("d", parsePathDToStr(updatedPath));
		}
	}

	function calcControlPoints(head, tail, nodeWidth) {
		const c1 = {
			x: head.x + (nodeWidth * 2),
			y: head.y
		}
		const c2 = {
			x: tail.x - (nodeWidth * 2),
			y: tail.y
		}
		return {
			head,
			c1,
			c2,
			taill: tail
		}
	}


	const useGraph = {
		addNode: id => {
			graph.current.nodes[id] = new Node(id, null);
		},
		addPathToNode: (nodeId, pathId) => {
			// add new connection to current node
			if (graph.current.nodes[nodeId] == null || graph.current.nodes[nodeId] == undefined) {
				useGraph.addNode(nodeId);
			}
			// let the node know of new path
			graph.current.nodes[nodeId].paths.add(pathId);
			useGraph.addNodeToPath(pathId, nodeId);
		},
		getNodeInfo: id => {
			return graph.current.nodes[id];
		},
		addNodeToPath: (pathId, nodeId) => {
			// if the path is new or the origin is missing then assign the endpoint as origin
			if (graph.current.paths[pathId] == null || graph.current.paths[pathId] == undefined) {
				graph.current.paths[pathId] = new Path(pathId, null, null);
			}

			if (graph.current.paths[pathId].addNode(nodeId) === false) {
				// do something
				console.log(graph.current.paths[pathId]);
				throw new Error("no free end for this path!");
			}
		},
		getPathInfo: id => {
			return graph.current.paths[id];
		}
	};

	const drawGridlines = () => {
		var gridlinesM = { horizontal: [], vertical: [] };

		for (var i = 1; i < grid.current.y; i++) {
			const y = parseInt(i * nodeDimensions.y);
			gridlinesM.horizontal.push({id: "gridline", x1: 0, y1: y, x2: (nodeDimensions.x * grid.current.x), y2: y});
		}
		for (var i = 1; i < grid.current.x; i++) {
			const x = parseInt(i * nodeDimensions.x);
			gridlinesM.vertical.push({id: "gridline", x1: x, y1: 0, x2: x, y2: (nodeDimensions.y * grid.current.y)});
		}

		gridLabels.current.splice(0, gridLabels.current.length);
		for (var i = 0; i < grid.current.y; i++) {
			const y = (i * nodeDimensions.y);
			const x = 0;
			gridLabels.current.push(<div className="row-label" style={{height: nodeDimensions.y, position: "relative", top: nodeDimensions.y / 2}}>{`Row ${i}`}</div>)
		}

		horizontalGridLabels.current.splice(0, horizontalGridLabels.current.length);
		for (var i = 0; i < grid.current.x; i++) {
			const x = (i * nodeDimensions.x);
			const y = 0;
			horizontalGridLabels.current.push(<div className="col-label" style={{height: nodeDimensions.y, width: nodeDimensions.x, position: "relative", left: nodeDimensions.x / 2, writingMode: "vertical-rl", textOrientation: "mixed"}}>{`Col ${i}`}</div>)
		}

		dispatchForGridlines({ type: 'addGridlines', gridlines: gridlinesM})
	}

	const updateGridSize = updateVal => {
		grid.current.y += updateVal;
		setCanvasDimensions(prev => {
			return {
				...prev,
				height: nodeDimensions.y * grid.current.y
			}
		})
		drawGridlines();
	}

	return (
		<>
		x: {canvasDimensions.width}, y: {canvasDimensions.height}
			<div>
				<button onClick={() => updateGridSize(1)}>+</button>
				<button onClick={() => updateGridSize(-1)}>-</button>
			</div>
			<div className="canvas-wrapper" style={{height: "480px"}}>	
				<div className="col-labels" style={{width: canvasDimensions.width}}>
					{ horizontalGridLabels.current.map(x => x) }
				</div>
				<div className="canvas-wrapper-item">
					<div className="row-labels" style={{height: canvasDimensions.height}}>
						{gridLabels.current.map(x => x)}
					</div>
					<svg id="main-canvas" style={{overflow: "visible"}} className="main-canvas" {...canvasDimensions} onMouseMove={mainCanvasMouseMoveH} onMouseDown={mainCanvasMouseDownH} onMouseUp={mainCanvasMouseUpH} onContextMenu={e => e.preventDefault()}>
						{ gridlines && gridlines.horizontal.map(x => <line {...x}></line>) }
						{ gridlines && gridlines.vertical.map(x => <line {...x}></line>) }
						{ svgContent && Object.values(svgContent.nodes).map(x => <rect key={x.id} {...x} />) }
						{ svgContent && Object.values(svgContent.paths).map(x => <path key={x.id} {...x} />) }
					</svg>
				</div>
			</div>
		</>
	)
};

export default CanvasM;