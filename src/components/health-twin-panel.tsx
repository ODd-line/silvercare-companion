import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HealthTwin, loadHealthTwin } from '@/lib/health-twin';
import { useAccount } from '@/providers/account-provider';

const LABELS = {
  'heart-rate-bpm': 'Heart rate',
  'step-count': 'Steps',
  'cadence-spm': 'Cadence',
  'gait-symmetry-percent': 'Gait symmetry',
} as const;

export function HealthTwinPanel() {
  const { demoMode, session } = useAccount();
  const [twin, setTwin] = useState<HealthTwin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!session || demoMode) return;
    setLoading(true);
    setError(null);
    try {
      setTwin(await loadHealthTwin());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update the health twin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [session, demoMode]);

  const title = twin?.state === 'review' ? 'Pattern worth reviewing'
    : twin?.state === 'steady' ? 'Recent pattern is steady'
      : twin?.state === 'building-baseline' ? 'Building your baseline'
        : 'Waiting for watch readings';

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>PERSONAL HEALTH TWIN</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading || !session || demoMode} onPress={refresh} style={styles.refresh}>
          <Text style={styles.refreshText}>{loading ? 'Updating' : 'Refresh'}</Text>
        </Pressable>
      </View>
      <Text style={styles.body}>This compares recent high-quality watch readings with your own 30-day baseline. It does not diagnose or predict a disease.</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {twin?.metrics.map((metric) => (
        <View key={metric.kind} style={styles.metricRow}>
          <View>
            <Text style={styles.metricLabel}>{LABELS[metric.kind]}</Text>
            <Text style={styles.metricValue}>{metric.latestValue.toFixed(metric.kind === 'step-count' ? 0 : 1)}</Text>
          </View>
          <View style={[styles.stateBadge, metric.state === 'review' && styles.reviewBadge]}>
            <Text style={[styles.stateText, metric.state === 'review' && styles.reviewText]}>
              {metric.state === 'building-baseline' ? `${metric.sampleCount}/7 samples` : metric.state.toUpperCase()}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 18, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  eyebrow: { color: '#285D78', fontSize: 10, fontWeight: '900' },
  title: { color: '#17211E', fontSize: 20, fontWeight: '800' },
  refresh: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#E7F1EC' },
  refreshText: { color: '#116A58', fontSize: 12, fontWeight: '800' },
  body: { color: '#59635F', fontSize: 13, lineHeight: 19 },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', padding: 10, borderRadius: 5, fontSize: 12 },
  metricRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9DED9', paddingTop: 10 },
  metricLabel: { color: '#69716D', fontSize: 11, fontWeight: '700' },
  metricValue: { color: '#17211E', fontSize: 22, fontWeight: '800' },
  stateBadge: { backgroundColor: '#E7F1EC', borderRadius: 5, paddingHorizontal: 9, paddingVertical: 6 },
  reviewBadge: { backgroundColor: '#F7EACD' },
  stateText: { color: '#116A58', fontSize: 10, fontWeight: '900' },
  reviewText: { color: '#8A5A12' },
});