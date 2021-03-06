import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers} from 'app';

const localVector = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

const _clone = o => JSON.parse(JSON.stringify(o));

const physicsId = physics.addBoxGeometry(new THREE.Vector3(0, -1, 0), new THREE.Quaternion(), new THREE.Vector3(1000, 1, 1000), false);

function mod(a, n) {
  return ((a%n)+n)%n;
}
const gridHelper = new THREE.GridHelper(10, 10);
app.object.add(gridHelper);

/* function animate(timestamp, frame, referenceSpace) {
  const now = Date.now();
}
renderer.setAnimationLoop(animate); */