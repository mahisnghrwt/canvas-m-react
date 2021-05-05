import React, { useEffect, useRef, useReducer } from 'react';
import { Utility, PathSnapPoint } from './util.js';
import { Graph } from './graph.js';

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

const CanvasM = props => {
	const canvasDimensions = {height: 720, width: 1280};
	const grid = { x: 31, y: 20 };
	const nodeDimensions = { x: canvasDimensions.width / grid.x, y: canvasDimensions.height / grid.y };
	const isDraggingNode = useRef(false);
	const dragNode = useRef(-1);
	const isDrawingPath = useRef(false);
	const idCounter = useRef(0);
	const pathId = useRef(-1);

	const [svgContent, dispatch] = useReducer(reducer, {
		nodes: {},
		paths: {}
	})

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
				isDraggingNode.current = false;
				dragNode.current = -1;
				return;
			}

			// create a new node
			const pos = getGridBasedPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
			const node = createNewNode(pos);
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
				// convert d back to string
				// -- parse back to string and update the svgContent state

				dispatch({ type: 'updatePath', target: pathId.current, update: { d: parsePathDToStr(dObj) }})
			}
			else {
				// get the paths as JS object
				const path = createNewPath(e.target);
				pathId.current = path.id;
				// add path to the svgContent state
				dispatch({ type: 'addNewPath', path})
			}

			isDrawingPath.current = !isDrawingPath.current;
		}
	}

	// ### SOME USEFUL FUNCTIONS

	const createNewNode = (coordinates) => {
		const id = idCounter.current++;
	
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
		const id = idCounter.current++;
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
		var tempX = (coordinates.x / canvasDimensions.width) * grid.x;
		var tempY = (coordinates.y / canvasDimensions.height) * grid.y;
	
		tempX = parseInt(tempX);
		tempY = parseInt(tempY);
	
		return {
			x: (tempX * canvasDimensions.width) / grid.x,
			y: (tempY * canvasDimensions.height) / grid.y
		}
	};

	// PARSING FUNCTIONS
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

	return (
		<svg id="main-canvas" {...canvasDimensions} onMouseMove={mainCanvasMouseMoveH} onMouseDown={mainCanvasMouseDownH} onMouseUp={mainCanvasMouseUpH} onContextMenu={e => e.preventDefault()}>
			{ svgContent && Object.values(svgContent.nodes).map(x => <rect key={x.id} {...x} />) }
			{ svgContent && Object.values(svgContent.paths).map(x => <path key={x.id} {...x} />) }
		</svg>
	)
};

export default CanvasM;