import * as THREE from 'three';
import {renderer, camera, runtime, world, universe, physics, ui, rig, app, appManager, popovers} from 'app';

const localVector = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

const _clone = o => JSON.parse(JSON.stringify(o));

const physicsId = physics.addBoxGeometry(new THREE.Vector3(0, -1, 0), new THREE.Quaternion(), new THREE.Vector3(1000, 1, 1000), false);

const textMesh = ui.makeTextMesh('Mode Select', undefined, 30, 'center', 'middle');
textMesh.position.set(0, 20, -100);
app.object.add(textMesh);

const floorBaseMesh = (() => {
  const geometry = new THREE.PlaneBufferGeometry(100, 100)
    .applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), -Math.PI/2))
    // .applyMatrix4(localMatrix.makeTranslation(0, -0.1, 0));
  const material = new THREE.MeshPhongMaterial({
    color: 0xCCCCCC,
    shininess: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // mesh.castShadow = false;
  mesh.receiveShadow = true;

  return mesh;
})();
floorBaseMesh.position.set(0, -0.2, 0);
app.object.add(floorBaseMesh);

function mod(a, n) {
  return ((a%n)+n)%n;
}
const floorMesh = (() => {
  const parcelSize = 16;
  const numTiles = 16;
  const numTiles2P1 = 2*numTiles+1;
  const planeBufferGeometry = new THREE.PlaneBufferGeometry(1, 1)
    .applyMatrix4(localMatrix.makeScale(0.95, 0.95, 1))
    .applyMatrix4(localMatrix.makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI/2)))
    // .applyMatrix4(localMatrix.makeTranslation(0, 0.1, 0))
    .toNonIndexed();
  const numCoords = planeBufferGeometry.attributes.position.array.length;
  const numVerts = numCoords/3;
  const positions = new Float32Array(numCoords*numTiles2P1*numTiles2P1);
  const centers = new Float32Array(numCoords*numTiles2P1*numTiles2P1);
  const typesx = new Float32Array(numVerts*numTiles2P1*numTiles2P1);
  const typesz = new Float32Array(numVerts*numTiles2P1*numTiles2P1);
  let i = 0;
  for (let x = -numTiles; x <= numTiles; x++) {
    for (let z = -numTiles; z <= numTiles; z++) {
      const newPlaneBufferGeometry = planeBufferGeometry.clone()
        .applyMatrix4(localMatrix.makeTranslation(x, 0, z));
      positions.set(newPlaneBufferGeometry.attributes.position.array, i * newPlaneBufferGeometry.attributes.position.array.length);
      for (let j = 0; j < newPlaneBufferGeometry.attributes.position.array.length/3; j++) {
        localVector.set(x, 0, z).toArray(centers, i*newPlaneBufferGeometry.attributes.position.array.length + j*3);
      }
      let typex = 0;
      if (mod((x + parcelSize/2), parcelSize) === 0) {
        typex = 1/8;
      } else if (mod((x + parcelSize/2), parcelSize) === parcelSize-1) {
        typex = 2/8;
      }
      let typez = 0;
      if (mod((z + parcelSize/2), parcelSize) === 0) {
        typez = 1/8;
      } else if (mod((z + parcelSize/2), parcelSize) === parcelSize-1) {
        typez = 2/8;
      }
      for (let j = 0; j < numVerts; j++) {
        typesx[i*numVerts + j] = typex;
        typesz[i*numVerts + j] = typez;
      }
      i++;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('center', new THREE.BufferAttribute(centers, 3));
  geometry.setAttribute('typex', new THREE.BufferAttribute(typesx, 1));
  geometry.setAttribute('typez', new THREE.BufferAttribute(typesz, 1));
  /* const geometry = new THREE.PlaneBufferGeometry(300, 300, 300, 300)
    .applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)))); */
  const floorVsh = `
    #define PI 3.1415926535897932384626433832795
    uniform float uAnimation;
    attribute vec3 center;
    attribute float typex;
    attribute float typez;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;

    float range = 1.0;

    void main() {
      float animationRadius = uAnimation * ${numTiles.toFixed(8)};
      float currentRadius = length(center.xz);
      float radiusDiff = abs(animationRadius - currentRadius);
      float height = max((range - radiusDiff)/range, 0.0);
      height = sin(height*PI/2.0);
      height *= 0.2;
      // height = 0.0;
      vec3 p = vec3(position.x, position.y + height, position.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      vPosition = position + vec3(0.5, 0.0, 0.5);
      vTypex = typex;
      vTypez = typez;
      vDepth = gl_Position.z/gl_Position.w / 10.;
    }
  `;
  const floorFsh = `
    uniform vec4 uCurrentParcel;
    uniform vec4 uHoverParcel;
    uniform vec4 uSelectedParcel;
    uniform vec3 uSelectedColor;
    // uniform float uAnimation;
    varying vec3 vPosition;
    varying float vTypex;
    varying float vTypez;
    varying float vDepth;
    void main() {
      vec3 c;
      float a;
      if (
        vPosition.x >= uSelectedParcel.x &&
        vPosition.z >= uSelectedParcel.y &&
        vPosition.x <= uSelectedParcel.z &&
        vPosition.z <= uSelectedParcel.w
      ) {
        // c = uSelectedColor;
        c = vec3(0.7);
      } else {
        c = vec3(0.9);
        // c = vec3(0.3);
      }
      float add = 0.0;
      if (
        vPosition.x >= uHoverParcel.x &&
        vPosition.z >= uHoverParcel.y &&
        vPosition.x <= uHoverParcel.z &&
        vPosition.z <= uHoverParcel.w
      ) {
        add = 0.2;
      } else {
        vec3 f = fract(vPosition);
        if (vTypex >= 2.0/8.0) {
          if (f.x >= 0.8) {
            add = 0.2;
          }
        } else if (vTypex >= 1.0/8.0) {
          if (f.x <= 0.2) {
            add = 0.2;
          }
        }
        if (vTypez >= 2.0/8.0) {
          if (f.z >= 0.8) {
            add = 0.2;
          }
        } else if (vTypez >= 1.0/8.0) {
          if (f.z <= 0.2) {
            add = 0.2;
          }
        }
      }
      // c += add;
      a = (1.0-vDepth);
      gl_FragColor = vec4(c, a);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uCurrentParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uHoverParcel: {
        type: 'v4',
        value: new THREE.Vector4(),
      },
      uSelectedParcel: {
        type: 'v4',
        value: new THREE.Vector4(-8, -8, 8, 8),
      },
      uSelectedColor: {
        type: 'c',
        value: new THREE.Color().setHex(0x5c6bc0),
      },
      uAnimation: {
        type: 'f',
        value: 0,
      },
    },
    vertexShader: floorVsh,
    fragmentShader: floorFsh,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  // mesh.castShadow = true;
  // mesh.receiveShadow = true;
  return mesh;
})();
floorMesh.position.set(8, -0.1, 8);
app.object.add(floorMesh);

function animate(timestamp, frame, referenceSpace) {
  const now = Date.now();

  floorMesh.material.uniforms.uAnimation.value = (now%2000)/2000;
}
renderer.setAnimationLoop(animate);

(async () => {
  const w = 4;
  const roomSpecs = [
    {
      // name: 'Red',
      color: 0x673ab7,
    },
    {
      // name: 'Green',
      color: 0x8bc34a,
    },
    {
      // name: 'Blue',
      color: 0xff5722,
    },
    {
      // name: 'Orange',
      color: 0xec407a,
    },
  ];
  const res = await fetch(`./street/street.scn`);
  const streetScn = await res.json();
  streetScn.extents = [
    [-w/2, 0, -w/2],
    [w/2, w, w/2],
  ];
  await Promise.all([
    world.addStaticObject(URL.createObjectURL(new Blob([JSON.stringify(streetScn)])) + '/street.url', null, new THREE.Vector3(), new THREE.Quaternion())
      .then(portalMesh => {
        portalMesh.material.uniforms.uColor.value.setHex(0xFF0000);
        
        const popoverWidth = 600;
        const popoverHeight = 200;
        const popoverTarget = new THREE.Object3D();
        popoverTarget.position.copy(portalMesh.position).add(new THREE.Vector3(0, 2, 0));
        const popoverTextMesh = (() => {
          const textMesh = ui.makeTextMesh('Solo', undefined, 0.5, 'center', 'middle');
          textMesh.position.z = 0.1;
          textMesh.scale.x = popoverHeight / popoverWidth;
          textMesh.color = 0xFFFFFF;
          return textMesh;
        })();
        const popoverMesh = popovers.addPopover(popoverTextMesh, {
          width: popoverWidth,
          height: popoverHeight,
          target: popoverTarget,
        });
      }),
    /* (() => {
      const streetMultiplayerScn = _clone(streetScn);
      streetMultiplayerScn.room = 'multiplayer';
      return world.addStaticObject(URL.createObjectURL(new Blob([JSON.stringify(streetMultiplayerScn)])) + '/street-multiplayer.url', null, new THREE.Vector3(w, 0, 0), new THREE.Quaternion())
        .then(portalMesh => {
          portalMesh.material.uniforms.uColor.value.setHex(0x00FF00);
          
          const popoverWidth = 600;
          const popoverHeight = 200;
          const popoverTarget = new THREE.Object3D();
          popoverTarget.position.copy(portalMesh.position).add(new THREE.Vector3(0, 2, 0));
          const popoverTextMesh = (() => {
            const textMesh = ui.makeTextMesh('Multiplayer', undefined, 0.5, 'center', 'middle');
            textMesh.position.z = 0.1;
            textMesh.scale.x = popoverHeight / popoverWidth;
            textMesh.color = 0xFFFFFF;
            return textMesh;
          })();
          const popoverMesh = popovers.addPopover(popoverTextMesh, {
            width: popoverWidth,
            height: popoverHeight,
            target: popoverTarget,
          });
        })
    })(), */
  ].concat(roomSpecs.map(async (roomSpec, i) => {                                                                           
    const streetRoomScn = _clone(streetScn);
    streetRoomScn.room = 'room-' + i;
    return world.addStaticObject(URL.createObjectURL(new Blob([JSON.stringify(streetRoomScn)])) + '/street-room-' + i + '.url', null, new THREE.Vector3(-roomSpecs.length/2 - w/2 + i*w, 0, -w), new THREE.Quaternion())
      .then(portalMesh => {
        portalMesh.material.uniforms.uColor.value.setHex(roomSpec.color);
        
        const popoverWidth = 600;
        const popoverHeight = 200;
        const popoverTarget = new THREE.Object3D();
        popoverTarget.position.copy(portalMesh.position).add(new THREE.Vector3(0, 2, 0));
        const popoverTextMesh = (() => {
          const textMesh = ui.makeTextMesh('Room ' + i, undefined, 0.5, 'center', 'middle');
          textMesh.position.z = 0.1;
          textMesh.scale.x = popoverHeight / popoverWidth;
          textMesh.color = 0xFFFFFF;
          return textMesh;
        })();
        const popoverMesh = popovers.addPopover(popoverTextMesh, {
          width: popoverWidth,
          height: popoverHeight,
          target: popoverTarget,
        });
      })
  })));
})();