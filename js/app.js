var defaultPointSize = 0.09;
var defaultLOD = 12;

// var pointcloudPath =
// 'http://192.168.6.34/potree/resources/pointclouds/viaappia/cloud_laz.js';
//var pointcloudPath = 'data/out_8/cloud.js';
// var viaappia_server_root = 'http://192.168.6.12/';
// var pointcloudPath = viaappia_server_root +
// 'BACKGROUNDS/CONV/DRIVE_1_V3/out_8/out_8.js';
 var pointcloudPath = 'data/out_6/cloud.js';

var pointcloud;
var skybox;
var stats;
var clock = new THREE.Clock();
var materials = {};

var renderer;
var camera;
var scene;
var mouse = {
	x : 1,
	y : 1
};
var projector, raycaster;
var spStart, spEnd, sConnection;
var placeStartMode = false;
var placeEndMode = false;
var cube, cameraCube, sceneCube;

var firstperson;

var pathcontrols;

var useOculus = false;

var testBox;
var selectedObject = false;
var objectBoundingBoxes = [];

// dat.gui bound parameters
var controlParams;

var timeToUpdateMap = 0;
var MAP_TIMESTEPS = 30;

function getFov() {
	if (useOculus) {
		return 110;
	} else {
		return 75;
	}
}
var pipeSpline;
var cameraPath = [];

var jqxhr = $.get("data/cameraPath.json", function(data) {
	// $( ".result" ).html( data );

	$.each(data.features, function(id, value) {
		var coordinates = value.geometry.coordinates;
		var vector = new THREE.Vector3(coordinates[0], coordinates[1], coordinates[2]);
		// console.log(vector);
		cameraPath.push(vector);
	});

	pathcontrols = new PathControls(camera, pipeSpline);
	// pathcontrols.enable();

}).fail(function() {
	console.log("Error while loading cameraPath");
});

pipeSpline = new THREE.SplineCurve3(cameraPath);

function loadSkybox() {
	cameraCube = new THREE.PerspectiveCamera(getFov(), window.innerWidth / window.innerHeight, 1, 100000);
	sceneCube = new THREE.Scene();

	var path = "bower_components/potree/resources/textures/skybox/";
	var format = ".jpg";
	var urls = [ path + 'px' + format, path + 'nx' + format, path + 'py' + format, path + 'ny' + format, path + 'pz' + format, path + 'nz' + format ];

	var textureCube = THREE.ImageUtils.loadTextureCube(urls, new THREE.CubeRefractionMapping());
	var material = new THREE.MeshBasicMaterial({
		color : 0xffffff,
		envMap : textureCube,
		refractionRatio : 0.95
	});

	var shader = THREE.ShaderLib["cube"];
	shader.uniforms["tCube"].value = textureCube;

	var material = new THREE.ShaderMaterial({

		fragmentShader : shader.fragmentShader,
		vertexShader : shader.vertexShader,
		uniforms : shader.uniforms,
		depthWrite : false,
		side : THREE.BackSide

	}),

	mesh = new THREE.Mesh(new THREE.BoxGeometry(10000, 10000, 10000), material);
	sceneCube.add(mesh);
}

function initGUI() {
	var gui = new dat.GUI({
		height : 5 * 32 - 1,
		autoplace : false
	});
	var guiContainer = document.getElementById('my-gui-container');
	guiContainer.appendChild(gui.domElement);

	// hide controls by default
	gui.close();

	controlParams = {
		PointSize : defaultPointSize,
		LOD : defaultLOD,
		'toggleOculus' : toggleOculus,
		'show aabb' : false,
		'placeStart' : placeStart,
		'placeEnd' : placeEnd,
		startPosition : '',
		distance : 0,
		visibleNodes : 0,
		visiblePoints : 0
	};

	var pLOD = gui.add(controlParams, 'LOD', 0.5, 50);
	pLOD.onChange(function(value) {
		pointcloud.LOD = value;
	});

	var pPointSize = gui.add(controlParams, 'PointSize', 0.01, 0.5);
	pPointSize.onChange(function(value) {
		pointcloud.material.size = value;
	});
	gui.add(controlParams, 'toggleOculus');
	var measureFolder = gui.addFolder('Distance measurement');
	measureFolder.add(controlParams, 'placeStart');
	measureFolder.add(controlParams, 'placeEnd');
	measureFolder.add(controlParams, 'startPosition').listen();
	measureFolder.add(controlParams, 'distance').listen();
	var statsFolder = gui.addFolder('Stats');
	statsFolder.add(controlParams, 'visibleNodes').listen();
	statsFolder.add(controlParams, 'visiblePoints').listen();
	statsFolder.add(controlParams, 'show aabb').onChange(function(value) {
		pointcloud.showBoundingBox = value;
	});
}

