import { StyleSheet, Text, View } from 'react-native';

const ZONES = [
  { label: 'Toe pressure', top: '8%', left: '22%' },
  { label: 'Forefoot pressure', top: '24%', left: '57%' },
  { label: 'Motion sensor', top: '53%', left: '28%' },
  { label: 'Controller + battery', top: '79%', left: '42%' },
] as const;

export function InsoleModel() {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>SYSTEM CONCEPT</Text>
      <Text style={styles.title}>How the insoles work</Text>
      <View style={styles.diagram} accessibilityLabel="Predictive gait insole sensor layout">
        <View style={styles.insole}>
          {ZONES.map((zone) => (
            <View key={zone.label} style={[styles.zone, { top: zone.top, left: zone.left }]}>
              <Text style={styles.zoneText}>{zone.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.boundary}>Concept geometry only. Sensor placement, calibration, flex, battery safety, wash resistance, and clinical validity require physical prototyping and specialist review.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 8, marginVertical: 12 },
  eyebrow: { color: '#116A58', fontSize: 11, fontWeight: '900', letterSpacing: 0 },
  title: { color: '#17211E', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: 0 },
  diagram: { height: 390, alignItems: 'center', justifyContent: 'center' },
  insole: { width: 150, height: 340, borderRadius: 70, backgroundColor: '#D9E9E1', borderWidth: 3, borderColor: '#88AA9D', transform: [{ rotate: '-6deg' }] },
  zone: { position: 'absolute', minWidth: 68, minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 21, backgroundColor: '#116A58' },
  zoneText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  boundary: { color: '#6B736F', fontSize: 11, lineHeight: 17 },
});