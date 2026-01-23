export function isEqual(obj1, obj2, visited = new Set()) {
    if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
        return obj1 === obj2;
    }
    if (obj1.constructor !== obj2.constructor) {
        return false;
    }
    if (obj1 === obj2 || obj1.valueOf() === obj2.valueOf()) {
        return true;
    }
    if (Array.isArray(obj1) && obj1.length !== obj2.length) {
        return false;
    }
    if (obj1 instanceof Date) {
        return obj1.getTime() === obj2.getTime();
    }
    if (!(obj1 instanceof Object)) {
        return false;
    }
    if (!(obj2 instanceof Object)) {
        return false;
    }
    if (visited.has(obj1)) {
        return true;
    }
    visited.add(obj1);
    const p = Object.keys(obj1);
    return Object.keys(obj2).every(i => p.indexOf(i) !== -1) &&
        p.every(i => isEqual(obj1[i], obj2[i], visited));
}