function initThree() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(getFov(), window.innerWidth / window.innerHeight, 0.001, 100000);

	projector = new THREE.Projector();
	raycaster = new THREE.Raycaster();

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.autoClear = false;
	document.body.appendChild(renderer.domElement);

	// OculusRift
	effect = new THREE.OculusRiftEffect(renderer, {
		worldScale : 100
	});
	effect.setSize(window.innerWidth, window.innerHeight);

	loadSkybox();
	scene.add(sceneCube);

	// pointcloud
	pointcloudMaterial = new THREE.PointCloudMaterial({
		size : defaultPointSize,
		vertexColors : true
	});

	// materials
	materials.rgb = new Potree.PointCloudRGBMaterial({
		size : defaultPointSize
	});
	materials.color = new Potree.PointCloudColorMaterial({
		size : defaultPointSize
	});
	materials.height = new Potree.PointCloudHeightMaterial({
		size : defaultPointSize,
		min : 0,
		max : 10
	});
	materials.intensity = new Potree.PointCloudIntensityMaterial({
		size : defaultPointSize,
		min : 0,
		max : 65535
	});

	// load pointcloud
	var pco = POCLoader.load(pointcloudPath, {
		toOrigin : true
	});

	pointcloud = new Potree.PointCloudOctree(pco, materials.rgb);
	pointcloud.LOD = defaultLOD;
	pointcloud.position.set(pointcloud.position.x - (pointcloud.boundingBox.max.x - pointcloud.boundingBox.min.x) / 2.0, 0.0, pointcloud.position.z
			+ (pointcloud.boundingBox.max.y - pointcloud.boundingBox.min.y) / 2.0);
	pointcloud.rotation.set(-Math.PI / 2.0, 0.0, 0.0);

	scene.add(pointcloud);

	// load object point clouds
	// now only one and based on local data, so commented out
	// var pco = POCLoader.load('data/pyramid/cloud.js', {toOrigin: true});
	// var objectPointcloud = new Potree.PointCloudOctree(pco, materials.rgb);
	// objectPointcloud.LOD = defaultLOD;
	// objectPointcloud.rotation.set(-Math.PI/2.0, 0.0, 0.0);
	// objectPointcloud.moveToOrigin();
	// objectPointcloud.moveToGroundPlane();
	// objectPointcloud.position.set(-760.60, 5.39, -1066.72);

	// console.log(pco);
	// console.log(objectPointcloud);
	// console.log(objectPointcloud.boundingBox);

	// scene.add(objectPointcloud);

	// add object bounding box to objectBoundingBoxes array
	// now using fake (but multiple) bounding boxes
	for (var i = 0; i < 3; i++) {
		for (var j = 0; j < 3; j++) {
			var objectBBox = createVisibleBoundingBox(-760.60 + (i * 4), 5.39 + (j * 4), -1066.72);
			objectBBox.name = '' + i + '-' + j;
			objectBoundingBoxes.push(objectBBox);
			// show bounding box
			scene.add(objectBBox);
		}
	}

	// grid
	scene.add(createGrid(8, 8, 1));

	// measurement
	var sphereGeometry = new THREE.SphereGeometry(0.05, 32, 32);
	var sphereMaterial = new THREE.MeshBasicMaterial({
		color : 0xbb0000,
		shading : THREE.FlatShading
	});
	spStart = new THREE.Mesh(sphereGeometry, sphereMaterial);
	spEnd = new THREE.Mesh(sphereGeometry, sphereMaterial);
	// spStart.position.set(-1.1,1.05,2);
	// spEnd.position.set(1.3,1.0,1.15);
	spStart.position.set(-2.2, 1.9, 1.66);
	spEnd.position.set(0.02, 2, 2.64);
	scene.add(spStart);
	scene.add(spEnd);

	var lc = new THREE.Color(0xff0000);
	var lineGeometry = new THREE.Geometry();
	lineGeometry.vertices.push(spStart.position.clone(), spEnd.position.clone());
	lineGeometry.colors.push(lc, lc, lc);
	var lineMaterial = new THREE.LineBasicMaterial({
		vertexColors : THREE.VertexColors
	});
	sConnection = new THREE.Line(lineGeometry, lineMaterial);
	scene.add(sConnection);

	// controls
	// camera.position.set(-818, 12, -960);
	camera.position.set(-760.162, 8, -1056.573);
	// controls = new THREE.OrbitControls(camera, renderer.domElement);
	// controls.target.set(-818, 12, -948);
	// camera.lookAt(new THREE.Vector3(-767.595, 8, -1018.541));

	firstperson = new OculusFirstPersonControls(camera);

	window.addEventListener('resize', onResize, false);

	document.addEventListener('mousemove', onDocumentMouseMove, false);
	renderer.domElement.addEventListener('click', onClick, false);
}

