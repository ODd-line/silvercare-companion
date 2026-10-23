import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#174EA6" size="large" />
      <Text style={styles.text}>Loading your Time Bank...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EC', alignItems: 'center', justifyContent: 'center', gap: 14 },
  text: { color: '#59635F', fontSize: 15, fontWeight: '600' },
});