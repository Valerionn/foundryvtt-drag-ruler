import {buildCostFunction} from "./api.js";
import {settingsKey} from "./settings.js";
import {highlightTokenShape} from "./util.js";

export function highlightMeasurementTerrainRuler(
	ray,
	startDistance,
	tokenShape = [{x: 0, y: 0}],
	alpha = 1,
) {
	for (const space of ray.terrainRulerVisitedSpaces.reverse()) {
		const color = this.dragRulerGetColorForDistance(startDistance + space.distance);
		highlightTokenShape.call(this, space, tokenShape, color, alpha);
	}
}

export function measureDistances(segments, entity, shape, options = {}) {
	const opts = foundry.utils.duplicate(options);
	if (canvas.grid.diagonalRule === "EUCL") {
		opts.ignoreGrid = true;
		opts.gridSpaces = false;
	}
	if (opts.enableTerrainRuler) {
		opts.gridSpaces = true;
		const firstNewSegmentIndex = segments.findIndex(segment => !segment.ray.dragRulerVisitedSpaces);
		const previousSegments = segments.slice(0, firstNewSegmentIndex);
		const newSegments = segments.slice(firstNewSegmentIndex);
		const distances = previousSegments.map(
			segment =>
				segment.ray.dragRulerVisitedSpaces[segment.ray.dragRulerVisitedSpaces.length - 1].distance,
		);
		previousSegments.forEach(
			segment =>
				(segment.ray.terrainRulerVisitedSpaces = foundry.utils.duplicate(segment.ray.dragRulerVisitedSpaces)),
		);
		opts.costFunction = buildCostFunction(entity, shape);
		if (previousSegments.length > 0)
			opts.terrainRulerInitialState =
				previousSegments[previousSegments.length - 1].ray.dragRulerFinalState;
		return distances.concat(terrainRuler.measureDistances(newSegments, opts));
	} else {
		// If another module wants to enable grid measurements but disable grid highlighting,
		// manually set the *duplicate* option's gridSpaces value to true for the Foundry logic to work properly
		if (!opts.ignoreGrid) {
			opts.gridSpaces = true;
		}

		if(segments.length === 0) return [];

		// canvas.grid.measureDistances returns a wrong distance for diagonals in v12
		// measurePath wants waypoints instead of segments - therefore, we just separate the rays into
		// waypoints (assuming each ray ends where the next one starts)
		const waypoints = [ segments[0].ray.A ];
		for(const segment of segments) {
			waypoints.push(segment.ray.B);
		}

		const measure = canvas.grid.measurePath(waypoints);
		return measure.segments.map(s => s.distance);
	}
}

export function checkDependencies() {
	if (!game.modules.get("socketlib")?.active) {
		console.error(
			"Drag Ruler | The `socketlib` module isn't enabled, but it's required for Drag Ruler to operate properly.",
		);
		if (game.user.isGM) {
			new Dialog({
				title: game.i18n.localize("drag-ruler.dependencies.socketlib.title"),
				content: `<h2>${game.i18n.localize(
					"drag-ruler.dependencies.socketlib.title",
				)}</h2><p>${game.i18n.localize("drag-ruler.dependencies.socketlib.text")}</p>`,
				buttons: {
					ok: {
						icon: '<i class="fas fa-check"></i>',
						label: game.i18n.localize("drag-ruler.dependencies.ok"),
					},
				},
			}).render(true);
		}
	} else if (
		!game.modules.get("terrain-ruler")?.active &&
		game.user.isGM &&
		!game.settings.get(settingsKey, "neverShowTerrainRulerHint")
	) {
		const lastHint = game.settings.get(settingsKey, "lastTerrainRulerHintTime");
		if (Date.now() - lastHint > 604800000) {
			// One week
			let enabledTerrainModule;
			if (game.modules.get("enhanced-terrain-layer")?.active) {
				enabledTerrainModule = game.modules.get("enhanced-terrain-layer").data.title;
			}
			if (enabledTerrainModule) {
				new Dialog({
					title: game.i18n.localize("drag-ruler.dependencies.terrain-ruler.title"),
					content: `<h2>${game.i18n.localize(
						"drag-ruler.dependencies.terrain-ruler.title",
					)}</h2><p>${game.i18n.format("drag-ruler.dependencies.terrain-ruler.text", {
						moduleName: enabledTerrainModule,
					})}</p>`,
					buttons: {
						ok: {
							icon: '<i class="fas fa-check"></i>',
							label: game.i18n.localize("drag-ruler.dependencies.ok"),
							callback: () =>
								game.settings.set(settingsKey, "lastTerrainRulerHintTime", Date.now()),
						},
						neverShowAgain: {
							icon: '<i class="fas fa-times"></i>',
							label: game.i18n.localize("drag-ruler.dependencies.terrain-ruler.neverShowAgain"),
							callback: () => game.settings.set(settingsKey, "neverShowTerrainRulerHint", true),
						},
					},
					close: () => game.settings.set(settingsKey, "lastTerrainRulerHintTime", Date.now()),
				}).render(true);
			}
		}
	}
}
