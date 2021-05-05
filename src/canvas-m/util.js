class Utility {
    static idCounter = 0;
    static getId() {
        return this.idCounter++;
    }
};

const PathSnapPoint = {
    LEFT: "left",
    RIGHT: "right",
    TOP: "top",
    BOTTOM: "bottom"
}

function copy(target) {
    const obj = {};

    for (const prop in target) {
        obj[prop] = target[prop];
    }

    return obj;
}



export {
    Utility, PathSnapPoint, copy
}