import polygonClipping from 'polygon-clipping';

export default class PolygonBooleanOperator {
  static calculateDataInPolygon(polygon, dataPoints) {
    const isPointInPolygon = (point, polygon) => {
      const [x, y] = point;
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    };

    const insidePoints = dataPoints.filter(point => isPointInPolygon(point, polygon));
    const percentage = ((insidePoints.length / dataPoints.length) * 100).toFixed(2);
    return { count: insidePoints.length, percentage };
  }

  // 交集 (AND)
  static intersect(poly1, poly2) {
    const result = polygonClipping.intersection([poly1], [poly2]);
    return result.length > 0 ? result[0][0] : [];
  }

  // 聯集 (OR)
  static union(poly1, poly2) {
    const result = polygonClipping.union([poly1], [poly2]);
    return result.length > 0 ? result[0][0] : [];
  }

  // 差集 (NOT)
  static difference(poly1, poly2) {
    const result = polygonClipping.difference([poly1], [poly2]);
    return result.length > 0 ? result[0][0] : [];
  }
}