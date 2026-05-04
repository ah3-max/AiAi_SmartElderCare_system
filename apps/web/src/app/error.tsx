'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>500</h1>
        <p>系統發生錯誤</p>
        <button onClick={reset} style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}>
          重試
        </button>
      </div>
    </div>
  );
}
