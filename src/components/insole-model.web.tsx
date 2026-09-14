import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

type ModelView = 'systems' | 'pressure';

const SENSOR_POSITIONS = [
  { x: -18, y: 78, label: 'Toe' },
  { x: 17, y: 55, label: 'Forefoot' },
  { x: -10, y: 5, label: 'Midfoot' },
  { x: 0, y: -78, label: 'Heel' },
];

function makeInsoleShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -112);
  shape.bezierCurveTo(-30, -110, -38, -91, -36, -67);
  shape.bezierCurveTo(-34, -42, -24, -17, -27, 10);
  shape.bezierCurveTo(-34, 45, -43, 77, -31, 101);
  shape.bezierCurveTo(-19, 121, 17, 123, 34, 101);
  shape.bezierCurveTo(49, 78, 40, 44, 29, 14);
  shape.bezierCurveTo(20, -12, 34, -43, 36, -69);
  shape.bezierCurveTo(38, -94, 28, -111, 0, -112);
  return shape;
}

function createTrace(points: THREE.Vector3[]) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x1f8f74 }));
}

function createInsole(side: -1 | 1, pressureMode: boolean) {
  const group = new THREE.Group();
  group.position.x = side * 49;
  group.scale.x = side;

  const shell = new THREE.Mesh(
    new THREE.ExtrudeGeometry(makeInsoleShape(), {
      depth: 5,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 2,
      bevelThickness: 1.5,
      curveSegments: 32,
    }),
    new THREE.MeshPhysicalMaterial({
      color: pressureMode ? 0xc7ded4 : 0xdbe9e2,
      roughness: 0.72,
      metalness: 0.02,
      clearcoat: 0.18,
    }),
  );
  shell.geometry.center();
  group.add(shell);

  const topLayer = new THREE.Mesh(
    new THREE.ExtrudeGeometry(makeInsoleShape(), {
      depth: 0.9,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 1,
      bevelThickness: 0.5,
      curveSegments: 32,
    }),
    new THREE.MeshStandardMaterial({ color: 0xf1f6f2, roughness: 0.86, transparent: true, opacity: 0.82 }),
  );
  topLayer.geometry.center();
  topLayer.position.z = 4.5;
  group.add(topLayer);

  SENSOR_POSITIONS.forEach((sensor, index) => {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(index === 3 ? 11 : 8.5, index === 3 ? 11 : 8.5, 1.5, 28),
      new THREE.MeshStandardMaterial({
        color: pressureMode ? [0xe15241, 0xf09a3e, 0xe9c44b, 0xd6653a][index] : 0x2a8f75,
        emissive: pressureMode ? 0x31130d : 0x08241d,
        emissiveIntensity: 0.25,
        roughness: 0.4,
      }),
    );
    pad.rotation.x = Math.PI / 2;
    pad.position.set(sensor.x, sensor.y, 6.2);
    group.add(pad);
    group.add(createTrace([
      new THREE.Vector3(sensor.x, sensor.y, 6.4),
      new THREE.Vector3(sensor.x * 0.55, Math.max(-73, sensor.y - 25), 6.4),
      new THREE.Vector3(0, -76, 6.4),
    ]));
  });

  const imu = new THREE.Mesh(
    new THREE.BoxGeometry(17, 14, 3),
    new THREE.MeshStandardMaterial({ color: 0x27607a, roughness: 0.45, metalness: 0.1 }),
  );
  imu.position.set(0, -20, 7);
  group.add(imu);

  const controller = new THREE.Mesh(
    new THREE.BoxGeometry(25, 20, 4),
    new THREE.MeshStandardMaterial({ color: 0x183c35, roughness: 0.38, metalness: 0.12 }),
  );
  controller.position.set(-5, -83, 7.2);
  group.add(controller);

  const battery = new THREE.Mesh(
    new THREE.BoxGeometry(19, 30, 3.5),
    new THREE.MeshStandardMaterial({ color: 0xc4a85c, roughness: 0.5, metalness: 0.18 }),
  );
  battery.position.set(18, -79, 7);
  group.add(battery);

  return group;
}

function createInsolePair(pressureMode: boolean) {
  const product = new THREE.Group();
  product.add(createInsole(-1, pressureMode));
  product.add(createInsole(1, pressureMode));
  return product;
}

