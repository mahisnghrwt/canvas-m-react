import { PathSnapPoint } from './util.js';

const determineControlPoints = (node, nodeWidth) => {
	return {
		...node,
		c1: {
			x: node.head.x + (nodeWidth * 2),
			y: node.head.y
		},
		c2: {
			x: node.tail.x - (nodeWidth * 2),
			y: node.tail.y
		}
	}
}

const determineControlPoints_ = (head, tail, startNode, endNode) => {
	return {
		head,
		tail,
		c1: {
			x: startNode.x + (startNode.width * 2),
			y: startNode.y
		},
		c2: {
			x: endNode.x - (endNode.width * 2),
			y: endNode.y
		}
	}
}

const parseToObject = (path) => {
	// parse d to string
	// split on space
	const tokenized = String(path).split(" ");
	// we get 8 elements inside the "tokenized" array
	// substring element at index 0 and 2
	const obj = {};

	try {
		obj.head = {
			x: parseInt(tokenized[0].substr(1)),
			y: parseInt(tokenized[1])
		};
		obj.c1 = {
			x: parseInt(tokenized[2].substr(1)),
			y: parseInt(tokenized[3])
		};
		obj.c2 = {
			x: parseInt(tokenized[4]),
			y: parseInt(tokenized[5])
		};
		obj.tail = {
			x: parseInt(tokenized[6]),
			y: parseInt(tokenized[7])		
		};
	} catch (error) {
		throw new Error(error);
	}

	return obj;
}

const parseToString = path => {
	if (path == null)
		return null;

	const necessaryAttributes = ["head", "tail", "c1", "c2"];
	const necessaryAttributesCount = necessaryAttributes.length;

	for (var i = 0; i < necessaryAttributesCount; i++) {
		if (path[necessaryAttributes[i]] === 'undefined') {
			return null;
		}
		else {
			if (path[necessaryAttributes[i]]['x'] === 'undefined')
				return null;
			if (path[necessaryAttributes[i]]['y'] === 'undefined')
				return null;
		}
	}

	// we are not checking for valid data type yet.

	return `M${path.head.x} ${path.head.y} C${path.c1.x} ${path.c1.y} ${path.c2.x} ${path.c2.y} ${path.tail.x} ${path.tail.y}`;
}

const compute = (d, endPos, nodeDimensions) => {
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

const compute_ = (startNode, endNode) => {
	const pathHead = determineNodeSnapPoint_(startNode, PathSnapPoint.RIGHT);
	const pathTail = determineNodeSnapPoint_(endNode, PathSnapPoint.LEFT);
	return parseToString(determineControlPoints_(pathHead, pathTail, startNode, endNode));
}

function determineNodeSnapPoint(node, pathSnapPoint) {
	var tail = { x: 0, y: 0 };

	if (pathSnapPoint == PathSnapPoint.RIGHT) {
		tail.x += node.width;
		tail.y += node.height / 2;
	}
	else if (pathSnapPoint == PathSnapPoint.LEFT) {
		tail.y += node.height / 2;
	}
	else if (pathSnapPoint == PathSnapPoint.TOP) {
		tail.x += node.width / 2;
	}
	else if (pathSnapPoint == PathSnapPoint.BOTTOM) {
		tail.x += node.width / 2;
		tail.y += node.height;
	}

	tail.x += node.x;
	tail.y += node.y;

	return tail;
}

function determineNodeSnapPoint_(node, pathSnapPoint) {
	var snapPos = { x: 0, y: 0 };
	// // get the x, y attribute of the node
	// const nodeX =  parseInt(node.props.x);
	// const nodeY = parseInt(node.getAttribute("y"));
	// // We will also get the height and width of the node, since the width can be changed at runtime.
	// const nodeH = parseInt(node.getAttribute("height"));
	// const nodeW = parseInt(node.getAttribute("width"));

	switch(pathSnapPoint) {
		case PathSnapPoint.RIGHT:
			snapPos.x += node.width;
			snapPos.y += node.height / 2;
			break;
		case PathSnapPoint.LEFT:
			snapPos.y += node.height / 2;
			break;
		case PathSnapPoint.TOP:
			snapPos.x += node.width / 2;
			break;
		case PathSnapPoint.BOTTOM:
			snapPos.x += node.width / 2;
			snapPos.y += node.height;
			break;
	}

	snapPos.x += node.x;
	snapPos.y += node.y;

	return snapPos;

	// if (pathSnapPoint == PathSnapPoint.RIGHT) {
	// 	tail.x += nodeW;
	// 	tail.y += nodeH / 2;
	// }
	// else if (pathSnapPoint == PathSnapPoint.LEFT) {
	// 	tail.y += nodeH / 2;
	// }
	// else if (pathSnapPoint == PathSnapPoint.TOP) {
	// 	tail.x += nodeW / 2;
	// }
	// else if (pathSnapPoint == PathSnapPoint.BOTTOM) {
	// 	tail.x += nodeW / 2;
	// 	tail.y += nodeH;
	// }

	// tail.x += nodeX;
	// tail.y += nodeY;

	// return tail;
}

export {
	determineControlPoints,
	parseToObject,
	parseToString,
	compute,
	compute_,
	determineNodeSnapPoint_
}