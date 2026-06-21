const Supercluster = require('supercluster');
const index = new Supercluster({radius: 40, maxZoom: 16});
index.load([{type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}}]);
try {
  index.getClusters([-180, -85, 180, 85], 10.5);
} catch (e) {
  console.log(e.message);
}