function disposeProduct(product: THREE.Object3D) {
  product.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export function InsoleModel() {
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef({ x: -0.72, y: 0, z: -0.08 });
  const [view, setView] = useState<ModelView>('systems');
  const [resetKey, setResetKey] = useState(0);
  const [stlUrl, setStlUrl] = useState<string | null>(null);

  useEffect(() => {
    const product = createInsolePair(false);
    product.updateMatrixWorld(true);
    const stl = new STLExporter().parse(product);
    const url = URL.createObjectURL(new Blob([stl], { type: 'model/stl' }));
    setStlUrl(url);
    disposeProduct(product);
    return () => URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200);
    camera.position.set(0, -275, 300);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xf7fbf7, 0x587069, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-120, -100, 250);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x76c6ae, 1.8);
    rimLight.position.set(150, 120, 120);
    scene.add(rimLight);

    const product = createInsolePair(view === 'pressure');
    product.rotation.set(rotationRef.current.x, rotationRef.current.y, rotationRef.current.z);
    scene.add(product);

    let dragging = false;
    let previousX = 0;
    let previousY = 0;
    const canvas = renderer.domElement;
    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        dragging = true;
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      product.rotation.y += (event.clientX - previousX) * 0.008;
      product.rotation.x += (event.clientY - previousY) * 0.006;
      previousX = event.clientX;
      previousY = event.clientY;
      rotationRef.current = { x: product.rotation.x, y: product.rotation.y, z: product.rotation.z };
    };
    const pointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    globalThis.addEventListener('resize', resize);
    resize();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      globalThis.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      disposeProduct(scene);
      renderer.dispose();
      canvas.remove();
    };
  }, [view, resetKey]);

  const resetView = () => {
    rotationRef.current = { x: -0.72, y: 0, z: -0.08 };
    setResetKey((value) => value + 1);
  };

  return (
    <View style={styles.section}>
      <View style={[styles.headingRow, compact && styles.headingRowCompact]}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>3D SYSTEM CONCEPT</Text>
          <Text style={styles.title}>How the insoles work</Text>
        </View>
        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {stlUrl && (
            <a
              aria-label="Export concept STL"
              download="silvercare-predictive-gait-insoles-concept.stl"
              href={stlUrl}
              style={{ alignItems: 'center', backgroundColor: '#116A58', borderRadius: 6, color: '#FFFFFF', display: 'flex', fontFamily: 'Arial', fontSize: 12, fontWeight: 800, minHeight: 40, padding: '0 12px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Export concept STL
            </a>
          )}
          <Pressable accessibilityRole="button" onPress={resetView} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset view</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.segmentedControl}>
        <Pressable onPress={() => setView('systems')} style={[styles.segment, view === 'systems' && styles.segmentActive]}>
          <Text style={[styles.segmentText, view === 'systems' && styles.segmentTextActive]}>System layout</Text>
        </Pressable>
        <Pressable onPress={() => setView('pressure')} style={[styles.segment, view === 'pressure' && styles.segmentActive]}>
          <Text style={[styles.segmentText, view === 'pressure' && styles.segmentTextActive]}>Pressure zones</Text>
        </Pressable>
      </View>
      <div ref={mountRef} style={{ width: '100%', height: 'clamp(360px, 45vw, 480px)', touchAction: 'none', cursor: 'grab' }} aria-label="Interactive 3D model of predictive gait insoles" />
      <Text style={styles.dragHint}>Drag the model to inspect the layered sensor layout.</Text>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.swatch, styles.pressureSwatch]} /><Text style={styles.legendText}>4 pressure zones per foot</Text></View>
        <View style={styles.legendItem}><View style={[styles.swatch, styles.imuSwatch]} /><Text style={styles.legendText}>6-axis motion sensor</Text></View>
        <View style={styles.legendItem}><View style={[styles.swatch, styles.controllerSwatch]} /><Text style={styles.legendText}>Heel controller + radio</Text></View>
        <View style={styles.legendItem}><View style={[styles.swatch, styles.batterySwatch]} /><Text style={styles.legendText}>Rechargeable battery</Text></View>
      </View>
      <Text style={styles.boundary}>Concept geometry only. Sensor placement, pressure calibration, enclosure flex, battery safety, wash resistance, biocompatibility, and clinical validity require physical prototyping and specialist review.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', marginTop: 12, marginBottom: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  headingRowCompact: { flexDirection: 'column', gap: 12 },
  headingCopy: { flex: 1, gap: 4 },
  actions: { alignItems: 'flex-end', gap: 7 },
  actionsCompact: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  eyebrow: { color: '#116A58', fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  title: { color: '#17211E', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: 0 },
  resetButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#AAB5AF', borderRadius: 6 },
  resetText: { color: '#40504A', fontSize: 12, fontWeight: '800' },
  exportButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#116A58', borderRadius: 6 },
  exportText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  segmentedControl: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: '#E3E8E3', borderRadius: 6, padding: 3, marginTop: 14 },
  segment: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 4 },
  segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#68716D', fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: '#116A58' },
  dragHint: { color: '#727B77', textAlign: 'center', fontSize: 11, marginTop: -10, marginBottom: 14 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { width: '48%', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 9 },
  swatch: { width: 13, height: 13, borderRadius: 3 },
  pressureSwatch: { backgroundColor: '#2A8F75' },
  imuSwatch: { backgroundColor: '#27607A' },
  controllerSwatch: { backgroundColor: '#183C35' },
  batterySwatch: { backgroundColor: '#C4A85C' },
  legendText: { flex: 1, color: '#44514C', fontSize: 12, fontWeight: '700' },
  boundary: { color: '#6B736F', fontSize: 11, lineHeight: 17, marginTop: 12 },
});