function addTextLabel(message, x, y, z) {

	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	// context.font = "Bold " + fontsize + "px " + fontface;

	// get size data (height depends only on font size)
	var metrics = context.measureText(message);
	var textWidth = metrics.width;

	// background color
	// context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g +
	// ","
	// + backgroundColor.b + "," + backgroundColor.a + ")";

	// context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
	// + borderColor.b + "," + borderColor.a + ")";

	// context.lineWidth = borderThickness;
	// roundRect(context, borderThickness/2, borderThickness/2, textWidth +
	// borderThickness, fontsize * 1.4 + borderThickness, 6);
	// 1.4 is extra height factor for text below baseline: g,j,p,q.

	// text color
	// context.fillStyle = "rgba(0, 0, 0, 1.0)";

	// context.fillText( message, borderThickness, fontsize + borderThickness);

	var imageObj = new Image();
	imageObj.onload = function() {
		context.drawImage(imageObj, 10, 10);
		context.font = "40pt Calibri";
		context.fillText(message, 30, 70);
		// canvas contents will be used for a texture
		var texture = new THREE.Texture(canvas)
		texture.needsUpdate = true;

		var spriteMaterial = new THREE.SpriteMaterial({
			map : texture,
			useScreenCoordinates : false,
		});
		var sprite = new THREE.Sprite(spriteMaterial);
		// sprite.scale.set(100,50,1.0);
		sprite.scale.set(10, 5, 1.0);

		sprite.position.set(x, y, z);
		scene.add(sprite);
	};
	imageObj.src = "data/label-small.png";

}

// function for drawing rounded rectangles
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
}

function createVisibleBoundingBox(x, y, z) {
	var boxGeometry = new THREE.BoxGeometry(3, 3, 3);
	var boxMaterial = new THREE.MeshBasicMaterial({
		color : 0xFF99CC,
		wireframe : true
	});
	var bBox = new THREE.Mesh(boxGeometry, boxMaterial);
	bBox.position.set(x, y, z);
	return bBox;
}

function createGrid(width, length, spacing) {
	var material = new THREE.LineBasicMaterial({
		color : 0xBBBBBB
	});

	var geometry = new THREE.Geometry();
	for (var i = 0; i <= length; i++) {
		geometry.vertices.push(new THREE.Vector3(-(spacing * width) / 2, 0, i * spacing - (spacing * length) / 2));
		geometry.vertices.push(new THREE.Vector3(+(spacing * width) / 2, 0, i * spacing - (spacing * length) / 2));
	}

	for (var i = 0; i <= width; i++) {
		geometry.vertices.push(new THREE.Vector3(i * spacing - (spacing * width) / 2, 0, -(spacing * length) / 2));
		geometry.vertices.push(new THREE.Vector3(i * spacing - (spacing * width) / 2, 0, +(spacing * length) / 2));
	}

	var line = new THREE.Line(geometry, material, THREE.LinePieces);
	line.receiveShadow = true;
	return line;
}

function onResize() {
	if (!useOculus) {
		windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);
		aspectRatio = window.innerWidth / window.innerHeight;

		camera.aspect = aspectRatio;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	} else {
		effect.setSize(window.innerWidth, window.innerHeight);
	}
}

