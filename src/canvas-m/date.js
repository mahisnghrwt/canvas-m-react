const getUnits = (date, unit) => {
	switch(unit) {
		case 'WEEK':
			const day = 7 - date.getDay();
			return day;
		case 'MONTH':
			const maxDays = getDaysInMonth(date.getMonth());
			const remaining = maxDays - date.getDate() + 1;
			return remaining;
		case 'QUARTER':
			const month = date.getMonth();
			// get number of days remaining in current month
			// get number of months remaining
			// days remaining in this quarter = total days in q - already elapsed
			// which q is this?
			const q = parseInt(month / 3);
			const total = getDaysInQuarter(q);
			// find the starting month of this q, until this month
			const a = month % 3;
			const qStart = month - a;
			const qEnd = qStart + 3;
			const daysElapsed = 0;
			for (var i = month - a; i < qEnd; i++) {
				daysElapsed += getDaysInMonth(i);
			}
			daysElapsed += date.getDate();

			return total - daysElapsed;
	}
}

const getNextDateClamped = (date, unit) => {
	var days = getUnits(date, unit);

	// now simply add these days to the date
	// convert the days into months and days starting from current month
	return sum(date, days);

}

const sum = (date, days) => {
	const d = date.getDate();
	const m = date.getMonth();

	const daysInThisMonth = getDaysInMonth(m);
	if (days <= daysInThisMonth - d) {
		return date.setDate(d + days);
	}

	// while the days are more than the month m, keep 
	var i = 1;
	for (i; days > getDaysInMonth(m + i); i++) {
		days -= getDaysInMonth(m + i);
	}

	// increment the remaining month
	date.setMonth(m + i - 1);
	date.setDate(d + days);
}

const getDaysInQuarter = q => {
	// only 4 quarter
	var days = 0;
    q *= 3;
	const r = q + 3;
	for (q; q < r; q++) {
		days += getDaysInMonth(q);
	}

	return days;
}

const getDaysInMonth = month => {
	month++;
  
	var days = 31;
	if (month === 2) return 28;
	if (month % 2 === 0) {
	  days = 30;
	}
	if (month > 7)
	  return days === 31 ? 30: 31;
  
	return days;
}

  export {
	  getUnits
  }