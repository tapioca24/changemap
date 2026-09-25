// Real SVG paint verification: jsdom cannot resolve marker colors or CSS color-mix.
(async () => {
  const paint = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  const rgba = (color) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const statuses = ["unchanged", "added", "deleted"].filter((status) =>
    document.querySelector(`.react-flow__edge.edge-${status}`),
  );
  const check = (edge, muted) => {
    const style = getComputedStyle(edge);
    if (style.opacity !== "1") throw Error("Edge group opacity reintroduced expensive compositing");
    const line = edge.querySelector(".react-flow__edge-path");
    const markerId = line
      .getAttribute("marker-end")
      .replace(/^url\(['"]?#/, "")
      .replace(/['"]?\)$/, "");
    const arrow = document.getElementById(markerId)?.querySelector("polyline");
    if (!arrow) throw Error("Arrow marker does not resolve");
    const stroke = rgba(getComputedStyle(line).stroke);
    const arrowStyle = getComputedStyle(arrow);
    const alpha = muted ? Math.round(255 * 0.12) : 255;
    for (const color of [stroke, rgba(arrowStyle.fill), rgba(arrowStyle.stroke)]) {
      if (Math.abs(color[3] - alpha) > 1) throw Error("Line or arrow opacity is wrong");
      if (color.some((value, index) => Math.abs(value - stroke[index]) > 1))
        throw Error("Arrow does not match the line color");
    }
    const deleted = edge.classList.contains("edge-deleted");
    if (deleted && getComputedStyle(line).strokeDasharray !== "6px, 4px")
      throw Error("Deleted edge lost its dashed line");
    if (!edge.classList.contains("edge-unchanged")) {
      for (const selector of [".react-flow__edge-text", ".react-flow__edge-textbg"]) {
        const label = edge.querySelector(selector);
        if (!label || Number(getComputedStyle(label).fillOpacity) !== (muted ? 0.12 : 1))
          throw Error("Change label or background opacity is wrong");
      }
    }
  };
  const previous = document.querySelector(".react-flow__edge.edge-active");
  previous
    .querySelector(".react-flow__edge-interaction")
    .dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  await paint();
  const selected = [...document.querySelectorAll(".edge-active")]
    .map((edge) => edge.dataset.id)
    .sort();
  const theme = document.querySelector("select");
  const originalTheme = theme.value;
  for (const value of ["mocha", "latte"]) {
    theme.value = value;
    theme.dispatchEvent(new Event("change", { bubbles: true }));
    await paint();
    for (const status of statuses) {
      const edge = document.querySelector(`.react-flow__edge.edge-${status}`);
      const interaction = edge.querySelector(".react-flow__edge-interaction");
      interaction.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      await paint();
      if (
        document.querySelectorAll(".edge-active").length !== 1 ||
        !edge.classList.contains("edge-active")
      )
        throw Error("Hover did not take priority over selection");
      check(edge, false);
      for (const otherStatus of statuses) {
        const muted = document.querySelector(`.edge-muted.edge-${otherStatus}`);
        if (!muted) throw Error("Unrelated edge was not muted");
        check(muted, true);
      }
      interaction.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      await paint();
      const restored = [...document.querySelectorAll(".edge-active")]
        .map((entry) => entry.dataset.id)
        .sort();
      if (JSON.stringify(restored) !== JSON.stringify(selected))
        throw Error("Selection highlight was not restored");
      check(edge, edge.classList.contains("edge-muted"));
    }
  }
  theme.value = originalTheme;
  theme.dispatchEvent(new Event("change", { bubbles: true }));
  await paint();
  return { statuses, themes: ["mocha", "latte"], selectionRestored: true };
})();
