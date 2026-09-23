// Runs before the production bundle. Two animation frames approximate a painted
// DOM; this is not a compositor/GPU completion or a real-user INP measurement.
window.renderingMeasurement = { started: performance.now() };
const observer = new MutationObserver(() => {
  const expected = window.renderingExpected;
  if (!expected || window.renderingMeasurement.ready) return;
  const nodes = document.querySelectorAll(".react-flow__node");
  const edges = document.querySelectorAll(".react-flow__edge");
  if (nodes.length !== expected.nodes || edges.length !== expected.edges) return;
  if ([...nodes].some((node) => getComputedStyle(node).visibility === "hidden")) return;
  window.renderingMeasurement.ready = true;
  observer.disconnect();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      window.renderingMeasurement.initialMs =
        performance.now() - window.renderingMeasurement.started;
    }),
  );
});
observer.observe(document, { childList: true, subtree: true, attributes: true });
