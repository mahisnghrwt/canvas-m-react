const PathSnapPoint = {
    LEFT: "left",
    RIGHT: "right",
    TOP: "top",
    BOTTOM: "bottom"
}

const baseNodeDimensions = { width: 20, height: 25};


const HORIZONTAL_SCALE = {
	DAY: {
		primary: "DAY",
		base: "DAY",
		relativeNodeWidth: 1
	},
	WEEK: {
		primary: "WEEK",
		base: "DAY",
		relativeNodeWidth: 1
	},
	MONTH: {
		primary: "MONTH",
		base: "WEEK",
		relativeNodeWidth: 0.5
	},
	QUARTER: {
		primary: "QUARTER",
		base: "WEEK",
		relativeNodeWidth: 0.5
	}
}

const convertUnit = (x, from, to) => {
	return (x * HORIZONTAL_SCALE[to].relativeNodeWidth) / HORIZONTAL_SCALE[from].relativeNodeWidth;
}

const parseObjectPropToInt = obj => {
	const obj_ = {};
	for(const prop in obj) {
		obj_[prop] = parseInt(obj[prop]);
	}

	return obj_;
}

export {
    PathSnapPoint,
    baseNodeDimensions,
    HORIZONTAL_SCALE,
	convertUnit,
	parseObjectPropToInt
}