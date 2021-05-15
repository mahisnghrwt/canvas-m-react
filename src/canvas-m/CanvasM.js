import React, { useEffect, useRef, useReducer, useState } from 'react';
import { PathSnapPoint, baseNodeDimensions, HORIZONTAL_SCALE, parseObjectPropToInt } from './util.js';
import { Node, Path } from './graph.js';
import Helper from './helper.js'
import HorizontalScale from './HorizontalScale.js';
import { add, differenceInDays } from 'date-fns';

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
						...action.update,
						props: {
							...state.nodes[action.target].props,
							...action.update.props
						}
					}
				}
			}
		case 'updateNodeProps':
			return {
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
		case 'addNewPath':
			return {
				nodes: state.nodes,
				paths: {
					...state.paths,
					[action.path.id]: {
						...action.path
					}
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
		case 'updatePathProps':
			return {
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
		case 'replace':
			return action.replace
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
	const startDate = useRef(new Date());
	const halfYear = 180;
	const unit = useRef("MONTH");
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

		const gridPos = canvasCoordToGrid({ x: mouseEvent.nativeEvent.offsetX, y: mouseEvent.nativeEvent.offsetY });
		if (gridPos == null) {
			cancelDragNode(dragNode.current, "Trying to drag out of canvas!");
			useGraph.updateAllNodePaths(dragNode.current);
			return;
		}
		if (gridPos.x === svgContent.nodes[dragNode.current].props.x && gridPos.y === svgContent.nodes[dragNode.current].props.y)
			return;
		const updatedStartDate = add(startDate.current, { days: parseInt(gridPos.x) });
		const pos = gridCoordToCanvas(gridPos);
		const action = {
			type: 'updateNode',
		 	target: dragNode.current,
			update: {
				startDate: updatedStartDate,
				props: {
					x: pos.x,
					y: pos.y
				}
			}
		}
		dispatch(action);
	}

	const endDragNode = mouseEvent => {
		if (isDraggingNode.current === false)
			return;

		useGraph.updateAllNodePaths(dragNode.current);
		isDraggingNode.current = false;
		dragNode.current = -1;
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
		const id = IDCOUNTER.current++;
		const gridCoord = canvasCoordToGrid(coordinates);
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
		}

		// Add new node to the graph
		// --Graph.addNode(id);
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

			// get the id of target node
			const nodeWidth = svgContent.nodes[id].props.width;

			const extractNode = () => {
				const {props: {x, y, height, width}} = svgContent.nodes[id];
				return {x, y, height, width};
			}

			const node = extractNode(id);
		
			// returns {id: nodeId, paths: { [pathId]: 1}}
			// -- we are already storing the information in the JSObj, soo, we dont necessarily need another class to store this information, :P kill this source of redundancy
			// -- instead store the information in the stateonly
			// -- that means, new paths obj need to be appended to the node object in the state
			// -- but create "reducer" like functions for help!
			const nodeInfo = useGraph.getNodeInfo(id);
			if (nodeInfo == null || nodeInfo == undefined) return;
		
			// where to latch the path on this node
			// -- can we rename this to something better??
			const leftSnapPoint = Helper.path.determineNodeSnapPoint_(node, PathSnapPoint.LEFT);
			const rightSnapPoint = Helper.path.determineNodeSnapPoint_(node, PathSnapPoint.RIGHT);
		
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
				const pathD = Helper.path.parseToObject(svgContent.paths[pathId].props.d);
				var updatedPath = null;
		
				// if the current node is the origin of path
				//    then we latch the path to the right side of the node
				// else
				//      latch to the left side of the node
				if (pathInfo.origin == id) {
					// -- appropriately rename this 'calcControlPoints' function
					// updatedPath = calcControlPoints(rightSnapPoint, pathD.tail, nodeWidth);
					// updatedPath = Helper.path.determineControlPoints({ head: rightSnapPoint, tail: pathD.tail }, nodeWidth);
					updatedPath = Helper.path.determineControlPoints__(parseObjectPropToInt(node), parseObjectPropToInt(svgContent.nodes[pathInfo.end].props));
				}
				else {
					updatedPath = Helper.path.determineControlPoints__(parseObjectPropToInt(svgContent.nodes[pathInfo.origin].props), parseObjectPropToInt(node));
					// updatedPath = Helper.path.determineControlPoints({ head: pathD.head, tail: leftSnapPoint }, nodeWidth);
				}

				// update the "d" attribuite of the Path
				// -- update the "d" property of path in state
				dispatch({ type: "updatePathProps", target: pathId, update: { d: Helper.path.parseToString(updatedPath) }});
				// path.setAttribute("d", parsePathDToStr(updatedPath));
			}
		}
	};

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
		console.log("tagName: ", nodeElement.getAttribute("tagName"));
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