function onDocumentMouseMove(event) {
	event.preventDefault();

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

worldSpaceToLatLon = function(pointToConvert) {
	var x = pointToConvert[0] + (pointcloud.boundingBox.max.x - pointcloud.boundingBox.min.x) / 2.0 - pointcloud.pcoGeometry.offset.x;
	var y = -pointToConvert[1] + (pointcloud.boundingBox.max.y - pointcloud.boundingBox.min.y) / 2.0 - pointcloud.pcoGeometry.offset.y;

	proj4.defs('EPSG:32633', "+proj=utm +zone=33 +ellps=WGS84 +datum=WGS84 +units=m +no_defs");
	return proj4('EPSG:32633', 'EPSG:4326', [ x, y ]);
}

LatLonToWorldSpace = function(pointToConvert) {
	proj4.defs('EPSG:32633', "+proj=utm +zone=33 +ellps=WGS84 +datum=WGS84 +units=m +no_defs");
	var proj = proj4('EPSG:4326', 'EPSG:32633', pointToConvert);
	var x = proj[0] - (pointcloud.boundingBox.max.x - pointcloud.boundingBox.min.x) / 2.0 + pointcloud.pcoGeometry.offset.x;
	var y = -(proj[1] - (pointcloud.boundingBox.max.y - pointcloud.boundingBox.min.y) / 2.0 + pointcloud.pcoGeometry.offset.y);

	return [ x, y ];
}

function render() {
	requestAnimationFrame(render);

	pointcloud.update(camera);

	if (useOculus) {
		firstperson.updateInput();
	} else {
		if (pathcontrols != null) {
			pathcontrols.updateInput();
		}
	}

	var coords = worldSpaceToLatLon([ camera.position.x, camera.position.z ]);

	if (timeToUpdateMap > MAP_TIMESTEPS) {
		map.getView().setCenter(ol.proj.transform([ coords[0], coords[1] ], 'EPSG:4326', 'EPSG:3857'));
		timeToUpdateMap = 0;
	} else {
		timeToUpdateMap++;
	}

	// centerMap([vec_proj[1], vec_proj[0]]);

	camera.updateMatrixWorld(true);

	vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
	projector.unprojectVector(vector, camera);
	raycaster.params = {
		"PointCloud" : {
			threshold : 0.1
		}
	};
	raycaster.ray.set(camera.position, vector.sub(camera.position).normalize());

	scene.traverse(function(object) {
		if (object instanceof Potree.PointCloudOctree) {
			object.update(camera);
		}
	});

	// Bounding box selection
	// TODO: do something with selected object (see onClick())
	var intersects = raycaster.intersectObjects(objectBoundingBoxes, false);
	if (intersects.length > 0) {
		var I = intersects[0];
		selectedObject = true;
		I.object.material.color.setHex(0x99FFFF);
		testBox = I.object;
	} else {
		selectedObject = false;
		objectBoundingBoxes.forEach(function(bbox) {
			bbox.material.color.setHex(0xFF99CC);
		});
	}

	if (placeStartMode || placeEndMode) {
		var intersects = raycaster.intersectObject(pointcloud, true);

		if (intersects.length > 0) {
			var I = intersects[0];

			if (placeStartMode) {
				spStart.position.copy(I.point);
			} else if (placeEndMode) {
				spEnd.position.copy(I.point);
			}

			sConnection.geometry.vertices[0].copy(spStart.position);
			sConnection.geometry.vertices[1].copy(spEnd.position);
			sConnection.geometry.verticesNeedUpdate = true;
			sConnection.geometry.computeBoundingSphere();
		}
	}

	// placing distance label
	var labelPos = spStart.position.clone().add(spEnd.position).multiplyScalar(0.5);
	projector.projectVector(labelPos, camera);
	labelPos.x = (labelPos.x + 1) / 2 * window.innerWidth;
	labelPos.y = -(labelPos.y - 1) / 2 * window.innerHeight;

	var distance = spStart.position.distanceTo(spEnd.position);
	controlParams.distance = distance;
	controlParams.visibleNodes = pointcloud.numVisibleNodes;
	controlParams.visiblePoints = pointcloud.numVisiblePoints;
	controlParams.startPosition = Potree.utils.addCommas(spStart.position.x) + "/" + Potree.utils.addCommas(spStart.position.y) + "/"
			+ Potree.utils.addCommas(spStart.position.z);

	if (!useOculus) {
		// Non-Oculus rendering
		renderer.render(scene, camera);
	} else {
		// Rendering through the Oculus effect
		effect.render(scene, camera);
	}
};

initThree();
initGUI();
addTextLabel(' Lion ', -1.5, 6.3, -1.3);
render();

function placeStart() {
	placeStartMode = true;
	placeEndMode = false;
}

function placeEnd() {
	placeStartMode = false;
	placeEndMode = true;
}

function onClick() {
	placeStartMode = false;
	placeEndMode = false;

	// console.log(spStart.position);
	// console.log(spEnd.position);

	if (selectedObject) {
		console.log('Selected object ' + testBox.name);
	}
}

function toggleOculus() {
	useOculus = !useOculus;
	onResize();

	if (!useOculus) {
		camera.fov = getFov();
		camera.updateProjectionMatrix();
		firstperson.disable();

		// camera.position.set(4, 6, 10);
		// controls.target.set(0, 3, 0);
		// controls.update();
		// camera.lookAt(controls.target);

	} else {
		camera.fov = getFov();
		camera.updateProjectionMatrix();
		firstperson.enable();

	}

}
