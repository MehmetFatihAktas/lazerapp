const assert = require("assert");
const ProductTour = require("./laser_editor/product_tour.js");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test("tour starts only for unseen versions", () => {
  assert.equal(ProductTour.TOUR_VERSION, 3);
  assert.equal(ProductTour.shouldAutoStart({}, 1), true);
  assert.equal(ProductTour.shouldAutoStart({ productTourVersion: 1 }, 1), false);
  assert.equal(ProductTour.shouldAutoStart({ productTourVersion: 1 }, 2), true);
});

test("tour progress is clamped and marks endpoints", () => {
  assert.deepEqual(ProductTour.progress(-4, 5), { current: 1, total: 5, percent: 20, first: true, last: false });
  assert.deepEqual(ProductTour.progress(20, 5), { current: 5, total: 5, percent: 100, first: false, last: true });
});

test("card prefers a fully visible side", () => {
  const position = ProductTour.computeCardPosition(
    { left: 300, top: 80, right: 500, bottom: 140, width: 200, height: 60 },
    { width: 380, height: 260 },
    { width: 1280, height: 720 }
  );
  assert.equal(position.placement, "bottom");
  assert(position.left >= 16 && position.top >= 16);
});

test("card remains inside compact viewports", () => {
  const position = ProductTour.computeCardPosition(
    { left: 8, top: 8, right: 80, bottom: 50, width: 72, height: 42 },
    { width: 420, height: 360 },
    { width: 360, height: 500 }
  );
  assert(position.left >= 16 && position.top >= 16);
  assert(position.left + position.width <= 344);
  assert(position.top + position.height <= 484);
});
