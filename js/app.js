var defaultPointSize = 0.03;
var defaultLOD = 15;
var pointcloudPath = "bower_components/potree/resources/pointclouds/lion_takanawa/cloud.js";

var renderer;
var camera;
var scene;
var mouse = {
	x : 1,
	y : 1
};
var projector, raycaster;
var pointcloud, pointcloudMaterial;
var cube, cameraCube, sceneCube;

function loadSkybox() {
//	cameraCube = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 100000);
//	sceneCube = new THREE.Scene();

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

	mesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), material);
	scene.add(mesh);
}

function initGUI() {
	var gui = new dat.GUI({
		height : 5 * 32 - 1
	});

	var params = {
		PointSize : defaultPointSize,
		LOD : defaultLOD
	};

	var pLOD = gui.add(params, 'LOD', 0.5, 20);
	pLOD.onChange(function(value) {
		pointcloud.LOD = value;
	});

	var pPointSize = gui.add(params, 'PointSize', 0.01, 0.1);
	pPointSize.onChange(function(value) {
		pointcloudMaterial.size = value;
	});
}

function initThree() {
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

	projector = new THREE.Projector();
	raycaster = new THREE.Raycaster();

	renderer = new THREE.WebGLRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.autoClear = false;
	document.body.appendChild(renderer.domElement);

	loadSkybox();

	// pointcloud
	pointcloudMaterial = new THREE.PointCloudMaterial({
		size : defaultPointSize,
		vertexColors : true
	});
	var pco = POCLoader.load(pointcloudPath);
	pointcloud = new Potree.PointCloudOctree(pco, pointcloudMaterial);
	pointcloud.LOD = defaultLOD;
	pointcloud.rotation.set(Math.PI / 2, 0.85 * -Math.PI / 2, -0.0);
	// pointcloud.scale.set(0.5,0.5,0.5);
	pointcloud.moveToOrigin();
	pointcloud.moveToGroundPlane();
	pointcloud.position.y -= 1.6
	scene.add(pointcloud);

	// grid
	scene.add(createGrid(8, 8, 1));

	// measurement
	var sphereGeometry = new THREE.SphereGeometry(0.05, 32, 32);
	var sphereMaterial = new THREE.MeshBasicMaterial({
		color : 0xbb0000,
		shading : THREE.FlatShading
	});

    // controls
	var element = document.body;
	element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
	element.requestPointerLock();
	camera.position.set(2, 0.5, 15);
	controls = new THREE.PointerLockControls(camera);
	controls.enabled = true;
	scene.add(controls.getObject());
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


function render() {
	requestAnimationFrame(render);

	controls.isOnObject( false );

	controls.update();

	scene.traverse(function(object) {
		if (object instanceof Potree.PointCloudOctree) {
			object.update(camera);
		}
	});


	var numVisibleNodes = pointcloud.numVisibleNodes;
	var numVisiblePoints = pointcloud.numVisiblePoints;
	document.getElementById("lblNumVisibleNodes").innerHTML = "visible nodes: " + numVisibleNodes;
	document.getElementById("lblNumVisiblePoints").innerHTML = "visible points: " + Potree.utils.addCommas(numVisiblePoints);

	// render skybox
//	camera.updateMatrixWorld(true);
//	cameraCube.rotation.copy(camera.rotation);
//    renderer.render(sceneCube, cameraCube);

	renderer.render(scene, camera);
};

initThree();
initGUI();
render();
