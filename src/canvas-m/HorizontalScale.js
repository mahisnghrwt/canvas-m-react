import { useEffect, useRef, useState } from 'react';
import {baseNodeDimensions, HORIZONTAL_SCALE} from './util.js';
import differenceInDays from 'date-fns/differenceInDays';
import { add, endOfMonth, endOfQuarter, endOfWeek, startOfQuarter } from 'date-fns';


const HorizontalScale = ({startDate, baseUnit, unit, days, styleInherited}) => {
	const nodeDimensions = useRef(null);
	const [labels, setLabels] = useState(null);

	useEffect(() => {
		// based on the unit decide the width of the node
		if (baseUnit === unit) {
			nodeDimensions.current = {
				width: HORIZONTAL_SCALE[unit].relativeNodeWidth * baseNodeDimensions.width,
				height: baseNodeDimensions.height
			};
		}
		else {
			nodeDimensions.current = {
				width: HORIZONTAL_SCALE[baseUnit].relativeNodeWidth * baseNodeDimensions.width,
				height: baseNodeDimensions.height
			};
		}

		const lastDate = add(startDate, {days});
		const labelsTemp = [];
		while (startDate < lastDate) {
			const widthInUnits = clipDateUnit(startDate, unit, lastDate);
			const dimensions = { ...nodeDimensions.current, minWidth: nodeDimensions.current.width * widthInUnits};
			const style = {...dimensions};
			const label = <div className="col-label" style={style}>
				{ getLabel(startDate, unit) }
			</div>

			labelsTemp.push(label);
			startDate = getNextDateInUnit(startDate, unit);
		}

		setLabels(_ => {
			return [...labelsTemp];
		})

	}, [unit])

	const clipDateUnit = (date, unit, lastDate) => {
		var remainingUnits = 0;
		switch(unit) {
			case "DAY":
				remainingUnits = 0;
				break;
			case "WEEK":
				remainingUnits = Math.min(differenceInDays(endOfWeek(date), date), differenceInDays(lastDate, date));	
				break;
			case "MONTH":
				remainingUnits = Math.min(differenceInDays(endOfMonth(date), date), differenceInDays(lastDate, date));
				break;
			case "QUARTER":
				remainingUnits = Math.min(differenceInDays(endOfQuarter(date), date), differenceInDays(lastDate, date));
				break;
			default:
				throw new Error(`Unexpected unit: ${unit}`);
		}

		return remainingUnits + 1;
	}

	const getNextDateInUnit = (date, unit) => {
		const amount = { days: 1 };
		switch(unit) {
			case "DAY":
				return add(date, amount);
			case "WEEK":
				return add(endOfWeek(date), amount);
			case "MONTH":
				return add(endOfMonth(date), amount);
			case "QUARTER":
				return add(endOfQuarter(date), amount);
			default:
				throw new Error(`Unexpected unit: ${unit}`);
		}
	}

	const getLabel = (date, unit) => {
		switch(unit) {
			case "DAY":
				return date.getDate();
			case "WEEK":
				return date.getDate();
			case "MONTH":
				return `${date.toDateString()} to ${endOfMonth(date).toDateString()}`;
			case "QUARTER":
				return `${date.toDateString()} to ${endOfQuarter(date).toDateString()}`;
			default:
				throw new Error(`Unexpected unit: ${unit}`);
		}
	}

	return (
		<div className="col-labels" style={{ ...styleInherited }}>
			{ labels && labels.map(x => x) }
		</div>
	);
}

export default HorizontalScale;