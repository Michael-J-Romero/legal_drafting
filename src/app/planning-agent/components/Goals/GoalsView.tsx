'use client';

export default function GoalsView() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
      <div style={{ textAlign: 'center', color: '#6b7280', marginTop: 40 }}>
        <p style={{ fontSize: 24, fontWeight: 600, color: '#111827', marginBottom: 16 }}>🎯 Goals</p>
        <p style={{ fontSize: 16, marginBottom: 20 }}>Set and track your goals</p>
        <div style={{ backgroundColor: '#fff', padding: 40, borderRadius: 8, border: '1px solid #e5e7eb', maxWidth: 600, margin: '0 auto' }}>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Coming soon: Goals management interface</p>
          <p style={{ color: '#9ca3af', fontSize: 14, marginTop: 10 }}>
            This view will allow you to define goals, set milestones, and monitor achievements.
          </p>
        </div>
      </div>
    </div>
  );
}
