import React from 'react';

const SubChart = React.forwardRef(({ id, containerRef, height, children, legend, title }, ref) => {
  return (
    <div style={{ position: 'relative', background: '#161a1e', borderRadius: '8px', border: '1px solid #2b3139', marginBottom: '15px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 10, display: 'flex', gap: '15px', alignItems: 'center', pointerEvents: 'none' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#848e9c' }}>{title}</span>
        {legend}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: `${height}px` }} />
      {children}
    </div>
  );
});

export default SubChart;
