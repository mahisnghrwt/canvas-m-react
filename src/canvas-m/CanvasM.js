import React, { useEffect, useRef, useReducer, useState } from 'react';
import { PathSnapPoint, baseNodeDimensions, HORIZONTAL_SCALE, parseObjectPropToInt } from './util.js';
import { Node, Path } from './graph.js';
import Helper from './helper.js'
import HorizontalScale from './HorizontalScale.js';
import { add, differenceInDays } from 'date-fns';

const reducer = (state, action) => {
	var newState = {};
	switch(action.type) {
		case 'addNewNode':
			newState = {
				paths: state.paths,
				nodes: {
					...state.nodes,
					[action.node.id]: action.node
				}
			}
			break;
		case 'updateNode':
			newState = {
				paths: state.paths,
				nodes: {
					...state.nodes,
					[action.target]: {
						...state.nodes[action.target],
						...action.update,
						props: {
							...state.nodes[action.target].props,
							...action.update.props
						}
					}
				}
			}
			break;
		case 'updateNodeProps':
			newState = {
				paths: state.paths,
				nodes: {
					...state.nodes,
					[action.target]: {
						...state.nodes[action.target],
						props: {
							...state.nodes[action.target].props,
							...action.update
						}
					}
				}
			}
			break;
		case 'addNewPath':
			newState = {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.path.id]: {
						...action.path
					}
				}
			}
			break;
		case 'updatePath':
			newState = {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.target]: {
						...state.paths[action.target],
						...action.update
					}
				}
			}
			break;
		case 'updatePathProps':
			newState = {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.target]: {
						...state.paths[action.target],
						props: {
							...state.paths[action.target].props,
							...action.update
						}
					}
				}
			}
			break;
		case 'replace':
			newState = action.replace
			break;
	}

	return newState;
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
	const startDate = useRef(new Date());
	const halfYear = 180;
	const [unit_, setUnit_] = useState("MONTH");
	const nodeDimensions = useRef({ x: 20 * HORIZONTAL_SCALE[unit_].relativeNodeWidth, y: 25});
	const grid = useRef({ x: halfYear, y: 1 });
	const [canvasDimensions, setCanvasDimensions] = useState({height: nodeDimensions.current.y * grid.current.y, width: nodeDimensions.current.x * grid.current.x});

	const gridLabels = useRef([]);

	const isDraggingNode = useRef(false);
	const dragNode = useRef(-1);
	const isDrawingPath = useRef(false);
	const pathId = useRef(-1);
	const nodeToExpand = useRef(-1);
	const intermediateStateRef = useRef(null);

	const rows = useRef({});

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

	const [info, setInfo] = useState(null);

	useEffect(() => {
		updateGridSize(1);
	}, [])

	// CANVAS EVENT FUNCTIONS


	const mainCanvasMouseUpH = e => {

		// if in middle of drawing path, then dont trigger events for left mouse button
		if (e.button === 0 && isDrawingPath.current === false) {

			// in case was dragging a node
			if (isDraggingNode.current) {
				endDragNode(e);
				return;
			}
			else if (nodeToExpand.current !== -1) {
				endNodeExpansion(e);
				return;
			}

			// create a new node
			const node = createNewNode({x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
			if (node == null) {
				setInfo(() => "A row can only contain a single node!");
				return;
			}
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
		if (e.button === 0 && isDrawingPath.current === false) {
			console.log("offset", getMouseOffset(e));
			if (overNodeExpansionPoints(elementNodeToBaseNode(e.target), getMouseOffset(e))) {
				startNodeExpansion(e);
			}
			else {
				startDragNode(e);
			}
			return;
		}

		// either beginning to draw path or end it
		if (e.button === 2) {
			e.preventDefault();
			if (isDrawingPath.current) {
				endPath(e);
			}
			else {
				startPath(e);
			}

			isDrawingPath.current = !isDrawingPath.current;
		}
	}

	const mainCanvasMouseMoveH = e => {
		if (isDraggingNode.current === true) {
			dragNode_(e);
		}
		else if (nodeToExpand.current !== -1) {
			expandNode(nodeToExpand.current, {x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY});
		}
		else if (isDrawingPath.current === true) {
			drawPath(e);
		}
	}

	// Intermediate state functions

	const initializeIntermediateState = () => {
		intermediateStateRef.current = JSON.parse(JSON.stringify(svgContent));
	}

	const dispatchIntermediateState = () => {
		const action = {type: 'replace', replace: intermediateStateRef.current};
		dispatch(action);
	}

	const intermediateStateReducer = action => {
		switch (action.type) {
			case 'updateNode':
			intermediateStateRef.current = {
				paths: intermediateStateRef.current.paths,
				nodes: {
					...intermediateStateRef.current.nodes,
					[action.target]: {
						...intermediateStateRef.current.nodes[action.target],
						...action.update,
						props: {
							...intermediateStateRef.current.nodes[action.target].props,
							...action.update.props
						}
					}
				}
			}
			break;
			case 'deleteNode':
				delete intermediateStateRef.current.nodes[action.target];
			break;
			case 'updatePathProps':
			intermediateStateRef.current = {
				nodes: intermediateStateRef.current.nodes,
				paths: {
					...intermediateStateRef.current.paths,
					[action.target]: {
						...intermediateStateRef.current.paths[action.target],
						props: {
							...intermediateStateRef.current.paths[action.target].props,
							...action.update
						}
					}
				}
			}
			break;
			case 'deletePath':
				delete intermediateStateRef.current.paths[action.target];
			break;
			default:
				throw new Error(`Action ${action.type} not supported!`);
		}
	}

	// PATH EVENT FUNCTIONS

	const startPath = mouseEvent => {
		cancelDragNode(dragNode.current, "Node drag cancelled, attempting to draw path!");
		// get the paths as JS object
		const extractNode = () => {
			const {props: {x, y, height, width}} = svgContent.nodes[mouseEvent.target.getAttribute("id")];
			return {x, y, height, width};
		}

		const node = extractNode();
		const path = createNewPath(node);
		pathId.current = path.id;

		useGraph.addPathToNode(mouseEvent.target.getAttribute("id"), path.id);
		// add path to the svgContent state
		dispatch({ type: 'addNewPath', path})
	}

	const drawPath = mouseEvent => {
		if (isDrawingPath.current === false)
			return;
		const d = svgContent.paths[pathId.current].props.d;

		const newD = Helper.path.compute(d, { x: mouseEvent.nativeEvent.offsetX - 5, y: mouseEvent.nativeEvent.offsetY - 5}, nodeDimensions.current );
		dispatch({type: 'updatePathProps', target: pathId.current, update: {  d: newD }})
	}

	const endPath = mouseEvent => {
		// means the path is ending over this node
		// snap to the desired position
		// -- get the path object from svgContent state
		console.log("path id", pathId.current);
		// -- get its d attribute
		const d = svgContent.paths[pathId.current].props.d;
		// parse string d to obj
		const dObj = Helper.path.parseToObject(d);

		const extractNode = () => {
			const {props: {x, y, height, width}} = svgContent.nodes[mouseEvent.target.getAttribute("id")];
			return {x, y, height, width};
		}
		const node = extractNode();


		// get the snapped endpoint
		var endPoint = Helper.path.determineNodeSnapPoint_(node, PathSnapPoint.LEFT)
		// -- this needs to be fixed
		// -- Graph.addPathToNode(e.target.getAttribute("id"), pathId);

		// -- console.log(Graph.graph);
		// -- update the endpoint of path, in the d object
		dObj.tail.x = endPoint.x;
		dObj.tail.y = endPoint.y;

		useGraph.addPathToNode(mouseEvent.target.getAttribute("id"), pathId.current);

		// convert d back to string
		// -- parse back to string and update the svgContent state
		dispatch({ type: 'updatePathProps', target: pathId.current, update: { d: Helper.path.parseToString(dObj) }})
	}

	const cancelDrawPath = message => {
		isDrawingPath.current = false;
		pathId.current = -1;
		setInfo(() => message);
	}

	// NODE DRAG EVENT FUNCTIONS

	const startDragNode = mouseEvent => {
		cancelDrawPath("Cannot draw path, attempting to drag node!");
		dragNode.current = mouseEvent.target.getAttribute("id");
		isDraggingNode.current = true;
	}

	const dragNode_ = mouseEvent => {
		if (isDraggingNode.current === false || dragNode.current === -1)
			return;

		const options = {
			isGridPos: false,
			updateY: false,
			updatePath: true
		}

		// will make the deep clone of the state(svgContent)
		initializeIntermediateState();
		
		if (moveNodeTo(dragNode.current, { x: mouseEvent.nativeEvent.offsetX, y: mouseEvent.nativeEvent.offsetY }, options) == null) {
			cancelDragNode(dragNode.current, "Trying to drag out of canvas!");
		}

		// finally update the state with updated node and path, in a single render!!
		dispatchIntermediateState();
	}

	const endDragNode = () => {
		if (isDraggingNode.current === false)
			return;

		cancelDragNode(dragNode.current, "Cancelling node drag event!");
	}

	const cancelDragNode = (id, message) => {
		if (id !== -1)
			useGraph.updateAllNodePaths(id);

		dragNode.current = -1;
		isDraggingNode.current = false;
		setInfo(() => message);
	}

	// NODE EXTEND EVENT FUNCTIONS

	const overNodeExpansionPoints = (node, mousePos) => {
		const q = parseInt(node.width) / 8;
		const l1 = parseInt(node.x);
		const r1 = parseInt(node.x) + q;
		const l2 = parseInt(node.x) + parseInt(node.width) - q;
		const r2 = parseInt(node.x) + parseInt(node.width);
		console.log(l1, mousePos.x, r1);
		if ((mousePos.x >= l1 && mousePos.x <= r1) || (mousePos.x >= l2 && mousePos.x <= r2)) {
			return true;
		}

		return false;
	}

	const startNodeExpansion = e => {
		cancelDragNode(dragNode.current, "Expanding node...");
		cancelDrawPath("Expanding node...");
		nodeToExpand.current = e.target.getAttribute("id");
	}

	const expandNode = (id, mousePos) => {
		const gridPos = canvasCoordToGrid(mousePos);
		
		// if the mouse position is outside canvas then canvasCoordToGrid can return null
		if (gridPos == null)
			return;
		const rightEndPos = gridCoordToCanvas(gridPos);
		const updatedNode = {
			...svgContent.nodes[id]
		};
		if (rightEndPos.x <= updatedNode.props.x)
			return;

		const nodeGridPos = canvasCoordToGrid({x: updatedNode.props.x, y: updatedNode.props.y});
		updatedNode.props.width = (gridPos.x - nodeGridPos.x) * nodeDimensions.current.x;
		dispatch({type: 'updateNode', target: id, update: updatedNode});
	}

	const endNodeExpansion = e => {
		useGraph.updateAllNodePaths(nodeToExpand.current);
		cancelNodeExpand("Cancelled node expand!");
	}

	const cancelNodeExpand = message => {
		setInfo(() => message);
		nodeToExpand.current = -1;
	}


	// ### SOME USEFUL FUNCTIONS

	const createNewNode = (coordinates) => {
		const gridCoord = canvasCoordToGrid(coordinates);
		if (rows.current[gridCoord.y] != undefined)
			return null;
		const id = IDCOUNTER.current++;
		rows.current[gridCoord.y] = id;
		const snappedCoord = gridCoordToCanvas(gridCoord);
		return {
			id: id,
			startDate: add(startDate.current, { days: gridCoord.x }),
			props: {
				className: "rect",
				id: id,
				width: nodeDimensions.current.x,
				height: nodeDimensions.current.y,
				x: snappedCoord.x,
				y: snappedCoord.y
			}
		};
	};

	const createNewPath = (node) => {
		const coord = Helper.path.determineNodeSnapPoint_(node, PathSnapPoint.RIGHT);
		const id = IDCOUNTER.current++;
		var d = `M${coord.x} ${coord.y} C${coord.x} ${coord.y} ${coord.x} ${coord.y} ${coord.x} ${coord.y}`;
		return {
			id,
			props: {
				d: d,
				id: id,
				key: id,
				fill: "transparent"
			}
		}
			
		// register new path
		// -- fix this
		// Graph.addPathToNode(node.getAttribute("id"), id);
	}

	const stateNodeToBaseNode_ = (id, fromIntermediate) => {
		if (fromIntermediate === true) {
			return {
				x: intermediateStateRef.current.nodes[id].props.x,
				y: intermediateStateRef.current.nodes[id].props.y,
				height: intermediateStateRef.current.nodes[id].props.height,
				width: intermediateStateRef.current.nodes[id].props.width,
			}
		}
		else {
			return {
				x: svgContent.nodes[id].props.x,
				y: svgContent.nodes[id].props.y,
				height: svgContent.nodes[id].props.height,
				width: svgContent.nodes[id].props.width,
			}
		}
	}

	// COORDINATE RELATED FUNCTIONS
	
	const canvasCoordToGrid = coordinates => {
		// coord represent the posittion on grid
		const coord = {
			x: 0,
			y: 0
		};

		coord.x = (coordinates.x / canvasDimensions.width) * grid.current.x;
		coord.y = (coordinates.y / canvasDimensions.height) * grid.current.y;

		coord.x = parseInt(coord.x);
		coord.y = parseInt(coord.y);

		if (coord.x >= grid.current.x || coord.y >= grid.current.y)
			return null;

		return coord;
	}

	const gridCoordToCanvas = coordinates => {
		return {
			x: coordinates.x * nodeDimensions.current.x,
			y: coordinates.y * nodeDimensions.current.y
		}
	}

	// Graph functions

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
		},
		updateAllNodePaths: id => {
			if (id === -1) return;

			const node = stateNodeToBaseNode_(id, true);
			console.log("node ", node);
		
			// returns {id: nodeId, paths: { [pathId]: 1}}
			// -- we are already storing the information in the JSObj, soo, we dont necessarily need another class to store this information, :P kill this source of redundancy
			// -- instead store the information in the stateonly
			// -- that means, new paths obj need to be appended to the node object in the state
			// -- but create "reducer" like functions for help!
			const nodeInfo = useGraph.getNodeInfo(id);
			if (nodeInfo == null || nodeInfo == undefined) return;

			console.log("paths", nodeInfo.paths);

			
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
				// const pathD = Helper.path.parseToObject(svgContent.paths[pathId].props.d);
				var updatedPath = null;
		
				// if the current node is the origin of path
				//    then we latch the path to the right side of the node
				// else
				//      latch to the left side of the node

				if (pathInfo.origin == id) {
					// -- appropriately rename this 'calcControlPoints' function
					// updatedPath = calcControlPoints(rightSnapPoint, pathD.tail, nodeWidth);
					// updatedPath = Helper.path.determineControlPoints({ head: rightSnapPoint, tail: pathD.tail }, nodeWidth);
					const otherNode = stateNodeToBaseNode_(pathInfo.end, true);
					updatedPath = Helper.path.determineControlPoints__(parseObjectPropToInt(node), parseObjectPropToInt(otherNode));
				}
				else {
					const otherNode = stateNodeToBaseNode_(pathInfo.origin, true);
					updatedPath = Helper.path.determineControlPoints__(parseObjectPropToInt(otherNode), parseObjectPropToInt(node));
					// updatedPath = Helper.path.determineControlPoints({ head: pathD.head, tail: leftSnapPoint }, nodeWidth);
				}

				// update the "d" attribuite of the Path
				// -- update the "d" property of path in state
				intermediateStateReducer({ type: "updatePathProps", target: pathId, update: { d: Helper.path.parseToString(updatedPath) }});
				// path.setAttribute("d", parsePathDToStr(updatedPath));
			}
		}
	};

	/**
	 * @param {number | string} nodeId - id of node to move
	 * @param {*} pos - Position {x, y} on grid to move node to.
	 * @param {*} options - Mandatory :>
	 * @param {boolean} options.isGridPos - Is the position grid based or canvas based
	 * @param {boolean} options.updateY - Should we updated y?
	 * @param {boolean} options.updatePath - update paths attached to this node?
	 */
	const moveNodeTo = (nodeId, pos, options) => {
		var gridPos = {};
		if (options.isGridPos === false)
			gridPos = canvasCoordToGrid(pos);
		else
			gridPos = {...pos};


		if (gridPos == null) {
			useGraph.updateAllNodePaths(nodeId);
			return null;
		}

		// Nothing to update if the target position is on the same block as current
		if (gridPos.x === svgContent.nodes[nodeId].props.x && gridPos.y === svgContent.nodes[nodeId].props.y)
			return;
		
		const updatedStartDate = add(startDate.current, { days: parseInt(gridPos.x) });
		const pos_ = gridCoordToCanvas(gridPos);
		const action = {
			type: 'updateNode',
			target: nodeId,
			update: {
				startDate: updatedStartDate,
				props: {
					x: pos_.x
				}
			}
		}

		if (options.updateY === true) {
			action.update.props.y = pos_.y;
		}

		intermediateStateReducer(action);

		// // push the node id to nodePathQ, it will udpate the path for use after node has been updated
		// nodePathQ.current.push(nodeId);

		if (options.updatePath)
			useGraph.updateAllNodePaths(nodeId);

		return true;
	}

	/**
	 * 
	 * @param {number} id Node to delete
	 * @param {Object} options 
	 * @param {boolean} options.handleIntermediateState If true, it will initialize and dispatch intermediate state
	 */
	const deleteNode = (id, options) => {
		if (options.handleIntermediateState)
			initializeIntermediateState();
		
		// delete all the paths node has connection to (graph, and state)
		for (const p of graph.current.nodes[id].paths) {
			deletePath(p);
		}

		// delete the node from the graph
		delete graph.current.nodes[id];

		// clear the current row
		verySlowclearNodeFromRow(id);

		// delete the node from the state
		const action = {type: 'deleteNode', target: id};
		intermediateStateReducer(action);

		if (options.handleIntermediateState)
			dispatchIntermediateState();
	}

	/**
	 * 
	 * @param {number} id - Path id to delete
	 * @description intermediate state must be initialized before and dispatched after to commit state changes
	 */
	const deletePath = id => {
		// delete from the graph
		const originNode = graph.current.paths[id].origin;
		const endNode = graph.current.paths[id].end;

		// delete the reference to path from the graph.nodes
		graph.current.nodes[originNode].paths.delete(id);
		graph.current.nodes[endNode].paths.delete(id);

		// delete the graph.paths itself
		delete graph.current.paths[id];

		// delete path from the state
		const action = {type: 'deletePath', target: id};
		intermediateStateReducer(action);
	}

	/**
	 * 
	 * @param {number} id Node to delete from "rows" ref
	 * @description Very poor implementation, please refactor it in the near future :)
	 */
	const verySlowclearNodeFromRow = id => {
		var i = -1;
		for (i = 0; i < grid.current.y; i++) {
			if (rows.current[i] == id)
				break;
		}

		if (rows.current[i] != undefined)
			delete rows.current[i];
	}

	const drawGridlines = (nodeDimensions, grid) => {
		var gridlinesM = { horizontal: [], vertical: [] };

		for (var i = 1; i < grid.y; i++) {
			const y = parseInt(i * nodeDimensions.y);
			gridlinesM.horizontal.push({id: "gridline", x1: 0, y1: y, x2: (nodeDimensions.x * grid.x), y2: y});
		}
		for (var i = 1; i < grid.x; i++) {
			const x = parseInt(i * nodeDimensions.x);
			gridlinesM.vertical.push({id: "gridline", x1: x, y1: 0, x2: x, y2: (nodeDimensions.y * grid.y)});
		}

		gridLabels.current.splice(0, gridLabels.current.length);
		for (var i = 0; i < grid.y; i++) {
			const y = (i * nodeDimensions.y);
			const x = 0;
			console.log("i", i);
			gridLabels.current.push(<div className="row-label" style={{height: nodeDimensions.y, position: "relative", top: nodeDimensions.y / 2}}>{`Row ${i}`}</div>)
		}

		dispatchForGridlines({ type: 'addGridlines', gridlines: gridlinesM})
	}

	const updateScale = unit => {

		const data = serailize();
		deserialize(data, unit);
	}

	const updateGridSize = updateVal => {
		grid.current.y += updateVal;
		setCanvasDimensions(prev => {
			return {
				...prev,
				height: nodeDimensions.current.y * grid.current.y
			}
		})
		drawGridlines(nodeDimensions.current, grid.current);
	}

	/**
	 * 
	 * @param {number} row Index of row to delete
	 * @description Handles intermediates state
	 */
	const deleteRow = row => {
		initializeIntermediateState();

		row = parseInt(row);
		if (row < 0)
			return;

		// delete the node in the current row if any
		if (rows.current[row] != undefined) {
			deleteNode(rows.current[row], {handleIntermediateState: false});
		}
		
		for(var i = row + 1; i < grid.current.y; i++) {
			// shift node from this row to the one above
			const nodeId = rows.current[i];

			if (nodeId === undefined)
				continue;

			// pathUpdateNodes.push(nodeId);

			// update the rows, for the node that lies onto it
			rows.current[i - 1] = nodeId;
			rows.current[i] = undefined;

			// const target pos
			const x = intermediateStateRef.current.nodes[nodeId].props.x;
			const y = intermediateStateRef.current.nodes[nodeId].props.y;

			// convert to grid based
			const gridBasedPos = canvasCoordToGrid({x, y});

			// decrement the row
			gridBasedPos.y -= 1;

			// update the gridlabel as well
			gridLabels.current[i - 1] = gridLabels.current[i];

			// move the node
			const r = moveNodeTo(nodeId, gridBasedPos, {isGridPos: true, updateY: true, updatePath: true});
		}

		// decrement the vertical grid size by 1
		updateGridSize(-1);

		dispatchIntermediateState();
	}

	// Serialize
	const serailize = () => {
		return ( 
			{
				svgContent,
				graph: graph.current,
				unit: unit_,
				grid: grid.current,
				IDCOUNTER: IDCOUNTER.current,
				startDate: startDate.current
			}
		)
	}

	// Target unit to deserialize to.
	const deserialize = (data, targetUnit) => {
		var localSVGContent = {nodes: {}, paths: {}};
		IDCOUNTER.current = data.IDCOUNTER;
		const currentUnit = unit_;
		setUnit_(() => targetUnit);
		// unit.current = targetUnit;
		grid.current = data.grid;

		// update the node dimension according to the unit
		nodeDimensions.current = calculateNodeDimensions(targetUnit);

		// update canvas size based on the nodeDimensions and gridSize
		// will cause rerender
		setCanvasDimensions(() => calculateCanvasDimensions(nodeDimensions.current, data.grid));

		// draw new gridlines
		// will cause rerender
		drawGridlines(nodeDimensions.current, data.grid);

		// simply add the graph
		graph.current = data.graph;

		// update the date after node being dragged
		// finally redraw the svgcontent
		Object.values(data.svgContent.nodes).map(node => {
			const updatedNode = updateSVGRectCoordinates(node, data.startDate);
			const updatedWidthNode = updateSVGRectWidth(node, currentUnit, targetUnit);
			updatedNode.props.width = updatedWidthNode.props.width;
			// console.log("updated", updatedNode)
			localSVGContent.nodes[updatedNode.id] = updatedNode;
		});

		// now we have to update the path based on the current unit
		// but refer to localSVGCOntent, because the global one is not updated yet.
		Object.values(data.graph.paths).map(path => {
			// path = {id, origin, end}
			const origin = {
				x: localSVGContent.nodes[path.origin].props.x,
				y: localSVGContent.nodes[path.origin].props.y,
				height: localSVGContent.nodes[path.origin].props.height,
				width: localSVGContent.nodes[path.origin].props.width,
			};
			const end = {
				x: localSVGContent.nodes[path.end].props.x,
				y: localSVGContent.nodes[path.end].props.y,
				height: localSVGContent.nodes[path.end].props.height,
				width: localSVGContent.nodes[path.end].props.width,
			};
			const d = Helper.path.compute_(origin, end);
			localSVGContent.paths[path.id] = {
				...data.svgContent.paths[path.id],
				props: {
					...data.svgContent.paths[path.id].props,
					d
				}
			};
		})

		// then finally update the svgContent reducer
		dispatch({ type: 'replace', replace: localSVGContent });
	}

	const elementNodeToBaseNode = nodeElement => {
		if (nodeElement.tagName !== 'rect')
			return null;

		return {
			x: nodeElement.getAttribute("x"),
			y: nodeElement.getAttribute("y"), 
			height: nodeElement.getAttribute("height"), 
			width: nodeElement.getAttribute("width")
		};
	}

	const updateSVGRectCoordinates = (node, startDate) => {
		const x = differenceInDays(node.startDate, startDate);
		const updated = { ...node, props: {...node.props}};
		// now we have the x in grid coordinates, but y is still in canvas coordinates
		const canvasCoord = gridCoordToCanvas({x: x, y: 0});
		updated.props.x = canvasCoord.x;
		updated.props.width = nodeDimensions.current.x;
		updated.props.height = nodeDimensions.current.y;

		return updated;
	}

	const updateSVGRectWidth = (node, currentUnit, targetUnit) => {
		const currentUnitNodeWidth = HORIZONTAL_SCALE[currentUnit].relativeNodeWidth * baseNodeDimensions.width;
		const targetUnitNodeWidth = HORIZONTAL_SCALE[targetUnit].relativeNodeWidth * baseNodeDimensions.width;

		// scale the width of the node accordingly
		const w = node.props.width / currentUnitNodeWidth;
		node.props.width = w * targetUnitNodeWidth;

		return node;
	}

	const getMouseOffset = e => {
		return {
			x: e.nativeEvent.offsetX,
			y: e.nativeEvent.offsetY
		}
	}

	const calculateNodeDimensions = unit => {
		return {
			x: baseNodeDimensions.width * HORIZONTAL_SCALE[unit].relativeNodeWidth,
			y: baseNodeDimensions.height
		}
	}

	const calculateCanvasDimensions = (nodeDimensions, grid) => {
		return {
			width: nodeDimensions.x * grid.x,
			height: nodeDimensions.y * grid.y
		}
	}

	const displayNodePathInfo = (type, id) => {
		setInfo(() => {
			return {
				...svgContent[type][id]
			}
		});
	}

	const deleteRow_ = id => {
		deleteRow(id);
		// updateNodes.map(x => console.log("~", svgContent.nodes[x]));
		// updateNodes.map(x => useGraph.updateAllNodePaths(x));
	}

	const DeleteDebugComponent = ({deleteRow__, deleteNode__, deletePath__}) => {
		const [state, setState] = useState("");
		return (
			<>
				<span>Delete row: </span>
				<input type="number" onChange={e => setState(e.target.value)} value={state}></input>
				<button onClick={() => {
					deleteRow__(state);
				}}>
					Delete Row
				</button>
				<button onClick={() => {
					deletePath__(state);
				}}>
					Delete Path
				</button>
				<button onClick={() => {
					deleteNode__(state, {handleIntermediateState: true});
				}}>
					Delete Node
				</button>
			</>
		)
	}

	return (
		<>
		<h3>{ unit_ }</h3>
		x: {canvasDimensions.width}, y: {canvasDimensions.height}
			<div className="tools">
				<button onClick={() => updateGridSize(1)}>+</button>
				<button onClick={() => updateGridSize(-1)}>-</button>
				<span>Secondary Unit: </span>
				<button onClick={() => {updateScale("WEEK")}}>Week</button>
				<button onClick={() => {updateScale("MONTH")}}>Month</button>
				<button onClick={() => {updateScale("QUARTER")}}>Quarter</button>
				<DeleteDebugComponent deleteRow__={deleteRow_} deleteNode__={deleteNode} deletePath__={deletePath} />
			</div>
			<div className="canvas-wrapper" style={{height: "480px"}}>	
				<HorizontalScale
					startDate={new Date()}
					baseUnit={unit_}
					unit={unit_}
					days={grid.current.x}
					styleInherited={{position: 'relative', left: baseNodeDimensions.width * 2, width: canvasDimensions.width}}
				/>
				<HorizontalScale
					startDate={new Date()}
					baseUnit={unit_}
					unit={HORIZONTAL_SCALE[unit_].base}
					days={grid.current.x}
					styleInherited={{position: 'relative', left: baseNodeDimensions.width * 2, width: canvasDimensions.width}}
				/>
				<div className="canvas-wrapper-item">
					<div className="row-labels" style={{height: canvasDimensions.height, maxWidth: baseNodeDimensions.width * 2}}>
						{gridLabels.current.map(x => x)}
					</div>
					<svg id="main-canvas" style={{overflow: "visible"}} className="main-canvas" {...canvasDimensions} onMouseMove={mainCanvasMouseMoveH} onMouseDown={mainCanvasMouseDownH} onMouseUp={mainCanvasMouseUpH} onContextMenu={e => e.preventDefault()}>
						{ gridlines && gridlines.horizontal.map(x => <line {...x}></line>) }
						{ gridlines && gridlines.vertical.map(x => <line {...x}></line>) }
						{ svgContent && Object.values(svgContent.nodes).map(x => <rect key={x.id} {...x.props} onMouseOver={() => displayNodePathInfo("nodes", x.id)} />) }
						{ svgContent && Object.values(svgContent.paths).map(x => <path key={x.id} {...x.props} onMouseOver={() => displayNodePathInfo("paths", x.id)} />) }
					</svg>
				</div>
				<div id="node-path-info">
					<pre>
						{info && JSON.stringify(info, null, 4)}
					</pre>
				</div>
			</div>
		</>
	)
};

export default CanvasM;